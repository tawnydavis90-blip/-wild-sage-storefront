(()=>{
  const original=window.loadHealth;
  if(typeof original!=='function') return;
  window.loadHealth=async function(){
    await original();
    const host=document.querySelector('#healthChecks');
    if(!host) return;
    try{
      const d=await req('/api/holding/database-diagnostics');
      const missingTables=(d.requiredTables||[]).filter(x=>!x.present).map(x=>x.name);
      const missingCols=(d.expenseSubscriptionColumns||[]).filter(x=>!x.present).map(x=>x.name);
      const ok=d.ok&&!missingTables.length&&!missingCols.length;
      const card=document.createElement('article');
      card.className='site-card';
      card.innerHTML=`<div class="label">Database diagnostics</div><h3>${esc(d.database_name||'Sage & Ember PostgreSQL')}</h3><span class="status ${ok?'healthy':'warning'}">${ok?'healthy':'check needed'}</span><p class="tiny">SSL/TLS: ${d.ssl?'enabled':'unknown'}<br>Tables: ${d.tableCount||0}<br>Businesses: ${d.counts?.businesses||0} · Sites: ${d.counts?.sites||0} · Orders: ${d.counts?.orders||0} · Expenses: ${d.counts?.expenses||0}</p><p class="tiny">${missingTables.length?`Missing tables: ${esc(missingTables.join(', '))}`:'All required Sage & Ember tables present.'}<br>${missingCols.length?`Missing expense fields: ${esc(missingCols.join(', '))}`:'Expense/subscription fields present.'}</p><details><summary class="tiny">PostgreSQL details</summary><p class="tiny">${esc(d.version||'')}</p></details>`;
      host.prepend(card);
    }catch(err){
      const card=document.createElement('article');card.className='site-card';card.innerHTML=`<div class="label">Database diagnostics</div><h3>Diagnostics unavailable</h3><span class="status warning">warning</span><p class="tiny">${esc(err.message)}</p>`;host.prepend(card);
    }
  };
})();
