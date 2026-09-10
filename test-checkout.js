import crypto from 'crypto';
import Stripe from 'stripe';

const COOKIE_NAME='wild_sage_admin';
const API_BASE='https://api.printify.com/v1';
const testStripe=process.env.STRIPE_TEST_SECRET_KEY?new Stripe(process.env.STRIPE_TEST_SECRET_KEY):null;
let shopId=null;

function cookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(v=>v.trim()).filter(Boolean).map(part=>{const i=part.indexOf('=');return[decodeURIComponent(part.slice(0,i)),decodeURIComponent(part.slice(i+1))]}));}
function secret(){return process.env.ADMIN_SESSION_SECRET||process.env.ADMIN_PASSWORD||'';}
function sign(payload){return crypto.createHmac('sha256',secret()).update(payload).digest('hex');}
function validAdmin(req){if(!secret())return false;const token=cookies(req)[COOKIE_NAME];if(!token)return false;const parts=token.split('.');if(parts.length!==3)return false;const payload=`${parts[0]}.${parts[1]}`,expected=sign(payload),actual=parts[2];if(expected.length!==actual.length||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(actual)))return false;return Number(parts[0])>Date.now();}
function requireAdmin(req,res,next){if(!validAdmin(req))return res.status(401).json({error:'Admin login required.'});next();}
async function printify(pathname){const token=process.env.PRINTIFY_API_TOKEN;if(!token)throw new Error('Printify is not configured.');const r=await fetch(`${API_BASE}${pathname}`,{headers:{Authorization:`Bearer ${token}`,'User-Agent':'WildSageApparel/0.1','Content-Type':'application/json'}});if(!r.ok)throw new Error(`Printify ${r.status}`);return r.json();}
async function getShopId(){if(shopId)return shopId;const shops=await printify('/shops.json'),list=Array.isArray(shops)?shops:(shops?.data||[]),shop=list.find(s=>String(s.title||s.name||'').trim().toLowerCase()==='wild sage apparel')||list[0];if(!shop)throw new Error('Wild Sage Apparel Printify shop was not found.');shopId=String(shop.id);return shopId;}

export function registerTestCheckoutRoutes(app){
  app.get('/api/admin/test-checkout/status',requireAdmin,(_req,res)=>res.json({configured:Boolean(testStripe)}));
  app.post('/api/admin/test-checkout',requireAdmin,async(req,res)=>{
    if(!testStripe)return res.status(503).json({error:'STRIPE_TEST_SECRET_KEY is not configured yet.'});
    const items=req.body?.items;if(!Array.isArray(items)||!items.length)return res.status(400).json({error:'Your bag is empty.'});
    try{
      const sid=await getShopId(),lineItems=[];
      for(const item of items){
        const product=await printify(`/shops/${sid}/products/${encodeURIComponent(item.productId)}.json`);
        const variant=(product.variants||[]).find(v=>String(v.id)===String(item.variantId)&&v.is_enabled!==false&&v.is_available!==false);
        if(!variant)throw new Error(`A selected option for "${product.title}" is no longer available.`);
        const quantity=Math.max(1,Math.min(10,Number(item.quantity||1)));
        const image=product.images?.find(i=>(i.variant_ids||[]).includes(Number(variant.id)))?.src||product.images?.[0]?.src;
        lineItems.push({price_data:{currency:'usd',unit_amount:Number(variant.price),product_data:{name:`TEST — ${product.title}`,description:variant.title,...(image?{images:[image]}:{})}},quantity});
      }
      const origin=process.env.PUBLIC_STORE_URL||`${req.protocol}://${req.get('host')}`;
      const session=await testStripe.checkout.sessions.create({mode:'payment',line_items:lineItems,success_url:`${origin}/?test_checkout=success&session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${origin}/?test=1&test_checkout=cancelled`,shipping_address_collection:{allowed_countries:['US']},phone_number_collection:{enabled:true},billing_address_collection:'auto',customer_creation:'always',metadata:{wild_sage_test:'true',do_not_fulfill:'true'}});
      res.json({url:session.url});
    }catch(err){console.error('Test checkout error:',err);res.status(400).json({error:err.message||'Unable to start test checkout.'});}
  });
}

export function getTestStripe(){return testStripe;}
