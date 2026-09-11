(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  let catalog = [];
  let settings = new Map();
  let applying = false;
  let lastAppliedSignature = '';

  const decorateProduct=(product,item)=>{
    if(!product||!item)return product;
    const map=item.mockupMap||{main:{},colors:{}};
    const legacy=Array.isArray(item.mockups)?item.mockups:[];
    const mainFront=map.main?.front||legacy[0]||'';
    const mainBack=map.main?.back||legacy[1]||'';
    const customMockups={main:{front:mainFront,back:mainBack},colors:map.colors||{}};
    const custom=[];
    if(mainFront)custom.push({src:mainFront,variantIds:[],position:'custom-front'});
    if(mainBack)custom.push({src:mainBack,variantIds:[],position:'custom-back'});
    return {...product,customMockups,images:[...custom,...(product.images||[])]};
  };
  window.__wildSageDecorateProduct=decorateProduct;

  const baseOpenProduct = window.openProduct;
  if (typeof baseOpenProduct === 'function') {
    window.openProduct = function(product) {
      const item = window.__wildSageMerchandising?.get?.(String(product?.id));
      return baseOpenProduct(decorateProduct(product,item));
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
    const id = String(card?.dataset?.productId || '').trim();
    if (id) return catalog.find(p => String(p.id) === id) || null;
    const title = $('.product-title', card)?.textContent?.trim() || '';
    const matches = catalog.filter(p => String(p.title || '').trim() === title);
    return matches.length === 1 ? matches[0] : null;
  }

  function gridSignature() {
    const grid = $('#productGrid');
    if (!grid) return '';
    return $$('.product-card', grid).map(card => `${card.dataset.productId || ''}:${$('.product-title', card)?.textContent?.trim() || ''}`).join('|');
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
      const nextFeatured = item ? (item.featured ? 'true' : 'false') : null;
      const nextBest = item ? (item.bestSeller ? 'true' : 'false') : null;
      if (nextFeatured === null) { if ('adminFeatured' in card.dataset) { delete card.dataset.adminFeatured; changed = true; } }
      else if (card.dataset.adminFeatured !== nextFeatured) { card.dataset.adminFeatured = nextFeatured; changed = true; }
      if (nextBest === null) { if ('adminBestSeller' in card.dataset) { delete card.dataset.adminBestSeller; changed = true; } }
      else if (card.dataset.adminBestSeller !== nextBest) { card.dataset.adminBestSeller = nextBest; changed = true; }
      const customFront=item?.mockupMap?.main?.front||item?.mockups?.[0];
      if (customFront) {
        const img = $('.product-image', card);
        if (img && img.src !== customFront) {
          if (!img.dataset.originalSrc) img.dataset.originalSrc = img.src;
          img.src = customFront;
          changed = true;
        }
      }
    });
    lastAppliedSignature = gridSignature();
    applying = false;
    if (force || changed) window.dispatchEvent(new CustomEvent('wildsage:merchandising-ready'));
  }

  const observer = new MutationObserver(() => setTimeout(() => apply(false), 0));
  const start = () => { const grid = $('#productGrid'); if (grid) observer.observe(grid, {childList:true, subtree:false}); loadData(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
