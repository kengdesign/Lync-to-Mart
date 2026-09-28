import {hash,hex,passwordHash,escape as e} from './security.mjs';
import {recoveryLimit} from './password-recovery.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const enabled=env=>{if(env.SIGNUP_ENABLED!=='true')fail('ระบบสมัครสมาชิกยังไม่เปิดใช้งาน',503);};
export async function requestRegistration(req,env,data){
 enabled(env);
 if(!env.POSTMARK_SERVER_TOKEN||!env.MAIL_FROM||!env.RECOVERY_ORIGIN)fail('ระบบอีเมลยังไม่พร้อม กรุณาลองใหม่ภายหลัง',503);
 const email=typeof data.email==='string'?data.email.trim().toLowerCase():'';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)fail('กรอกอีเมลให้ถูกต้อง');
 if(!await recoveryLimit(env,'signup-ip:'+(req.headers.get('cf-connecting-ip')||'local'),20))fail('กรุณารอ 15 นาทีแล้วลองใหม่',429);
 if(env.APP_ENV!=='production'&&!String(env.STAGING_MAIL_RECIPIENTS||'').toLowerCase().split(',').map(s=>s.trim()).includes(email))fail('Staging รับสมัครเฉพาะอีเมลทดสอบที่ผู้ดูแลอนุญาต กรุณาให้ผู้ดูแลเพิ่มอีเมลใน STAGING_MAIL_RECIPIENTS',403);
 const response={ok:true,message:'หากอีเมลนี้ยังไม่มีบัญชี ระบบจะส่งลิงก์สมัครสมาชิกให้ กรุณาตรวจ Inbox และ Spam หากมีบัญชีแล้วให้เข้าสู่ระบบหรือใช้ลืมรหัสผ่าน'};
 if(!await recoveryLimit(env,'signup-email:'+email,3))return response;
 if(await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first())return response;
 if(!await recoveryLimit(env,'signup-mail-total',100))fail('ระบบรับคำขอจำนวนมาก กรุณาลองใหม่ภายหลัง',429);
 const origin=new URL(env.RECOVERY_ORIGIN);if(origin.protocol!=='https:'||origin.username||origin.password)fail('ระบบอีเมลยังไม่พร้อม',503);
 const token=hex(crypto.getRandomValues(new Uint8Array(32))),digest=await hash(token),now=Math.floor(Date.now()/1000);
 await env.DB.prepare('DELETE FROM registration_tokens WHERE expires<=?').bind(now).run();
 await env.DB.prepare('INSERT INTO registration_tokens VALUES(?,?,?)').bind(digest,email,now+1800).run();
 const link=origin.origin+'/verify-email#token='+token;
 try{
 const result=await (env.MAIL_FETCH||fetch)('https://api.postmarkapp.com/email',{method:'POST',headers:{'Content-Type':'application/json','X-Postmark-Server-Token':env.POSTMARK_SERVER_TOKEN},signal:AbortSignal.timeout(15000),body:JSON.stringify({From:env.MAIL_FROM,To:email,ReplyTo:env.MAIL_REPLY_TO||'',MessageStream:'outbound',TrackOpens:false,TrackLinks:'None',Subject:(env.APP_ENV==='production'?'':'[Staging] ')+'ยืนยันอีเมลเพื่อสมัครสมาชิก — Lync to Mart',TextBody:`ยืนยันอีเมลและตั้งรหัสผ่านเพื่อเปิดบัญชี Free ของ Lync to Mart\n${link}\nลิงก์มีอายุ 30 นาที ใช้ได้ครั้งเดียว หากคุณไม่ได้ขอสมัครสมาชิก ให้ละเว้นอีเมลนี้`,HtmlBody:`<h2>เริ่มต้นร้านค้าของคุณกับ Lync to Mart</h2><p>ยืนยันอีเมลแล้วตั้งรหัสผ่าน เพื่อเปิดบัญชี Free</p><p><a href="${e(link)}">ยืนยันอีเมลและตั้งรหัสผ่าน</a></p><p>ลิงก์มีอายุ 30 นาที ใช้ได้ครั้งเดียว หากคุณไม่ได้ขอสมัครสมาชิก ให้ละเว้นอีเมลนี้</p>`})});
 const payload=await result.json();if(!result.ok||payload.ErrorCode!==0)throw Error('Mail rejected');
 }catch{await env.DB.prepare('DELETE FROM registration_tokens WHERE token_hash=?').bind(digest).run();fail('ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่ภายหลัง',503);}
 return response;
}
export async function completeRegistration(req,env,data){
 enabled(env);
 if(!await recoveryLimit(env,'signup-complete-ip:'+(req.headers.get('cf-connecting-ip')||'local'),20))fail('กรุณารอ 15 นาทีแล้วลองใหม่',429);
 const token=data.token,next=data.password;
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))fail('ลิงก์ไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์สมัครสมาชิกใหม่');
 if(typeof next!=='string'||next.length<12||next.length>128||next!==data.confirm_password)fail('รหัสผ่านต้องมี 12–128 ตัวอักษร และทั้งสองช่องต้องตรงกัน');
 const digest=await hash(token),record=await env.DB.prepare('SELECT email FROM registration_tokens WHERE token_hash=? AND expires>?').bind(digest,Math.floor(Date.now()/1000)).first();
 if(!record)fail('ลิงก์ถูกใช้แล้วหรือหมดอายุ กรุณาขอลิงก์สมัครสมาชิกใหม่');
 if(env.APP_ENV!=='production'&&!String(env.STAGING_MAIL_RECIPIENTS||'').toLowerCase().split(',').map(s=>s.trim()).includes(record.email))fail('อีเมลนี้ไม่ได้รับอนุญาตให้สมัครใน Staging',403);
 const id=crypto.randomUUID(),password=await passwordHash(next);
 const results=await env.DB.batch([
 env.DB.prepare("INSERT INTO users(id,email,password,plan_id) SELECT ?,email,?,'free' FROM registration_tokens WHERE token_hash=? AND expires>? ON CONFLICT(email) DO NOTHING").bind(id,password,digest,Math.floor(Date.now()/1000)),
 env.DB.prepare('INSERT INTO user_verifications(user_id) SELECT id FROM users WHERE id=?').bind(id),
 env.DB.prepare('DELETE FROM registration_tokens WHERE email=? AND EXISTS(SELECT 1 FROM users WHERE id=?)').bind(record.email,id)
 ]);
 if(results[0].meta.changes!==1)fail('ลิงก์ถูกใช้แล้วหรืออีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบหรือขอลิงก์ใหม่');
 return {ok:true};
}
