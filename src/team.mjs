import {boundedHTML} from './import.mjs';
import {effectivePlan} from './plans.mjs';
import {assertActive} from './member-controls.mjs';
import {hash,hex,passwordHash,escape as e} from './security.mjs';
import {recoveryLimit} from './password-recovery.mjs';
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const fail=(message,status=403)=>{throw Object.assign(new Error(message),{status});};
const now=()=>Math.floor(Date.now()/1000);
export const teamLimit=plan=>({growth:3,brand:8}[plan]||0);
const liveSQL="(status='active' OR (status='pending' AND expires>unixepoch()))";
export async function teamAudit(env,owner,actor,action,target){
 await env.DB.batch([q(env,'INSERT INTO team_audit(owner_id,actor_id,action,target) VALUES(?,?,?,?)',owner,actor,action,target),q(env,'DELETE FROM team_audit WHERE owner_id=? AND id NOT IN (SELECT id FROM team_audit WHERE owner_id=? ORDER BY id DESC LIMIT 500)',owner,owner)]);
}
async function seats(env,owner,limit){return (await q(env,`SELECT * FROM shop_team WHERE owner_id=? AND ${liveSQL} ORDER BY created_at,rowid LIMIT ?`,owner,limit).all()).results;}
export async function teamAccess(env,actor,shop){
 if(shop.owner_id===actor.id)return {role:'owner'};
 await assertActive(env,shop.owner_id);
 const plan=await effectivePlan(env,{id:shop.owner_id});
 const row=(await seats(env,shop.owner_id,teamLimit(plan.id))).find(r=>r.status==='active'&&r.user_id===actor.id);
 const grant=row&&JSON.parse(row.grants_json)[shop.id];
 if(!grant)fail('ไม่พบร้านค้า หรือสิทธิ์ทีมถูกพักตามแพ็กเกจ',404);
 return {...grant,plan};
}
export async function teamShops(env,actor){
 const owned=(await q(env,'SELECT * FROM shops WHERE owner_id=? ORDER BY created_at',actor.id).all()).results;
 const result=owned.map(s=>({...s,access:{role:'owner'}}));
 const candidates=(await q(env,"SELECT s.* FROM shops s JOIN shop_team t ON t.owner_id=s.owner_id WHERE t.user_id=? AND t.status='active' ORDER BY s.created_at",actor.id).all()).results;
 for(const shop of candidates){try{const access=await teamAccess(env,actor,shop);result.push({...shop,access});}catch(err){if(![403,404].includes(err.status))throw err;}}
 return result;
}
export async function scopedMedia(env,user,key){
 if(!user.team)return true;
 return !!await q(env,`SELECT s.id FROM shops s WHERE s.id=? AND (s.logo_key=? OR s.cover_key=? OR EXISTS(SELECT 1 FROM json_each(s.showcase_json,'$.campaigns') c WHERE json_extract(c.value,'$.key')=? OR json_extract(c.value,'$.mobile')=?) OR EXISTS(SELECT 1 FROM products p WHERE p.shop_id=s.id AND (p.image_key=? OR instr(p.description_html,?)>0 OR EXISTS(SELECT 1 FROM json_each(p.gallery_json) g WHERE json_extract(g.value,'$.key')=?))) OR EXISTS(SELECT 1 FROM team_media m WHERE m.shop_id=s.id AND m.key=?))`,user.team.shop_id,key,key,key,key,key,'src="/media/'+encodeURIComponent(key)+'"',key,key).first();
}
export async function teamMediaRead(env,actor,key){
 for(const shop of await teamShops(env,actor)){if(shop.access.role!=='owner'&&await scopedMedia(env,{team:{shop_id:shop.id}},key))return true;}
 return false;
}
// Resolve a single shop before using the owner's quotas. Never proxy account, admin or billing routes.
export async function teamContext(req,env,actor){
 const path=new URL(req.url).pathname,method=req.method,header=req.headers.get('X-Mart-Shop');
 if(header&&/^\/api\/(billing\/|usage$|shops$)/.test(path)){
  const s=await q(env,'SELECT * FROM shops WHERE id=?',header).first();
  if(!s||s.owner_id!==actor.id)fail('เฉพาะเจ้าของบัญชีเท่านั้นที่จัดการการชำระเงินและพื้นที่บัญชีได้');
 }
 let shopId=path.match(/^\/(?:api\/shops|preview)\/([^/]+)/)?.[1];
 const productId=path.match(/^\/api\/products\/([^/]+)/)?.[1];
 const trashId=path.match(/^\/api\/trash\/([^/]+)/)?.[1];
 let product;
 if(productId){product=await q(env,'SELECT shop_id,status FROM products WHERE id=?',productId).first();shopId=product?.shop_id;}
 if(trashId)shopId=(await q(env,'SELECT shop_id FROM product_trash WHERE id=?',trashId).first())?.shop_id;
 if(!shopId&&/^\/api\/(import|media(?:\/import|\/video)?)$/.test(path))shopId=header;
 if(!shopId)return actor;
 const shop=await q(env,'SELECT * FROM shops WHERE id=?',shopId).first();if(!shop)fail('ไม่พบร้านค้า',404);
 if(header&&header!==shopId)fail('คำขอไม่ตรงกับร้านที่เลือก');
 const access=await teamAccess(env,actor,shop);if(access.role==='owner')return actor;
 if(actor.impersonation)fail('โหมดเข้าดูแทนไม่สามารถใช้สิทธิ์ทีมได้');
 if(!['GET','HEAD'].includes(method)){
  let data={};if(method!=='DELETE'&&!/^\/api\/media(?:\/video)?$/.test(path)){try{data=JSON.parse(await boundedHTML(req.clone(),200000))||{};}catch{fail('ข้อมูลไม่ถูกต้องหรือยาวเกินไป',400);}}
  const requireScope=scope=>{if(access.role!=='editor'||!access[scope])fail('คุณไม่มีสิทธิ์แก้ไขส่วนนี้ กรุณาติดต่อเจ้าของร้าน');};
  if(path===`/api/shops/${shopId}/duplicate`){/* read-only lookup */}
  else if(path===`/api/shops/${shopId}/showcase`)requireScope('campaigns');
  else if(path===`/api/shops/${shopId}`){requireScope('store');if((data.published===true?1:0)!==shop.published)fail('เฉพาะเจ้าของร้านเท่านั้นที่เปิดหรือปิดหน้าร้านได้');}
  else if(/^\/api\/media(?:\/import|\/video)?$/.test(path)){if(access.role!=='editor'||!['products','store','campaigns'].some(k=>access[k]))fail('คุณไม่มีสิทธิ์อัปโหลดไฟล์');}
  else if(trashId){requireScope('products');if(method==='DELETE')fail('เฉพาะเจ้าของร้านเท่านั้นที่ลบถาวรได้');}
  else {
   requireScope('products');
   if(!access.publish){
    if(product?.status==='published'||data.status==='published'||path.endsWith('/bulk-status'))fail('ต้องมีสิทธิ์เผยแพร่จึงจะแก้ไขสินค้าที่เผยแพร่แล้วหรือเปลี่ยนสถานะได้');
    if(path.endsWith('/bulk-category')&&await q(env,"SELECT id FROM products WHERE shop_id=? AND status='published' AND id IN (SELECT value FROM json_each(?)) LIMIT 1",shopId,JSON.stringify(data.ids||[])).first())fail('ต้องมีสิทธิ์เผยแพร่เพื่อแก้ไขสินค้าที่เผยแพร่แล้ว');
   }
  }
 }
 const owner=await q(env,'SELECT * FROM users WHERE id=?',shop.owner_id).first();
 return {...owner,team:{...access,shop_id:shopId,actor_id:actor.id}};
}
async function grants(env,owner,input){
 if(!input||typeof input!=='object'||Array.isArray(input)||!Object.keys(input).length||Object.keys(input).length>3)fail('เลือกร้านอย่างน้อยหนึ่งร้าน',400);
 const result={};for(const [id,g] of Object.entries(input)){
  if(!await q(env,'SELECT id FROM shops WHERE id=? AND owner_id=?',id,owner).first())fail('เลือกร้านของบัญชีคุณเท่านั้น');
  if(!g||!['viewer','editor'].includes(g.role))fail('บทบาทไม่ถูกต้อง',400);
  result[id]={role:g.role};for(const k of ['products','store','campaigns','publish'])result[id][k]=g.role==='editor'&&g[k]===true;
  if(!result[id].products)result[id].publish=false;
 }return JSON.stringify(result);
}
export async function manageTeam(req,env,actor,data){
 if(actor.impersonation)fail('โหมดเข้าดูแทนไม่สามารถจัดการทีมได้');
 const plan=await effectivePlan(env,actor),limit=teamLimit(plan.id),action=data.action;
 if(!await recoveryLimit(env,'team-manage:'+actor.id,40))fail('ทำรายการถี่เกินไป กรุณารอ 15 นาที',429);
 if(action==='revoke'){
  const result=await q(env,"UPDATE shop_team SET status='revoked',token_hash=NULL,expires=0 WHERE id=? AND owner_id=?",String(data.id||''),actor.id).run();
  if(!result.meta.changes)fail('ไม่พบสมาชิก',404);
  await teamAudit(env,actor.id,actor.id,'revoke',data.id);return {ok:true};
 }
 if(!limit)fail('ทีมงานสำหรับแพ็กเกจ Growth และ Brand');
 const permissions=await grants(env,actor.id,data.grants);
 if(action==='update'){
  const result=await q(env,"UPDATE shop_team SET grants_json=? WHERE id=? AND owner_id=? AND status<>'revoked'",permissions,String(data.id||''),actor.id).run();if(!result.meta.changes)fail('ไม่พบสมาชิก',404);
  await teamAudit(env,actor.id,actor.id,'permissions',data.id);return {ok:true};
 }
 if(action!=='invite')fail('รายการไม่ถูกต้อง',400);
 const email=typeof data.email==='string'?data.email.trim().toLowerCase():'';
 if(email===actor.email||email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('ระบุอีเมลพนักงานที่ต่างจากเจ้าของบัญชี',400);
 if(!env.POSTMARK_SERVER_TOKEN||!env.MAIL_FROM||!env.RECOVERY_ORIGIN)fail('ระบบอีเมลยังไม่พร้อม',503);
 if(env.APP_ENV!=='production'&&!String(env.STAGING_MAIL_RECIPIENTS||'').toLowerCase().split(',').map(x=>x.trim()).includes(email))fail('Staging: ให้ผู้ดูแลเพิ่มอีเมลทดสอบใน STAGING_MAIL_RECIPIENTS ก่อนส่งคำเชิญ',403);
 const origin=new URL(env.RECOVERY_ORIGIN);if(origin.protocol!=='https:'||origin.username||origin.password)fail('ระบบอีเมลยังไม่พร้อม',503);
 const token=hex(crypto.getRandomValues(new Uint8Array(32))),digest=await hash(token),id=crypto.randomUUID();
 const result=await q(env,`INSERT INTO shop_team(id,owner_id,email,status,grants_json,token_hash,expires) SELECT ?,?,?,'pending',?,?,? WHERE (SELECT COUNT(*) FROM shop_team WHERE owner_id=? AND ${liveSQL})<? ON CONFLICT(owner_id,email) DO UPDATE SET status='pending',user_id=NULL,grants_json=excluded.grants_json,token_hash=excluded.token_hash,expires=excluded.expires,created_at=unixepoch() WHERE shop_team.status='revoked' OR (shop_team.status='pending' AND shop_team.expires<=unixepoch())`,id,actor.id,email,permissions,digest,now()+172800,actor.id,limit).run();
 if(!result.meta.changes)fail('ทีมครบโควตาหรืออีเมลนี้มีสิทธิ์/คำเชิญอยู่แล้ว ถอนคำเชิญเดิมก่อนส่งใหม่',409);
 const link=origin.origin+'/team-invite#token='+token;
 try{
  const response=await (env.MAIL_FETCH||fetch)('https://api.postmarkapp.com/email',{method:'POST',headers:{'Content-Type':'application/json','X-Postmark-Server-Token':env.POSTMARK_SERVER_TOKEN},signal:AbortSignal.timeout(15000),body:JSON.stringify({From:env.MAIL_FROM,To:email,ReplyTo:env.MAIL_REPLY_TO||'',MessageStream:'outbound',TrackOpens:false,TrackLinks:'None',Subject:(env.APP_ENV==='production'?'':'[Staging] ')+'คำเชิญร่วมทีมร้านค้า — Lync to Mart',TextBody:`${actor.email} เชิญคุณเข้าทีมร้านค้า Lync to Mart\n${link}\nลิงก์มีอายุ 48 ชั่วโมง หากไม่รู้จักผู้เชิญ ให้ละเว้นอีเมลนี้`,HtmlBody:`<p>${e(actor.email)} เชิญคุณร่วมทีมร้านค้า</p><p><a href="${e(link)}">ตรวจสิทธิ์และยอมรับคำเชิญ</a></p><p>ลิงก์มีอายุ 48 ชั่วโมง หากไม่รู้จักผู้เชิญ ให้ละเว้นอีเมลนี้</p>`})});
  if(!response.ok||(await response.json()).ErrorCode!==0)throw Error('Mail failed');
 }catch{await q(env,"UPDATE shop_team SET status='revoked',token_hash=NULL WHERE token_hash=?",digest).run();fail('ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่',503);}
 await teamAudit(env,actor.id,actor.id,'invite',email);return {ok:true};
}
export async function teamList(env,actor){
 const plan=await effectivePlan(env,actor),limit=teamLimit(plan.id),allowed=new Set((await seats(env,actor.id,limit)).map(r=>r.id));
 const rows=(await q(env,"SELECT id,email,status,grants_json,expires FROM shop_team WHERE owner_id=? AND status<>'revoked' ORDER BY created_at,rowid",actor.id).all()).results;
 return {limit,members:rows.map(r=>({...r,grants:JSON.parse(r.grants_json),enabled:allowed.has(r.id)})),shops:(await q(env,'SELECT id,name FROM shops WHERE owner_id=? ORDER BY created_at',actor.id).all()).results,audit:(await q(env,'SELECT a.action,a.target,a.created_at,u.email AS actor FROM team_audit a LEFT JOIN users u ON u.id=a.actor_id WHERE a.owner_id=? ORDER BY a.id DESC LIMIT 50',actor.id).all()).results};
}
export async function invitation(env,token){
 if(typeof token!=='string'||! /^[a-f0-9]{64}$/.test(token))fail('คำเชิญไม่ถูกต้องหรือหมดอายุ',400);
 const row=await q(env,"SELECT * FROM shop_team WHERE token_hash=? AND status='pending' AND expires>?",await hash(token),now()).first();if(!row)fail('คำเชิญหมดอายุ ถูกถอน หรือถูกใช้แล้ว',410);
 await assertActive(env,row.owner_id);
 const plan=await effectivePlan(env,{id:row.owner_id});if(!(await seats(env,row.owner_id,teamLimit(plan.id))).some(r=>r.id===row.id))fail('เจ้าของบัญชีต้องจัดโควตาทีมให้พร้อมก่อนรับคำเชิญ');
 return row;
}
export async function inviteInfo(env,token){const row=await invitation(env,token);return {email:row.email,existing:!!await q(env,'SELECT id FROM users WHERE email=?',row.email).first(),grants:JSON.parse(row.grants_json),shops:(await q(env,'SELECT id,name FROM shops WHERE owner_id=? AND id IN (SELECT key FROM json_each(?))',row.owner_id,row.grants_json).all()).results};}
export async function acceptInvite(req,env,data,actor){
 if(!await recoveryLimit(env,'team-accept:'+(req.headers.get('cf-connecting-ip')||'local'),20))fail('กรุณารอ 15 นาที',429);
 const row=await invitation(env,data.token),existing=await q(env,'SELECT id,email FROM users WHERE email=?',row.email).first();
 let id=existing?.id,newPassword;
 if(existing){if(!actor||actor.id!==existing.id)fail('เข้าสู่ระบบด้วยอีเมลที่ได้รับคำเชิญก่อน',401);await assertActive(env,existing.id);}
 else{if(typeof data.password!=='string'||data.password.length<12||data.password.length>128||data.password!==data.confirm_password)fail('รหัสผ่าน 12–128 ตัวอักษร และทั้งสองช่องต้องตรงกัน',400);id=crypto.randomUUID();newPassword=await passwordHash(data.password);}
 const statements=[];
 if(newPassword)statements.push(q(env,"INSERT INTO users(id,email,password,plan_id) SELECT ?,email,?,'free' FROM shop_team WHERE id=? AND token_hash=? AND status='pending' AND expires>? ON CONFLICT(email) DO NOTHING",id,newPassword,row.id,row.token_hash,now()));
 statements.push(q(env,"UPDATE shop_team SET user_id=?,status='active',token_hash=NULL,expires=0 WHERE id=? AND token_hash=? AND status='pending' AND expires>? AND EXISTS(SELECT 1 FROM users WHERE id=? AND email=?)",id,row.id,row.token_hash,now(),id,row.email));
 if(newPassword)statements.push(q(env,'INSERT OR IGNORE INTO user_verifications(user_id) SELECT user_id FROM shop_team WHERE id=? AND user_id=? AND status=\'active\'',row.id,id));
 const results=await env.DB.batch(statements);if(results[newPassword?1:0].meta.changes!==1)fail('คำเชิญถูกใช้แล้วหรือบัญชีเปลี่ยน กรุณาเข้าสู่ระบบแล้วเปิดลิงก์อีกครั้ง',409);
 await teamAudit(env,row.owner_id,id,'accept',row.email);return {ok:true};
}
