import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {mountBilling} from '../public/billing.js';
test('billing panel hides checkout until configured, quotes selected term, and shows paid subscription separately',async t=>{
 const dom=new JSDOM('<section id="billing"></section>',{url:'https://mart.test/?billing=success'});globalThis.location=dom.window.location;t.after(()=>delete globalThis.location);const root=dom.window.document.querySelector('section');
 await mountBilling({root,api:async()=>({ready:false,eligible:true})});assert.equal(root.querySelector('[data-checkout]'),null);assert.match(root.textContent,/ยังตั้งค่า Stripe ไม่ครบ/);
 await mountBilling({root,api:async()=>({ready:true,eligible:false})});assert.equal(root.querySelector('[data-checkout]'),null);
 const items=[{id:'starter',monthly:19900,yearly:199000},{id:'growth',monthly:49900,yearly:499000},{id:'brand',monthly:99000,yearly:990000}];
 await mountBilling({root,items,api:async()=>({ready:true,eligible:true})});assert.match(root.querySelector('[data-billing-total]').textContent,/199/);const period=root.querySelector('[data-billing-period]');period.value='yearly';period.dispatchEvent(new dom.window.Event('change'));assert.match(root.querySelector('[data-billing-total]').textContent,/1,990/);assert.match(root.textContent,/VAT 7%/);assert.match(root.querySelector('[data-billing-message]').textContent,/ตรวจสอบสถานะ/);
 await mountBilling({root,items,api:async()=>({ready:true,eligible:true,subscription:{status:'active',plan:'starter',period:'yearly',paid_until:Math.floor(Date.now()/1000)+1000,cancel_at_period_end:true}})});assert.equal(root.querySelector('[data-checkout]'),null);assert.match(root.querySelector('[data-renewal]').textContent,/เปิดต่ออายุ/);
 await mountBilling({root,impersonation:true,api:()=>{throw Error('must not request');}});assert.equal(root.querySelector('button'),null);
});
