(()=>{
  const CART_KEY='wildSageCart';
  const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
  const readCart=()=>{try{return JSON.parse(localStorage.getItem(CART_KEY)||'[]')}catch{return[]}};
  const writeCart=cart=>localStorage.setItem(CART_KEY,JSON.stringify(cart));
  let catalog=[];
  const findProduct=id=>catalog.find(p=>String(p.id)===String(id));
  const findVariant=(p,id)=>(p?.variants||[]).find(v=>String(v.id)===String(id));
  const imageFor=(p,variantId)=>p?.customMockups?.main?.front||p?.images?.find(i=>(i.variantIds||[]).map(String).includes(String(variantId)))?.src||p?.images?.find(i=>String(i.position||'').toLowerCase().includes('front'))?.src||p?.images?.[0]?.src||'';

  function hydrate(){
    const cart=readCart();
    if(!cart.length)return cart;
    let changed=false;
    cart.forEach((item,i)=>{
      const p=findProduct(item.productId),v=findVariant(p,item.variantId);
      if(!p)return;
      const next={...item};
      if(!next.key&&next.productId&&next.variantId){next.key=`${next.productId}:${next.variantId}`;changed=true}
      const title=p.storefrontName||p.title||next.title||'Wild Sage item';
      if(next.title!==title){next.title=title;changed=true}
      if(v?.title&&next.variantTitle!==v.title){next.variantTitle=v.title;changed=true}
      const price=Number(v?.price??p?.minPrice??next.price??0);
      if(Number(next.price||0)!==price){next.price=price;changed=true}
      const image=imageFor(p,next.variantId)||next.image||'';
      if(image&&next.image!==image){next.image=image;changed=true}
      cart[i]=next;
    });
    if(changed)writeCart(cart);
    return cart;
  }

  function render(){
    const host=document.querySelector('#bagItems'),subtotal=document.querySelector('#bagSubtotal'),count=document.querySelector('#bagCount');
    if(!host||!subtotal||!count)return;
    const cart=hydrate();
    count.textContent=cart.reduce((s,x)=>s+Math.max(1,Number(x.quantity||1)),0);
    host.innerHTML='';
    if(!cart.length){host.innerHTML='<p style="color:#aaa397">Your bag is waiting for a little chaos.</p>';subtotal.textContent='$0.00';return;}
    cart.forEach(item=>{
      const row=document.createElement('div');row.className='bag-item';
      const qty=Math.max(1,Number(item.quantity||1)),price=Number(item.price||0);
      row.innerHTML=`${item.image?`<img src="${String(item.image).replace(/"/g,'&quot;')}" alt="">`:'<div></div>'}<div class="bag-item-copy"><h4>${String(item.title||'Wild Sage item')}</h4><p>${String(item.variantTitle||'')}</p><p><strong>${money(price)}</strong> × ${qty}</p></div><button class="bag-remove" aria-label="Remove item">×</button>`;
      row.querySelector('.bag-remove').onclick=()=>{const latest=readCart().filter(x=>String(x.key||`${x.productId}:${x.variantId}`)!==String(item.key||`${item.productId}:${item.variantId}`));writeCart(latest);render();};
      host.appendChild(row);
    });
    subtotal.textContent=money(cart.reduce((s,x)=>s+Number(x.price||0)*Math.max(1,Number(x.quantity||1)),0));
  }

  async function init(){
    try{const r=await fetch('/api/products',{headers:{Accept:'application/json'},cache:'no-store'});const d=await r.json();catalog=Array.isArray(d.products)?d.products:[];}catch{}
    render();
    const bag=document.querySelector('#bagBtn');if(bag)bag.addEventListener('click',()=>setTimeout(render,0));
    window.addEventListener('storage',e=>{if(e.key===CART_KEY)render()});
    document.addEventListener('click',e=>{if(e.target.closest?.('#dialogAdd,.quick-add'))setTimeout(render,80)},true);
    window.__wildSageRepairBag=render;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();