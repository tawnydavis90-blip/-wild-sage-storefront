import test from 'node:test';
import assert from 'node:assert/strict';
import {cancellationPreview} from '../tote-cancellation-policy.js';
const now=Date.parse('2026-10-02T12:00:00Z');
const booking={status:'confirmed',collected_cents:3500,refunded_cents:0,cancellation_policy:'24-hour-v2',rental_start_at:'2026-10-03T12:00:00Z'};
test('exactly 24 hours receives a full refund; one millisecond later retains the deposit',()=>{
 assert.equal(cancellationPreview(booking,{now}).refundCents,3500);
 const late=cancellationPreview(booking,{now:now+1});assert.equal(late.refundCents,0);assert.equal(late.feeCents,3500);
});
test('original terms and business cancellations refund all net payments',()=>{
 assert.equal(cancellationPreview({...booking,cancellation_policy:'refundable-deposit-v1'},{now:now+1}).refundCents,3500);
 assert.equal(cancellationPreview(booking,{now:now+1,business:true}).refundCents,3500);
 assert.equal(cancellationPreview({...booking,collected_cents:10000,refunded_cents:2000},{now:now+1}).refundCents,4500);
});
test('no fee exceeds money received; equipment already out cannot be cancelled online',()=>{
 assert.equal(cancellationPreview({...booking,collected_cents:0},{now:now+1}).feeCents,0);
 for(const status of ['out','cleaning','completed'])assert.equal(cancellationPreview({...booking,status},{now,business:true}).allowed,false);
 assert.equal(cancellationPreview({...booking,cancelled_at:new Date(now),cancellation_fee_cents:3500},{now}).alreadyCancelled,true);
});
