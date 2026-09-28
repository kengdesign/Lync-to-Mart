import {adminRole} from './admin.mjs';
import {passwordHash} from './security.mjs';
const fail=(m,s=400)=>{throw Object.assign(new Error(m),{status:s});};
export const activeMemberSQL="NOT EXISTS(SELECT 1 FROM member_controls mc WHERE mc.user_id=u.id AND mc.status<>'active')";
export async function assertActive(env,id){const c=await env.DB.prepare('SELECT status FROM member_controls WHERE user_id=?').bind(id).first();if(c&&c.status!=='active')fail(c.status==='invited'?'กรุณายืนยันอีเมลและตั้งรหัสผ่านก่อนเข้าสู่ระบบ':'บัญชีนี้ถูกระงับหรือปิดใช้งาน กรุณาติดต่อผู้ดูแล',403);}
export async function manageMember(env,actor,b){
 if(await adminRole(env,actor)!=='owner')fail('เฉพาะ Owner เท่านั้นที่จัดการสมาชิกได้',403);
 const reason=typeof b.reason==='string'?b.reason.trim():'';if(reason.length<5||reason.length>500)fail('กรุณาระบุเหตุผล 5–500 ตัวอักษร');
 const audit=(id,action,detail)=>env.DB.prepare('INSERT INTO admin_audit(id,actor_id,target_id,shop_id,action,reason) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),actor.id,id,'',action,reason+' | '+detail);
 if(b.action==='create'){
 const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)fail('อีเมลไม่ถูกต้อง');
 const id=crypto.randomUUID(),password=await passwordHash(crypto.randomUUID()+crypto.randomUUID());
 try{await env.DB.batch([env.DB.prepare("INSERT INTO users(id,email,password,plan_id) VALUES(?,?,?,'free')").bind(id,email,password),env.DB.prepare("INSERT INTO member_controls(user_id,status,invited_by) VALUES(?,'invited',?)").bind(id,actor.id),audit(id,'member_create',email)]);}catch(error){if(String(error.message).includes('UNIQUE'))fail('อีเมลนี้มีอยู่ในระบบแล้ว',409);throw error;}
 return {ok:true,id,message:'เพิ่มสมาชิกแล้ว ให้เจ้าของอีเมลเปิดหน้าสมัครสมาชิกเพื่อยืนยันและตั้งรหัสผ่าน'};
 }
 const user=await env.DB.prepare('SELECT id,email FROM users WHERE id=?').bind(typeof b.user_id==='string'?b.user_id:'').first();if(!user)fail('ไม่พบสมาชิก',404);
 if(b.action==='role'){
 if(!['owner','admin','support','member'].includes(b.role))fail('สิทธิ์ไม่ถูกต้อง');
 if(user.id===actor.id)fail('ไม่อนุญาตเปลี่ยนสิทธิ์ของตัวเอง',403);
 const previous=await adminRole(env,user)||'member';
 if(previous==='owner')fail('ไม่อนุญาตลดสิทธิ์แอดมินสูงสุดผ่านเมนูนี้',403);
 if(b.confirm_email!==user.email)fail('กรุณาพิมพ์อีเมลสมาชิกให้ตรงเพื่อยืนยัน');
 if(b.role!=='member'){
 await assertActive(env,user.id);
 if(!await env.DB.prepare('SELECT user_id FROM user_verifications WHERE user_id=?').bind(user.id).first())fail('สมาชิกต้องยืนยันอีเมลก่อนรับสิทธิ์ผู้ดูแล',409);
 }
 await env.DB.batch([
 b.role==='member'?env.DB.prepare('DELETE FROM admin_roles WHERE user_id=?').bind(user.id):env.DB.prepare('INSERT INTO admin_roles(user_id,role) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role').bind(user.id,b.role),
 env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id),
 env.DB.prepare('DELETE FROM admin_swaps WHERE actor_id=? OR target_id=?').bind(user.id,user.id),
 audit(user.id,'member_role',JSON.stringify({email:user.email,from:previous,to:b.role}))
 ]);return {ok:true,message:'เปลี่ยนสิทธิ์แล้ว ให้สมาชิกเข้าสู่ระบบใหม่เพื่อใช้งาน'};
 }
 if(b.action==='plan'){
 const plan=b.plan===null?null:b.plan;if(plan!==null&&!['free','starter','growth','brand'].includes(plan))fail('แพ็กเกจไม่ถูกต้อง');
 let expires=null;if(plan!==null&&b.expires!==null){expires=Number(b.expires);if(!Number.isSafeInteger(expires)||expires<=Math.floor(Date.now()/1000)||expires>4102444800)fail('วันหมดอายุต้องอยู่ในอนาคตและไม่เกินปี 2100');}
 await env.DB.batch([env.DB.prepare('INSERT INTO member_controls(user_id,override_plan,override_expires) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET override_plan=excluded.override_plan,override_expires=excluded.override_expires,updated_at=CURRENT_TIMESTAMP').bind(user.id,plan,expires),audit(user.id,'member_plan',JSON.stringify({email:user.email,plan,expires}))]);return {ok:true};
 }
 if(b.action==='status'){
 if(!['active','suspended','banned','deleted'].includes(b.status))fail('สถานะไม่ถูกต้อง');
 if(user.id===actor.id||await adminRole(env,user)==='owner')fail('ไม่อนุญาตเปลี่ยนสถานะตัวเองหรือบัญชี Owner',403);
 const control=await env.DB.prepare('SELECT status,invited_by FROM member_controls WHERE user_id=?').bind(user.id).first();
 if(b.status==='active'&&control?.invited_by&&!await env.DB.prepare('SELECT user_id FROM user_verifications WHERE user_id=?').bind(user.id).first())b.status='invited';
 if(b.confirm_email!==user.email)fail('กรุณาพิมพ์อีเมลสมาชิกให้ตรงเพื่อยืนยัน');
 await env.DB.batch([env.DB.prepare('INSERT INTO member_controls(user_id,status) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET status=excluded.status,updated_at=CURRENT_TIMESTAMP').bind(user.id,b.status),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id),env.DB.prepare('DELETE FROM admin_swaps WHERE target_id=? OR actor_id=?').bind(user.id,user.id),audit(user.id,'member_status',JSON.stringify({email:user.email,from:control?.status||'active',to:b.status}))]);return {ok:true};
 }
 fail('คำสั่งไม่ถูกต้อง');
}
