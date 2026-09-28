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
test('checkout error is visible, clears stale messages and re-enables controls for retry',async t=>{
 const dom=new JSDOM('<section></section>',{url:'https://mart.test/'});globalThis.location=dom.window.location;t.after(()=>delete globalThis.location);
 const root=dom.window.document.querySelector('section');let reject;
 await mountBilling({root,currentPlan:{id:'free',name:'Free'},items:[{id:'starter',monthly:19900,yearly:199000}],api:async()=>({ready:true,eligible:true}),send:()=>new Promise((_,r)=>reject=r)});
 assert.match(root.textContent,/ยังไม่มีสมาชิกแบบชำระเงิน/);assert.equal(root.querySelector('[data-renewal]'),null);
 const button=root.querySelector('[data-checkout]');button.click();assert.equal(button.disabled,true);assert.match(root.querySelector('[data-billing-message]').textContent,/กำลังตรวจสอบ/);
 reject(Error('Price ยังไม่ได้ตั้งรวมภาษี'));await new Promise(r=>setTimeout(r,0));assert.equal(button.disabled,false);assert.match(root.querySelector('[data-billing-message]').textContent,/Price/);assert.equal(dom.window.document.activeElement,root.querySelector('[data-billing-message]'));
});
test('upgrade preview quotes exact difference, preserves cancellation and requires confirmation before payment',async t=>{
 const dom=new JSDOM('<section></section>',{url:'https://mart.test/'});globalThis.location=dom.window.location;t.after(()=>delete globalThis.location);
 const root=dom.window.document.querySelector('section'),calls=[];
 const items=[{id:'starter',monthly:19900},{id:'growth',monthly:49900},{id:'brand',monthly:99000}];
 const quote={from:'starter',plan:'growth',amount:30000,next_amount:49900,period_end:Math.floor(Date.now()/1000)+86400,cancel_at_period_end:true};
 await mountBilling({root,items,api:async()=>({ready:true,eligible:true,subscription:{status:'active',plan:'starter',period:'monthly',paid_until:quote.period_end,cancel_at_period_end:true}}),send:async(path,input)=>{calls.push({path,input});if(path==='/billing/upgrade-preview')return quote;throw Error('stop before redirect');}});
 assert.equal(root.querySelector('[data-upgrade-plan]').options.length,2);assert.match(root.querySelector('[data-upgrade-plan]').textContent,/300/);assert.match(root.querySelector('[data-upgrade-plan]').textContent,/791/);assert.equal(root.querySelector('[data-upgrade-confirm]'),null);
 root.querySelector('[data-upgrade-preview]').click();await new Promise(r=>setTimeout(r,0));assert.equal(calls.length,1);assert.equal(root.querySelector('[data-upgrade-renewal]').value,'keep');assert.match(root.querySelector('[data-upgrade-quote]').textContent,/ไม่เริ่มรอบใหม่/);
 root.querySelector('[data-upgrade-confirm]').click();await new Promise(r=>setTimeout(r,0));assert.deepEqual(calls[1],{path:'/billing/upgrade',input:{plan:'growth',from:'starter',amount:30000,period_end:quote.period_end,expected_cancel:true,keep_cancelled:true}});assert.equal(root.querySelector('[data-upgrade-confirm]').disabled,false);
 root.querySelector('[data-upgrade-renewal]').value='resume';root.querySelector('[data-upgrade-confirm]').click();await new Promise(r=>setTimeout(r,0));assert.equal(calls[2].input.keep_cancelled,false);
 root.querySelector('[data-upgrade-plan]').dispatchEvent(new dom.window.Event('change'));assert.equal(root.querySelector('[data-upgrade-confirm]'),null);
});
test('pending upgrade exposes resume and abandon; hides renewal changes and new checkout',async t=>{
 const dom=new JSDOM('<section></section>',{url:'https://mart.test/'});globalThis.location=dom.window.location;t.after(()=>delete globalThis.location);const root=dom.window.document.querySelector('section');
 const data={ready:true,eligible:true,subscription:{status:'active',plan:'starter',period:'monthly'},upgrade:{plan:'growth',amount:30000,status:'pending',cancel_at_period_end:true}};
 await mountBilling({root,api:async()=>data});assert.ok(root.querySelector('[data-upgrade-resume]'));assert.ok(root.querySelector('[data-upgrade-abandon]'));assert.equal(root.querySelector('[data-renewal]'),null);assert.equal(root.querySelector('[data-checkout]'),null);
 data.upgrade.status='review';await mountBilling({root,api:async()=>data});assert.equal(root.querySelector('[data-upgrade-resume]'),null);assert.match(root.textContent,/อย่าชำระซ้ำ/);
});
