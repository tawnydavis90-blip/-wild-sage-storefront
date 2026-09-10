import crypto from 'crypto';
import pg from 'pg';

const { Pool } = pg;
let pool;
function db(){if(!pool){if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is not configured');pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined});}return pool;}
function cookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(v=>v.trim()).filter(Boolean).map(p=>{const i=p.indexOf('=');return[decodeURIComponent(p.slice(0,i)),decodeURIComponent(p.slice(i+1))]}));}
function safeEqual(a,b){a=String(a||'');b=String(b||'');return a.length===b.length&&a.length>0&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));}
function validAdmin(req){const secret=String(process.env.ADMIN_SESSION_SECRET||process.env.ADMIN_PASSWORD||'');const token=cookies(req).wild_sage_admin;if(!secret||!token)return false;const parts=token.split('.');if(parts.length!==3)return false;const payload=`${parts[0]}.${parts[1]}`,expected=crypto.createHmac('sha256',secret).update(payload).digest('hex');return safeEqual(parts[2],expected)&&Number(parts[0])>Date.now();}

export function registerDatabaseDiagnosticsRoutes(app){
  app.get('/api/holding/database-diagnostics',async(req,res)=>{
    if(!validAdmin(req))return res.status(401).json({error:'Admin login required.'});
    try{
      const [info,tables,columns,counts]=await Promise.all([
        db().query(`SELECT current_database() AS database_name,current_user AS database_user,version() AS version,now() AS checked_at`),
        db().query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`),
        db().query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='expenses' ORDER BY ordinal_position`),
        db().query(`SELECT (SELECT COUNT(*) FROM businesses)::int AS businesses,(SELECT COUNT(*) FROM sites)::int AS sites,(SELECT COUNT(*) FROM orders)::int AS orders,(SELECT COUNT(*) FROM expenses)::int AS expenses`)
      ]);
      const names=tables.rows.map(r=>r.table_name),required=['businesses','sites','orders','expenses','payments','products','core_analytics_events','password_vault'];
      const expenseCols=columns.rows.map(r=>r.column_name),requiredExpense=['recurring','frequency','next_due_date','active','auto_renew','payment_method_hint'];
      res.json({ok:true,...info.rows[0],tableCount:names.length,requiredTables:required.map(name=>({name,present:names.includes(name)})),expenseSubscriptionColumns:requiredExpense.map(name=>({name,present:expenseCols.includes(name)})),counts:counts.rows[0],ssl:true});
    }catch(err){res.status(500).json({ok:false,error:err.message});}
  });
}
