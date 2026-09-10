import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
const sourceUrl = process.env.DATABASE_URL;
const targetUrl = process.env.SAGE_EMBER_DATABASE_URL;
const migrationKey = 'wild_sage_initial_copy_v1';

if (!sourceUrl || !targetUrl) {
  console.error('DATABASE_URL and SAGE_EMBER_DATABASE_URL must both be configured.');
  process.exit(1);
}

const ssl = { rejectUnauthorized: false };
const source = new Client({ connectionString: sourceUrl, ssl });
const target = new Client({ connectionString: targetUrl, ssl });

const tables = [
  { name: 'accounting_expenses', conflict: ['id'] },
  { name: 'accounting_settings', conflict: ['setting_key'] },
  { name: 'admin_media', conflict: ['id'] },
  { name: 'analytics_events', conflict: ['id'] },
  { name: 'collection_settings', conflict: ['collection_id'] },
  { name: 'product_collection_assignments', conflict: ['product_id'] },
  { name: 'product_merchandising', conflict: ['product_id'] },
  { name: 'store_settings', conflict: ['setting_key'] }
];

function quoteIdent(name) {
  return '"' + String(name).replaceAll('"', '""') + '"';
}

async function copyTable(table) {
  const { rows } = await source.query(`SELECT * FROM ${quoteIdent(table.name)} ORDER BY 1`);
  if (!rows.length) return 0;
  const columns = Object.keys(rows[0]);
  for (const row of rows) {
    const values = columns.map(c => row[c]);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const updates = columns
      .filter(c => !table.conflict.includes(c))
      .map(c => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`)
      .join(', ');
    const sql = `INSERT INTO ${quoteIdent(table.name)} (${columns.map(quoteIdent).join(', ')}) VALUES (${placeholders}) ON CONFLICT (${table.conflict.map(quoteIdent).join(', ')}) DO ${updates ? `UPDATE SET ${updates}` : 'NOTHING'}`;
    await target.query(sql, values);
  }
  return rows.length;
}

try {
  await target.connect();
  const done = await target.query('SELECT 1 FROM data_migration_log WHERE migration_key=$1', [migrationKey]);
  if (done.rowCount) {
    console.log('Wild Sage initial data migration already completed; skipping.');
    process.exit(0);
  }

  await source.connect();
  await target.query('BEGIN');
  const copied = {};
  for (const table of tables) copied[table.name] = await copyTable(table);

  const business = await target.query("SELECT id FROM businesses WHERE slug='wild-sage-apparel'");
  const site = await target.query("SELECT id FROM sites WHERE slug='wild-sage-storefront'");
  if (business.rowCount && site.rowCount) {
    const legacyEvents = await source.query('SELECT * FROM analytics_events ORDER BY id');
    for (const event of legacyEvents.rows) {
      await target.query(
        `INSERT INTO core_analytics_events (business_id,site_id,session_id,visitor_id,event_name,path,referrer,properties,occurred_at)
         VALUES ($1,$2,$3,NULL,$4,NULL,NULL,$5,$6)`,
        [business.rows[0].id, site.rows[0].id, event.session_id, event.event_type,
         { ...(event.metadata || {}), legacy_product_id: event.product_id, legacy_event_id: event.id }, event.created_at]
      );
    }

    const expenses = await source.query('SELECT * FROM accounting_expenses ORDER BY id');
    for (const expense of expenses.rows) {
      await target.query(
        `INSERT INTO expenses (business_id,vendor,category,description,amount,currency,expense_date,metadata,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,'USD',$6,$7,$8,$8)`,
        [business.rows[0].id, expense.vendor, expense.category, expense.description,
         Number(expense.amount_cents || 0) / 100, expense.expense_date,
         { legacy_expense_id: expense.id }, expense.created_at]
      );
    }
  }

  await target.query(
    'INSERT INTO data_migration_log (migration_key, details) VALUES ($1,$2::jsonb)',
    [migrationKey, JSON.stringify({ copied })]
  );

  await target.query("SELECT setval(pg_get_serial_sequence('accounting_expenses','id'), GREATEST(COALESCE((SELECT max(id) FROM accounting_expenses),0),1), true)");
  await target.query("SELECT setval(pg_get_serial_sequence('analytics_events','id'), GREATEST(COALESCE((SELECT max(id) FROM analytics_events),0),1), true)");
  await target.query('COMMIT');
  console.log('Wild Sage data migration completed successfully:', copied);
} catch (error) {
  try { await target.query('ROLLBACK'); } catch {}
  console.error('Wild Sage data migration failed:', error.message);
  process.exitCode = 1;
} finally {
  try { await source.end(); } catch {}
  try { await target.end(); } catch {}
}
