import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountShopStatus,shopStatus} from '../public/shop-status.js';
test('shop banner prioritizes moderation over publication and keeps reasons as text',async()=>{
 const dom=new JSDOM('<section id="banner"></section>');globalThis.document=dom.window.document;
 const root=document.querySelector('section');let refreshed=0;
 for(const [status,title] of [['suspended','ระงับชั่วคราว'],['banned','ถูกแบน'],['deleted','ถูกลบ']]){
  const shop={name:'ร้านทดสอบ',published:1,moderation_status:status,moderation_reason:'<img src=x onerror=alert(1)>\nเหตุผลจากแอดมิน'};
  mountShopStatus(root,shop,async()=>{refreshed++;});assert.equal(root.hidden,false);assert.ok(root.textContent.includes(title));assert.ok(root.textContent.includes(shop.moderation_reason));assert.equal(root.querySelector('img'),null);assert.equal(shopStatus(shop).blocked,true);
 }
 await root.querySelector('button').onclick();assert.equal(refreshed,1);
 mountShopStatus(root,{name:'อีกหนึ่งร้าน',published:0,moderation_status:'active'},()=>{});assert.match(root.textContent,/ฉบับร่าง/);assert.ok(!root.textContent.includes('เหตุผลจากแอดมิน'));
 mountShopStatus(root,{name:'เปิดร้าน',published:1,moderation_status:'active'},()=>{});assert.equal(root.hidden,true);assert.equal(root.textContent,'');
 mountShopStatus(root,null,()=>{});assert.equal(root.hidden,true);
 delete globalThis.document;dom.window.close();
});
