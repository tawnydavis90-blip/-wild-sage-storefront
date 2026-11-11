(() => {
  const size = /^(?:XXS|XS|S|M|L|XL|XXL|XXXL|[2-6]XL|[0-9]{1,2}(?:\.[0-9])?|ONE SIZE)$/i;
  function front(map, title) {
    const parts = String(title || '').split(/\s*\/\s*|\s+-\s+/).map(s => s.trim()).filter(Boolean);
    if (parts.length && size.test(parts[0])) parts.shift();
    else if (parts.length && size.test(parts.at(-1))) parts.pop();
    const color = parts.join(' / ').toLowerCase();
    const match = Object.entries(map?.colors || {}).find(([name]) => name.trim().toLowerCase() === color);
    return match?.[1]?.front || map?.main?.front || '';
  }
  function forProduct(product, variantId) {
    const variant = product?.variants?.find(v => String(v.id) === String(variantId));
    return front(product?.customMockups, variant?.title)
      || (variant && product?.images?.find(i => (i.variantIds || []).some(id => String(id) === String(variantId)))?.src)
      || product?.images?.find(i => String(i.position || '').toLowerCase().includes('front'))?.src
      || product?.images?.[0]?.src || '';
  }
  window.wildSageCartThumbnail = {front, forProduct};
})();
