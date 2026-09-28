import test from 'node:test';import assert from 'node:assert/strict';import {database} from '../scripts/adapter.mjs';import {hash,verifyPassword} from '../src/security.mjs';import worker from '../src/worker.mjs';
function fixture(){const DB=database(),mail=[],env={DB,APP_ENV:'staging',SIGNUP_ENABLED:'true',POSTMARK_SERVER_TOKEN:'test',MAIL_FROM:'mart@example.test',RECOVERY_ORIGIN:'https://mart.test',STAGING_MAIL_RECIPIENTS:'new@example.test,existing@example.test',MAIL_FETCH:async(url,options)=>{mail.push(JSON.parse(options.body));return Response.json({ErrorCode:0});}};const call=(path,data={},origin='https://mart.test')=>worker.fetch(new Request('https://mart.test/api/'+path,{method:'POST',headers:{Origin:origin},body:JSON.stringify(data)}),env,{});return {DB,mail,env,call};}
test('registration verifies email before creating Free user; token single-use and duplicate safe',async()=>{
 const {DB,mail,call}=fixture();try{
 assert.equal((await call('register/request',{email:'new@example.test'},'https://evil.test')).status,403);
 assert.equal((await call('register/request',{email:'bad'})).status,400);
 assert.equal((await call('register/request',{email:'outside@example.test'})).status,403);assert.equal(mail.length,0);
 assert.equal((await call('register/request',{email:' NEW@example.test '})).status,200);assert.equal(mail.length,1);
 assert.equal((await DB.prepare('SELECT COUNT(*) n FROM users').first()).n,0);
 const token=mail[0].TextBody.match(/#token=([a-f0-9]+)/)[1];assert.equal((await DB.prepare('SELECT token_hash FROM registration_tokens').first()).token_hash,await hash(token));assert.equal(mail[0].TrackLinks,'None');
 const data={token,password:'a-long-new-password-2026',confirm_password:'a-long-new-password-2026',plan_id:'brand',role:'owner'};
 assert.equal((await call('register/complete',{...data,confirm_password:'wrong'})).status,400);
 const results=await Promise.all([call('register/complete',data),call('register/complete',data)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
 const user=await DB.prepare('SELECT * FROM users').first();assert.equal(user.email,'new@example.test');assert.equal(user.plan_id,'free');assert.equal(await verifyPassword(data.password,user.password),true);assert.equal((await DB.prepare('SELECT COUNT(*) n FROM admin_roles').first()).n,0);assert.equal((await DB.prepare('SELECT COUNT(*) n FROM user_verifications').first()).n,1);assert.equal((await DB.prepare('SELECT COUNT(*) n FROM registration_tokens').first()).n,0);
 assert.equal((await call('register/complete',data)).status,400);assert.equal((await call('register/request',{email:user.email})).status,200);assert.equal(mail.length,1);
 const login=await call('login',{email:user.email,password:data.password});assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/mart_session=/);
 }finally{DB.close();}
});
test('registration expires tokens, preserves existing accounts, limits mail and removes failed delivery tokens',async()=>{
 const {DB,mail,env,call}=fixture();try{
 await call('register/request',{email:'new@example.test'});let token=mail[0].TextBody.match(/#token=([a-f0-9]+)/)[1];const data={password:'a-long-new-password-2026',confirm_password:'a-long-new-password-2026'};
 await DB.prepare('UPDATE registration_tokens SET expires=0').run();assert.equal((await call('register/complete',{...data,token})).status,400);
 await call('register/request',{email:'new@example.test'});token=mail[1].TextBody.match(/#token=([a-f0-9]+)/)[1];await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind('old','new@example.test','original-hash','brand').run();assert.equal((await call('register/complete',{...data,token})).status,400);assert.equal((await DB.prepare("SELECT password FROM users WHERE id='old'").first()).password,'original-hash');
 env.MAIL_FETCH=async()=>Response.json({ErrorCode:422},{status:422});assert.equal((await call('register/request',{email:'existing@example.test'})).status,503);assert.equal((await DB.prepare("SELECT COUNT(*) n FROM registration_tokens WHERE email='existing@example.test'").first()).n,0);
 env.SIGNUP_ENABLED='false';assert.equal((await call('register/request',{email:'existing@example.test'})).status,503);assert.equal((await call('register/complete',{...data,token})).status,503);
 }finally{DB.close();}
});
test('registration resend capped and pending token invalid after staging permission removed',async()=>{
 const {DB,mail,env,call}=fixture();try{
 for(let i=0;i<5;i++)await call('register/request',{email:'new@example.test'});assert.equal(mail.length,3);
 const token=mail[0].TextBody.match(/#token=([a-f0-9]+)/)[1];env.STAGING_MAIL_RECIPIENTS='';assert.equal((await call('register/complete',{token,password:'a-long-new-password-2026',confirm_password:'a-long-new-password-2026'})).status,403);
 assert.equal((await DB.prepare('SELECT COUNT(*) n FROM users').first()).n,0);
 }finally{DB.close();}
});
