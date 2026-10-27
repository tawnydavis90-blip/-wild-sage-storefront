const suppliers = new Set(['eldorado', 'nalpac']);
const events = new Set(['page_view', 'collection_click', 'bag_open']);
const categories = new Set(['Featured', 'Self Care', 'Intimates', 'Accessories', 'For Him']);
function sameOrigin(req) {
  if (!req.headers.origin) return true;
  try { const url = new URL(req.headers.origin); return ['https:', 'http:'].includes(url.protocol) && url.host === req.get('host'); } catch { return false; }
}
export function registerSinSageDashboard(app, { db, adminSession }) {
  const auth = (req, res, next) => adminSession(req) ? next() : res.status(401).json({error:'Admin login required.'});
  let schema;
  function ready() {
    if (!process.env.DATABASE_URL) throw new Error('Database is not configured.');
    if (!schema) schema = db().query(`CREATE TABLE IF NOT EXISTS sin_sage_supplier_notes (supplier TEXT PRIMARY KEY, stage TEXT NOT NULL DEFAULT 'pending', notes TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`).catch(e => { schema = null; throw e; });
    return schema;
  }
  app.post('/api/sin-sage/analytics', async (req,res) => {
    const host = String(req.hostname || '').toLowerCase();
    if (host !== 'singsage.sageandemberholdings.com' && !['localhost','127.0.0.1'].includes(host)) return res.sendStatus(400);
    if (!sameOrigin(req)) return res.sendStatus(403);
    const b = req.body || {};
    if (!events.has(b.type) || !/^[a-zA-Z0-9-]{1,80}$/.test(b.visitorId || '') || !/^[a-zA-Z0-9-]{1,80}$/.test(b.sessionId || '')) return res.sendStatus(400);
    try {
      await db().query(`INSERT INTO core_analytics_events (business_id,session_id,visitor_id,event_name,path,properties) SELECT id,$1,$2,$3,'/', $4::jsonb FROM businesses WHERE slug='sin-and-sage'`, [b.sessionId,b.visitorId,b.type,JSON.stringify({category: categories.has(b.category) ? b.category : null})]);
      res.sendStatus(204);
    } catch(e) { console.error('Sin & Sage analytics:',e.message); res.sendStatus(503); }
  });
  app.get('/api/sin-sage/dashboard', auth, async (_req,res) => {
    res.set('Cache-Control','no-store');
    try {
      await ready();
      const windows = {};
      for (const [key,hours] of [['24h',24],['7d',168],['30d',720],['all',null]]) {
        const q = await db().query(`SELECT COUNT(*) FILTER (WHERE event_name='page_view')::int AS views, COUNT(DISTINCT visitor_id) FILTER (WHERE event_name='page_view')::int AS visitors, COUNT(*) FILTER (WHERE event_name='collection_click')::int AS clicks, COUNT(*) FILTER (WHERE event_name='bag_open')::int AS bags FROM core_analytics_events WHERE business_id=(SELECT id FROM businesses WHERE slug='sin-and-sage') AND ($1::int IS NULL OR occurred_at>=NOW()-$1::int*INTERVAL '1 hour')`,[hours]);
        windows[key] = q.rows[0];
      }
      const [notes,orders,top,started] = await Promise.all([
        db().query('SELECT supplier,stage,notes,updated_at FROM sin_sage_supplier_notes ORDER BY supplier'),
        db().query(`SELECT friendly_order_number,external_order_id,status,fulfillment_status,total,currency,ordered_at FROM orders WHERE business_id=(SELECT id FROM businesses WHERE slug='sin-and-sage') ORDER BY ordered_at DESC LIMIT 50`),
        db().query(`SELECT properties->>'category' AS category,COUNT(*)::int AS clicks FROM core_analytics_events WHERE business_id=(SELECT id FROM businesses WHERE slug='sin-and-sage') AND event_name='collection_click' AND occurred_at>=NOW()-INTERVAL '30 days' GROUP BY properties->>'category' ORDER BY clicks DESC`),
        db().query(`SELECT MIN(occurred_at) AS started FROM core_analytics_events WHERE business_id=(SELECT id FROM businesses WHERE slug='sin-and-sage')`)
      ]);
      res.json({windows,suppliers:notes.rows,orders:orders.rows,collections:top.rows,trackingStarted:started.rows[0]?.started,checkoutEnabled:false,generatedAt:new Date().toISOString()});
    } catch(e) { console.error('Sin & Sage dashboard:',e.message); res.status(503).json({error:'Dashboard data is unavailable. Please refresh to retry.'}); }
  });
  app.put('/api/sin-sage/dashboard/suppliers/:supplier',auth,async(req,res)=>{
    if (!sameOrigin(req)) return res.sendStatus(403);
    if (!suppliers.has(req.params.supplier) || !['pending','paperwork','submitted','approved'].includes(req.body?.stage) || typeof req.body?.notes !== 'string' || req.body.notes.length>4000) return res.status(400).json({error:'Invalid supplier details.'});
    try { await ready(); await db().query(`INSERT INTO sin_sage_supplier_notes(supplier,stage,notes) VALUES($1,$2,$3) ON CONFLICT(supplier) DO UPDATE SET stage=EXCLUDED.stage,notes=EXCLUDED.notes,updated_at=NOW()`,[req.params.supplier,req.body.stage,req.body.notes.trim()]);res.json({ok:true}); }
    catch(e){console.error(e);res.status(503).json({error:'Unable to save supplier notes.'});}
  });
}
