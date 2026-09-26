import test from 'node:test';import assert from 'node:assert/strict';import {database} from '../scripts/adapter.mjs';import {hash} from '../src/security.mjs';import worker from '../src/worker.mjs';import {issueImportReceipt} from '../src/provenance.mjs';import {mountImportProvenance} from '../public/import-provenance.js';import {JSDOM} from 'jsdom';
test('saved import source is owner-bound, preserved by edits/trash and cleared on a different source',async(t)=>{
 const DB=database(),env={DB,APP_ENV:'staging',CHECKOUT_HOSTS:'thaimart.com',IMPORT_HOSTS:'thaimart.com'};
 const call=(path,method='GET',data,user='alice')=>worker.fetch(new Request('https://mart.test'+path,{method,headers:{Origin:'https://mart.test',Cookie:'mart_session='+user},...(data?{body:JSON.stringify(data)}:{})}),env,{waitUntil(){}});
 const url='https://thaimart.com/products/6aa8a98ed792ee0753ff3dba?share=true',other='https://thaimart.com/products/6a572a199c8506495ec55277';
 try{
 for(const id of ['alice','bob']){await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@test.com','unused','free').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(id),id,Math.floor(Date.now()/1000)+3600).run();}
 await DB.prepare('INSERT INTO shops(id,owner_id,slug,name) VALUES(?,?,?,?)').bind('shop','alice','test-shop','ร้าน').run();
 t.mock.method(globalThis,'fetch',async()=>new Response('<script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:'นำเข้า',offers:{price:0,priceCurrency:'THB'}})+'</script>',{headers:{'content-type':'text/html'}}));
 const imported=await call('/api/import','POST',{url});assert.equal(imported.status,200);const receipt=await imported.json();assert.ok(receipt.import_receipt);assert.equal((await(await call('/api/shops/shop/products')).json()).length,0);
 const foreign=await issueImportReceipt(env,{id:'bob'},url),payload={name:'นำเข้า',source_url:url,status:'draft',price:0};
 assert.equal((await call('/api/shops/shop/products','POST',{...payload,import_receipt:foreign.import_receipt})).status,422);
 assert.equal((await call('/api/shops/shop/products','POST',{...payload,source_url:other,import_receipt:receipt.import_receipt})).status,422);
 const created=await call('/api/shops/shop/products','POST',{...payload,...receipt,import_provenance:'fake'});assert.equal(created.status,201);const {id}=await created.json();const path='/api/products/'+id;
 let saved=await(await call(path)).json(),original=saved.import_provenance;assert.equal(JSON.parse(original).read_at,receipt.imported_at);assert.equal(JSON.parse(original).source_url,url);assert.equal(saved.imported_at,undefined);
 assert.equal((await call(path,'GET',null,'bob')).status,404);
 await call(path,'PUT',{...payload,name:'แก้เอง',import_provenance:'fake',source_url:url.replace('?share=true','?tracking=keep')});saved=await(await call(path)).json();assert.equal(saved.import_provenance,original);
 await call(path,'DELETE');await call('/api/trash/'+id+'/restore','POST',{});assert.equal((await(await call(path)).json()).import_provenance,original);
 // Snapshots from before this migration still restore using an empty default.
 await call(path,'DELETE');const row=await DB.prepare('SELECT snapshot FROM product_trash WHERE id=?').bind(id).first();const snapshot=JSON.parse(row.snapshot);delete snapshot.import_provenance;await DB.prepare('UPDATE product_trash SET snapshot=? WHERE id=?').bind(JSON.stringify(snapshot),id).run();assert.equal((await call('/api/trash/'+id+'/restore','POST',{})).status,200);assert.equal((await(await call(path)).json()).import_provenance,'');
 await call(path,'PUT',{...payload,...receipt});await DB.prepare('UPDATE import_receipts SET expires_at=0 WHERE id=?').bind(receipt.import_receipt).run();assert.equal((await call(path,'PUT',{...payload,...receipt})).status,422);assert.equal((await(await call(path)).json()).import_provenance,original);
 await call(path,'PUT',{...payload,source_url:other});assert.equal((await(await call(path)).json()).import_provenance,'');
 }finally{DB.close();}
});
test('provenance display uses Bangkok time, escapes source and ignores missing legacy values',()=>{
 const dom=new JSDOM('<div></div>'),root=dom.window.document.querySelector('div');mountImportProvenance(root,'');assert.equal(root.textContent,'');mountImportProvenance(root,'bad');assert.equal(root.textContent,'');
 mountImportProvenance(root,JSON.stringify({read_at:'2026-09-26T15:00:00Z',source_url:'<script>alert(1)</script>'}));assert.match(root.textContent,/22:00/);assert.equal(root.querySelector('script'),null);assert.match(root.textContent,/ไม่ใช่เวลาอัปเดต/);dom.window.close();
});
