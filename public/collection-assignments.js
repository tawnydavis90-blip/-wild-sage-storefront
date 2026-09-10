(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  let assignments=new Map();
  let currentFilter='all';
  let catalog=[];

  function autoMatch(p,filter){
    if(filter==='all')return true;
    const tags=(p?.tags||[]).join(' ').toLowerCase();
    const h=`${p?.title||''} ${tags}`.toLowerCase();
    if(filter==='crops')return /crop|cropped/.test(h);
    if(filter==='tanks')return /tank/.test(h);
    if(filter==='tees')return /\btee\b|t-shirt|shirt/.test(h);
    if(filter==='hoodies')return /hoodie|sweatshirt|fleece/.test(h);
    if(filter==='fall')return /fall|autumn|halloween|horror/.test(h);
    return h.includes(filter);
  }

  function productForCard(card){
    const id=card.dataset.productId;
    if(id){const found=catalog.find(p=>String(p.id)===String(id));if(found)return found;}
    const title=$('.product-title',card)?.textContent?.trim()||'';
    return catalog.find(p=>String(p.title||'').trim()===title)||null;
  }

  function applyFilter(){
    const grid=$('#productGrid');if(!grid)return;
    $$('.product-card',grid).forEach(card=>{
      const p=productForCard(card);if(!p)return;
      const manual=assignments.has(String(p.id));
      const selected=assignments.get(String(p.id))||[];
      const visible=currentFilter==='all'||(manual?selected.includes(currentFilter):autoMatch(p,currentFilter));
      card.dataset.collectionVisible=visible?'true':'false';
      if(!visible)card.hidden=true;
      else{
        const q=($('#catalogSearch')?.value||'').trim().toLowerCase();
        const haystack=`${p.title||''} ${(p.tags||[]).join(' ')}`.toLowerCase();
        card.hidden=Boolean(q&&!haystack.includes(q));
      }
    });
  }

  function collectionUrl(filter){return `/collections/${encodeURIComponent(String(filter||'').toLowerCase())}`;}
  function activate(filter){
    currentFilter=filter||'all';
    $$('.category').forEach(b=>b.classList.toggle('active',b.dataset.filter===currentFilter));
    applyFilter();
    $('#drop')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  async function load(){
    try{
      const [a,p]=await Promise.all([fetch('/api/product-collections').then(r=>r.json()),fetch('/api/products').then(r=>r.json())]);
      assignments=new Map((a.items||[]).map(x=>[String(x.productId),Array.isArray(x.collections)?x.collections:[]]));
      catalog=Array.isArray(p.products)?p.products:[];
      window.__wildSageProductCollections=assignments;
      applyFilter();
    }catch(err){console.warn('Collection assignments unavailable:',err);}
  }

  function bind(){
    document.addEventListener('click',e=>{
      const category=e.target.closest?.('.category');
      if(category){
        const filter=category.dataset.filter||'all';
        e.preventDefault();e.stopImmediatePropagation();
        if(filter==='all'){activate('all');return;}
        window.location.href=collectionUrl(filter);return;
      }
      if(e.target.closest?.('#showAllBtn')){e.preventDefault();e.stopImmediatePropagation();activate('all');}
    },true);
    document.addEventListener('input',e=>{if(e.target?.id==='catalogSearch')setTimeout(applyFilter,0);},true);
    document.addEventListener('change',e=>{if(e.target?.id==='catalogSort')setTimeout(applyFilter,0);},true);
    const grid=$('#productGrid');if(grid)new MutationObserver(()=>setTimeout(applyFilter,0)).observe(grid,{childList:true});
    window.addEventListener('wildsage:merchandising-ready',()=>setTimeout(applyFilter,0));
    load();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
