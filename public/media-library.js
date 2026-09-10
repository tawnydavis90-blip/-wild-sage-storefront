(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const MAX_UPLOAD=6*1024*1024;
  let items=[],products=[],merch=new Map(),query='';

  async function json(url,options={}){
    const res=await fetch(url,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||'Request failed.');
    return data;
  }
  function bytes(n){
    const v=Number(n||0); if(v<1024)return `${v} B`; if(v<1024*1024)return `${(v/1024).toFixed(1)} KB`; return `${(v/1024/1024).toFixed(1)} MB`;
  }
  function productName(id){return products.find(p=>String(p.id)===String(id))?.title||id;}
  function usageText(item){
    if(!item.usageCount) return '<strong>Unused</strong>Safe to delete.';
    return `<strong>Used on ${item.usageCount} product${item.usageCount===1?'':'s'}</strong>${(item.usage||[]).map(u=>`${esc(productName(u.productId))} · image ${u.slots.map(i=>i+1).join(', ')}`).join('<br>')}`;
  }
  function render(){
    const list=items.filter(x=>`${x.filename} ${(x.usage||[]).map(u=>productName(u.productId)).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
    $('#mediaCount').textContent=`${list.length} image${list.length===1?'':'s'}`;
    $('#mediaLibraryGrid').innerHTML=list.map(x=>`<article class="media-card" data-id="${esc(x.id)}">
      <div class="media-thumb"><img src="${esc(x.url)}" alt="${esc(x.filename)}" loading="lazy"></div>
      <div class="media-meta"><h3>${esc(x.filename)}</h3><p>${bytes(x.size)} · ${esc(new Date(x.createdAt).toLocaleDateString())}</p><div class="media-usage">${usageText(x)}</div>
      <div class="media-actions"><button type="button" class="use-media">Use on product</button><button type="button" class="danger delete-media" ${x.usageCount?'disabled title="Remove from products first"':''}>Delete</button></div></div>
    </article>`).join('')||'<div class="media-empty">No images match your search.</div>';
    $$('.use-media').forEach(b=>b.onclick=()=>openAssign(b.closest('.media-card').dataset.id));
    $$('.delete-media:not(:disabled)').forEach(b=>b.onclick=()=>removeMedia(b.closest('.media-card').dataset.id));
  }
  async function load(){
    const msg=$('#mediaMessage'); if(msg)msg.textContent='Loading…';
    try{
      const [m,p,o]=await Promise.all([json('/api/admin/media'),json('/api/products'),json('/api/admin/merchandising')]);
      items=m.items||[];products=p.products||[];merch=new Map((o.items||[]).map(x=>[String(x.productId),x]));render();if(msg)msg.textContent='';
    }catch(err){if(msg)msg.textContent=err.message;}
  }
  function dialog(){
    let el=$('#mediaAssignDialog'); if(el)return el;
    el=document.createElement('div');el.id='mediaAssignDialog';el.className='media-library-dialog';el.innerHTML=`<div class="media-library-dialog-card"><img class="media-library-preview" id="mediaAssignPreview"><h3>Use image on product</h3><label>Product<select id="mediaAssignProduct"></select></label><label>Image position<select id="mediaAssignSlot"><option value="0">Primary image</option><option value="1">Second image</option><option value="2">Third image</option></select></label><p id="mediaAssignMessage" class="message"></p><div class="media-library-dialog-actions"><button type="button" class="ghost" id="cancelMediaAssign">Cancel</button><button type="button" id="confirmMediaAssign">Use Image</button></div></div>`;document.body.appendChild(el);$('#cancelMediaAssign').onclick=()=>el.classList.remove('open');el.addEventListener('click',e=>{if(e.target===el)el.classList.remove('open');});return el;
  }
  function openAssign(id){
    const item=items.find(x=>x.id===id);if(!item)return;const d=dialog();d.dataset.mediaId=id;$('#mediaAssignPreview').src=item.url;$('#mediaAssignProduct').innerHTML=products.map(p=>`<option value="${esc(p.id)}">${esc(p.title)}</option>`).join('');$('#mediaAssignMessage').textContent='';$('#confirmMediaAssign').onclick=assignMedia;d.classList.add('open');
  }
  async function assignMedia(){
    const d=dialog(),item=items.find(x=>x.id===d.dataset.mediaId),productId=$('#mediaAssignProduct').value,slot=Number($('#mediaAssignSlot').value||0),m=$('#mediaAssignMessage');if(!item||!productId)return;
    const current=merch.get(String(productId))||{productId,featured:false,bestSeller:false,mockups:[]};const mockups=[...(current.mockups||[])];while(mockups.length<=slot)mockups.push('');mockups[slot]=item.url;
    m.textContent='Saving…';
    try{const r=await json(`/api/admin/products/${encodeURIComponent(productId)}`,{method:'PUT',body:JSON.stringify({featured:Boolean(current.featured),bestSeller:Boolean(current.bestSeller),mockups:mockups.filter((x,i)=>x||i<=slot)})});merch.set(String(productId),r.item);m.textContent='Assigned.';setTimeout(()=>{d.classList.remove('open');load();},350);}catch(err){m.textContent=err.message;}
  }
  async function removeMedia(id){
    const item=items.find(x=>x.id===id);if(!item)return;if(!confirm(`Delete ${item.filename}?`))return;
    try{await json(`/api/admin/media/${encodeURIComponent(id)}`,{method:'DELETE'});await load();}catch(err){alert(err.message);}
  }
  function loadImage(file){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Could not open that image.'))};img.src=url;});}
  async function prepare(file){
    const img=await loadImage(file),max=2200,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);let blob=await new Promise(r=>canvas.toBlob(r,'image/webp',.9));if(blob?.size>MAX_UPLOAD)blob=await new Promise(r=>canvas.toBlob(r,'image/webp',.76));if(!blob||blob.size>MAX_UPLOAD)throw new Error('Image is too large after compression.');return {blob,filename:`${String(file.name||'image').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9._ -]/g,'').trim()||'image'}.webp`};
  }
  async function uploadFile(file){
    const m=$('#mediaMessage');m.textContent='Preparing image…';try{const p=await prepare(file);m.textContent='Uploading…';const res=await fetch('/api/admin/media',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-File-Name':p.filename,'X-Mime-Type':p.blob.type||'image/webp'},body:p.blob});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'Upload failed.');m.textContent='Uploaded.';await load();}catch(err){m.textContent=err.message;}
  }
  function start(){
    $('#mediaSearch')?.addEventListener('input',e=>{query=e.target.value;render();});$('#mediaLibraryPicker')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)uploadFile(f);e.target.value='';});$$('.admin-tab').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.tab==='media')load();}));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
