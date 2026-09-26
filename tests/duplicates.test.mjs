import test from 'node:test';import assert from 'node:assert/strict';
import {database} from '../scripts/adapter.mjs';import {hash} from '../src/security.mjs';import worker from '../src/worker.mjs';import {productIdentity} from '../src/duplicates.mjs';
test('duplicate prevention is per-shop, ignores share parameters and handles simultaneous saves',async()=>{
 const DB=database(),env={DB,CHECKOUT_HOSTS:'thaimart.com',APP_ENV:'staging'};
 const call=(path,method='GET',data,user='alice')=>worker.fetch(new Request('https://mart.test'+path,{method,headers:{Origin:'https://mart.test',...(user?{Cookie:'mart_session='+user}:{})},...(data?{body:JSON.stringify(data)}:{})}),env,{waitUntil(){}});
 try{
  for(const id of ['alice','bob']){await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@example.test','unused','free').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(id),id,Math.floor(Date.now()/1000)+3600).run();}
  const {id:shop}=await(await call('/api/shops','POST',{name:'ร้าน',slug:'test-shop'})).json();
  const {id:other}=await(await call('/api/shops','POST',{name:'Other',slug:'other-shop'},'bob')).json();
  const url='https://thaimart.com/products/6a8489fba9ceed89ab290994';const product={name:'สินค้า',source_url:url+'?share=true',status:'draft',checkout_url:url+'?tracking=keep'};
  const endpoint='/api/shops/'+shop+'/products',check='/api/shops/'+shop+'/duplicate';
  const created=await call(endpoint,'POST',product);assert.equal(created.status,201);const {id}=await created.json();
  for(const source_url of [url,url+'/?share=false#details',url+'#details?x=1',url.toUpperCase()+'?other=1']){
   assert.equal((await call(endpoint,'POST',{...product,source_url})).status,409);
   const match=await(await call(check,'POST',{url:source_url})).json();assert.equal(match.product.id,id);assert.equal(match.product.checkout_url,product.checkout_url);
  }
  assert.equal((await call('/api/products/'+id,'PUT',{...product,name:'แก้ไขเดิม'})).status,200);
  assert.equal((await(await call(check,'POST',{url,exclude_id:id})).json()).product,null);
  assert.equal((await call('/api/shops/'+other+'/products','POST',product,'bob')).status,201);
  assert.equal((await call(check,'POST',{url},'bob')).status,404);assert.equal((await call(check,'POST',{url},null)).status,401);
  const another={...product,source_url:url.replace(/994$/,'995')};const next=await(await call(endpoint,'POST',another)).json();
  assert.equal((await call('/api/products/'+next.id,'PUT',product)).status,409);
  const race={...product,source_url:url.replace(/994$/,'996')};const responses=await Promise.all([call(endpoint,'POST',race),call(endpoint,'POST',race)]);assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
  assert.equal(productIdentity('https://thaimart.com.evil.test/products/6a8489fba9ceed89ab290994'),'');
  await call('/api/products/'+id,'DELETE');assert.equal((await call(endpoint,'POST',product)).status,201);
 }finally{DB.close();}
});
