import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;
const connectionString = process.env.SAGE_EMBER_DATABASE_URL;
if (!connectionString) {
  console.error('SAGE_EMBER_DATABASE_URL is not configured.');
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, '..', 'database');
const files = (await fs.readdir(migrationsDir)).filter(f => /^\d+_.*\.sql$/.test(f)).sort();
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('COMMIT');
      console.log(`Applied database migration: ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`${file}: ${error.message}`);
    }
  }
  console.log('Sage & Ember core database migrations completed successfully.');
} catch (error) {
  console.error('Sage & Ember core database migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
