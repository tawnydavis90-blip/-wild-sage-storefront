import 'dotenv/config';
import fs from 'node:fs/promises';
import pg from 'pg';

// Apply this approved product update once; later dashboard edits stay intact.
const items = JSON.parse(await fs.readFile(new URL('./weekender-launch.json', import.meta.url), 'utf8'));
const client = new pg.Client({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined});
try {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to publish weekender products.');
  await client.connect();
  await client.query('BEGIN');
  await client.query('CREATE TABLE IF NOT EXISTS storefront_content_updates (update_key TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  const claimed = await client.query("INSERT INTO storefront_content_updates(update_key) VALUES('weekender_mockups_20261006_v1') ON CONFLICT DO NOTHING RETURNING update_key");
  if (claimed.rowCount) {
    for (const item of items) {
      await client.query(`INSERT INTO product_display_names(product_id,display_name) VALUES($1,$2)
        ON CONFLICT(product_id) DO UPDATE SET display_name=EXCLUDED.display_name,updated_at=NOW()`,[item.productId,item.name]);
      await client.query(`INSERT INTO product_merchandising(product_id,mockup_urls,mockup_map) VALUES($1,$2::jsonb,$3::jsonb)
        ON CONFLICT(product_id) DO UPDATE SET
          mockup_urls=EXCLUDED.mockup_urls,
          mockup_map=jsonb_set(COALESCE(product_merchandising.mockup_map,'{}'::jsonb),'{main}',COALESCE(product_merchandising.mockup_map->'main','{}'::jsonb)||(EXCLUDED.mockup_map->'main')),
          updated_at=NOW()`,[item.productId,JSON.stringify([item.url]),JSON.stringify({main:{front:item.url},colors:{}})]);
    }
  }
  await client.query('COMMIT');
  console.log(claimed.rowCount?'Published six weekender names and mockups.':'Weekender update already applied; preserving dashboard edits.');
} catch (error) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('Weekender publication failed:',error.message);
  process.exitCode=1;
} finally { await client.end(); }
