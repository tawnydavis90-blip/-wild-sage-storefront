(()=>{
  let catalogPromise=null;
  function getCatalog(){
    if(Array.isArray(window.__wildSageProducts)&&window.__wildSageProducts.length)return Promise.resolve(window.__wildSageProducts);
    if(!catalogPromise)catalogPromise=fetch('/api/products',{headers:{Accept:'application/json'}}).then(r=>r.json()).then(d=>Array.isArray(d.products)?d.products:[]).catch(()=>[]);
    return catalogPromise;
  }
  function productFrom(card,list){
    const id=String(card?.dataset?.productId||'');
    if(id){const p=list.find(x=>String(x.id)===id);if(p)return p;}
    const title=card?.querySelector('.product-title')?.textContent?.trim()||'';
    return list.find(x=>String(x.title||'').trim()===title)||null;
  }
  async function handle(e){
    const action=e.target.closest?.('.details,.quick-add,.product-image-wrap');
    if(!action)return;
    const card=action.closest('.product-card');
    if(!card)return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const list=await getCatalog();
    const product=productFrom(card,list);
    if(!product)return;
    if(typeof window.openProduct==='function')window.openProduct(product);
  }
  document.addEventListener('click',handle,true);
})();
