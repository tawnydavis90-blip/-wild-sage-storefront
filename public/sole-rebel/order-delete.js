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

  function installTabs(){
    const app=document.getElementById('app');
    const metrics=document.getElementById('metrics');
    const photoPanel=app?.querySelector('.photo-panel');
    const orders=document.getElementById('orders');
    const refresh=document.getElementById('refreshBtn')?.parentElement;
    if(!app||!metrics||!photoPanel||!orders||app.querySelector('[data-sr-tabs]'))return;

    const style=document.createElement('style');
    style.textContent=`
      .sr-tabs{display:flex;gap:8px;margin:22px 0 8px;border-bottom:1px solid var(--line);padding-bottom:10px;flex-wrap:wrap}
      .sr-tab{padding:10px 16px;border:1px solid #5b5a54;background:transparent;color:#fff;font-weight:800;cursor:pointer}
      .sr-tab.active{background:#fff;color:#111;border-color:#fff}
      .sr-pane.hidden-pane{display:none!important}
    `;
    document.head.appendChild(style);

    const tabs=document.createElement('nav');
    tabs.className='sr-tabs';
    tabs.dataset.srTabs='true';
    tabs.innerHTML='<button class="sr-tab active" type="button" data-pane="orders">Orders</button><button class="sr-tab" type="button" data-pane="photos">Storefront Photos</button>';
    metrics.parentNode.insertBefore(tabs,metrics);

    const orderPane=document.createElement('div');
    orderPane.className='sr-pane';
    orderPane.dataset.srPane='orders';
    metrics.parentNode.insertBefore(orderPane,metrics);
    orderPane.appendChild(metrics);
    if(refresh)orderPane.appendChild(refresh);
    orderPane.appendChild(orders);

    const photoPane=document.createElement('div');
    photoPane.className='sr-pane hidden-pane';
    photoPane.dataset.srPane='photos';
    orderPane.parentNode.insertBefore(photoPane,orderPane.nextSibling);
    photoPane.appendChild(photoPanel);

    function show(name){
      tabs.querySelectorAll('.sr-tab').forEach(b=>b.classList.toggle('active',b.dataset.pane===name));
      orderPane.classList.toggle('hidden-pane',name!=='orders');
      photoPane.classList.toggle('hidden-pane',name!=='photos');
      if(name==='photos'&&typeof window.loadPhotos==='function')window.loadPhotos();
      history.replaceState(null,'',name==='photos'?'#photos':'#orders');
    }
    tabs.querySelectorAll('.sr-tab').forEach(b=>b.onclick=()=>show(b.dataset.pane));
    if(location.hash==='#photos')show('photos');
  }

  function installDeleteButtons(){
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

  function install(){installTabs();installDeleteButtons();}
  new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();