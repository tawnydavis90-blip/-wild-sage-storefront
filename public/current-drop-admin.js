(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  let current=new Map();

  const nativeFetch=window.fetch.bind(window);
  window.fetch=async function(input,init={}){
    const url=typeof input==='string'?input:String(input?.url||'');
    if(/^\/api\/admin\/products\/[^/]+$/.test(url) && String(init.method||'GET').toUpperCase()==='PUT' && init.body){
      try{
        const id=decodeURIComponent(url.split('/').pop());
        const card=$(`.product-admin-card[data-product-id="${CSS.escape(id)}"]`);
        const toggle=$('.current-drop-toggle',card);
        const body=JSON.parse(init.body);
        if(toggle) body.currentDrop=toggle.checked;
        init={...init,body:JSON.stringify(body)};
      }catch{}
    }
    return nativeFetch(input,init);
  };

  async function load(){
    try{
      const r=await nativeFetch('/api/admin/merchandising'),d=await r.json();
      current=new Map((d.items||[]).map(x=>[String(x.productId),Boolean(x.currentDrop)]));
      decorate();
    }catch{}
  }

  function decorate(){
    $$('.product-admin-card').forEach(card=>{
      if($('.current-drop-toggle',card))return;
      const id=String(card.dataset.productId||''),row=$('.switch-row',card);
      if(!row)return;
      const label=document.createElement('label');label.className='switch-label';
      label.innerHTML=`<input class="current-drop-toggle" type="checkbox" ${current.get(id)?'checked':''}> Current Drop`;
      row.prepend(label);
    });
    const filter=$('#productFilter');
    if(filter && ![...filter.options].some(o=>o.value==='current-drop')){
      const o=document.createElement('option');o.value='current-drop';o.textContent='Current Drop';filter.insertBefore(o,filter.options[1]||null);
      filter.addEventListener('change',()=>{if(filter.value==='current-drop')$$('.product-admin-card').forEach(c=>c.style.display=$('.current-drop-toggle',c)?.checked?'':'none');else $$('.product-admin-card').forEach(c=>c.style.display='');});
    }
  }

  document.addEventListener('change',e=>{
    if(!e.target.matches?.('.current-drop-toggle'))return;
    const card=e.target.closest('.product-admin-card'),id=card?.dataset.productId;
    if(id)current.set(String(id),e.target.checked);
  });
  document.addEventListener('click',e=>{
    if(!e.target.closest?.('.admin-tab[data-tab="products"]'))return;
    setTimeout(()=>{load();decorate();},100);
  });
  document.addEventListener('DOMContentLoaded',()=>{
    new MutationObserver(()=>decorate()).observe(document.body,{childList:true,subtree:true});
    load();
  });
})();