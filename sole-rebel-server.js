import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const {Pool}=pg;
const app=express();
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||3000);
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined,connectionTimeoutMillis:5000});
const ADMIN_PASSWORD=String(process.env.SOLE_REBEL_ADMIN_PASSWORD||'');
const SESSION_SECRET=String(process.env.SOLE_REBEL_SESSION_SECRET||ADMIN_PASSWORD||'disabled');
const VENMO_URL=String(process.env.SOLE_REBEL_VENMO_URL||'https://venmo.com/u/tawny_lynn');
const CASHAPP_URL=String(process.env.SOLE_REBEL_CASHAPP_URL||'');
const MAX_PHOTO_BYTES=8*1024*1024;
const PHOTO_TYPES=new Set(['image/jpeg','image/png','image/webp']);
const PHOTO_SLOTS=new Set(['hero','small1','small2','small3']);
const PHOTO_POSITIONS=new Set(['top','center','bottom']);

app.use(express.json());
app.use(express.static(path.join(__dirname,'public','sole-rebel')));

function cookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(p=>{const i=p.indexOf('=');return[decodeURIComponent(p.slice(0,i)),decodeURIComponent(p.slice(i+1))]}));}
function sign(exp){const payload=String(exp);return `${payload}.${crypto.createHmac('sha256',SESSION_SECRET).update(payload).digest('hex')}`;}
function validSession(req){const token=cookies(req).sole_rebel_admin;if(!token)return false;const [exp,sig]=token.split('.');if(!exp||!sig||Number(exp)<Date.now())return false;const expected=crypto.createHmac('sha256',SESSION_SECRET).update(exp).digest('hex');return sig.length===expected.length&&crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected));}
function requireAdmin(req,res,next){if(validSession(req))return next();res.status(401).json({error:'Unauthorized'});}
async function ids(client=pool){const b=await client.query("SELECT id FROM businesses WHERE slug='sole-rebel'");if(!b.rows[0])throw new Error('Sole Rebel business record is missing');const s=await client.query("SELECT id FROM sites WHERE slug='sole-rebel-storefront' LIMIT 1");return{businessId:b.rows[0].id,siteId:s.rows[0]?.id||null};}
function trackingUrl(carrier,number){const n=encodeURIComponent(String(number||'').trim());if(!n)return'';switch(String(carrier||'').toLowerCase()){case'usps':return`https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;case'ups':return`https://www.ups.com/track?tracknum=${n}`;case'fedex':return`https://www.fedex.com/fedextrack/?trknbr=${n}`;default:return'';}}
function safeName(v){return String(v||'photo').replace(/[\r\n]/g,' ').replace(/[^a-zA-Z0-9._ -]/g,'').trim().slice(0,160)||'photo';}

async function ensurePhotoSchema(){
  await pool.query(`CREATE TABLE IF NOT EXISTS sole_rebel_storefront_media (
    slot TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    media_bytes BYTEA NOT NULL,
    size_bytes INTEGER NOT NULL,
    object_position TEXT NOT NULL DEFAULT 'center',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`ALTER TABLE sole_rebel_storefront_media ADD COLUMN IF NOT EXISTS object_position TEXT NOT NULL DEFAULT 'center'`);
}

async function photoConfig(){
  await ensurePhotoSchema();
  const {rows}=await pool.query('SELECT slot,filename,mime_type,size_bytes,object_position,updated_at FROM sole_rebel_storefront_media ORDER BY slot');
  const slots={
    hero:{slot:'hero',label:'Main hero',url:'/hero.jpg',custom:false,position:'center'},
    small1:{slot:'small1',label:'Small photo 1',url:null,custom:false,position:'center'},
    small2:{slot:'small2',label:'Small photo 2',url:null,custom:false,position:'center'},
    small3:{slot:'small3',label:'Small photo 3',url:null,custom:false,position:'center'}
  };
  for(const r of rows)slots[r.slot]={...slots[r.slot],filename:r.filename,mimeType:r.mime_type,size:r.size_bytes,position:PHOTO_POSITIONS.has(r.object_position)?r.object_position:'center',updatedAt:r.updated_at,url:`/api/storefront-photo/${r.slot}?v=${new Date(r.updated_at).getTime()}`,custom:true};
  return slots;
}

async function startupSmokeTest(){let client;try{client=await pool.connect();await client.query('BEGIN');const {businessId,siteId}=await ids(client);const testId=`SR-SMOKE-${Date.now()}`;await client.query(`INSERT INTO orders (business_id,site_id,external_order_id,friendly_order_number,status,currency,subtotal,shipping,total,fulfillment_provider,fulfillment_status,ordered_at,metadata) VALUES ($1,$2,$3,$3,'pending','USD',25,6,31,'smoke-test','rolled back',NOW(),$4::jsonb)`,[businessId,siteId,testId,JSON.stringify({source:'sole-rebel-startup-smoke-test'})]);await client.query('ROLLBACK');await ensurePhotoSchema();console.log(`Sole Rebel database smoke test passed. adminPassword=${Boolean(ADMIN_PASSWORD)} sessionSecret=${Boolean(process.env.SOLE_REBEL_SESSION_SECRET)}`);}catch(err){if(client){try{await client.query('ROLLBACK');}catch{}}console.error('Sole Rebel database smoke test FAILED:',err.message);}finally{if(client)client.release();}}

app.get('/api/health',async(_req,res)=>{try{await pool.query('SELECT 1');res.json({ok:true,service:'Sole Rebel',database:'Sage & Ember Core'});}catch(e){res.status(500).json({ok:false,error:e.message});}});
app.get('/api/payment-options',(_req,res)=>res.json({venmo:{enabled:Boolean(VENMO_URL),url:VENMO_URL},cashapp:{enabled:Boolean(CASHAPP_URL),url:CASHAPP_URL}}));

app.get('/api/storefront-media',async(_req,res)=>{try{res.json({slots:await photoConfig()});}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/storefront-photo/:slot',async(req,res)=>{try{const slot=String(req.params.slot||'');if(!PHOTO_SLOTS.has(slot))return res.sendStatus(404);await ensurePhotoSchema();const {rows}=await pool.query('SELECT filename,mime_type,media_bytes,size_bytes FROM sole_rebel_storefront_media WHERE slot=$1',[slot]);const photo=rows[0];if(!photo)return res.sendStatus(404);res.setHeader('Content-Type',photo.mime_type);res.setHeader('Content-Length',String(photo.size_bytes));res.setHeader('Cache-Control','public,max-age=300');res.setHeader('Content-Disposition',`inline; filename="${safeName(photo.filename)}"`);res.send(photo.media_bytes);}catch(e){res.sendStatus(404);}});

app.post('/api/orders',async(req,res)=>{let client;try{const color=String(req.body?.color||'').toLowerCase();const days=Math.max(1,Math.min(14,Number(req.body?.daysWorn||1)));const pairs=Math.max(1,Math.min(20,Number(req.body?.pairs||1)));const customer=String(req.body?.customer||'').trim();const email=String(req.body?.email||'').trim();const contact=String(req.body?.contact||email||'').trim();const address=req.body?.address&&typeof req.body.address==='object'?req.body.address:{};const specialRequest=String(req.body?.specialRequest||'').trim();if(!['black','white','gray'].includes(color))return res.status(400).json({error:'Choose black, white, or gray.'});if(!customer)return res.status(400).json({error:'Enter your name.'});client=await pool.connect();await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(hashtext('sole-rebel-order-number'))");const {businessId,siteId}=await ids(client);const num=await client.query(`SELECT COALESCE(MAX((regexp_match(friendly_order_number,'^SR-([0-9]+)$'))[1]::int),1000)+1 AS next_number FROM orders WHERE business_id=$1 AND friendly_order_number ~ '^SR-[0-9]+$'`,[businessId]);const orderNumber=`SR-${num.rows[0].next_number}`;const subtotal=days*25*pairs,shipping=6,total=subtotal+shipping;const metadata={source:'sole-rebel-render',customer,email,contact,color,daysWorn:days,pairs,pricePerDay:25,shippingFlat:6,address,specialRequest,paymentLinkClicked:false,paymentMethodClicked:null,paymentLinkClickedAt:null,paymentReported:false,paymentReportedAt:null,paymentReportedMethod:null,trackingNumber:null,trackingCarrier:null,trackingUrl:null,trackingAddedAt:null};const q=await client.query(`INSERT INTO orders (business_id,site_id,external_order_id,friendly_order_number,status,currency,subtotal,shipping,total,fulfillment_provider,fulfillment_status,ordered_at,metadata) VALUES ($1,$2,$3,$3,'pending','USD',$4,$5,$6,'manual','awaiting payment',NOW(),$7::jsonb) RETURNING id,external_order_id,friendly_order_number,total,status,ordered_at`,[businessId,siteId,orderNumber,subtotal,shipping,total,JSON.stringify(metadata)]);await client.query('COMMIT');res.status(201).json({order:q.rows[0],paymentOptions:{venmo:Boolean(VENMO_URL),cashapp:Boolean(CASHAPP_URL)}});}catch(e){if(client){try{await client.query('ROLLBACK');}catch{}}res.status(500).json({error:e.message});}finally{if(client)client.release();}});

app.post('/api/orders/:externalId/payment-click',async(req,res)=>{try{const method=String(req.body?.method||'').toLowerCase();if(!['venmo','cashapp'].includes(method))return res.status(400).json({error:'Invalid payment method'});const clickedAt=new Date().toISOString();const patch={paymentLinkClicked:true,paymentMethodClicked:method,paymentLinkClickedAt:clickedAt};const q=await pool.query(`UPDATE orders SET metadata=COALESCE(metadata,'{}'::jsonb)||$2::jsonb,updated_at=NOW() WHERE external_order_id=$1 RETURNING id,external_order_id,metadata`,[req.params.externalId,JSON.stringify(patch)]);if(!q.rows[0])return res.status(404).json({error:'Order not found'});res.json({ok:true,clickedAt,method});}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/orders/:externalId/payment-reported',async(req,res)=>{try{const method=String(req.body?.method||'').toLowerCase();if(!['venmo','cashapp'].includes(method))return res.status(400).json({error:'Invalid payment method'});const reportedAt=new Date().toISOString();const patch={paymentReported:true,paymentReportedAt:reportedAt,paymentReportedMethod:method};const q=await pool.query(`UPDATE orders SET status='payment_reported',fulfillment_status='customer reports payment sent',metadata=COALESCE(metadata,'{}'::jsonb)||$2::jsonb,updated_at=NOW() WHERE external_order_id=$1 RETURNING id,external_order_id,status,metadata`,[req.params.externalId,JSON.stringify(patch)]);if(!q.rows[0])return res.status(404).json({error:'Order not found'});res.json({ok:true,reportedAt,method,status:'payment_reported'});}catch(e){res.status(500).json({error:e.message});}});

app.post('/api/admin/login',(req,res)=>{if(!ADMIN_PASSWORD)return res.status(503).json({error:'Sole Rebel admin password is not configured yet.'});if(String(req.body?.password||'')!==ADMIN_PASSWORD)return res.status(401).json({error:'Incorrect password'});const exp=Date.now()+12*60*60*1000;res.setHeader('Set-Cookie',`sole_rebel_admin=${encodeURIComponent(sign(exp))}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`);res.json({ok:true});});
app.get('/api/admin/session',(req,res)=>res.json({authenticated:validSession(req)}));
app.post('/api/admin/logout',(_req,res)=>{res.setHeader('Set-Cookie','sole_rebel_admin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');res.json({ok:true});});

app.get('/api/admin/storefront-media',requireAdmin,async(_req,res)=>{try{res.json({slots:await photoConfig()});}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/admin/storefront-media/:slot',requireAdmin,express.raw({type:'application/octet-stream',limit:'8mb'}),async(req,res)=>{try{const slot=String(req.params.slot||'');if(!PHOTO_SLOTS.has(slot))return res.status(400).json({error:'Invalid photo slot.'});const mime=String(req.headers['x-mime-type']||'').toLowerCase().trim();if(!PHOTO_TYPES.has(mime))return res.status(400).json({error:'Upload a JPG, PNG, or WebP image.'});if(!Buffer.isBuffer(req.body)||!req.body.length)return res.status(400).json({error:'The uploaded image was empty.'});if(req.body.length>MAX_PHOTO_BYTES)return res.status(413).json({error:'Image is too large. Maximum size is 8 MB.'});await ensurePhotoSchema();const filename=safeName(req.headers['x-file-name']);await pool.query(`INSERT INTO sole_rebel_storefront_media(slot,filename,mime_type,media_bytes,size_bytes,updated_at) VALUES($1,$2,$3,$4,$5,NOW()) ON CONFLICT(slot) DO UPDATE SET filename=EXCLUDED.filename,mime_type=EXCLUDED.mime_type,media_bytes=EXCLUDED.media_bytes,size_bytes=EXCLUDED.size_bytes,updated_at=NOW()`,[slot,filename,mime,req.body,req.body.length]);res.json({ok:true,slot,url:`/api/storefront-photo/${slot}?v=${Date.now()}`});}catch(e){console.error('Sole Rebel photo upload error:',e);res.status(500).json({error:'Unable to save photo.'});}});
app.patch('/api/admin/storefront-media/:slot/position',requireAdmin,async(req,res)=>{try{const slot=String(req.params.slot||''),position=String(req.body?.position||'').toLowerCase();if(!PHOTO_SLOTS.has(slot))return res.status(400).json({error:'Invalid photo slot.'});if(!PHOTO_POSITIONS.has(position))return res.status(400).json({error:'Position must be top, center, or bottom.'});await ensurePhotoSchema();const q=await pool.query('UPDATE sole_rebel_storefront_media SET object_position=$2,updated_at=NOW() WHERE slot=$1 RETURNING slot,object_position',[slot,position]);if(!q.rows[0])return res.status(404).json({error:'Upload a photo to this slot before changing its position.'});res.json({ok:true,slot,position:q.rows[0].object_position});}catch(e){res.status(500).json({error:e.message});}});
app.delete('/api/admin/storefront-media/:slot',requireAdmin,async(req,res)=>{try{const slot=String(req.params.slot||'');if(!PHOTO_SLOTS.has(slot))return res.status(400).json({error:'Invalid photo slot.'});await ensurePhotoSchema();await pool.query('DELETE FROM sole_rebel_storefront_media WHERE slot=$1',[slot]);res.json({ok:true});}catch(e){res.status(500).json({error:e.message});}});

app.get('/api/admin/dashboard',requireAdmin,async(_req,res)=>{try{const {businessId}=await ids();const stats=await pool.query(`SELECT COUNT(*) FILTER (WHERE ordered_at>=NOW()-INTERVAL '24 hours')::int AS last24h,COUNT(*) FILTER (WHERE ordered_at>=NOW()-INTERVAL '7 days')::int AS last7d,COUNT(*)::int AS lifetime,COUNT(*) FILTER (WHERE status='paid')::int AS paid,COUNT(*) FILTER (WHERE status='payment_reported')::int AS payment_reported,COUNT(*) FILTER (WHERE status NOT IN ('paid','cancelled','refunded'))::int AS unpaid,COALESCE(SUM(total),0)::numeric AS order_value,COALESCE(SUM(total) FILTER (WHERE status='paid'),0)::numeric AS paid_revenue FROM orders WHERE business_id=$1`,[businessId]);const orders=await pool.query(`SELECT id,external_order_id,friendly_order_number,status,total,ordered_at,fulfillment_status,metadata FROM orders WHERE business_id=$1 ORDER BY ordered_at DESC LIMIT 200`,[businessId]);res.json({stats:{...stats.rows[0],order_value:Number(stats.rows[0].order_value),paid_revenue:Number(stats.rows[0].paid_revenue)},orders:orders.rows.map(o=>({...o,total:Number(o.total)}))});}catch(e){res.status(500).json({error:e.message});}});
app.patch('/api/admin/orders/:id',requireAdmin,async(req,res)=>{try{const status=String(req.body?.status||'').toLowerCase();if(!['pending','payment_reported','paid','cancelled','refunded'].includes(status))return res.status(400).json({error:'Invalid status'});const q=await pool.query(`UPDATE orders SET status=$2,fulfillment_status=CASE WHEN $2='paid' THEN 'payment received' WHEN $2='payment_reported' THEN 'customer reports payment sent' WHEN $2='cancelled' THEN 'cancelled' ELSE fulfillment_status END,updated_at=NOW() WHERE id=$1 RETURNING id,status,fulfillment_status`,[req.params.id,status]);if(!q.rows[0])return res.status(404).json({error:'Order not found'});res.json({order:q.rows[0]});}catch(e){res.status(500).json({error:e.message});}});
app.patch('/api/admin/orders/:id/tracking',requireAdmin,async(req,res)=>{try{const number=String(req.body?.trackingNumber||'').trim();const carrier=String(req.body?.trackingCarrier||'').trim().toLowerCase();if(!number)return res.status(400).json({error:'Enter a tracking number.'});if(carrier&&!['usps','ups','fedex','other'].includes(carrier))return res.status(400).json({error:'Invalid carrier'});const addedAt=new Date().toISOString();const url=trackingUrl(carrier,number);const patch={trackingNumber:number,trackingCarrier:carrier||'other',trackingUrl:url,trackingAddedAt:addedAt};const q=await pool.query(`UPDATE orders SET fulfillment_status='shipped',metadata=COALESCE(metadata,'{}'::jsonb)||$2::jsonb,updated_at=NOW() WHERE id=$1 RETURNING id,external_order_id,friendly_order_number,metadata,fulfillment_status`,[req.params.id,JSON.stringify(patch)]);if(!q.rows[0])return res.status(404).json({error:'Order not found'});res.json({order:q.rows[0]});}catch(e){res.status(500).json({error:e.message});}});
app.delete('/api/admin/orders/:id',requireAdmin,async(req,res)=>{try{const {businessId}=await ids();const q=await pool.query(`DELETE FROM orders WHERE id=$1 AND business_id=$2 RETURNING id,friendly_order_number,external_order_id`,[req.params.id,businessId]);if(!q.rows[0])return res.status(404).json({error:'Order not found'});res.json({ok:true,order:q.rows[0]});}catch(e){res.status(500).json({error:e.message});}});

app.get('/dashboard',async(_req,res)=>{try{const {readFile}=await import('fs/promises');const file=path.join(__dirname,'public','sole-rebel','dashboard.html');const html=await readFile(file,'utf8');res.type('html').send(html.replace('</body>','<script src="/order-delete.js"></script></body>'));}catch(e){res.status(500).send('Unable to load Sole Rebel dashboard.');}});
app.get('/*splat',(_req,res)=>res.sendFile(path.join(__dirname,'public','sole-rebel','index.html')));

startupSmokeTest().finally(()=>{app.listen(PORT,()=>console.log(`Sole Rebel running at http://localhost:${PORT}`));});
