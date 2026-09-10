(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  let products = [];
  let overrides = new Map();

  async function json(url, options={}) {
    const res = await fetch(url, { headers:{'Content-Type':'application/json', ...(options.headers||{})}, ...options });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }

  function primaryImage(p) {
    return p?.images?.find(i=>i.position==='front')?.src || p?.images?.[0]?.src || '';
  }

  function settingsFor(id) {
    return overrides.get(String(id)) || { productId:String(id), featured:false, bestSeller:false, mockups:[] };
  }

  function renderProducts() {
    const query = ($('#productSearch')?.value || '').trim().toLowerCase();
    const list = products.filter(p => `${p.title} ${(p.tags||[]).join(' ')}`.toLowerCase().includes(query));
    $('#productCount').textContent = `${list.length} product${list.length===1?'':'s'}`;
    const grid = $('#productsGrid');
    grid.innerHTML = list.map(p => {
      const s = settingsFor(p.id);
      const mockups = Array.isArray(s.mockups) ? s.mockups : [];
      return `<article class="product-admin-card" data-product-id="${esc(p.id)}">
        <img src="${esc(mockups[0] || primaryImage(p))}" alt="${esc(p.title)}">
        <div>
          <h2>${esc(p.title)}</h2>
          <p class="muted">${esc((p.tags||[]).join(' • ') || 'No Printify tags')}</p>
          <div class="switch-row">
            <label class="switch-label"><input class="featured-toggle" type="checkbox" ${s.featured?'checked':''}> Featured</label>
            <label class="switch-label"><input class="best-toggle" type="checkbox" ${s.bestSeller?'checked':''}> Best Seller</label>
          </div>
          <div class="mockups">
            <label>Custom mockups</label>
            <input class="mockup-url" type="url" placeholder="Primary mockup image URL" value="${esc(mockups[0]||'')}">
            <input class="mockup-url" type="url" placeholder="Second mockup image URL" value="${esc(mockups[1]||'')}">
            <input class="mockup-url" type="url" placeholder="Third mockup image URL" value="${esc(mockups[2]||'')}">
          </div>
          <div class="save-row"><span class="save-status"></span><button class="save-product" type="button">Save</button></div>
        </div>
      </article>`;
    }).join('');

    grid.querySelectorAll('.save-product').forEach(btn => btn.addEventListener('click', saveCard));
  }

  async function saveCard(e) {
    const card = e.currentTarget.closest('.product-admin-card');
    const id = card.dataset.productId;
    const status = $('.save-status', card);
    const payload = {
      featured: $('.featured-toggle', card).checked,
      bestSeller: $('.best-toggle', card).checked,
      mockups: [...card.querySelectorAll('.mockup-url')].map(x=>x.value.trim()).filter(Boolean)
    };
    status.textContent = 'Saving…';
    try {
      const result = await json(`/api/admin/products/${encodeURIComponent(id)}`, { method:'PUT', body:JSON.stringify(payload) });
      overrides.set(String(id), result.item);
      status.textContent = 'Saved';
      const product = products.find(p=>String(p.id)===String(id));
      const img = $('img', card);
      if (payload.mockups[0]) img.src = payload.mockups[0]; else if (product) img.src = primaryImage(product);
    } catch (err) {
      status.textContent = err.message;
    }
  }

  async function loadDashboard() {
    const [catalog, merchandising] = await Promise.all([json('/api/products'), json('/api/admin/merchandising')]);
    products = Array.isArray(catalog.products) ? catalog.products : [];
    overrides = new Map((merchandising.items || []).map(item => [String(item.productId), item]));
    if (!merchandising.configured) {
      const notice = $('#setupNotice');
      notice.hidden = false;
      notice.textContent = 'Database connection is not configured yet. Add DATABASE_URL in Render before saving merchandising changes.';
    }
    renderProducts();
  }

  async function checkSession() {
    const session = await json('/api/admin/session');
    $('#loginView').hidden = session.authenticated;
    $('#dashboardView').hidden = !session.authenticated;
    if (session.authenticated) {
      if (!session.databaseConfigured) {
        $('#setupNotice').hidden = false;
        $('#setupNotice').textContent = 'DATABASE_URL is not configured yet. The dashboard can load, but merchandising changes cannot be saved until it is added in Render.';
      }
      await loadDashboard();
    }
  }

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const message = $('#loginMessage');
    message.textContent = 'Signing in…';
    try {
      await json('/api/admin/login', { method:'POST', body:JSON.stringify({password:$('#adminPassword').value}) });
      message.textContent = '';
      await checkSession();
    } catch (err) { message.textContent = err.message; }
  });

  $('#logoutButton').addEventListener('click', async () => {
    await json('/api/admin/logout', {method:'POST'});
    location.reload();
  });

  $('#productSearch').addEventListener('input', renderProducts);
  checkSession().catch(err => { $('#loginMessage').textContent = err.message; });
})();
