import test from 'node:test';
import assert from 'node:assert/strict';
import { listPaidWildSageSessions } from '../hq-stripe-data.js';

test('HQ finds older paid orders past unpaid checkouts and excludes test orders', async () => {
  const calls = [];
  const stripe = { checkout: { sessions: { list: async options => {
    calls.push(options);
    return options.starting_after ? {has_more:false,data:[{id:'cs_live_old',payment_status:'paid',metadata:{printify_items:'[]'}}]} : {has_more:true,data:[{id:'cs_live_unpaid',payment_status:'unpaid'},{id:'cs_live_test',payment_status:'paid',metadata:{wild_sage_test:'true'}}]};
  } } } };
  assert.deepEqual((await listPaidWildSageSessions(stripe)).map(s=>s.id), ['cs_live_old']);
  assert.equal(calls[1].starting_after, 'cs_live_test');
});

test('Printify pagination, metadata matching, tracking and costs share one feed', async t => {
  const originalToken=process.env.PRINTIFY_API_TOKEN;
  process.env.PRINTIFY_API_TOKEN='fixture-token';
  t.after(()=>{if(originalToken===undefined)delete process.env.PRINTIFY_API_TOKEN;else process.env.PRINTIFY_API_TOKEN=originalToken;});
  const calls=[];
  t.mock.method(globalThis,'fetch',async url=>{
    calls.push(url);
    const data=url.endsWith('/shops.json') ? [{id:1,title:'Unrelated'},{id:2,title:'Wild Sage Apparel'}] : url.includes('page=1') ? {current_page:1,last_page:2,data:[{id:'new',external_id:'cs_live_new'}]} : {current_page:2,last_page:2,data:[{id:'old',metadata:{shop_order_id:'cs_live_old'},status:'fulfilled',total_price:1200,total_shipping:500,total_tax:100,shipments:[{number:'tracking123',url:'https://example.com/tracking'}]}]};
    return {ok:true,text:async()=>JSON.stringify(data)};
  });
  const {printifyOrdersByExternalId,normalizePrintifyOrder}=await import('../printify-admin-data.js');
  const map=await printifyOrdersByExternalId();
  const order=normalizePrintifyOrder(map.get('cs_live_old'));
  assert.equal(order.id,'old');assert.equal(order.totalCost,18);assert.equal(order.shipments[0].trackingNumber,'tracking123');
  assert.ok(calls.some(url=>url.includes('/shops/2/orders.json?limit=100&page=2')));
  t.mock.method(globalThis,'fetch',async()=>({ok:false,status:401,text:async()=>'{}'}));
  await assert.rejects(printifyOrdersByExternalId(),/Printify 401/);
});
