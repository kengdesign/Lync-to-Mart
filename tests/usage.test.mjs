import test from 'node:test';import assert from 'node:assert/strict';
import {database} from '../scripts/adapter.mjs';import {hash} from '../src/security.mjs';import worker from '../src/worker.mjs';import {quota,STORAGE_LIMIT} from '../src/usage.mjs';
test('usage reports account-wide quotas, draft counts and stored media without leaking other owners',async()=>{
 const DB=database(),env={DB,APP_ENV:'staging'};
 const call=(user='alice',method='GET',body)=>worker.fetch(new Request('https://mart.test/api/usage',{method,headers:{Origin:'https://mart.test',...(user?{Cookie:'mart_session='+user}:{})},...(body?{body:JSON.stringify(body)}:{})}),env,{waitUntil(){}});
 try{
  for(const id of ['alice','bob']){await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@example.test','unused','brand').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(id),id,Math.floor(Date.now()/1000)+3600).run();}
  const empty=await(await call()).json();assert.equal(empty.shops.used,0);assert.equal(empty.products.remaining,500);assert.equal(empty.storage.used,0);assert.deepEqual(empty.stores,[]);
  for(const [id,owner] of [['a1','alice'],['a2','alice'],['b1','bob']])await DB.prepare('INSERT INTO shops(id,owner_id,slug,name) VALUES(?,?,?,?)').bind(id,owner,id,id).run();
  for(const [id,shop,status] of [['p1','a1','published'],['p2','a1','draft'],['p3','a2','draft'],['p4','b1','published']])await DB.prepare('INSERT INTO products(id,shop_id,name,source_url,status) VALUES(?,?,?,?,?)').bind(id,shop,id,'https://thaimart.com/test',status).run();
  for(const [key,owner,mime,size] of [['a/image','alice','image/png',1000000],['a/video','alice','video/mp4',20000000],['b/image','bob','image/png',9000000]])await DB.prepare('INSERT INTO media VALUES(?,?,?,?)').bind(key,owner,mime,size).run();
  const response=await call();assert.equal(response.headers.get('cache-control'),'no-store');const data=await response.json();
  assert.equal(data.shops.used,2);assert.equal(data.shops.limit,3);assert.equal(data.products.used,3);assert.equal(data.products.remaining,497);assert.equal(data.storage.used,21000000);assert.equal(data.storage.image_bytes,1000000);assert.equal(data.storage.video_bytes,20000000);assert.equal(data.storage.files,2);assert.equal(data.storage.limit,STORAGE_LIMIT);assert.equal(data.stores.find(s=>s.id==='a1').published_products,1);assert.equal(data.stores.find(s=>s.id==='a2').products,1);assert.ok(!data.stores.some(s=>s.id==='b1'));
  await DB.prepare("UPDATE users SET plan_id='free' WHERE id='alice'").run();const changed=await(await call()).json();assert.equal(changed.shops.status,'full');assert.equal(changed.shops.remaining,0);assert.equal(changed.products.limit,10);
  assert.equal((await call(null)).status,401);assert.equal((await call('alice','POST',{plan_id:'brand'})).status,404);
  assert.equal(quota(8,10).status,'near');assert.equal(quota(10,10).status,'full');assert.equal(quota(11,10).remaining,0);
 }finally{DB.close();}
});
