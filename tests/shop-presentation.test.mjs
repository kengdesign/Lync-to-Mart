import {test} from 'node:test';import assert from 'node:assert/strict';import {database} from '../scripts/adapter.mjs';import {hash} from '../src/security.mjs';import worker from '../src/worker.mjs';
test('shop branding ownership, private preview, publication, metadata and draft isolation',async()=>{
 const DB=database(),pending=[],env={DB,APP_ENV:'staging',CHECKOUT_HOSTS:'thaimart.com',ASSETS:{fetch:async()=>new Response('asset')},MEDIA:{get:async()=>({body:new Uint8Array(10)})}};
 const call=async(path,method='GET',data,user='alice')=>{const r=await worker.fetch(new Request('https://mart.test'+path,{method,headers:{Origin:'https://mart.test',...(user?{Cookie:'mart_session='+user}:{})},...(data?{body:JSON.stringify(data)}:{})}),env,{waitUntil:p=>pending.push(p)});await Promise.all(pending);return r;};
 try{for(const user of ['alice','bob']){await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(user,user+'@test.example','unused','free').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(user),user,Math.floor(Date.now()/1000)+3600).run();await DB.prepare('INSERT INTO media VALUES(?,?,?,?)').bind(user+'/photo',user,'image/png',10).run();}
 const {id}=await (await call('/api/shops','POST',{name:'ร้านชบา',slug:'chaba'})).json();
 const data={name:'ร้านชบา',description:'เรื่องราวร้าน',logo_key:'alice/photo',cover_key:'alice/photo',cover_position_y:82,seo_title:'ชบา ออนไลน์',seo_description:'เลือกชมสินค้าชบา',published:false};
 assert.equal((await call('/api/shops/'+id,'PUT',{...data,logo_key:'bob/photo'})).status,403);assert.equal((await call('/api/shops/'+id,'PUT',data)).status,200);
 assert.equal((await call('/media/alice%2Fphoto','GET',null,null)).status,401);
 const product={name:'สินค้าร่าง',source_url:'https://thaimart.com/products/6a8489fba9ceed89ab290994',status:'draft',category:'อุปกรณ์กีฬา'};
 const {id:pid}=await (await call('/api/shops/'+id+'/products','POST',product)).json();
 assert.equal((await call('/preview/'+id,'GET',null,null)).status,401);assert.equal((await call('/preview/'+id,'GET',null,'bob')).status,404);
 for(const cover_position_y of [-1,101,2.5,'bad',null])assert.equal((await call('/api/shops/'+id,'PUT',{...data,cover_position_y})).status,400);
 let r=await call('/preview/'+id);let html=await r.text();assert.match(html,/สินค้าร่าง/);assert.match(html,/cover-y-82/);assert.match(html,/ฉบับร่าง · เฉพาะตัวอย่าง/);assert.doesNotMatch(html,/href="\/go\//);assert.match(html,/noindex,nofollow/);assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM events').first()).n,0);
 await call('/api/shops/'+id,'PUT',{...data,published:true});r=await call('/shop/chaba','GET',null,null);html=await r.text();assert.doesNotMatch(html,/สินค้าร่าง/);assert.match(html,/<title>ชบา ออนไลน์/);assert.match(html,/property="og:image"/);assert.match(html,/class="store-logo"/);assert.equal((await call('/media/alice%2Fphoto','GET',null,null)).status,200);
 await call('/api/products/'+pid,'PUT',{...product,status:'published'});html=await (await call('/shop/chaba','GET',null,null)).text();assert.match(html,/catalog-search/);assert.match(html,/data-category="อุปกรณ์กีฬา"/);assert.match(html,/storefront.js/);
 await call('/api/shops/'+id,'PUT',{name:'ชื่อใหม่',published:false});const saved=await DB.prepare('SELECT * FROM shops WHERE id=?').bind(id).first();assert.equal(saved.logo_key,'alice/photo');assert.equal(saved.cover_position_y,82);assert.equal(saved.seo_title,'ชบา ออนไลน์');assert.equal((await call('/media/alice%2Fphoto','GET',null,null)).status,401);
 }finally{DB.close();}
});
