import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {mergeImportSelection,reviewImport} from '../public/import-review.js';
test('partial import preserves seller rich media and matching variant/gallery set',()=>{
 const current={name:'ร้านตั้งเอง',category:'เดิม',description_html:'<p>แก้เอง</p><iframe src="https://www.youtube.com/embed/123"></iframe>',price:20,gallery:[{key:'owner/old'}],variants:[{image_key:'owner/old'}]};
 const incoming={name:'ใหม่',category:'ใหม่',description_html:'<p>ต้นทาง</p>',price:30,gallery:[{url:'https://img-cdn.thaimart.com/new.jpg'}],variants:[{image_url:'https://img-cdn.thaimart.com/new.jpg'}],source_url:'https://thaimart.com/products/test',import_receipt:'receipt',imported_at:'now'};
 const before=JSON.stringify(current),partial=mergeImportSelection(current,incoming,['name','category']);assert.equal(partial.description_html,current.description_html);assert.deepEqual(partial.variants,current.variants);assert.deepEqual(partial.gallery,current.gallery);assert.equal(partial.price,20);assert.equal(partial.name,'ใหม่');assert.equal(partial.import_receipt,'receipt');
 const commerce=mergeImportSelection(current,incoming,['commerce']);assert.equal(commerce.name,current.name);assert.deepEqual(commerce.gallery,incoming.gallery);assert.deepEqual(commerce.variants,incoming.variants);assert.equal(commerce.price,30);assert.equal(JSON.stringify(current),before);
});
test('review disables empty selection and returns chosen data or cancels without mutation',async()=>{
 const dom=new JSDOM('<dialog><form id="product-form"></form></dialog>'),modal=dom.window.document.querySelector('dialog'),current={name:'เดิม',description_html:'<p>ร้านแก้เอง</p>'},incoming={name:'ใหม่',description_html:'<p>ใหม่</p>'};
 const pending=reviewImport(modal,current,incoming),inputs=[...modal.querySelectorAll('[data-import-field]')];for(const input of inputs){input.checked=false;input.onchange();}assert.ok(modal.querySelector('[data-apply]').disabled);
 inputs[0].checked=true;inputs[0].onchange();assert.equal(modal.querySelector('[data-apply]').disabled,false);modal.querySelector('[data-apply]').click();const result=await pending;assert.equal(result.name,'ใหม่');assert.equal(result.description_html,current.description_html);assert.equal(modal.querySelector('.import-review'),null);
 const cancel=reviewImport(modal,current,incoming);modal.querySelector('[data-keep]').click();assert.equal(await cancel,false);dom.window.close();
});
