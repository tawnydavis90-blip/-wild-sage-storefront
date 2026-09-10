import 'dotenv/config';
import fs from 'fs/promises';
import pg from 'pg';

const { Client } = pg;
const connectionString = process.env.SAGE_EMBER_DATABASE_URL;

if (!connectionString) {
  console.error('SAGE_EMBER_DATABASE_URL is not configured.');
  process.exit(1);
}

const sql = await fs.readFile(new URL('../database/001_sage_ember_core.sql', import.meta.url), 'utf8');
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');
  console.log('Sage & Ember core database migration completed successfully.');
} catch (error) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('Sage & Ember core database migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
