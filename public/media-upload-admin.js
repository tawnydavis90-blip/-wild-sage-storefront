(() => {
  const MAX_UPLOAD = 6 * 1024 * 1024;
  const $ = (s,r=document) => r.querySelector(s);
  const $$ = (s,r=document) => [...r.querySelectorAll(s)];

  function loadImage(file){
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(file), img=new Image();
      img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('This image could not be opened. Try a JPG, PNG, or another photo.'));};
      img.src=url;
    });
  }

  async function prepareImage(file){
    if(!file || !String(file.type||'').startsWith('image/')) throw new Error('Please choose an image.');
    const img=await loadImage(file);
    const maxDimension=2200;
    const scale=Math.min(1,maxDimension/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round((img.naturalWidth||img.width)*scale));
    canvas.height=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
    const ctx=canvas.getContext('2d');
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.9));
    if(!blob) blob=file;
    if(blob.size>MAX_UPLOAD) {
      blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.76));
    }
    if(!blob || blob.size>MAX_UPLOAD) throw new Error('The image is still too large after compression. Please choose a smaller image.');
    const ext=blob.type==='image/png'?'.png':blob.type==='image/jpeg'?'.jpg':'.webp';
    const base=String(file.name||'mockup').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9._ -]/g,'').trim()||'mockup';
    return {blob,filename:`${base}${ext}`};
  }

  async function upload(file,status){
    status.textContent='Preparing image…';
    const prepared=await prepareImage(file);
    status.textContent='Uploading…';
    const res=await fetch('/api/admin/media',{
      method:'POST',
      headers:{'Content-Type':'application/octet-stream','X-File-Name':prepared.filename,'X-Mime-Type':prepared.blob.type||'image/webp'},
      body:prepared.blob
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||'Upload failed.');
    return data;
  }

  function enhanceInput(input,index){
    if(input.dataset.directUploadReady) return;
    input.dataset.directUploadReady='true';
    const wrap=document.createElement('div');
    wrap.className='media-upload-controls';
    const picker=document.createElement('input');
    picker.type='file'; picker.accept='image/*'; picker.className='media-file-picker';
    const button=document.createElement('button');
    button.type='button'; button.className='media-upload-button';
    button.textContent=index===0?'Upload primary image':'Upload image';
    const status=document.createElement('span'); status.className='media-upload-status';
    wrap.append(button,picker,status);
    input.insertAdjacentElement('afterend',wrap);
    button.addEventListener('click',()=>picker.click());
    picker.addEventListener('change',async()=>{
      const file=picker.files?.[0]; if(!file) return;
      button.disabled=true;
      try{
        const result=await upload(file,status);
        input.value=result.url;
        input.dispatchEvent(new Event('input',{bubbles:true}));
        const card=input.closest('.product-admin-card');
        const preview=$('img',card);
        if(preview) preview.src=result.url;
        status.textContent='Uploaded. Saving product…';
        const save=$('.save-product',card);
        if(save){
          save.click();
          setTimeout(()=>{status.textContent='Uploaded & saved';},450);
        } else status.textContent='Uploaded — tap Save';
      }catch(err){status.textContent=err.message;}
      finally{button.disabled=false;picker.value='';}
    });
  }

  function enhanceCards(){
    $$('.product-admin-card .mockups').forEach(group=>{
      $$('.mockup-url',group).forEach((input,index)=>enhanceInput(input,index));
    });
  }

  const observer=new MutationObserver(()=>enhanceCards());
  function start(){
    enhanceCards();
    const grid=$('#productsGrid');
    if(grid) observer.observe(grid,{childList:true,subtree:true});
    document.querySelector('[data-tab="products"]')?.addEventListener('click',()=>setTimeout(enhanceCards,50));
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
