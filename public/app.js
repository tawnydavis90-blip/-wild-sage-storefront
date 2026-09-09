const state = {
  products: [],
  filtered: [],
  cart: JSON.parse(localStorage.getItem('wildSageCart') || '[]')
};

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0));

function saveCart() {
  localStorage.setItem('wildSageCart', JSON.stringify(state.cart));
  renderCart();
}

function cartCount() {
  return state.cart.reduce((sum, x) => sum + Number(x.quantity || 1), 0);
}

function productImage(p) {
  return p?.images?.find(i => i.position === 'front')?.src || p?.images?.[0]?.src || '';
}

function productImages(p) {
  return [...new Set((p?.images || []).map(i => i?.src).filter(Boolean))].slice(0, 8);
}

function availableVariants(p) {
  return (p?.variants || []).filter(v => v.is_available !== false && v.is_enabled !== false);
}

function tagsText(p) {
  return (p.tags || []).join(' ').toLowerCase();
}

function categoryMatch(p, filter) {
  if (filter === 'all') return true;
  const haystack = `${p.title || ''} ${tagsText(p)}`.toLowerCase();
  if (filter === 'crops') return /crop|cropped/.test(haystack);
  if (filter === 'tanks') return /tank/.test(haystack);
  if (filter === 'tees') return /\btee\b|t-shirt|shirt/.test(haystack);
  if (filter === 'hoodies') return /hoodie|sweatshirt/.test(haystack);
  if (filter === 'fall') return /fall|autumn|halloween|horror/.test(haystack);
  return haystack.includes(filter);
}

async function loadProducts() {
  const status = $('#statusCard');
  try {
    const res = await fetch('/api/products', { headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || data?.error || 'Could not load catalog');

    state.products = Array.isArray(data.products) ? data.products : [];
    state.filtered = state.products.slice();

    if (!state.products.length) {
      status.textContent = 'Your Printify connection is live, but there are no visible products in this shop yet.';
      return;
    }

    status.hidden = true;
    renderProducts();
  } catch (err) {
    console.error(err);
    status.hidden = false;
    status.innerHTML = `<strong>Could not load catalog.</strong><br><small>${escapeHtml(String(err.message || err))}</small>`;
  }
}

function renderProducts() {
  const grid = $('#productGrid');
  grid.innerHTML = '';

  if (!state.filtered.length) {
    grid.innerHTML = `<div class="status-card">No pieces match this collection yet.</div>`;
    return;
  }

  state.filtered.forEach(p => {
    const card = document.createElement('article');
    card.className = 'product-card';
    const img = productImage(p);
    card.innerHTML = `
      <div class="product-image-wrap">
        ${img ? `<img class="product-image" src="${escapeAttr(img)}" alt="${escapeAttr(p.title)}" loading="lazy">` : ''}
        <span class="product-badge">${escapeHtml((p.tags || [])[0] || 'Wild Sage')}</span>
      </div>
      <div class="product-info">
        <h3 class="product-title">${escapeHtml(p.title)}</h3>
        <p class="product-price">From ${money(p.minPrice)}</p>
        <div class="variant-dots" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
        <div class="card-actions">
          <button class="details" type="button">Details</button>
          <button class="quick-add" type="button">Quick add</button>
        </div>
      </div>`;
    $('.details', card).addEventListener('click', () => openProduct(p));
    $('.product-image-wrap', card).addEventListener('click', () => openProduct(p));
    $('.quick-add', card).addEventListener('click', () => quickAdd(p));
    grid.appendChild(card);
  });
}

function quickAdd(p) {
  const variants = availableVariants(p);
  // Require an explicit choice whenever the product has multiple variants.
  if (variants.length !== 1) return openProduct(p);
  addToCart(p, variants[0], 1);
  openBag();
}

function openProduct(p) {
  const dialog = $('#productDialog');
  const liveVariants = availableVariants(p);
  const images = productImages(p);
  const mainImage = images[0] || productImage(p);

  const variants = liveVariants.map(v =>
    `<option value="${escapeAttr(String(v.id))}">${escapeHtml(v.title)} — ${money(v.price)}</option>`
  ).join('');

  const thumbnails = images.length > 1 ? `
    <div class="product-thumbs">
      ${images.map((src, i) => `
        <button class="product-thumb ${i === 0 ? 'active' : ''}" type="button" data-src="${escapeAttr(src)}" aria-label="View product image ${i + 1}">
          <img src="${escapeAttr(src)}" alt="">
        </button>`).join('')}
    </div>` : '';

  $('#productDialogContent').innerHTML = `
    <div class="product-dialog-grid">
      <div class="product-gallery">
        ${mainImage ? `<img id="dialogMainImage" src="${escapeAttr(mainImage)}" alt="${escapeAttr(p.title)}">` : ''}
        ${thumbnails}
      </div>
      <div class="product-dialog-copy">
        <p class="eyebrow">${escapeHtml((p.tags || []).slice(0,2).join(' ✦ ') || 'WILD SAGE')}</p>
        <h2>${escapeHtml(p.title)}</h2>
        <p class="price">From ${money(p.minPrice)}</p>
        <div class="product-description">${p.description || ''}</div>

        ${liveVariants.length ? `
          <label for="variantSelect">Size / color</label>
          <select id="variantSelect">${variants}</select>

          <label for="quantitySelect">Quantity</label>
          <select id="quantitySelect">
            <option value="1">1</option><option value="2">2</option>
            <option value="3">3</option><option value="4">4</option>
          </select>

          <button id="dialogAdd">Add to bag</button>
          <p class="availability-note">Available Printify options are shown when availability data is provided.</p>
        ` : `<p class="sold-out">This piece is currently unavailable.</p>`}
      </div>
    </div>`;

  $$('.product-thumb', $('#productDialogContent')).forEach(btn => {
    btn.addEventListener('click', () => {
      const main = $('#dialogMainImage');
      if (main) main.src = btn.dataset.src;
      $$('.product-thumb', $('#productDialogContent')).forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  if (liveVariants.length) {
    const select = $('#variantSelect');
    const price = $('.price', $('#productDialogContent'));

    const updatePrice = () => {
      const variant = liveVariants.find(v => String(v.id) === String(select.value));
      if (variant) price.textContent = money(variant.price);
    };

    select.addEventListener('change', updatePrice);
    updatePrice();

    $('#dialogAdd').addEventListener('click', () => {
      const variant = liveVariants.find(v => String(v.id) === String(select.value));
      const quantity = Math.max(1, Number($('#quantitySelect').value || 1));
      addToCart(p, variant, quantity);
      dialog.close();
      openBag();
    });
  }

  dialog.showModal();
}
function addToCart(product, variant, quantity = 1) {
  if (!variant) return;
  const key = `${product.id}:${variant.id}`;
  const existing = state.cart.find(x => x.key === key);
  if (existing) existing.quantity += quantity;
  else state.cart.push({
    key,
    productId: product.id,
    variantId: variant.id,
    title: product.title,
    variantTitle: variant.title,
    price: variant.price,
    image: productImage(product),
    quantity
  });
  saveCart();
}

function renderCart() {
  $('#bagCount').textContent = cartCount();
  const holder = $('#bagItems');
  holder.innerHTML = '';

  if (!state.cart.length) {
    holder.innerHTML = `<p style="color:#aaa397">Your bag is waiting for a little chaos.</p>`;
  }

  state.cart.forEach(item => {
    const row = document.createElement('div');
    row.className = 'bag-item';
    row.innerHTML = `
      ${item.image ? `<img src="${escapeAttr(item.image)}" alt="">` : '<div></div>'}
      <div>
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.variantTitle || '')}</p>
        <p>${money(item.price)} × ${item.quantity}</p>
      </div>
      <button class="bag-remove" aria-label="Remove item">×</button>`;
    $('.bag-remove', row).addEventListener('click', () => {
      state.cart = state.cart.filter(x => x.key !== item.key);
      saveCart();
    });
    holder.appendChild(row);
  });

  const subtotal = state.cart.reduce((sum, x) => sum + Number(x.price || 0) * Number(x.quantity || 1), 0);
  $('#bagSubtotal').textContent = money(subtotal);
}

function openBag() {
  $('#bagDrawer').classList.add('open');
  $('#bagDrawer').setAttribute('aria-hidden', 'false');
  $('#drawerBackdrop').hidden = false;
}

function closeBag() {
  $('#bagDrawer').classList.remove('open');
  $('#bagDrawer').setAttribute('aria-hidden', 'true');
  $('#drawerBackdrop').hidden = true;
}

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[ch]));
}
function escapeAttr(value='') { return escapeHtml(value); }

$$('.category').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.category').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    state.filtered = state.products.filter(p => categoryMatch(p, filter));
    renderProducts();
    $('#drop').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

$('#showAllBtn').addEventListener('click', () => {
  state.filtered = state.products.slice();
  $$('.category').forEach(x => x.classList.toggle('active', x.dataset.filter === 'all'));
  renderProducts();
});

$('#bagBtn').addEventListener('click', openBag);
$('#closeBag').addEventListener('click', closeBag);
$('#drawerBackdrop').addEventListener('click', closeBag);
$('#closeProduct').addEventListener('click', () => $('#productDialog').close());

$('.menu-toggle').addEventListener('click', e => {
  const open = $('.nav').classList.toggle('open');
  e.currentTarget.setAttribute('aria-expanded', String(open));
});

$('#newsletterForm').addEventListener('submit', e => {
  e.preventDefault();
  $('#newsletterMessage').textContent = 'You’re on the list ♡';
  e.currentTarget.reset();
});

$('#checkoutBtn').addEventListener('click', async () => {
  const message = $('#checkoutMessage');
  const button = $('#checkoutBtn');

  if (!state.cart.length) {
    message.textContent = 'Your bag is empty.';
    return;
  }

  button.disabled = true;
  button.textContent = 'Opening secure checkout…';
  message.textContent = '';

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        items: state.cart.map(item => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity
        }))
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Unable to start checkout.');
    if (!data?.url) throw new Error('Stripe did not return a checkout link.');

    window.location.href = data.url;
  } catch (err) {
    console.error(err);
    message.textContent = err.message || 'Unable to open checkout.';
    button.disabled = false;
    button.textContent = 'Checkout';
  }
});

const checkoutParams = new URLSearchParams(window.location.search);
if (checkoutParams.get('checkout') === 'success') {
  state.cart = [];
  saveCart();
  setTimeout(() => {
    alert('Payment received. Thank you for shopping Wild Sage ♡');
    history.replaceState({}, '', window.location.pathname);
  }, 250);
} else if (checkoutParams.get('checkout') === 'cancelled') {
  setTimeout(() => {
    alert('Checkout was cancelled. Your bag is still saved.');
    history.replaceState({}, '', window.location.pathname);
  }, 250);
}

renderCart();
loadProducts();
