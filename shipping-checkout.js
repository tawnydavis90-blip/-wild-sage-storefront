import crypto from 'crypto';
import Stripe from 'stripe';

const API_BASE='https://api.printify.com/v1';
const stripe=process.env.STRIPE_SECRET_KEY?new Stripe(process.env.STRIPE_SECRET_KEY):null;
let shopId=null;

async function printify(pathname,options={}){
  const token=process.env.PRINTIFY_API_TOKEN;
  if(!token)throw new Error('Printify is not configured.');
  const r=await fetch(`${API_BASE}${pathname}`,{...options,headers:{Authorization:`Bearer ${token}`,'User-Agent':'WildSageApparel/0.1','Content-Type':'application/json;charset=utf-8',...(options.headers||{})}});
  const text=await r.text();let data;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok){const reason=data?.errors?.reason||data?.message||data?.error||`Printify ${r.status}`;const e=new Error(reason);e.detail=data;throw e;}return data;
}
async function getShopId(){if(shopId)return shopId;const d=await printify('/shops.json'),list=Array.isArray(d)?d:(d?.data||[]),s=list.find(x=>String(x.title||x.name||'').trim().toLowerCase()==='wild sage apparel')||list[0];if(!s)throw new Error('Wild Sage Apparel Printify shop was not found.');return shopId=String(s.id);}
function cleanAddress(a={}){return{first_name:String(a.first_name||'Shipping').trim(),last_name:String(a.last_name||'Customer').trim(),email:String(a.email||'shipping@wildsageapparel.com').trim(),phone:String(a.phone||'').trim(),country:'US',region:String(a.region||'').trim().toUpperCase(),address1:String(a.address1||'').trim(),address2:String(a.address2||'').trim(),city:String(a.city||'').trim(),zip:String(a.zip||'').trim()};}
function validateAddress(a){if(!a.phone)throw new Error('Enter a phone number to calculate Printify shipping.');if(!a.address1||!a.city||!a.region||!a.zip)throw new Error('Enter street address, city, state, and ZIP code to calculate Printify shipping.');}
function normalizeItems(items){if(!Array.isArray(items)||!items.length)throw new Error('Your bag is empty.');return items.map(x=>({product_id:String(x.productId||''),variant_id:Number(x.variantId),quantity:Math.max(1,Math.min(10,Number(x.quantity||1)))}));}
async function shippingQuote(items,address){const sid=await getShopId(),addr=cleanAddress(address);validateAddress(addr);const line_items=normalizeItems(items);const q=await printify(`/shops/${sid}/orders/shipping.json`,{method:'POST',body:JSON.stringify({line_items,address_to:addr})});const standard=Number(q?.standard);if(!Number.isFinite(standard))throw new Error('Printify did not return a standard shipping rate for this order.');return{amount:standard,currency:'usd',method:'standard',all:q,address:addr};}

export function registerShippingCheckoutRoutes(app){
  app.post('/api/shipping-quote',async(req,res)=>{try{const q=await shippingQuote(req.body?.items,req.body?.address);res.json({amount:q.amount,currency:q.currency,method:q.method,formatted:new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(q.amount/100)});}catch(err){console.error('Shipping quote error:',err);res.status(400).json({error:err.message||'Unable to calculate shipping.'});}});
  app.post('/api/checkout-shipping',async(req,res)=>{
    if(!stripe)return res.status(503).json({error:'Stripe is not configured.'});
    try{
      const items=req.body?.items,quote=await shippingQuote(items,req.body?.address),sid=await getShopId(),lineItems=[],orderItems=[];
      for(const item of items){const product=await printify(`/shops/${sid}/products/${encodeURIComponent(item.productId)}.json`),variant=(product.variants||[]).find(v=>String(v.id)===String(item.variantId)&&v.is_enabled!==false&&v.is_available!==false);if(!variant)throw new Error(`A selected option for "${product.title}" is no longer available.`);const quantity=Math.max(1,Math.min(10,Number(item.quantity||1))),image=product.images?.find(i=>(i.variant_ids||[]).includes(Number(variant.id)))?.src||product.images?.[0]?.src;lineItems.push({price_data:{currency:'usd',unit_amount:Number(variant.price),product_data:{name:product.title,description:variant.title,...(image?{images:[image]}:{})}},quantity});orderItems.push({productId:product.id,variantId:Number(variant.id),quantity});}
      const origin=process.env.PUBLIC_STORE_URL||`${req.protocol}://${req.get('host')}`,cartId=crypto.randomUUID();
      const session=await stripe.checkout.sessions.create({mode:'payment',line_items:lineItems,success_url:`${origin}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${origin}/?checkout=cancelled`,shipping_address_collection:{allowed_countries:['US']},shipping_options:[{shipping_rate_data:{type:'fixed_amount',fixed_amount:{amount:quote.amount,currency:'usd'},display_name:'Standard shipping — Printify'}}],phone_number_collection:{enabled:true},billing_address_collection:'auto',customer_creation:'always',client_reference_id:cartId,metadata:{cart_id:cartId,printify_items:JSON.stringify(orderItems),printify_shipping_method:'1',printify_shipping_quote_cents:String(quote.amount),quoted_zip:quote.address.zip}});
      res.json({url:session.url,shipping:quote.amount});
    }catch(err){console.error('Printify shipping checkout error:',err);res.status(400).json({error:err.message||'Unable to start checkout.'});}
  });
}
