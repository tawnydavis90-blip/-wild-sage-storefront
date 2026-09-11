(()=>{
  let catalogPromise=null;
  const catalog=()=>catalogPromise||(catalogPromise=fetch('/api/products',{headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():Promise.reject(new Error('catalog'))).then(d=>Array.isArray(d.products)?d.products:[]).catch(()=>[]));
  const available=p=>(p?.variants||[]).filter(v=>v.available!==false&&v.is_available!==false&&v.is_enabled!==false);
  async function exactProduct(card){
    const id=String(card?.dataset?.productId||'').trim();
    const list=await catalog();
    if(id){const byId=list.find(p=>String(p.id)===id);if(byId)return byId;}
    const title=card?.querySelector('.product-title')?.textContent?.trim()||'';
    const matches=list.filter(p=>String(p.title||'').trim()===title);
    return matches.length===1?matches[0]:null;
  }
  document.addEventListener('click',async e=>{
    const hit=e.target.closest?.('.product-card .details,.product-card .quick-add,.product-card .product-image-wrap');
    if(!hit)return;
    const card=hit.closest('.product-card');
    if(!card)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    const p=await exactProduct(card);
    if(!p){console.warn('Wild Sage: could not uniquely resolve product card',card.dataset.productId);return;}
    if(hit.classList.contains('quick-add')){
      const vars=available(p);
      if(vars.length===1&&typeof window.addToCart==='function'&&typeof window.openBag==='function'){
        window.addToCart(p,vars[0],1);window.openBag();return;
      }
    }
    const open=window.__wildSageOpenProduct||window.openProduct;
    if(typeof open==='function')open(p);
  },true);
})();
