import crypto from 'crypto';
import pg from 'pg';

const { Pool } = pg;
let pool;
function db(){
  if(!pool){
    if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
    pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined});
  }
  return pool;
}
function auth(req,res,next){
  const expected=String(process.env.PARENT_DASHBOARD_API_KEY||process.env.ADMIN_PASSWORD||'');
  const supplied=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!expected||supplied.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected))) return res.status(401).json({error:'Unauthorized'});
  next();
}
function key(){
  const raw=String(process.env.PASSWORD_VAULT_KEY||'');
  if(!/^[a-f0-9]{64}$/i.test(raw)) throw new Error('PASSWORD_VAULT_KEY is not configured correctly');
  return Buffer.from(raw,'hex');
}
function encrypt(value){
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);
  const encrypted=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);
  return {encrypted_password:encrypted.toString('base64'),iv:iv.toString('base64'),auth_tag:cipher.getAuthTag().toString('base64')};
}
function decrypt(row){
  const decipher=crypto.createDecipheriv('aes-256-gcm',key(),Buffer.from(row.iv,'base64'));
  decipher.setAuthTag(Buffer.from(row.auth_tag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(row.encrypted_password,'base64')),decipher.final()]).toString('utf8');
}
const clean=(v,n=500)=>String(v??'').trim().slice(0,n);

export function registerPasswordVaultRoutes(app){
  app.get('/api/holding/vault',auth,async(_req,res)=>{
    try{
      const {rows}=await db().query(`SELECT v.id,v.label,v.website_url,v.username,v.notes,v.created_at,v.updated_at,b.display_name AS business_name,s.name AS site_name FROM password_vault v LEFT JOIN businesses b ON b.id=v.business_id LEFT JOIN sites s ON s.id=v.site_id ORDER BY v.label`);
      res.json({items:rows.map(r=>({...r,passwordMasked:'••••••••••••'}))});
    }catch(err){res.status(500).json({error:'Unable to load password vault',detail:err.message});}
  });
  app.get('/api/holding/vault/:id/reveal',auth,async(req,res)=>{
    try{
      const {rows}=await db().query('SELECT encrypted_password,iv,auth_tag FROM password_vault WHERE id=$1',[req.params.id]);
      if(!rows.length)return res.status(404).json({error:'Credential not found'});
      res.json({password:decrypt(rows[0])});
    }catch(err){res.status(500).json({error:'Unable to reveal password'});}
  });
  app.post('/api/holding/vault',auth,async(req,res)=>{
    try{
      const {label,websiteUrl,username,password,notes,businessId,siteId}=req.body||{};
      if(!clean(label,120)||!String(password||''))return res.status(400).json({error:'Label and password are required'});
      const enc=encrypt(password);
      const {rows}=await db().query(`INSERT INTO password_vault(business_id,site_id,label,website_url,username,encrypted_password,iv,auth_tag,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,label,website_url,username,notes,created_at,updated_at`,[businessId||null,siteId||null,clean(label,120),clean(websiteUrl,500)||null,clean(username,250)||null,enc.encrypted_password,enc.iv,enc.auth_tag,clean(notes,2000)||null]);
      res.status(201).json(rows[0]);
    }catch(err){res.status(500).json({error:'Unable to save credential',detail:err.message});}
  });
  app.put('/api/holding/vault/:id',auth,async(req,res)=>{
    try{
      const {label,websiteUrl,username,password,notes,businessId,siteId}=req.body||{};
      const current=await db().query('SELECT * FROM password_vault WHERE id=$1',[req.params.id]);
      if(!current.rowCount)return res.status(404).json({error:'Credential not found'});
      let enc={encrypted_password:current.rows[0].encrypted_password,iv:current.rows[0].iv,auth_tag:current.rows[0].auth_tag};
      if(String(password||''))enc=encrypt(password);
      await db().query(`UPDATE password_vault SET business_id=$1,site_id=$2,label=$3,website_url=$4,username=$5,encrypted_password=$6,iv=$7,auth_tag=$8,notes=$9,updated_at=NOW() WHERE id=$10`,[businessId||null,siteId||null,clean(label||current.rows[0].label,120),clean(websiteUrl,500)||null,clean(username,250)||null,enc.encrypted_password,enc.iv,enc.auth_tag,clean(notes,2000)||null,req.params.id]);
      res.json({ok:true});
    }catch(err){res.status(500).json({error:'Unable to update credential'});}
  });
  app.delete('/api/holding/vault/:id',auth,async(req,res)=>{
    try{await db().query('DELETE FROM password_vault WHERE id=$1',[req.params.id]);res.json({ok:true});}
    catch{res.status(500).json({error:'Unable to delete credential'});}
  });
}
