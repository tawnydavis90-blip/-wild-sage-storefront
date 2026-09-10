(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  let period='30d', lastData=null;
  async function json(url,options={}){const res=await fetch(url,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'Request failed.');return data;}
  function card(label,value,cls=''){return `<div class="accounting-card ${cls}"><span>${esc(label)}</span><strong>${value}</strong></div>`;}
  function render(data){
    lastData=data;
    const s=data.stripe||{}, p=data.printify||{}, e=data.expenses||{};
    $('#accountingCards').innerHTML=[
      card('Gross sales',money(s.grossSales)),
      card('Refunds',money(s.refunds),'negative'),
      card('Stripe fees',money(s.stripeFees),'negative'),
      card('Printify product cost',money(p.productCost),'negative'),
      card('Printify shipping',money(p.shippingCost),'negative'),
      card('Printify tax',money(p.taxCost),'negative'),
      card('Total fulfillment cost',money(p.fulfillmentCost),'negative'),
      card('Business expenses',money(e.total),'negative'),
      card('True operating profit',money(data.trueNet),data.trueNet>=0?'positive':'negative'),
      card(`Tax reserve · ${Number(data.taxReservePercent||0)}%`,money(data.taxReserveEstimate),'negative'),
      card('After tax reserve',money(data.estimatedAfterTaxReserve),data.estimatedAfterTaxReserve>=0?'positive':'negative')
    ].join('');
    const warning=$('#accountingWarning');
    const warnings=[];
    if(s.hasMore) warnings.push('Stripe returned more than 100 balance transactions in this period, so Stripe totals cover the latest 100 returned transactions.');
    if(p.hasMoreStripeSessions) warnings.push('There are more than 100 Stripe checkout sessions in this period; Printify reconciliation is limited to the latest 100 returned sessions.');
    if(!p.configured) warnings.push('Printify cost reconciliation is not available because Printify is not configured on this service.');
    if(p.configured&&p.unmatchedPaidOrders>0) warnings.push(`${p.unmatchedPaidOrders} paid Stripe order${p.unmatchedPaidOrders===1?' is':'s are'} not matched to a Printify fulfillment order yet. Operating profit may be overstated until those fulfillment costs are matched.`);
    warning.hidden=!warnings.length;
    warning.textContent=warnings.join(' ');
    $('#taxReservePercent').value=Number(data.taxReservePercent||0);
    $('#accountingDisclaimer').textContent=data.disclaimer||'';
    const existing=$('#printifyReconciliation');
    if(existing) existing.remove();
    const summary=document.createElement('div');
    summary.id='printifyReconciliation';
    summary.className='admin-card';
    summary.innerHTML=`<h3>Printify Reconciliation</h3><div class="status-list">
      <div class="status-row"><span>Paid Stripe orders</span><strong>${Number(p.paidOrders||0)}</strong></div>
      <div class="status-row"><span>Matched to Printify</span><strong>${Number(p.matchedOrders||0)}</strong></div>
      <div class="status-row"><span>Unmatched</span><strong>${Number(p.unmatchedPaidOrders||0)}</strong></div>
      <div class="status-row"><span>Cost coverage</span><strong>${data.completeCostMatch?'Complete':'Needs review'}</strong></div>
    </div>${(p.orders||[]).length?`<div class="activity-list">${p.orders.map(o=>`<div class="activity-row"><span>${esc(o.status||'Printify order')}<br><small>${esc(o.printifyOrderId||'')}</small></span><strong>${money(o.totalCost)}</strong></div>`).join('')}</div>`:''}`;
    $('#accountingCards')?.after(summary);
    $('#expenseList').innerHTML=(e.items||[]).map(x=>`<div class="expense-row" data-id="${x.id}"><span>${new Date(x.date).toLocaleDateString()}</span><span class="expense-category">${esc(x.category)}</span><span class="expense-vendor">${esc(x.vendor||'')}</span><span class="expense-description">${esc(x.description||'')}</span><strong>${money(x.amount)}</strong><button type="button" class="delete-expense">Delete</button></div>`).join('')||'<div class="empty-state">No expenses recorded for this period.</div>';
    $$('.delete-expense').forEach(b=>b.onclick=deleteExpense);
  }
  async function load(){
    const m=$('#accountingMessage'); if(m)m.textContent='Loading Stripe + Printify costs…';
    try{const data=await json(`/api/admin/accounting?period=${encodeURIComponent(period)}`);render(data);if(m)m.textContent='';}
    catch(err){if(m)m.textContent=err.message;}
  }
  async function addExpense(e){
    e.preventDefault(); const m=$('#expenseMessage'); m.textContent='Saving…';
    try{
      await json('/api/admin/accounting/expenses',{method:'POST',body:JSON.stringify({date:$('#expenseDate').value,category:$('#expenseCategory').value,vendor:$('#expenseVendor').value,description:$('#expenseDescription').value,amount:Number($('#expenseAmount').value)})});
      e.currentTarget.reset(); $('#expenseDate').value=new Date().toISOString().slice(0,10); m.textContent='Expense added.'; await load();
    }catch(err){m.textContent=err.message;}
  }
  async function deleteExpense(e){
    const row=e.currentTarget.closest('.expense-row'); if(!row)return;
    if(!confirm('Delete this expense?'))return;
    await json(`/api/admin/accounting/expenses/${encodeURIComponent(row.dataset.id)}`,{method:'DELETE'}); await load();
  }
  async function saveTaxRate(){
    const m=$('#taxMessage');m.textContent='Saving…';
    try{await json('/api/admin/accounting/settings',{method:'PUT',body:JSON.stringify({taxReservePercent:Number($('#taxReservePercent').value)})});m.textContent='Saved.';await load();}
    catch(err){m.textContent=err.message;}
  }
  function exportCsv(){
    if(!lastData)return;
    const p=lastData.printify||{};
    const rows=[['Period',period],['Gross sales',lastData.stripe?.grossSales||0],['Refunds',lastData.stripe?.refunds||0],['Stripe fees',lastData.stripe?.stripeFees||0],['Stripe net',lastData.stripe?.stripeNet||0],['Printify product cost',p.productCost||0],['Printify shipping',p.shippingCost||0],['Printify tax',p.taxCost||0],['Total Printify fulfillment cost',p.fulfillmentCost||0],['Paid Stripe orders',p.paidOrders||0],['Matched Printify orders',p.matchedOrders||0],['Unmatched paid orders',p.unmatchedPaidOrders||0],['Manual expenses',lastData.expenses?.total||0],['True operating profit',lastData.trueNet||0],['Tax reserve %',lastData.taxReservePercent||0],['Tax reserve estimate',lastData.taxReserveEstimate||0],['After tax reserve',lastData.estimatedAfterTaxReserve||0],[],['Date','Category','Vendor','Description','Amount'],...(lastData.expenses?.items||[]).map(x=>[x.date,x.category,x.vendor,x.description,x.amount])];
    const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`wild-sage-accounting-${period}.csv`;a.click();URL.revokeObjectURL(url);
  }
  const start=()=>{
    $('#expenseDate').value=new Date().toISOString().slice(0,10);
    $$('.accounting-period').forEach(b=>b.onclick=()=>{$$('.accounting-period').forEach(x=>x.classList.remove('active'));b.classList.add('active');period=b.dataset.period;load();});
    $('#expenseForm').onsubmit=addExpense;$('#saveTaxReserve').onclick=saveTaxRate;$('#exportAccounting').onclick=exportCsv;
    $$('.admin-tab').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.tab==='accounting')load();}));
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
