import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { createNalpacClient, normalizeNalpacProduct, nalpacConfiguration } from '../nalpac-client.js';
import { registerNalpacRoutes } from '../sin-sage-nalpac.js';
const env={DATABASE_URL:'test',NALPAC_USERNAME:'user',NALPAC_PASSWORD:'secret'};
const product={Sku:'00123',Name:'Test fixture only',WholesalePrice:12.5,AvailableQuantity:4,Discontinued:false,Sellable:true};
test('Nalpac uses documented GET endpoint, preserves SKU and authenticates only to fixed HTTPS host',async()=>{
 const calls=[];const client=createNalpacClient({env,fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json(url.includes('/carrier')?{Carriers:[]} : product);}});
 assert.equal((await client.product('00123')).sku,'00123');assert.equal((await client.testConnection()).carrierCount,0);
 assert.equal(calls[0].url,'https://api2.nalpac.com/api/product/00123?stripDescriptionHTML=true&locationId=15');
 for(const c of calls){assert.equal(c.options.method,'GET');assert.equal(c.options.redirect,'error');assert.equal(c.options.headers.Authorization,'Basic '+Buffer.from('user:secret').toString('base64'));}
 await assert.rejects(()=>client.product('../order'));assert.equal(calls.length,2);
});
test('Nalpac fails closed on malformed stock, discontinued items, permission failures and missing credentials',async()=>{
 assert.equal(normalizeNalpacProduct({...product,AvailableQuantity:null,QuantityOnHand:null},'00123').sellable,false);
 assert.equal(normalizeNalpacProduct({...product,Discontinued:true},'00123').sellable,false);
 assert.equal(normalizeNalpacProduct({...product,WholesalePrice:0},'00123').sellable,false);
 assert.throws(()=>normalizeNalpacProduct({...product,Sku:'other'},'00123'));
 let called=false;await assert.rejects(()=>createNalpacClient({env:{},fetchImpl:async()=>{called=true;}}).product('1'));assert.equal(called,false);
 const client=createNalpacClient({env,fetchImpl:async()=>new Response('secret credential body',{status:401})});
 await assert.rejects(()=>client.product('00123'),e=>!e.message.includes('secret')&&e.message.includes('rejected'));
 assert.equal(nalpacConfiguration(env).configured,true);assert.equal(JSON.stringify(nalpacConfiguration(env)).includes('secret'),false);
});
test('admin import and refresh persist drafts only, require auth, reject cross-origin writes, and mark failed refresh unavailable',async()=>{
 const db=new PGlite();let fail=false,calls=0;
 const client={product:async sku=>{calls++;if(fail)throw new Error('private upstream detail');return normalizeNalpacProduct({...product,Sku:sku},sku);},testConnection:async()=>({ok:true})};
 const app=express();app.use(express.json());registerNalpacRoutes(app,{db:()=>db,env,client,adminSession:req=>req.headers.authorization==='test'});
 const server=app.listen(0);await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 const headers={Authorization:'test','Content-Type':'application/json'};
 const post=(path,body,extra={})=>fetch(base+'/api/sin-sage/nalpac/'+path,{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)});
 try{
  assert.equal((await fetch(base+'/api/sin-sage/nalpac')).status,401);
  assert.equal((await post('import',{skus:['00123']},{Origin:'https://evil.test'})).status,403);assert.equal(calls,0);
  assert.equal((await post('import',{skus:['../order']})).status,400);
  assert.equal((await post('import',{skus:Array(11).fill('1')})).status,400);
  let r=await post('import',{skus:['00123','00123']});assert.equal((await r.json()).imported,1);
  let data=await(await fetch(base+'/api/sin-sage/nalpac',{headers})).json();assert.equal(data.products.length,1);assert.equal(data.products[0].sku,'00123');assert.equal(data.products[0].sellable,true);assert.equal(data.checkoutEnabled,false);assert.equal(data.orderSubmissionEnabled,false);assert.equal(data.publishingEnabled,false);assert.equal(JSON.stringify(data).includes('secret'),false);
  fail=true;r=await post('sync',{});assert.equal((await r.json()).failed,1);
  data=await(await fetch(base+'/api/sin-sage/nalpac',{headers})).json();assert.equal(data.products[0].sellable,false);assert.equal(data.products[0].name,'Test fixture only');assert.equal(JSON.stringify(data).includes('private upstream detail'),false);
 }finally{server.close();await db.close();}
});
