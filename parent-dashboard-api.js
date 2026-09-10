import crypto from 'crypto';
import pg from 'pg';
import Stripe from 'stripe';

const { Pool } = pg;
let pool;
const stripe=process.env.STRIPE_SECRET_KEY?new Stripe(process.env.STRIPE_SECRET_KEY):null;

function db(){
  if(!pool){
    if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
    pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined});
  }
  return pool;
}
function parseCookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(v=>v.trim()).filter(Boolean).map(part=>{const i=part.indexOf('=');return [decodeURIComponent(part.slice(0,i)),decodeURIComponent(part.slice(i+1))]}));}
function safeEqual(a,b){a=String(a||'');b=String(b||'');return a.length===b.length&&a.length>0&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));}
function validAdminSession(req){const secret=String(process.env.ADMIN_SESSION_SECRET||process.env.ADMIN_PASSWORD||'');if(!secret)return false;const token=parseCookies(req).wild_sage_admin;if(!token)return false;const parts=token.split('.');if(parts.length!==3)return false;const payload=`${parts[0]}.${parts[1]}`,expected=crypto.createHmac('sha256',secret).update(payload).digest('hex'),actual=parts[2];if(!safeEqual(actual,expected))return false;return Number(parts[0])>Date.now();}
function requireParentKey(req,res,next){if(validAdminSession(req))return next();const supplied=String(req.headers.authorization||'').replace(/^Bearer\s+/i,''),parentKey=String(process.env.PARENT_DASHBOARD_API_KEY||''),adminPassword=String(process.env.ADMIN_PASSWORD||'');if(safeEqual(supplied,parentKey)||safeEqual(supplied,adminPassword))return next();return res.status(401).json({error:'Unauthorized'});}
const money=v=>Number(v||0)/100;

async function stripeWildSageOrders(){
  if(!stripe)return [];
  const sessions=await stripe.checkout.sessions.list({limit:100});
  return sessions.data.filter(s=>s.payment_status==='paid'&&s.metadata?.wild_sage_test!=='true'&&s.metadata?.do_not_fulfill!=='true'&&!String(s.id||'').startsWith('cs_test_')).map(s=>({
    id:s.id,source:'stripe',businessSlug:'wild-sage-apparel',businessName:'Wild Sage Apparel',status:s.payment_status,
    amount:money(s.amount_total),currency:String(s.currency||'usd').toUpperCase(),createdAt:new Date(s.created*1000).toISOString(),
    customer:s.customer_details?.name||'',email:s.customer_details?.email||s.customer_email||'',reference:s.client_reference_id||s.id
  }));
}
async function stripeWildSageSummary(){try{const rows=await stripeWildSageOrders();return{orders:rows.length,revenue:rows.reduce((s,r)=>s+r.amount,0)}}catch(err){console.error('Sage & Ember Stripe summary error:',err.message);return null;}}

async function companySummary(){
  const q=await db().query(`
    WITH order_totals AS (SELECT business_id,COUNT(*)::int AS order_count,COALESCE(SUM(total),0)::numeric AS revenue FROM orders GROUP BY business_id),
    expense_totals AS (SELECT business_id,COALESCE(SUM(amount),0)::numeric AS expenses FROM expenses GROUP BY business_id),
    event_totals AS (SELECT business_id,COUNT(*)::int AS events_30d,COUNT(DISTINCT session_id)::int AS sessions_30d FROM core_analytics_events WHERE occurred_at>=NOW()-INTERVAL '30 days' GROUP BY business_id)
    SELECT b.id,b.slug,b.display_name,b.business_type,b.status,COUNT(DISTINCT s.id)::int AS site_count,
      MAX(s.domain) FILTER (WHERE s.domain IS NOT NULL) AS live_url,MAX(s.dashboard_url) FILTER (WHERE s.dashboard_url IS NOT NULL) AS dashboard_url,
      COALESCE(o.order_count,0)::int AS order_count,COALESCE(o.revenue,0)::numeric AS revenue,COALESCE(e.expenses,0)::numeric AS expenses,
      (COALESCE(o.revenue,0)-COALESCE(e.expenses,0))::numeric AS net,COALESCE(a.events_30d,0)::int AS events_30d,COALESCE(a.sessions_30d,0)::int AS sessions_30d
    FROM businesses b LEFT JOIN sites s ON s.business_id=b.id LEFT JOIN order_totals o ON o.business_id=b.id LEFT JOIN expense_totals e ON e.business_id=b.id LEFT JOIN event_totals a ON a.business_id=b.id
    GROUP BY b.id,b.slug,b.display_name,b.business_type,b.status,o.order_count,o.revenue,e.expenses,a.events_30d,a.sessions_30d
    ORDER BY CASE WHEN b.slug='sage-ember-holdings' THEN 0 ELSE 1 END,b.display_name`);
  const businesses=q.rows.map(r=>({id:r.id,slug:r.slug,name:r.display_name,type:r.business_type,status:r.status,sites:r.site_count,liveUrl:r.live_url||null,dashboardUrl:r.dashboard_url||null,orders:r.order_count,revenue:Number(r.revenue),expenses:Number(r.expenses),net:Number(r.net),events30d:r.events_30d,sessions30d:r.sessions_30d}));
  const live=await stripeWildSageSummary();if(live){const wild=businesses.find(b=>b.slug==='wild-sage-apparel');if(wild){wild.orders=live.orders;wild.revenue=live.revenue;wild.net=wild.revenue-wild.expenses;wild.salesSource='stripe';}}
  return businesses;
}
async function portfolioSites(){const{rows}=await db().query(`SELECT s.id,s.slug,s.name,s.domain,s.dashboard_url,s.platform,s.status,b.slug AS business_slug,b.display_name AS business_name FROM sites s JOIN businesses b ON b.id=s.business_id ORDER BY CASE WHEN s.slug='sage-ember-hq' THEN 0 ELSE 1 END,b.display_name,s.name`);return rows;}

async function financialSnapshot(){
  const businesses=await companySummary();
  const expensesByBusiness=await db().query(`SELECT b.slug,b.display_name,COALESCE(SUM(e.amount),0)::numeric AS expenses FROM businesses b LEFT JOIN expenses e ON e.business_id=b.id GROUP BY b.id,b.slug,b.display_name ORDER BY b.display_name`);
  const rows=businesses.filter(b=>b.slug!=='sage-ember-holdings').map(b=>({businessSlug:b.slug,businessName:b.name,revenue:b.revenue,expenses:b.expenses,profit:b.revenue-b.expenses,orders:b.orders,salesSource:b.salesSource||'database'}));
  return {generatedAt:new Date().toISOString(),totals:{revenue:rows.reduce((n,r)=>n+r.revenue,0),expenses:rows.reduce((n,r)=>n+r.expenses,0),profit:rows.reduce((n,r)=>n+r.profit,0),orders:rows.reduce((n,r)=>n+r.orders,0)},businesses:rows,expenseLedger:expensesByBusiness.rows.map(r=>({businessSlug:r.slug,businessName:r.display_name,expenses:Number(r.expenses)}))};
}

async function masterOrders(){
  const stripeRows=await stripeWildSageOrders();
  const central=await db().query(`SELECT o.id,o.status,o.total,o.currency,o.created_at,b.slug AS business_slug,b.display_name AS business_name FROM orders o JOIN businesses b ON b.id=o.business_id WHERE b.slug<>'wild-sage-apparel' ORDER BY o.created_at DESC LIMIT 200`);
  const dbRows=central.rows.map(r=>({id:r.id,source:'database',businessSlug:r.business_slug,businessName:r.business_name,status:r.status,amount:Number(r.total||0),currency:String(r.currency||'USD').toUpperCase(),createdAt:r.created_at,customer:'',email:'',reference:String(r.id)}));
  return [...stripeRows,...dbRows].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
}

async function systemHealth(){
  const checks=[];
  try{await db().query('SELECT 1');checks.push({name:'Sage & Ember PostgreSQL',status:'healthy',detail:'Connected'});}catch(err){checks.push({name:'Sage & Ember PostgreSQL',status:'error',detail:err.message});}
  if(stripe){try{await stripe.balance.retrieve();checks.push({name:'Stripe',status:'healthy',detail:'Connected'});}catch(err){checks.push({name:'Stripe',status:'error',detail:err.message});}}else checks.push({name:'Stripe',status:'warning',detail:'Not configured'});
  checks.push({name:'Printify',status:process.env.PRINTIFY_API_TOKEN?'healthy':'warning',detail:process.env.PRINTIFY_API_TOKEN?'API token configured':'API token missing'});
  checks.push({name:'Stripe Webhook',status:process.env.STRIPE_WEBHOOK_SECRET?'healthy':'warning',detail:process.env.STRIPE_WEBHOOK_SECRET?'Webhook secret configured':'Webhook secret missing'});
  checks.push({name:'Password Vault',status:(process.env.PASSWORD_VAULT_KEY||process.env.ADMIN_SESSION_SECRET||process.env.ADMIN_PASSWORD)?'healthy':'warning',detail:(process.env.PASSWORD_VAULT_KEY||process.env.ADMIN_SESSION_SECRET||process.env.ADMIN_PASSWORD)?'Encryption key available':'Encryption key unavailable'});
  const sites=await portfolioSites();
  return {generatedAt:new Date().toISOString(),overall:checks.some(c=>c.status==='error')?'attention':checks.some(c=>c.status==='warning')?'warning':'healthy',checks,sites:sites.map(s=>({name:s.name,business:s.business_name,status:s.status,liveUrl:s.domain||null,dashboardUrl:s.dashboard_url||null,platform:s.platform}))};
}

export function registerParentDashboardRoutes(app){
  app.get('/api/holding/health',requireParentKey,async(_req,res)=>{try{res.json(await systemHealth());}catch(err){res.status(500).json({ok:false,error:err.message});}});
  app.get('/api/holding/summary',requireParentKey,async(_req,res)=>{try{const[businesses,sites]=await Promise.all([companySummary(),portfolioSites()]);const operating=businesses.filter(b=>b.slug!=='sage-ember-holdings');res.json({company:'Sage & Ember Holdings',generatedAt:new Date().toISOString(),totals:{businesses:operating.length,sites:sites.length,orders:operating.reduce((n,b)=>n+b.orders,0),revenue:operating.reduce((n,b)=>n+b.revenue,0),expenses:operating.reduce((n,b)=>n+b.expenses,0),net:operating.reduce((n,b)=>n+b.net,0),sessions30d:operating.reduce((n,b)=>n+b.sessions30d,0)},businesses,sites});}catch(err){res.status(500).json({error:'Unable to load holding-company summary',detail:err.message});}});
  app.get('/api/holding/financials',requireParentKey,async(_req,res)=>{try{res.json(await financialSnapshot());}catch(err){res.status(500).json({error:'Unable to load financial dashboard',detail:err.message});}});
  app.get('/api/holding/orders',requireParentKey,async(_req,res)=>{try{const orders=await masterOrders();res.json({generatedAt:new Date().toISOString(),count:orders.length,orders});}catch(err){res.status(500).json({error:'Unable to load master orders',detail:err.message});}});
  app.get('/api/holding/businesses/:slug',requireParentKey,async(req,res)=>{try{const business=await db().query('SELECT * FROM businesses WHERE slug=$1',[req.params.slug]);if(!business.rowCount)return res.status(404).json({error:'Business not found'});const id=business.rows[0].id;const[sites,orders,expenses,events]=await Promise.all([db().query('SELECT slug,name,domain,dashboard_url,platform,status FROM sites WHERE business_id=$1 ORDER BY name',[id]),db().query('SELECT status,COUNT(*)::int AS count,COALESCE(SUM(total),0)::numeric AS total FROM orders WHERE business_id=$1 GROUP BY status ORDER BY status',[id]),db().query("SELECT category,COALESCE(SUM(amount),0)::numeric AS amount FROM expenses WHERE business_id=$1 AND expense_date>=CURRENT_DATE-INTERVAL '30 days' GROUP BY category ORDER BY amount DESC",[id]),db().query("SELECT event_name,COUNT(*)::int AS count FROM core_analytics_events WHERE business_id=$1 AND occurred_at>=NOW()-INTERVAL '30 days' GROUP BY event_name ORDER BY count DESC",[id])]);let orderRows=orders.rows.map(r=>({...r,total:Number(r.total)}));if(req.params.slug==='wild-sage-apparel'){const live=await stripeWildSageSummary();if(live)orderRows=[{status:'paid',count:live.orders,total:live.revenue,source:'stripe'}];}res.json({business:business.rows[0],sites:sites.rows,orders:orderRows,expenses30d:expenses.rows.map(r=>({...r,amount:Number(r.amount)})),events30d:events.rows});}catch(err){res.status(500).json({error:'Unable to load business detail',detail:err.message});}});
}
