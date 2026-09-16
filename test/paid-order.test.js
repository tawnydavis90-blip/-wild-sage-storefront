import test from 'node:test';
import assert from 'node:assert/strict';
import { completePaidOrder } from '../paid-order.js';

test('fulfills before email and resolves even when email throws', async () => {
  const calls = [];
  const errors = [];
  const result = await completePaidOrder({
    session: { id: 'cs_live_flow' },
    getOrderNumber: async id => { calls.push(`number:${id}`); return 'WS-1003'; },
    fulfill: async session => { calls.push(`fulfill:${session.id}`); return { id: 'printify-3' }; },
    loadEmailSession: async id => { calls.push(`load:${id}`); return { id }; },
    sendEmails: async () => { calls.push('email'); throw new Error('Resend unavailable'); },
    logger: { log() {}, warn() {}, error(...args) { errors.push(args); } }
  });
  assert.deepEqual(calls, ['number:cs_live_flow', 'fulfill:cs_live_flow', 'load:cs_live_flow', 'email']);
  assert.equal(result.printifyOrder.id, 'printify-3');
  assert.equal(result.emailResult, null);
  assert.equal(errors.length, 1);
});

test('does not attempt email if fulfillment fails', async () => {
  let emailAttempted = false;
  await assert.rejects(() => completePaidOrder({
    session: { id: 'cs_live_failure' },
    getOrderNumber: async () => 'WS-1004',
    fulfill: async () => { throw new Error('Printify unavailable'); },
    loadEmailSession: async () => ({}),
    sendEmails: async () => { emailAttempted = true; },
    logger: { log() {}, warn() {}, error() {} }
  }), /Printify unavailable/);
  assert.equal(emailAttempted, false);
});
