import crypto from 'crypto';
import pg from 'pg';

const { Pool } = pg;
let pool;

function db(){
  if(!pool){
    if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
    pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined});
  }
  return pool;
}

function parseCookies(req){
  return Object.fromEntries(String(req.headers.cookie||'').split(';').map(v=>v.trim()).filter(Boolean).map(part=>{const i=part.indexOf('=');return [decodeURIComponent(part.slice(0,i)),decodeURIComponent(part.slice(i+1))]}));
}
function safeEqual(a,b){
  a=String(a||'');b=String(b||'');
  return a.length===b.length&&a.length>0&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
}
function validAdminSession(req){
  const secret=String(process.env.ADMIN_SESSION_SECRET||process.env.ADMIN_PASSWORD||'');
  if(!secret)return false;
  const token=parseCookies(req).wild_sage_admin;if(!token)return false;
  const parts=token.split('.');if(parts.length!==3)return false;
  const payload=`${parts[0]}.${parts[1]}`;
  const expected=crypto.createHmac('sha256',secret).update(payload).digest('hex'),actual=parts[2];
  if(!safeEqual(actual,expected))return false;
  return Number(parts[0])>Date.now();
}
function requireParentKey(req,res,next){
  if(validAdminSession(req)) return next();
  const auth=String(req.headers.authorization||'');
  const supplied=auth.startsWith('Bearer ')?auth.slice(7):'';
  const parentKey=String(process.env.PARENT_DASHBOARD_API_KEY||'');
  const adminPassword=String(process.env.ADMIN_PASSWORD||'');
  if(safeEqual(supplied,parentKey)||safeEqual(supplied,adminPassword)) return next();
  return res.status(401).json({error:'Unauthorized'});
}

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
  return q.rows.map(r=>({id:r.id,slug:r.slug,name:r.display_name,type:r.business_type,status:r.status,sites:r.site_count,liveUrl:r.live_url||null,dashboardUrl:r.dashboard_url||null,orders:r.order_count,revenue:Number(r.revenue),expenses:Number(r.expenses),net:Number(r.net),events30d:r.events_30d,sessions30d:r.sessions_30d}));
}
async function portfolioSites(){const {rows}=await db().query(`SELECT s.id,s.slug,s.name,s.domain,s.dashboard_url,s.platform,s.status,b.slug AS business_slug,b.display_name AS business_name FROM sites s JOIN businesses b ON b.id=s.business_id ORDER BY CASE WHEN s.slug='sage-ember-hq' THEN 0 ELSE 1 END,b.display_name,s.name`);return rows;}

export function registerParentDashboardRoutes(app){
  app.get('/api/holding/health',requireParentKey,async(_req,res)=>{try{const result=await db().query('SELECT NOW() AS now');res.json({ok:true,database:true,at:result.rows[0].now});}catch(err){res.status(500).json({ok:false,error:err.message});}});
  app.get('/api/holding/summary',requireParentKey,async(_req,res)=>{try{const [businesses,sites]=await Promise.all([companySummary(),portfolioSites()]);const operating=businesses.filter(b=>b.slug!=='sage-ember-holdings');res.json({company:'Sage & Ember Holdings',generatedAt:new Date().toISOString(),totals:{businesses:operating.length,sites:sites.length,orders:operating.reduce((n,b)=>n+b.orders,0),revenue:operating.reduce((n,b)=>n+b.revenue,0),expenses:operating.reduce((n,b)=>n+b.expenses,0),net:operating.reduce((n,b)=>n+b.net,0),sessions30d:operating.reduce((n,b)=>n+b.sessions30d,0)},businesses,sites});}catch(err){res.status(500).json({error:'Unable to load holding-company summary',detail:err.message});}});
  app.get('/api/holding/businesses/:slug',requireParentKey,async(req,res)=>{try{const business=await db().query('SELECT * FROM businesses WHERE slug=$1',[req.params.slug]);if(!business.rowCount)return res.status(404).json({error:'Business not found'});const id=business.rows[0].id;const [sites,orders,expenses,events]=await Promise.all([db().query('SELECT slug,name,domain,dashboard_url,platform,status FROM sites WHERE business_id=$1 ORDER BY name',[id]),db().query('SELECT status,COUNT(*)::int AS count,COALESCE(SUM(total),0)::numeric AS total FROM orders WHERE business_id=$1 GROUP BY status ORDER BY status',[id]),db().query("SELECT category,COALESCE(SUM(amount),0)::numeric AS amount FROM expenses WHERE business_id=$1 AND expense_date>=CURRENT_DATE-INTERVAL '30 days' GROUP BY category ORDER BY amount DESC",[id]),db().query("SELECT event_name,COUNT(*)::int AS count FROM core_analytics_events WHERE business_id=$1 AND occurred_at>=NOW()-INTERVAL '30 days' GROUP BY event_name ORDER BY count DESC",[id])]);res.json({business:business.rows[0],sites:sites.rows,orders:orders.rows.map(r=>({...r,total:Number(r.total)})),expenses30d:expenses.rows.map(r=>({...r,amount:Number(r.amount)})),events30d:events.rows});}catch(err){res.status(500).json({error:'Unable to load business detail',detail:err.message});}});
}
