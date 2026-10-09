(() => {
  const newId=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
  function storedId(storageName,key){
    try{const storage=window[storageName];let id=storage.getItem(key);if(!id){id=newId();storage.setItem(key,id);}return id;}
    catch{return newId();}
  }
  const sessionId=storedId('sessionStorage','wild_sage_session_id');
  const visitorId=storedId('localStorage','wild_sage_visitor_id');
  function send(type,productId=''){
    const body=JSON.stringify({type,productId,sessionId,visitorId,path:location.pathname});
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
