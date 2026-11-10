(() => {
  const newId=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
  function storedId(storageName,key){
    try{const storage=window[storageName];let id=storage.getItem(key);if(!id){id=newId();storage.setItem(key,id);}return id;}
    catch{return newId();}
  }
  const sessionId=storedId('sessionStorage','wild_sage_session_id');
  const visitorId=storedId('localStorage','wild_sage_visitor_id');
  function send(type,productId=''){
    const body=JSON.stringify({type,productId,sessionId,visitorId,path:location.pathname,trackingVersion:2});
    if(navigator.sendBeacon){navigator.sendBeacon('/api/analytics/event',new Blob([body],{type:'application/json'}));return;}
    fetch('/api/analytics/event',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{});
  }
  window.addEventListener('wildsage:cart-added',e=>send('add_to_bag',String(e.detail?.productId||'')));
  window.addEventListener('wildsage:checkout-ready',()=>send('checkout_start'));
  send('page_view');
  document.addEventListener('click',e=>{
    const card=e.target.closest('.product-card');
    if(card&&(e.target.closest('.details')||e.target.closest('.product-image-wrap'))){send('product_view',card.dataset.productId||'');}

  },true);
})();
