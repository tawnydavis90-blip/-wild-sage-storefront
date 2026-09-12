import crypto from 'crypto';
import pg from 'pg';
import { registerMediaRoutes } from './media-uploads.js';

const { Pool } = pg;
const COOKIE_NAME = 'wild_sage_admin';
let pool = null;
let schemaReady = false;

function db(){
  if(!process.env.DATABASE_URL) return null;
  if(!pool) pool = new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined});
  return pool;
}
async function ensureSchema(){
  const client=db(); if(!client) return false; if(schemaReady) return true;
  await client.query(`CREATE TABLE IF NOT EXISTS product_collection_assignments (
    product_id TEXT PRIMARY KEY,
    collection_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS product_display_names (
    product_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS collection_settings (
    collection_id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS store_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await client.query(`INSERT INTO collection_settings(collection_id,label,enabled,sort_order)
    VALUES('pants','Pants',TRUE,5)
    ON CONFLICT(collection_id) DO NOTHING`);
  schemaReady=true; return true;
}
function cookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(v=>v.trim()).filter(Boolean).map(part=>{const i=part.indexOf('=');return[decodeURIComponent(part.slice(0,i)),decodeURIComponent(part.slice(i+1))]}));}
function secret(){return process.env.ADMIN_SESSION_SECRET||process.env.ADMIN_PASSWORD||'';}
function sign(payload){return crypto.createHmac('sha256',secret()).update(payload).digest('hex');}
function validAdmin(req){
  if(!secret()) return false;
  const token=cookies(req)[COOKIE_NAME]; if(!token) return false;
  const parts=token.split('.'); if(parts.length!==3) return false;
  const payload=`${parts[0]}.${parts[1]}`, expected=sign(payload), actual=parts[2];
  if(expected.length!==actual.length||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(actual))) return false;
  return Number(parts[0])>Date.now();
}
function requireAdmin(req,res,next){if(!validAdmin(req))return res.status(401).json({error:'Admin login required.'});next();}
function cleanIds(value){
  if(!Array.isArray(value)) return [];
  return [...new Set(value.map(v=>String(v||'').trim()).filter(Boolean).filter(v=>v!=='all'))].slice(0,30);
}
function cleanText(value,max=300){return String(value??'').trim().slice(0,max);}
function cleanUrl(value){const s=cleanText(value,500);if(!s)return'';try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)?u.toString():''}catch{return''}}
async function readAssignments(){
  if(!(await ensureSchema())) return {configured:false,items:[]};
  const {rows}=await db().query('SELECT product_id,collection_ids,updated_at FROM product_collection_assignments ORDER BY updated_at DESC');
  return {configured:true,items:rows.map(r=>({productId:r.product_id,collections:Array.isArray(r.collection_ids)?r.collection_ids:[],updatedAt:r.updated_at}))};
}
async function readNames(){
  if(!(await ensureSchema())) return {configured:false,items:[]};
  const {rows}=await db().query("SELECT product_id,display_name,updated_at FROM product_display_names WHERE display_name<>'' ORDER BY updated_at DESC");
  return {configured:true,items:rows.map(r=>({productId:r.product_id,displayName:r.display_name,updatedAt:r.updated_at}))};
}
async function readSocial(){
  const empty={instagram:'',facebook:'',tiktok:'',pinterest:''};
  if(!(await ensureSchema()))return{configured:false,links:empty};
  const {rows}=await db().query("SELECT setting_value FROM store_settings WHERE setting_key='socialLinks' LIMIT 1");
  const raw=rows[0]?.setting_value||{};
  return {configured:true,links:Object.fromEntries(Object.keys(empty).map(k=>[k,cleanUrl(raw?.[k])]))};
}

export function registerProductCollectionRoutes(app){
  registerMediaRoutes(app);
  app.get('/api/product-collections',async(_req,res)=>{try{res.json(await readAssignments())}catch(err){console.error('Product collections read error:',err);res.status(500).json({error:'Unable to load product collection assignments.'})}});
  app.get('/api/admin/product-collections',requireAdmin,async(_req,res)=>{try{res.json(await readAssignments())}catch(err){res.status(500).json({error:'Unable to load product collection assignments.'})}});
  app.put('/api/admin/product-collections/:id',requireAdmin,async(req,res)=>{
    try{
      if(!(await ensureSchema())) return res.status(503).json({error:'DATABASE_URL is not configured.'});
      const productId=String(req.params.id||'').trim().slice(0,140); if(!productId)return res.status(400).json({error:'Product id is required.'});
      const collections=cleanIds(req.body?.collections);
      const {rows}=await db().query(`INSERT INTO product_collection_assignments(product_id,collection_ids,updated_at)
        VALUES($1,$2::jsonb,NOW()) ON CONFLICT(product_id) DO UPDATE SET collection_ids=EXCLUDED.collection_ids,updated_at=NOW()
        RETURNING product_id,collection_ids,updated_at`,[productId,JSON.stringify(collections)]);
      const r=rows[0];res.json({ok:true,item:{productId:r.product_id,collections:r.collection_ids,updatedAt:r.updated_at}});
    }catch(err){console.error('Product collections save error:',err);res.status(500).json({error:'Unable to save product collections.'})}
  });
  app.delete('/api/admin/product-collections/:id',requireAdmin,async(req,res)=>{
    try{
      if(!(await ensureSchema())) return res.status(503).json({error:'DATABASE_URL is not configured.'});
      const productId=String(req.params.id||'').trim().slice(0,140); if(!productId)return res.status(400).json({error:'Product id is required.'});
      await db().query('DELETE FROM product_collection_assignments WHERE product_id=$1',[productId]);
      res.json({ok:true,productId,automatic:true});
    }catch(err){console.error('Product collections reset error:',err);res.status(500).json({error:'Unable to reset product collections.'})}
  });

  app.get('/api/product-names',async(_req,res)=>{try{res.json(await readNames())}catch(err){res.status(500).json({error:'Unable to load product names.'})}});
  app.get('/api/admin/product-names',requireAdmin,async(_req,res)=>{try{res.json(await readNames())}catch(err){res.status(500).json({error:'Unable to load product names.'})}});
  app.put('/api/admin/product-names/:id',requireAdmin,async(req,res)=>{
    try{
      if(!(await ensureSchema()))return res.status(503).json({error:'DATABASE_URL is not configured.'});
      const productId=cleanText(req.params.id,140),displayName=cleanText(req.body?.displayName,180);
      if(!productId)return res.status(400).json({error:'Product id is required.'});
      if(!displayName){await db().query('DELETE FROM product_display_names WHERE product_id=$1',[productId]);return res.json({ok:true,item:{productId,displayName:''}})}
      const {rows}=await db().query(`INSERT INTO product_display_names(product_id,display_name,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(product_id) DO UPDATE SET display_name=EXCLUDED.display_name,updated_at=NOW() RETURNING product_id,display_name,updated_at`,[productId,displayName]);
      const r=rows[0];res.json({ok:true,item:{productId:r.product_id,displayName:r.display_name,updatedAt:r.updated_at}});
    }catch(err){console.error('Product rename error:',err);res.status(500).json({error:'Unable to save product name.'})}
  });

  app.get('/api/social-links',async(_req,res)=>{try{res.json(await readSocial())}catch(err){res.status(500).json({error:'Unable to load social links.'})}});
  app.get('/api/admin/social-links',requireAdmin,async(_req,res)=>{try{res.json(await readSocial())}catch(err){res.status(500).json({error:'Unable to load social links.'})}});
  app.put('/api/admin/social-links',requireAdmin,async(req,res)=>{
    try{
      if(!(await ensureSchema()))return res.status(503).json({error:'DATABASE_URL is not configured.'});
      const links={instagram:cleanUrl(req.body?.instagram),facebook:cleanUrl(req.body?.facebook),tiktok:cleanUrl(req.body?.tiktok),pinterest:cleanUrl(req.body?.pinterest)};
      await db().query(`INSERT INTO store_settings(setting_key,setting_value,updated_at) VALUES('socialLinks',$1::jsonb,NOW()) ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_at=NOW()`,[JSON.stringify(links)]);
      res.json({ok:true,links});
    }catch(err){console.error('Social links save error:',err);res.status(500).json({error:'Unable to save social links.'})}
  });
}
