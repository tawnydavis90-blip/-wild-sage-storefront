import pg from 'pg';

const { Pool } = pg;
let pool = null;
let ready = false;

function db(){
  if(!process.env.DATABASE_URL)return null;
  if(!pool)pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined});
  return pool;
}

async function schema(){
  if(!db())return false;
  if(ready)return true;
  await db().query(`
    CREATE TABLE IF NOT EXISTS hidden_storefront_orders (
      stripe_session_id TEXT PRIMARY KEY,
      hidden_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  ready=true;
  return true;
}

export function isCheckoutSessionId(value){
  return /^cs_(?:live|test)_[A-Za-z0-9]+$/.test(String(value||''));
}

export async function hiddenOrderIds(){
  try{
    if(!(await schema()))return new Set();
    const {rows}=await db().query('SELECT stripe_session_id FROM hidden_storefront_orders');
    return new Set(rows.map(row=>String(row.stripe_session_id)));
  }catch(error){
    console.error('Unable to load hidden dashboard orders:',error);
    return new Set();
  }
}

export async function hideOrder(sessionId){
  if(!isCheckoutSessionId(sessionId))throw new Error('Invalid Stripe checkout session.');
  if(!(await schema()))return false;
  await db().query(
    `INSERT INTO hidden_storefront_orders(stripe_session_id,hidden_at)
     VALUES($1,NOW())
     ON CONFLICT(stripe_session_id) DO UPDATE SET hidden_at=NOW()`,
    [sessionId]
  );
  return true;
}
