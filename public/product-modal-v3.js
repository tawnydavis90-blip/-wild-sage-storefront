(()=>{
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  let catalogPromise=null,renderToken=0;
  const sizeRe=/^(?:XXS|XS|S|M|L|XL|XXL|XXXL|[2-6]XL|[0-9]{1,2}(?:\.[0-9])?|ONE SIZE)$/i;
  const swatches={black:'#171717','vintage black':'#262524','dark grey':'#555654',charcoal:'#41413f',grey:'#777975',gray:'#777975','heather grey':'#9a9b98',white:'#f3f0e9',natural:'#d9ccb6',cream:'#e5dbc7',ivory:'#eee5d3',bone:'#d2c6b2',sand:'#bca98c',tan:'#a98565',brown:'#6e4a35',chocolate:'#55382c',sage:'#89927a','light sage':'#aab39d',olive:'#646a4c','military green':'#4f5840','forest green':'#304b39',green:'#5d7455',navy:'#29374b',blue:'#526d83','light blue':'#91aabd',red:'#8c3d38',maroon:'#653a40',burgundy:'#643640',rust:'#a55e43',orange:'#bf7044',pink:'#c98e91',mauve:'#a8747e','dusty rose':'#b47d7b',purple:'#70566f',lavender:'#a496b2',yellow:'#c6a85b',gold:'#b18a4b'};
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const swatch=name=>{const n=String(name||'').toLowerCase().trim();if(swatches[n])return swatches[n];const k=Object.keys(swatches).sort((a,b)=>b.length-a.length).find(x=>n.includes(x));return k?swatches[k]:'#9a8a76'};
  function parts(v){
    const p=String(v?.title||'').split(/\s*\/\s*|\s+-\s+/).map(x=>x.trim()).filter(Boolean);
    if(!p.length)return{color:'Standard',size:'One Size'};
    if(p.length===1)return sizeRe.test(p[0])?{color:'Standard',size:p[0]}:{color:p[0],size:'One Size'};
    if(sizeRe.test(p[0]))return{color:p.slice(1).join(' / '),size:p[0]};
    if(sizeRe.test(p[p.length-1]))return{color:p.slice(0,-1).join(' / '),size:p[p.length-1]};
    return{color:p[0],size:p.slice(1).join(' / ')};
  }
  function available(p){return(p?.variants||[]).filter(v=>v.available!==false&&v.is_available!==false&&v.is_enabled!==false).map(v=>({...v,...parts(v)}));}
  function catalog(){return window.__wildSageProducts?.length?Promise.resolve(window.__wildSageProducts):(catalogPromise||(catalogPromise=fetch('/api/products').then(r=>r.json()).then(d=>d.products||[]).catch(()=>[])))}
  function allImagesFor(p){
    const merch=window.__wildSageMerchandising?.get?.(String(p.id));
    const urls=[];
    for(const src of (merch?.mockups||[])){if(src)urls.push(src)}
    for(const i of (p.images||[])){if(i?.src)urls.push(i.src)}
    return [...new Set(urls)].slice(0,10);
  }
  function preferredMainForColor(p,color){
    const ids=new Set(available(p).filter(v=>v.color===color).map(v=>String(v.id)));
    const match=(p.images||[]).find(i=>{const vi=(i.variantIds||[]).map(String);return vi.some(id=>ids.has(id));});
    return match?.src||allImagesFor(p)[0]||'';
  }
  function renderGallery(p,color){
    const gallery=$('#productDialog .product-gallery'),main=$('#dialogMainImage');if(!gallery||!main)return;
    const urls=allImagesFor(p);if(!urls.length)return;
    const preferred=preferredMainForColor(p,color)||urls[0];
    main.src=preferred;
    let thumbs=$('.product-thumbs',gallery);if(thumbs)thumbs.remove();
    if(urls.length<=1)return;
    thumbs=document.createElement('div');thumbs.className='product-thumbs';
    thumbs.innerHTML=urls.map((src,n)=>`<button class="product-thumb ${src===preferred?'active':''}" type="button" data-src="${esc(src)}" aria-label="View image ${n+1}"><img src="${esc(src)}" alt="${esc(p.title)} mockup ${n+1}" loading="eager"></button>`).join('');
    gallery.appendChild(thumbs);
    $$('.product-thumb',thumbs).forEach(b=>{b.onclick=()=>{main.src=b.dataset.src;$$('.product-thumb',thumbs).forEach(x=>x.classList.remove('active'));b.classList.add('active')}});
  }
  async function init(){
    const token=++renderToken,dialog=$('#productDialog');if(!dialog?.open)return;
    const title=$('.product-dialog-copy h2',dialog)?.textContent?.trim();if(!title)return;
    const list=await catalog();if(token!==renderToken)return;
    const p=list.find(x=>String(x.title||'').trim()===title);if(!p)return;
    const vars=available(p);if(!vars.length)return;
    let color=[...new Set(vars.map(v=>v.color))][0]||'Standard',size='',qty=1;
    const cc=$('#colorChoices',dialog),sc=$('#sizeChoices',dialog),chosenColor=$('#chosenColor',dialog),chosenSize=$('#chosenSize',dialog),price=$('.price',dialog),add=$('#dialogAdd',dialog);
    if(!cc||!sc||!add)return;
    function selected(){return vars.find(v=>v.color===color&&v.size===size)}
    function renderColors(){
      const colors=[...new Set(vars.map(v=>v.color))];
      cc.innerHTML=colors.map(c=>`<button type="button" class="color-choice ${c===color?'active':''}" data-color="${esc(c)}" aria-label="${esc(c)}" title="${esc(c)}"><span style="background:${swatch(c)}"></span></button>`).join('');
      chosenColor.textContent=color;
      $$('.color-choice',cc).forEach(b=>b.onclick=()=>{color=b.dataset.color;size='';renderColors();renderSizes();renderGallery(p,color)});
    }
    function renderSizes(){
      const sizes=[...new Set(vars.filter(v=>v.color===color).map(v=>v.size))];if(!sizes.includes(size))size='';
      sc.innerHTML=sizes.map(s=>`<button type="button" class="size-choice ${s===size?'active':''}" data-size="${esc(s)}">${esc(s)}</button>`).join('');
      chosenSize.textContent=size||'Select';
      $$('.size-choice',sc).forEach(b=>b.onclick=()=>{size=b.dataset.size;renderSizes();update()});update();
    }
    function update(){const v=selected();add.disabled=!v;if(v&&price)price.textContent=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v.price||0));}
    renderColors();renderSizes();renderGallery(p,color);
    const minus=$('#qtyMinus',dialog),plus=$('#qtyPlus',dialog),qv=$('#qtyValue',dialog);if(qv)qv.textContent='1';
    if(minus)minus.onclick=()=>{qty=Math.max(1,qty-1);if(qv)qv.textContent=qty};
    if(plus)plus.onclick=()=>{qty=Math.min(10,qty+1);if(qv)qv.textContent=qty};
    add.onclick=()=>{const v=selected();if(!v)return;if(typeof window.addToCart==='function')window.addToCart(p,v,qty);dialog.close();if(typeof window.openBag==='function')window.openBag()};
  }
  document.addEventListener('click',e=>{if(e.target.closest?.('.details,.quick-add,.product-image-wrap'))setTimeout(init,70)},true);
  const d=$('#productDialog');if(d)new MutationObserver(()=>{if(d.open)setTimeout(init,20)}).observe(d,{childList:true,subtree:false});
  const style=document.createElement('style');style.textContent=`#productDialog .color-choice{border-radius:50%!important;width:44px!important;height:44px!important;min-width:44px!important;max-width:44px!important;padding:5px!important}#productDialog .color-choice span{display:block!important;width:32px!important;height:32px!important;border-radius:50%!important}#productDialog .size-choice{border-radius:3px!important;width:auto!important;min-width:50px!important;height:42px!important;padding:0 13px!important}#productDialog .product-thumbs{display:flex!important;gap:8px!important;overflow-x:auto!important;padding:4px 1px 6px!important}#productDialog .product-thumb{display:block!important;flex:0 0 72px!important;width:72px!important;height:72px!important;padding:4px!important;border-radius:3px!important;background:#efe9df!important;overflow:hidden!important}#productDialog .product-thumb img{display:block!important;width:100%!important;height:100%!important;opacity:1!important;visibility:visible!important;object-fit:contain!important;background:#efe9df!important}`;document.head.appendChild(style);
})();