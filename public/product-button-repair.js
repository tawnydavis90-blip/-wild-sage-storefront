(()=>{
  const findProduct=card=>{
    const id=String(card?.dataset?.productId||'');
    const list=window.__wildSageProducts||[];
    if(id){const p=list.find(x=>String(x.id)===id);if(p)return p;}
    const title=card?.querySelector('.product-title')?.textContent?.trim();
    return list.find(x=>String(x.title||'').trim()===title)||null;
  };

  function openCard(card){
    const product=findProduct(card);
    if(!product)return false;
    if(typeof window.openProduct==='function'){
      window.openProduct(product);
      return true;
    }
    return false;
  }

  /* Use one delegated capture handler so rebuilt/featured/best-seller clones
     cannot lose their product actions. This also avoids cloned data flags
     preventing buttons from being rewired. */
  document.addEventListener('click',e=>{
    const action=e.target.closest?.('.details,.quick-add,.product-image-wrap');
    if(!action)return;
    const card=action.closest('.product-card');
    if(!card)return;

    const product=findProduct(card);
    if(!product)return;

    e.preventDefault();
    e.stopImmediatePropagation();

    // Most Wild Sage products have color/size choices, so Quick Add should
    // open the chooser rather than guessing a variant. Single-variant items
    // still open instantly to a one-choice product panel.
    openCard(card);
  },true);

  /* Remove the stale marker copied into showcase clones by cloneNode(). */
  function clean(){document.querySelectorAll('.product-card[data-actions-repaired]').forEach(c=>delete c.dataset.actionsRepaired);}
  const start=()=>{
    clean();
    const body=document.body;
    if(body)new MutationObserver(()=>requestAnimationFrame(clean)).observe(body,{childList:true,subtree:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();