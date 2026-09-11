(()=>{
  let catalog=null;
  async function products(){
    if(Array.isArray(window.__wildSageProducts)&&window.__wildSageProducts.length)return window.__wildSageProducts;
    if(catalog)return catalog;
    try{const r=await fetch('/api/products',{headers:{Accept:'application/json'}}),d=await r.json();catalog=Array.isArray(d.products)?d.products:[];return catalog}catch{return[]}
  }
  function findProduct(card,list){
    const id=String(card?.dataset?.productId||'');
    if(id){const p=list.find(x=>String(x.id)===id);if(p)return p;}
    const title=card?.querySelector('.product-title')?.textContent?.trim()||'';
    return list.find(x=>String(x.title||'').trim()===title)||null;
  }
  function available(p){return(p?.variants||[]).filter(v=>v.available!==false&&v.is_available!==false&&v.is_enabled!==false)}
  async function openFromCard(card,quick=false){
    const list=await products(),p=findProduct(card,list);if(!p)return;
    if(quick){const vs=available(p);if(vs.length===1&&typeof window.__wildSageAddSingle==='function'){window.__wildSageAddSingle(p,vs[0]);return;}}
    const opener=window.__wildSageOpenProduct||window.openProduct;
    if(typeof opener==='function')opener(p);
  }
  document.addEventListener('click',e=>{
    const target=e.target.closest?.('.product-card .details,.product-card .quick-add,.product-card .product-image-wrap');
    if(!target)return;
    const card=target.closest('.product-card');if(!card)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    openFromCard(card,target.classList.contains('quick-add'));
  },true);
  const expose=()=>{
    if(typeof window.openProduct==='function')window.__wildSageOpenProduct=window.openProduct;
    if(typeof window.addToCart==='function'&&typeof window.openBag==='function')window.__wildSageAddSingle=(p,v)=>{window.addToCart(p,v,1);window.openBag();};
  };
  expose();setTimeout(expose,0);setTimeout(expose,500);
})();
