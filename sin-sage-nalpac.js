import { createNalpacClient, nalpacConfiguration, validateSku, NalpacError } from './nalpac-client.js';
export function registerNalpacRoutes(app, {db, adminSession, client = createNalpacClient(), env = process.env}) {
  const auth = (req,res,next) => { res.set('Cache-Control','no-store'); return adminSession(req) ? next() : res.status(401).json({error:'Admin login required.'}); };
  const origin = (req,res,next) => { try { if (req.headers.origin && new URL(req.headers.origin).host !== req.get('host')) return res.sendStatus(403); } catch { return res.sendStatus(403); } next(); };
  let schema, busy = false;
  async function ready() {
    if (!env.DATABASE_URL) throw new NalpacError('Database is not configured.',503);
    if (!schema) schema = db().query(`CREATE TABLE IF NOT EXISTS sin_sage_nalpac_products (
      sku TEXT NOT NULL, location_id INTEGER NOT NULL, name TEXT NOT NULL, upc TEXT NOT NULL DEFAULT '',
      wholesale NUMERIC, quantity INTEGER, sellable BOOLEAN NOT NULL DEFAULT FALSE, discontinued BOOLEAN NOT NULL DEFAULT FALSE,
      last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), sync_error TEXT,
      PRIMARY KEY(sku,location_id))`).catch(e=>{schema=null;throw e;});
    await schema;
  }
  const error = (res,e) => { if (!(e instanceof NalpacError)) console.error('Nalpac integration database operation failed'); return res.status(e instanceof NalpacError ? e.status : 503).json({error:e instanceof NalpacError ? e.message : 'Nalpac catalog storage is unavailable. Retry later.'}); };
  async function sync(skus) {
    if (busy) throw new NalpacError('A Nalpac import or sync is already running. Retry shortly.',409);
    if (!nalpacConfiguration(env).configured) throw new NalpacError('Configure your Nalpac API credentials in Render first.',503);
    busy = true;
    try {
      await ready(); const location = nalpacConfiguration(env).locationId, results=[];
      for (let i=0;i<skus.length;i+=2) {
        const batch = await Promise.all(skus.slice(i,i+2).map(async sku=>{
          try { const p=await client.product(sku);
            await db().query(`INSERT INTO sin_sage_nalpac_products(sku,location_id,name,upc,wholesale,quantity,sellable,discontinued) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(sku,location_id) DO UPDATE SET name=EXCLUDED.name,upc=EXCLUDED.upc,wholesale=EXCLUDED.wholesale,quantity=EXCLUDED.quantity,sellable=EXCLUDED.sellable,discontinued=EXCLUDED.discontinued,last_synced_at=NOW(),last_attempt_at=NOW(),sync_error=NULL`,[p.sku,location,p.name,p.upc,p.wholesale,p.quantity,p.sellable,p.discontinued]);
            return {sku,ok:true};
          } catch(e) {
            const message=e instanceof NalpacError?e.message:'Catalog storage failed. Retry later.';
            await db().query('UPDATE sin_sage_nalpac_products SET sellable=FALSE,sync_error=$3,last_attempt_at=NOW() WHERE sku=$1 AND location_id=$2',[sku,location,message]);
            return {sku,ok:false,error:message};
          }
        }));results.push(...batch);
      }
      return {results,imported:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length};
    } finally { busy=false; }
  }
  app.get('/api/sin-sage/nalpac',auth,async(_req,res)=>{
    try { await ready(); const location = nalpacConfiguration(env).locationId;
      const q=await db().query('SELECT * FROM sin_sage_nalpac_products WHERE location_id=$1 ORDER BY name LIMIT 200',[location]);
      const count=await db().query('SELECT COUNT(*)::int AS count FROM sin_sage_nalpac_products WHERE location_id=$1',[location]);
      res.json({configuration:nalpacConfiguration(env),products:q.rows,total:count.rows[0].count,busy,checkoutEnabled:false,publishingEnabled:false,orderSubmissionEnabled:false});
    }catch(e){error(res,e);}
  });
  app.post('/api/sin-sage/nalpac/test',auth,origin,async(_req,res)=>{try{res.json(await client.testConnection());}catch(e){error(res,e);}});
  app.post('/api/sin-sage/nalpac/import',auth,origin,async(req,res)=>{
    try { if (!Array.isArray(req.body?.skus) || !req.body.skus.length || req.body.skus.length>10) throw new NalpacError('Import between 1 and 10 Nalpac SKUs at a time.',400);
      const skus=[...new Set(req.body.skus.map(validateSku))];res.json(await sync(skus));
    }catch(e){error(res,e);}
  });
  async function refreshBatch(){ await ready();const q=await db().query('SELECT sku FROM sin_sage_nalpac_products WHERE location_id=$1 ORDER BY last_attempt_at ASC LIMIT 10',[nalpacConfiguration(env).locationId]);return sync(q.rows.map(p=>p.sku)); }
  app.post('/api/sin-sage/nalpac/sync',auth,origin,async(_req,res)=>{try{res.json(await refreshBatch());}catch(e){error(res,e);}});
  // Optional hourly refresh of the 10 least recently checked SKUs. No supplier orders.
  if (env.NALPAC_AUTO_SYNC === 'true' && nalpacConfiguration(env).configured) {
    const timer=setInterval(()=>{refreshBatch().catch(()=>console.error('Nalpac scheduled refresh failed; retry next cycle.'));},3600000);timer.unref();
  }
}
