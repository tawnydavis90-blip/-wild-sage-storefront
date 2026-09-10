const API_BASE = 'https://api.printify.com/v1';
let cachedShopId = null;

async function api(pathname, options = {}) {
  const token = process.env.PRINTIFY_API_TOKEN;
  if (!token || token === 'replace_me') throw new Error('PRINTIFY_API_TOKEN is not configured');
  const res = await fetch(`${API_BASE}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'WildSageApparel/0.1',
      'Content-Type': 'application/json;charset=utf-8',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error(`Printify ${res.status}`);
    err.status = res.status;
    err.detail = data;
    throw err;
  }
  return data;
}

export function printifyConfigured() {
  return Boolean(process.env.PRINTIFY_API_TOKEN && process.env.PRINTIFY_API_TOKEN !== 'replace_me');
}

export async function getPrintifyShopId() {
  if (cachedShopId) return cachedShopId;
  const shops = await api('/shops.json');
  const list = Array.isArray(shops) ? shops : (shops?.data || []);
  const target = list.find(s => String(s.title || s.name || '').trim().replace(/\s+/g, ' ').toLowerCase() === 'wild sage apparel');
  if (!target) throw new Error('Wild Sage Apparel Printify shop was not found.');
  cachedShopId = String(target.id);
  return cachedShopId;
}

export async function listPrintifyOrders(maxPages = 5) {
  if (!printifyConfigured()) return [];
  const shopId = await getPrintifyShopId();
  const all = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const data = await api(`/shops/${shopId}/orders.json?limit=100&page=${page}`);
    const rows = Array.isArray(data) ? data : (data?.data || []);
    all.push(...rows);
    if (Array.isArray(data) || rows.length < 100) break;
    const current = Number(data?.current_page || page);
    const last = Number(data?.last_page || current);
    if (current >= last) break;
  }
  return all;
}

function cents(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n / 100 : 0;
}

function shipmentInfo(s = {}) {
  return {
    carrier: s.carrier || s.provider || '',
    service: s.service || s.method || '',
    trackingNumber: s.number || s.tracking_number || s.tracking || '',
    trackingUrl: s.url || s.tracking_url || '',
    status: s.status || '',
    shippedAt: s.shipped_at || s.created_at || null,
    deliveredAt: s.delivered_at || null
  };
}

export function normalizePrintifyOrder(order) {
  if (!order) return null;
  const items = Array.isArray(order.line_items) ? order.line_items : [];
  const itemCostFromLines = items.reduce((sum, item) => {
    const qty = Math.max(1, Number(item.quantity || 1));
    const unit = Number(item.cost ?? item.price ?? 0);
    return sum + (Number.isFinite(unit) ? unit * qty : 0);
  }, 0) / 100;
  const productCost = order.total_price != null ? cents(order.total_price) : itemCostFromLines;
  const shippingCost = cents(order.total_shipping);
  const taxCost = cents(order.total_tax);
  const discount = cents(order.total_discount);
  const totalCost = Math.max(0, productCost + shippingCost + taxCost - discount);
  return {
    id: String(order.id || ''),
    externalId: String(order.external_id || ''),
    status: String(order.status || ''),
    createdAt: order.created_at || null,
    sentToProductionAt: order.sent_to_production_at || null,
    fulfilledAt: order.fulfilled_at || null,
    productCost,
    shippingCost,
    taxCost,
    discount,
    totalCost,
    shipments: (order.shipments || []).map(shipmentInfo),
    items: items.map(item => ({
      productId: String(item.product_id || ''),
      variantId: String(item.variant_id || ''),
      quantity: Number(item.quantity || 0),
      status: String(item.status || ''),
      cost: cents(item.cost),
      shippingCost: cents(item.shipping_cost),
      printProviderId: String(item.print_provider_id || '')
    }))
  };
}

export async function findPrintifyOrderByExternalId(externalId) {
  if (!externalId || !printifyConfigured()) return null;
  const orders = await listPrintifyOrders();
  const raw = orders.find(o => String(o.external_id || '') === String(externalId));
  return normalizePrintifyOrder(raw);
}

export async function printifyCostMapForExternalIds(ids) {
  const wanted = new Set((ids || []).map(String).filter(Boolean));
  const map = new Map();
  if (!wanted.size || !printifyConfigured()) return map;
  const orders = await listPrintifyOrders();
  for (const raw of orders) {
    const externalId = String(raw.external_id || '');
    if (wanted.has(externalId)) map.set(externalId, normalizePrintifyOrder(raw));
  }
  return map;
}
