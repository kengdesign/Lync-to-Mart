import test from 'node:test';import assert from 'node:assert/strict';
import {database} from '../scripts/adapter.mjs';import {hash} from '../src/security.mjs';import worker from '../src/worker.mjs';
test('shop moderation blocks public access and merchant writes while retaining support reads and other shops',async()=>{
 const DB=database(),env={DB,APP_ENV:'production',CHECKOUT_HOSTS:'thaimart.com',MEDIA:{get:async()=>({body:'image'})}};
 const call=(path,actor='',body,method=body?'POST':'GET',origin='https://mart.test')=>worker.fetch(new Request('https://mart.test'+path,{method,headers:{Cookie:'mart_session='+actor,Origin:origin},...(body?{body:JSON.stringify(body)}:{})}),env,{waitUntil(){}});
 try{
 for(const id of ['owner','staff','seller']){await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@test.example','x','brand').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(id),id,Math.floor(Date.now()/1000)+3600).run();}
 await DB.prepare("INSERT INTO admin_roles VALUES('owner','owner'),('staff','admin')").run();
 await DB.prepare("INSERT INTO shops(id,owner_id,name,slug,published) VALUES('one','seller','One','one',1),('two','seller','Two','two',1)").run();
 await DB.prepare("INSERT INTO products(id,shop_id,name,source_url,status,image_key) VALUES('p','one','Product','https://thaimart.com/products/abc','published','seller/img')").run();await DB.prepare("INSERT INTO media VALUES('seller/img','seller','image/png',5)").run();
 const payload={shop_id:'one',status:'suspended',expected_status:'active',confirm_slug:'one',reason:'Support investigation'};
 assert.equal((await call('/api/admin/shops','staff',payload)).status,403);
 assert.equal((await call('/api/admin/shops','owner',payload,'POST','https://evil.test')).status,403);
 assert.equal((await call('/api/admin/shops','owner',payload)).status,200);
 assert.equal((await call('/shop/one')).status,404);assert.equal((await call('/shop/two')).status,200);
 assert.equal((await call('/go/p')).status,404);assert.equal((await call('/media/seller%2Fimg')).status,401);
 assert.equal((await call('/api/shops/one','seller',{},'PUT')).status,403);
 assert.equal((await call('/api/products/p','seller',{},'PUT')).status,403);
 assert.equal((await call('/api/products/p','seller',{},'DELETE')).status,403);
 assert.equal((await call('/api/shops/one/products','seller')).status,200);
 const sitemap=await(await call('/sitemaps/shops-1.xml')).text();assert.ok(!sitemap.includes('/shop/one'));assert.ok(sitemap.includes('/shop/two'));
 const list=await(await call('/api/admin?view=shops&shop_status=suspended','owner')).json();assert.equal(list.total,1);assert.equal(list.rows[0].id,'one');
 assert.equal((await call('/api/admin?view=audit','owner')).status,200);
 assert.equal((await call('/api/admin/shops','owner',{...payload,status:'active',expected_status:'suspended'})).status,200);
 assert.equal((await call('/shop/one')).status,404);
 }finally{DB.close();}
});
