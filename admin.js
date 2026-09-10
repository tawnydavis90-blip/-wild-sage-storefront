import crypto from 'crypto';
import pg from 'pg';

const { Pool } = pg;
const COOKIE_NAME = 'wild_sage_admin';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const BUSINESS_ID = process.env.BUSINESS_ID || 'wild-sage-apparel';
const BUSINESS_NAME = process.env.BUSINESS_NAME || 'Wild Sage Apparel';
const PARENT_COMPANY_ID = process.env.PARENT_COMPANY_ID || 'sage-and-ember-holdings';

let pool = null;
let schemaReady = false;

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
    });
  }
  return pool;
}

async function ensureSchema() {
  const db = getPool();
  if (!db) return false;
  if (schemaReady) return true;
  await db.query(`
    CREATE TABLE IF NOT EXISTS product_merchandising (
      product_id TEXT PRIMARY KEY,
      featured BOOLEAN NOT NULL DEFAULT FALSE,
      best_seller BOOLEAN NOT NULL DEFAULT FALSE,
      mockup_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  schemaReady = true;
  return true;
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(v => v.trim()).filter(Boolean).map(part => {
    const i = part.indexOf('=');
    return [decodeURIComponent(part.slice(0, i)), decodeURIComponent(part.slice(i + 1))];
  }));
}

function secret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('hex');
}

function createSessionToken() {
  const payload = `${Date.now() + SESSION_TTL_MS}.${crypto.randomBytes(12).toString('hex')}`;
  return `${payload}.${sign(payload)}`;
}

function validSession(req) {
  if (!secret()) return false;
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = sign(payload);
  const actual = parts[2];
  if (expected.length !== actual.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) return false;
  return Number(parts[0]) > Date.now();
}

function requireAdmin(req, res, next) {
  if (!validSession(req)) return res.status(401).json({ error: 'Admin login required.' });
  next();
}

function requireParentDashboard(req, res, next) {
  const expected = String(process.env.PARENT_DASHBOARD_API_KEY || '');
  if (!expected) return res.status(503).json({ error: 'Parent dashboard integration is not configured.' });
  const auth = String(req.headers.authorization || '');
  const supplied = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const ok = supplied.length === expected.length && supplied.length > 0 && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (!ok) return res.status(401).json({ error: 'Invalid parent dashboard credentials.' });
  next();
}

function sanitizeMockups(value) {
  if (!Array.isArray(value)) return [];
  return value.map(v => String(v || '').trim()).filter(v => /^https?:\/\//i.test(v)).slice(0, 6);
}

async function readOverrides() {
  if (!(await ensureSchema())) return { configured: false, items: [] };
  const { rows } = await getPool().query('SELECT product_id, featured, best_seller, mockup_urls, updated_at FROM product_merchandising ORDER BY updated_at DESC');
  return {
    configured: true,
    items: rows.map(r => ({
      productId: r.product_id,
      featured: Boolean(r.featured),
      bestSeller: Boolean(r.best_seller),
      mockups: Array.isArray(r.mockup_urls) ? r.mockup_urls : [],
      updatedAt: r.updated_at
    }))
  };
}

async function parentSummary() {
  const data = await readOverrides();
  const items = data.items || [];
  return {
    business: {
      id: BUSINESS_ID,
      name: BUSINESS_NAME,
      parentCompanyId: PARENT_COMPANY_ID,
      service: 'storefront',
      version: 1
    },
    databaseConfigured: data.configured,
    merchandising: {
      configuredProducts: items.length,
      featuredProducts: items.filter(x => x.featured).length,
      bestSellerProducts: items.filter(x => x.bestSeller).length,
      customMockupProducts: items.filter(x => Array.isArray(x.mockups) && x.mockups.length > 0).length,
      lastUpdatedAt: items.map(x => x.updatedAt).filter(Boolean).sort().at(-1) || null
    },
    capabilities: ['merchandising.read', 'merchandising.write', 'mockups.read', 'mockups.write']
  };
}

export function registerAdminRoutes(app) {
  app.post('/api/admin/login', (req, res) => {
    const configured = Boolean(process.env.ADMIN_PASSWORD && secret());
    if (!configured) return res.status(503).json({ error: 'Admin login is not configured yet.' });
    const supplied = String(req.body?.password || '');
    const expected = String(process.env.ADMIN_PASSWORD || '');
    const ok = supplied.length === expected.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
    if (!ok) return res.status(401).json({ error: 'Incorrect password.' });
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(createSessionToken())}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`);
    res.json({ ok: true });
  });

  app.post('/api/admin/logout', (_req, res) => {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
    res.json({ ok: true });
  });

  app.get('/api/admin/session', (req, res) => {
    res.json({
      authenticated: validSession(req),
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      adminConfigured: Boolean(process.env.ADMIN_PASSWORD && secret()),
      businessId: BUSINESS_ID,
      parentCompanyId: PARENT_COMPANY_ID
    });
  });

  app.get('/api/business/manifest', (_req, res) => {
    res.json({
      id: BUSINESS_ID,
      name: BUSINESS_NAME,
      parentCompanyId: PARENT_COMPANY_ID,
      service: 'storefront',
      apiVersion: 1,
      parentIntegrationReady: Boolean(process.env.PARENT_DASHBOARD_API_KEY),
      capabilities: ['merchandising', 'custom-mockups'],
      plannedCapabilities: ['orders', 'analytics', 'homepage-content', 'store-settings']
    });
  });

  app.get('/api/integrations/parent/summary', requireParentDashboard, async (_req, res) => {
    try { res.json(await parentSummary()); }
    catch (err) { console.error('Parent dashboard summary error:', err); res.status(500).json({ error: 'Unable to load business summary.' }); }
  });

  app.get('/api/integrations/parent/merchandising', requireParentDashboard, async (_req, res) => {
    try { res.json(await readOverrides()); }
    catch (err) { console.error('Parent merchandising read error:', err); res.status(500).json({ error: 'Unable to load merchandising settings.' }); }
  });

  app.get('/api/merchandising', async (_req, res) => {
    try { res.json(await readOverrides()); }
    catch (err) { console.error('Merchandising read error:', err); res.status(500).json({ error: 'Unable to load merchandising settings.' }); }
  });

  app.get('/api/admin/merchandising', requireAdmin, async (_req, res) => {
    try { res.json(await readOverrides()); }
    catch (err) { console.error('Admin merchandising read error:', err); res.status(500).json({ error: 'Unable to load merchandising settings.' }); }
  });

  app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
    if (!(await ensureSchema())) return res.status(503).json({ error: 'DATABASE_URL is not configured.' });
    const productId = String(req.params.id || '').trim();
    if (!productId) return res.status(400).json({ error: 'Product id is required.' });
    const featured = Boolean(req.body?.featured);
    const bestSeller = Boolean(req.body?.bestSeller);
    const mockups = sanitizeMockups(req.body?.mockups);
    try {
      const { rows } = await getPool().query(`
        INSERT INTO product_merchandising (product_id, featured, best_seller, mockup_urls, updated_at)
        VALUES ($1, $2, $3, $4::jsonb, NOW())
        ON CONFLICT (product_id) DO UPDATE SET
          featured = EXCLUDED.featured,
          best_seller = EXCLUDED.best_seller,
          mockup_urls = EXCLUDED.mockup_urls,
          updated_at = NOW()
        RETURNING product_id, featured, best_seller, mockup_urls, updated_at
      `, [productId, featured, bestSeller, JSON.stringify(mockups)]);
      const row = rows[0];
      res.json({ ok: true, item: { productId: row.product_id, featured: row.featured, bestSeller: row.best_seller, mockups: row.mockup_urls, updatedAt: row.updated_at } });
    } catch (err) {
      console.error('Admin merchandising write error:', err);
      res.status(500).json({ error: 'Unable to save product settings.' });
    }
  });
}
