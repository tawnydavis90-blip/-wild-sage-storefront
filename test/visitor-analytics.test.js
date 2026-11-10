import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { summarizeTraffic } from '../visitor-analytics.js';

test('traffic windows deduplicate returning browsers, preserve legacy visits, and count disjoint sessions', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE analytics_events(event_type TEXT, product_id TEXT, session_id TEXT, visitor_id TEXT, created_at TIMESTAMPTZ, metadata JSONB DEFAULT '{}');
      INSERT INTO analytics_events(event_type,product_id,session_id,visitor_id,created_at) VALUES
      ('page_view',NULL,'a','returning',NOW()),
      ('page_view',NULL,'b','returning',NOW()),
      ('product_view','shirt','c','other',NOW()),
      ('checkout_start',NULL,'legacy',NULL,NOW()-INTERVAL '2 days'),
      ('page_view',NULL,'month','month',NOW()-INTERVAL '10 days'),
      ('page_view',NULL,'old','old',NOW()-INTERVAL '40 days');`);
    const result = await summarizeTraffic(db);
    assert.equal(result.windows['24h'].uniqueVisitors, 2);
    assert.equal(result.windows['24h'].uniqueSessions, 3);
    assert.equal(result.windows['24h'].pageViews, 2);
    assert.equal(result.windows['7d'].uniqueVisitors, 3);
    assert.equal(result.windows['30d'].uniqueVisitors, 4);
    assert.equal(result.windows.all.uniqueVisitors, 5);
    assert.equal(result.windows['7d'].checkoutStarts, 0);
    await db.exec(`INSERT INTO analytics_events VALUES ('add_to_bag','shirt','a','returning',NOW(),'{"trackingVersion":2}'),('checkout_start',NULL,'a','returning',NOW(),'{"trackingVersion":2}'),('add_to_bag','shirt','a','returning',NOW(),'{}');`);
    const verified = await summarizeTraffic(db);
    assert.equal(verified.windows['7d'].checkoutStarts, 1);
    assert.equal(verified.windows['7d'].addToBags, 1);
    assert.equal(verified.windows['7d'].legacyAddToBagClicks, 1);
    assert.deepEqual(result.topProducts, [{productId:'shirt',views:1}]);
  } finally { await db.close(); }
});
