(()=>{
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const sizeRe=/^(?:XXS|XS|S|M|L|XL|XXL|XXXL|[2-6]XL|[0-9]{1,2}(?:\.[0-9])?|ONE SIZE)$/i;
  const swatches={
    black:'#111111','solid black':'#111111','vintage black':'#2b2927','dark heather':'#4b4c4f','dark grey':'#555654',charcoal:'#41413f',
    grey:'#777975',gray:'#777975','heather grey':'#a1a3a1','sport grey':'#b4b4b1','ash':'#c8c7c2',white:'#f7f5ef',natural:'#ddd0b7',cream:'#eadfc8',ivory:'#eee5d3',bone:'#d2c6b2',sand:'#bca98c',tan:'#a98565',
    brown:'#6e4a35',chocolate:'#55382c','dark chocolate':'#473126',sage:'#89927a','light sage':'#aab39d',olive:'#646a4c','military green':'#596246','forest green':'#304b39','kelly green':'#2f7d4f',green:'#5d7455',
    navy:'#25344b','dark navy':'#1f2b3d','heather navy':'#3d4b60',blue:'#526d83','royal blue':'#315f9b','light blue':'#91aabd','baby blue':'#a8c7d8','teal':'#3f7473','aqua':'#73aeb1',
    red:'#9a3e3a','cardinal':'#7a2635','cardinal red':'#7a2635',maroon:'#653a40',burgundy:'#643640',rust:'#a55e43',orange:'#bf7044','burnt orange':'#a95c38',
    pink:'#c98e91','light pink':'#ddb0b2','hot pink':'#d95b8b',mauve:'#a8747e','dusty rose':'#b47d7b',purple:'#70566f',lavender:'#a496b2','berry':'#8b4d67',
    yellow:'#c6a85b','mustard':'#b68a37',gold:'#b18a4b'
  };
  const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
  const swatch=name=>{
    const n=String(name||'').toLowerCase().replace(/\b(heathered|blend|solid|vintage)\b/g,m=>m).trim();
    if(swatches[n])return swatches[n];
    const key=Object.keys(swatches).sort((a,b)=>b.length-a.length).find(k=>n.includes(k));
    if(key)return swatches[key];
    return '#9a8a76';
  };
  function parts(v){const a=String(v?.title||'').split(/\s*\/\s*|\s+-\s+/).map(x=>x.trim()).filter(Boolean);if(!a.length)return{color:'Standard',size:'One Size'};if(a.length===1)return sizeRe.test(a[0])?{color:'Standard',size:a[0]}:{color:a[0],size:'One Size'};if(sizeRe.test(a[0]))return{color:a.slice(1).join(' / '),size:a[0]};if(sizeRe.test(a[a.length-1]))return{color:a.slice(0,-1).join(' / '),size:a[a.length-1]};return{color:a[0],size:a.slice(1).join(' / ')}};
  const available=p=>(p?.variants||[]).filter(v=>v.available!==false&&v.is_available!==false&&v.is_enabled!==false).map(v=>({...v,...parts(v)}));
  function imagesForColor(p,vars,color){
    const ids=new Set(vars.filter(v=>v.color===color).map(v=>String(v.id)));
    return (p?.images||[]).filter(i=>{const vi=(i.variantIds||[]).map(String);return !vi.length||vi.some(id=>ids.has(id));});
  }
  function viewImage(p,vars,color,view){
    const imgs=imagesForColor(p,vars,color),want=String(view||'front').toLowerCase();
    const exact=imgs.find(i=>String(i.position||'').toLowerCase().includes(want));
    if(exact?.src)return exact.src;
    if(want==='front')return imgs[0]?.src||p?.images?.find(i=>String(i.position||'').toLowerCase().includes('front'))?.src||p?.images?.[0]?.src||'';
    return '';
  }
  function openProductSimple(p){
    const dialog=$('#productDialog'),content=$('#productDialogContent');if(!dialog||!content||!p)return;
    const vars=available(p),colors=[...new Set(vars.map(v=>v.color))];let color=colors[0]||'Standard',size='',qty=1,view='front';
    content.innerHTML='';
    const grid=document.createElement('div');grid.className='product-dialog-grid';
    const gallery=document.createElement('div');gallery.className='product-gallery simple-gallery';
    const frame=document.createElement('div');frame.className='main-image-frame';
    const main=document.createElement('img');main.id='dialogMainImage';main.alt=p.title||'Product';frame.appendChild(main);gallery.appendChild(frame);
    const toggle=document.createElement('div');toggle.className='product-view-toggle';gallery.appendChild(toggle);grid.appendChild(gallery);
    const copy=document.createElement('div');copy.className='product-dialog-copy';
    const eyebrow=document.createElement('p');eyebrow.className='eyebrow';eyebrow.textContent=(p.tags||[]).slice(0,2).join(' ✦ ')||'WILD SAGE';
    const h=document.createElement('h2');h.textContent=p.title||'Product';
    const price=document.createElement('p');price.className='price';price.textContent=`From ${money(p.minPrice)}`;
    const desc=document.createElement('div');desc.className='product-description';desc.innerHTML=p.description||'';copy.append(eyebrow,h,price,desc);
    const refreshView=()=>{
      if(view==='back'&&!viewImage(p,vars,color,'back'))view='front';
      main.src=viewImage(p,vars,color,view)||viewImage(p,vars,color,'front');
      toggle.innerHTML='';
      const front=document.createElement('button');front.type='button';front.className='view-choice'+(view==='front'?' active':'');front.textContent='Front';front.onclick=()=>{view='front';refreshView()};toggle.appendChild(front);
      if(viewImage(p,vars,color,'back')){const back=document.createElement('button');back.type='button';back.className='view-choice'+(view==='back'?' active':'');back.textContent='Back';back.onclick=()=>{view='back';refreshView()};toggle.appendChild(back)}
      toggle.hidden=toggle.children.length<2;
    };
    if(vars.length){
      const picker=document.createElement('div');picker.className='variant-picker';picker.innerHTML='<div class="picker-label"><span>Color</span><strong id="chosenColor"></strong></div><div id="colorChoices" class="color-choices"></div><div class="picker-label"><span>Size</span><strong id="chosenSize">Select</strong></div><div id="sizeChoices" class="size-choices"></div>';copy.appendChild(picker);
      const sticky=document.createElement('div');sticky.className='sticky-add';sticky.innerHTML='<div class="quantity-control"><button id="qtyMinus" type="button">−</button><span id="qtyValue">1</span><button id="qtyPlus" type="button">+</button></div><button id="dialogAdd" type="button" disabled>Add to bag</button>';copy.appendChild(sticky);
      const note=document.createElement('p');note.className='availability-note';note.textContent='Choose a color, then select an available size.';copy.appendChild(note);
      grid.appendChild(copy);content.appendChild(grid);
      const cc=$('#colorChoices',copy),sc=$('#sizeChoices',copy),chosenColor=$('#chosenColor',copy),chosenSize=$('#chosenSize',copy),add=$('#dialogAdd',copy);
      const selected=()=>vars.find(v=>v.color===color&&v.size===size);
      const renderSizes=()=>{const sizes=[...new Set(vars.filter(v=>v.color===color).map(v=>v.size))];if(!sizes.includes(size))size='';sc.innerHTML='';sizes.forEach(s=>{const b=document.createElement('button');b.type='button';b.className='size-choice'+(s===size?' active':'');b.textContent=s;b.onclick=()=>{size=s;renderSizes()};sc.appendChild(b)});chosenSize.textContent=size||'Select';const v=selected();add.disabled=!v;if(v)price.textContent=money(v.price)};
      const renderColors=()=>{cc.innerHTML='';colors.forEach(c=>{const b=document.createElement('button');b.type='button';b.className='color-choice'+(c===color?' active':'');b.title=c;b.setAttribute('aria-label',c);const dot=document.createElement('span');dot.style.background=swatch(c);b.appendChild(dot);b.onclick=()=>{color=c;size='';view='front';renderColors();refreshView();renderSizes()};cc.appendChild(b)});chosenColor.textContent=color};
      renderColors();refreshView();renderSizes();
      $('#qtyMinus',copy).onclick=()=>{$('#qtyValue',copy).textContent=qty=Math.max(1,qty-1)};
      $('#qtyPlus',copy).onclick=()=>{$('#qtyValue',copy).textContent=qty=Math.min(10,qty+1)};
      add.onclick=()=>{const v=selected();if(!v)return;if(typeof window.addToCart==='function')window.addToCart(p,v,qty);dialog.close();if(typeof window.openBag==='function')window.openBag()};
    }else{const sold=document.createElement('p');sold.className='sold-out';sold.textContent='This piece is currently unavailable.';copy.appendChild(sold);grid.appendChild(copy);content.appendChild(grid);refreshView()}
    if(!dialog.open)dialog.showModal();
  }
  window.openProduct=openProductSimple;window.__wildSageOpenProduct=openProductSimple;
  const style=document.createElement('style');style.textContent=`#productDialog .product-thumbs{display:none!important}#productDialog .simple-gallery{display:block!important}#productDialog .main-image-frame{width:100%!important;min-height:320px!important;display:grid!important;place-items:center!important;background:#efe9df!important}#productDialog #dialogMainImage{display:block!important;width:100%!important;height:auto!important;max-height:70vh!important;object-fit:contain!important;background:#efe9df!important}#productDialog .product-view-toggle{display:flex!important;gap:8px!important;justify-content:center!important;margin-top:12px!important}#productDialog .view-choice{padding:8px 16px!important;border:1px solid rgba(238,231,220,.35)!important;background:transparent!important;color:#eee7dc!important;border-radius:999px!important;text-transform:uppercase!important;letter-spacing:.08em!important;font-size:.7rem!important}#productDialog .view-choice.active{background:#eee7dc!important;color:#111!important}#productDialog .color-choice{display:inline-grid!important;place-items:center!important;width:44px!important;min-width:44px!important;max-width:44px!important;height:44px!important;min-height:44px!important;max-height:44px!important;border-radius:50%!important;padding:5px!important}#productDialog .color-choice span{display:block!important;width:32px!important;height:32px!important;border-radius:50%!important}#productDialog .size-choice{width:auto!important;min-width:50px!important;height:42px!important;border-radius:3px!important;padding:0 13px!important}@media(max-width:760px){#productDialog .main-image-frame{min-height:260px!important}}`;document.head.appendChild(style);
})();