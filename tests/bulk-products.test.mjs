import test from 'node:test';import assert from 'node:assert/strict';import {database} from '../scripts/adapter.mjs';import {hash} from '../src/security.mjs';import worker from '../src/worker.mjs';import {JSDOM} from 'jsdom';import {mountBulkProducts} from '../public/bulk-products.js';
test('bulk status is owner scoped, atomic, validates media and preserves saved content',async()=>{
 const DB=database(),env={DB,CHECKOUT_HOSTS:'thaimart.com',APP_ENV:'staging'};
 const call=(ids,status='published',user='alice',shop='shop')=>worker.fetch(new Request(`https://mart.test/api/shops/${shop}/bulk-status`,{method:'POST',headers:{Origin:'https://mart.test',Cookie:'mart_session='+user},body:JSON.stringify({ids,status})}),env,{waitUntil(){}});
 try{
  for(const id of ['alice','bob']){await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@example.test','unused','growth').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(id),id,Math.floor(Date.now()/1000)+3600).run();await DB.prepare('INSERT INTO shops(id,owner_id,slug,name) VALUES(?,?,?,?)').bind(id==='alice'?'shop':'other',id,id+'-shop','ร้าน').run();}
  for(const [id,shop] of [['a','shop'],['b','shop'],['c','other']])await DB.prepare('INSERT INTO products(id,shop_id,name,source_url,price,featured,checkout_url) VALUES(?,?,?,?,?,?,?)').bind(id,shop,id,'https://thaimart.com/products/'+id,100,1,'https://thaimart.com/buy?ref=keep').run();
  for(const ids of [[],['a','a'],[1],Array.from({length:101},(_,i)=>String(i))])assert.equal((await call(ids)).status,400);
  assert.equal((await call(['a'],'bad')).status,400);assert.equal((await call(['a'],'published','bob')).status,404);
  assert.equal((await call(['a','c'])).status,409);assert.equal((await call(['a','missing'])).status,409);assert.equal((await DB.prepare('SELECT status FROM products WHERE id=?').bind('a').first()).status,'draft');
  await DB.prepare('UPDATE products SET gallery_json=? WHERE id=?').bind(JSON.stringify([{url:'https://example.test/missing.jpg'}]),'b').run();assert.equal((await call(['a','b'])).status,422);assert.equal((await DB.prepare('SELECT status FROM products WHERE id=?').bind('a').first()).status,'draft');
  await DB.prepare('UPDATE products SET gallery_json=? WHERE id=?').bind('[]','b').run();assert.equal((await call(['a','b'])).status,200);
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
