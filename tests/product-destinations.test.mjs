import test from 'node:test';import assert from 'node:assert/strict';
import {database} from '../scripts/adapter.mjs';
import {rememberDestination,productDestination} from '../src/product-destinations.mjs';
import {productIdentity,findDuplicate} from '../src/duplicates.mjs';
import {extractProduct} from '../src/import.mjs';
import worker from '../src/worker.mjs';
const identity='https://thaimart.com/products/6a6044ba38080803c9a108ea';
test('existing broken ID redirects to verified page while affiliate wins and duplicate identity stays stable',async()=>{
 const DB=database(),env={DB,CHECKOUT_HOSTS:'thaimart.com',APP_ENV:'production'},pending=[];
 const call=()=>worker.fetch(new Request('https://mart.test/go/p'),env,{waitUntil:p=>pending.push(p)});
 try{
  const destination=await productDestination(env,identity);assert.match(destination,/-0803c9a108ea$/);assert.notEqual(destination,identity);
  await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind('u','u@example.test','unused','free').run();
  await DB.prepare('INSERT INTO shops(id,owner_id,name,slug,published) VALUES(?,?,?,?,1)').bind('s','u','Shop','shop').run();
  await DB.prepare("INSERT INTO products(id,shop_id,name,source_url,status) VALUES(?,?,?,?,'published')").bind('p','s','Product',identity).run();
  assert.equal((await call()).headers.get('location'),destination);
  assert.equal((await findDuplicate(env,'s','',identity+'?share=true')).id,'p');
  const affiliate='https://thaimart.com/p/SBhtoHpa?ref=keep%2Bexact';
  await DB.prepare('UPDATE products SET checkout_url=? WHERE id=?').bind(affiliate,'p').run();assert.equal((await call()).headers.get('location'),affiliate);
  assert.equal(productIdentity(identity).split('/').pop(),'6a6044ba38080803c9a108ea');
  assert.equal(await productDestination(env,identity+'?ref=keep'),identity+'?ref=keep');
  await DB.prepare("UPDATE products SET status='draft' WHERE id='p'").run();assert.equal((await call()).status,404);
  await Promise.all(pending);
 }finally{DB.close();}
});
test('new import retains its verified public destination separately and mapping cannot be downgraded to a legacy URL',async()=>{
 const DB=database(),env={DB},id='6a8489fba9ceed89ab290994',source='https://thaimart.com/products/'+id,slug='สินค้า-ab290994';
 const url='https://thaimart.com/products/'+encodeURIComponent(slug);
 const native={id,slug,name:'สินค้า',images:[],variants:[],description:'รายละเอียด'};
 const html='<script>self.__next_f.push('+JSON.stringify([1,'0:'+JSON.stringify(native)+'\n'])+')</script>';
 try{
  const product=extractProduct(html,url);assert.equal(product.source_url,source);assert.equal(product.destination_url,url);
  await rememberDestination(env,product.source_url,product.destination_url+'?ref=other-shop');assert.equal(await productDestination(env,source),url);
  for(const bad of [source,'https://evil.test/products/x','https://thaimart.com/','javascript:bad'])await rememberDestination(env,source,bad);
  assert.equal(await productDestination(env,source),url);
  assert.equal(await productDestination(env,'https://app.thaimart.com/p/abc'),'https://app.thaimart.com/p/abc');
 }finally{DB.close();}
});

test('legacy resolver validates identity, preserves encoded Thai slugs, caches success and backs off failures',async()=>{
 const DB=database(),env={DB,THAIMART_LEGACY_RESOLVE:'true'},id='6aaaaaaaaaaaaaaaaaaaaaaa',source='https://thaimart.com/products/'+id;
 let calls=0;const fetcher=async(url,options)=>{calls++;assert.equal(url,'https://thaimart.com/api/products/'+id);assert.equal(options.redirect,'manual');return Response.json({status:{code:0},data:{id,status:'PRODUCT_STATUS_PUBLISHED',slug:encodeURIComponent('มู่ลี่ไม้ไผ่-eb9094de4e83')}});};
 try{
  const url=await productDestination(env,source,fetcher,1000);assert.equal(url,'https://thaimart.com/products/'+encodeURIComponent('มู่ลี่ไม้ไผ่-eb9094de4e83'));
  assert.equal(await productDestination(env,source,fetcher,1001),url);assert.equal(calls,1);
  const other='https://thaimart.com/products/6bbbbbbbbbbbbbbbbbbbbbbb';let failed=0;
  const wrong=async()=>{failed++;return Response.json({status:{code:0},data:{id,status:'PRODUCT_STATUS_PUBLISHED',slug:'wrong'}});};
  assert.equal(await productDestination(env,other,wrong,1000),other);assert.equal(await productDestination(env,other,wrong,1001),other);assert.equal(failed,1);
  await productDestination(env,other,wrong,4601);assert.equal(failed,2);
  assert.equal(await productDestination(env,source+'?ref=keep',fetcher),source+'?ref=keep');assert.equal(calls,1);
 }finally{DB.close();}
});

test('API destination rejects unpublished, mismatched and unsafe slug payloads',async()=>{
 const {verifiedProductURL}=await import('../src/product-destinations.mjs');const id='6aaaaaaaaaaaaaaaaaaaaaaa',data={id,status:'PRODUCT_STATUS_PUBLISHED',slug:'product-eb9094de4e83'};
 assert.equal(verifiedProductURL({status:{code:0},data},id),'https://thaimart.com/products/product-eb9094de4e83');
 for(const patch of [{id:'other'},{status:'PRODUCT_STATUS_DRAFT'},...['../x','%2f%2fevil.test','x?ref=y','%GG','%252f','..'].map(slug=>({slug}))])assert.equal(verifiedProductURL({status:{code:0},data:{...data,...patch}},id),null);
});
