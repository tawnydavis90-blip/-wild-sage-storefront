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

app.use(express.json());
app.use(express.static(path.join(__dirname,'public','sole-rebel')));

function cookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(p=>{const i=p.indexOf('=');return[decodeURIComponent(p.slice(0,i)),decodeURIComponent(p.slice(i+1))]}));}
function sign(exp){const payload=String(exp);return `${payload}.${crypto.createHmac('sha256',SESSION_SECRET).update(payload).digest('hex')}`;}
function validSession(req){const token=cookies(req).sole_rebel_admin;if(!token)return false;const [exp,sig]=token.split('.');if(!exp||!sig||Number(exp)<Date.now())return false;const expected=crypto.createHmac('sha256',SESSION_SECRET).update(exp).digest('hex');return sig.length===expected.length&&crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected));}
function requireAdmin(req,res,next){if(validSession(req))return next();res.status(401).json({error:'Unauthorized'});}
async function ids(){const b=await pool.query("SELECT id FROM businesses WHERE slug='sole-rebel'");if(!b.rows[0])throw new Error('Sole Rebel business record is missing');const s=await pool.query("SELECT id FROM sites WHERE slug='sole-rebel-storefront' LIMIT 1");return{businessId:b.rows[0].id,siteId:s.rows[0]?.id||null};}

async function startupSmokeTest(){
  let client;
  try{
    client=await pool.connect();
    await client.query('BEGIN');
    const b=await client.query("SELECT id FROM businesses WHERE slug='sole-rebel'");
    if(!b.rows[0])throw new Error('Sole Rebel business record is missing');
    const s=await client.query("SELECT id FROM sites WHERE slug='sole-rebel-storefront' LIMIT 1");
    const testId=`SR-SMOKE-${Date.now()}`;
    await client.query(`INSERT INTO orders (business_id,site_id,external_order_id,friendly_order_number,status,currency,subtotal,shipping,total,fulfillment_provider,fulfillment_status,ordered_at,metadata) VALUES ($1,$2,$3,$3,'pending','USD',25,6,31,'smoke-test','rolled back',NOW(),$4::jsonb)`,[b.rows[0].id,s.rows[0]?.id||null,testId,JSON.stringify({source:'sole-rebel-startup-smoke-test'})]);
    await client.query('ROLLBACK');
    console.log(`Sole Rebel database smoke test passed. business=${Boolean(b.rows[0])} site=${Boolean(s.rows[0])} adminPassword=${Boolean(ADMIN_PASSWORD)} sessionSecret=${Boolean(process.env.SOLE_REBEL_SESSION_SECRET)}`);
  }catch(err){
    if(client){try{await client.query('ROLLBACK');}catch{}}
    console.error('Sole Rebel database smoke test FAILED:',err.message);
  }finally{if(client)client.release();}
}

app.get('/api/health',async(_req,res)=>{try{await pool.query('SELECT 1');res.json({ok:true,service:'Sole Rebel',database:'Sage & Ember Core'});}catch(e){res.status(500).json({ok:false,error:e.message});}});
app.get('/api/payment-options',(_req,res)=>res.json({venmo:{enabled:Boolean(VENMO_URL),url:VENMO_URL},cashapp:{enabled:Boolean(CASHAPP_URL),url:CASHAPP_URL}}));

app.post('/api/orders',async(req,res)=>{try{const color=String(req.body?.color||'').toLowerCase();const days=Math.max(1,Math.min(14,Number(req.body?.daysWorn||1)));const pairs=Math.max(1,Math.min(20,Number(req.body?.pairs||1)));const customer=String(req.body?.customer||'').trim();const email=String(req.body?.email||'').trim();const contact=String(req.body?.contact||email||'').trim();const address=req.body?.address&&typeof req.body.address==='object'?req.body.address:{};const specialRequest=String(req.body?.specialRequest||'').trim();if(!['black','white','gray'].includes(color))return res.status(400).json({error:'Choose black, white, or gray.'});if(!customer)return res.status(400).json({error:'Enter your name.'});const {businessId,siteId}=await ids();const subtotal=days*25*pairs,shipping=6,total=subtotal+shipping,externalId=`SR-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;const metadata={source:'sole-rebel-render',customer,email,contact,color,daysWorn:days,pairs,pricePerDay:25,shippingFlat:6,address,specialRequest,paymentLinkClicked:false,paymentMethodClicked:null,paymentLinkClickedAt:null,paymentReported:false,paymentReportedAt:null,paymentReportedMethod:null};const q=await pool.query(`INSERT INTO orders (business_id,site_id,external_order_id,friendly_order_number,status,currency,subtotal,shipping,total,fulfillment_provider,fulfillment_status,ordered_at,metadata) VALUES ($1,$2,$3,$3,'pending','USD',$4,$5,$6,'manual','awaiting payment',NOW(),$7::jsonb) RETURNING id,external_order_id,total,status,ordered_at`,[businessId,siteId,externalId,subtotal,shipping,total,JSON.stringify(metadata)]);res.status(201).json({order:q.rows[0],paymentOptions:{venmo:Boolean(VENMO_URL),cashapp:Boolean(CASHAPP_URL)}});}catch(e){res.status(500).json({error:e.message});}});

app.post('/api/orders/:externalId/payment-click',async(req,res)=>{try{const method=String(req.body?.method||'').toLowerCase();if(!['venmo','cashapp'].includes(method))return res.status(400).json({error:'Invalid payment method'});const clickedAt=new Date().toISOString();const patch={paymentLinkClicked:true,paymentMethodClicked:method,paymentLinkClickedAt:clickedAt};const q=await pool.query(`UPDATE orders SET metadata=COALESCE(metadata,'{}'::jsonb)||$2::jsonb,updated_at=NOW() WHERE external_order_id=$1 RETURNING id,external_order_id,metadata`,[req.params.externalId,JSON.stringify(patch)]);if(!q.rows[0])return res.status(404).json({error:'Order not found'});res.json({ok:true,clickedAt,method});}catch(e){res.status(500).json({error:e.message});}});

app.post('/api/orders/:externalId/payment-reported',async(req,res)=>{try{const method=String(req.body?.method||'').toLowerCase();if(!['venmo','cashapp'].includes(method))return res.status(400).json({error:'Invalid payment method'});const reportedAt=new Date().toISOString();const patch={paymentReported:true,paymentReportedAt:reportedAt,paymentReportedMethod:method};const q=await pool.query(`UPDATE orders SET status='payment_reported',fulfillment_status='customer reports payment sent',metadata=COALESCE(metadata,'{}'::jsonb)||$2::jsonb,updated_at=NOW() WHERE external_order_id=$1 RETURNING id,external_order_id,status,metadata`,[req.params.externalId,JSON.stringify(patch)]);if(!q.rows[0])return res.status(404).json({error:'Order not found'});res.json({ok:true,reportedAt,method,status:'payment_reported'});}catch(e){res.status(500).json({error:e.message});}});

app.post('/api/admin/login',(req,res)=>{if(!ADMIN_PASSWORD)return res.status(503).json({error:'Sole Rebel admin password is not configured yet.'});if(String(req.body?.password||'')!==ADMIN_PASSWORD)return res.status(401).json({error:'Incorrect password'});const exp=Date.now()+12*60*60*1000;res.setHeader('Set-Cookie',`sole_rebel_admin=${encodeURIComponent(sign(exp))}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`);res.json({ok:true});});
app.get('/api/admin/session',(req,res)=>res.json({authenticated:validSession(req)}));
app.post('/api/admin/logout',(_req,res)=>{res.setHeader('Set-Cookie','sole_rebel_admin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');res.json({ok:true});});
app.get('/api/admin/dashboard',requireAdmin,async(_req,res)=>{try{const {businessId}=await ids();const stats=await pool.query(`SELECT COUNT(*) FILTER (WHERE ordered_at>=NOW()-INTERVAL '24 hours')::int AS last24h,COUNT(*) FILTER (WHERE ordered_at>=NOW()-INTERVAL '7 days')::int AS last7d,COUNT(*)::int AS lifetime,COUNT(*) FILTER (WHERE status='paid')::int AS paid,COUNT(*) FILTER (WHERE status='payment_reported')::int AS payment_reported,COUNT(*) FILTER (WHERE status NOT IN ('paid','cancelled','refunded'))::int AS unpaid,COALESCE(SUM(total),0)::numeric AS order_value,COALESCE(SUM(total) FILTER (WHERE status='paid'),0)::numeric AS paid_revenue FROM orders WHERE business_id=$1`,[businessId]);const orders=await pool.query(`SELECT id,external_order_id,status,total,ordered_at,fulfillment_status,metadata FROM orders WHERE business_id=$1 ORDER BY ordered_at DESC LIMIT 200`,[businessId]);res.json({stats:{...stats.rows[0],order_value:Number(stats.rows[0].order_value),paid_revenue:Number(stats.rows[0].paid_revenue)},orders:orders.rows.map(o=>({...o,total:Number(o.total)}))});}catch(e){res.status(500).json({error:e.message});}});
app.patch('/api/admin/orders/:id',requireAdmin,async(req,res)=>{try{const status=String(req.body?.status||'').toLowerCase();if(!['pending','payment_reported','paid','cancelled','refunded'].includes(status))return res.status(400).json({error:'Invalid status'});const q=await pool.query(`UPDATE orders SET status=$2,fulfillment_status=CASE WHEN $2='paid' THEN 'payment received' WHEN $2='payment_reported' THEN 'customer reports payment sent' WHEN $2='cancelled' THEN 'cancelled' ELSE fulfillment_status END,updated_at=NOW() WHERE id=$1 RETURNING id,status,fulfillment_status`,[req.params.id,status]);if(!q.rows[0])return res.status(404).json({error:'Order not found'});res.json({order:q.rows[0]});}catch(e){res.status(500).json({error:e.message});}});

app.get('/dashboard',(_req,res)=>res.sendFile(path.join(__dirname,'public','sole-rebel','dashboard.html')));
app.get('/*splat',(_req,res)=>res.sendFile(path.join(__dirname,'public','sole-rebel','index.html')));

startupSmokeTest().finally(()=>{
  app.listen(PORT,()=>console.log(`Sole Rebel running at http://localhost:${PORT}`));
});
