import test from 'node:test';import assert from 'node:assert/strict';
import {database} from '../scripts/adapter.mjs';import {soldOut,stockStatus} from '../src/stock-status.mjs';import worker from '../src/worker.mjs';
const id='6aae10a107b5ff7111930c51';
const payload=(q,variants=[{isActive:true,remainingQuantity:q}])=>({status:{code:0},data:{id,status:'PRODUCT_STATUS_PUBLISHED',remainingQuantity:q,variants}});
test('sold out requires explicit current stock and all active variants exhausted',()=>{
 assert.equal(soldOut(payload(0),id),true);assert.equal(soldOut(payload(2),id),false);
 for(const data of [payload(0,[{remainingQuantity:2}]),payload(null),payload(0,[]),payload(0,[{}]),payload(0,[{isActive:false,remainingQuantity:0}])])assert.equal(soldOut(data,id),null);
 assert.equal(soldOut(payload(0),'other'),null);assert.equal(soldOut({...payload(0),status:{code:1}},id),null);
 const draft=payload(0);draft.data.status='PRODUCT_STATUS_DRAFT';assert.equal(soldOut(draft,id),null);
});
test('shared cache, restock, failures and shop visibility protect public status',async()=>{
 const DB=database(),env={DB};let calls=0,q=0,bad=false;
 const fetcher=async(url,opts)=>{calls++;assert.equal(url,'https://thaimart.com/api/products/'+id);assert.equal(opts.redirect,'manual');if(bad)throw Error('timeout');return Response.json(payload(q));};
 try{
  await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind('u','u@example.test','unused','free').run();
  await DB.prepare('INSERT INTO shops(id,owner_id,name,slug,published) VALUES(?,?,?,?,1)').bind('s','u','Shop','shop').run();
  for(const p of ['p','p2'])await DB.prepare("INSERT INTO products(id,shop_id,name,source_url,status) VALUES(?,?,?,?,'published')").bind(p,'s','Product','https://thaimart.com/products/'+id).run();
  let result=await stockStatus(env,['p','p2'],fetcher,1000);assert.equal(result.products.p.sold_out,true);assert.equal(result.products.p2.sold_out,true);assert.equal(calls,1);
  await stockStatus(env,['p'],fetcher,1100);assert.equal(calls,1);
  q=3;result=await stockStatus(env,['p'],fetcher,1301);assert.equal(result.products.p.sold_out,false);assert.equal(calls,2);
  bad=true;assert.deepEqual((await stockStatus(env,['p'],fetcher,1602)).products,{});await stockStatus(env,['p'],fetcher,1610);assert.equal(calls,3);
  await DB.prepare("UPDATE shops SET moderation_status='banned' WHERE id='s'").run();assert.deepEqual((await stockStatus(env,['p'],fetcher,2000)).products,{});assert.equal(calls,3);
  assert.deepEqual((await stockStatus(env,['missing'],fetcher,2000)).products,{});
  await assert.rejects(stockStatus(env,Array.from({length:13},(_,i)=>String(i)),fetcher));
  assert.deepEqual((await stockStatus({...env,STOCK_STATUS_ENABLED:'false'},['p'],fetcher)).products,{});
  const r=await worker.fetch(new Request('https://mart.test/api/public/stock-status?ids=missing'),env,{waitUntil(){}});assert.equal(r.status,200);assert.deepEqual(await r.json(),{products:{}});
 }finally{DB.close();}
});
test('seller stock includes own drafts and never includes another owner or another team shop',async()=>{
 const DB=database(),env={DB};const fetcher=async()=>Response.json(payload(0));
 try{
  for(const u of ['alice','bob'])await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(u,u+'@example.test','unused','brand').run();
  for(const [s,u] of [['a','alice'],['a2','alice'],['b','bob']]){
   await DB.prepare('INSERT INTO shops(id,owner_id,name,slug) VALUES(?,?,?,?)').bind(s,u,s,s).run();
   await DB.prepare('INSERT INTO products(id,shop_id,name,source_url) VALUES(?,?,?,?)').bind(s,s,s,'https://thaimart.com/products/'+id).run();
  }
  assert.deepEqual((await stockStatus(env,['a','a2','b'],fetcher,1000)).products,{});
  assert.deepEqual(Object.keys((await stockStatus(env,['a','a2','b'],fetcher,1000,{id:'alice'})).products).sort(),['a','a2']);
  assert.deepEqual(Object.keys((await stockStatus(env,['a','a2','b'],fetcher,1000,{id:'alice',team:{shop_id:'a'}})).products),['a']);
  const response=await worker.fetch(new Request('https://mart.test/api/stock-status?ids=a'),env,{waitUntil(){}});assert.equal(response.status,401);
 }finally{DB.close();}
});
