import crypto from 'crypto';

const DEFAULT_PACKAGE={
  packaging_type:'package',
  weight:4,
  weight_unit:'ounce',
  length:10,
  width:7,
  height:1,
  dimension_unit:'inch'
};

function clean(value,max=180){return String(value||'').trim().slice(0,max);}
function number(value,min,max){const parsed=Number(value);return Number.isFinite(parsed)&&parsed>0?Math.max(min,Math.min(max,parsed)):0;}
function today(){return new Date().toISOString().slice(0,10);}

export function normalizePackage(input={}){
  return{
    packaging_type:'package',
    weight:number(input.weight,0.1,1120),
    weight_unit:'ounce',
    length:number(input.length,0.1,108),
    width:number(input.width,0.1,108),
    height:number(input.height,0.1,108),
    dimension_unit:'inch'
  };
}

export function normalizeAddress(input={}){
  return{
    company_name:clean(input.company_name||input.companyName),
    name:clean(input.name),
    address_line1:clean(input.address_line1||input.street),
    address_line2:clean(input.address_line2||input.street2),
    city:clean(input.city),
    state_province:clean(input.state_province||input.state,40).toUpperCase(),
    postal_code:clean(input.postal_code||input.zip,20),
    country_code:'US',
    phone:clean(input.phone,40),
    email:clean(input.email,180),
    residential_indicator:clean(input.residential_indicator||input.residentialIndicator,20)||undefined
  };
}

export function addressReady(address={}){
  return Boolean((address.name||address.company_name)&&address.address_line1&&address.city&&address.state_province&&address.postal_code);
}

export function packageReady(pkg={}){
  return Number(pkg.weight)>0&&Number(pkg.length)>0&&Number(pkg.width)>0&&Number(pkg.height)>0;
}

function compact(object){return Object.fromEntries(Object.entries(object).filter(([,value])=>value!==''&&value!==undefined&&value!==null));}

export function buildShipment({fromAddress,toAddress,pkg,serviceType,orderNumber,test=false}){
  const shipment={
    from_address:compact(normalizeAddress(fromAddress)),
    to_address:compact(normalizeAddress(toAddress)),
    package:normalizePackage(pkg),
    ship_date:today()
  };
  if(serviceType){
    shipment.service_type=serviceType;
    shipment.delivery_confirmation_type='tracking';
    shipment.label_options={label_size:'4x6',label_format:'pdf',label_output_type:'url'};
    shipment.references={reference1:clean(orderNumber,80),printed_message1:clean(orderNumber,40)};
    shipment.order_details={order_source:'Sole Rebel',order_number:clean(orderNumber,80)};
    shipment.is_test_label=Boolean(test);
  }
  return shipment;
}

function safeApiError(payload,status){
  const detail=payload?.errors?.[0]?.message||payload?.error_description||payload?.message||payload?.error;
  const message=clean(detail,300)||`Stamps.com request failed (${status})`;
  return new Error(message);
}

function deriveKey(secret){return crypto.createHash('sha256').update(String(secret)).digest();}
function encrypt(value,secret){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',deriveKey(secret),iv);const ciphertext=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);return[iv,cipher.getAuthTag(),ciphertext].map(x=>x.toString('base64url')).join('.');}
function decrypt(value,secret){const[iv,tag,ciphertext]=String(value||'').split('.').map(x=>Buffer.from(x,'base64url'));if(!iv?.length||!tag?.length||!ciphertext?.length)throw new Error('The saved Stamps.com connection is invalid. Please reconnect it.');const decipher=crypto.createDecipheriv('aes-256-gcm',deriveKey(secret),iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString('utf8');}

export function registerStampsShippingRoutes(app,{pool,requireAdmin,trackingUrl,sessionSecret}){
  const environment=String(process.env.STAMPS_ENV||'production').toLowerCase()==='staging'?'staging':'production';
  const clientId=clean(process.env.STAMPS_CLIENT_ID,500);
  const clientSecret=clean(process.env.STAMPS_CLIENT_SECRET,500);
  const encryptionSecret=String(process.env.STAMPS_TOKEN_ENCRYPTION_KEY||sessionSecret||'');
  const externalUrl=String(process.env.RENDER_EXTERNAL_URL||'https://sole-rebel-render.onrender.com').replace(/\/$/,'');
  const redirectUri=String(process.env.STAMPS_REDIRECT_URI||`${externalUrl}/api/admin/stamps/callback`);
  const signinBase=environment==='staging'?'https://signin.testing.stampsendicia.com':'https://signin.stampsendicia.com';
  const apiBase=environment==='staging'?'https://api.testing.stampsendicia.com/sera':'https://api.stampsendicia.com/sera';
  const configured=()=>Boolean(clientId&&clientSecret&&encryptionSecret);
  let accessCache=null;

  async function ensureSchema(){
    await pool.query(`CREATE TABLE IF NOT EXISTS sole_rebel_shipping_settings (
      id SMALLINT PRIMARY KEY CHECK (id=1),
      stamps_refresh_token TEXT,
      from_address JSONB NOT NULL DEFAULT '{}'::jsonb,
      package JSONB NOT NULL DEFAULT '{}'::jsonb,
      default_service_type TEXT NOT NULL DEFAULT 'usps_ground_advantage',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`INSERT INTO sole_rebel_shipping_settings(id,package) VALUES(1,$1::jsonb) ON CONFLICT(id) DO NOTHING`,[JSON.stringify(DEFAULT_PACKAGE)]);
  }

  async function settings(){await ensureSchema();const {rows}=await pool.query('SELECT stamps_refresh_token,from_address,package,default_service_type,updated_at FROM sole_rebel_shipping_settings WHERE id=1');return rows[0];}
  async function saveRefreshToken(refreshToken){await ensureSchema();await pool.query('UPDATE sole_rebel_shipping_settings SET stamps_refresh_token=$1,updated_at=NOW() WHERE id=1',[encrypt(refreshToken,encryptionSecret)]);}

  async function tokenRequest(body){
    const response=await fetch(`${signinBase}/oauth/token`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||!payload.access_token)throw safeApiError(payload,response.status);
    if(payload.refresh_token)await saveRefreshToken(payload.refresh_token);
    const seconds=Math.max(60,Number(payload.expires_in)||3600);
    accessCache={token:payload.access_token,expiresAt:Date.now()+seconds*1000};
    return payload.access_token;
  }

  async function accessToken(){
    if(accessCache&&accessCache.expiresAt>Date.now()+60_000)return accessCache.token;
    if(!configured())throw new Error('Stamps.com developer credentials are not configured.');
    const row=await settings();
    if(!row.stamps_refresh_token)throw new Error('Connect your Stamps.com account first.');
    return tokenRequest({grant_type:'refresh_token',client_id:clientId,client_secret:clientSecret,refresh_token:decrypt(row.stamps_refresh_token,encryptionSecret)});
  }

  async function stampsFetch(path,{method='GET',body,idempotencyKey}={}){
    const headers={Authorization:`Bearer ${await accessToken()}`};
    if(body!==undefined)headers['Content-Type']='application/json';
    if(idempotencyKey)headers['Idempotency-key']=idempotencyKey;
    const response=await fetch(`${apiBase}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw safeApiError(payload,response.status);
    return payload;
  }

  function stateValue(){const nonce=crypto.randomBytes(24).toString('base64url'),sig=crypto.createHmac('sha256',encryptionSecret).update(nonce).digest('base64url');return`${nonce}.${sig}`;}
  function validState(value){const[nonce,sig]=String(value||'').split('.');if(!nonce||!sig)return false;const expected=crypto.createHmac('sha256',encryptionSecret).update(nonce).digest('base64url');return sig.length===expected.length&&crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected));}
  function cookie(req,name){return String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(`${name}=`))?.slice(name.length+1)||'';}
  function toAddress(order){const metadata=order.metadata||{};return normalizeAddress({...metadata.address,name:metadata.customer,email:metadata.email||'',phone:String(metadata.contact||'').includes('@')?'':metadata.contact});}

  async function orderById(id){const {businessId}=await (async()=>{const result=await pool.query("SELECT id FROM businesses WHERE slug='sole-rebel'");if(!result.rows[0])throw new Error('Sole Rebel business record is missing');return{businessId:result.rows[0].id};})();const {rows}=await pool.query('SELECT id,external_order_id,friendly_order_number,status,metadata FROM orders WHERE id=$1 AND business_id=$2',[id,businessId]);return rows[0];}

  app.get('/api/admin/stamps/status',requireAdmin,async(_req,res)=>{try{
    const row=await settings(),connected=Boolean(row.stamps_refresh_token);let balance=null,accountName='';
    if(configured()&&connected){try{const[balanceResult,accountResult]=await Promise.all([stampsFetch('/v1/balance'),stampsFetch('/v1/account')]);balance=balanceResult;accountName=accountResult?.account?.customer_details?.username||'';}catch(error){console.error('Stamps.com status error:',error.message);}}
    res.json({configured:configured(),connected,environment,redirectUri,developerSignupUrl:'https://developer.stamps.com/register/',fromAddress:row.from_address||{},package:packageReady(row.package)?row.package:DEFAULT_PACKAGE,defaultServiceType:row.default_service_type,balance,accountName});
  }catch(error){res.status(500).json({error:error.message});}});

  app.patch('/api/admin/stamps/settings',requireAdmin,async(req,res)=>{try{
    const fromAddress=normalizeAddress(req.body?.fromAddress||{}),pkg=normalizePackage(req.body?.package||{});
    if(!addressReady(fromAddress))return res.status(400).json({error:'Complete the return name, street, city, state, and ZIP code.'});
    if(!packageReady(pkg))return res.status(400).json({error:'Enter a package weight and all three package dimensions.'});
    await ensureSchema();await pool.query('UPDATE sole_rebel_shipping_settings SET from_address=$1::jsonb,package=$2::jsonb,updated_at=NOW() WHERE id=1',[JSON.stringify(compact(fromAddress)),JSON.stringify(pkg)]);
    res.json({ok:true,fromAddress:compact(fromAddress),package:pkg});
  }catch(error){res.status(500).json({error:error.message});}});

  app.get('/api/admin/stamps/connect',requireAdmin,async(_req,res)=>{
    if(!configured())return res.status(503).send('Add STAMPS_CLIENT_ID and STAMPS_CLIENT_SECRET to the Sole Rebel Render service first.');
    const state=stateValue();res.setHeader('Set-Cookie',`stamps_oauth_state=${encodeURIComponent(state)}; Path=/api/admin/stamps; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
    const url=new URL(`${signinBase}/authorize`);url.searchParams.set('response_type','code');url.searchParams.set('client_id',clientId);url.searchParams.set('redirect_uri',redirectUri);url.searchParams.set('scope','offline_access');url.searchParams.set('state',state);res.redirect(url.toString());
  });

  app.get('/api/admin/stamps/callback',requireAdmin,async(req,res)=>{try{
    const state=String(req.query.state||''),saved=decodeURIComponent(cookie(req,'stamps_oauth_state'));
    if(!validState(state)||state!==saved)throw new Error('Stamps.com connection expired. Please try connecting again.');
    if(req.query.error)throw new Error(clean(req.query.error_description||req.query.error,250));
    const code=clean(req.query.code,2000);if(!code)throw new Error('Stamps.com did not return an authorization code.');
    const token=await tokenRequest({grant_type:'authorization_code',client_id:clientId,client_secret:clientSecret,code,redirect_uri:redirectUri});
    const accountResponse=await fetch(`${apiBase}/v1/account`,{headers:{Authorization:`Bearer ${token}`}});const account=await accountResponse.json().catch(()=>({}));
    const accountAddress=account?.account?.customer_details?.address||account?.account?.meter_details?.meter_address;
    if(accountAddress&&addressReady(normalizeAddress(accountAddress))){const row=await settings();if(!addressReady(row.from_address))await pool.query('UPDATE sole_rebel_shipping_settings SET from_address=$1::jsonb,updated_at=NOW() WHERE id=1',[JSON.stringify(compact(normalizeAddress(accountAddress)))]);}
    res.setHeader('Set-Cookie','stamps_oauth_state=; Path=/api/admin/stamps; HttpOnly; Secure; SameSite=Lax; Max-Age=0');res.redirect('/dashboard?stamps=connected');
  }catch(error){console.error('Stamps.com OAuth error:',error.message);res.redirect(`/dashboard?stamps_error=${encodeURIComponent(error.message)}`);}});

  app.get('/api/admin/stamps/labels',requireAdmin,async(_req,res)=>{try{const {businessId}=await (async()=>{const result=await pool.query("SELECT id FROM businesses WHERE slug='sole-rebel'");return{businessId:result.rows[0]?.id};})();const {rows}=await pool.query(`SELECT id,metadata->>'stampsLabelId' AS label_id,metadata->>'stampsServiceType' AS service_type,metadata->>'stampsPostageCost' AS postage_cost FROM orders WHERE business_id=$1 AND metadata ? 'stampsLabelId' ORDER BY ordered_at DESC LIMIT 200`,[businessId]);res.json({labels:Object.fromEntries(rows.map(row=>[String(row.id),{labelId:row.label_id,serviceType:row.service_type,postageCost:Number(row.postage_cost||0),printUrl:`/api/admin/orders/${row.id}/stamps/label.pdf`}]))});}catch(error){res.status(500).json({error:error.message});}});

  app.post('/api/admin/orders/:id/stamps/rates',requireAdmin,async(req,res)=>{try{
    const order=await orderById(req.params.id);if(!order)return res.status(404).json({error:'Order not found'});
    const row=await settings(),fromAddress=normalizeAddress(req.body?.fromAddress||row.from_address),pkg=normalizePackage(req.body?.package||row.package),destination=toAddress(order);
    if(!addressReady(fromAddress))return res.status(400).json({error:'Save your return address in Shipping setup first.'});if(!addressReady(destination))return res.status(400).json({error:'The customer shipping address is incomplete.'});if(!packageReady(pkg))return res.status(400).json({error:'Save the package weight and dimensions first.'});
    const rates=await stampsFetch('/v1/rates?carriers=usps',{method:'POST',body:buildShipment({fromAddress,toAddress:destination,pkg})});
    const allowed=new Set(['usps_ground_advantage','usps_priority_mail','usps_priority_mail_express']);const filtered=(Array.isArray(rates)?rates:[]).filter(rate=>allowed.has(rate.service_type)).map(rate=>({serviceType:rate.service_type,label:rate.service_type.replace(/^usps_/,'').split('_').map(x=>x[0].toUpperCase()+x.slice(1)).join(' '),amount:Number(rate.shipment_cost?.total_amount||0),currency:rate.shipment_cost?.currency||'usd',estimatedDeliveryDays:rate.estimated_delivery_days||'',estimatedDeliveryDate:rate.estimated_delivery_date||null})).sort((a,b)=>a.amount-b.amount);
    res.json({rates:filtered,package:pkg});
  }catch(error){res.status(502).json({error:error.message});}});

  app.post('/api/admin/orders/:id/stamps/label',requireAdmin,async(req,res)=>{let order;try{
    order=await orderById(req.params.id);if(!order)return res.status(404).json({error:'Order not found'});if(order.status!=='paid')return res.status(409).json({error:'Verify and mark this order paid before purchasing postage.'});if(order.metadata?.stampsLabelId)return res.status(409).json({error:'A Stamps.com label already exists for this order.',printUrl:`/api/admin/orders/${order.id}/stamps/label.pdf`});if(req.body?.confirmPurchase!==true)return res.status(400).json({error:'Confirm the postage purchase first.'});
    const serviceType=clean(req.body?.serviceType,80);if(!['usps_ground_advantage','usps_priority_mail','usps_priority_mail_express'].includes(serviceType))return res.status(400).json({error:'Choose a valid USPS service.'});
    const row=await settings(),fromAddress=normalizeAddress(row.from_address),pkg=normalizePackage(req.body?.package||row.package),destination=toAddress(order);if(!addressReady(fromAddress)||!addressReady(destination)||!packageReady(pkg))return res.status(400).json({error:'Return address, customer address, or package settings are incomplete.'});
    const idempotencyKey=order.metadata?.stampsLabelIdempotencyKey||crypto.randomUUID();await pool.query(`UPDATE orders SET fulfillment_status='purchasing shipping label',metadata=COALESCE(metadata,'{}'::jsonb)||$2::jsonb,updated_at=NOW() WHERE id=$1`,[order.id,JSON.stringify({stampsLabelIdempotencyKey:idempotencyKey})]);
    const result=await stampsFetch('/v1/labels',{method:'POST',idempotencyKey,body:buildShipment({fromAddress,toAddress:destination,pkg,serviceType,orderNumber:order.friendly_order_number||order.external_order_id,test:environment==='staging'})});
    const labelUrl=result?.labels?.[0]?.href,trackingNumber=clean(result?.tracking_number,120);if(!result?.label_id||!trackingNumber||!labelUrl)throw new Error('Stamps.com created an incomplete label response. No additional purchase was attempted.');
    const addedAt=new Date().toISOString(),carrier=clean(result.carrier||'usps',30).toLowerCase(),patch={trackingNumber,trackingCarrier:carrier,trackingUrl:trackingUrl(carrier,trackingNumber),trackingAddedAt:addedAt,stampsLabelId:result.label_id,stampsServiceType:result.service_type||serviceType,stampsPostageCost:Number(result.shipment_cost?.total_amount||0),stampsLabelCreatedAt:addedAt,stampsPackage:pkg};
    await pool.query(`UPDATE orders SET fulfillment_status='shipped',metadata=COALESCE(metadata,'{}'::jsonb)||$2::jsonb,updated_at=NOW() WHERE id=$1`,[order.id,JSON.stringify(patch)]);
    res.json({ok:true,trackingNumber,labelUrl,printUrl:`/api/admin/orders/${order.id}/stamps/label.pdf`,postageCost:patch.stampsPostageCost,serviceType:patch.stampsServiceType});
  }catch(error){console.error('Stamps.com label error:',error.message);if(order?.id)await pool.query(`UPDATE orders SET fulfillment_status=CASE WHEN status='paid' THEN 'payment received' ELSE fulfillment_status END,updated_at=NOW() WHERE id=$1 AND NOT (metadata ? 'stampsLabelId')`,[order.id]).catch(()=>{});res.status(502).json({error:error.message});}});

  app.get('/api/admin/orders/:id/stamps/label.pdf',requireAdmin,async(req,res)=>{try{const order=await orderById(req.params.id);if(!order)return res.status(404).send('Order not found');const labelId=clean(order.metadata?.stampsLabelId,200);if(!labelId)return res.status(404).send('No Stamps.com label exists for this order.');const result=await stampsFetch(`/v1/labels/${encodeURIComponent(labelId)}?label_size=4x6&label_format=pdf&label_output_type=url`);const href=result?.labels?.[0]?.href;if(!href)throw new Error('Stamps.com did not return a printable label.');res.redirect(href);}catch(error){res.status(502).send(error.message);}});
}
