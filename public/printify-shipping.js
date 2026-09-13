(()=>{
  const $=s=>document.querySelector(s);
  const cart=()=>{try{return JSON.parse(localStorage.getItem('wildSageCart')||'[]')}catch{return[]}};
  const items=()=>cart().map(i=>({productId:i.productId,variantId:i.variantId,quantity:i.quantity}));
  const summary=$('.bag-summary'),checkout=$('#checkoutBtn'),message=$('#checkoutMessage');
  if(!summary||!checkout)return;

  const wrap=document.createElement('div');
  wrap.className='shipping-estimator';
  wrap.innerHTML=`<div class="shipping-kicker">DELIVERY</div><div class="shipping-heading"><strong>Where should we send it?</strong><span id="shippingQuoteValue">Not calculated</span></div><small class="shipping-help">Enter your delivery details to calculate the live Printify shipping rate.</small><div class="shipping-fields"><label><span>Phone</span><input id="shipPhone" type="tel" autocomplete="shipping tel" placeholder="(555) 555-5555"></label><label><span>Street address</span><input id="shipAddress1" autocomplete="shipping address-line1" placeholder="123 Wildflower Way"></label><label><span>Apartment / Unit <em>optional</em></span><input id="shipAddress2" autocomplete="shipping address-line2" placeholder="Apt 4B"></label><label><span>City</span><input id="shipCity" autocomplete="shipping address-level2" placeholder="City"></label><div class="state-zip"><label><span>State</span><input id="shipState" autocomplete="shipping address-level1" maxlength="2" autocapitalize="characters" placeholder="UT"></label><label><span>ZIP</span><input id="shipZip" autocomplete="shipping postal-code" inputmode="numeric" placeholder="84067"></label></div></div><button id="quoteShippingBtn" type="button">Calculate shipping <span>→</span></button><small id="shippingQuoteMessage" class="shipping-message" role="status" aria-live="polite"></small>`;
  summary.insertBefore(wrap,summary.querySelector('p'));

  const qmsg=$('#shippingQuoteMessage'),qval=$('#shippingQuoteValue'),quoteBtn=$('#quoteShippingBtn');
  let lastKey='',lastQuote=null;
  const address=()=>({phone:$('#shipPhone').value,address1:$('#shipAddress1').value,address2:$('#shipAddress2').value,city:$('#shipCity').value,region:$('#shipState').value.toUpperCase(),zip:$('#shipZip').value,country:'US'});
  const key=()=>JSON.stringify({items:items(),address:address()});

  function firstMissingField(){
    if(!$('#shipPhone').value.trim())return $('#shipPhone');
    if(!$('#shipAddress1').value.trim())return $('#shipAddress1');
    if(!$('#shipCity').value.trim())return $('#shipCity');
    if(!$('#shipState').value.trim())return $('#shipState');
    if(!$('#shipZip').value.trim())return $('#shipZip');
    return null;
  }
  function validate(){
    const a=address();
    if(!a.phone.trim())throw Error('Add a phone number for the delivery quote.');
    if(!a.address1.trim()||!a.city.trim()||!a.region.trim()||!a.zip.trim())throw Error('Complete the street address, city, state, and ZIP.');
  }
  function showQuoteError(err){
    lastQuote=null;
    qval.textContent='Not calculated';
    qmsg.textContent=err?.message||'Unable to calculate shipping.';
    const field=firstMissingField();
    if(field){field.focus({preventScroll:true});setTimeout(()=>field.scrollIntoView({behavior:'smooth',block:'center'}),50);}
  }
  async function parseJsonResponse(r){
    const text=await r.text();
    if(!text)return{};
    try{return JSON.parse(text)}catch{return{error:text}}
  }
  async function quote(){
    quoteBtn.disabled=true;
    qmsg.textContent='';
    try{
      if(!items().length)throw Error('Your bag is empty.');
      validate();
      qmsg.textContent='Checking the live Printify rate…';
      const r=await fetch('/api/shipping-quote',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({items:items(),address:address()})});
      const d=await parseJsonResponse(r);
      if(!r.ok)throw Error(d.error||'Unable to calculate shipping.');
      lastKey=key();lastQuote=d;
      qval.textContent=`Standard ${d.formatted}`;
      qmsg.textContent='Live shipping rate confirmed.';
      return d;
    }catch(e){
      showQuoteError(e);
      throw e;
    }finally{
      quoteBtn.disabled=false;
    }
  }

  quoteBtn.addEventListener('click',e=>{e.preventDefault();quote().catch(()=>{});});
  quoteBtn.addEventListener('touchend',e=>{e.preventDefault();quote().catch(()=>{});},{passive:false});
  wrap.addEventListener('input',()=>{lastQuote=null;qval.textContent='Not calculated';qmsg.textContent='';});

  checkout.onclick=async()=>{
    if(!items().length){message.textContent='Your bag is empty.';return}
    checkout.disabled=true;message.textContent='';
    try{
      if(!lastQuote||lastKey!==key())await quote();
      checkout.textContent='Opening secure checkout…';
      const r=await fetch('/api/checkout-shipping',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({items:items(),address:address()})});
      const d=await parseJsonResponse(r);
      if(!r.ok)throw Error(d.error||'Unable to start checkout.');
      location.href=d.url;
    }catch(e){message.textContent=e.message;checkout.disabled=false;checkout.textContent='Checkout'}
  };

  const st=document.createElement('style');
  st.textContent=`.shipping-estimator{display:block!important;width:100%!important;margin:18px 0!important;padding:17px!important;border:1px solid rgba(238,231,220,.18)!important;border-radius:14px!important;background:rgba(143,153,128,.07)!important;overflow:visible!important;box-sizing:border-box!important}.shipping-kicker{color:#b98277;font-size:.64rem;letter-spacing:.2em;margin-bottom:6px}.shipping-heading{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important}.shipping-heading strong{font-family:"Cormorant Garamond",serif;font-size:1.18rem;line-height:1.1}.shipping-heading span{flex:none;padding:5px 8px;border:1px solid rgba(238,231,220,.15);border-radius:999px;font-size:.62rem;color:#d7c2ab}.shipping-help{display:block;margin:6px 0 15px;color:#aaa397;font-size:.68rem;line-height:1.4}.shipping-fields{display:flex!important;flex-direction:column!important;gap:10px!important;width:100%!important}.shipping-fields label{display:block!important;width:100%!important}.shipping-fields label>span{display:block!important;margin:0 0 5px 2px;color:#b9b0a4;font-size:.61rem;text-transform:uppercase;letter-spacing:.07em}.shipping-fields em{font-style:normal;text-transform:none;color:#777b70}.shipping-fields input{display:block!important;width:100%!important;max-width:100%!important;height:44px!important;padding:0 11px!important;border:1px solid rgba(238,231,220,.18)!important;border-radius:8px!important;background:#0b0e0a!important;color:var(--cream)!important;box-sizing:border-box!important}.state-zip{display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important;width:100%!important}.shipping-estimator>button{position:relative!important;z-index:3!important;display:flex!important;align-items:center!important;justify-content:space-between!important;width:100%!important;min-height:50px!important;margin-top:14px!important;padding:12px 13px!important;border:1px solid rgba(238,231,220,.22)!important;border-radius:8px!important;background:rgba(238,231,220,.06)!important;color:var(--cream)!important;text-transform:uppercase!important;letter-spacing:.08em!important;font-size:.67rem!important;cursor:pointer!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}.shipping-estimator>button:disabled{opacity:.6!important}.shipping-message{display:block;min-height:18px;margin-top:8px;color:#d7c2ab;font-size:.7rem;line-height:1.35}@media(max-width:430px){.shipping-estimator{padding:14px!important;margin-bottom:24px!important}.shipping-heading{align-items:flex-start!important;flex-direction:column!important}.shipping-fields input{font-size:16px!important}.state-zip{grid-template-columns:1fr 1fr!important}.shipping-estimator>button{min-height:52px!important;font-size:.72rem!important}}`;
  document.head.appendChild(st);
})();