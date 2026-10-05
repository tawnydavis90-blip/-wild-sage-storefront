const HIDDEN_STOREFRONT_PRODUCT_TITLES = new Set(['sticker sheets']);
const HIDDEN_STOREFRONT_PRODUCT_IDS = new Set([
  // Moonlight Mushroom kiss-cut sticker
  '6aa32cd5f4fa63b37c005985'
]);

export function isStorefrontProductVisible(product) {
  if (!product || product.visible === false) return false;
  if (HIDDEN_STOREFRONT_PRODUCT_IDS.has(String(product.id || '').trim())) return false;
  return !HIDDEN_STOREFRONT_PRODUCT_TITLES.has(String(product.title || '').trim().toLowerCase());
}
