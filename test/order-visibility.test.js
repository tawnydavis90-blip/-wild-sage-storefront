import test from 'node:test';
import assert from 'node:assert/strict';
import { isCheckoutSessionId } from '../order-visibility.js';

test('accepts live and test Stripe checkout session ids',()=>{
  assert.equal(isCheckoutSessionId('cs_live_a1B2c3D4'),true);
  assert.equal(isCheckoutSessionId('cs_test_Z9y8X7'),true);
});

test('rejects arbitrary ids before dashboard deletion',()=>{
  assert.equal(isCheckoutSessionId('pi_live_123'),false);
  assert.equal(isCheckoutSessionId('../orders'),false);
  assert.equal(isCheckoutSessionId(''),false);
});
