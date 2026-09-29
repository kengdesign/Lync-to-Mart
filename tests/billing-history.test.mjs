import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
import {database} from '../scripts/adapter.mjs';import {billingHistory,amounts} from '../src/billing.mjs';import {mountBillingHistory} from '../public/billing-history.js';
import {hash} from '../src/security.mjs';import worker from '../src/worker.mjs';
async function fixture(t){
 const DB=database(),user={id:'u',email:'u@test.example'},env={DB,APP_ENV:'staging',BILLING_ENABLED:'true',STRIPE_SECRET_KEY:'rk_test_fixture',STRIPE_WEBHOOK_SECRET:'secret',STRIPE_VAT_RATE_ID:'txr_vat',STRIPE_TEST_EMAILS:user.email};
 for(const p of Object.keys(amounts))for(const period of ['monthly','yearly'])env[`STRIPE_PRICE_${p.toUpperCase()}_${period.toUpperCase()}`]='price_'+p+'_'+period;
 await DB.prepare("INSERT INTO users VALUES('u',?,'hash','brand')").bind(user.email).run();await DB.prepare("INSERT INTO users VALUES('other','other@test.example','hash','free')").run();
 await DB.prepare("INSERT INTO billing_accounts(user_id,customer_id) VALUES('u','cus_u')").run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash('token'),'u',Math.floor(Date.now()/1000)+3600).run();
 const invoice={id:'in_one',customer:'cus_u',livemode:false,number:'MART-001',created:1790000000,status:'paid',currency:'thb',total:99000,amount_paid:99000,amount_remaining:0,hosted_invoice_url:'https://invoice.stripe.com/i/test',invoice_pdf:'https://pay.stripe.com/invoice/test/pdf',customer_email:'private@test.example'};
 let data={data:[invoice],has_more:true};const calls=[],old=globalThis.fetch;t.after(()=>{globalThis.fetch=old;DB.close();});
 globalThis.fetch=async(url,opts)=>{const u=new URL(url);calls.push(u);assert.equal(opts.method,'GET');if(u.pathname==='/v1/invoices/in_one')return Response.json(invoice);return Response.json(data);};
 return {env,user,DB,invoice,calls,setData:d=>data=d};
}
test('history uses authenticated customer, bounded pagination, safe documents and no billing mutation',async t=>{
 const f=await fixture(t);const h=await billingHistory(f.env,f.user);assert.equal(h.invoices[0].total,99000);assert.equal(h.invoices[0].customer_email,undefined);assert.equal(h.next_cursor,'in_one');assert.equal(f.calls[0].searchParams.get('customer'),'cus_u');assert.equal(f.calls[0].searchParams.get('limit'),'20');
 await billingHistory(f.env,f.user,'in_one');assert.equal(f.calls.at(-1).searchParams.get('starting_after'),'in_one');
 f.invoice.hosted_invoice_url='https://invoice.stripe.com.evil.test/x';f.invoice.invoice_pdf='javascript:alert(1)';const bad=await billingHistory(f.env,f.user);assert.equal(bad.invoices[0].url,null);assert.equal(bad.invoices[0].pdf,null);
 assert.equal((await f.DB.prepare("SELECT plan_id FROM users WHERE id='u'").first()).plan_id,'brand');
});
test('history rejects foreign/live invoices and invalid cursors; empty account makes no Stripe request',async t=>{
 const f=await fixture(t);await assert.rejects(billingHistory(f.env,f.user,'in_one&customer=other'),e=>e.status===400);assert.equal(f.calls.length,0);
 f.invoice.customer='cus_other';await assert.rejects(billingHistory(f.env,f.user),e=>e.status===502);await assert.rejects(billingHistory(f.env,f.user,'in_one'),e=>e.status===502);
 f.invoice.customer='cus_u';f.invoice.livemode=true;await assert.rejects(billingHistory(f.env,f.user),e=>e.status===502);
 await assert.rejects(billingHistory(f.env,{id:'other',email:'other@test.example'}),e=>e.status===403);
 await f.DB.prepare("DELETE FROM billing_accounts WHERE user_id='u'").run();const count=f.calls.length;assert.deepEqual(await billingHistory(f.env,f.user),{invoices:[],upgrades:[],next_cursor:null});assert.equal(f.calls.length,count);
});
test('history route requires login, sends no-store and returns only applied upgrades for current user',async t=>{
 const f=await fixture(t);
 for(const [id,user,status] of [['mine','u','applied'],['pending','u','pending'],['foreign','other','applied']])await f.DB.prepare('INSERT INTO billing_upgrades(id,user_id,subscription_id,item_id,from_plan,to_plan,target_price,amount,period_end,cancel_at_period_end,session_params,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,user,'sub_u','si_u','growth','brand','price_brand_monthly',49100,1800000000,0,'{}',status,1790000000,1790000000).run();
 const request=cookie=>worker.fetch(new Request('https://mart.test/api/billing/history',{headers:cookie?{cookie}: {}}),f.env,{});
 assert.equal((await request()).status,401);const res=await request('mart_session=token');assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store');assert.deepEqual((await res.json()).upgrades.map(x=>x.id),['mine']);
});
test('history UI loads on demand, retries, escapes text and paginates without duplicating upgrades',async()=>{
 const dom=new JSDOM('<section></section>'),root=dom.window.document.querySelector('section');let calls=0,fail=true;const paths=[];
 mountBillingHistory({root,api:async path=>{calls++;paths.push(path);if(fail)throw Error('connection');return {invoices:[{id:'in_one',number:'<img src=x onerror=alert(1)>',created:1790000000,status:'paid',currency:'thb',total:99000,amount_paid:99000,amount_remaining:0,url:'https://invoice.stripe.com/i/test',pdf:'https://evil.test/pdf'}],upgrades:[],next_cursor:calls===2?'in_one':null};}});
 const click=async()=>{root.querySelector('button').click();await new Promise(r=>setTimeout(r,0));};assert.equal(calls,0);await click();assert.match(root.textContent,/โหลดประวัติไม่สำเร็จ/);assert.equal(root.querySelector('button').disabled,false);
 fail=false;await click();assert.equal(root.querySelector('img'),null);assert.equal(root.querySelectorAll('a').length,1);assert.equal(root.querySelector('a').rel,'noopener noreferrer');await click();assert.equal(paths.at(-1),'/billing/history?after=in_one');assert.equal(root.querySelector('button').hidden,true);assert.equal(root.querySelectorAll('[data-history-upgrades] h4').length,1);
});
