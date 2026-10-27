(() => {
  let visitorId, sessionId;
  try { visitorId=localStorage.getItem('sin_sage_visitor')||crypto.randomUUID();localStorage.setItem('sin_sage_visitor',visitorId);sessionId=sessionStorage.getItem('sin_sage_session')||crypto.randomUUID();sessionStorage.setItem('sin_sage_session',sessionId); } catch { return; }
  function track(type,category){fetch('/api/sin-sage/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,category,visitorId,sessionId}),keepalive:true}).catch(()=>{});}
  track('page_view');
  document.querySelectorAll('[data-category]').forEach(a=>a.addEventListener('click',()=>track('collection_click',a.dataset.category)));
  document.getElementById('bagPreview')?.addEventListener('click',()=>track('bag_open'));
})();
