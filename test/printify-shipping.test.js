import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { ensurePrintifyShippingWebhook, processPrintifyShipment, shipmentFromPrintifyEvent, verifyPrintifySignature } from '../printify-shipping.js';

const event = {
  id: 'event-1',
  type: 'order:shipment:created',
  resource: {
    id: 'printify-order-1',
    type: 'order',
    data: {
      shop_id: 123,
      carrier: { code: 'USPS', tracking_number: '9400', tracking_url: 'https://example.com/9400' }
    }
  }
};

test('verifies Printify HMAC signatures in constant time', () => {
  const rawBody = Buffer.from(JSON.stringify(event));
  const signature = `sha256=${crypto.createHmac('sha256', 'shared-secret').update(rawBody).digest('hex')}`;
  assert.equal(verifyPrintifySignature({ rawBody, signature, secret: 'shared-secret' }), true);
  assert.equal(verifyPrintifySignature({ rawBody, signature: `${signature}bad`, secret: 'shared-secret' }), false);
});

test('normalizes only shipment-created events', () => {
  assert.deepEqual(shipmentFromPrintifyEvent(event), {
    eventId: 'event-1', orderId: 'printify-order-1', shopId: '123', carrier: 'USPS', trackingNumber: '9400', trackingUrl: 'https://example.com/9400'
  });
  assert.equal(shipmentFromPrintifyEvent({ ...event, type: 'order:updated' }), null);
});

test('loads the linked Stripe session and sends one shipping email', async () => {
  const calls = [];
  const result = await processPrintifyShipment({
    event,
    getPrintifyOrder: async (shopId, orderId) => { calls.push(`order:${shopId}:${orderId}`); return { external_id: 'cs_live_123' }; },
    loadStripeSession: async id => { calls.push(`stripe:${id}`); return { id, customer_details: { email: 'buyer@example.com' } }; },
    getOrderNumber: async id => { calls.push(`number:${id}`); return 'WS-1006'; },
    sendShippingEmail: async input => { calls.push(`email:${input.eventId}`); return { sent: true }; },
    logger: { log() {} }
  });
  assert.equal(result.emailResult.sent, true);
  assert.deepEqual(calls, ['order:123:printify-order-1', 'stripe:cs_live_123', 'number:cs_live_123', 'email:event-1']);
});

test('creates the signed shipment webhook when missing', async () => {
  const requests = [];
  const printify = async (path, options) => {
    requests.push({ path, options });
    return options ? { id: 'hook-1' } : [];
  };
  const result = await ensurePrintifyShippingWebhook({ shopId: '123', printify, url: 'https://wildsageapparel.com/api/webhooks/printify', secret: 'shared-secret' });
  assert.equal(result.created, true);
  assert.equal(requests[1].path, '/shops/123/webhooks.json');
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    topic: 'order:shipment:created',
    url: 'https://wildsageapparel.com/api/webhooks/printify',
    secret: 'shared-secret'
  });
});
