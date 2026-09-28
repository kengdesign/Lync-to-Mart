import test from 'node:test';import assert from 'node:assert/strict';import {database} from '../scripts/adapter.mjs';import {hash} from '../src/security.mjs';import worker from '../src/worker.mjs';
test('Mart admin rejects merchants, isolates staging owner grant, paginates and excludes credentials',async()=>{
 const DB=database(),env={DB,APP_ENV:'staging',STAGING_ADMIN_SHOP_ID:'test-shop'};
 const call=(token='',params='',custom=env)=>worker.fetch(new Request('https://mart.test/api/admin'+params,{headers:{Cookie:'mart_session='+token}}),custom,{});
 try{
 for(const id of ['owner','merchant']){await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@test.example','secret-password-hash','brand').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(id),id,Math.floor(Date.now()/1000)+3600).run();}
 await DB.prepare('INSERT INTO shops(id,owner_id,slug,name) VALUES(?,?,?,?)').bind('test-shop','owner','shop','Test').run();
 assert.equal((await call()).status,401);assert.equal((await call('merchant')).status,403);
 assert.equal((await call('owner','',{...env,APP_ENV:'production'})).status,403);
 assert.equal((await call('owner')).status,200);
 await DB.prepare('INSERT INTO admin_roles VALUES(?,?)').bind('owner','owner').run();
 assert.equal((await call('owner','',{...env,APP_ENV:'production'})).status,200);
 for(let i=0;i<27;i++)await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind('extra'+i,'extra'+i+'@test.example','secret-password-hash','free').run();
 const r=await call('owner','?view=users');const text=await r.text();assert.doesNotMatch(text,/secret-password-hash|token_hash|expires/);const data=JSON.parse(text);assert.equal(data.rows.length,25);assert.equal(data.total,29);
 assert.equal((await (await call('owner','?view=users&page=2')).json()).rows.length,4);
 assert.equal((await (await call('owner','?view=users&q=%25')).json()).total,0);
 assert.equal((await (await call('owner','?view=shops&q=Test')).json()).total,1);
 assert.equal((await call('owner','?view=invalid')).status,404);
 await DB.prepare('DELETE FROM admin_roles').run();assert.equal((await call('owner','',{...env,APP_ENV:'production'})).status,403);
 }finally{DB.close();}
});
