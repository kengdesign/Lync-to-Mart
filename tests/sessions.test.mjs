import test from 'node:test';import assert from 'node:assert/strict';import {database} from '../scripts/adapter.mjs';import {hash} from '../src/security.mjs';import worker from '../src/worker.mjs';
test('session overview excludes expired sessions and revoke preserves current and other accounts',async()=>{
 const DB=database(),env={DB,APP_ENV:'staging'};
 const call=(path,token='current',method='GET',origin='https://mart.test')=>worker.fetch(new Request('https://mart.test/api/account/'+path,{method,headers:{Cookie:'mart_session='+token,Origin:origin}}),env,{});
 try{
 for(const u of ['alice','bob'])await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(u,u+'@test.example','unused','free').run();
 for(const [token,user,expires] of [['current','alice',9999999999],['other','alice',9999999999],['expired','alice',1],['bob','bob',9999999999]])await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(token),user,expires).run();
 assert.deepEqual(await(await call('sessions')).json(),{active:2,others:1});assert.equal((await call('logout-others','current','POST','https://evil.test')).status,403);assert.equal((await call('logout-others','current','POST')).status,200);
 assert.deepEqual(await(await call('sessions')).json(),{active:1,others:0});assert.equal((await call('sessions','other')).status,401);assert.equal((await call('sessions','bob')).status,200);assert.equal((await call('logout-others','current','POST')).status,200);
 }finally{DB.close();}
});
