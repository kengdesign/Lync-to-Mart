import test from 'node:test';import assert from 'node:assert/strict';import {database} from '../scripts/adapter.mjs';import {hash,passwordHash,verifyPassword} from '../src/security.mjs';import worker from '../src/worker.mjs';
test('reset email is restricted, generic, single-use, expiring and revokes sessions atomically',async()=>{
 const DB=database(),mail=[],pending=[],env={DB,APP_ENV:'staging',POSTMARK_SERVER_TOKEN:'fixture',MAIL_FROM:'Mart <mart@example.test>',MAIL_REPLY_TO:'help@example.test',RECOVERY_ORIGIN:'https://mart.test',STAGING_MAIL_RECIPIENTS:'alice@example.test',MAIL_FETCH:async(url,options)=>{mail.push(JSON.parse(options.body));return Response.json({ErrorCode:0});}};
 const call=async(path,data)=>{const r=await worker.fetch(new Request('https://mart.test/api/'+path,{method:'POST',headers:{Origin:'https://mart.test'},body:JSON.stringify(data)}),env,{waitUntil:p=>pending.push(p)});await Promise.all(pending);return r;};
 try{
 for(const id of ['alice','bob'])await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@example.test',await passwordHash('old-password-2026'),'free').run();
 await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash('session'),'alice',9999999999).run();
 const first=await(await call('forgot-password',{email:'alice@example.test'})).json();assert.deepEqual(await(await call('forgot-password',{email:'unknown@example.test'})).json(),first);assert.deepEqual(await(await call('forgot-password',{email:'bob@example.test'})).json(),first);assert.equal(mail.length,1);assert.equal(mail[0].TrackLinks,'None');assert.equal(mail[0].ReplyTo,'help@example.test');
 const token=mail[0].TextBody.match(/#token=([a-f0-9]+)/)[1];assert.equal((await DB.prepare('SELECT token_hash FROM password_resets').first()).token_hash,await hash(token));
 const body={token,new_password:'replacement-password-2026',confirm_password:'replacement-password-2026'};
 assert.equal((await call('reset-password',{...body,confirm_password:'bad'})).status,400);
 const results=await Promise.all([call('reset-password',body),call('reset-password',body)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);assert.equal((await DB.prepare('SELECT COUNT(*) n FROM sessions').first()).n,0);assert.equal(await verifyPassword(body.new_password,(await DB.prepare("SELECT password FROM users WHERE id='alice'").first()).password),true);assert.equal((await call('reset-password',body)).status,400);
 await call('forgot-password',{email:'alice@example.test'});const expired=mail[1].TextBody.match(/#token=([a-f0-9]+)/)[1];await DB.prepare('UPDATE password_resets SET expires=0').run();assert.equal((await call('reset-password',{...body,token:expired})).status,400);
 env.MAIL_FETCH=async()=>Response.json({ErrorCode:422},{status:422});await call('forgot-password',{email:'alice@example.test'});assert.equal((await DB.prepare('SELECT COUNT(*) n FROM password_resets').first()).n,0);
 }finally{DB.close();}
});
