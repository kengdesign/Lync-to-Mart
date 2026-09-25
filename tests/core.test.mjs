import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {database} from '../scripts/adapter.mjs';
import {passwordHash} from '../src/security.mjs';
import {extractProduct} from '../src/import.mjs';
import worker from '../src/worker.mjs';
async function fixture(checkoutHosts='marketplace.example.test'){const DB=database();const env={DB,CHECKOUT_HOSTS:checkoutHosts,IMPORT_HOSTS:'',ASSETS:{fetch:async()=>new Response('asset')},MEDIA:{}};await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind('alice','alice@example.test',await passwordHash('correct-password'),'free').run();await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind('bob','bob@example.test',await passwordHash('correct-password'),'free').run();const pending=[];async function call(path,method='GET',data,cookie,origin='https://app.example.test'){const response=await worker.fetch(new Request('https://app.example.test'+path,{method,headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})}),env,{waitUntil:p=>pending.push(p)});await Promise.all(pending);return response;}async function login(email){const r=await call('/api/login','POST',{email,password:'correct-password'});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}return {DB,call,login};}
test('lifecycle, tenant isolation, publication, click count and quotas',async()=>{const {DB,call,login}=await fixture();try{
 const alice=await login('alice@example.test'),bob=await login('bob@example.test');assert.equal((await call('/api/me')).status,401);
 assert.equal((await call('/api/shops','POST',{name:'CHABA',slug:'chaba'},alice,'https://evil.example')).status,403);
 const cr=await call('/api/shops','POST',{name:'CHABA',slug:'chaba'},alice);assert.equal(cr.status,201);const {id}=await cr.json();
 assert.equal((await call(`/api/shops/${id}/products`,'GET',null,bob)).status,404);
 assert.equal((await call('/api/shops','POST',{name:'Extra',slug:'extra'},alice)).status,409);
 assert.equal((await call('/shop/chaba')).status,404);
 const payload={name:'<script>alert(1)</script>',description:'สินค้า',price:14900,source_url:'https://marketplace.example.test/product/1',status:'draft',image_key:''};
 assert.equal((await call(`/api/shops/${id}/products`,'POST',{...payload,source_url:'https://evil.example/p'},alice)).status,400);
 const productResponse=await call(`/api/shops/${id}/products`,'POST',payload,alice);assert.equal(productResponse.status,201);const pid=(await productResponse.json()).id;
 assert.equal((await call(`/api/products/${pid}`,'DELETE',null,bob)).status,404);
 assert.equal((await call(`/api/shops/${id}`,'PUT',{name:'CHABA',description:'ร้านทดสอบ',published:true},alice)).status,200);
 assert.ok(!(await (await call('/shop/chaba')).text()).includes('alert(1)'));
 assert.equal((await call(`/api/products/${pid}`,'PUT',{...payload,status:'published'},alice)).status,200);
 const publicResponse=await call('/shop/chaba');const text=await publicResponse.text();assert.ok(text.includes('&lt;script&gt;'));assert.ok(!text.includes('<script>alert'));assert.ok(text.includes('Powered by'));assert.match(publicResponse.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 const redirect=await call(`/go/${pid}`);assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),payload.source_url);
 const stats=await (await call(`/api/shops/${id}/stats`,'GET',null,alice)).json();assert.equal(stats.find(x=>x.kind==='buy_click').count,1);
 for(let i=1;i<10;i++)assert.equal((await call(`/api/shops/${id}/products`,'POST',payload,alice)).status,201);
 assert.equal((await call(`/api/shops/${id}/products`,'POST',payload,alice)).status,409);
 assert.equal((await call('/api/import','POST',{url:'http://127.0.0.1/'},alice)).status,422);
 await call('/api/logout','POST',{},alice);assert.equal((await call('/api/me','GET',null,alice)).status,401);
}finally{DB.close();}});
test('import preserves unknown/non-THB prices and zero prices',()=>{
 const wrap=p=>`<script type="application/ld+json">${JSON.stringify({'@graph':[{'@type':'Product',name:'ชบา',...p}]})}</script>`;
 assert.equal(extractProduct(wrap({offers:{price:'149',priceCurrency:'THB'}})).price,14900);
 assert.equal(extractProduct(wrap({offers:{price:'0',priceCurrency:'THB'}})).price,0);
 assert.equal(extractProduct(wrap({offers:{price:'12',priceCurrency:'USD'}})).price,null);
 assert.equal(extractProduct(wrap({})).price,null);assert.equal(extractProduct('<html>no product</html>'),null);
});
test('login rate limit rejects repeated failures',async()=>{const {DB,call}=await fixture();try{for(let i=0;i<10;i++)assert.equal((await call('/api/login','POST',{email:'alice@example.test',password:'wrong'})).status,401);assert.equal((await call('/api/login','POST',{email:'alice@example.test',password:'correct-password'})).status,429);}finally{DB.close();}});
test('provided Thaimart URLs round-trip through shop redirects without enabling import',async()=>{
 const urls=JSON.parse(readFileSync(new URL('./fixtures/thaimart-urls.json',import.meta.url),'utf8'));
 const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 const {DB,call,login}=await fixture(config.vars.CHECKOUT_HOSTS);
 try{
  assert.equal(config.vars.IMPORT_HOSTS,'');
  const cookie=await login('alice@example.test');
  const {id}=await (await call('/api/shops','POST',{name:'ร้านทดสอบลิงก์',slug:'url-test'},cookie)).json();
  await call(`/api/shops/${id}`,'PUT',{name:'ร้านทดสอบลิงก์',published:true},cookie);
  for(const [index,url] of urls.entries()){
   const created=await call(`/api/shops/${id}/products`,'POST',{name:`ข้อมูลสมมติสำหรับทดสอบลิงก์ ${index+1}`,price:null,source_url:url,status:'published'},cookie);
   assert.equal(created.status,201);
   const product=await created.json();
   const redirect=await call(`/go/${product.id}`);
   assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),url);
   assert.equal((await call('/api/import','POST',{url},cookie)).status,422);
  }
  for(const url of ['https://thaimart.com.evil.example/products/a','https://thaimart.com@evil.example/products/a','http://thaimart.com/products/a']){
   assert.equal((await call(`/api/shops/${id}/products`,'POST',{name:'invalid destination',price:null,source_url:url},cookie)).status,400);
  }
 }finally{DB.close();}
});
