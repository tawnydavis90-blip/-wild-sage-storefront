import test from 'node:test';
import assert from 'node:assert/strict';
import { emailConfig, sendPaidOrderEmails, transactionalEmailStatus } from '../transactional-email.js';

const session = {
  id: 'cs_live_safe_test',
  amount_total: 4250,
  customer_details: { name: 'Sage Customer', email: 'customer@example.com' }
};

test('uses the Wild Sage sender and notification variables', () => {
  assert.deepEqual(emailConfig({
    RESEND_API_KEY: 'secret',
    WILD_SAGE_FROM_EMAIL: 'orders@wildsageapparel.com',
    WILD_SAGE_NOTIFICATION_EMAIL: 'owner@example.com'
  }), {
    apiKey: 'secret',
    from: 'orders@wildsageapparel.com',
    notify: 'owner@example.com'
  });
});

test('reports configuration readiness without exposing values', () => {
  assert.deepEqual(transactionalEmailStatus({
    RESEND_API_KEY: 'secret',
    WILD_SAGE_FROM_EMAIL: 'orders@wildsageapparel.com',
    WILD_SAGE_NOTIFICATION_EMAIL: 'owner@example.com'
  }), {
    apiKeyConfigured: true,
    senderConfigured: true,
    notificationConfigured: true,
    configured: true
  });
});

test('sends both customer and owner messages as ES-module code', async () => {
  const requests = [];
  const fetchImpl = async (_url, options) => {
    requests.push(options);
    return { ok: true, status: 200, text: async () => JSON.stringify({ id: `email-${requests.length}` }) };
  };
  const result = await sendPaidOrderEmails({
    session,
    orderNumber: 'WS-1001',
    printifyOrder: { id: 'printify-1' },
    env: {
      RESEND_API_KEY: 'secret',
      WILD_SAGE_FROM_EMAIL: 'orders@wildsageapparel.com',
      WILD_SAGE_NOTIFICATION_EMAIL: 'owner@example.com',
      PUBLIC_STORE_URL: 'https://wildsageapparel.com'
    },
    fetchImpl
  });
  assert.equal(requests.length, 2);
  assert.deepEqual(result.failed, []);
  assert.deepEqual(result.sent.map(item => item.kind), ['customer', 'owner']);
  assert.match(requests[0].headers['Idempotency-Key'], /customer$/);
  assert.match(requests[1].headers['Idempotency-Key'], /owner$/);
});

test('reports an email failure without throwing', async () => {
  let call = 0;
  const fetchImpl = async () => {
    call += 1;
    return call === 1
      ? { ok: false, status: 422, text: async () => 'rejected' }
      : { ok: true, status: 200, text: async () => JSON.stringify({ id: 'owner-email' }) };
  };
  const result = await sendPaidOrderEmails({
    session,
    orderNumber: 'WS-1002',
    printifyOrder: { id: 'printify-2' },
    env: {
      RESEND_API_KEY: 'secret',
      WILD_SAGE_FROM_EMAIL: 'orders@wildsageapparel.com',
      WILD_SAGE_NOTIFICATION_EMAIL: 'owner@example.com'
    },
    fetchImpl
  });
  assert.equal(result.sent.length, 1);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].kind, 'customer');
});
