import test from 'node:test';
import assert from 'node:assert/strict';
import {productGaps,productPage} from '../public/product-pages.js';
test('quality identifies recorded gaps, accepting zero price and unicode text',()=>{
 assert.deepEqual(productGaps({image_key:'photo',description:'ภาษาไทย 🌷',category:'ดอกไม้',price:0}),[]);
 assert.deepEqual(productGaps({description:'  ',category:'\n'}),['image','description','category']);
 assert.deepEqual(productGaps({image_key:'photo',description:'',category:'a'}),['description']);
});
test('quality filters compose before pagination and CSV matches',()=>{
 const rows=Array.from({length:45},(_,id)=>({id,name:'ดอกไม้',status:id%2?'draft':'published',image_key:id<24?'':'photo',description:'รายละเอียด',category:'a',price:id}));
 const result=productPage(rows,{quality:'image',status:'published',sort:'price_high',search:'ดอกไม้'});
 assert.equal(result.total,12);assert.equal(result.matches[0].id,22);
 assert.equal(productPage(rows,{quality:'incomplete',page:2}).items.length,4);
 assert.equal(productPage(rows,{quality:'category'}).total,0);
 assert.equal(rows[0].id,0);
});
