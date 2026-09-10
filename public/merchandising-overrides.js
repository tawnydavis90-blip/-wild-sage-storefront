(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  let catalog = [];
  let settings = new Map();
  let applying = false;

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
      apply();
    } catch (err) {
      console.warn('Wild Sage merchandising overrides unavailable:', err);
    }
  }

  function productForCard(card) {
    const title = $('.product-title', card)?.textContent?.trim() || '';
    return catalog.find(p => String(p.title || '').trim() === title) || null;
  }

  function apply() {
    if (applying) return;
    const grid = $('#productGrid');
    if (!grid) return;
    applying = true;
    $$('.product-card', grid).forEach(card => {
      const product = productForCard(card);
      if (!product) return;
      const item = settings.get(String(product.id));
      card.dataset.productId = String(product.id);
      if (item) {
        card.dataset.adminFeatured = item.featured ? 'true' : 'false';
        card.dataset.adminBestSeller = item.bestSeller ? 'true' : 'false';
      } else {
        delete card.dataset.adminFeatured;
        delete card.dataset.adminBestSeller;
      }
      if (item?.mockups?.[0]) {
        const img = $('.product-image', card);
        if (img) img.src = item.mockups[0];
      }
    });
    applying = false;
    window.dispatchEvent(new CustomEvent('wildsage:merchandising-ready'));
  }

  const observer = new MutationObserver(() => setTimeout(apply, 0));
  const start = () => {
    const grid = $('#productGrid');
    if (grid) observer.observe(grid, {childList:true, subtree:false});
    loadData();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
