import test from 'node:test';import assert from 'node:assert/strict';import {database} from '../scripts/adapter.mjs';import {hash} from '../src/security.mjs';import worker from '../src/worker.mjs';import {JSDOM} from 'jsdom';import {mountBulkProducts} from '../public/bulk-products.js';
test('bulk status is owner scoped, atomic, validates media and preserves saved content',async()=>{
 const DB=database(),env={DB,CHECKOUT_HOSTS:'thaimart.com',APP_ENV:'staging'};
 const call=(ids,status='published',user='alice',shop='shop')=>worker.fetch(new Request(`https://mart.test/api/shops/${shop}/bulk-status`,{method:'POST',headers:{Origin:'https://mart.test',Cookie:'mart_session='+user},body:JSON.stringify({ids,status})}),env,{waitUntil(){}});
 try{
  for(const id of ['alice','bob']){await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@example.test','unused','growth').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(id),id,Math.floor(Date.now()/1000)+3600).run();await DB.prepare('INSERT INTO shops(id,owner_id,slug,name) VALUES(?,?,?,?)').bind(id==='alice'?'shop':'other',id,id+'-shop','ร้าน').run();}
  for(const [id,shop] of [['a','shop'],['b','shop'],['c','other']])await DB.prepare('INSERT INTO products(id,shop_id,name,source_url,price,featured,checkout_url) VALUES(?,?,?,?,?,?,?)').bind(id,shop,id,'https://thaimart.com/products/'+id,100,1,'https://thaimart.com/buy?ref=keep').run();
  assert.equal((await call(['a','b'])).status,422);
  await DB.prepare('INSERT INTO media VALUES(?,?,?,?)').bind('alice/image','alice','image/png',10).run();
  await DB.prepare("UPDATE products SET image_key='alice/image',gallery_json=? WHERE shop_id='shop'").bind(JSON.stringify([{key:'alice/image'}])).run();
  for(const ids of [[],['a','a'],[1],Array.from({length:101},(_,i)=>String(i))])assert.equal((await call(ids)).status,400);
  assert.equal((await call(['a'],'bad')).status,400);assert.equal((await call(['a'],'published','bob')).status,404);
  assert.equal((await call(['a','c'])).status,409);assert.equal((await call(['a','missing'])).status,409);assert.equal((await DB.prepare('SELECT status FROM products WHERE id=?').bind('a').first()).status,'draft');
  await DB.prepare('UPDATE products SET gallery_json=? WHERE id=?').bind(JSON.stringify([{url:'https://example.test/missing.jpg'}]),'b').run();assert.equal((await call(['a','b'])).status,422);assert.equal((await DB.prepare('SELECT status FROM products WHERE id=?').bind('a').first()).status,'draft');
  await DB.prepare('UPDATE products SET gallery_json=? WHERE id=?').bind(JSON.stringify([{key:'alice/image'}]),'b').run();assert.equal((await call(['a','b'])).status,200);
  const row=await DB.prepare('SELECT * FROM products WHERE id=?').bind('a').first();assert.equal(row.status,'published');assert.equal(row.price,100);assert.equal(row.featured,1);assert.equal(row.checkout_url,'https://thaimart.com/buy?ref=keep');
  assert.equal((await worker.fetch(new Request('https://mart.test/shop/alice-shop'),env,{waitUntil(){}})).status,404);
  assert.equal((await call(['a','b'],'draft')).status,200);assert.equal((await DB.prepare('SELECT status FROM products WHERE id=?').bind('b').first()).status,'draft');
 }finally{DB.close();}
});
test('bulk UI limits selection, confirms, locks pending request and permits retry',async()=>{
 const dom=new JSDOM(`<div id="root"><input type="checkbox" data-select-all>${Array.from({length:101},(_,i)=>`<input type="checkbox" data-select-product="${i}">`).join('')}</div>`),root=dom.window.document.querySelector('#root');let confirmation='',allow=false,calls=0,reject,resolve,saved;
 mountBulkProducts(root,{shopId:'shop',published:false,toast(){},onSaved:r=>saved=r,confirm:m=>{confirmation=m;return allow;},send:(_path,data)=>{calls++;assert.equal(data.ids.length,100);return new Promise((res,rej)=>{resolve=res;reject=rej;});}});
 root.querySelector('[data-select-all]').click();const boxes=[...root.querySelectorAll('[data-select-product]')];assert.equal(boxes.filter(b=>b.checked).length,100);assert.equal(boxes[100].disabled,true);
 const publish=root.querySelector('[data-bulk="published"]');await publish.onclick();assert.equal(calls,0);assert.match(confirmation,/100/);assert.match(confirmation,/ร้านยังไม่เผยแพร่/);
 allow=true;const pending=publish.onclick();assert.equal(publish.disabled,true);assert.ok(boxes.every(b=>b.disabled));reject(new Error('retry'));await pending;assert.equal(publish.disabled,false);
 const retry=publish.onclick();resolve({ids:boxes.slice(0,100).map(b=>b.dataset.selectProduct),status:'published',count:100});await retry;assert.equal(saved.count,100);assert.equal(calls,2);
 root.querySelector('[data-clear]').click();assert.equal(publish.disabled,true);assert.ok(boxes.every(b=>!b.checked));dom.window.close();
});

test('bulk category updates are atomic, owner scoped and preserve publication/content',async()=>{
 const DB=database(),env={DB,APP_ENV:'staging'},call=(ids,category,user='alice')=>worker.fetch(new Request('https://mart.test/api/shops/shop/bulk-category',{method:'POST',headers:{Origin:'https://mart.test',Cookie:'mart_session='+user},body:JSON.stringify({ids,category})}),env,{waitUntil(){}});
 try{
 for(const id of ['alice','bob']){await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@test.com','unused','free').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(id),id,Math.floor(Date.now()/1000)+3600).run();await DB.prepare('INSERT INTO shops(id,owner_id,slug,name) VALUES(?,?,?,?)').bind(id==='alice'?'shop':'other',id,id+'-shop','ร้าน').run();}
 for(const [id,shop] of [['a','shop'],['b','shop'],['c','other']])await DB.prepare('INSERT INTO products(id,shop_id,name,source_url,status,category,price) VALUES(?,?,?,?,?,?,?)').bind(id,shop,id,'https://thaimart.com/products/'+id,'published','เดิม',100).run();
 for(const [ids,category] of [[[], 'หมวด'],[['a','a'],'หมวด'],[['a'],null],[['a'],'x'.repeat(501)],[Array.from({length:101},(_,i)=>String(i)),'หมวด']])assert.equal((await call(ids,category)).status,400);
 assert.equal((await call(['a'],'ใหม่','bob')).status,404);assert.equal((await call(['a','c'],'ใหม่')).status,409);assert.equal((await call(['a','missing'],'ใหม่')).status,409);assert.equal((await DB.prepare("SELECT category FROM products WHERE id='a'").first()).category,'เดิม');
 const success=await call(['a','b'],'  ใหม่ / สีแดง  ');assert.equal(success.status,200);assert.equal((await success.json()).category,'ใหม่ / สีแดง');const row=await DB.prepare("SELECT * FROM products WHERE id='a'").first();assert.equal(row.status,'published');assert.equal(row.price,100);assert.equal(row.category,'ใหม่ / สีแดง');assert.equal((await DB.prepare("SELECT category FROM products WHERE id='c'").first()).category,'เดิม');
 assert.equal((await call(['a','b'],'')).status,200);assert.equal((await DB.prepare("SELECT category FROM products WHERE id='b'").first()).category,'');
 }finally{DB.close();}
});
test('bulk category UI confirms, keeps failed selections, locks status actions and explicitly clears category',async()=>{
 const dom=new JSDOM('<div><input type="checkbox" data-select-all><input type="checkbox" data-select-product="one"></div>'),root=dom.window.document.querySelector('div');let allow=false,calls=0,reject,resolve,saved,payload;
 mountBulkProducts(root,{shopId:'shop',published:true,categories:['เดิม','เดิม','<script>'],toast(){},onSaved:r=>saved=r,confirm:()=>allow,send:(path,data)=>{assert.match(path,/bulk-category$/);calls++;payload=data;return new Promise((res,rej)=>{resolve=res;reject=rej;});}});
 root.querySelector('[data-select-all]').click();root.querySelector('[data-open-category]').click();const apply=root.querySelector('[data-apply-category]'),input=root.querySelector('[data-category-name]');assert.ok(apply.disabled);assert.equal(root.querySelector('script'),null);
 input.value=' ใหม่ ';input.oninput();assert.equal(apply.disabled,false);await apply.onclick();assert.equal(calls,0);allow=true;const failed=apply.onclick();assert.ok(input.disabled);assert.ok(root.querySelector('[data-bulk="published"]').disabled);reject(new Error('ลองใหม่'));await failed;assert.ok(root.querySelector('[data-select-product]').checked);assert.equal(input.disabled,false);
 const retry=apply.onclick();assert.equal(payload.category,'ใหม่');resolve({ids:['one'],category:'ใหม่',count:1});await retry;assert.equal(saved.category,'ใหม่');const clear=root.querySelector('[data-remove-category]').onclick();assert.equal(payload.category,'');resolve({ids:['one'],category:'',count:1});await clear;assert.equal(saved.category,'');dom.window.close();
});

test('category panel cancels without writes, closes on empty selection and can reopen',()=>{
 const dom=new JSDOM('<div><input type="checkbox" data-select-all><input type="checkbox" data-select-product="one"></div>'),root=dom.window.document.querySelector('div');let calls=0;
 mountBulkProducts(root,{shopId:'shop',published:true,categories:[],toast(){},onSaved(){},confirm:()=>true,send:async()=>{calls++;}});
 const all=root.querySelector('[data-select-all]'),open=root.querySelector('[data-open-category]'),panel=root.querySelector('.bulk-category'),input=root.querySelector('[data-category-name]');
 all.click();open.click();input.value='ยังไม่บันทึก';input.oninput();root.querySelector('[data-cancel-category]').click();assert.ok(panel.hidden);assert.equal(input.value,'');assert.ok(root.querySelector('[data-select-product]').checked);assert.equal(calls,0);assert.equal(dom.window.document.activeElement,open);
 open.click();root.querySelector('[data-clear]').click();assert.ok(panel.hidden);assert.equal(root.querySelector('[data-select-product]').checked,false);
 all.click();open.click();assert.equal(panel.hidden,false);all.click();assert.ok(panel.hidden);
 all.click();open.click();input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.ok(panel.hidden);assert.equal(calls,0);dom.window.close();
});
