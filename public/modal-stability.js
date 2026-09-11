(()=>{
  let catalogPromise=null,lastKey='';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const getCatalog=()=>catalogPromise||(catalogPromise=fetch('/api/products',{headers:{Accept:'application/json'}}).then(r=>r.json()).then(d=>Array.isArray(d.products)?d.products:[]).catch(()=>[]));
  const parse=v=>{const parts=String(v?.title||'').split(/\s*\/\s*|\s+-\s+/).map(x=>x.trim()).filter(Boolean);return{color:parts[0]||'Standard',size:parts.slice(1).join(' / ')||'One Size'};};
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]));
  async function stabilize(){
    const dialog=$('#productDialog'); if(!dialog?.open)return;
    const title=$('#productDialog .product-dialog-copy h2')?.textContent?.trim(); if(!title)return;
    const list=await getCatalog(),p=list.find(x=>String(x.title||'').trim()===title); if(!p)return;
    const color=$('#chosenColor')?.textContent?.trim()||'';
    const variantIds=(p.variants||[]).filter(v=>!color||parse(v).color===color).map(v=>String(v.id));
    let images=(p.images||[]).filter(i=>{const ids=(i.variantIds||[]).map(String);return !ids.length||ids.some(id=>variantIds.includes(id));});
    if(!images.length)images=p.images||[];
    const unique=[]; for(const i of images){if(i?.src&&!unique.some(x=>x.src===i.src))unique.push(i)}
    const key=`${title}|${color}|${unique.map(i=>i.src).join('|')}`; if(key===lastKey)return; lastKey=key;
    const gallery=$('#productDialog .product-gallery'),main=$('#dialogMainImage'); if(!gallery||!main)return;
    const current=main.src; const chosen=unique.find(i=>i.src===current)?.src||unique[0]?.src; if(chosen)main.src=chosen;
    let thumbs=$('#productDialog .product-thumbs');
    if(unique.length<=1){thumbs?.remove();return;}
    if(!thumbs){thumbs=document.createElement('div');thumbs.className='product-thumbs';gallery.appendChild(thumbs)}
    thumbs.innerHTML=unique.slice(0,8).map((i,n)=>`<button class="product-thumb ${i.src===chosen?'active':''}" type="button" data-src="${esc(i.src)}" aria-label="View ${title} image ${n+1}"><img src="${esc(i.src)}" alt=""></button>`).join('');
    $$('.product-thumb',thumbs).forEach(b=>b.onclick=()=>{main.src=b.dataset.src;$$('.product-thumb',thumbs).forEach(x=>x.classList.remove('active'));b.classList.add('active')});
  }
  document.addEventListener('click',e=>{if(e.target.closest?.('.color-choice,.details,.quick-add,.product-image-wrap'))setTimeout(stabilize,40)},true);
  const dialog=$('#productDialog'); if(dialog)new MutationObserver(()=>setTimeout(stabilize,20)).observe(dialog,{childList:true,subtree:true,characterData:true});
  const style=document.createElement('style');style.textContent=`
    #productDialog .color-choices{display:flex!important;flex-wrap:wrap!important;gap:12px!important;align-items:center!important}
    #productDialog .color-choice{box-sizing:border-box!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 44px!important;width:44px!important;min-width:44px!important;max-width:44px!important;height:44px!important;min-height:44px!important;max-height:44px!important;padding:5px!important;margin:0!important;border:1px solid rgba(238,231,220,.42)!important;border-radius:50%!important;background:transparent!important;appearance:none!important}
    #productDialog .color-choice span{display:block!important;width:32px!important;height:32px!important;border-radius:50%!important;border:1px solid rgba(255,255,255,.3)!important}
    #productDialog .color-choice.active{outline:2px solid #eee7dc!important;outline-offset:3px!important}
    #productDialog .size-choices{display:flex!important;flex-wrap:wrap!important;gap:9px!important}
    #productDialog .size-choice{width:auto!important;min-width:50px!important;height:42px!important;padding:0 13px!important;border-radius:3px!important}
    #productDialog .product-thumb{border-radius:3px!important}
  `;document.head.appendChild(style);
})();