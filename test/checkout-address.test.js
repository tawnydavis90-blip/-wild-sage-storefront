import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutCustomerDetails } from '../checkout-address.js';

test('passes every delivery field to Stripe, including unit and phone',()=>{
  const result=checkoutCustomerDetails({name:'  Sample Shopper  ',phone:'2025550123',address1:'123 Example St',address2:'Unit 4',city:'Ogden',region:'UT',zip:'84401',country:'US'});
  assert.equal(result.name,'Sample Shopper');
  assert.deepEqual(result.shipping,{name:'Sample Shopper',phone:'2025550123',address:{line1:'123 Example St',line2:'Unit 4',city:'Ogden',state:'UT',postal_code:'84401',country:'US'}});
  assert.deepEqual(result.address,result.shipping.address);
  assert.equal(result.phone,'2025550123');
});
test('does not put a placeholder recipient into checkout',()=>{
  assert.throws(()=>checkoutCustomerDetails({name:'  '}),/full name/);
});
