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
  const toteUpdate=await client.query("INSERT INTO storefront_content_updates(update_key) VALUES('moo_crew_bags_20261010_v1') ON CONFLICT DO NOTHING RETURNING update_key");
  if(toteUpdate.rowCount){
    await client.query(`INSERT INTO product_display_names(product_id,display_name,storefront_description) VALUES($1,$2,$3)
      ON CONFLICT(product_id) DO UPDATE SET display_name=CASE WHEN product_display_names.display_name='' THEN EXCLUDED.display_name ELSE product_display_names.display_name END`,
      ['6ac4552d287cd44de30125be','Moo Crew Tote','A little purple-cow personality for your everyday adventures. Our seated Moo Crew mascot adds a playful touch to a durable polyester tote, available in three sizes with cotton handles and a laminated lining.']);
    await client.query(`INSERT INTO collection_settings(collection_id,label,enabled,sort_order) VALUES('bags','Bags',TRUE,6) ON CONFLICT DO NOTHING`);
    for(const id of ['6ac4552d287cd44de30125be',...items.map(item=>item.productId)]){
      await client.query(`INSERT INTO product_collection_assignments(product_id,collection_ids) VALUES($1,'["bags"]'::jsonb)
        ON CONFLICT(product_id) DO UPDATE SET collection_ids=CASE WHEN product_collection_assignments.collection_ids ? 'bags' THEN product_collection_assignments.collection_ids ELSE product_collection_assignments.collection_ids || '["bags"]'::jsonb END,updated_at=NOW()`,[id]);
    }
    console.log('Published Moo Crew Tote name and Bags assignments.');
  }
  await client.query('COMMIT');
  console.log(claimed.rowCount?'Published six weekender names and mockups.':'Weekender update already applied; preserving dashboard edits.');
} catch (error) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('Weekender publication failed:',error.message);
  process.exitCode=1;
} finally { await client.end(); }
