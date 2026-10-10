const HIDDEN_STOREFRONT_PRODUCT_TITLES = new Set(['sticker sheets']);
const HIDDEN_STOREFRONT_PRODUCT_IDS = new Set([
  // Moonlight Mushroom kiss-cut sticker
  '6aa32cd5f4fa63b37c005985',
  // Moo Crew Tote is unpublished; keep hidden despite inconsistent API visibility.
  '6ac4552d287cd44de30125be'
]);

export function isStorefrontProductVisible(product) {
  if (!product || product.visible !== true) return false;
  if (HIDDEN_STOREFRONT_PRODUCT_IDS.has(String(product.id || '').trim())) return false;
  return !HIDDEN_STOREFRONT_PRODUCT_TITLES.has(String(product.title || '').trim().toLowerCase());
}
