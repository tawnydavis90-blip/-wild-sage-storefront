import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { registerSinSageDashboard } from '../sin-sage-dashboard.js';
import { PGlite } from '@electric-sql/pglite';
test('dashboard isolates businesses, protects reads and notes, records real activity',async()=>{
 process.env.DATABASE_URL='test';const db=new PGlite();await db.exec(`CREATE TABLE businesses(id text,slug text); INSERT INTO businesses VALUES('sin','sin-and-sage'),('wild','wild-sage-apparel'); CREATE TABLE core_analytics_events(business_id text,session_id text,visitor_id text,event_name text,path text,properties jsonb,occurred_at timestamptz DEFAULT now()); CREATE TABLE orders(business_id text,friendly_order_number text,external_order_id text,status text,fulfillment_status text,total numeric,currency text,ordered_at timestamptz); INSERT INTO orders VALUES('wild','secret','x','paid','shipped',99,'USD',now());`);
 const app=express();app.use(express.json());registerSinSageDashboard(app,{db:()=>db,adminSession:r=>r.headers.authorization==='test'});const server=app.listen(0);await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 try{assert.equal((await fetch(base+'/api/sin-sage/dashboard')).status,401);assert.equal((await fetch(base+'/api/sin-sage/dashboard/suppliers/eldorado',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
 const body={type:'page_view',visitorId:'visitor1',sessionId:'session1'};assert.equal((await fetch(base+'/api/sin-sage/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).status,204);
 const headers={'Content-Type':'application/json',Authorization:'test'};assert.equal((await fetch(base+'/api/sin-sage/dashboard/suppliers/eldorado',{method:'PUT',headers,body:JSON.stringify({stage:'submitted',notes:'Paperwork sent'})})).status,200);
 const d=await(await fetch(base+'/api/sin-sage/dashboard',{headers})).json();assert.equal(d.windows['24h'].visitors,1);assert.equal(d.windows.all.views,1);assert.equal(d.orders.length,0);assert.equal(d.checkoutEnabled,false);assert.equal(d.suppliers[0].notes,'Paperwork sent');assert.equal((await fetch(base+'/api/sin-sage/dashboard/suppliers/other',{method:'PUT',headers,body:JSON.stringify({stage:'approved',notes:''})})).status,400);
 }finally{server.close();await db.close();delete process.env.DATABASE_URL;}
});
