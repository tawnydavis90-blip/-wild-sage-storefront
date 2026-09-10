(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function cardData(card) {
    const title = $('.product-title', card)?.textContent?.trim() || '';
    const priceText = $('.product-price', card)?.textContent || '';
    const price = Number((priceText.match(/[\d.]+/) || ['0'])[0]);
    const badge = $('.product-badge', card)?.textContent?.trim() || '';
    return { card, title, price, badge };
  }

  function ensureControls() {
    const drop = $('#drop');
    const grid = $('#productGrid');
    if (!drop || !grid || $('#catalogTools')) return;
    const tools = document.createElement('div');
    tools.id = 'catalogTools';
    tools.className = 'catalog-tools';
    tools.innerHTML = `
      <div class="catalog-search-wrap">
        <span aria-hidden="true">⌕</span>
        <input id="catalogSearch" type="search" placeholder="Search the collection" aria-label="Search products">
      </div>
      <select id="catalogSort" aria-label="Sort products">
        <option value="featured">Sort: Featured</option>
        <option value="name">Name: A–Z</option>
        <option value="price-low">Price: Low to High</option>
        <option value="price-high">Price: High to Low</option>
      </select>`;
    grid.before(tools);

    $('#catalogSearch').addEventListener('input', applyCatalogTools);
    $('#catalogSort').addEventListener('change', applyCatalogTools);
    $('#searchBtn')?.addEventListener('click', () => {
      $('#catalogSearch')?.focus();
      $('#catalogTools')?.scrollIntoView({behavior:'smooth', block:'center'});
    });
  }

  function applyCatalogTools() {
    const grid = $('#productGrid');
    if (!grid) return;
    const query = ($('#catalogSearch')?.value || '').trim().toLowerCase();
    const sort = $('#catalogSort')?.value || 'featured';
    const items = $$('.product-card', grid).map(cardData);

    items.forEach(({card,title,badge}) => {
      const haystack = `${title} ${badge}`.toLowerCase();
      card.hidden = Boolean(query && !haystack.includes(query));
    });

    const visible = items.filter(x => !x.card.hidden);
    if (sort === 'name') visible.sort((a,b) => a.title.localeCompare(b.title));
    if (sort === 'price-low') visible.sort((a,b) => a.price - b.price);
    if (sort === 'price-high') visible.sort((a,b) => b.price - a.price);
    visible.forEach(x => grid.appendChild(x.card));
  }

  function cloneForShowcase(sourceCard) {
    const clone = sourceCard.cloneNode(true);
    clone.removeAttribute('hidden');
    clone.classList.add('showcase-card');
    const sourceDetails = $('.details', sourceCard);
    const sourceImage = $('.product-image-wrap', sourceCard);
    $('.details', clone)?.addEventListener('click', () => sourceDetails?.click());
    $('.quick-add', clone)?.addEventListener('click', () => sourceDetails?.click());
    $('.product-image-wrap', clone)?.addEventListener('click', () => sourceImage?.click());
    return clone;
  }

  function ensureShowcases() {
    const drop = $('#drop');
    const grid = $('#productGrid');
    if (!drop || !grid || $('#featuredSection')) return;
    const cards = $$('.product-card', grid);
    if (!cards.length) return;

    const info = cards.map(cardData);
    const featured = info.filter(x => /featured/i.test(x.badge)).map(x => x.card);
    const best = info.filter(x => /best\s*seller/i.test(x.badge)).map(x => x.card);

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
  }

  let scheduled = false;
  function refresh() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensureControls();
      ensureShowcases();
      applyCatalogTools();
    });
  }

  const observer = new MutationObserver(refresh);
  const start = () => {
    refresh();
    const grid = $('#productGrid');
    if (grid) observer.observe(grid, {childList:true});
    $$('.category, #showAllBtn').forEach(btn => btn.addEventListener('click', () => setTimeout(refresh, 0)));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();