import {hash,hex,passwordHash,escape as e} from './security.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export async function recoveryLimit(env,key,limit){const now=Math.floor(Date.now()/1000),k=await hash('recovery:'+key);await env.DB.prepare(`INSERT INTO login_attempts(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END`).bind(k,now+900,now,now).run();return (await env.DB.prepare('SELECT count FROM login_attempts WHERE key=?').bind(k).first()).count<=limit;}
export async function requestReset(req,env,data,ctx){
 if(!env.POSTMARK_SERVER_TOKEN||!env.MAIL_FROM||!env.RECOVERY_ORIGIN)fail('ระบบอีเมลยังไม่พร้อม กรุณาติดต่อผู้ดูแล',503);
 const email=typeof data?.email==='string'?data.email.trim().toLowerCase():'';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)fail('กรอกอีเมลให้ถูกต้อง');
 if(!await recoveryLimit(env,'request-ip:'+(req.headers.get('cf-connecting-ip')||'local'),20))fail('กรุณารอ 15 นาทีแล้วลองใหม่',429);
 const allowed=await recoveryLimit(env,'email:'+email,3);
 const message='หากอีเมลนี้มีบัญชีและสามารถรับอีเมลได้ ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ กรุณาตรวจ Inbox และ Spam';
 if(!allowed)return {ok:true,message};
 if(env.APP_ENV!=='production'&&!String(env.STAGING_MAIL_RECIPIENTS||'').toLowerCase().split(',').map(x=>x.trim()).includes(email))return {ok:true,message};
 const user=await env.DB.prepare('SELECT id,email,password FROM users WHERE email=?').bind(email).first();
 if(user){const work=async()=>{const token=hex(crypto.getRandomValues(new Uint8Array(32))),digest=await hash(token),now=Math.floor(Date.now()/1000);const origin=new URL(env.RECOVERY_ORIGIN);if(origin.protocol!=='https:'||origin.username||origin.password)throw Error('Invalid recovery origin');
 await env.DB.prepare('DELETE FROM password_resets WHERE expires<=?').bind(now).run();
 await env.DB.prepare('INSERT INTO password_resets VALUES(?,?,?,?)').bind(digest,user.id,user.password,now+1800).run();
 const link=origin.origin+'/reset-password#token='+token;
 try{const result=await (env.MAIL_FETCH||fetch)('https://api.postmarkapp.com/email',{method:'POST',headers:{'Content-Type':'application/json','X-Postmark-Server-Token':env.POSTMARK_SERVER_TOKEN},signal:AbortSignal.timeout(15000),body:JSON.stringify({From:env.MAIL_FROM,To:user.email,ReplyTo:env.MAIL_REPLY_TO||'',MessageStream:'outbound',TrackOpens:false,TrackLinks:'None',Subject:(env.APP_ENV==='production'?'':'[Staging] ')+'ตั้งรหัสผ่านใหม่ — Lync to Mart',TextBody:`คุณขอตั้งรหัสผ่านใหม่สำหรับ Lync to Mart\nเปิดลิงก์ภายใน 30 นาที:\n${link}\nหากคุณไม่ได้ขอ สามารถละเว้นอีเมลนี้ได้ รหัสผ่านยังไม่เปลี่ยน`,HtmlBody:`<h2>ตั้งรหัสผ่านใหม่</h2><p>คุณขอตั้งรหัสผ่านใหม่สำหรับ Lync to Mart</p><p><a href="${e(link)}">ตั้งรหัสผ่านใหม่</a></p><p>ลิงก์มีอายุ 30 นาที ใช้ได้ครั้งเดียว หากคุณไม่ได้ขอ สามารถละเว้นอีเมลนี้ได้</p>`})});const body=await result.json();if(!result.ok||body.ErrorCode!==0)throw Error('Mail rejected');}
 catch{await env.DB.prepare('DELETE FROM password_resets WHERE token_hash=?').bind(digest).run();console.error('Password recovery email could not be sent');}};
 ctx.waitUntil(work().catch(()=>console.error('Password recovery request failed')));}
 return {ok:true,message};
}
export async function resetPassword(req,env,data){
 if(!await recoveryLimit(env,'reset-ip:'+(req.headers.get('cf-connecting-ip')||'local'),20))fail('กรุณารอ 15 นาทีแล้วลองใหม่',429);
 const token=data?.token,next=data?.new_password;
 if(typeof token!=='string'||! /^[a-f0-9]{64}$/.test(token))fail('ลิงก์ไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์ใหม่');
 if(typeof next!=='string'||next.length<12||next.length>128||next!==data.confirm_password)fail('รหัสผ่านใหม่ต้องมี 12–128 ตัวอักษร และทั้งสองช่องต้องตรงกัน');
 const digest=await hash(token),now=Math.floor(Date.now()/1000),record=await env.DB.prepare('SELECT * FROM password_resets WHERE token_hash=? AND expires>?').bind(digest,now).first();
 if(!record)fail('ลิงก์ไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์ใหม่');
 const encoded=await passwordHash(next);
 const result=await env.DB.batch([
 env.DB.prepare('UPDATE users SET password=? WHERE id=? AND password=? AND EXISTS(SELECT 1 FROM password_resets WHERE token_hash=? AND expires>?)').bind(encoded,record.user_id,record.password_snapshot,digest,Math.floor(Date.now()/1000)),
 env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM users WHERE id=? AND password=?)').bind(record.user_id,record.user_id,encoded),
 env.DB.prepare('DELETE FROM password_resets WHERE user_id=? AND EXISTS(SELECT 1 FROM users WHERE id=? AND password=?)').bind(record.user_id,record.user_id,encoded)]);
 if(result[0].meta.changes!==1)fail('ลิงก์ถูกใช้แล้วหรือข้อมูลบัญชีเปลี่ยน กรุณาขอลิงก์ใหม่');
 return {ok:true};
}
