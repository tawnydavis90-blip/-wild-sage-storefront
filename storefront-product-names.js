const DEFAULT_STOREFRONT_PRODUCT_NAMES = new Map([
  [
    "6ac4835271fb1b154105587d",
    "Sun Chaser Weekender"
  ],
  [
    "6ac48283a1fed7a1ed06e889",
    "Northern Moon Weekender"
  ],
  [
    "6aaaf4f3332b26efaf03e20a",
    "Cosmic Roadtrip Weekender"
  ],
  [
    "6aaaf4220cca3e76890b9658",
    "Midnight Wanderer Weekender"
  ],
  [
    "6aaaf1499fd6d9606f09cbac",
    "Psychedelic Wildflower Weekender"
  ],
  [
    "6aaaf0be5939e03c7c049fb5",
    "Moonlit Mushroom Garden Weekender"
  ]
]);

export function storefrontProductTitle(product) {
  return DEFAULT_STOREFRONT_PRODUCT_NAMES.get(String(product?.id || '').trim()) || product?.title || '';
}
