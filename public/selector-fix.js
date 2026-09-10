(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money = n => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' }).format(Number(n || 0));

  const SIZE_RE = /^(?:XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|5XL|6XL|ONE SIZE|OS|OSFA|YXS|YS|YM|YL|YXL|\d{1,2}(?:\.5)?(?:W|T)?|\d{1,2}[-–]\d{1,2})$/i;

  function cleanPart(v) {
    return String(v || '').trim();
  }

  function parseVariant(v) {
    const parts = String(v?.title || '')
      .split(/\s*\/\s*|\s+-\s+/)
      .map(cleanPart)
      .filter(Boolean);

    if (!parts.length) return { color:'Standard', size:'One Size' };
    if (parts.length === 1) {
      return SIZE_RE.test(parts[0])
        ? { color:'Standard', size:parts[0] }
        : { color:parts[0], size:'One Size' };
    }

    const sizeIndex = parts.findIndex(p => SIZE_RE.test(p));
    if (sizeIndex >= 0) {
      const size = parts[sizeIndex];
      const color = parts.filter((_, i) => i !== sizeIndex).join(' / ') || 'Standard';
      return { color, size };
    }

    // Printify apparel frequently returns either "Color / Size" or "Size / Color".
    // If no standard size token is detectable, favor the longer descriptive part as color.
    const [a, ...rest] = parts;
    const b = rest.join(' / ');
    if (a.length <= 4 && b.length > a.length) return { color:b, size:a };
    return { color:a, size:b || 'One Size' };
  }

  const SWATCHES = {
    'black':'#171717','vintage black':'#252525','charcoal':'#41413f','dark grey':'#555654','dark gray':'#555654',
    'grey':'#777975','gray':'#777975','heather grey':'#9a9b98','heather gray':'#9a9b98','white':'#f3f0e9',
    'natural':'#d9ccb6','cream':'#e5dbc7','ivory':'#eee5d3','bone':'#d2c6b2','sand':'#bca98c','tan':'#a98565',
    'brown':'#6e4a35','chocolate':'#55382c','sage':'#89927a','light sage':'#aab39d','olive':'#646a4c',
    'military green':'#4f5840','forest green':'#304b39','green':'#5d7455','navy':'#29374b','blue':'#526d83',
    'light blue':'#91aabd','red':'#8c3d38','maroon':'#653a40','burgundy':'#643640','rust':'#a55e43',
    'orange':'#bf7044','pink':'#c98e91','mauve':'#a8747e','dusty rose':'#b47d7b','purple':'#70566f',
    'lavender':'#a496b2','yellow':'#c6a85b','gold':'#b18a4b'
  };

  function swatchColor(name) {
    const n = String(name || '').toLowerCase().trim();
    if (SWATCHES[n]) return SWATCHES[n];
    const key = Object.keys(SWATCHES).sort((a,b) => b.length - a.length).find(k => n.includes(k));
    return key ? SWATCHES[key] : '#9a8a76';
  }

  function variantImage(product, variantId) {
    return product?.images?.find(i => (i.variantIds || []).map(String).includes(String(variantId)))?.src
      || product?.images?.find(i => i.position === 'front')?.src
      || product?.images?.[0]?.src || '';
  }

  function uniqueImages(product) {
    return [...new Set((product?.images || []).map(i => i?.src).filter(Boolean))].slice(0, 8);
  }

  function available(product) {
    return (product?.variants || []).filter(v => v.available !== false && v.is_available !== false && v.is_enabled !== false);
  }

  window.openProduct = function openProductFixed(product) {
    const dialog = $('#productDialog');
    const variants = available(product);
    const parsed = variants.map(v => ({ ...v, ...parseVariant(v) }));
    const images = uniqueImages(product);
    const colors = [...new Set(parsed.map(v => v.color))];
    let color = colors[0] || '';
    let size = '';
    let qty = 1;
    const content = $('#productDialogContent');

    content.innerHTML = `<div class="product-dialog-grid">
      <div class="product-gallery">
        <img id="dialogMainImage" src="${esc(images[0] || variantImage(product))}" alt="${esc(product.title)}">
        ${images.length > 1 ? `<div class="product-thumbs">${images.map((src,i) => `<button class="product-thumb ${i===0?'active':''}" type="button" data-src="${esc(src)}"><img src="${esc(src)}" alt=""></button>`).join('')}</div>` : ''}
      </div>
      <div class="product-dialog-copy">
        <p class="eyebrow">${esc((product.tags || []).slice(0,2).join(' ✦ ') || 'WILD SAGE')}</p>
        <h2>${esc(product.title)}</h2>
        <p class="price">From ${money(product.minPrice)}</p>
        <div class="product-description">${product.description || ''}</div>
        ${variants.length ? `<div class="variant-picker">
          <div class="picker-label"><span>Color</span><strong id="chosenColor"></strong></div>
          <div id="colorChoices" class="color-choices" role="group" aria-label="Choose color"></div>
          <div class="picker-label"><span>Size</span><strong id="chosenSize">Select</strong></div>
          <div id="sizeChoices" class="size-choices" role="group" aria-label="Choose size"></div>
        </div>
        <div class="sticky-add">
          <div class="quantity-control"><button id="qtyMinus" type="button" aria-label="Decrease quantity">−</button><span id="qtyValue">1</span><button id="qtyPlus" type="button" aria-label="Increase quantity">+</button></div>
          <button id="dialogAdd" type="button" disabled>Add to bag</button>
        </div>
        <p class="availability-note">Choose a color first, then select an available size.</p>` : '<p class="sold-out">This piece is currently unavailable.</p>'}
      </div>
    </div>`;

    $$('.product-thumb', content).forEach(b => b.onclick = () => {
      $('#dialogMainImage').src = b.dataset.src;
      $$('.product-thumb', content).forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    });

    if (variants.length) {
      const cc = $('#colorChoices'), sc = $('#sizeChoices'), price = $('.price', content), add = $('#dialogAdd');

      function updateSelected() {
        const variant = parsed.find(v => v.color === color && v.size === size);
        add.disabled = !variant;
        if (variant) {
          price.textContent = money(variant.price);
          const src = variantImage(product, variant.id);
          if (src) $('#dialogMainImage').src = src;
        }
      }

      function renderColors() {
        cc.innerHTML = colors.map(c => `<button type="button" class="color-choice ${c===color?'active':''}" data-color="${esc(c)}" aria-label="${esc(c)}" title="${esc(c)}"><span style="background-color:${swatchColor(c)}"></span></button>`).join('');
        $('#chosenColor').textContent = color;
        $$('.color-choice', cc).forEach(b => b.onclick = () => {
          color = b.dataset.color;
          size = '';
          renderColors();
          renderSizes();
        });
      }

      function renderSizes() {
        const options = parsed.filter(v => v.color === color);
        const sizes = [...new Set(options.map(v => v.size))];
        if (!sizes.includes(size)) size = '';
        sc.innerHTML = sizes.map(s => `<button type="button" class="size-choice ${s===size?'active':''}" data-size="${esc(s)}">${esc(s)}</button>`).join('');
        $('#chosenSize').textContent = size || 'Select';
        $$('.size-choice', sc).forEach(b => b.onclick = () => {
          size = b.dataset.size;
          renderSizes();
          updateSelected();
        });
        updateSelected();
      }

      renderColors();
      renderSizes();
      $('#qtyMinus').onclick = () => $('#qtyValue').textContent = qty = Math.max(1, qty - 1);
      $('#qtyPlus').onclick = () => $('#qtyValue').textContent = qty = Math.min(10, qty + 1);
      add.onclick = () => {
        const variant = parsed.find(v => v.color === color && v.size === size);
        if (!variant) return;
        addToCart(product, variant, qty);
        dialog.close();
        openBag();
      };
    }

    dialog.showModal();
  };

  const style = document.createElement('style');
  style.textContent = `
    .color-choices{display:flex!important;flex-wrap:wrap!important;gap:12px!important;align-items:center!important}
    .color-choices .color-choice{box-sizing:border-box!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 42px!important;width:42px!important;min-width:42px!important;max-width:42px!important;height:42px!important;min-height:42px!important;max-height:42px!important;padding:5px!important;margin:0!important;border:1px solid rgba(238,231,220,.45)!important;border-radius:50%!important;background:transparent!important;appearance:none!important}
    .color-choices .color-choice span{display:block!important;width:30px!important;height:30px!important;min-width:30px!important;border-radius:50%!important;border:1px solid rgba(255,255,255,.35)!important;box-shadow:0 1px 3px rgba(0,0,0,.35)!important}
    .color-choices .color-choice.active{outline:2px solid var(--cream)!important;outline-offset:3px!important}
    .size-choices{display:flex!important;flex-wrap:wrap!important;gap:10px!important}
    .size-choices .size-choice{display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;width:auto!important;min-width:54px!important;max-width:none!important;height:44px!important;padding:0 15px!important;margin:0!important;border:1px solid var(--line)!important;border-radius:0!important;background:transparent!important;color:var(--cream)!important;text-transform:uppercase!important;letter-spacing:.08em!important}
    .size-choices .size-choice.active{background:var(--cream)!important;color:var(--ink)!important}
    @media(max-width:760px){
      .color-choices .color-choice{flex-basis:40px!important;width:40px!important;min-width:40px!important;max-width:40px!important;height:40px!important;min-height:40px!important;max-height:40px!important}
      .color-choices .color-choice span{width:28px!important;height:28px!important;min-width:28px!important}
    }
  `;
  document.head.appendChild(style);
})();