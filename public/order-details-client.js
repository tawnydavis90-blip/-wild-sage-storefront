(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=(n,c='USD')=>new Intl.NumberFormat('en-US',{style:'currency',currency:c}).format(Number(n||0));
  const drawer=$('#orderDetailDrawer'), backdrop=$('#orderDetailBackdrop'), content=$('#orderDetailContent'), close=$('#closeOrderDetail');
  if(!drawer||!content) return;

  function formatAddress(a){
    if(!a) return 'Not provided';
    return [a.line1,a.line2,[a.city,a.state,a.postalCode].filter(Boolean).join(', '),a.country].filter(Boolean).map(esc).join('<br>')||'Not provided';
  }
  function closeDrawer(){drawer.classList.remove('open');drawer.setAttribute('aria-hidden','true');if(backdrop)backdrop.hidden=true;}
  async function openOrder(id){
    drawer.classList.add('open');drawer.setAttribute('aria-hidden','false');if(backdrop)backdrop.hidden=false;
    content.innerHTML='<div class="order-detail-loading">Loading order details…</div>';
    try{
      const res=await fetch(`/api/admin/orders/${encodeURIComponent(id)}`,{headers:{Accept:'application/json'}});
      const d=await res.json(); if(!res.ok) throw new Error(d.error||'Unable to load order details.');
      content.innerHTML=`
        <div class="order-detail-head"><p class="eyebrow">ORDER DETAILS</p><h2>${esc(d.customer?.name||d.customer?.email||'Stripe order')}</h2><p class="muted">${esc(new Date(d.created).toLocaleString())}</p></div>
        <div class="order-detail-status"><span class="${d.paymentStatus==='paid'?'paid-pill':'status-pill'}">${esc(d.paymentStatus||d.status||'unknown')}</span><strong>${money(d.amountTotal,d.currency)}</strong></div>
        <div class="detail-grid">
          <section class="detail-card"><h3>Customer</h3><p><strong>${esc(d.customer?.name||'Not provided')}</strong><br>${esc(d.customer?.email||'No email')}<br>${esc(d.customer?.phone||'No phone')}</p><p>${formatAddress(d.customer?.address)}</p></section>
          <section class="detail-card"><h3>Shipping</h3><p><strong>${esc(d.shipping?.name||d.customer?.name||'Not provided')}</strong></p><p>${formatAddress(d.shipping?.address)}</p></section>
        </div>
        <section class="detail-card"><h3>Items</h3><div class="detail-items">${(d.items||[]).map(i=>`<div class="detail-item"><div><strong>${esc(i.productName||i.description)}</strong><span>${esc(i.description)}</span></div><div>× ${i.quantity}</div><strong>${money(i.amountTotal,i.currency||d.currency)}</strong></div>`).join('')||'<p class="muted">No line items found.</p>'}</div></section>
        <section class="detail-card"><h3>Totals</h3><div class="totals-list"><div><span>Subtotal</span><strong>${money(d.amountSubtotal,d.currency)}</strong></div><div><span>Shipping</span><strong>${money(d.shippingAmount,d.currency)}</strong></div><div><span>Tax</span><strong>${money(d.taxAmount,d.currency)}</strong></div><div><span>Discounts</span><strong>−${money(d.discountAmount,d.currency)}</strong></div><div class="grand-total"><span>Total</span><strong>${money(d.amountTotal,d.currency)}</strong></div></div></section>
        <section class="detail-card"><h3>Payment & IDs</h3><dl class="detail-dl"><div><dt>Checkout session</dt><dd>${esc(d.id)}</dd></div><div><dt>Payment intent</dt><dd>${esc(d.payment?.intentId||'Not available')}</dd></div><div><dt>Payment method</dt><dd>${esc((d.payment?.paymentMethodTypes||[]).join(', ')||'Not available')}</dd></div><div><dt>Client reference</dt><dd>${esc(d.clientReferenceId||'Not available')}</dd></div><div><dt>Cart ID</dt><dd>${esc(d.metadata?.cart_id||'Not available')}</dd></div></dl></section>`;
    }catch(err){content.innerHTML=`<div class="order-detail-error">${esc(err.message)}</div>`;}
  }

  async function bindRows(){
    const list=$('#ordersList'); if(!list) return;
    try{
      const res=await fetch('/api/admin/orders',{headers:{Accept:'application/json'}}),d=await res.json();
      if(!res.ok||!Array.isArray(d.orders)) return;
      const rows=$$('.order-card',list);
      rows.forEach((row,i)=>{const order=d.orders[i];if(!order)return;row.dataset.orderId=order.id;row.classList.add('clickable-order');row.setAttribute('role','button');row.setAttribute('tabindex','0');row.onclick=()=>openOrder(order.id);row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openOrder(order.id);}};});
    }catch{}
  }

  const observer=new MutationObserver(()=>setTimeout(bindRows,0));
  const ordersList=$('#ordersList'); if(ordersList)observer.observe(ordersList,{childList:true});
  document.querySelector('[data-tab="orders"]')?.addEventListener('click',()=>setTimeout(bindRows,250));
  close?.addEventListener('click',closeDrawer);backdrop?.addEventListener('click',closeDrawer);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer();});
})();
