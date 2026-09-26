import test from 'node:test';import assert from 'node:assert/strict';import {database} from '../scripts/adapter.mjs';import {hash} from '../src/security.mjs';import worker from '../src/worker.mjs';
test('owner pins move old products to first catalog page, preserve content and never expose drafts',async()=>{
 const DB=database(),env={DB,CHECKOUT_HOSTS:'thaimart.com',APP_ENV:'staging'},pending=[];
 const call=async(path,method='GET',data,user='alice')=>{const r=await worker.fetch(new Request('https://mart.test'+path,{method,headers:{Origin:'https://mart.test',...(user?{Cookie:'mart_session='+user}:{})},...(data?{body:JSON.stringify(data)}:{})}),env,{waitUntil:p=>pending.push(p)});await Promise.all(pending);return r;};
 try{
  for(const id of ['alice','bob']){await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@example.test','unused','growth').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(id),id,Math.floor(Date.now()/1000)+3600).run();}
  await DB.prepare('INSERT INTO shops(id,owner_id,slug,name,published) VALUES(?,?,?,?,?)').bind('shop','alice','test-shop','ร้าน',1).run();
  for(let i=0;i<14;i++)await DB.prepare('INSERT INTO products(id,shop_id,name,source_url,status,checkout_url,price) VALUES(?,?,?,?,?,?,?)').bind(String(i).padStart(2,'0'),'shop','สินค้า '+i,'https://thaimart.com/products/'+String(i).padStart(24,'0'),i===13?'draft':'published','https://thaimart.com/checkout?keep=1',100).run();
  const before=await(await call('/shop/test-shop')).text();assert.doesNotMatch(before,/id="product-00"/);
  assert.equal((await call('/api/products/00/featured','PUT',{featured:true},'bob')).status,404);assert.equal((await call('/api/products/00/featured','PUT',{featured:true},null)).status,401);assert.equal((await call('/api/products/00/featured','PUT',{featured:'yes'})).status,400);
  assert.equal((await call('/api/products/00/featured','PUT',{featured:true})).status,200);await call('/api/products/13/featured','PUT',{featured:true});
  const html=await(await call('/shop/test-shop')).text();assert.equal(html.match(/id="product-([^"]+)"/)[1],'00');assert.match(html,/★ สินค้าแนะนำ/);assert.doesNotMatch(html,/id="product-13"/);assert.equal((html.match(/class="product-card"/g)||[]).length,12);
  const product=await(await call('/api/products/00')).json();assert.equal(product.featured,1);assert.equal(product.checkout_url,'https://thaimart.com/checkout?keep=1');assert.equal(product.price,100);
  assert.equal((await call('/api/products/00','PUT',{...product,name:'แก้ไขชื่อ'})).status,200);assert.equal((await(await call('/api/products/00')).json()).featured,1);
  const preview=await(await call('/preview/shop')).text();assert.match(preview,/id="product-13"/);
  await call('/api/products/00/featured','PUT',{featured:false});assert.doesNotMatch(await(await call('/shop/test-shop')).text(),/id="product-00"/);
 }finally{DB.close();}
});
