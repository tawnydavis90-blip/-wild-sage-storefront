(()=>{
  async function removeOrder(id,label){
    const name=label||'this order';
    if(!confirm(`Permanently delete ${name} from the Sage & Ember database?\n\nThis cannot be undone.`))return;
    try{
      const r=await fetch('/api/admin/orders/'+encodeURIComponent(id),{method:'DELETE',credentials:'same-origin'});
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.error||'Unable to delete order');
      if(typeof window.loadOrders==='function')await window.loadOrders();
      else location.reload();
    }catch(e){alert(e.message||'Unable to delete order');}
  }
  function install(){
    document.querySelectorAll('.order').forEach(card=>{
      const row=card.querySelector('.admin-row');
      if(!row||row.querySelector('[data-delete-order]'))return;
      const carrier=card.querySelector('select[id^="carrier-"]');
      if(!carrier)return;
      const id=carrier.id.replace(/^carrier-/, '');
      const label=card.querySelector('.meta strong')?.textContent?.trim()||'this order';
      const b=document.createElement('button');
      b.type='button';
      b.className='btn';
      b.dataset.deleteOrder='true';
      b.style.borderColor='#a33';
      b.style.color='#8b1e1e';
      b.textContent='Delete order';
      b.onclick=()=>removeOrder(id,label);
      row.appendChild(b);
    });
  }
  new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();