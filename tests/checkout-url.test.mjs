import test from 'node:test';import assert from 'node:assert/strict';
import {database} from '../scripts/adapter.mjs';import {hash} from '../src/security.mjs';import worker from '../src/worker.mjs';
test('separate checkout URL preserves tracking, survives legacy updates, validates hosts and falls back when cleared',async()=>{
 const DB=database(),pending=[],env={DB,CHECKOUT_HOSTS:'thaimart.com',APP_ENV:'staging'};
 const call=async(path,method='GET',data,user='alice')=>{const response=await worker.fetch(new Request('https://mart.test'+path,{method,headers:{Origin:'https://mart.test',...(user?{Cookie:'mart_session='+user}:{})},...(data?{body:JSON.stringify(data)}:{})}),env,{waitUntil:p=>pending.push(p)});await Promise.all(pending);return response;};
 try{
  for(const id of ['alice','bob']){await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@example.test','unused','free').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(id),id,Math.floor(Date.now()/1000)+3600).run();}
  const {id:shop}=await(await call('/api/shops','POST',{name:'ร้าน',slug:'test-shop'})).json();await call('/api/shops/'+shop,'PUT',{name:'ร้าน',published:true});
  const source='https://thaimart.com/products/6a8489fba9ceed89ab290994?share=true',target=source+'&test_tracking=a%2Bb&test_tracking=c&x=1#details';
  const product={name:'ทดสอบ',source_url:source,checkout_url:target,status:'published'};
  const r=await call('/api/shops/'+shop+'/products','POST',product);assert.equal(r.status,201);const {id}=await r.json();
  assert.equal((await call('/go/'+id,'GET',null,null)).headers.get('location'),target);
  assert.equal((await call('/api/products/'+id,'PUT',{...product,checkout_url:source},'bob')).status,404);
  const {checkout_url,...legacy}=product;assert.equal((await call('/api/products/'+id,'PUT',legacy)).status,200);
  assert.equal((await DB.prepare('SELECT checkout_url FROM products WHERE id=?').bind(id).first()).checkout_url,target);
  for(const bad of ['https://thaimart.com.evil.test/x','javascript:alert(1)','https://user@thaimart.com/x','http://thaimart.com/x','https://thaimart.com:8443/x','x'.repeat(2001),null])assert.equal((await call('/api/products/'+id,'PUT',{...product,checkout_url:bad})).status,400);
  assert.equal((await call('/api/products/'+id,'PUT',{...product,checkout_url:''})).status,200);assert.equal((await call('/go/'+id,'GET',null,null)).headers.get('location'),source);
  await call('/api/products/'+id,'PUT',{...product,status:'draft'});assert.equal((await call('/go/'+id,'GET',null,null)).status,404);
 }finally{DB.close();}
});
