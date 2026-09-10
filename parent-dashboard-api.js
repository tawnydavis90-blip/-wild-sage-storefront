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

function requireParentKey(req,res,next){
  const expected=String(process.env.PARENT_DASHBOARD_API_KEY||process.env.ADMIN_PASSWORD||'');
  if(!expected) return res.status(503).json({error:'Parent dashboard API is not configured.'});
  const auth=String(req.headers.authorization||'');
  const supplied=auth.startsWith('Bearer ')?auth.slice(7):'';
  const ok=supplied.length===expected.length&&supplied.length>0&&crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected));
  if(!ok) return res.status(401).json({error:'Unauthorized'});
  next();
}

async function companySummary(){
  const q=await db().query(`
    WITH order_totals AS (
      SELECT business_id,COUNT(*)::int AS order_count,COALESCE(SUM(total),0)::numeric AS revenue
      FROM orders GROUP BY business_id
    ), expense_totals AS (
      SELECT business_id,COALESCE(SUM(amount),0)::numeric AS expenses
      FROM expenses GROUP BY business_id
    ), event_totals AS (
      SELECT business_id,COUNT(*)::int AS events_30d,COUNT(DISTINCT session_id)::int AS sessions_30d
      FROM core_analytics_events WHERE occurred_at >= NOW() - INTERVAL '30 days' GROUP BY business_id
    )
    SELECT b.id,b.slug,b.display_name,b.business_type,b.status,
           COUNT(DISTINCT s.id)::int AS site_count,
           COALESCE(o.order_count,0)::int AS order_count,
           COALESCE(o.revenue,0)::numeric AS revenue,
           COALESCE(e.expenses,0)::numeric AS expenses,
           (COALESCE(o.revenue,0)-COALESCE(e.expenses,0))::numeric AS net,
           COALESCE(a.events_30d,0)::int AS events_30d,
           COALESCE(a.sessions_30d,0)::int AS sessions_30d
    FROM businesses b
    LEFT JOIN sites s ON s.business_id=b.id
    LEFT JOIN order_totals o ON o.business_id=b.id
    LEFT JOIN expense_totals e ON e.business_id=b.id
    LEFT JOIN event_totals a ON a.business_id=b.id
    GROUP BY b.id,b.slug,b.display_name,b.business_type,b.status,o.order_count,o.revenue,e.expenses,a.events_30d,a.sessions_30d
    ORDER BY CASE WHEN b.slug='sage-ember-holdings' THEN 0 ELSE 1 END,b.display_name
  `);
  return q.rows.map(r=>({
    id:r.id,slug:r.slug,name:r.display_name,type:r.business_type,status:r.status,
    sites:r.site_count,orders:r.order_count,revenue:Number(r.revenue),expenses:Number(r.expenses),net:Number(r.net),
    events30d:r.events_30d,sessions30d:r.sessions_30d
  }));
}

export function registerParentDashboardRoutes(app){
  app.get('/api/holding/health',requireParentKey,async(_req,res)=>{
    try{const result=await db().query('SELECT NOW() AS now');res.json({ok:true,database:true,at:result.rows[0].now});}
    catch(err){res.status(500).json({ok:false,error:err.message});}
  });

  app.get('/api/holding/summary',requireParentKey,async(_req,res)=>{
    try{
      const businesses=await companySummary();
      const operating=businesses.filter(b=>b.slug!=='sage-ember-holdings');
      res.json({
        company:'Sage & Ember Holdings',generatedAt:new Date().toISOString(),
        totals:{businesses:operating.length,sites:operating.reduce((n,b)=>n+b.sites,0),orders:operating.reduce((n,b)=>n+b.orders,0),revenue:operating.reduce((n,b)=>n+b.revenue,0),expenses:operating.reduce((n,b)=>n+b.expenses,0),net:operating.reduce((n,b)=>n+b.net,0),sessions30d:operating.reduce((n,b)=>n+b.sessions30d,0)},
        businesses
      });
    }catch(err){res.status(500).json({error:'Unable to load holding-company summary',detail:err.message});}
  });

  app.get('/api/holding/businesses/:slug',requireParentKey,async(req,res)=>{
    try{
      const business=await db().query('SELECT * FROM businesses WHERE slug=$1',[req.params.slug]);
      if(!business.rowCount) return res.status(404).json({error:'Business not found'});
      const id=business.rows[0].id;
      const [sites,orders,expenses,events]=await Promise.all([
        db().query('SELECT slug,name,domain,platform,status FROM sites WHERE business_id=$1 ORDER BY name',[id]),
        db().query('SELECT status,COUNT(*)::int AS count,COALESCE(SUM(total),0)::numeric AS total FROM orders WHERE business_id=$1 GROUP BY status ORDER BY status',[id]),
        db().query("SELECT category,COALESCE(SUM(amount),0)::numeric AS amount FROM expenses WHERE business_id=$1 AND expense_date>=CURRENT_DATE-INTERVAL '30 days' GROUP BY category ORDER BY amount DESC",[id]),
        db().query("SELECT event_name,COUNT(*)::int AS count FROM core_analytics_events WHERE business_id=$1 AND occurred_at>=NOW()-INTERVAL '30 days' GROUP BY event_name ORDER BY count DESC",[id])
      ]);
      res.json({business:business.rows[0],sites:sites.rows,orders:orders.rows.map(r=>({...r,total:Number(r.total)})),expenses30d:expenses.rows.map(r=>({...r,amount:Number(r.amount)})),events30d:events.rows});
    }catch(err){res.status(500).json({error:'Unable to load business detail',detail:err.message});}
  });
}
