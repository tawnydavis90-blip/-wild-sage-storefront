const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const clean = value => String(value || '').trim();
const escapeHtml = value => clean(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const dollars = cents => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
}).format(Number(cents || 0) / 100);

function emailConfig(env = process.env) {
  return {
    apiKey: clean(env.RESEND_API_KEY),
    from: clean(env.WILD_SAGE_FROM_EMAIL || env.WILD_SAGE_SENDER_EMAIL || env.TRANSACTIONAL_FROM_EMAIL || env.RESEND_FROM_EMAIL || env.ORDER_FROM_EMAIL),
    shippingFrom: clean(env.SHIPPING_FROM_EMAIL || env.WILD_SAGE_SHIPPING_FROM_EMAIL),
    support: clean(env.SUPPORT_EMAIL || env.WILD_SAGE_SUPPORT_EMAIL || 'support@wildsageapparel.com'),
    notify: clean(env.WILD_SAGE_NOTIFICATION_EMAIL || env.WILD_SAGE_NOTIFY_EMAIL || env.WILD_SAGE_OWNER_EMAIL || env.ADMIN_NOTIFICATION_EMAIL || env.OWNER_NOTIFICATION_EMAIL || env.ORDER_NOTIFICATION_EMAIL)
  };
}

function customerEmail(session = {}) {
  return clean(session.customer_details?.email || session.customer_email);
}

function customerName(session = {}) {
  return clean(session.customer_details?.name || session.collected_information?.shipping_details?.name || session.shipping_details?.name || 'there');
}

async function sendResendEmail(message, { env = process.env, fetchImpl = fetch, idempotencyKey } = {}) {
  const config = emailConfig(env);
  if (!config.apiKey || !config.from) {
    throw new Error('Resend is missing RESEND_API_KEY or WILD_SAGE_FROM_EMAIL.');
  }

  const response = await fetchImpl(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
    },
    body: JSON.stringify({ from: config.from, ...message })
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Resend ${response.status}: ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : {};
}

export async function sendPaidOrderEmails({ session, orderNumber, printifyOrder, env = process.env, fetchImpl = fetch }) {
  const config = emailConfig(env);
  const toCustomer = customerEmail(session);
  const safeOrder = escapeHtml(orderNumber || session?.id);
  const total = dollars(session?.amount_total);
  const storeUrl = clean(env.PUBLIC_STORE_URL || 'https://wildsageapparel.com').replace(/\/$/, '');
  const jobs = [];

  if (toCustomer) {
    jobs.push({
      kind: 'customer',
      promise: sendResendEmail({
        to: [toCustomer],
        subject: `Wild Sage order ${orderNumber || ''} confirmed`.trim(),
        html: `<div style="font-family:Arial,sans-serif;color:#222;line-height:1.6"><h1 style="font-family:Georgia,serif">Your order is confirmed</h1><p>Hi ${escapeHtml(customerName(session))},</p><p>Thank you for your Wild Sage Apparel order. Your payment of <strong>${escapeHtml(total)}</strong> was received and your order has been sent for fulfillment.</p><p><strong>Order number:</strong> ${safeOrder}</p><p>You will receive tracking information when your order ships.</p><p><a href="${escapeHtml(storeUrl)}">Wild Sage Apparel</a></p></div>`,
        text: `Hi ${customerName(session)},\n\nYour Wild Sage Apparel payment of ${total} was received and your order has been sent for fulfillment.\n\nOrder number: ${orderNumber || session?.id}\n\nYou will receive tracking information when your order ships.\n\n${storeUrl}`
      }, { env, fetchImpl, idempotencyKey: `wild-sage-${session?.id}-customer` })
    });
  }

  if (config.notify) {
    jobs.push({
      kind: 'owner',
      promise: sendResendEmail({
        to: [config.notify],
        subject: `Paid Wild Sage order ${orderNumber || session?.id}`,
        html: `<div style="font-family:Arial,sans-serif;color:#222;line-height:1.6"><h1 style="font-family:Georgia,serif">New paid order</h1><p><strong>Order:</strong> ${safeOrder}</p><p><strong>Customer:</strong> ${escapeHtml(customerName(session))}</p><p><strong>Email:</strong> ${escapeHtml(toCustomer || 'Not provided')}</p><p><strong>Total:</strong> ${escapeHtml(total)}</p><p><strong>Stripe session:</strong> ${escapeHtml(session?.id)}</p><p><strong>Printify order:</strong> ${escapeHtml(printifyOrder?.id || 'Existing order located')}</p></div>`,
        text: `New paid Wild Sage order\n\nOrder: ${orderNumber || session?.id}\nCustomer: ${customerName(session)}\nEmail: ${toCustomer || 'Not provided'}\nTotal: ${total}\nStripe session: ${session?.id}\nPrintify order: ${printifyOrder?.id || 'Existing order located'}`
      }, { env, fetchImpl, idempotencyKey: `wild-sage-${session?.id}-owner` })
    });
  }

  if (!jobs.length) return { sent: [], failed: [], skipped: true };
  const settled = await Promise.allSettled(jobs.map(job => job.promise));
  const sent = [], failed = [];
  settled.forEach((result, index) => {
    const kind = jobs[index].kind;
    if (result.status === 'fulfilled') sent.push({ kind, id: result.value?.id || null });
    else failed.push({ kind, error: result.reason?.message || String(result.reason) });
  });
  return { sent, failed, skipped: false };
}

export async function sendShippingNotificationEmail({ session, orderNumber, shipment, eventId, env = process.env, fetchImpl = fetch }) {
  const config = emailConfig(env);
  const recipient = customerEmail(session);
  if (!recipient) return { sent: false, skipped: true, reason: 'customer-email-missing' };

  const carrier = clean(shipment?.carrier || 'the carrier');
  const trackingNumber = clean(shipment?.trackingNumber);
  const rawTrackingUrl = clean(shipment?.trackingUrl);
  const trackingUrl = /^https?:\/\//i.test(rawTrackingUrl) ? rawTrackingUrl : '';
  const displayOrder = clean(orderNumber || session?.id || 'your order');
  const storeUrl = clean(env.PUBLIC_STORE_URL || 'https://wildsageapparel.com').replace(/\/$/, '');
  const trackingHtml = trackingUrl
    ? `<p><a href="${escapeHtml(trackingUrl)}" style="display:inline-block;background:#40513b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:4px">Track your package</a></p>`
    : '';
  const trackingText = trackingUrl ? `\nTrack your package: ${trackingUrl}` : '';

  const result = await sendResendEmail({
    from: config.shippingFrom || config.from,
    reply_to: config.support || undefined,
    to: [recipient],
    subject: `Wild Sage order ${displayOrder} has shipped`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Your Wild Sage order has shipped</title></head><body style="margin:0;background:#f6f3ec;color:#222"><div style="max-width:600px;margin:0 auto;padding:32px 20px;font-family:Arial,sans-serif;line-height:1.6"><h1 style="font-family:Georgia,serif;color:#40513b">Your order is on its way</h1><p>Hi ${escapeHtml(customerName(session))},</p><p>Your Wild Sage Apparel order has shipped.</p><p><strong>Order number:</strong> ${escapeHtml(displayOrder)}<br><strong>Carrier:</strong> ${escapeHtml(carrier)}${trackingNumber ? `<br><strong>Tracking number:</strong> ${escapeHtml(trackingNumber)}` : ''}</p>${trackingHtml}<p>Questions? Reply to this email and we’ll be happy to help.</p><p><a href="${escapeHtml(storeUrl)}">Visit Wild Sage Apparel</a></p></div></body></html>`,
    text: `Hi ${customerName(session)},\n\nYour Wild Sage Apparel order has shipped.\n\nOrder number: ${displayOrder}\nCarrier: ${carrier}${trackingNumber ? `\nTracking number: ${trackingNumber}` : ''}${trackingText}\n\nQuestions? Reply to this email and we’ll be happy to help.\n\n${storeUrl}`
  }, { env, fetchImpl, idempotencyKey: `wild-sage-shipment-${clean(eventId) || clean(session?.id) || trackingNumber}` });

  return { sent: true, skipped: false, id: result?.id || null };
}


export async function sendCustomerOrderConfirmationTest({ to, env = process.env, fetchImpl = fetch, testId = 'manual' }) {
  const recipient = clean(to);
  if (!recipient) throw new Error('A test email recipient is required.');
  return sendResendEmail({
    to: [recipient],
    subject: 'Wild Sage test order confirmed',
    html: '<div style="font-family:Arial,sans-serif;color:#222;line-height:1.6"><h1 style="font-family:Georgia,serif">Your order is confirmed</h1><p>Hi Tawny,</p><p>This is a test of the Wild Sage Apparel paid-order confirmation email. No payment was charged and no Printify order was created.</p><p><strong>Order number:</strong> WS-TEST-1001</p><p><strong>Total:</strong> $42.50</p><p>You will receive tracking information when a real order ships.</p><p><a href="https://wildsageapparel.com">Wild Sage Apparel</a></p></div>',
    text: 'Hi Tawny,\n\nThis is a test of the Wild Sage Apparel paid-order confirmation email. No payment was charged and no Printify order was created.\n\nOrder number: WS-TEST-1001\nTotal: $42.50\n\nYou will receive tracking information when a real order ships.\n\nhttps://wildsageapparel.com'
  }, { env, fetchImpl, idempotencyKey: `wild-sage-test-${clean(testId) || 'manual'}` });
}

export function transactionalEmailStatus(env = process.env) {
  const config = emailConfig(env);
  return {
    apiKeyConfigured: Boolean(config.apiKey),
    senderConfigured: Boolean(config.from),
    shippingSenderConfigured: Boolean(config.shippingFrom),
    notificationConfigured: Boolean(config.notify),
    configured: Boolean(config.apiKey && config.from && config.shippingFrom && config.notify)
  };
}

export { emailConfig };
