import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {productIssues,mountShopReadiness} from '../public/shop-readiness.js';
const complete={id:'ok',name:'สินค้า',image_key:'owner/image',description:'ข้อความ 😀',category:'ทดสอบ',price:0,status:'draft'};
test('readiness accepts zero, checks each variant and image-only descriptions without changing products',()=>{
 assert.deepEqual(productIssues(complete),[]);
 assert.deepEqual(productIssues({...complete,price:null}),['price']);
 assert.deepEqual(productIssues({...complete,price:null,variants:[{price:0},{price:20}]}),[]);
 assert.deepEqual(productIssues({...complete,variants:[{price:null},{price:20}]}),['price']);
 assert.deepEqual(productIssues({...complete,description:'  ',description_html:'<img src="/media/test">',image_key:'',category:''}),['image','description','category']);
 assert.equal(complete.status,'draft');
});
test('readiness filters whole catalog, pages ten rows, safely opens correct product and handles empty shop',()=>{
 const dom=new JSDOM('<section></section>'),root=dom.window.document.querySelector('section');let edited,store=0,add=0;
 const products=Array.from({length:23},(_,i)=>({...complete,id:String(i),name:i===22?'<img src=x onerror=alert(1)>':'สินค้า '+i,description:'',category:i===22?'':'หมวด'}));
 const before=JSON.stringify(products),options={root,shop:{published:1,description:'ร้าน',logo_key:'logo'},products,onEdit:p=>edited=p.id,onStore:()=>store++,onAdd:()=>add++};
 mountShopReadiness(options);assert.equal(root.querySelectorAll('.readiness-row').length,10);root.querySelector('.readiness-nav button:last-child').click();root.querySelector('.readiness-nav button:last-child').click();assert.equal(root.querySelectorAll('.readiness-row').length,3);assert.equal(root.querySelector('img'),null);
 const select=root.querySelector('select');select.value='category';select.onchange();assert.equal(root.querySelectorAll('.readiness-row').length,1);root.querySelector('.readiness-row button').click();assert.equal(edited,'22');assert.match(root.querySelector('.readiness-nav').textContent,/หน้า 1/);
 select.value='image';select.onchange();assert.equal(root.querySelectorAll('.readiness-row').length,0);assert.equal(JSON.stringify(products),before);
 mountShopReadiness({...options,products:[],shop:{}});root.querySelector('.readiness-shop button').click();assert.equal(store,1);[...root.querySelectorAll('button')].find(b=>b.textContent==='เพิ่มสินค้า').click();assert.equal(add,1);
 mountShopReadiness({...options,products:[complete]});assert.match(root.textContent,/1 \/ 1/);assert.equal(root.querySelector('select'),null);dom.window.close();
});
