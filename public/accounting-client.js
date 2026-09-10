(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
  let period='30d', lastData=null;
  async function json(url,options={}){const res=await fetch(url,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'Request failed.');return data;}
  function card(label,value,cls=''){return `<div class="accounting-card ${cls}"><span>${label}</span><strong>${value}</strong></div>`;}
  function render(data){
    lastData=data;
    const s=data.stripe||{}, e=data.expenses||{};
    $('#accountingCards').innerHTML=[
      card('Gross sales',money(s.grossSales)),
      card('Refunds',money(s.refunds),'negative'),
      card('Stripe fees',money(s.stripeFees),'negative'),
      card('Stripe net',money(s.stripeNet),'positive'),
      card('Business expenses',money(e.total),'negative'),
      card('Net after expenses',money(data.netAfterExpenses),data.netAfterExpenses>=0?'positive':'negative'),
      card(`Tax reserve · ${Number(data.taxReservePercent||0)}%`,money(data.taxReserveEstimate),'negative')
    ].join('');
    const warning=$('#accountingWarning');
    warning.hidden=!(s.hasMore);
    warning.textContent=s.hasMore?'Stripe returned more than 100 balance transactions in this period. Totals shown here cover the latest 100 relevant transactions.':'';
    $('#taxReservePercent').value=Number(data.taxReservePercent||0);
    $('#accountingDisclaimer').textContent=data.disclaimer||'';
    $('#expenseList').innerHTML=(e.items||[]).map(x=>`<div class="expense-row" data-id="${x.id}"><span>${new Date(x.date).toLocaleDateString()}</span><span class="expense-category">${x.category}</span><span class="expense-vendor">${x.vendor||''}</span><span class="expense-description">${x.description||''}</span><strong>${money(x.amount)}</strong><button type="button" class="delete-expense">Delete</button></div>`).join('')||'<div class="empty-state">No expenses recorded for this period.</div>';
    $$('.delete-expense').forEach(b=>b.onclick=deleteExpense);
  }
  async function load(){
    const m=$('#accountingMessage'); if(m)m.textContent='Loading…';
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
    const rows=[['Period',period],['Gross sales',lastData.stripe?.grossSales||0],['Refunds',lastData.stripe?.refunds||0],['Stripe fees',lastData.stripe?.stripeFees||0],['Stripe net',lastData.stripe?.stripeNet||0],['Expenses',lastData.expenses?.total||0],['Net after expenses',lastData.netAfterExpenses||0],['Tax reserve %',lastData.taxReservePercent||0],['Tax reserve estimate',lastData.taxReserveEstimate||0],[],['Date','Category','Vendor','Description','Amount'],...(lastData.expenses?.items||[]).map(x=>[x.date,x.category,x.vendor,x.description,x.amount])];
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
