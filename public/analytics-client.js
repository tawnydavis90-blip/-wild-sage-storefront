(() => {
  const SESSION_KEY='wild_sage_session_id';
  let sessionId=sessionStorage.getItem(SESSION_KEY);
  if(!sessionId){sessionId=(crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`);sessionStorage.setItem(SESSION_KEY,sessionId);}
  function send(type,productId=''){
    const body=JSON.stringify({type,productId,sessionId,path:location.pathname});
    if(navigator.sendBeacon){navigator.sendBeacon('/api/analytics/event',new Blob([body],{type:'application/json'}));return;}
    fetch('/api/analytics/event',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{});
  }
  send('page_view');
  document.addEventListener('click',e=>{
    const card=e.target.closest('.product-card');
    if(card&&(e.target.closest('.details')||e.target.closest('.product-image-wrap'))){send('product_view',card.dataset.productId||'');}
    if(e.target.closest('.quick-add'))send('add_to_bag',card?.dataset.productId||'');
    if(e.target.closest('#dialogAdd')){const dialog=document.querySelector('#productDialogContent h2')?.textContent?.trim()||'';const p=(window.__wildSageProducts||[]).find(x=>String(x.title||'').trim()===dialog);send('add_to_bag',p?.id||'');}
    if(e.target.closest('#checkoutBtn'))send('checkout_start');
  },true);
})();
