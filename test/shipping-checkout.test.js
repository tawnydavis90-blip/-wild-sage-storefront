import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {registerShippingCheckoutRoutes} from '../shipping-checkout.js';

test('one checkout request calculates shipping once and carries delivery details to Stripe without requiring phone',async()=>{
 const nativeFetch=global.fetch,previousToken=process.env.PRINTIFY_API_TOKEN;
 let quotes=0,customer,session;
 process.env.PRINTIFY_API_TOKEN='test-fixture';
 global.fetch=async(url,options)=>{
  if(!String(url).startsWith('https://api.printify.com/'))return nativeFetch(url,options);
  if(String(url).endsWith('/shops.json'))return Response.json([{id:1,title:'Wild Sage Apparel'}]);
  if(String(url).endsWith('/orders/shipping.json')){quotes++;const body=JSON.parse(options.body);assert.equal(body.address_to.phone,'');assert.equal(body.address_to.zip,'84401');return Response.json({standard:599});}
  if(String(url).endsWith('/products/shirt.json'))return Response.json({id:'shirt',title:'Test shirt',visible:true,variants:[{id:1,price:2500,title:'M',is_enabled:true,is_available:true}]});
  throw Error('Unexpected Printify request');
 };
 const stripeClient={customers:{create:async data=>{customer=data;return{id:'cus_fixture'};}},checkout:{sessions:{create:async data=>{session=data;return{url:'https://checkout.stripe.com/c/pay/fixture'};}}}};
 const app=express();app.use(express.json());registerShippingCheckoutRoutes(app,{stripeClient});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try {
  const result=await nativeFetch(`http://127.0.0.1:${server.address().port}/api/checkout-shipping`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[{productId:'shirt',variantId:1,quantity:2}],address:{name:'Sample Shopper',address1:'123 Example St',address2:'Unit 4',city:'Ogden',region:'UT',zip:'84401'}})});
  assert.equal(result.status,200);assert.equal((await result.json()).shipping,599);
  assert.equal(quotes,1);assert.equal(customer.shipping.address.line2,'Unit 4');assert.equal(customer.shipping.name,'Sample Shopper');assert.equal('phone' in customer,false);
  assert.equal(session.customer,'cus_fixture');assert.equal(session.phone_number_collection.enabled,true);
  assert.equal(session.shipping_options[0].shipping_rate_data.fixed_amount.amount,599);
  assert.equal(session.line_items[0].price_data.unit_amount,2500);assert.equal(session.line_items[0].quantity,2);
  assert.equal(session.automatic_tax.enabled,true);
 } finally {global.fetch=nativeFetch;if(previousToken===undefined)delete process.env.PRINTIFY_API_TOKEN;else process.env.PRINTIFY_API_TOKEN=previousToken;await new Promise(r=>server.close(r));}
});
