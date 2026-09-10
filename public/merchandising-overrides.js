(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  let catalog = [];
  let settings = new Map();
  let applying = false;

  async function loadData() {
    try {
      const [productsRes, merchRes] = await Promise.all([fetch('/api/products'), fetch('/api/merchandising')]);
      const productsData = await productsRes.json();
      const merchData = await merchRes.json();
      catalog = Array.isArray(productsData.products) ? productsData.products : [];
      settings = new Map((merchData.items || []).map(x => [String(x.productId), x]));
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
    if (!grid || !settings.size) return;
    applying = true;
    $$('.product-card', grid).forEach(card => {
      const product = productForCard(card);
      if (!product) return;
      const item = settings.get(String(product.id));
      card.dataset.productId = String(product.id);
      card.dataset.adminFeatured = item?.featured ? 'true' : 'false';
      card.dataset.adminBestSeller = item?.bestSeller ? 'true' : 'false';
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
