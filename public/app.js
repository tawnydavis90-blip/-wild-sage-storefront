const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));

const state = {
  products: [],
  filter: 'all',
  query: '',
  sort: 'featured',
  cart: JSON.parse(localStorage.getItem('wildSageCart') || '[]')
};

const colorMap = {
  black:'#171715', white:'#eeeae1', ivory:'#e8dfcc', natural:'#d8c8a9', cream:'#e2d5bd',
  bone:'#cbbda4', grey:'#787a76', gray:'#787a76', charcoal:'#444744', green:'#5f684d',
  olive:'#646846', sage:'#8d977c', brown:'#6f4b35', rust:'#9a5639', red:'#833b36',
  pink:'#bd817b', blue:'#405c73', navy:'#28384b', purple:'#6c526e', sand:'#b9a484'
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));
}

function stripHtml(value = '') {
  const doc = new DOMParser().parseFromString(String(value), 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

function imageFor(product, variantId) {
  return product?.images?.find(image => (image.variantIds || []).map(String).includes(String(variantId)))?.src
    || product?.images?.find(image => image.position === 'front')?.src
    || product?.images?.[0]?.src || '';
}

function uniqueImages(product) {
  return [...new Set((product?.images || []).map(image => image.src).filter(Boolean))].slice(0, 8);
}

function liveVariants(product) {
  return (product?.variants || []).filter(variant => variant.available !== false && variant.is_available !== false && variant.is_enabled !== false);
}

function variantParts(variant) {
  const parts = String(variant.title || '').split(/\s*\/\s*|\s+-\s+/).map(value => value.trim()).filter(Boolean);
  if (parts.length >= 2) return { color: parts[0], size: parts.slice(1).join(' / ') };
  return { color: 'Standard', size: parts[0] || 'One size' };
}

function productHaystack(product) {
  return `${product.title || ''} ${(product.tags || []).join(' ')} ${stripHtml(product.description || '')}`.toLowerCase();
}

function categoryMatch(product, filter) {
  if (filter === 'all') return true;
  const text = productHaystack(product);
  if (filter === 'tees') return /\btee\b|t-shirt|shirt/.test(text);
  if (filter === 'tanks') return /tank/.test(text);
  if (filter === 'crops') return /crop|cropped/.test(text);
  if (filter === 'hoodies') return /hoodie|sweatshirt|fleece/.test(text);
  return text.includes(filter);
}

function filteredProducts() {
  const result = state.products.filter(product =>
    categoryMatch(product, state.filter) && (!state.query || productHaystack(product).includes(state.query))
  );
  if (state.sort === 'price-low') result.sort((a, b) => a.minPrice - b.minPrice);
  if (state.sort === 'price-high') result.sort((a, b) => b.minPrice - a.minPrice);
  if (state.sort === 'name') result.sort((a, b) => a.title.localeCompare(b.title));
  return result;
}

async function loadProducts() {
  const status = $('#catalogStatus');
  try {
    const response = await fetch('/api/products', { headers: { Accept: 'application/json' } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || payload.error || 'The collection could not be loaded.');
    state.products = Array.isArray(payload.products) ? payload.products : [];
    if (!state.products.length) {
      status.textContent = 'The shop is connected, but no visible products are published yet.';
      return;
    }
    status.hidden = true;
    updateHero();
    renderCatalog();
    renderBestSellers();
    renderInstagram();
  } catch (error) {
    status.hidden = false;
    status.innerHTML = `<strong>The collection is taking a little longer than expected.</strong><span>${escapeHtml(error.message)}</span>`;
  }
}

function updateHero() {
  const image = imageFor(state.products[0]);
  if (image) $('#heroVisual').style.setProperty('--hero-image', `url("${image.replace(/"/g, '%22')}")`);
}

function productCard(product, compact = false) {
  const article = document.createElement('article');
  article.className = compact ? 'product-card compact' : 'product-card';
  const colors = [...new Set(liveVariants(product).map(variant => variantParts(variant).color))].slice(0, 5);
  article.innerHTML = `
    <button class="product-image-button" type="button" aria-label="View ${escapeHtml(product.title)}">
      <span class="product-tag">${escapeHtml((product.tags || [])[0] || 'Wild Sage')}</span>
      <img src="${escapeHtml(imageFor(product))}" alt="${escapeHtml(product.title)}" loading="lazy">
      <span class="quick-view">Quick view</span>
    </button>
    <div class="product-card-copy">
      <div><h3>${escapeHtml(product.title)}</h3><p>From ${money(product.minPrice)}</p></div>
      <div class="mini-swatches" aria-label="${colors.length} colors">${colors.map(color => `<span title="${escapeHtml(color)}" style="--swatch:${colorValue(color)}"></span>`).join('')}</div>
    </div>`;
  $('.product-image-button', article).addEventListener('click', () => openProduct(product));
  return article;
}

function renderCatalog() {
  const grid = $('#productGrid');
  const products = filteredProducts();
  grid.replaceChildren();
  if (!products.length) {
    grid.innerHTML = '<div class="empty-state"><span>☾</span><h3>No pieces found</h3><p>Try another collection or search.</p></div>';
    return;
  }
  products.forEach(product => grid.appendChild(productCard(product)));
}

function renderBestSellers() {
  const holder = $('#bestGrid');
  holder.replaceChildren();
  state.products.slice(0, 3).forEach(product => holder.appendChild(productCard(product, true)));
}

function renderInstagram() {
  const images = state.products.flatMap(uniqueImages).slice(0, 4);
  if (images.length < 4) return;
  $('#instagramGrid').innerHTML = images.map((src, index) => `<div><img src="${escapeHtml(src)}" alt="Wild Sage community style ${index + 1}" loading="lazy"></div>`).join('');
}

function colorValue(name) {
  const key = Object.keys(colorMap).find(color => String(name).toLowerCase().includes(color));
  return key ? colorMap[key] : '#9a8a76';
}

function openProduct(product) {
  const variants = liveVariants(product);
  const parsed = variants.map(variant => ({ ...variant, ...variantParts(variant) }));
  const colors = [...new Set(parsed.map(variant => variant.color))];
  let selectedColor = colors[0] || '';
  let selectedSize = parsed.find(variant => variant.color === selectedColor)?.size || '';
  let quantity = 1;
  const images = uniqueImages(product);
  const dialog = $('#productDialog');
  const detail = $('#productDetail');
  const description = stripHtml(product.description) || 'Designed for the wild-hearted and made to become the piece you reach for again and again.';

  detail.innerHTML = `
    <div class="product-page">
      <div class="gallery">
        <div class="gallery-main"><img id="mainProductImage" src="${escapeHtml(images[0] || imageFor(product))}" alt="${escapeHtml(product.title)}"></div>
        <div class="gallery-thumbs">${images.map((src, index) => `<button type="button" class="${index === 0 ? 'active' : ''}" data-image="${escapeHtml(src)}" aria-label="View image ${index + 1}"><img src="${escapeHtml(src)}" alt=""></button>`).join('')}</div>
      </div>
      <div class="product-panel">
        <p class="kicker">${escapeHtml((product.tags || []).slice(0, 2).join(' · ') || 'WILD SAGE')}</p>
        <h2>${escapeHtml(product.title)}</h2>
        <p class="detail-price" id="detailPrice">From ${money(product.minPrice)}</p>
        <p class="product-story">${escapeHtml(description)}</p>
        <div class="option-block"><div class="option-heading"><span>Color</span><strong id="selectedColor">${escapeHtml(selectedColor)}</strong></div><div class="color-options" id="colorOptions"></div></div>
        <div class="option-block"><div class="option-heading"><span>Size</span><button type="button" class="size-guide">Size guide</button></div><div class="size-options" id="sizeOptions"></div></div>
        <div class="buy-row"><div class="quantity"><button type="button" id="qtyMinus" aria-label="Decrease quantity">−</button><span id="qtyValue">1</span><button type="button" id="qtyPlus" aria-label="Increase quantity">+</button></div><button class="add-button" id="addButton" type="button">Add to bag <span>·</span> <span id="addPrice"></span></button></div>
        <p class="payment-note">Secure checkout · Made to order with Printify</p>
        <div class="detail-accordions">
          <details open><summary>Product story <span>+</span></summary><p>${escapeHtml(description)}</p></details>
          <details><summary>Shipping & returns <span>+</span></summary><p>Each piece is made to order. Shipping timing and cost are shown at checkout. Contact us if your order arrives damaged or incorrect.</p></details>
          <details><summary>Care instructions <span>+</span></summary><p>Machine wash cold, inside out, with like colors. Tumble dry low. Do not iron directly over the artwork.</p></details>
        </div>
      </div>
    </div>`;

  const selectedVariant = () => parsed.find(variant => variant.color === selectedColor && variant.size === selectedSize);

  function updateOptions() {
    $('#selectedColor', detail).textContent = selectedColor;
    $('#colorOptions', detail).innerHTML = colors.map(color => `<button type="button" class="${color === selectedColor ? 'active' : ''}" data-color="${escapeHtml(color)}" aria-label="${escapeHtml(color)}" title="${escapeHtml(color)}"><span style="--swatch:${colorValue(color)}"></span></button>`).join('');
    const sizes = [...new Set(parsed.filter(variant => variant.color === selectedColor).map(variant => variant.size))];
    if (!sizes.includes(selectedSize)) selectedSize = sizes[0] || '';
    $('#sizeOptions', detail).innerHTML = sizes.map(size => `<button type="button" class="${size === selectedSize ? 'active' : ''}" data-size="${escapeHtml(size)}">${escapeHtml(size)}</button>`).join('');
    $$('#colorOptions button', detail).forEach(button => button.addEventListener('click', () => {
      selectedColor = button.dataset.color;
      selectedSize = parsed.find(variant => variant.color === selectedColor)?.size || '';
      updateOptions();
    }));
    $$('#sizeOptions button', detail).forEach(button => button.addEventListener('click', () => {
      selectedSize = button.dataset.size;
      updateOptions();
    }));
    const variant = selectedVariant();
    $('#addButton', detail).disabled = !variant;
    $('#addPrice', detail).textContent = variant ? money(variant.price * quantity) : 'Unavailable';
    $('#detailPrice', detail).textContent = variant ? money(variant.price) : `From ${money(product.minPrice)}`;
    const variantImage = variant ? imageFor(product, variant.id) : '';
    if (variantImage) $('#mainProductImage', detail).src = variantImage;
  }

  $$('.gallery-thumbs button', detail).forEach(button => button.addEventListener('click', () => {
    $('#mainProductImage', detail).src = button.dataset.image;
    $$('.gallery-thumbs button', detail).forEach(item => item.classList.toggle('active', item === button));
  }));
  $('#qtyMinus', detail).addEventListener('click', () => { quantity = Math.max(1, quantity - 1); $('#qtyValue', detail).textContent = quantity; updateOptions(); });
  $('#qtyPlus', detail).addEventListener('click', () => { quantity = Math.min(10, quantity + 1); $('#qtyValue', detail).textContent = quantity; updateOptions(); });
  $('#addButton', detail).addEventListener('click', () => {
    const variant = selectedVariant();
    if (!variant) return;
    addToCart(product, variant, quantity);
    dialog.close();
    openBag();
  });
  updateOptions();
  dialog.showModal();
}

function addToCart(product, variant, quantity) {
  const key = `${product.id}:${variant.id}`;
  const existing = state.cart.find(item => item.key === key);
  if (existing) existing.quantity = Math.min(10, existing.quantity + quantity);
  else state.cart.push({ key, productId: product.id, variantId: variant.id, title: product.title, variantTitle: variant.title, price: variant.price, image: imageFor(product, variant.id), quantity });
  saveCart();
}

function saveCart() {
  localStorage.setItem('wildSageCart', JSON.stringify(state.cart));
  renderCart();
}

function renderCart() {
  $('#bagCount').textContent = state.cart.reduce((total, item) => total + Number(item.quantity || 1), 0);
  const holder = $('#bagItems');
  holder.replaceChildren();
  if (!state.cart.length) holder.innerHTML = '<div class="bag-empty"><span>☾</span><h3>Your bag is waiting.</h3><p>Add something that feels like you.</p></div>';
  state.cart.forEach(item => {
    const row = document.createElement('article');
    row.className = 'bag-item';
    row.innerHTML = `<img src="${escapeHtml(item.image)}" alt=""><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.variantTitle)}</p><div class="bag-quantity"><button type="button" data-action="minus">−</button><span>${item.quantity}</span><button type="button" data-action="plus">+</button></div></div><div class="bag-price"><strong>${money(item.price * item.quantity)}</strong><button type="button" data-action="remove">Remove</button></div>`;
    $('[data-action="minus"]', row).addEventListener('click', () => { item.quantity -= 1; if (item.quantity < 1) state.cart = state.cart.filter(entry => entry.key !== item.key); saveCart(); });
    $('[data-action="plus"]', row).addEventListener('click', () => { item.quantity = Math.min(10, item.quantity + 1); saveCart(); });
    $('[data-action="remove"]', row).addEventListener('click', () => { state.cart = state.cart.filter(entry => entry.key !== item.key); saveCart(); });
    holder.appendChild(row);
  });
  $('#bagSubtotal').textContent = money(state.cart.reduce((total, item) => total + Number(item.price) * Number(item.quantity), 0));
  $('#checkoutButton').disabled = !state.cart.length;
}

function openBag() {
  $('#bagDrawer').classList.add('open');
  $('#bagDrawer').setAttribute('aria-hidden', 'false');
  $('#overlay').hidden = false;
  document.body.classList.add('locked');
}

function closeBag() {
  $('#bagDrawer').classList.remove('open');
  $('#bagDrawer').setAttribute('aria-hidden', 'true');
  $('#overlay').hidden = true;
  document.body.classList.remove('locked');
}

async function checkout() {
  const message = $('#checkoutMessage');
  const button = $('#checkoutButton');
  if (!state.cart.length) return;
  button.disabled = true;
  button.textContent = 'Opening secure checkout…';
  message.textContent = '';
  try {
    const response = await fetch('/api/checkout', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ items:state.cart.map(item => ({ productId:item.productId, variantId:item.variantId, quantity:item.quantity })) }) });
    const payload = await response.json();
    if (!response.ok || !payload.url) throw new Error(payload.error || 'Checkout could not be opened.');
    window.location.assign(payload.url);
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
    button.textContent = 'Secure checkout';
  }
}

function applyFilter(filter) {
  state.filter = filter;
  $$('#filterRow button').forEach(button => button.classList.toggle('active', button.dataset.filter === filter));
  renderCatalog();
  $('#shop').scrollIntoView({ behavior:'smooth', block:'start' });
}

$$('[data-filter]').forEach(button => button.addEventListener('click', () => applyFilter(button.dataset.filter)));
$('#searchInput').addEventListener('input', event => { state.query = event.target.value.trim().toLowerCase(); renderCatalog(); });
$('#sortSelect').addEventListener('change', event => { state.sort = event.target.value; renderCatalog(); });
$('#searchButton').addEventListener('click', () => { $('#shop').scrollIntoView({ behavior:'smooth' }); setTimeout(() => $('#searchInput').focus(), 500); });
$('#bagButton').addEventListener('click', openBag);
$('#closeBag').addEventListener('click', closeBag);
$('#overlay').addEventListener('click', closeBag);
$('#closeProduct').addEventListener('click', () => $('#productDialog').close());
$('#checkoutButton').addEventListener('click', checkout);
$('#menuButton').addEventListener('click', () => { const open = $('#mainNav').classList.toggle('open'); $('#menuButton').setAttribute('aria-expanded', String(open)); });
$$('#mainNav a').forEach(link => link.addEventListener('click', () => { $('#mainNav').classList.remove('open'); $('#menuButton').setAttribute('aria-expanded', 'false'); }));
$('#newsletterForm').addEventListener('submit', event => { event.preventDefault(); $('#newsletterMessage').textContent = 'You’re on the list. Stay wild ♡'; event.target.reset(); });
$('#productDialog').addEventListener('click', event => { if (event.target === $('#productDialog')) $('#productDialog').close(); });

const checkoutState = new URLSearchParams(location.search).get('checkout');
if (checkoutState === 'success') { state.cart = []; saveCart(); setTimeout(() => alert('Thank you — your Wild Sage order is in. ♡'), 250); }

renderCart();
loadProducts();
