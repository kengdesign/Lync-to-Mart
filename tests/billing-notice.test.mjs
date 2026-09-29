import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {billingNotice,mountBillingNotice} from '../public/billing-notice.js';
const clock=1800000000,base={ready:true,eligible:true,subscription:{status:'active',paid_until:clock+30*86400,updated_at:clock}};
test('normal, free, unavailable and ineligible accounts have no unnecessary notice',()=>{
 assert.equal(billingNotice(base,clock),null);assert.equal(billingNotice({...base,subscription:null},clock),null);assert.equal(billingNotice({...base,ready:false,upgrade:{status:'review'}},clock),null);assert.equal(billingNotice({...base,eligible:false},clock),null);
});
test('expiry warning applies only to canceled renewal in the last seven days; expired data asks for verification',()=>{
 const sub={status:'active',cancel_at_period_end:true,paid_until:clock+7*86400};assert.match(billingNotice({...base,subscription:sub},clock).title,/ใกล้สิ้นสุด/);
 assert.equal(billingNotice({...base,subscription:{...sub,paid_until:sub.paid_until+1}},clock),null);assert.equal(billingNotice({...base,subscription:{...sub,cancel_at_period_end:false}},clock),null);
 assert.match(billingNotice({...base,subscription:{...sub,paid_until:clock}},clock).text,/ยืนยันการต่ออายุ/);
});
test('review and failed payment take priority; card and downgrade notices retain clear actions',()=>{
 assert.match(billingNotice({...base,upgrade:{status:'review'},subscription:{status:'past_due'}},clock).title,/ผู้ดูแล/);
 assert.match(billingNotice({...base,subscription:{status:'past_due'}},clock).title,/ปัญหาการชำระเงิน/);
 assert.match(billingNotice({...base,card_update:{status:'pending'}},clock).title,/บัตร/);
 assert.match(billingNotice({...base,downgrade:{status:'scheduled',plan:'growth',effective_at:clock+86400}},clock).text,/Growth/);
});
test('mount skips impersonation, escapes content, navigates without mutations and ignores detached responses',async()=>{
 const doc=new JSDOM('<section></section>').window.document,root=doc.querySelector('section');let calls=0,managed=0;const api=async()=>{calls++;return {...base,downgrade:{status:'scheduled',plan:'<img src=x>',effective_at:clock}};};
 await mountBillingNotice({root,api,impersonation:true});assert.equal(calls,0);assert.equal(root.hidden,true);
 await mountBillingNotice({root,api,onManage:()=>managed++});assert.equal(root.querySelector('img'),null);root.querySelector('button').click();assert.equal(managed,1);assert.equal(calls,1);
 const detached=doc.createElement('section');await mountBillingNotice({root:detached,api});assert.equal(detached.hidden,true);
});
test('read failure leaves an actionable notice instead of breaking overview',async()=>{
 const root=new JSDOM('<section></section>').window.document.querySelector('section');await mountBillingNotice({root,api:async()=>{throw Error('offline');},onManage:()=>{}});assert.equal(root.hidden,false);assert.match(root.textContent,/ยังโหลดสถานะสมาชิกไม่ได้/);
});
