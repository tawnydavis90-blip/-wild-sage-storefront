(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  let observer = null;
  let scheduled = false;
  let showcaseSignature = '';
  let suppressObserver = false;

  function productForCard(card) {
    const id = card.dataset.productId;
    if (id) {
      const byId = (window.__wildSageProducts || []).find(p => String(p.id) === String(id));
      if (byId) return byId;
    }
    const title = $('.product-title', card)?.textContent?.trim() || '';
    return (window.__wildSageProducts || []).find(p => String(p.title || '').trim() === title) || null;
  }

  function cardData(card) {
    const title = $('.product-title', card)?.textContent?.trim() || '';
    const priceText = $('.product-price', card)?.textContent || '';
    const price = Number((priceText.match(/[\d.]+/) || ['0'])[0]);
    const badge = $('.product-badge', card)?.textContent?.trim() || '';
    const product = productForCard(card);
    const tags = Array.isArray(product?.tags) ? product.tags.join(' ') : badge;
    const hasAdminFeatured = Object.prototype.hasOwnProperty.call(card.dataset, 'adminFeatured');
    const hasAdminBest = Object.prototype.hasOwnProperty.call(card.dataset, 'adminBestSeller');
    const featured = hasAdminFeatured ? card.dataset.adminFeatured === 'true' : /featured/i.test(tags);
    const bestSeller = hasAdminBest ? card.dataset.adminBestSeller === 'true' : /best\s*seller/i.test(tags);
    return { card, title, price, badge, tags, product, featured, bestSeller };
  }

  function ensureControls() {
    const grid = $('#productGrid');
    if (!grid || $('#catalogTools')) return;
    const tools = document.createElement('div');
    tools.id = 'catalogTools';
    tools.className = 'catalog-tools';
    tools.innerHTML = `
      <div class="catalog-search-wrap"><span aria-hidden="true">⌕</span><input id="catalogSearch" type="search" placeholder="Search the collection" aria-label="Search products"></div>
      <select id="catalogSort" aria-label="Sort products"><option value="featured">Sort: Featured</option><option value="name">Name: A–Z</option><option value="price-low">Price: Low to High</option><option value="price-high">Price: High to Low</option></select>`;
    grid.before(tools);
    $('#catalogSearch').addEventListener('input', applyCatalogTools);
    $('#catalogSort').addEventListener('change', applyCatalogTools);
    $('#searchBtn')?.addEventListener('click', () => { $('#catalogSearch')?.focus(); $('#catalogTools')?.scrollIntoView({behavior:'smooth', block:'center'}); });
  }

  function applyCatalogTools() {
    const grid = $('#productGrid');
    if (!grid) return;
    const query = ($('#catalogSearch')?.value || '').trim().toLowerCase();
    const sort = $('#catalogSort')?.value || 'featured';
    const items = $$('.product-card', grid).map(cardData);
    items.forEach(({card,title,tags}) => { card.hidden = Boolean(query && !`${title} ${tags}`.toLowerCase().includes(query)); });
    const visible = items.filter(x => !x.card.hidden);
    if (sort === 'featured') visible.sort((a,b) => Number(b.featured) - Number(a.featured));
    if (sort === 'name') visible.sort((a,b) => a.title.localeCompare(b.title));
    if (sort === 'price-low') visible.sort((a,b) => a.price - b.price);
    if (sort === 'price-high') visible.sort((a,b) => b.price - a.price);

    const currentVisible = $$('.product-card', grid).filter(card => !card.hidden);
    const sameOrder = currentVisible.length === visible.length && currentVisible.every((card, i) => card === visible[i].card);
    if (!sameOrder) {
      suppressObserver = true;
      observer?.disconnect();
      visible.forEach(x => grid.appendChild(x.card));
      observer?.observe(grid, {childList:true});
      requestAnimationFrame(() => { suppressObserver = false; });
    }
  }

  function cloneForShowcase(sourceCard) {
    const clone = sourceCard.cloneNode(true);
    clone.removeAttribute('hidden');
    clone.classList.add('showcase-card');
    const sourceDetails = $('.details', sourceCard);
    const sourceQuickAdd = $('.quick-add', sourceCard);
    const sourceImage = $('.product-image-wrap', sourceCard);
    $('.details', clone)?.addEventListener('click', () => sourceDetails?.click());
    $('.quick-add', clone)?.addEventListener('click', () => (sourceQuickAdd || sourceDetails)?.click());
    $('.product-image-wrap', clone)?.addEventListener('click', () => sourceImage?.click());
    return clone;
  }

  function currentShowcaseSignature(info) {
    return info.map((x, i) => `${x.product?.id || x.title}:${x.featured ? 1 : 0}:${x.bestSeller ? 1 : 0}:${i}`).join('|');
  }

  function rebuildShowcases(force = false) {
    const drop = $('#drop');
    const grid = $('#productGrid');
    if (!drop || !grid) return;
    const cards = $$('.product-card', grid);
    if (!cards.length) return;
    const info = cards.map(cardData);
    const signature = currentShowcaseSignature(info);
    if (!force && signature === showcaseSignature && $('#featuredSection') && $('#bestSellerSection')) return;
    showcaseSignature = signature;

    $('#featuredSection')?.remove();
    $('#bestSellerSection')?.remove();

    const featured = info.filter(x => x.featured).map(x => x.card);
    const best = info.filter(x => x.bestSeller).map(x => x.card);
    const featuredCards = (featured.length ? featured : cards).slice(0, 4);
    const bestCards = (best.length ? best : cards.slice().reverse()).slice(0, 4);

    const featuredSection = document.createElement('section');
    featuredSection.id = 'featuredSection';
    featuredSection.className = 'showcase-section';
    featuredSection.innerHTML = `<div class="showcase-heading"><div><p class="eyebrow">CURATED FOR YOU</p><h2>Featured Pieces</h2></div><button class="text-button" data-scroll-shop>Shop all →</button></div><div class="showcase-grid" id="featuredGrid"></div>`;

    const bestSection = document.createElement('section');
    bestSection.id = 'bestSellerSection';
    bestSection.className = 'showcase-section showcase-section-alt';
    bestSection.innerHTML = `<div class="showcase-heading"><div><p class="eyebrow">MOST LOVED</p><h2>Best Sellers</h2></div><button class="text-button" data-scroll-shop>Shop all →</button></div><div class="showcase-grid" id="bestSellerGrid"></div>`;

    drop.before(featuredSection);
    drop.after(bestSection);
    featuredCards.forEach(card => $('#featuredGrid').appendChild(cloneForShowcase(card)));
    bestCards.forEach(card => $('#bestSellerGrid').appendChild(cloneForShowcase(card)));
    $$('[data-scroll-shop]').forEach(btn => btn.addEventListener('click', () => drop.scrollIntoView({behavior:'smooth'})));
    window.dispatchEvent(new CustomEvent('wildsage:showcases-rendered'));
  }

  function refresh(forceShowcases = false) {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensureControls();
      applyCatalogTools();
      rebuildShowcases(forceShowcases);
    });
  }

  const start = () => {
    const grid = $('#productGrid');
    observer = new MutationObserver(() => {
      if (!suppressObserver) refresh(true);
    });
    if (grid) observer.observe(grid, {childList:true});
    refresh(true);
    $$('.category, #showAllBtn').forEach(btn => btn.addEventListener('click', () => setTimeout(() => refresh(true), 0)));
    window.addEventListener('wildsage:merchandising-ready', () => refresh(true));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
