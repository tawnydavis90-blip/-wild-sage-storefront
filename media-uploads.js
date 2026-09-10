import crypto from 'crypto';
import express from 'express';
import pg from 'pg';

const { Pool } = pg;
const COOKIE_NAME = 'wild_sage_admin';
const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg','image/png','image/webp']);
let pool = null;
let schemaReady = false;

function db(){
  if(!process.env.DATABASE_URL) return null;
  if(!pool) pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized:false } : undefined
  });
  return pool;
}
async function ensureSchema(){
  const client = db();
  if(!client) return false;
  if(schemaReady) return true;
  await client.query(`CREATE TABLE IF NOT EXISTS admin_media (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    media_bytes BYTEA NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  schemaReady = true;
  return true;
}
function cookies(req){
  return Object.fromEntries(String(req.headers.cookie||'').split(';').map(v=>v.trim()).filter(Boolean).map(part=>{
    const i=part.indexOf('=');
    return [decodeURIComponent(part.slice(0,i)),decodeURIComponent(part.slice(i+1))];
  }));
}
function secret(){ return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || ''; }
function sign(payload){ return crypto.createHmac('sha256',secret()).update(payload).digest('hex'); }
function validAdmin(req){
  if(!secret()) return false;
  const token=cookies(req)[COOKIE_NAME];
  if(!token) return false;
  const parts=token.split('.');
  if(parts.length!==3) return false;
  const payload=`${parts[0]}.${parts[1]}`, expected=sign(payload), actual=parts[2];
  if(expected.length!==actual.length || !crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(actual))) return false;
  return Number(parts[0]) > Date.now();
}
function requireAdmin(req,res,next){
  if(!validAdmin(req)) return res.status(401).json({error:'Admin login required.'});
  next();
}
function cleanName(value){
  return String(value||'image').replace(/[\r\n]/g,' ').replace(/[^a-zA-Z0-9._ -]/g,'').trim().slice(0,160) || 'image';
}
function mediaUrl(req,id){
  const protocol=process.env.NODE_ENV==='production'?'https':req.protocol;
  return `${protocol}://${req.get('host')}/api/media/${id}`;
}
async function usageFor(req,id){
  const client=db();
  if(!client) return [];
  try{
    const absolute=mediaUrl(req,id);
    const relative=`/api/media/${id}`;
    const {rows}=await client.query(`
      SELECT product_id, mockup_urls
      FROM product_merchandising
      WHERE mockup_urls::text LIKE $1 OR mockup_urls::text LIKE $2
    `,[`%${absolute}%`,`%${relative}%`]);
    return rows.map(r=>({
      productId:r.product_id,
      slots:(Array.isArray(r.mockup_urls)?r.mockup_urls:[]).map((url,index)=>({url,index})).filter(x=>String(x.url||'').includes(`/api/media/${id}`)).map(x=>x.index)
    })).filter(x=>x.slots.length);
  }catch{
    return [];
  }
}

export function registerMediaRoutes(app){
  app.post('/api/admin/media', requireAdmin, express.raw({type:'application/octet-stream',limit:'6mb'}), async(req,res)=>{
    try{
      if(!(await ensureSchema())) return res.status(503).json({error:'DATABASE_URL is not configured.'});
      const mime=String(req.headers['x-mime-type']||'').toLowerCase().trim();
      if(!ALLOWED_TYPES.has(mime)) return res.status(400).json({error:'Please upload a JPG, PNG, or WebP image.'});
      if(!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({error:'The uploaded image was empty.'});
      if(req.body.length > MAX_BYTES) return res.status(413).json({error:'Image is too large. Maximum upload size is 6 MB.'});
      const id=crypto.randomUUID();
      const filename=cleanName(req.headers['x-file-name']);
      await db().query('INSERT INTO admin_media(id,filename,mime_type,media_bytes,size_bytes) VALUES($1,$2,$3,$4,$5)',[id,filename,mime,req.body,req.body.length]);
      res.status(201).json({ok:true,id,filename,mimeType:mime,size:req.body.length,url:mediaUrl(req,id)});
    }catch(err){
      console.error('Media upload error:',err);
      res.status(500).json({error:'Unable to upload image.'});
    }
  });

  app.get('/api/media/:id', async(req,res)=>{
    try{
      if(!(await ensureSchema())) return res.sendStatus(404);
      const {rows}=await db().query('SELECT mime_type,media_bytes,filename,size_bytes FROM admin_media WHERE id=$1',[String(req.params.id||'')]);
      const media=rows[0];
      if(!media) return res.sendStatus(404);
      res.setHeader('Content-Type',media.mime_type);
      res.setHeader('Content-Length',String(media.size_bytes));
      res.setHeader('Cache-Control','public, max-age=31536000, immutable');
      res.setHeader('Content-Disposition',`inline; filename="${cleanName(media.filename)}"`);
      res.send(media.media_bytes);
    }catch(err){
      console.error('Media read error:',err);
      res.sendStatus(404);
    }
  });

  app.get('/api/admin/media', requireAdmin, async(req,res)=>{
    try{
      if(!(await ensureSchema())) return res.json({configured:false,items:[]});
      const {rows}=await db().query('SELECT id,filename,mime_type,size_bytes,created_at FROM admin_media ORDER BY created_at DESC LIMIT 250');
      const items=[];
      for(const r of rows){
        const usage=await usageFor(req,r.id);
        items.push({
          id:r.id,
          filename:r.filename,
          mimeType:r.mime_type,
          size:r.size_bytes,
          createdAt:r.created_at,
          url:`/api/media/${r.id}`,
          usage,
          usageCount:usage.length
        });
      }
      res.json({configured:true,items});
    }catch(err){
      console.error('Media library error:',err);
      res.status(500).json({error:'Unable to load media library.'});
    }
  });

  app.delete('/api/admin/media/:id', requireAdmin, async(req,res)=>{
    try{
      if(!(await ensureSchema())) return res.status(503).json({error:'DATABASE_URL is not configured.'});
      const id=String(req.params.id||'');
      const usage=await usageFor(req,id);
      if(usage.length) return res.status(409).json({error:'This image is still assigned to a product. Remove it from those products before deleting it.',usage});
      await db().query('DELETE FROM admin_media WHERE id=$1',[id]);
      res.json({ok:true});
    }catch(err){
      console.error('Media delete error:',err);
      res.status(500).json({error:'Unable to delete image.'});
    }
  });
}
