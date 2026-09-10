import crypto from 'crypto';
import pg from 'pg';
import Stripe from 'stripe';

const { Pool } = pg;
const COOKIE_NAME = 'wild_sage_admin';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const BUSINESS_ID = process.env.BUSINESS_ID || 'wild-sage-apparel';
const BUSINESS_NAME = process.env.BUSINESS_NAME || 'Wild Sage Apparel';
const PARENT_COMPANY_ID = process.env.PARENT_COMPANY_ID || 'sage-and-ember-holdings';
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const ALLOWED_EVENTS = new Set(['page_view','product_view','add_to_bag','checkout_start']);
const DEFAULT_COLLECTIONS = [
  ['all','All',true,0],['crops','Crops',true,1],['tanks','Tanks',true,2],['tees','Tees',true,3],
  ['hoodies','Hoodies',true,4],['dark hippie','Dark Hippie',true,5],['fall','Fall Drop',true,6]
];
const DEFAULT_SETTINGS = {
  announcementLeft:'EARTHY MINDS ✦ WILDER SOULS ✦ HIGHER STANDARDS',
  announcementRight:'FREE SHIPPING ON ORDERS $75+',
  heroEyebrow:'THE CURRENT DROP',
  heroTitle:'Wear your\ncontradiction.',
  heroKicker:'HIPPIE SOUL ✦ DARK THOUGHTS\nBEAUTIFULLY BROKEN ✦ ALWAYS REAL',
  aboutEyebrow:'WILD SAGE',
  aboutTitle:'Soft edges. Strong standards.',
  aboutText:'Made for the beautifully complicated—the wild, grounded, dark-hearted, sunshine-carrying souls who refuse to fit neatly in one box.',
  contactEmail:'hello@wildsageapparel.com',
  featuredEnabled:true,
  bestSellersEnabled:true
};

let pool = null;
let schemaReady = false;
function getPool(){
  if(!process.env.DATABASE_URL) return null;
  if(!pool) pool = new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined});
  return pool;
}
async function ensureSchema(){
  const db=getPool(); if(!db) return false; if(schemaReady) return true;
  await db.query(`
    CREATE TABLE IF NOT EXISTS product_merchandising (
      product_id TEXT PRIMARY KEY, featured BOOLEAN NOT NULL DEFAULT FALSE, best_seller BOOLEAN NOT NULL DEFAULT FALSE,
      mockup_urls JSONB NOT NULL DEFAULT '[]'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS store_settings (
      setting_key TEXT PRIMARY KEY, setting_value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS collection_settings (
      collection_id TEXT PRIMARY KEY, label TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS analytics_events (
      id BIGSERIAL PRIMARY KEY, event_type TEXT NOT NULL, product_id TEXT, session_id TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS analytics_events_created_idx ON analytics_events(created_at);
    CREATE INDEX IF NOT EXISTS analytics_events_type_idx ON analytics_events(event_type);
  `);
  for(const [id,label,enabled,sortOrder] of DEFAULT_COLLECTIONS){
    await db.query(`INSERT INTO collection_settings(collection_id,label,enabled,sort_order) VALUES($1,$2,$3,$4) ON CONFLICT(collection_id) DO NOTHING`,[id,label,enabled,sortOrder]);
  }
  schemaReady=true; return true;
}
function parseCookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(v=>v.trim()).filter(Boolean).map(part=>{const i=part.indexOf('=');return[decodeURIComponent(part.slice(0,i)),decodeURIComponent(part.slice(i+1))]}));}
function secret(){return process.env.ADMIN_SESSION_SECRET||process.env.ADMIN_PASSWORD||'';}
function sign(payload){return crypto.createHmac('sha256',secret()).update(payload).digest('hex');}
function createSessionToken(){const payload=`${Date.now()+SESSION_TTL_MS}.${crypto.randomBytes(12).toString('hex')}`;return`${payload}.${sign(payload)}`;}
function validSession(req){
  if(!secret())return false; const token=parseCookies(req)[COOKIE_NAME]; if(!token)return false; const parts=token.split('.'); if(parts.length!==3)return false;
  const payload=`${parts[0]}.${parts[1]}`,expected=sign(payload),actual=parts[2];
  if(expected.length!==actual.length||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(actual)))return false; return Number(parts[0])>Date.now();
}
function requireAdmin(req,res,next){if(!validSession(req))return res.status(401).json({error:'Admin login required.'});next();}
function requireParentDashboard(req,res,next){
  const expected=String(process.env.PARENT_DASHBOARD_API_KEY||''); if(!expected)return res.status(503).json({error:'Parent dashboard integration is not configured.'});
  const auth=String(req.headers.authorization||''),supplied=auth.startsWith('Bearer ')?auth.slice(7):'';
  const ok=supplied.length===expected.length&&supplied.length>0&&crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected));
  if(!ok)return res.status(401).json({error:'Invalid parent dashboard credentials.'}); next();
}
function sanitizeMockups(value){if(!Array.isArray(value))return[];return value.map(v=>String(v||'').trim()).filter(v=>/^https?:\/\//i.test(v)).slice(0,6);}
function cleanText(value,max=1000){return String(value??'').trim().slice(0,max);}
async function readOverrides(){
  if(!(await ensureSchema()))return{configured:false,items:[]};
  const{rows}=await getPool().query('SELECT product_id,featured,best_seller,mockup_urls,updated_at FROM product_merchandising ORDER BY updated_at DESC');
  return{configured:true,items:rows.map(r=>({productId:r.product_id,featured:Boolean(r.featured),bestSeller:Boolean(r.best_seller),mockups:Array.isArray(r.mockup_urls)?r.mockup_urls:[],updatedAt:r.updated_at}))};
}
async function readSettings(){
  const result={...DEFAULT_SETTINGS}; if(!(await ensureSchema()))return{configured:false,settings:result,collections:DEFAULT_COLLECTIONS.map(([id,label,enabled,sortOrder])=>({id,label,enabled,sortOrder}))};
  const db=getPool(); const settings=await db.query('SELECT setting_key,setting_value FROM store_settings');
  settings.rows.forEach(r=>{if(Object.prototype.hasOwnProperty.call(result,r.setting_key))result[r.setting_key]=r.setting_value;});
  const collections=await db.query('SELECT collection_id,label,enabled,sort_order FROM collection_settings ORDER BY sort_order,label');
  return{configured:true,settings:result,collections:collections.rows.map(r=>({id:r.collection_id,label:r.label,enabled:r.enabled,sortOrder:r.sort_order}))};
}
async function analyticsSummary(){
  if(!(await ensureSchema()))return{configured:false,windows:{}}; const db=getPool();
  const windows={};
  for(const [key,interval] of [['24h','24 hours'],['7d','7 days'],['30d','30 days'],['all',null]]){
    const where=interval?`WHERE created_at >= NOW() - INTERVAL '${interval}'`:'';
    const q=await db.query(`SELECT event_type,COUNT(*)::int AS count,COUNT(DISTINCT session_id)::int AS sessions FROM analytics_events ${where} GROUP BY event_type`);
    const bucket={pageViews:0,productViews:0,addToBags:0,checkoutStarts:0,uniqueSessions:0};
    q.rows.forEach(r=>{if(r.event_type==='page_view')bucket.pageViews=r.count;if(r.event_type==='product_view')bucket.productViews=r.count;if(r.event_type==='add_to_bag')bucket.addToBags=r.count;if(r.event_type==='checkout_start')bucket.checkoutStarts=r.count;bucket.uniqueSessions=Math.max(bucket.uniqueSessions,r.sessions||0);});
    windows[key]=bucket;
  }
  const top=await db.query(`SELECT product_id,COUNT(*)::int AS views FROM analytics_events WHERE event_type='product_view' AND product_id IS NOT NULL AND created_at>=NOW()-INTERVAL '30 days' GROUP BY product_id ORDER BY views DESC LIMIT 10`);
  return{configured:true,windows,topProducts:top.rows.map(r=>({productId:r.product_id,views:r.views}))};
}
async function stripeOrders(){
  if(!stripe)return{configured:false,orders:[]};
  const sessions=await stripe.checkout.sessions.list({limit:50,expand:['data.line_items']});
  return{configured:true,orders:sessions.data.map(s=>({id:s.id,created:new Date(s.created*1000).toISOString(),status:s.payment_status,total:Number(s.amount_total||0)/100,currency:String(s.currency||'usd').toUpperCase(),customer:s.customer_details?.email||s.customer_email||'',name:s.customer_details?.name||'',items:(s.line_items?.data||[]).map(i=>({description:i.description,quantity:i.quantity,amount:Number(i.amount_total||0)/100}))}))};
}
async function parentSummary(){
  const merch=await readOverrides(),analytics=await analyticsSummary(),settings=await readSettings(); const items=merch.items||[];
  return{business:{id:BUSINESS_ID,name:BUSINESS_NAME,parentCompanyId:PARENT_COMPANY_ID,service:'storefront',version:2},databaseConfigured:merch.configured,
    merchandising:{configuredProducts:items.length,featuredProducts:items.filter(x=>x.featured).length,bestSellerProducts:items.filter(x=>x.bestSeller).length,customMockupProducts:items.filter(x=>x.mockups?.length).length},
    analytics:analytics.windows?.['30d']||{},store:{featuredEnabled:Boolean(settings.settings?.featuredEnabled),bestSellersEnabled:Boolean(settings.settings?.bestSellersEnabled)},
    capabilities:['merchandising.read','merchandising.write','mockups.read','mockups.write','orders.read','analytics.read','homepage.read','homepage.write','collections.read','collections.write','settings.read','settings.write']};
}

export function registerAdminRoutes(app){
  app.post('/api/admin/login',(req,res)=>{const configured=Boolean(process.env.ADMIN_PASSWORD&&secret());if(!configured)return res.status(503).json({error:'Admin login is not configured yet.'});const supplied=String(req.body?.password||''),expected=String(process.env.ADMIN_PASSWORD||'');const ok=supplied.length===expected.length&&crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected));if(!ok)return res.status(401).json({error:'Incorrect password.'});const secure=process.env.NODE_ENV==='production'?'; Secure':'';res.setHeader('Set-Cookie',`${COOKIE_NAME}=${encodeURIComponent(createSessionToken())}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS/1000)}${secure}`);res.json({ok:true});});
  app.post('/api/admin/logout',(_req,res)=>{res.setHeader('Set-Cookie',`${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);res.json({ok:true});});
  app.get('/api/admin/session',(req,res)=>res.json({authenticated:validSession(req),databaseConfigured:Boolean(process.env.DATABASE_URL),adminConfigured:Boolean(process.env.ADMIN_PASSWORD&&secret()),stripeConfigured:Boolean(process.env.STRIPE_SECRET_KEY),businessId:BUSINESS_ID,parentCompanyId:PARENT_COMPANY_ID}));

  app.get('/api/business/manifest',(_req,res)=>res.json({id:BUSINESS_ID,name:BUSINESS_NAME,parentCompanyId:PARENT_COMPANY_ID,service:'storefront',apiVersion:2,parentIntegrationReady:Boolean(process.env.PARENT_DASHBOARD_API_KEY),capabilities:['merchandising','custom-mockups','orders','analytics','homepage-content','collections','store-settings']}));
  app.get('/api/integrations/parent/summary',requireParentDashboard,async(_req,res)=>{try{res.json(await parentSummary())}catch(err){console.error(err);res.status(500).json({error:'Unable to load business summary.'})}});
  app.get('/api/integrations/parent/merchandising',requireParentDashboard,async(_req,res)=>{try{res.json(await readOverrides())}catch(err){res.status(500).json({error:'Unable to load merchandising settings.'})}});

  app.get('/api/merchandising',async(_req,res)=>{try{res.json(await readOverrides())}catch(err){res.status(500).json({error:'Unable to load merchandising settings.'})}});
  app.get('/api/store-config',async(_req,res)=>{try{res.json(await readSettings())}catch(err){res.status(500).json({error:'Unable to load store settings.'})}});
  app.post('/api/analytics/event',async(req,res)=>{try{if(!(await ensureSchema()))return res.status(204).end();const type=cleanText(req.body?.type,40);if(!ALLOWED_EVENTS.has(type))return res.status(400).json({error:'Unsupported event.'});const productId=cleanText(req.body?.productId,120)||null,sessionId=cleanText(req.body?.sessionId,120)||null;await getPool().query('INSERT INTO analytics_events(event_type,product_id,session_id,metadata) VALUES($1,$2,$3,$4::jsonb)',[type,productId,sessionId,JSON.stringify({path:cleanText(req.body?.path,300)})]);res.status(204).end()}catch(err){console.error('Analytics event error:',err);res.status(204).end()}});

  app.get('/api/admin/overview',requireAdmin,async(_req,res)=>{try{const[merch,analytics,config,orders]=await Promise.all([readOverrides(),analyticsSummary(),readSettings(),stripeOrders()]);res.json({merchandising:merch,analytics,config,orders:{configured:orders.configured,count:orders.orders.length,paid:orders.orders.filter(o=>o.status==='paid').length,revenue:orders.orders.filter(o=>o.status==='paid').reduce((s,o)=>s+o.total,0)}})}catch(err){console.error(err);res.status(500).json({error:'Unable to load dashboard overview.'})}});
  app.get('/api/admin/orders',requireAdmin,async(_req,res)=>{try{res.json(await stripeOrders())}catch(err){console.error('Stripe admin orders error:',err);res.status(500).json({error:'Unable to load Stripe orders.'})}});
  app.get('/api/admin/analytics',requireAdmin,async(_req,res)=>{try{res.json(await analyticsSummary())}catch(err){res.status(500).json({error:'Unable to load analytics.'})}});
  app.get('/api/admin/store-config',requireAdmin,async(_req,res)=>{try{res.json(await readSettings())}catch(err){res.status(500).json({error:'Unable to load store settings.'})}});
  app.put('/api/admin/store-config',requireAdmin,async(req,res)=>{try{if(!(await ensureSchema()))return res.status(503).json({error:'DATABASE_URL is not configured.'});const incoming=req.body?.settings||{};const db=getPool();for(const key of Object.keys(DEFAULT_SETTINGS)){if(!Object.prototype.hasOwnProperty.call(incoming,key))continue;let value=incoming[key];if(typeof DEFAULT_SETTINGS[key]==='boolean')value=Boolean(value);else value=cleanText(value,2000);await db.query(`INSERT INTO store_settings(setting_key,setting_value,updated_at) VALUES($1,$2::jsonb,NOW()) ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_at=NOW()`,[key,JSON.stringify(value)]);}res.json({ok:true,...await readSettings()})}catch(err){console.error(err);res.status(500).json({error:'Unable to save store settings.'})}});
  app.put('/api/admin/collections',requireAdmin,async(req,res)=>{try{if(!(await ensureSchema()))return res.status(503).json({error:'DATABASE_URL is not configured.'});const rows=Array.isArray(req.body?.collections)?req.body.collections:[];for(const [i,row] of rows.entries()){const id=cleanText(row.id,80),label=cleanText(row.label,80);if(!id||!label)continue;await getPool().query(`INSERT INTO collection_settings(collection_id,label,enabled,sort_order,updated_at) VALUES($1,$2,$3,$4,NOW()) ON CONFLICT(collection_id) DO UPDATE SET label=EXCLUDED.label,enabled=EXCLUDED.enabled,sort_order=EXCLUDED.sort_order,updated_at=NOW()`,[id,label,Boolean(row.enabled),Number.isFinite(Number(row.sortOrder))?Number(row.sortOrder):i]);}res.json({ok:true,...await readSettings()})}catch(err){res.status(500).json({error:'Unable to save collections.'})}});

  app.get('/api/admin/merchandising',requireAdmin,async(_req,res)=>{try{res.json(await readOverrides())}catch(err){res.status(500).json({error:'Unable to load merchandising settings.'})}});
  app.put('/api/admin/products/:id',requireAdmin,async(req,res)=>{if(!(await ensureSchema()))return res.status(503).json({error:'DATABASE_URL is not configured.'});const productId=cleanText(req.params.id,140);if(!productId)return res.status(400).json({error:'Product id is required.'});const featured=Boolean(req.body?.featured),bestSeller=Boolean(req.body?.bestSeller),mockups=sanitizeMockups(req.body?.mockups);try{const{rows}=await getPool().query(`INSERT INTO product_merchandising(product_id,featured,best_seller,mockup_urls,updated_at) VALUES($1,$2,$3,$4::jsonb,NOW()) ON CONFLICT(product_id) DO UPDATE SET featured=EXCLUDED.featured,best_seller=EXCLUDED.best_seller,mockup_urls=EXCLUDED.mockup_urls,updated_at=NOW() RETURNING product_id,featured,best_seller,mockup_urls,updated_at`,[productId,featured,bestSeller,JSON.stringify(mockups)]);const r=rows[0];res.json({ok:true,item:{productId:r.product_id,featured:r.featured,bestSeller:r.best_seller,mockups:r.mockup_urls,updatedAt:r.updated_at}})}catch(err){console.error(err);res.status(500).json({error:'Unable to save product settings.'})}});
}
