(() => {
  const productCache = new Map();
  let catalogLoaded = false;

  async function loadCatalog() {
    if (catalogLoaded) return;
    catalogLoaded = true;
    try {
      const res = await fetch('/api/products', { headers: { Accept: 'application/json' } });
      const data = await res.json();
      const products = Array.isArray(data?.products) ? data.products : [];
      products.forEach(p => {
        const title = String(p?.title || '').trim();
        const urls = [...new Set((p?.images || []).map(i => i?.src).filter(Boolean))];
        if (title) productCache.set(title, urls);
      });
    } catch (err) {
      console.warn('Image fallback catalog unavailable:', err);
    }
  }

  function cardTitle(img) {
    const card = img.closest('.product-card');
    return card?.querySelector('.product-title')?.textContent?.trim() || '';
  }

  function dialogTitle(img) {
    return img.closest('#productDialogContent')?.querySelector('h2')?.textContent?.trim() || '';
  }

  function candidatesFor(img) {
    const title = cardTitle(img) || dialogTitle(img);
    const urls = productCache.get(title) || [];
    const customFallback = img.dataset.originalSrc ? [img.dataset.originalSrc] : [];
    return [...new Set([...customFallback, ...urls])].filter(Boolean);
  }

  function showPlaceholder(img) {
    const wrap = img.closest('.product-image-wrap, .main-image-frame');
    if (!wrap) {
      img.style.visibility = 'hidden';
      return;
    }
    img.remove();
    if (wrap.querySelector('.image-fallback-placeholder')) return;
    const ph = document.createElement('div');
    ph.className = 'image-fallback-placeholder';
    ph.innerHTML = '<span>WILD SAGE</span><small>Image coming soon</small>';
    wrap.appendChild(ph);
  }

  async function recover(img) {
    if (!(img instanceof HTMLImageElement)) return;
    await loadCatalog();
    const tried = new Set((img.dataset.triedSources || '').split('|').filter(Boolean));
    if (img.currentSrc) tried.add(img.currentSrc);
    if (img.src) tried.add(img.src);
    const next = candidatesFor(img).find(src => !tried.has(src));
    img.dataset.triedSources = [...tried].join('|');
    if (next) {
      img.src = next;
      return;
    }
    showPlaceholder(img);
  }

  document.addEventListener('error', event => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;
    if (!img.matches('.product-image, #dialogMainImage, .product-thumb img')) return;
    recover(img);
  }, true);

  const rememberOriginals = () => {
    document.querySelectorAll('.product-image').forEach(img => {
      if (!img.dataset.originalSrc && img.src) img.dataset.originalSrc = img.src;
    });
  };

  const observer = new MutationObserver(rememberOriginals);
  const start = () => {
    rememberOriginals();
    loadCatalog();
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
