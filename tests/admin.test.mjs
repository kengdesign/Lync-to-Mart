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
 const r=await call('owner','?view=users');const text=await r.text();assert.doesNotMatch(text,/secret-password-hash|token_hash/);const data=JSON.parse(text);assert.equal(data.rows.length,25);assert.equal(data.total,29);
 assert.equal((await (await call('owner','?view=users&page=2')).json()).rows.length,4);
 assert.equal((await (await call('owner','?view=users&q=%25')).json()).total,0);
 assert.equal((await (await call('owner','?view=shops&q=Test')).json()).total,1);
 assert.equal((await call('owner','?view=invalid')).status,404);
 await DB.prepare('DELETE FROM admin_roles').run();assert.equal((await call('owner','',{...env,APP_ENV:'production'})).status,403);
 }finally{DB.close();}
});
test('admin team overview links users to shops and shares Brand seats across shops without exposing tokens',async()=>{
 const DB=database(),env={DB,APP_ENV:'production'};
 const call=(view,token='admin')=>worker.fetch(new Request('https://mart.test/api/admin?'+view,{headers:{Cookie:'mart_session='+token}}),env,{});
 try{
  for(const [id,plan] of [['admin','free'],['owner','brand'],['staff','free']]){
   await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@example.test','hash',plan).run();
   await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(id),id,Math.floor(Date.now()/1000)+3600).run();
  }
  await DB.prepare("INSERT INTO admin_roles VALUES('admin','support')").run();
  for(const id of ['a','b'])await DB.prepare('INSERT INTO shops(id,owner_id,slug,name) VALUES(?,?,?,?)').bind(id,'owner',id,'Shop '+id).run();
  await DB.prepare("INSERT INTO shop_team(id,owner_id,email,user_id,status,grants_json,token_hash) VALUES('t','owner','staff@example.test','staff','active',?,'private-token')").bind(JSON.stringify({a:{role:'viewer'},b:{role:'editor',products:true}})).run();
  await DB.prepare("INSERT INTO shop_team(id,owner_id,email,status,grants_json,expires) VALUES('pending','owner','new@example.test','pending',?,unixepoch()+3600)").bind(JSON.stringify({a:{role:'viewer'}})).run();
  const shops=await (await call('view=shops')).json();assert.equal(shops.rows.length,2);
  assert.equal(shops.rows.find(s=>s.id==='a').team_count,2);assert.equal(shops.rows.find(s=>s.id==='b').team_count,1);
  for(const s of shops.rows){assert.equal(s.team_used,2);assert.equal(s.team_limit,8);assert.equal(s.effective_plan,'brand');}
  const users=await (await call('view=users&q=staff')).json();assert.deepEqual(users.rows[0].team_shops.map(s=>s.shop_name).sort(),['Shop a','Shop b']);
  const detail=await (await call('view=team&shop=a')).json();assert.equal(detail.members.length,2);assert.equal(detail.role,'support');assert.doesNotMatch(JSON.stringify(detail),/private-token|token_hash|password/);
  assert.equal((await call('view=team&shop=a','staff')).status,403);assert.equal((await call('view=team&shop=missing')).status,404);
  await DB.prepare("UPDATE users SET plan_id='starter' WHERE id='owner'").run();
  const reduced=await (await call('view=team&shop=a')).json();assert.equal(reduced.limit,0);assert.ok(reduced.members.every(m=>!m.enabled));
 }finally{DB.close();}
});
