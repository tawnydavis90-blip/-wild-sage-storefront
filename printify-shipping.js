import crypto from 'crypto';
import { printifyExternalId } from './printify-admin-data.js';

const clean = value => String(value || '').trim();

export function verifyPrintifySignature({ rawBody, signature, secret }) {
  const supplied = clean(signature);
  const key = clean(secret);
  if (!rawBody || !supplied || !key) return false;
  const expected = `sha256=${crypto.createHmac('sha256', key).update(rawBody).digest('hex')}`;
  const actualBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export function shipmentFromPrintifyEvent(event = {}) {
  if (event.type !== 'order:shipment:created' || event.resource?.type !== 'order') return null;
  const carrier = event.resource?.data?.carrier || {};
  return {
    eventId: clean(event.id),
    orderId: clean(event.resource?.id),
    shopId: clean(event.resource?.data?.shop_id),
    carrier: clean(carrier.code),
    trackingNumber: clean(carrier.tracking_number),
    trackingUrl: clean(carrier.tracking_url)
  };
}

export async function processPrintifyShipment({ event, getPrintifyOrder, loadStripeSession, getOrderNumber, sendShippingEmail, logger = console }) {
  const shipment = shipmentFromPrintifyEvent(event);
  if (!shipment) return { ignored: true };
  if (!shipment.orderId || !shipment.shopId || !shipment.eventId) throw new Error('Printify shipment event is missing required identifiers.');

  const order = await getPrintifyOrder(shipment.shopId, shipment.orderId);
  const sessionId = clean(printifyExternalId(order));
  if (!sessionId.startsWith('cs_')) throw new Error('Printify shipment is not linked to a Stripe Checkout session.');
  const [session, orderNumber] = await Promise.all([
    loadStripeSession(sessionId),
    getOrderNumber(sessionId)
  ]);
  const emailResult = await sendShippingEmail({ session, orderNumber, shipment, eventId: shipment.eventId });
  logger.log(`Shipping email ${emailResult?.sent ? 'sent' : 'skipped'} for ${orderNumber || sessionId}.`);
  return { ignored: false, sessionId, orderNumber, emailResult };
}

export async function ensurePrintifyShippingWebhook({ shopId, printify, url, secret }) {
  if (!shopId || !url || !secret) return { configured: false, skipped: true };
  const hooks = await printify(`/shops/${shopId}/webhooks.json`);
  const existing = (Array.isArray(hooks) ? hooks : hooks?.data || []).find(hook => hook.topic === 'order:shipment:created' && hook.url === url);
  if (existing?.id) {
    const webhook = await printify(`/shops/${shopId}/webhooks/${encodeURIComponent(existing.id)}.json`, {
      method: 'PUT',
      body: JSON.stringify({ url, secret })
    });
    return { configured: true, created: false, webhook };
  }
  const webhook = await printify(`/shops/${shopId}/webhooks.json`, {
    method: 'POST',
    body: JSON.stringify({ topic: 'order:shipment:created', url, secret })
  });
  return { configured: true, created: true, webhook };
}
