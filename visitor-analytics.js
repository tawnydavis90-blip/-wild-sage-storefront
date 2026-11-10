export async function summarizeTraffic(db) {
  const windows = {};
  for (const [key, hours] of [['24h', 24], ['7d', 168], ['30d', 720], ['all', null]]) {
    const { rows } = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE event_type='page_view')::int AS "pageViews",
        COUNT(*) FILTER (WHERE event_type='product_view')::int AS "productViews",
        COUNT(*) FILTER (WHERE event_type='add_to_bag' AND metadata->>'trackingVersion'='2')::int AS "addToBags",
        COUNT(*) FILTER (WHERE event_type='checkout_start' AND metadata->>'trackingVersion'='2')::int AS "checkoutStarts",
        COUNT(*) FILTER (WHERE event_type='add_to_bag' AND COALESCE(metadata->>'trackingVersion','1')<>'2')::int AS "legacyAddToBagClicks",
        COUNT(DISTINCT NULLIF(session_id,''))::int AS "uniqueSessions",
        COUNT(DISTINCT COALESCE('visitor:' || NULLIF(visitor_id,''), 'session:' || NULLIF(session_id,'')))::int AS "uniqueVisitors"
      FROM analytics_events
      WHERE ($1::int IS NULL OR created_at >= NOW() - $1::int * INTERVAL '1 hour')
    `, [hours]);
    windows[key] = rows[0];
  }
  const top = await db.query(`SELECT product_id,COUNT(*)::int AS views FROM analytics_events WHERE event_type='product_view' AND product_id IS NOT NULL AND created_at>=NOW()-INTERVAL '30 days' GROUP BY product_id ORDER BY views DESC LIMIT 10`);
  return { configured: true, windows, topProducts: top.rows.map(r => ({ productId: r.product_id, views: r.views })) };
}
