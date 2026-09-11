(()=>{
  function resolveProduct(card){
    const id=String(card?.dataset?.productId||'').trim();
    if(id){const p=state.products.find(x=>String(x.id)===id);if(p)return p;}
    const title=card?.querySelector('.product-title')?.textContent?.trim()||'';
    return state.products.find(x=>String(x.title||'').trim()===title)||null;
  }
  document.addEventListener('click',e=>{
    const action=e.target.closest?.('.details,.quick-add,.product-image-wrap');
    if(!action)return;
    const card=action.closest('.product-card');
    if(!card)return;
    const product=resolveProduct(card);
    if(!product)return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if(action.classList.contains('quick-add')){
      const variants=availableVariants(product);
      if(variants.length===1){addToCart(product,variants[0],1);openBag();return;}
    }
    openProduct(product);
  },true);
})();