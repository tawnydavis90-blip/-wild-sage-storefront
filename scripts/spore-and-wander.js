import fs from 'node:fs/promises';

const items = [
  {key:'blue-daydream', color:'blue', name:'Spore & Wander Weekender — Blue Daydream', story:'A little mushroom magic for wherever the weekend takes you. Cobalt-blue swirls, checkerboard caps, and whimsical mushrooms dance across a white backdrop, with Wild Sage Apparel woven into the front and a matching mushroom garden on the back.'},
  {key:'sage-daydream', color:'sage', name:'Spore & Wander Weekender — Sage Daydream', story:'For earthy souls with a wandering streak. Warm sage-green mushrooms, playful checkerboards, and flowing botanical lines bring a little woodland whimsy to your getaway, with Wild Sage Apparel woven into the front and a matching mushroom garden on the back.'}
];

export function printAreasFor(template, catalog, uploads) {
  const enabled = template.variants.filter(v=>v.is_enabled && v.is_available!==false);
  if (!enabled.length) throw new Error('Reference weekender has no available variants.');
  return template.print_areas.map(area=>({
    variant_ids:area.variant_ids.filter(id=>enabled.some(v=>v.id===id)),
    background:'#ffffff',
    placeholders:area.placeholders.map(placeholder=>{
      const position=placeholder.position;
      if(!['front','back'].includes(position)) throw new Error(`Review required for weekender print area: ${position}`);
      const dimensions=catalog.variants.flatMap(v=>v.placeholders||[]).find(p=>p.position===position);
      if(!dimensions?.width || !dimensions?.height) throw new Error(`Missing dimensions for ${position}`);
      if(area.placeholders.length===1 && position==='front') {
        if(dimensions.width!==3825||dimensions.height!==4950) throw new Error('Combined sheet dimensions changed; review required.');
        return {position,images:['front','back'].map((side,index)=>{
          const image=uploads[side];
          return {id:image.id,x:0.5,y:index===0?0.25:0.75,scale:Math.max(1,dimensions.height/2/dimensions.width*image.width/image.height)*1.01,angle:index===0?0:180};
        })};
      }
      const image=uploads[position];
      // Fill the entire printable face, with a small bleed; keep the wordmark centered.
      const scale=Math.max(1,dimensions.height/dimensions.width*image.width/image.height)*1.01;
      return {position,images:[{id:image.id,x:0.5,y:0.5,scale,angle:0}]};
    })
  })).filter(area=>area.variant_ids.length);
}

export async function publishSporeAndWander() {
  if(!process.env.PRINTIFY_API_TOKEN || !process.env.DATABASE_URL) return;
  const {default:pg}=await import('pg');
  const client=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined});
  const api=async(path,body)=>{
    const response=await fetch(`https://api.printify.com/v1${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${process.env.PRINTIFY_API_TOKEN}`,'Content-Type':'application/json','User-Agent':'WildSageApparel/0.1'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});
    const text=await response.text();
    if(!response.ok) throw new Error(`Printify ${response.status} on ${path}: ${text.slice(0,500)}`);
    return text?JSON.parse(text):null;
  };
  try {
    await client.connect();
    const lock=await client.query("SELECT pg_try_advisory_lock(hashtext('spore_and_wander_20261013')) AS acquired");
    if(!lock.rows[0].acquired) return;
    await client.query('CREATE TABLE IF NOT EXISTS storefront_product_launches (launch_key TEXT PRIMARY KEY, product_id TEXT, completed_at TIMESTAMPTZ)');
    const pending=[];
    for(const item of items){const {rows}=await client.query('SELECT * FROM storefront_product_launches WHERE launch_key=$1',[item.key]);if(!rows[0]?.completed_at)pending.push({...item,productId:rows[0]?.product_id});}
    if(!pending.length) return;
    const shops=await api('/shops.json');
    const shop=shops.find(s=>String(s.title||'').trim().toLowerCase()==='wild sage apparel');
    if(!shop) throw new Error('Wild Sage Apparel shop not found.');
    const prefix=`/shops/${shop.id}`;
    const template=await api(`${prefix}/products/6ac4835271fb1b154105587d.json`);
    if(template.blueprint_id!==326 || template.print_provider_id!==99) throw new Error('Reference weekender provider changed; review required.');
    const catalog=await api(`/catalog/blueprints/${template.blueprint_id}/print_providers/${template.print_provider_id}/variants.json`);
    console.log('Spore & Wander template areas:',JSON.stringify(catalog.variants.map(v=>({id:v.id,placeholders:v.placeholders}))));
    const positions=new Set(template.print_areas.flatMap(a=>a.placeholders.map(p=>p.position)));
    if(!positions.has('front')||positions.size>2) throw new Error('Unexpected weekender print areas.');
    const existing=[];
    for(let page=1;page<=20;page++){
      const data=await api(`${prefix}/products.json?limit=50&page=${page}`);
      existing.push(...(data.data||[]));
      if(page>=Number(data.last_page||1)) break;
    }
    for(const item of pending){
      const tag=`wild-sage-spore-wander-${item.key}`;
      let productId=item.productId||existing.find(p=>(p.tags||[]).includes(tag))?.id;
      if(!productId){
        const uploads={};
        for(const side of ['front','back']){
          const bytes=await fs.readFile(new URL(`../public/artwork/spore-and-wander/${item.color}-${side}.png`,import.meta.url));
          uploads[side]=await api('/uploads/images.json',{file_name:`spore-wander-${item.color}-${side}.png`,contents:bytes.toString('base64')});
        }
        const product=await api(`${prefix}/products.json`,{
          title:item.name,description:`<p>${item.story}</p>${template.description||''}`,
          blueprint_id:template.blueprint_id,print_provider_id:template.print_provider_id,
          tags:['Bags','Weekender','Mushrooms','Spore & Wander','spore-layout-review',tag],
          variants:template.variants.filter(v=>v.is_enabled&&v.is_available!==false).map(v=>({id:v.id,price:v.price,is_enabled:true})),
          print_areas:printAreasFor(template,catalog,uploads)
        });
        productId=product.id;
      }
      // Checkpoint the external ID before any local merchandising mutations.
      await client.query('INSERT INTO storefront_product_launches(launch_key,product_id) VALUES($1,$2) ON CONFLICT(launch_key) DO UPDATE SET product_id=EXCLUDED.product_id',[item.key,productId]);
      const product=await api(`${prefix}/products/${productId}.json`);
      console.log('Spore & Wander layout preview:',JSON.stringify({id:productId,images:product.images}));
      if(product.visible!==true) throw new Error(`Product ${productId} is a draft; publishing needs review.`);
      const url=`https://wildsageapparel.com/mockups/spore-and-wander/${item.key}.webp`;
      await client.query('BEGIN');
      await client.query(`INSERT INTO product_display_names(product_id,display_name,storefront_description) VALUES($1,$2,$3) ON CONFLICT(product_id) DO UPDATE SET display_name=EXCLUDED.display_name,storefront_description=EXCLUDED.storefront_description,updated_at=NOW()`,[productId,item.name,item.story+' '+String(template.description||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()]);
      await client.query(`INSERT INTO product_merchandising(product_id,current_drop,mockup_urls,mockup_map) VALUES($1,TRUE,$2::jsonb,$3::jsonb) ON CONFLICT(product_id) DO UPDATE SET current_drop=TRUE,mockup_urls=EXCLUDED.mockup_urls,mockup_map=EXCLUDED.mockup_map,updated_at=NOW()`,[productId,JSON.stringify([url]),JSON.stringify({main:{front:url},colors:{}})]);
      await client.query(`INSERT INTO collection_settings(collection_id,label,enabled,sort_order) VALUES('bags','Bags',TRUE,6) ON CONFLICT DO NOTHING`);
      await client.query(`INSERT INTO product_collection_assignments(product_id,collection_ids) VALUES($1,'["bags"]'::jsonb) ON CONFLICT DO NOTHING`,[productId]);
      await client.query('UPDATE storefront_product_launches SET completed_at=NOW() WHERE launch_key=$1',[item.key]);
      await client.query('COMMIT');
      console.log(`Spore & Wander ready: ${item.name} (${productId})`);
    }
  } catch(error) {
    try{await client.query('ROLLBACK')}catch{}
    throw error;
  } finally {await client.end();}
}
