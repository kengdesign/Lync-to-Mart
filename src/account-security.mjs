import {hash,passwordHash,verifyPassword} from './security.mjs';
const reject=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export async function changePassword(env,user,data){
 if(!data||typeof data!=='object')reject('ข้อมูลไม่ถูกต้อง');
 const current=data.current_password,next=data.new_password;
 if(typeof current!=='string'||current.length>256||typeof next!=='string'||next.length<12||next.length>128)reject('รหัสผ่านใหม่ต้องมี 12–128 ตัวอักษร');
 if(next!==data.confirm_password)reject('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');
 const now=Math.floor(Date.now()/1000),key=await hash('password-change:'+user.id);
 await env.DB.prepare(`INSERT INTO login_attempts(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END`).bind(key,now+900,now,now).run();
 const attempts=await env.DB.prepare('SELECT count FROM login_attempts WHERE key=?').bind(key).first();
 if(attempts.count>5)reject('ลองเปลี่ยนรหัสผ่านใหม่ในอีก 15 นาที',429);
 if(!await verifyPassword(current,user.password))reject('รหัสผ่านเดิมไม่ถูกต้อง',403);
 if(current===next)reject('กรุณาใช้รหัสผ่านใหม่ที่ต่างจากเดิม');
 const encoded=await passwordHash(next);
 const results=await env.DB.batch([
  env.DB.prepare('UPDATE users SET password=? WHERE id=? AND password=?').bind(encoded,user.id,user.password),
  env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM users WHERE id=? AND password=?)').bind(user.id,user.id,encoded)
 ]);
 if(results[0].meta.changes!==1)reject('ข้อมูลบัญชีเปลี่ยนแล้ว กรุณาเข้าสู่ระบบใหม่',409);
}
