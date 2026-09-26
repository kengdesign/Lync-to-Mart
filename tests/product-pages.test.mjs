import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {productPage,mountProductPager} from '../public/product-pages.js';
test('dashboard pages search the whole catalog, clamp after changes and retain input order',()=>{
 const products=Array.from({length:105},(_,i)=>({id:String(i),name:'สินค้า '+i,status:i%2?'draft':'published'}));
 assert.equal(productPage(products).items.length,20);assert.deepEqual(productPage(products,{page:6}).items.map(p=>p.id),['100','101','102','103','104']);
 const match=productPage(products,{search:'  สินค้า 104 ',page:6});assert.equal(match.page,1);assert.equal(match.total,1);assert.equal(match.items[0].id,'104');
 assert.equal(productPage(products,{status:'draft',size:50}).total,52);assert.equal(productPage(products,{status:'draft',size:50,page:2}).items.length,2);
 const empty=productPage(products,{search:'ไม่มี'});assert.equal(empty.start,0);assert.equal(empty.end,0);assert.equal(empty.pages,1);
 assert.equal(productPage(products,{size:100}).items.length,100);assert.equal(productPage(products,{size:1000}).size,20);assert.equal(products.length,105);
});
test('pager supports next, previous and direct page selection with boundary buttons',()=>{
 const dom=new JSDOM('<nav></nav>'),root=dom.window.document.querySelector('nav'),products=Array.from({length:45},(_,i)=>({name:String(i),status:'draft'}));let selected;
 mountProductPager(root,productPage(products),p=>selected=p);assert.equal(root.querySelector('button').disabled,true);root.querySelectorAll('button')[1].click();assert.equal(selected,2);
 const select=root.querySelector('select');select.value='3';select.onchange();assert.equal(selected,3);
 mountProductPager(root,productPage(products,{page:3}),p=>selected=p);assert.match(root.textContent,/41–45 จาก 45/);assert.equal(root.querySelectorAll('button')[1].disabled,true);root.querySelector('button').click();assert.equal(selected,2);
 mountProductPager(root,productPage([]),()=>{});assert.equal(root.querySelector('button'),null);assert.match(root.textContent,/0–0/);dom.window.close();
});
