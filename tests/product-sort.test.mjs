import test from 'node:test';
import assert from 'node:assert/strict';
import {productPage} from '../public/product-pages.js';
test('sorts all matches before pagination without changing source order',()=>{
 const products=Array.from({length:25},(_,i)=>({id:i,name:'สินค้า '+i,price:2500-i*100,status:'published'}));
 const result=productPage(products,{sort:'price_low',size:20});
 assert.equal(result.items[0].id,24);assert.equal(result.items[19].id,5);
 assert.equal(productPage(products,{sort:'price_low',page:2}).items[0].id,4);
 assert.equal(products[0].id,0);
});
test('sorting composes with filters, preserves price ties and ignores unknown choices',()=>{
 const items=[{id:'a',name:'B',price:0,status:'draft'},{id:'b',name:'A',price:200,status:'published'},{id:'c',name:'C',price:200,status:'published',featured:1}];
 assert.deepEqual(productPage(items,{status:'published',sort:'price_high'}).items.map(x=>x.id),['b','c']);
 assert.equal(productPage(items,{sort:'featured'}).items[0].id,'c');
 assert.equal(productPage(items,{sort:'name'}).items[0].id,'b');
 assert.deepEqual(productPage(items,{sort:'unknown'}).items,items);
});
