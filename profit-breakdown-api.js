import crypto from 'crypto';
import Stripe from 'stripe';
import pg from 'pg';

const {Pool}=pg;
let pool;
const stripe=process.env.STRIPE_SECRET_KEY?new Stripe(process.env.STRIPE_SECRET_KEY):null;
const PRINTIFY_API='https://api.printify.com/v1';
let shopIdCache=null;

function db(){if(!pool){pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined});}return pool;}
function cookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(v=>v.trim()).filter(Boolean).map(part=>{const i=part.indexOf('=');return[decodeURIComponent(part.slice(0,i)),decodeURIComponent(part.slice(i+1))]}));}
function safeEqual(a,b){a=String(a||'');b=String(b||'');return a.length===b.length&&a.length>0&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));}
function adminSession(req){const secret=String(process.env.ADMIN_SESSION_SECRET||process.env.ADMIN_PASSWORD||'');if(!secret)return false;const token=cookies(req).wild_sage_admin;if(!token)return false;const parts=token.split('.');if(parts.length!==3)return false;const payload=`${parts[0]}.${parts[1]}`,expected=crypto.createHmac('sha256',secret).update(payload).digest('hex');return safeEqual(parts[2],expected)&&Number(parts[0])>Date.now();}
function requireAdmin(req,res,next){if(adminSession(req))return next();return res.status(401).json({error:'Unauthorized'});}
const dollars=c=>Number(c||0)/100;

async function printify(pathname){const token=process.env.PRINTIFY_API_TOKEN;if(!token)return null;const r=await fetch(`${PRINTIFY_API}${pathname}`,{headers:{Authorization:`Bearer ${token}`,'User-Agent':'SageEmberHQ/1.0'}});if(!r.ok)return null;return r.json();}
async function shopId(){if(shopIdCache)return shopIdCache;const d=await printify('/shops.json');const shops=Array.isArray(d)?d:(d?.data||[]);const match=shops.find(s=>String(s.title||s.name||'').trim().replace(/\s+/g,' ').toLowerCase()==='wild sage apparel')||shops[0];shopIdCache=match?String(match.id):null;return shopIdCache;}
async function printifyOrders(){const id=await shopId();if(!id)return[];const d=await printify(`/shops/${id}/orders.json?limit=100`);return Array.isArray(d)?d:(d?.data||[]);}
function printifyCosts(order){if(!order)return{product:0,shipping:0,tax:0,total:0,available:false};const product=dollars(order.total_price),shipping=dollars(order.total_shipping),tax=dollars(order.total_tax||order.total_vat),totalRaw=Number(order.total||0),total=totalRaw?dollars(totalRaw):product+shipping+tax;return{product,shipping,tax,total,available:true};}
async function paymentEconomics(session){let fee=0,refunded=0;try{let pi=session.payment_intent;if(!pi)return{fee,refunded};if(typeof pi==='string')pi=await stripe.paymentIntents.retrieve(pi,{expand:['latest_charge.balance_transaction']});const charge=pi.latest_charge;if(!charge)return{fee,refunded};refunded=dollars(charge.amount_refunded||0);const bt=typeof charge.balance_transaction==='object'?charge.balance_transaction:null;if(bt&&Number.isFinite(bt.fee))fee=dollars(bt.fee);else if(typeof charge.balance_transaction==='string'){const row=await stripe.balanceTransactions.retrieve(charge.balance_transaction);fee=dollars(row.fee);}return{fee,refunded};}catch{return{fee,refunded};}}
function validMonth(v){return /^\d{4}-\d{2}$/.test(String(v||''));}
function validYear(v){const y=Number(v);return Number.isInteger(y)&&y>=2020&&y<=2100;}
function emptyTotals(){return{customerPaid:0,shippingCollected:0,refunds:0,stripeFee:0,stripeNet:0,printifyProductCost:0,printifyShippingCost:0,printifyTaxCost:0,printifyTotalCost:0,profitBeforeOverhead:0};}
function addTotals(a,r){a.customerPaid+=r.customerPaid;a.shippingCollected+=r.shippingCollected;a.refunds+=r.refunds;a.stripeFee+=r.stripeFee;a.stripeNet+=r.stripeNet;a.printifyProductCost+=r.printifyProductCost;a.printifyShippingCost+=r.printifyShippingCost;a.printifyTaxCost+=r.printifyTaxCost;a.printifyTotalCost+=r.printifyTotalCost;a.profitBeforeOverhead+=r.profitBeforeOverhead;return a;}
async function allRows(){if(!stripe)throw new Error('Stripe is not configured');const sessions=await stripe.checkout.sessions.list({limit:100,expand:['data.payment_intent']});const pOrders=await printifyOrders(),byExternal=new Map(pOrders.map(o=>[String(o.external_id||''),o])),rows=[];for(const s of sessions.data){if(s.payment_status!=='paid'||String(s.id||'').startsWith('cs_test_')||s.metadata?.wild_sage_test==='true'||s.metadata?.do_not_fulfill==='true')continue;const created=new Date(Number(s.created)*1000),customerPaid=dollars(s.amount_total),shippingCollected=dollars(s.total_details?.amount_shipping||0),econ=await paymentEconomics(s),pf=printifyCosts(byExternal.get(String(s.id))),stripeNet=customerPaid-econ.refunded-econ.fee,profitBeforeOverhead=customerPaid-econ.refunded-econ.fee-pf.total;rows.push({sessionId:s.id,orderReference:s.client_reference_id||s.id,createdAt:created.toISOString(),month:created.toISOString().slice(0,7),customer:s.customer_details?.name||'',email:s.customer_details?.email||s.customer_email||'',customerPaid,shippingCollected,refunds:econ.refunded,stripeFee:econ.fee,stripeNet,printifyProductCost:pf.product,printifyShippingCost:pf.shipping,printifyTaxCost:pf.tax,printifyTotalCost:pf.total,printifyCostAvailable:pf.available,profitBeforeOverhead});}return rows;}
async function breakdown(month){const rows=(await allRows()).filter(r=>r.month===month),totals=rows.reduce(addTotals,emptyTotals());return{month,orders:rows,totals,missingPrintifyCosts:rows.filter(r=>!r.printifyCostAvailable).length};}
async function annualBreakdown(year){const rows=(await allRows()).filter(r=>String(r.createdAt).slice(0,4)===String(year)),totals=rows.reduce(addTotals,emptyTotals()),months=[];for(let m=1;m<=12;m++){const key=`${year}-${String(m).padStart(2,'0')}`,mr=rows.filter(r=>r.month===key);months.push({month:key,orders:mr.length,totals:mr.reduce(addTotals,emptyTotals())});}return{year,orders:rows,months,totals,missingPrintifyCosts:rows.filter(r=>!r.printifyCostAvailable).length};}

export function registerProfitBreakdownRoutes(app){
 app.get('/api/holding/profit-breakdown',requireAdmin,async(req,res)=>{try{const month=validMonth(req.query.month)?String(req.query.month):new Date().toISOString().slice(0,7);res.json(await breakdown(month));}catch(e){res.status(500).json({error:'Unable to calculate profit breakdown',detail:e.message});}});
 app.get('/api/holding/profit-breakdown/year',requireAdmin,async(req,res)=>{try{const year=validYear(req.query.year)?Number(req.query.year):new Date().getFullYear();res.json(await annualBreakdown(year));}catch(e){res.status(500).json({error:'Unable to calculate annual profit breakdown',detail:e.message});}});
}
