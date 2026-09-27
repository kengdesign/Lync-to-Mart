import test from 'node:test';import assert from 'node:assert/strict';
import {database} from '../scripts/adapter.mjs';import {hash,passwordHash,verifyPassword} from '../src/security.mjs';import worker from '../src/worker.mjs';
test('password change verifies old password, revokes own sessions, isolates accounts and limits attempts',async()=>{
 const DB=database(),env={DB,APP_ENV:'staging'},old='original-password-2026',next='new-password-2026';
 const call=(data,token='alice',origin='https://mart.test')=>worker.fetch(new Request('https://mart.test/api/account/password',{method:'POST',headers:{Origin:origin,...(token?{Cookie:'mart_session='+token}:{})},body:JSON.stringify(data)}),env,{});
 const body={current_password:old,new_password:next,confirm_password:next};
 try{
 for(const id of ['alice','bob']){await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@test.example',await passwordHash(old),'free').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(id),id,Math.floor(Date.now()/1000)+3600).run();}
 await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash('alice-other'),'alice',Math.floor(Date.now()/1000)+3600).run();
 assert.equal((await call(body,null)).status,401);assert.equal((await call(body,'alice','https://evil.test')).status,403);
 assert.equal((await call({...body,new_password:'short'})).status,400);assert.equal((await call({...body,confirm_password:'mismatch'})).status,400);
 assert.equal((await call({...body,current_password:'incorrect'})).status,403);
 assert.equal((await DB.prepare("SELECT COUNT(*) n FROM sessions WHERE user_id='alice'").first()).n,2);
 const result=await call(body);assert.equal(result.status,200);assert.match(result.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal((await DB.prepare("SELECT COUNT(*) n FROM sessions WHERE user_id='alice'").first()).n,0);assert.equal((await DB.prepare("SELECT COUNT(*) n FROM sessions WHERE user_id='bob'").first()).n,1);
 const saved=await DB.prepare("SELECT password FROM users WHERE id='alice'").first();assert.equal(await verifyPassword(next,saved.password),true);assert.equal(await verifyPassword(old,saved.password),false);assert.equal((await call(body)).status,401);
 for(let i=0;i<5;i++)assert.equal((await call({...body,current_password:'wrong'},'bob')).status,403);
 assert.equal((await call(body,'bob')).status,429);assert.equal(await verifyPassword(old,(await DB.prepare("SELECT password FROM users WHERE id='bob'").first()).password),true);
 }finally{DB.close();}
});
