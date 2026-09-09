const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let products = [];
let activeFilter = 'All';
let cart = [];

const fmt = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n || 0);
const imageOf = p => p.images?.find(i=>i.position==='front')?.src || p.images?.[0]?.src || '';

async function loadProducts(){
  try{
    const r = await fetch('/api/products');
    if(!r.ok) throw new Error('Could not load catalog');
    const data = await r.json(); products = data.products || [];
    $('#status').textContent = data.source === 'demo' ? 'Preview catalog — connect Printify to replace these with your live products.' : `${products.length} live Printify products`;
    renderProducts();
  }catch(e){ $('#status').textContent = e.message; }
}
function matches(p){ return activeFilter==='All' || (p.tags||[]).some(t=>String(t).toLowerCase().includes(activeFilter.toLowerCase())) || p.title.toLowerCase().includes(activeFilter.toLowerCase()); }
function renderProducts(){
  const list = products.filter(matches);
  $('#productGrid').innerHTML = list.map(p=>`<article class="product-card" data-id="${p.id}" tabindex="0"><div class="product-media"><img src="${imageOf(p)}" alt="${p.title}" loading="lazy"><span class="tag">${(p.tags||[])[0]||'Wild Sage'}</span></div><div class="product-info"><div><h3>${p.title}</h3><p>${p.variants?.length||0} options</p></div><div class="price">from ${fmt(p.minPrice)}</div></div></article>`).join('') || '<p>No pieces in this collection yet.</p>';
  $$('.product-card').forEach(card=>{ const open=()=>openProduct(card.dataset.id); card.addEventListener('click',open);card.addEventListener('keydown',e=>{if(e.key==='Enter')open()}) });
}
function setFilter(f){activeFilter=f;$$('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===f));renderProducts();document.querySelector('#shop')?.scrollIntoView({behavior:'smooth'});}
$$('[data-filter]').forEach(b=>b.addEventListener('click',()=>setFilter(b.dataset.filter)));
function openProduct(id){
  const p=products.find(x=>x.id===id);if(!p)return;
  $('#productDetail').innerHTML=`<div class="detail-grid"><img src="${imageOf(p)}" alt="${p.title}"><div class="detail-copy"><p class="eyebrow">WILD SAGE APPAREL</p><h2>${p.title}</h2><p class="price">from ${fmt(p.minPrice)}</p><p class="desc">${p.description||'Made to order and made to stand out.'}</p><label for="variant">Choose your size / color</label><select id="variant">${(p.variants||[]).map(v=>`<option value="${v.id}" data-price="${v.price}">${v.title} — ${fmt(v.price)}</option>`).join('')}</select><button class="add-btn" id="addToBag">Add to bag</button></div></div>`;
  $('#addToBag').addEventListener('click',()=>{const sel=$('#variant');const v=p.variants.find(x=>String(x.id)===sel.value);addToCart(p,v);$('#productDialog').close();openCart();});
  $('#productDialog').showModal();
}
function addToCart(p,v){const key=`${p.id}:${v.id}`;const ex=cart.find(x=>x.key===key);if(ex)ex.quantity++;else cart.push({key,productId:p.id,variantId:v.id,title:p.title,variant:v.title,price:v.price,image:imageOf(p),quantity:1});renderCart();}
function renderCart(){
  $('#cartCount').textContent=cart.reduce((s,x)=>s+x.quantity,0);
  $('#cartItems').innerHTML=cart.length?cart.map((x,i)=>`<div class="cart-row"><img src="${x.image}" alt=""><div><h4>${x.title}</h4><p>${x.variant}</p><div class="qty"><button data-act="minus" data-i="${i}">−</button><span>${x.quantity}</span><button data-act="plus" data-i="${i}">+</button></div><button class="remove" data-act="remove" data-i="${i}">Remove</button></div><strong>${fmt(x.price*x.quantity)}</strong></div>`).join(''):'<p>Your bag is wandering around empty.</p>';
  $('#subtotal').textContent=fmt(cart.reduce((s,x)=>s+x.price*x.quantity,0));
  $$('[data-act]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.i);if(b.dataset.act==='plus')cart[i].quantity++;if(b.dataset.act==='minus')cart[i].quantity=Math.max(1,cart[i].quantity-1);if(b.dataset.act==='remove')cart.splice(i,1);renderCart();}));
}
function openCart(){ $('#cartDrawer').classList.add('open');$('#scrim').classList.add('open');$('#cartDrawer').setAttribute('aria-hidden','false'); }
function closeCart(){ $('#cartDrawer').classList.remove('open');$('#scrim').classList.remove('open');$('#cartDrawer').setAttribute('aria-hidden','true'); }
$('#cartBtn').addEventListener('click',openCart);$('#closeCart').addEventListener('click',closeCart);$('#scrim').addEventListener('click',closeCart);$('#closeProduct').addEventListener('click',()=>$('#productDialog').close());
$('#checkoutBtn').addEventListener('click',()=>{ $('#checkoutNote').textContent = cart.length ? 'Cart is ready. Connect your payment processor next; paid orders will then flow to Printify.' : 'Add a piece to your bag first.'; });
$('#year').textContent=new Date().getFullYear();
loadProducts();renderCart();
