const DEFAULT_STOREFRONT_PRODUCT_NAMES = new Map([
  ['6aaaf4f3332b26efaf03e20a', 'Cosmic Roadtrip Weekender Bag'],
  ['6aaaf4220cca3e76890b9658', 'Midnight Wanderer Weekender Bag'],
  ['6aaaf1499fd6d9606f09cbac', 'Psychedelic Wildflower Weekender Bag'],
  ['6aaaf0be5939e03c7c049fb5', 'Moonlit Mushroom Garden Weekender Bag']
]);

export function storefrontProductTitle(product) {
  return DEFAULT_STOREFRONT_PRODUCT_NAMES.get(String(product?.id || '').trim()) || product?.title || '';
}
