import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import Stripe from 'stripe';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerAdminRoutes } from './admin.js';
import { registerProductCollectionRoutes } from './product-collections.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const API_BASE = 'https://api.printify.com/v1';
let resolvedShopId = null;
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
registerAdminRoutes(app);
registerProductCollectionRoutes(app);
app.use(express.static(path.join(__dirname, 'public')));
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

const money = cents => Number(cents || 0) / 100;
const titleCase = s => String(s || '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

async function printify(pathname, options = {}) {
  const token = process.env.PRINTIFY_API_TOKEN;
  if (!token || token === 'replace_me') throw new Error('PRINTIFY_API_TOKEN is not configured');
  const res = await fetch(`${API_BASE}${pathname}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'WildSageApparel/0.1',
      'Content-Type': 'application/json;charset=utf-8',
      ...(options.headers || {})
    }
  });
  const body = await res.text();
  let data;
  try { data = body ? JSON.parse(body) : null; } catch { data = body; }
  if (!res.ok) {
    const err = new Error(`Printify ${res.status}`);
    err.status = res.status;
    err.detail = data;
    throw err;
  }
  return data;
}

async function getShopId() {
  if (resolvedShopId) return resolvedShopId;
  const shops = await printify('/shops.json');
  const list = Array.isArray(shops) ? shops : (shops?.data || []);
  if (!list.length) throw new Error('No Printify shops are available for this token');
  const targetShopName = 'wild sage apparel';
  const shop = list.find(s => String(s.title || s.name || '').trim().replace(/\s+/g, ' ').toLowerCase() === targetShopName);
  if (!shop) {
    const available = list.map(s => s.title || s.name || `Shop ${s.id}`).join(', ');
    throw new Error(`Printify shop "${targetShopName}" was not found. Available shops: ${available}`);
  }
  resolvedShopId = String(shop.id);
  return resolvedShopId;
}

function normalizeProduct(p) {
  const enabled = (p.variants || []).filter(v => v.is_enabled !== false);
  const purchasable = enabled.filter(v => v.is_available !== false);
  const prices = purchasable.map(v => v.price).filter(Number.isFinite);
  const images = (p.images || []).map(i => ({ src: i.src, variantIds: i.variant_ids || [], position: i.position || 'front' }));
  return {
    id: p.id,
    title: p.title,
    description: p.description || '',
    tags: p.tags || [],
    visible: p.visible !== false,
    blueprintId: p.blueprint_id,
    printProviderId: p.print_provider_id,
    minPrice: prices.length ? money(Math.min(...prices)) : 0,
    images,
    variants: enabled.map(v => ({
      id: v.id,
      title: v.title,
      sku: v.sku || '',
      price: money(v.price),
      cost: money(v.cost),
      options: v.options || {},
      available: v.is_available !== false
    }))
  };
}

app.get('/api/health', (_req, res) => res.json({ ok: true, store: process.env.STORE_NAME || 'Wild Sage Apparel' }));

app.get('/api/setup-status', async (_req, res) => {
  const tokenReady = Boolean(process.env.PRINTIFY_API_TOKEN && process.env.PRINTIFY_API_TOKEN !== 'replace_me');
  if (!tokenReady) return res.json({ printifyConnected: false, reason: 'token_missing' });
  try {
    const shopId = await getShopId();
    const shops = await printify('/shops.json');
    const list = Array.isArray(shops) ? shops : (shops?.data || []);
    const shop = list.find(s => String(s.id) === String(shopId)) || list[0];
    res.json({ printifyConnected: true, shopId: String(shopId), shopTitle: shop?.title || shop?.name || 'Printify Shop' });
  } catch (err) {
    res.status(502).json({ printifyConnected: false, reason: 'printify_error', detail: err.detail || err.message });
  }
});

app.get('/api/products', async (_req, res) => {
  const tokenReady = Boolean(process.env.PRINTIFY_API_TOKEN && process.env.PRINTIFY_API_TOKEN !== 'replace_me');
  if (!tokenReady) return res.json({ source: 'demo', products: demoProducts });
  try {
    const shopId = await getShopId();
    const data = await printify(`/shops/${shopId}/products.json?limit=50`);
    const raw = Array.isArray(data) ? data : (data.data || []);
    res.json({ source: 'printify', products: raw.map(normalizeProduct).filter(p => p.visible) });
  } catch (err) {
    console.error(err.detail || err);
    res.status(502).json({ error: 'Unable to load Printify products', detail: err.detail || err.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const shopId = await getShopId();
    const p = await printify(`/shops/${shopId}/products/${encodeURIComponent(req.params.id)}.json`);
    res.json(normalizeProduct(p));
  } catch (err) {
    res.status(err.status || 502).json({ error: 'Unable to load product', detail: err.detail || err.message });
  }
});

app.post('/api/checkout', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe is not configured.' });
  const { items } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Your bag is empty.' });
  try {
    const shopId = await getShopId();
    const lineItems = [];
    const orderItems = [];
    for (const item of items) {
      const product = await printify(`/shops/${shopId}/products/${encodeURIComponent(item.productId)}.json`);
      const variant = (product.variants || []).find(v => String(v.id) === String(item.variantId) && v.is_enabled !== false && v.is_available !== false);
      if (!variant) throw new Error(`A selected option for "${product.title}" is no longer available.`);
      const quantity = Math.max(1, Math.min(10, Number(item.quantity || 1)));
      const image = product.images?.find(i => (i.variant_ids || []).includes(Number(variant.id)))?.src || product.images?.[0]?.src;
      lineItems.push({ price_data: { currency: 'usd', unit_amount: Number(variant.price), product_data: { name: product.title, description: variant.title, ...(image ? { images: [image] } : {}) } }, quantity });
      orderItems.push({ productId: product.id, variantId: Number(variant.id), quantity });
    }
    const origin = process.env.PUBLIC_STORE_URL || `${req.protocol}://${req.get('host')}`;
    const cartId = crypto.randomUUID();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
      shipping_address_collection: { allowed_countries: ['US'] },
      phone_number_collection: { enabled: true },
      billing_address_collection: 'auto',
      customer_creation: 'always',
      client_reference_id: cartId,
      metadata: { cart_id: cartId, printify_items: JSON.stringify(orderItems) }
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(400).json({ error: err.message || 'Unable to start checkout.' });
  }
});

app.post('/api/shipping', async (req, res) => {
  const tokenReady = Boolean(process.env.PRINTIFY_API_TOKEN && process.env.PRINTIFY_API_TOKEN !== 'replace_me');
  if (!tokenReady) return res.status(503).json({ error: 'Connect Printify to calculate live shipping.' });
  const { items, address } = req.body || {};
  if (!Array.isArray(items) || !items.length || !address) return res.status(400).json({ error: 'Cart items and shipping address are required.' });
  try {
    const shopId = await getShopId();
    const payload = { line_items: items.map(x => ({ product_id: x.productId, variant_id: Number(x.variantId), quantity: Math.max(1, Number(x.quantity || 1)) })), address_to: address };
    const rates = await printify(`/shops/${shopId}/orders/shipping.json`, { method: 'POST', body: JSON.stringify(payload) });
    res.json(rates);
  } catch (err) {
    res.status(err.status || 502).json({ error: 'Shipping calculation failed', detail: err.detail || err.message });
  }
});

app.post('/api/orders', async (req, res) => {
  const { items, address, payment } = req.body || {};
  if (!payment?.verified || !payment?.reference) return res.status(402).json({ error: 'Verified payment is required before fulfillment.' });
  if (!Array.isArray(items) || !items.length || !address) return res.status(400).json({ error: 'Cart items and shipping address are required.' });
  try {
    const shopId = await getShopId();
    const externalId = payment.reference || crypto.randomUUID();
    const payload = {
      external_id: externalId,
      label: `Wild Sage ${externalId.slice(-8)}`,
      line_items: items.map(x => ({ product_id: x.productId, variant_id: Number(x.variantId), quantity: Math.max(1, Number(x.quantity || 1)) })),
      shipping_method: Number(req.body.shippingMethod || 1),
      send_shipping_notification: true,
      address_to: address
    };
    const order = await printify(`/shops/${shopId}/orders.json`, { method: 'POST', body: JSON.stringify(payload) });
    res.status(201).json(order);
  } catch (err) {
    res.status(err.status || 502).json({ error: 'Order creation failed', detail: err.detail || err.message });
  }
});

app.post('/api/webhooks/printify', (req, res) => {
  console.log('Printify webhook:', req.body?.type || req.body?.topic || 'event');
  res.sendStatus(200);
});

app.get('/*splat', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const demoProducts = [
  { id: 'demo-5083', title: 'Same Soul • Higher Standards Crop', description: 'A cropped Wild Sage staple with bold black linework and a soft, lived-in feel.', tags: ['Crops','New Drop'], visible: true, minPrice: 34, images: [{ src: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80', variantIds: [], position: 'front' }], variants: [{ id: 101, title: 'Black / S', price: 34, available: true }, { id: 102, title: 'Black / M', price: 34, available: true }, { id: 103, title: 'Bone / M', price: 34, available: false }] },
  { id: 'demo-psy', title: 'Mushroom Moon Tank', description: 'Psychedelic botanical linework made for layering, festivals, and late nights.', tags: ['Tanks','Psychedelic'], visible: true, minPrice: 30, images: [{ src: 'https://images.unsplash.com/photo-1583743814966-8936f37f4ec7?auto=format&fit=crop&w=900&q=80', variantIds: [], position: 'front' }], variants: [{ id: 201, title: 'White / S', price: 30, available: true }, { id: 202, title: 'Black / M', price: 30, available: true }] },
  { id: 'demo-horror', title: 'Beautifully Broken Hoodie', description: 'Dark hippie energy with a horror edge. Oversized attitude, soft fleece.', tags: ['Hoodies','Dark Hippie'], visible: true, minPrice: 56, images: [{ src: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=80', variantIds: [], position: 'front' }], variants: [{ id: 301, title: 'Black / M', price: 56, available: true }, { id: 302, title: 'Black / L', price: 56, available: true }] }
];

app.listen(PORT, () => console.log(`Wild Sage storefront running at http://localhost:${PORT}`));
