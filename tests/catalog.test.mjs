import test from 'node:test';import assert from 'node:assert/strict';
import {database} from '../scripts/adapter.mjs';import {hash} from '../src/security.mjs';import worker from '../src/worker.mjs';
import {catalogPage,catalogURL} from '../src/catalog.mjs';
const cards=html=>[...html.matchAll(/class="product-card"[^>]*id="product-([^"]+)"/g)].map(m=>m[1]);
const schema=html=>JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
test('catalog serves crawlable 12-item pages, full-shop search, safe canonical URLs and owner preview',async()=>{
 const DB=database(),env={DB,APP_ENV:'production'},pending=[];
 const call=async(path,auth=false)=>{const r=await worker.fetch(new Request('https://mart.test'+path,{headers:auth?{Cookie:'mart_session=alice'}:{}}),env,{waitUntil:p=>pending.push(p)});await Promise.all(pending);return r;};
 try{
  await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind('alice','a@example.test','unused','growth').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash('alice'),'alice',Math.floor(Date.now()/1000)+3600).run();
  await DB.prepare('INSERT INTO shops(id,owner_id,slug,name,published) VALUES(?,?,?,?,?)').bind('s1','alice','test-shop','ร้าน',1).run();
  for(let i=0;i<26;i++)await DB.prepare('INSERT INTO products(id,shop_id,name,description,source_url,status,category,gallery_json) VALUES(?,?,?,?,?,?,?,?)').bind(String(i).padStart(2,'0'),'s1','สินค้า '+i,i===0?'ค้นพบรายละเอียดปลายรายการ':'รายละเอียด','https://thaimart.com/test',i===25?'draft':'published',i%2?'อาหาร':'กีฬา',JSON.stringify([{key:'alice/cover'},{key:'alice/extra'}])).run();
  const first=await(await call('/shop/test-shop')).text(),second=await(await call('/shop/test-shop?page=2')).text(),third=await(await call('/shop/test-shop?page=3')).text();
  assert.equal(cards(first).length,12);assert.equal(cards(second).length,12);assert.equal(cards(third).length,1);assert.equal(new Set([...cards(first),...cards(second),...cards(third)]).size,25);assert.ok(!cards(first).includes('25'));
  assert.match(first,/href="\/shop\/test-shop\?page=2" rel="next"/);assert.match(second,/<link rel="canonical" href="https:\/\/mart.test\/shop\/test-shop\?page=2">/);assert.equal(schema(second).mainEntity.itemListElement.length,12);assert.equal(schema(second).mainEntity.itemListElement[0].position,13);assert.match(first,/content="index,follow"/);
  assert.match(first,/class="product-extra-gallery"/);assert.match(first,/\/media\/alice%2Fextra/);
  const search=await(await call('/shop/test-shop?q='+encodeURIComponent('ค้นพบรายละเอียดปลายรายการ'))).text();assert.deepEqual(cards(search),['00']);assert.match(search,/content="noindex,follow"/);
  const filtered=await(await call('/shop/test-shop?category='+encodeURIComponent('กีฬา')+'&page=2')).text();assert.equal(cards(filtered).length,1);assert.match(filtered,/name="category"/);
  assert.equal((await call('/shop/test-shop?page=4')).status,404);assert.equal((await call('/shop/test-shop?page=-1')).status,400);
  const empty=await(await call('/shop/test-shop?q=nomatch')).text();assert.equal(cards(empty).length,0);assert.match(empty,/ไม่พบสินค้าที่ตรงกับคำค้น/);
  assert.equal((await call('/preview/s1')).status,401);const preview=await(await call('/preview/s1?page=3',true)).text();assert.equal(cards(preview).length,2);assert.match(preview,/content="noindex,nofollow"/);assert.match(preview,/href="\/preview\/s1\?page=2"/);assert.doesNotMatch(preview,/href="\/go\//);
  env.APP_ENV='staging';assert.match(await(await call('/shop/test-shop?page=2')).text(),/content="noindex,nofollow"/);
 }finally{DB.close();}
});
test('catalog query parsing preserves filters and rejects invalid pages',()=>{
 assert.equal(catalogURL('/shop/test',{page:2,q:'สีแดง & "',category:'กีฬา / บอล'}),'/shop/test?q='+new URLSearchParams({q:'สีแดง & "',category:'กีฬา / บอล',page:'2'}).toString().slice(2));
 assert.throws(()=>catalogPage([],new URLSearchParams('page=1.5')),e=>e.status===400);assert.equal(catalogPage([]).pages,1);
});
