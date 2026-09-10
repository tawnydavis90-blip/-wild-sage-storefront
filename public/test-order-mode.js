(()=>{
  const params=new URLSearchParams(location.search);
  const testMode=params.get('test')==='1'||params.get('test_checkout')==='success'||params.get('test_checkout')==='cancelled';
  if(!testMode)return;
  function start(){
    const banner=document.createElement('div');banner.id='testModeBanner';banner.textContent='TEST ORDER MODE — no real payment and nothing will be sent to Printify';document.body.prepend(banner);
    const style=document.createElement('style');style.textContent='#testModeBanner{position:sticky;top:0;z-index:9999;background:#d9c09a;color:#11130f;text-align:center;padding:9px 14px;font:700 .72rem Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase}.site-header{top:34px!important}';document.head.appendChild(style);
    const checkout=document.querySelector('#checkoutBtn');
    if(checkout){checkout.textContent='Test Checkout';checkout.onclick=async()=>{const cart=JSON.parse(localStorage.getItem('wildSageCart')||'[]');const msg=document.querySelector('#checkoutMessage');if(!cart.length){if(msg)msg.textContent='Your bag is empty.';return;}checkout.disabled=true;checkout.textContent='Opening test checkout…';try{const r=await fetch('/api/admin/test-checkout',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({items:cart.map(i=>({productId:i.productId,variantId:i.variantId,quantity:i.quantity}))})}),d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to start test checkout.');location.href=d.url;}catch(e){if(msg)msg.textContent=e.message||'Unable to start test checkout.';checkout.disabled=false;checkout.textContent='Test Checkout';}};}
    if(params.get('test_checkout')==='success'){
      localStorage.removeItem('wildSageCart');
      const notice=document.createElement('div');notice.style.cssText='position:fixed;right:18px;bottom:18px;z-index:9999;max-width:360px;background:#11130f;color:#eee7dc;border:1px solid rgba(238,231,220,.25);padding:18px;box-shadow:0 16px 40px rgba(0,0,0,.4)';notice.innerHTML='<strong>Test payment succeeded ✓</strong><br><small>This was Stripe test mode. No money was charged and the order was blocked from Printify production. Open Admin → Orders to inspect it.</small>';document.body.appendChild(notice);
    }
    if(params.get('test_checkout')==='cancelled'){const msg=document.querySelector('#checkoutMessage');if(msg)msg.textContent='Test checkout was cancelled. Your bag is still saved.';}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();