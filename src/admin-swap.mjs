import {assertActive} from './member-controls.mjs';
import {hash} from './security.mjs';
import {adminRole} from './admin.mjs';
const fail=(message,status=403)=>{throw Object.assign(new Error(message),{status});};
export const cookieValue=(req,name)=>req.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1)||'';
export const swapCookie=(req,token='')=>`mart_swap=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${token?1800:0}${new URL(req.url).protocol==='https:'?'; Secure':''}`;
export async function startSwap(req,env,actor,input){
 if(await adminRole(env,actor)!=='owner')fail('เฉพาะแอดมินสูงสุดเท่านั้นที่เข้าดูแทนร้านค้าได้');
 const reason=typeof input.reason==='string'?input.reason.trim():'';
 if(reason.length<5||reason.length>500)fail('กรุณาระบุเหตุผล 5–500 ตัวอักษร',400);
 const shop=await env.DB.prepare('SELECT id,owner_id,slug FROM shops WHERE id=?').bind(typeof input.shop_id==='string'?input.shop_id:'').first();if(!shop)fail('ไม่พบร้านค้า',404);
 await assertActive(env,shop.owner_id);
 const token=crypto.randomUUID()+crypto.randomUUID(),session=await hash(cookieValue(req,'mart_session'));
 await env.DB.batch([
  env.DB.prepare('DELETE FROM admin_swaps WHERE actor_session_hash=? OR expires<=?').bind(session,Math.floor(Date.now()/1000)),
  env.DB.prepare('INSERT INTO admin_swaps VALUES(?,?,?,?,?,?)').bind(await hash(token),session,actor.id,shop.owner_id,shop.id,Math.floor(Date.now()/1000)+1800),
  env.DB.prepare('INSERT INTO admin_audit(id,actor_id,target_id,shop_id,action,reason) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),actor.id,shop.owner_id,shop.id,'swap_start',reason)
 ]);
 return {token,shop_id:shop.id};
}
export async function stopSwap(req,env){
 const token=cookieValue(req,'mart_swap'),session=cookieValue(req,'mart_session');
 if(token&&session){
 const key=await hash(token),actorSession=await hash(session);
 await env.DB.batch([
 env.DB.prepare("INSERT INTO admin_audit(id,actor_id,target_id,shop_id,action) SELECT ?,actor_id,target_id,shop_id,'swap_stop' FROM admin_swaps WHERE token_hash=? AND actor_session_hash=?").bind(crypto.randomUUID(),key,actorSession),
 env.DB.prepare('DELETE FROM admin_swaps WHERE token_hash=? AND actor_session_hash=?').bind(key,actorSession)
 ]);
 }
}
export async function swapUser(req,env,actor){
 const token=cookieValue(req,'mart_swap');if(!token)return actor;
 const row=await env.DB.prepare('SELECT * FROM admin_swaps WHERE token_hash=? AND actor_session_hash=? AND actor_id=? AND expires>?').bind(await hash(token),await hash(cookieValue(req,'mart_session')),actor.id,Math.floor(Date.now()/1000)).first();
 if(!row||await adminRole(env,actor)!=='owner')fail('หมดเวลาหรือสิทธิ์เข้าดูแทนร้านค้าถูกยกเลิก กรุณากลับบัญชีแอดมิน',409);
 const target=await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(row.target_id).first();if(!target)fail('ไม่พบบัญชีร้านค้า',409);
 await assertActive(env,target.id);
 return {...target,impersonation:{actor_email:actor.email,target_email:target.email,shop_id:row.shop_id,expires:row.expires,read_only:true}};
}
