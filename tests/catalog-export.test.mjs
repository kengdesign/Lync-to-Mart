import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {catalogCSV,mountCatalogExport} from '../public/catalog-export.js';import {productPage} from '../public/product-pages.js';
test('catalog CSV preserves Thai quotes, multiline content, unknown/zero prices and variant details safely',()=>{
 const csv=catalogCSV([{id:'one',name:'สินค้า "แดง"',description:'บรรทัดแรก\nบรรทัดสอง 😀',price:0,status:'published',source_url:'https://thaimart.com/p?share=true',checkout_url:'https://thaimart.com/buy?ref=keep',gallery:[{key:'a'}],variants:[{sku:'=DANGEROUS()',attributes:[{key:'สี',value:'แดง'}],price:0,available:false},{sku:'0123',attributes:[],price:null}]}],'shop');
 assert.ok(csv.startsWith('\uFEFF'));assert.match(csv,/สินค้า ""แดง""/);assert.match(csv,/บรรทัดแรก\nบรรทัดสอง 😀/);assert.match(csv,/"'=DANGEROUS\(\)"/);assert.match(csv,/"0.00"/);assert.match(csv,/"0123",""/);assert.match(csv,/ไม่พร้อมขาย/);assert.equal((csv.match(/"one"/g)||[]).length,2);assert.match(csv,/ref=keep/);
 const single=catalogCSV([{id:'plain',name:' +formula',price:null,status:'draft'}],'shop');assert.match(single,/"' \+formula"/);assert.match(single,/"ฉบับร่าง",""/);
});
test('export covers every matching page, distinguishes all/filtered and preserves scope on redraw',()=>{
 const dom=new JSDOM('<div></div>'),root=dom.window.document.querySelector('div'),products=Array.from({length:105},(_,i)=>({id:String(i),name:'สินค้า '+i,status:i%2?'draft':'published'}));let file;
 const filtered=productPage(products,{status:'draft',page:2}).matches,opts={products,filtered,shopId:'shop',download:(text,name)=>file={text,name}};
 mountCatalogExport(root,opts);root.querySelector('button').click();assert.equal((file.text.match(/"ฉบับร่าง"/g)||[]).length,52);assert.match(file.name,/filtered/);
 root.querySelector('select').value='all';root.querySelector('select').onchange();mountCatalogExport(root,{...opts,filtered:[]});assert.equal(root.querySelector('select').value,'all');root.querySelector('button').click();assert.ok(file.text.includes('สินค้า 104'));assert.match(file.name,/all/);
 root.querySelector('select').value='filtered';root.querySelector('select').onchange();assert.equal(root.querySelector('button').disabled,true);dom.window.close();
});
