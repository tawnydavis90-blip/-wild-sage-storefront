export function availableCollectionIds(products = [], assignmentItems = [], candidates = []) {
  const assignments = new Map(assignmentItems.map(item => [
    String(item.productId),
    Array.isArray(item.collections) ? item.collections.map(id => String(id).trim().toLowerCase()).filter(Boolean) : []
  ]));
  const ids = new Set(candidates.map(id => String(id).trim().toLowerCase()).filter(id => id && id !== 'all'));
  const available = new Set();
  for (const product of products) {
    const productId = String(product?.id || '');
    if (!assignments.has(productId)) continue;
    for (const id of assignments.get(productId)) if (!ids.size || ids.has(id)) available.add(id);
  }
  return [...available];
}
