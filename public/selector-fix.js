(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money = n => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' }).format(Number(n || 0));

  const SIZE_RE = /^(?:XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|5XL|6XL|ONE SIZE|OS|OSFA|YXS|YS|YM|YL|YXL|\d{1,2}(?:\.5)?(?:W|T)?|\d{1,2}[-–]\d{1,2})$/i;
  const cleanPart = v => String(v || '').trim();

  function parseVariant(v) {
    const parts = String(v?.title || '').split(/\s*\/\s*|\s+-\s+/).map(cleanPart).filter(Boolean);
    if (!parts.length) return { color:'Standard', size:'One Size' };
    if (parts.length === 1) return SIZE_RE.test(parts[0]) ? { color:'Standard', size:parts[0] } : { color:parts[0], size:'One Size' };
    const sizeIndex = parts.findIndex(p => SIZE_RE.test(p));
    if (sizeIndex >= 0) return { size:parts[sizeIndex], color:parts.filter((_,i) => i !== sizeIndex).join(' / ') || 'Standard' };
    const [a, ...rest] = parts, b = rest.join(' / ');
    return a.length <= 4 && b.length > a.length ? { color:b, size:a } : { color:a, size:b || 'One Size' };
  }

  const SWATCHES = {
    'black':'#171717','vintage black':'#252525','charcoal':'#41413f','dark grey':'#555654','dark gray':'#555654',
    'grey':'#777975','gray':'#777975','heather grey':'#9a9b98','heather gray':'#9a9b98','white':'#f3f0e9',
    'natural':'#d9ccb6','cream':'#e5dbc7','ivory':'#eee5d3','bone':'#d2c6b2','sand':'#bca98c','tan':'#a98565',
    'brown':'#6e4a35','chocolate':'#55382c','sage':'#89927a','light sage':'#aab39d','olive':'#646a4c',
    'military green':'#4f5840','forest green':'#304b39','green':'#5d7455','navy':'#29374b','midnight navy':'#27364a',
    'blue':'#526d83','stonewash denim':'#73889a','light blue':'#91aabd','red':'#8c3d38','cardinal':'#853e43',
    'maroon':'#653a40','burgundy':'#643640','rust':'#a55e43','smoked paprika':'#9b5643','orange':'#bf7044',
    'pink':'#c98e91','desert pink':'#bd8580','hot pink':'#c84c83','mauve':'#a8747e','dusty rose':'#b47d7b',
    'purple':'#70566f','purple rush':'#645078','lavender':'#a496b2','lilac':'#b7a7c3','yellow':'#c6a85b',
    'gold':'#b18a4b','antique gold':'#aa8344','silver':'#b9b9b3','mint':'#9bb8a8','turquoise':'#4c9e9c','tahiti blue':'#4c98a6'
  };
  function swatchColor(name) {
    const n = String(name || '').toLowerCase().trim();
    if (SWATCHES[n]) return SWATCHES[n];
    const key = Object.keys(SWATCHES).sort((a,b) => b.length-a.length).find(k => n.includes(k));
    return key ? SWATCHES[key] : '#9a8a76';
  }

  function variantImage(product, variantId) {
    return product?.images?.find(i => (i.variantIds || []).map(String).includes(String(variantId)))?.src
      || product?.images?.find(i => i.position === 'front')?.src || product?.images?.[0]?.src || '';
  }
  function uniqueImages(product) { return [...new Set((product?.images || []).map(i => i?.src).filter(Boolean))].slice(0,8); }
  function variantAvailable(v) { return v.available !== false && v.is_available !== false && v.is_enabled !== false; }

  const SIZE_GUIDES = [
    {
      test: p => /ideal racerback|\b1533\b/i.test(`${p.title} ${(p.tags||[]).join(' ')}`),
      name: 'Next Level 1533 • Women’s Ideal Racerback Tank',
      note: 'Women’s cut with a slimmer fit. Measurements are finished garment dimensions in inches, laid flat.',
      sizes:['XS','S','M','L','XL','2XL'],
      rows:[['Chest width','14','15','16','17','18','19'],['Body length','27','27½','28','28½','29','29½']]
    },
    {
      test: p => /festival crop|cropped tank|\b5083\b/i.test(`${p.title} ${(p.tags||[]).join(' ')}`),
      name: 'Next Level 5083 • Women’s Festival Cropped Tank',
      note: 'Regular cropped fit. Measurements are finished garment dimensions in inches, laid flat.',
      sizes:['XS','S','M','L','XL','2XL'],
      rows:[['Chest width','15','16','17','18','19½','21'],['Body length','18¾','19⅜','20','20⅝','21¼','21⅞']]
    }
  ];

  function sizeGuideFor(product) { return SIZE_GUIDES.find(g => g.test(product)); }
  function sizeGuideMarkup(product) {
    const guide = sizeGuideFor(product);
    if (!guide) return `<div class="fit-guide"><p><strong>Fit guide</strong></p><p>Choose your usual size for the intended garment fit. Exact measurements vary by blank style; we’re adding manufacturer-specific charts across the collection.</p></div>`;
    return `<div class="size-guide-panel"><p class="size-guide-name">${esc(guide.name)}</p><p>${esc(guide.note)}</p><div class="size-table-wrap"><table class="size-table"><thead><tr><th>Measurement</th>${guide.sizes.map(s=>`<th>${s}</th>`).join('')}</tr></thead><tbody>${guide.rows.map(r=>`<tr><th>${r[0]}</th>${r.slice(1).map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="measure-note">Chest width is measured across the garment while laid flat. For best results, compare these measurements with a similar garment you already own.</p></div>`;
  }

  window.openProduct = function openProductEnhanced(product) {
    const dialog = $('#productDialog');
    const allVariants = (product?.variants || []).map(v => ({...v, ...parseVariant(v), _available:variantAvailable(v)}));
    const sellable = allVariants.filter(v => v._available);
    const images = uniqueImages(product);
    const colors = [...new Set(allVariants.map(v => v.color))];
    let color = colors.find(c => allVariants.some(v => v.color === c && v._available)) || colors[0] || '';
    let size = '', qty = 1;
    const content = $('#productDialogContent');

    content.innerHTML = `<div class="product-dialog-grid enhanced-product">
      <div class="product-gallery">
        <div class="main-image-frame"><img id="dialogMainImage" src="${esc(images[0] || variantImage(product))}" alt="${esc(product.title)}"></div>
        ${images.length > 1 ? `<div class="product-thumbs">${images.map((src,i)=>`<button class="product-thumb ${i===0?'active':''}" type="button" data-src="${esc(src)}" aria-label="View image ${i+1}"><img src="${esc(src)}" alt=""></button>`).join('')}</div>` : ''}
      </div>
      <div class="product-dialog-copy">
        <p class="eyebrow">${esc((product.tags || []).slice(0,2).join(' ✦ ') || 'WILD SAGE')}</p>
        <h2>${esc(product.title)}</h2>
        <p class="price">From ${money(product.minPrice)}</p>
        <div class="product-description">${product.description || ''}</div>
        ${allVariants.length ? `<div class="variant-picker">
          <div class="picker-label"><span>Color</span><strong id="chosenColor"></strong></div>
          <div id="colorChoices" class="color-choices" role="group" aria-label="Choose color"></div>
          <div class="picker-label size-label"><span>Size</span><div><strong id="chosenSize">Select</strong><button type="button" class="size-guide-toggle" id="sizeGuideToggle">Size guide</button></div></div>
          <div id="sizeChoices" class="size-choices" role="group" aria-label="Choose size"></div>
          <div id="sizeGuide" class="size-guide" hidden>${sizeGuideMarkup(product)}</div>
        </div>
        <div class="availability-line" id="availabilityLine">Choose a color, then select a size.</div>
        <div class="sticky-add"><div class="quantity-control"><button id="qtyMinus" type="button" aria-label="Decrease quantity">−</button><span id="qtyValue">1</span><button id="qtyPlus" type="button" aria-label="Increase quantity">+</button></div><button id="dialogAdd" type="button" disabled>Add to bag</button></div>` : '<p class="sold-out">This piece is currently unavailable.</p>'}
      </div>
    </div>`;

    $$('.product-thumb', content).forEach(b => b.onclick = () => { $('#dialogMainImage').src=b.dataset.src; $$('.product-thumb',content).forEach(x=>x.classList.remove('active')); b.classList.add('active'); });

    if (allVariants.length) {
      const cc=$('#colorChoices'), sc=$('#sizeChoices'), price=$('.price',content), add=$('#dialogAdd'), availability=$('#availabilityLine');
      const guide=$('#sizeGuide'), guideToggle=$('#sizeGuideToggle');
      guideToggle.onclick=()=>{ guide.hidden=!guide.hidden; guideToggle.textContent=guide.hidden?'Size guide':'Hide guide'; };

      function updateSelected() {
        const variant=allVariants.find(v=>v.color===color&&v.size===size);
        add.disabled=!variant || !variant._available;
        if (variant && variant._available) {
          price.textContent=money(variant.price);
          availability.textContent='In stock • ready to add to bag';
          availability.className='availability-line in-stock';
          const src=variantImage(product,variant.id); if(src) $('#dialogMainImage').src=src;
        } else if (variant) {
          availability.textContent='This color / size combination is currently unavailable.';
          availability.className='availability-line unavailable';
        } else {
          availability.textContent='Choose a color, then select a size.';
          availability.className='availability-line';
        }
      }

      function renderColors() {
        cc.innerHTML=colors.map(c=>{const hasStock=allVariants.some(v=>v.color===c&&v._available);return `<button type="button" class="color-choice ${c===color?'active':''} ${!hasStock?'unavailable':''}" data-color="${esc(c)}" aria-label="${esc(c)}${!hasStock?' unavailable':''}" title="${esc(c)}${!hasStock?' — unavailable':''}"><span style="background-color:${swatchColor(c)}"></span></button>`}).join('');
        $('#chosenColor').textContent=color;
        $$('.color-choice',cc).forEach(b=>b.onclick=()=>{color=b.dataset.color;size='';renderColors();renderSizes()});
      }

      function renderSizes() {
        const colorVariants=allVariants.filter(v=>v.color===color);
        const sizes=[...new Set(allVariants.map(v=>v.size))];
        if(!sizes.includes(size)) size='';
        sc.innerHTML=sizes.map(s=>{const v=colorVariants.find(v=>v.size===s), available=!!v&&v._available;return `<button type="button" class="size-choice ${s===size?'active':''} ${!available?'unavailable':''}" data-size="${esc(s)}" ${!available?'disabled':''} aria-label="${esc(s)}${!available?' unavailable':''}">${esc(s)}${!available?'<span class="sold-slash"></span>':''}</button>`}).join('');
        $('#chosenSize').textContent=size||'Select';
        $$('.size-choice:not(:disabled)',sc).forEach(b=>b.onclick=()=>{size=b.dataset.size;renderSizes();updateSelected()});
        updateSelected();
      }

      renderColors(); renderSizes();
      $('#qtyMinus').onclick=()=>$('#qtyValue').textContent=qty=Math.max(1,qty-1);
      $('#qtyPlus').onclick=()=>$('#qtyValue').textContent=qty=Math.min(10,qty+1);
      add.onclick=()=>{const variant=allVariants.find(v=>v.color===color&&v.size===size&&v._available);if(!variant)return;addToCart(product,variant,qty);dialog.close();openBag();};
    }
    dialog.showModal();
  };

  const style=document.createElement('style');
  style.textContent=`
    .enhanced-product .main-image-frame{background:#f0ece5;overflow:hidden}.enhanced-product .main-image-frame img{width:100%;height:auto;display:block}
    .color-choices{display:flex!important;flex-wrap:wrap!important;gap:12px!important;align-items:center!important}.color-choices .color-choice{box-sizing:border-box!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 42px!important;width:42px!important;min-width:42px!important;max-width:42px!important;height:42px!important;min-height:42px!important;max-height:42px!important;padding:5px!important;margin:0!important;border:1px solid rgba(238,231,220,.45)!important;border-radius:50%!important;background:transparent!important;appearance:none!important}.color-choices .color-choice span{display:block!important;width:30px!important;height:30px!important;min-width:30px!important;border-radius:50%!important;border:1px solid rgba(255,255,255,.35)!important;box-shadow:0 1px 3px rgba(0,0,0,.35)!important}.color-choices .color-choice.active{outline:2px solid var(--cream)!important;outline-offset:3px!important}.color-choice.unavailable{opacity:.35;position:relative}.color-choice.unavailable:after{content:"";position:absolute;width:34px;height:1px;background:var(--cream);transform:rotate(-45deg)}
    .size-choices{display:flex!important;flex-wrap:wrap!important;gap:10px!important}.size-choices .size-choice{position:relative;display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;width:auto!important;min-width:54px!important;max-width:none!important;height:44px!important;padding:0 15px!important;margin:0!important;border:1px solid var(--line)!important;border-radius:0!important;background:transparent!important;color:var(--cream)!important;text-transform:uppercase!important;letter-spacing:.08em!important}.size-choices .size-choice.active{background:var(--cream)!important;color:var(--ink)!important}.size-choice.unavailable{opacity:.3!important;cursor:not-allowed!important}.sold-slash{position:absolute;width:80%;height:1px;background:currentColor;transform:rotate(-24deg)}
    .size-label>div{display:flex;align-items:center;gap:14px}.size-guide-toggle{padding:0;border:0;border-bottom:1px solid currentColor;background:transparent;color:var(--cream);font-size:.68rem;text-transform:uppercase;letter-spacing:.08em}.size-guide{margin-top:18px;padding:18px;border:1px solid var(--line);background:rgba(255,255,255,.025)}.size-guide p{margin:.2rem 0 .8rem;color:#c7beb1;font-size:.78rem}.size-guide-name{color:var(--cream)!important;font-family:"Cormorant Garamond",serif;font-size:1.1rem!important}.size-table-wrap{overflow-x:auto;margin-top:14px}.size-table{width:100%;min-width:560px;border-collapse:collapse;font-size:.72rem}.size-table th,.size-table td{padding:9px 10px;border:1px solid var(--line);text-align:center;white-space:nowrap}.size-table th:first-child{text-align:left}.measure-note{margin-top:10px!important;font-size:.7rem!important}.fit-guide strong{color:var(--cream)}
    .availability-line{margin-top:18px;padding:11px 13px;border-left:2px solid var(--sage);background:rgba(255,255,255,.035);color:#bfb8ad;font-size:.74rem}.availability-line.in-stock{border-color:#8f9980;color:#d8dfca}.availability-line.unavailable{border-color:#b98277;color:#e2b0a6}
    .sticky-add{position:sticky;bottom:0;z-index:4;display:grid;grid-template-columns:auto 1fr;gap:10px;margin-top:18px;padding:14px 0;background:linear-gradient(180deg,rgba(11,13,9,0),var(--ink) 24%)}.sticky-add>button{min-height:50px;border:0;background:var(--cream);color:var(--ink);font-weight:700;text-transform:uppercase;letter-spacing:.09em}.sticky-add>button:disabled{opacity:.4}.quantity-control{display:flex;border:1px solid var(--line);background:var(--ink)}.quantity-control button{width:40px;border:0;background:transparent}.quantity-control span{min-width:28px;display:grid;place-items:center}
    @media(max-width:760px){.color-choices .color-choice{flex-basis:40px!important;width:40px!important;min-width:40px!important;max-width:40px!important;height:40px!important;min-height:40px!important;max-height:40px!important}.color-choices .color-choice span{width:28px!important;height:28px!important;min-width:28px!important}.sticky-add{position:fixed;left:0;right:0;bottom:0;padding:12px 16px;background:var(--ink);border-top:1px solid var(--line)}.product-dialog-copy{padding-bottom:100px}.size-guide{padding:14px}.availability-line{margin-bottom:8px}}
  `;
  document.head.appendChild(style);
})();