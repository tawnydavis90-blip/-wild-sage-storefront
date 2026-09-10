import crypto from 'crypto';
import pg from 'pg';
import Stripe from 'stripe';

const { Pool } = pg;
const COOKIE_NAME = 'wild_sage_admin';
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
let pool = null;
let schemaReady = false;

function db(){
  if(!process.env.DATABASE_URL) return null;
  if(!pool) pool = new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined});
  return pool;
}
async function ensureSchema(){
  const client=db(); if(!client) return false; if(schemaReady) return true;
  await client.query(`
    CREATE TABLE IF NOT EXISTS accounting_expenses (
      id BIGSERIAL PRIMARY KEY,
      expense_date DATE NOT NULL,
      category TEXT NOT NULL,
      vendor TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS accounting_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  schemaReady=true; return true;
}
function cookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(v=>v.trim()).filter(Boolean).map(part=>{const i=part.indexOf('=');return[decodeURIComponent(part.slice(0,i)),decodeURIComponent(part.slice(i+1))]}));}
function secret(){return process.env.ADMIN_SESSION_SECRET||process.env.ADMIN_PASSWORD||'';}
function sign(payload){return crypto.createHmac('sha256',secret()).update(payload).digest('hex');}
function validAdmin(req){
  if(!secret()) return false; const token=cookies(req)[COOKIE_NAME]; if(!token) return false;
  const parts=token.split('.'); if(parts.length!==3) return false;
  const payload=`${parts[0]}.${parts[1]}`,expected=sign(payload),actual=parts[2];
  if(expected.length!==actual.length||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(actual))) return false;
  return Number(parts[0])>Date.now();
}
function requireAdmin(req,res,next){if(!validAdmin(req))return res.status(401).json({error:'Admin login required.'});next();}
function clean(v,max=300){return String(v??'').trim().slice(0,max);}
function periodStart(period){
  const now=new Date();
  if(period==='90d') return Math.floor((Date.now()-90*86400000)/1000);
  if(period==='ytd') return Math.floor(new Date(now.getFullYear(),0,1).getTime()/1000);
  return Math.floor((Date.now()-30*86400000)/1000);
}
function periodDate(period){
  const d=new Date(periodStart(period)*1000); return d.toISOString().slice(0,10);
}
async function taxReserveRate(){
  if(!(await ensureSchema())) return 20;
  const {rows}=await db().query("SELECT setting_value FROM accounting_settings WHERE setting_key='tax_reserve_percent'");
  const n=Number(rows[0]?.setting_value ?? 20); return Number.isFinite(n)?Math.max(0,Math.min(100,n)):20;
}
async function expensesFor(period){
  if(!(await ensureSchema())) return {configured:false,items:[],total:0};
  const {rows}=await db().query('SELECT id,expense_date,category,vendor,description,amount_cents,created_at FROM accounting_expenses WHERE expense_date >= $1 ORDER BY expense_date DESC,id DESC',[periodDate(period)]);
  return {configured:true,items:rows.map(r=>({id:r.id,date:r.expense_date,category:r.category,vendor:r.vendor,description:r.description,amount:Number(r.amount_cents||0)/100,createdAt:r.created_at})),total:rows.reduce((s,r)=>s+Number(r.amount_cents||0),0)/100};
}
async function stripeAccounting(period){
  if(!stripe) return {configured:false,grossSales:0,refunds:0,stripeFees:0,stripeNet:0,transactionCount:0};
  const result=await stripe.balanceTransactions.list({limit:100,created:{gte:periodStart(period)}});
  const relevant=result.data.filter(t=>['charge','refund','payment','payment_refund','dispute'].includes(t.type));
  let gross=0,refunds=0,fees=0,net=0;
  for(const t of relevant){
    if((t.type==='charge'||t.type==='payment')&&t.amount>0) gross+=t.amount;
    if((t.type==='refund'||t.type==='payment_refund')&&t.amount<0) refunds+=Math.abs(t.amount);
    fees+=Number(t.fee||0);
    net+=Number(t.net||0);
  }
  return {configured:true,grossSales:gross/100,refunds:refunds/100,stripeFees:fees/100,stripeNet:net/100,transactionCount:relevant.length,hasMore:Boolean(result.has_more)};
}

export function registerAccountingRoutes(app){
  app.get('/api/admin/accounting',requireAdmin,async(req,res)=>{
    try{
      const period=['30d','90d','ytd'].includes(req.query.period)?req.query.period:'30d';
      const [stripeData,expenses,rate]=await Promise.all([stripeAccounting(period),expensesFor(period),taxReserveRate()]);
      const taxableBase=Math.max(0,stripeData.grossSales-stripeData.refunds);
      const reserve=taxableBase*(rate/100);
      const netAfterExpenses=stripeData.stripeNet-expenses.total;
      res.json({period,stripe:stripeData,expenses,taxReservePercent:rate,taxReserveEstimate:reserve,netAfterExpenses,disclaimer:'Tax reserve is an owner planning estimate, not a tax calculation or filing amount.'});
    }catch(err){console.error('Accounting summary error:',err);res.status(500).json({error:'Unable to load accounting summary.'});}
  });
  app.put('/api/admin/accounting/settings',requireAdmin,async(req,res)=>{
    try{
      if(!(await ensureSchema())) return res.status(503).json({error:'DATABASE_URL is not configured.'});
      const pct=Math.max(0,Math.min(100,Number(req.body?.taxReservePercent||0)));
      await db().query(`INSERT INTO accounting_settings(setting_key,setting_value,updated_at) VALUES('tax_reserve_percent',$1::jsonb,NOW()) ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_at=NOW()`,[JSON.stringify(pct)]);
      res.json({ok:true,taxReservePercent:pct});
    }catch(err){res.status(500).json({error:'Unable to save accounting settings.'});}
  });
  app.post('/api/admin/accounting/expenses',requireAdmin,async(req,res)=>{
    try{
      if(!(await ensureSchema())) return res.status(503).json({error:'DATABASE_URL is not configured.'});
      const date=clean(req.body?.date,10),category=clean(req.body?.category,80)||'Other',vendor=clean(req.body?.vendor,120),description=clean(req.body?.description,300),amount=Number(req.body?.amount);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(amount)||amount<0) return res.status(400).json({error:'A valid date and amount are required.'});
      const {rows}=await db().query('INSERT INTO accounting_expenses(expense_date,category,vendor,description,amount_cents) VALUES($1,$2,$3,$4,$5) RETURNING id',[date,category,vendor,description,Math.round(amount*100)]);
      res.json({ok:true,id:rows[0].id});
    }catch(err){console.error('Expense save error:',err);res.status(500).json({error:'Unable to save expense.'});}
  });
  app.delete('/api/admin/accounting/expenses/:id',requireAdmin,async(req,res)=>{
    try{if(!(await ensureSchema()))return res.status(503).json({error:'DATABASE_URL is not configured.'});await db().query('DELETE FROM accounting_expenses WHERE id=$1',[req.params.id]);res.json({ok:true});}
    catch(err){res.status(500).json({error:'Unable to delete expense.'});}
  });
}
