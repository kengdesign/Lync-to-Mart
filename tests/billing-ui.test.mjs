import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {mountBilling} from '../public/billing.js';
test('billing panel hides checkout until configured, quotes selected term, and shows paid subscription separately',async t=>{
 const dom=new JSDOM('<section id="billing"></section>',{url:'https://mart.test/?billing=success'});globalThis.location=dom.window.location;t.after(()=>delete globalThis.location);const root=dom.window.document.querySelector('section');
 await mountBilling({root,api:async()=>({ready:false,eligible:true})});assert.equal(root.querySelector('[data-checkout]'),null);assert.match(root.textContent,/ระบบชำระเงินยังไม่พร้อม/);
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
 assert.match(root.textContent,/ยังไม่มีแพ็กเกจที่ชำระเงิน/);assert.equal(root.querySelector('[data-renewal]'),null);
 const button=root.querySelector('[data-checkout]');button.click();assert.equal(button.disabled,true);assert.match(root.querySelector('[data-billing-message]').textContent,/กำลังตรวจสอบ/);
 reject(Error('Price ยังไม่ได้ตั้งรวมภาษี'));await new Promise(r=>setTimeout(r,0));assert.equal(button.disabled,false);assert.match(root.querySelector('[data-billing-message]').textContent,/Price/);assert.equal(dom.window.document.activeElement,root.querySelector('[data-billing-message]'));
});
test('upgrade preview quotes exact difference, preserves cancellation and requires confirmation before payment',async t=>{
 const dom=new JSDOM('<section></section>',{url:'https://mart.test/'});globalThis.location=dom.window.location;t.after(()=>delete globalThis.location);
 const root=dom.window.document.querySelector('section'),calls=[];
 const items=[{id:'starter',monthly:19900},{id:'growth',monthly:49900},{id:'brand',monthly:99000}];
 const quote={from:'starter',plan:'growth',period:'monthly',pricing_mode:'difference',discount_deadline:Math.floor(Date.now()/1000)+3600,amount:30000,next_amount:49900,period_end:Math.floor(Date.now()/1000)+86400,cancel_at_period_end:true};
 await mountBilling({root,items,api:async()=>({ready:true,eligible:true,subscription:{status:'active',plan:'starter',period:'monthly',paid_until:quote.period_end,cancel_at_period_end:true}}),send:async(path,input)=>{calls.push({path,input});if(path==='/billing/upgrade-preview')return quote;throw Error('stop before redirect');}});
 assert.equal(root.querySelector('[data-upgrade-plan]').options.length,2);assert.match(root.querySelector('[data-upgrade-plan]').textContent,/Growth/);assert.match(root.querySelector('[data-upgrade-plan]').textContent,/Brand/);assert.equal(root.querySelector('[data-upgrade-confirm]'),null);
 root.querySelector('[data-upgrade-preview]').click();await new Promise(r=>setTimeout(r,0));assert.equal(calls.length,1);assert.equal(root.querySelector('[data-upgrade-renewal]').value,'keep');assert.match(root.querySelector('[data-upgrade-quote]').textContent,/ไม่เริ่มรอบใหม่/);
 root.querySelector('[data-upgrade-confirm]').click();await new Promise(r=>setTimeout(r,0));assert.deepEqual(calls[1],{path:'/billing/upgrade',input:{plan:'growth',from:'starter',amount:30000,period:'monthly',pricing_mode:'difference',period_end:quote.period_end,expected_cancel:true,keep_cancelled:true}});assert.equal(root.querySelector('[data-upgrade-confirm]').disabled,false);
 root.querySelector('[data-upgrade-renewal]').value='resume';root.querySelector('[data-upgrade-confirm]').click();await new Promise(r=>setTimeout(r,0));assert.equal(calls[2].input.keep_cancelled,false);
 root.querySelector('[data-upgrade-plan]').dispatchEvent(new dom.window.Event('change'));assert.equal(root.querySelector('[data-upgrade-confirm]'),null);
});
test('pending upgrade exposes resume and abandon; hides renewal changes and new checkout',async t=>{
 const dom=new JSDOM('<section></section>',{url:'https://mart.test/'});globalThis.location=dom.window.location;t.after(()=>delete globalThis.location);const root=dom.window.document.querySelector('section');
 const data={ready:true,eligible:true,subscription:{status:'active',plan:'starter',period:'monthly'},upgrade:{plan:'growth',amount:30000,status:'pending',cancel_at_period_end:true}};
 await mountBilling({root,api:async()=>data});assert.ok(root.querySelector('[data-upgrade-resume]'));assert.ok(root.querySelector('[data-upgrade-abandon]'));assert.equal(root.querySelector('[data-renewal]'),null);assert.equal(root.querySelector('[data-checkout]'),null);
 data.upgrade.status='review';await mountBilling({root,api:async()=>data});assert.equal(root.querySelector('[data-upgrade-resume]'),null);assert.match(root.textContent,/อย่าชำระซ้ำ/);
});
test('annual full-price confirmation clearly announces a new year instead of the old expiry',async t=>{
 const dom=new JSDOM('<section></section>',{url:'https://mart.test/'});globalThis.location=dom.window.location;t.after(()=>delete globalThis.location);const root=dom.window.document.querySelector('section');
 const quote={from:'starter',plan:'growth',period:'yearly',pricing_mode:'full',amount:499000,next_amount:499000,period_end:Math.floor(Date.now()/1000)+100000,discount_deadline:Math.floor(Date.now()/1000)-1000,cancel_at_period_end:false};
 await mountBilling({root,items:[{id:'starter',yearly:199000},{id:'growth',yearly:499000},{id:'brand',yearly:990000}],api:async()=>({ready:true,eligible:true,subscription:{status:'active',plan:'starter',period:'yearly'}}),send:async()=>quote});
 root.querySelector('[data-upgrade-preview]').click();await new Promise(r=>setTimeout(r,0));const text=root.querySelector('[data-upgrade-quote]').textContent;assert.match(text,/ชำระวันนี้ \(ราคาเต็ม\) ฿4,990/);assert.match(text,/เริ่มรอบใหม่เต็ม 1 ปี/);assert.match(text,/ไม่.*ทบเวลาคงเหลือ/);assert.doesNotMatch(text,/ไม่เริ่มรอบใหม่/);
});
test('Growth to Brand separates 491 due today from optional 990 next renewal',async t=>{
 const dom=new JSDOM('<section></section>',{url:'https://mart.test/'});globalThis.location=dom.window.location;t.after(()=>delete globalThis.location);const root=dom.window.document.querySelector('section');
 const quote={from:'growth',plan:'brand',period:'monthly',pricing_mode:'difference',amount:49100,next_amount:99000,period_end:1793192614,discount_deadline:1791896614,cancel_at_period_end:true};
 await mountBilling({root,items:[{id:'growth',monthly:49900},{id:'brand',monthly:99000}],api:async()=>({ready:true,eligible:true,subscription:{status:'active',plan:'growth',period:'monthly',cancel_at_period_end:true}}),send:async()=>quote});
 root.querySelector('[data-upgrade-preview]').click();await new Promise(r=>setTimeout(r,0));
 const summary=root.querySelector('[data-upgrade-renewal-summary]'),selection=root.querySelector('[data-upgrade-renewal]');assert.match(summary.textContent,/ไม่มีการเรียกเก็บรอบถัดไป/);
 selection.value='resume';selection.dispatchEvent(new dom.window.Event('change'));
 assert.match(summary.textContent,/ยอดชำระวันนี้ ฿491/);assert.match(summary.textContent,/รอบถัดไป: วันที่/);assert.match(summary.textContent,/เรียกเก็บ ฿990/);assert.match(root.querySelector('[data-upgrade-confirm]').textContent,/ชำระวันนี้ ฿491/);
 selection.value='keep';selection.dispatchEvent(new dom.window.Event('change'));assert.doesNotMatch(summary.textContent,/เรียกเก็บ ฿990/);assert.match(summary.textContent,/กลับ Free/);
});
test('downgrade confirms next-period price, preserves current plan and exposes cancel request',async t=>{
 const dom=new JSDOM('<section></section>',{url:'https://mart.test/'});globalThis.location=dom.window.location;t.after(()=>delete globalThis.location);const root=dom.window.document.querySelector('section'),calls=[];
 const quote={from:'brand',plan:'growth',period:'monthly',amount:49900,effective_at:1793192614};
 let data={ready:true,eligible:true,subscription:{status:'active',plan:'brand',period:'monthly',paid_until:quote.effective_at,cancel_at_period_end:false}};
 await mountBilling({root,items:[{id:'starter',monthly:19900},{id:'growth',monthly:49900},{id:'brand',monthly:99000}],api:async()=>data,send:async(path,input)=>{calls.push({path,input});if(path==='/billing/downgrade-preview')return quote;data={...data,downgrade:{...quote,status:'scheduled'}};return data;}});
 root.querySelector('[data-downgrade-preview]').click();await new Promise(r=>setTimeout(r,0));assert.equal(calls.length,1);assert.match(root.querySelector('[data-downgrade-quote]').textContent,/วันนี้ไม่เรียกเก็บเงินเพิ่ม/);assert.match(root.querySelector('[data-downgrade-quote]').textContent,/฿499/);
 root.querySelector('[data-downgrade-confirm]').click();await new Promise(r=>setTimeout(r,0));assert.equal(calls[1].path,'/billing/downgrade');assert.deepEqual(calls[1].input,quote);assert.ok(root.querySelector('[data-downgrade-cancel]'));assert.equal(root.querySelector('[data-renewal]'),null);assert.equal(root.querySelector('[data-upgrade-preview]'),null);assert.match(root.textContent,/ยืนยันการชำระเงินแล้ว · Brand/);
});
test('canceled renewal must be resumed explicitly before scheduling a paid downgrade',async t=>{
 const dom=new JSDOM('<section></section>',{url:'https://mart.test/'});globalThis.location=dom.window.location;t.after(()=>delete globalThis.location);const root=dom.window.document.querySelector('section');
 await mountBilling({root,items:[{id:'growth',monthly:49900},{id:'brand',monthly:99000}],api:async()=>({ready:true,eligible:true,subscription:{status:'active',plan:'brand',period:'monthly',cancel_at_period_end:true}})});
 assert.equal(root.querySelector('[data-downgrade-preview]'),null);assert.match(root.querySelector('.billing-downgrade').textContent,/เปิดต่ออายุอัตโนมัติก่อน/);assert.ok(root.querySelector('[data-renewal]'));
});

test('card setup panel resumes pending setup and never treats a return URL as success',async t=>{
 const dom=new JSDOM('<section></section>',{url:'https://mart.test/?billing=card-return'});globalThis.location=dom.window.location;t.after(()=>delete globalThis.location);const root=dom.window.document.querySelector('section');
 const data={ready:true,eligible:true,subscription:{status:'active',plan:'brand',period:'monthly'},card_update:{status:'pending'}};
 await mountBilling({root,api:async()=>data});assert.match(root.querySelector('[data-card-update]').textContent,/กลับไปบันทึกบัตร/);assert.ok(root.querySelector('[data-card-cancel]'));assert.match(root.querySelector('[data-billing-message]').textContent,/ยังไม่ยืนยันว่าเปลี่ยนบัตรสำเร็จ/);
 data.card_update.status='review';await mountBilling({root,api:async()=>data});assert.equal(root.querySelector('[data-card-update]'),null);assert.match(root.textContent,/รายการเปลี่ยนบัตรต้องให้ผู้ดูแลตรวจสอบ/);
 data.card_update=null;data.downgrade={status:'scheduled',plan:'growth',effective_at:1800000000,amount:49900,period:'monthly'};await mountBilling({root,api:async()=>data});assert.equal(root.querySelector('[data-card-update]'),null);
});

test('confirmed paid return shows current entitlement and cancellation without payment prompt',async t=>{
 const dom=new JSDOM('<section></section>',{url:'https://mart.test/?billing=success'});globalThis.location=dom.window.location;t.after(()=>delete globalThis.location);
 const root=dom.window.document.querySelector('section');
 await mountBilling({root,currentPlan:{id:'free'},api:async()=>({ready:true,eligible:true,mode:'live',effective_plan:{id:'starter',name:'Starter',promotion_plan:'free'},subscription:{status:'active',plan:'starter',period:'monthly',paid_until:Math.floor(Date.now()/1000)+86400,cancel_at_period_end:true}})});
 assert.match(root.querySelector('h2').textContent,/Starter/);
 assert.match(root.textContent,/ยกเลิกการต่ออายุแล้ว/);
 assert.match(root.textContent,/ยังใช้แพ็กเกจที่ชำระได้จนจบรอบ/);
 assert.doesNotMatch(root.textContent,/พร้อมชำระเงิน|มีสิทธิ์โปรโมชั่น|กลับจาก Stripe แล้ว กรุณากด/);
 assert.equal(root.querySelector('[data-checkout]'),null);
 assert.match(root.querySelector('[data-billing-message]').textContent,/ไม่ต้องชำระซ้ำ/);
});
