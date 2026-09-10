(() => {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  let landingMode = true;
  let merch = new Map();
  const $ = (s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];

  function applyCurrentDrop(){
    if(!landingMode) return;
    const cards=$$('.product-card','#productGrid' in document ? document : document);
    let marked=0;
    cards.forEach(card=>{
      const id=String(card.dataset.productId||'');
      const isCurrent=Boolean(merch.get(id)?.currentDrop);
      if(isCurrent) marked++;
      card.hidden=!isCurrent;
    });
    const status=$('#statusCard');
    if(cards.length && !marked && status){
      status.hidden=false;
      status.textContent='The Current Drop is being curated. Check back soon.';
    }
  }

  async function loadMerch(){
    try{
      const r=await fetch('/api/merchandising',{headers:{Accept:'application/json'}}),d=await r.json();
      merch=new Map((d.items||[]).map(x=>[String(x.productId),x]));
      applyCurrentDrop();
    }catch(e){console.warn('Current Drop settings unavailable:',e);}
  }

  document.addEventListener('click',e=>{
    if(e.target.closest?.('.category,[data-shop-filter],#showAllBtn')) landingMode=false;
  },true);
  window.addEventListener('wildsage:merchandising-ready',()=>setTimeout(applyCurrentDrop,0));
  document.addEventListener('DOMContentLoaded',()=>{
    loadMerch();
    const grid=$('#productGrid');
    if(grid)new MutationObserver(()=>setTimeout(applyCurrentDrop,0)).observe(grid,{childList:true});
  });
  window.addEventListener('load',()=>{
    if(!location.hash){requestAnimationFrame(()=>scrollTo(0,0));setTimeout(()=>scrollTo(0,0),120);}
  });
})();