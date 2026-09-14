(() => {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  let landingMode = true;
  let merch = new Map();
  let applying = false;
  let scheduled = false;
  const $ = (s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];

  function applyCurrentDrop(){
    if(!landingMode || applying) return;
    const grid=$('#productGrid');
    if(!grid) return;
    applying=true;
    const cards=$$('.product-card',grid);
    let marked=0;
    cards.forEach(card=>{
      const id=String(card.dataset.productId||'');
      const isCurrent=Boolean(merch.get(id)?.currentDrop);
      if(isCurrent) marked++;
      const shouldHide=!isCurrent;
      if(card.hidden!==shouldHide) card.hidden=shouldHide;
    });
    const status=$('#statusCard');
    if(cards.length && !marked && status){
      status.hidden=false;
      status.textContent='The Current Drop is being curated. Check back soon.';
    }
    applying=false;
  }

  function scheduleApply(){
    if(!landingMode || scheduled) return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      applyCurrentDrop();
    });
  }

  function leaveLandingMode(){
    landingMode=false;
  }

  async function loadMerch(){
    try{
      const r=await fetch('/api/merchandising',{headers:{Accept:'application/json'}}),d=await r.json();
      merch=new Map((d.items||[]).map(x=>[String(x.productId),x]));
      applyCurrentDrop();
    }catch(e){console.warn('Current Drop settings unavailable:',e);}
  }

  document.addEventListener('click',e=>{
    if(e.target.closest?.('.category,[data-shop-filter],#showAllBtn')) leaveLandingMode();
  },true);
  window.addEventListener('wildsage:show-all-products',leaveLandingMode);
  window.addEventListener('wildsage:merchandising-ready',scheduleApply);
  document.addEventListener('DOMContentLoaded',()=>{
    loadMerch();
    const grid=$('#productGrid');
    if(grid)new MutationObserver(scheduleApply).observe(grid,{
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['hidden']
    });
  });
  window.addEventListener('load',()=>{
    if(!location.hash){requestAnimationFrame(()=>scrollTo(0,0));setTimeout(()=>scrollTo(0,0),120);}
    [100,500,1500,3000,6000].forEach(delay=>setTimeout(scheduleApply,delay));
  });
})();
