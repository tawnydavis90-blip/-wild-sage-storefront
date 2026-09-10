(()=>{
  const findProduct=card=>{
    const id=String(card?.dataset?.productId||'');
    const list=window.__wildSageProducts||[];
    if(id){const p=list.find(x=>String(x.id)===id);if(p)return p;}
    const title=card?.querySelector('.product-title')?.textContent?.trim();
    return list.find(x=>String(x.title||'').trim()===title)||null;
  };
  function wire(card){
    if(!card||card.dataset.actionsRepaired==='1')return;
    card.dataset.actionsRepaired='1';
    const details=card.querySelector('.details');
    const quick=card.querySelector('.quick-add');
    const image=card.querySelector('.product-image-wrap');
    const product=findProduct(card);
    const open=()=>{
      const p=findProduct(card)||product;
      if(!p)return;
      if(typeof window.openProduct==='function') window.openProduct(p);
      else if(details?.onclick) details.onclick();
    };
    if(details){details.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();open();},true);}
    if(image){image.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();open();},true);}
    if(quick){quick.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();open();},true);}
  }
  function wireAll(){document.querySelectorAll('.product-card').forEach(wire);}
  const start=()=>{
    wireAll();
    const grid=document.querySelector('#productGrid');
    if(grid)new MutationObserver(()=>requestAnimationFrame(wireAll)).observe(grid,{childList:true,subtree:true});
    document.addEventListener('wildsage:showcases-rendered',()=>requestAnimationFrame(wireAll));
    window.addEventListener('wildsage:merchandising-ready',()=>requestAnimationFrame(wireAll));
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();