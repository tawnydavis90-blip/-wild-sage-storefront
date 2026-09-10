import crypto from 'crypto';
import Stripe from 'stripe';
import { findPrintifyOrderByExternalId, printifyConfigured } from './printify-admin-data.js';

const COOKIE_NAME = 'wild_sage_admin';
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

function parseCookies(req){
  return Object.fromEntries(String(req.headers.cookie||'').split(';').map(v=>v.trim()).filter(Boolean).map(part=>{
    const i=part.indexOf('=');
    return [decodeURIComponent(part.slice(0,i)),decodeURIComponent(part.slice(i+1))];
  }));
}
function secret(){return process.env.ADMIN_SESSION_SECRET||process.env.ADMIN_PASSWORD||'';}
function sign(payload){return crypto.createHmac('sha256',secret()).update(payload).digest('hex');}
function validAdmin(req){
  if(!secret()) return false;
  const token=parseCookies(req)[COOKIE_NAME]; if(!token) return false;
  const parts=token.split('.'); if(parts.length!==3) return false;
  const payload=`${parts[0]}.${parts[1]}`,expected=sign(payload),actual=parts[2];
  if(expected.length!==actual.length||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(actual))) return false;
  return Number(parts[0])>Date.now();
}
function requireAdmin(req,res,next){if(!validAdmin(req)) return res.status(401).json({error:'Admin login required.'}); next();}
function address(a){
  if(!a) return null;
  return {line1:a.line1||'',line2:a.line2||'',city:a.city||'',state:a.state||'',postalCode:a.postal_code||'',country:a.country||''};
}

export function registerOrderDetailRoutes(app){
  app.get('/api/admin/orders/:id',requireAdmin,async(req,res)=>{
    if(!stripe) return res.status(503).json({error:'Stripe is not configured on this service.'});
    const id=String(req.params.id||'').trim();
    if(!id.startsWith('cs_')) return res.status(400).json({error:'Invalid Stripe checkout session id.'});
    try{
      const [session, fulfillmentResult] = await Promise.all([
        stripe.checkout.sessions.retrieve(id,{expand:['line_items.data.price.product','payment_intent','customer']}),
        printifyConfigured()
          ? findPrintifyOrderByExternalId(id).catch(err=>{console.error('Printify order lookup error:',err);return null;})
          : Promise.resolve(null)
      ]);
      const shipping=session.collected_information?.shipping_details||session.shipping_details||null;
      const customer=session.customer_details||{};
      const intent=typeof session.payment_intent==='object'?session.payment_intent:null;
      const items=(session.line_items?.data||[]).map(i=>({
        id:i.id,
        description:i.description||'',
        quantity:i.quantity||0,
        amountSubtotal:Number(i.amount_subtotal||0)/100,
        amountTotal:Number(i.amount_total||0)/100,
        currency:String(i.currency||session.currency||'usd').toUpperCase(),
        priceId:i.price?.id||'',
        productId:typeof i.price?.product==='object'?i.price.product.id:(i.price?.product||''),
        productName:typeof i.price?.product==='object'?i.price.product.name:(i.description||'')
      }));
      res.json({
        id:session.id,
        created:new Date(session.created*1000).toISOString(),
        expiresAt:session.expires_at?new Date(session.expires_at*1000).toISOString():null,
        paymentStatus:session.payment_status||'',
        status:session.status||'',
        mode:session.mode||'',
        currency:String(session.currency||'usd').toUpperCase(),
        amountSubtotal:Number(session.amount_subtotal||0)/100,
        amountTotal:Number(session.amount_total||0)/100,
        shippingAmount:Number(session.total_details?.amount_shipping||0)/100,
        taxAmount:Number(session.total_details?.amount_tax||0)/100,
        discountAmount:Number(session.total_details?.amount_discount||0)/100,
        customer:{
          name:customer.name||'',
          email:customer.email||session.customer_email||'',
          phone:customer.phone||'',
          address:address(customer.address)
        },
        shipping:{
          name:shipping?.name||'',
          address:address(shipping?.address)
        },
        payment:{
          intentId:intent?.id||String(session.payment_intent||''),
          status:intent?.status||session.payment_status||'',
          paymentMethodTypes:intent?.payment_method_types||session.payment_method_types||[],
          receiptEmail:intent?.receipt_email||''
        },
        clientReferenceId:session.client_reference_id||'',
        metadata:session.metadata||{},
        items,
        fulfillment:{
          configured:printifyConfigured(),
          matched:Boolean(fulfillmentResult),
          order:fulfillmentResult
        }
      });
    }catch(err){
      console.error('Stripe order detail error:',err);
      res.status(err?.statusCode===404?404:500).json({error:'Unable to load order details.'});
    }
  });
}
