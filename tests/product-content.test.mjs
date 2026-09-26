import {test} from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../scripts/adapter.mjs';
import {hash} from '../src/security.mjs';
import {extractProduct} from '../src/import.mjs';
import {sanitizeContent} from '../src/content.mjs';
import worker from '../src/worker.mjs';
const id='6a8489fba9ceed89ab290994',cdn='https://img-cdn.thaimart.com/photo';
function flightHTML(){const description='<p>รายละเอียด 🌸 <strong>ครบถ้วน</strong></p><ul><li>สีชมพู</li></ul><img src="'+cdn+'" alt="รูปในรายละเอียด">';const p={id,name:'สินค้าทดสอบ',description:'$a',images:[{url:cdn}],variants:[{sku:'PINK',markupPrice:'136',attributes:[{key:'สี',value:'ชมพู'}],weight:1000,dimensions:{width:20},remainingQuantity:2}],categoryPath:[{name:'กีฬา'}],minMarkupPrice:'136'};const records='a:T'+Buffer.byteLength(description).toString(16)+','+description+'b:'+JSON.stringify(['$',{},p])+'\n';return '<script>self.__next_f.push('+JSON.stringify([1,records])+')</script>';}
test('Thaimart Flight handles UTF-8 text records, rich images, options and prices without evaluation',()=>{const p=extractProduct(flightHTML(),'https://thaimart.com/products/'+id);assert.equal(p.price,13600);assert.equal(p.variants[0].sku,'PINK');assert.equal(p.gallery.length,1);assert.match(p.description_html,/<strong>ครบถ้วน<\/strong>/);assert.match(p.description_html,/<img/);assert.match(p.description,/🌸/);assert.equal(extractProduct(flightHTML(),'https://thaimart.com/products/aaaaaaaaaaaaaaaaaaaaaaaa'),null);});
test('rich text drops executable markup, unsafe attributes and foreign images',()=>{const s=sanitizeContent('<p onclick="alert(1)">hello 😀<script>alert(1)</script><svg onload="alert(1)"></svg><img src="https://evil.example/a"><img src="/media/alice/image"><a href="javascript:alert(1)">link</a><strong>bold</strong></p>');assert.doesNotMatch(s.html,/onclick|script|svg|evil|javascript/);assert.match(s.html,/<strong>bold/);assert.deepEqual(s.keys,['alice/image']);});
test('gallery, inline image ownership, variant prices and SSR details round-trip; legacy data preserved',async()=>{
 const DB=database(),env={DB,APP_ENV:'staging',CHECKOUT_HOSTS:'thaimart.com',IMPORT_HOSTS:'thaimart.com',ASSETS:{fetch:async()=>new Response('asset')},MEDIA:{get:async()=>({body:'image',httpMetadata:{contentType:'image/png'}})}};
 await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind('alice','a@example.test','unused','free').run();await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind('bob','b@example.test','unused','free').run();
 await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash('test-session'),'alice',Math.floor(Date.now()/1000)+3600).run();await DB.prepare('INSERT INTO media VALUES(?,?,?,?)').bind('alice/image','alice','image/png',10).run();await DB.prepare('INSERT INTO media VALUES(?,?,?,?)').bind('bob/image','bob','image/png',10).run();
 const pending=[];const call=async(path,method='GET',body,auth=true)=>{const r=await worker.fetch(new Request('https://mart.example'+path,{method,headers:{Origin:'https://mart.example',...(auth?{Cookie:'mart_session=test-session'}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env,{waitUntil:p=>pending.push(p)});await Promise.all(pending);return r;};
 try{const {id:shop}=await (await call('/api/shops','POST',{name:'ร้านทดสอบ',slug:'store-test'})).json();
 const base={name:'ลูกบอล',source_url:'https://thaimart.com/products/'+id,description_html:'<h3>รายละเอียด</h3><p>ย่อหน้า 😀<br>บรรทัดใหม่</p><img src="/media/alice%2Fimage" alt="ด้านหน้า">',gallery:[{key:'alice/image',alt:'ปก'}],variants:[{sku:'A',attributes:[{key:'สี',value:'ชมพู'}],price:13600},{sku:'B',attributes:[{key:'สี',value:'ม่วง'}],price:15000}],price:999,status:'draft'};
 let r=await call(`/api/shops/${shop}/products`,'POST',base);assert.equal(r.status,201);const {id:pid}=await r.json();
 assert.equal((await call('/media/alice%2Fimage','GET',null,false)).status,401);
 r=await call(`/api/shops/${shop}/products`);let [p]=await r.json();assert.equal(p.price,13600);assert.equal(p.gallery[0].alt,'ปก');assert.equal(p.variants.length,2);
 assert.equal((await call(`/api/products/${pid}`,'PUT',{...base,gallery:[{key:'bob/image'}]})).status,403);
 assert.equal((await call(`/api/products/${pid}`,'PUT',{...base,description_html:'<img src="/media/bob%2Fimage">'})).status,403);
 assert.equal((await call(`/api/products/${pid}`,'PUT',{...base,variants:[base.variants[0],base.variants[0]]})).status,400);
 assert.equal((await call(`/api/products/${pid}`,'PUT',{...base,status:'published'})).status,200);
 await call(`/api/shops/${shop}`,'PUT',{name:'ร้านทดสอบ',published:true});r=await call('/shop/store-test','GET',null,false);const html=await r.text();assert.match(html,/ย่อหน้า 😀/);assert.match(html,/136 – ฿150/);assert.match(html,/application\/ld\+json/);assert.match(html,/noindex,nofollow/);assert.equal((await call('/media/alice%2Fimage','GET',null,false)).status,200);
 await call(`/api/products/${pid}`,'PUT',{...base,status:'draft'});assert.equal((await call('/media/alice%2Fimage','GET',null,false)).status,401);
 const invalid=await call('/api/import','POST',{url:'https://thaimart.com/other'});assert.equal(invalid.status,422);
 // An old product submitted by the old client still stores its text and primary photo.
 r=await call(`/api/shops/${shop}/products`,'POST',{name:'เดิม',source_url:'https://thaimart.com/products/000000000000000000000001',description:'เดิม\nบรรทัดสอง',image_key:'alice/image',price:100});assert.equal(r.status,201);
 const records=await (await call(`/api/shops/${shop}/products`)).json();assert.ok(records.some(x=>x.name==='เดิม'&&x.description.includes('บรรทัดสอง')&&x.image_key==='alice/image'));
 }finally{DB.close();}
});
