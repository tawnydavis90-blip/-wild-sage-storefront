(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  let catalog = [];
  let settings = new Map();
  let applying = false;
  let lastAppliedSignature = '';

  const baseOpenProduct = window.openProduct;
  if (typeof baseOpenProduct === 'function') {
    window.openProduct = function(product) {
      const item = window.__wildSageMerchandising?.get?.(String(product?.id));
      if (item?.mockups?.length) {
        const custom = item.mockups.map(src => ({ src, variantIds: [], position: 'custom' }));
        product = { ...product, images: [...custom, ...(product.images || [])] };
      }
      return baseOpenProduct(product);
    };
  }

  async function loadData() {
    try {
      const [productsRes, merchRes] = await Promise.all([fetch('/api/products'), fetch('/api/merchandising')]);
      const productsData = await productsRes.json();
      const merchData = await merchRes.json();
      catalog = Array.isArray(productsData.products) ? productsData.products : [];
      settings = new Map((merchData.items || []).map(x => [String(x.productId), x]));
      window.__wildSageProducts = catalog;
      window.__wildSageMerchandising = settings;
      apply(true);
    } catch (err) {
      console.warn('Wild Sage merchandising overrides unavailable:', err);
    }
  }

  function productForCard(card) {
    const title = $('.product-title', card)?.textContent?.trim() || '';
    return catalog.find(p => String(p.title || '').trim() === title) || null;
  }

  function gridSignature() {
    const grid = $('#productGrid');
    if (!grid) return '';
    return $$('.product-card', grid).map(card => {
      const id = card.dataset.productId || '';
      const title = $('.product-title', card)?.textContent?.trim() || '';
      return `${id}:${title}`;
    }).join('|');
  }

  function apply(force=false) {
    if (applying) return;
    const grid = $('#productGrid');
    if (!grid) return;
    const before = gridSignature();
    if (!force && before && before === lastAppliedSignature) return;
    applying = true;
    let changed = false;
    $$('.product-card', grid).forEach(card => {
      const product = productForCard(card);
      if (!product) return;
      const item = settings.get(String(product.id));
      const nextId = String(product.id);
      if (card.dataset.productId !== nextId) { card.dataset.productId = nextId; changed = true; }
      const nextFeatured = item ? (item.featured ? 'true' : 'false') : null;
      const nextBest = item ? (item.bestSeller ? 'true' : 'false') : null;
      if (nextFeatured === null) {
        if (Object.prototype.hasOwnProperty.call(card.dataset,'adminFeatured')) { delete card.dataset.adminFeatured; changed = true; }
      } else if (card.dataset.adminFeatured !== nextFeatured) { card.dataset.adminFeatured = nextFeatured; changed = true; }
      if (nextBest === null) {
        if (Object.prototype.hasOwnProperty.call(card.dataset,'adminBestSeller')) { delete card.dataset.adminBestSeller; changed = true; }
      } else if (card.dataset.adminBestSeller !== nextBest) { card.dataset.adminBestSeller = nextBest; changed = true; }
      if (item?.mockups?.[0]) {
        const img = $('.product-image', card);
        if (img && img.src !== item.mockups[0]) {
          if (!img.dataset.originalSrc) img.dataset.originalSrc = img.src;
          img.src = item.mockups[0];
          changed = true;
        }
      }
    });
    lastAppliedSignature = gridSignature();
    applying = false;
    if (force || changed) window.dispatchEvent(new CustomEvent('wildsage:merchandising-ready'));
  }

  const observer = new MutationObserver(() => setTimeout(() => apply(false), 0));
  const start = () => {
    const grid = $('#productGrid');
    if (grid) observer.observe(grid, {childList:true, subtree:false});
    loadData();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
