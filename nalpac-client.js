// Nalpac default-version API: https://api2.nalpac.com/Help
// This client intentionally performs GET requests only; it cannot submit orders.
export class NalpacError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}
export function nalpacConfiguration(env = process.env) {
  const username = env.NALPAC_USERNAME || '', password = env.NALPAC_PASSWORD || '';
  const valid = value => /^[\x20-\x7e]+$/.test(value) && !value.includes(':');
  const locationId = Number(env.NALPAC_LOCATION_ID || 15);
  const configured = !!(username && password && valid(username) && valid(password) && [15,25].includes(locationId));
  return { configured, locationId, missing: ['NALPAC_USERNAME','NALPAC_PASSWORD'].filter(key => !env[key]), automaticSync: configured && env.NALPAC_AUTO_SYNC === 'true' };
}
export function validateSku(value) {
  const sku = String(value ?? '').trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(sku)) throw new NalpacError('Enter a valid Nalpac SKU (letters, numbers, dots, hyphens or underscores).',400);
  return sku;
}
export function normalizeNalpacProduct(raw, expectedSku) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || String(raw.Sku ?? '') !== expectedSku || typeof raw.Name !== 'string' || !raw.Name.trim()) throw new NalpacError('Nalpac returned an unexpected product format. No product was imported.');
  const number = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  const quantity = number(raw.AvailableQuantity ?? raw.QuantityOnHand);
  const wholesale = number(raw.WholesalePrice);
  return { sku: expectedSku, name: raw.Name.trim().slice(0,500), upc: String(raw.Upc ?? '').slice(0,80), wholesale, quantity: quantity === null ? null : Math.floor(quantity), sellable: raw.Sellable === true && raw.Discontinued === false && quantity !== null && quantity > 0 && wholesale !== null && wholesale > 0, discontinued: raw.Discontinued === true };
}
export function createNalpacClient({ env = process.env, fetchImpl = fetch } = {}) {
  async function get(path) {
    if (!nalpacConfiguration(env).configured) throw new NalpacError('Nalpac API credentials are missing or invalid. Configure NALPAC_USERNAME and NALPAC_PASSWORD in Render.',503);
    let response;
    try {
      response = await fetchImpl('https://api2.nalpac.com' + path, { method:'GET', redirect:'error', headers:{Accept:'application/json', Authorization:'Basic '+Buffer.from(`${env.NALPAC_USERNAME}:${env.NALPAC_PASSWORD}`,'ascii').toString('base64')}, signal:AbortSignal.timeout(10000) });
    } catch { throw new NalpacError('Nalpac could not be reached. Retry later.'); }
    if (!response.ok) {
      const messages = {401:'Nalpac rejected the API credentials.',403:'Nalpac has not enabled this API permission for the account.',404:'Nalpac could not find this item.',429:'Nalpac is limiting requests. Please retry later.'};
      throw new NalpacError(messages[response.status] || 'Nalpac returned a service error.', response.status === 404 ? 404 : 502);
    }
    try {
      if (Number(response.headers.get('content-length')) > 2000000) throw new Error();
      const text = await response.text(); if (text.length > 2000000) throw new Error();
      return JSON.parse(text);
    } catch { throw new NalpacError('Nalpac returned an unreadable response.'); }
  }
  return {
    async product(value) { const sku = validateSku(value); const location = nalpacConfiguration(env).locationId; return normalizeNalpacProduct(await get(`/api/product/${encodeURIComponent(sku)}?stripDescriptionHTML=true&locationId=${location}`),sku); },
    async testConnection() { const result = await get('/api/carrier'); if (!Array.isArray(result?.Carriers)) throw new NalpacError('Nalpac returned an unexpected carrier response.'); return {ok:true, carrierCount:result.Carriers.length, checkedAt:new Date().toISOString(), permission:'carriers'}; }
  };
}
