const $ = id => document.getElementById(id);
async function api(url,options={}) { const r=await fetch(url,{...options,headers:{'Content-Type':'application/json',...options.headers}}); const data=await r.json(); if(!r.ok){if(r.status===401)showLogin();throw new Error(data.error||'Request failed.');}return data; }
function showLogin(){ $('login').hidden=false;$('dashboard').hidden=true; }
function row(left,right){const el=document.createElement('div');el.className='row';const a=document.createElement('span'),b=document.createElement('span');a.textContent=left;b.textContent=right;el.append(a,b);return el;}
async function load(){
  $('message').textContent='Loading dashboard…';
  try{const d=await api('/api/sin-sage/dashboard');$('login').hidden=true;$('dashboard').hidden=false;
    $('metrics').replaceChildren();
    for(const [key,label] of [['24h','Last 24 hours'],['7d','Last 7 days'],['30d','Last 30 days'],['all','Lifetime']]){const m=d.windows[key];const el=document.createElement('article');el.className='metric';const title=document.createElement('p'),num=document.createElement('strong'),detail=document.createElement('p');title.textContent=label;num.textContent=m.visitors;detail.textContent=`Visitors · ${m.views} page views · ${m.clicks} collection clicks · ${m.bags} bag opens`;el.append(title,num,detail);$('metrics').append(el);}
    $('tracking').textContent=`${d.trackingStarted?'Recorded activity since '+new Date(d.trackingStarted).toLocaleDateString()+'. ':'Tracking starts with new visits; earlier traffic is unavailable. '}Visitors are counted by anonymous browser ID.`;
    $('collections').replaceChildren(...(d.collections.length?d.collections.map(c=>row(c.category||'Other',c.clicks+' clicks')):[row('No collection activity recorded yet.','')]));
    for(const f of document.querySelectorAll('[data-supplier]')){const s=d.suppliers.find(s=>s.supplier===f.dataset.supplier);f.elements.stage.value=s?.stage||'pending';f.elements.notes.value=s?.notes||'';}
    $('orderList').replaceChildren(...(d.orders.length?d.orders.map(o=>row(o.friendly_order_number||o.external_order_id,`${o.status} · ${new Intl.NumberFormat(undefined,{style:'currency',currency:o.currency||'USD'}).format(o.total)}`)):[row('No Sin & Sage orders recorded.','Checkout is disabled.')]));
    await loadNalpac();
    $('updated').textContent='Updated '+new Date(d.generatedAt).toLocaleString();$('message').textContent='';
  }catch(e){$('message').textContent=e.message;}
}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:$('password').value})});$('password').value='';await load();}catch(e){$('message').textContent=e.message;}});
$('refresh').addEventListener('click',load);
$('logout').addEventListener('click',async()=>{try{await api('/api/admin/logout',{method:'POST',body:'{}'});showLogin();$('message').textContent='Signed out.';}catch(e){$('message').textContent=e.message;}});
for(const f of document.querySelectorAll('[data-supplier]'))f.addEventListener('submit',async e=>{e.preventDefault();const b=f.querySelector('button'),status=f.querySelector('.saved');b.disabled=true;status.textContent='Saving…';try{await api('/api/sin-sage/dashboard/suppliers/'+f.dataset.supplier,{method:'PUT',body:JSON.stringify({stage:f.elements.stage.value,notes:f.elements.notes.value})});status.textContent='Saved. Store remains in private preview.';}catch(e){status.textContent=e.message;}finally{b.disabled=false;}});
api('/api/admin/session').then(s=>s.authenticated?load():(showLogin(),$('message').textContent='Sign in to manage Sin & Sage.')).catch(e=>$('message').textContent=e.message);

let nalpacWorking=false;
function nalpacButtons(disabled){ for(const b of document.querySelectorAll('#nalpac button')) b.disabled=disabled; }
async function loadNalpac(){
  try{const d=await api('/api/sin-sage/nalpac');
    $('nalpacStatus').textContent=(d.configuration.configured?'API credentials configured; use Test API access to verify permissions.':'API credentials need to be added in Render.')+' Location: '+d.configuration.locationId+'. '+d.total+' private drafts. '+(d.configuration.automaticSync?'Hourly batch refresh enabled.':'Automatic refresh is off.');
    $('nalpacTest').disabled=!d.configuration.configured;$('nalpacSync').disabled=!d.configuration.configured||!d.total;$('nalpacImport').querySelector('button').disabled=!d.configuration.configured;
    const list=d.products.map(p=>{const el=document.createElement('article');el.className='nalpac-product';const title=document.createElement('h3');title.textContent=p.name;el.append(title,row('SKU '+p.sku,'Private draft'),row('Wholesale cost',p.wholesale===null?'Unavailable':new Intl.NumberFormat(undefined,{style:'currency',currency:'USD'}).format(p.wholesale)),row('Available units',p.quantity===null?'Unknown':String(p.quantity)),row('Supplier availability',p.sellable?'Available at last check':'Unavailable or needs review'),row('Last successful check',new Date(p.last_synced_at).toLocaleString()));if(p.sync_error)el.append(row('Refresh failed',p.sync_error));return el;});
    $('nalpacProducts').replaceChildren(...(list.length?list:[row('No products imported yet.','')]));
  }catch(e){$('nalpacStatus').textContent=e.message;}
}
async function nalpacAction(path,body){if(nalpacWorking)return;nalpacWorking=true;nalpacButtons(true);$('nalpacResult').textContent='Connecting to Nalpac…';try{const d=await api('/api/sin-sage/nalpac/'+path,{method:'POST',body:JSON.stringify(body||{})});$('nalpacResult').textContent=path==='test'?'Carrier API access verified. Product access is checked when importing a SKU.':d.imported+' products refreshed; '+d.failed+' failed. '+d.results.filter(r=>!r.ok).map(r=>r.sku+': '+r.error).join(' ');if(path==='import'&&!d.failed)$('nalpacSkus').value='';}catch(e){$('nalpacResult').textContent=e.message;}finally{nalpacWorking=false;nalpacButtons(false);await loadNalpac();}}
$('nalpacTest').addEventListener('click',()=>nalpacAction('test'));
$('nalpacSync').addEventListener('click',()=>nalpacAction('sync'));
$('nalpacReload').addEventListener('click',loadNalpac);
$('nalpacImport').addEventListener('submit',e=>{e.preventDefault();const skus=$('nalpacSkus').value.split(/[,\n]+/).map(s=>s.trim()).filter(Boolean);if(!skus.length||skus.length>10){$('nalpacResult').textContent='Enter between 1 and 10 SKUs.';return;}nalpacAction('import',{skus});});
