export function autoMatchesCollection(product, collectionId) {
  const id = String(collectionId || '').trim().toLowerCase();
  if (!id || id === 'all') return true;
  const tags = Array.isArray(product?.tags) ? product.tags.join(' ') : '';
  const haystack = `${product?.title || ''} ${tags}`.toLowerCase();
  if (id === 'crops') return /crop|cropped/.test(haystack);
  if (id === 'tanks') return /tank/.test(haystack);
  if (id === 'tees') return /\b(?:tee|t-shirt|shirt)\b/.test(haystack);
  if (id === 'hoodies') return /hoodie|sweatshirt|fleece/.test(haystack);
  if (id === 'fall') return /fall|autumn|halloween|horror/.test(haystack);
  return haystack.includes(id);
}

export function availableCollectionIds(products = [], assignmentItems = [], candidates = []) {
  const assignments = new Map(assignmentItems.map(item => [
    String(item.productId),
    Array.isArray(item.collections) ? item.collections.map(id => String(id).trim().toLowerCase()).filter(Boolean) : []
  ]));
  const ids = new Set(candidates.map(id => String(id).trim().toLowerCase()).filter(id => id && id !== 'all'));
  const available = new Set();
  for (const product of products) {
    const productId = String(product?.id || '');
    if (assignments.has(productId)) {
      for (const id of assignments.get(productId)) if (!ids.size || ids.has(id)) available.add(id);
      continue;
    }
    for (const id of ids) if (autoMatchesCollection(product, id)) available.add(id);
  }
  return [...available];
}
