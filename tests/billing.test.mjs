import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../scripts/adapter.mjs';
import {hash} from '../src/security.mjs';
import {billingReady,checkout,refreshBilling,cancelRenewal,verifySignature,amounts} from '../src/billing.mjs';
import {effectivePlan} from '../src/plans.mjs';
import worker from '../src/worker.mjs';
const now=()=>Math.floor(Date.now()/1000);
async function fixture(t){
 const DB=database(),env={DB,APP_ENV:'staging',BILLING_ENABLED:'true',STRIPE_SECRET_KEY:'rk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',STRIPE_VAT_RATE_ID:'txr_vat',STRIPE_TEST_EMAILS:'u@example.test'},user={id:'u',email:'u@example.test',plan_id:'free'};
 for(const plan of Object.keys(amounts))for(const period of ['monthly','yearly'])env[`STRIPE_PRICE_${plan.toUpperCase()}_${period.toUpperCase()}`]=`price_${plan}_${period}`;
 await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(user.id,user.email,'hash','free').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash('token'),'u',now()+3600).run();
 t.after(()=>DB.close());
 let subscriptions=[],sessions={},calls=[],tax={active:true,inclusive:true,percentage:7,livemode:false},priceOverride={},failSession=false;
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 const price=id=>{const [,plan,period]=id.split('_');return {id,active:true,livemode:false,currency:'thb',unit_amount:amounts[plan][period],tax_behavior:'inclusive',recurring:{interval:period==='monthly'?'month':'year',interval_count:1},...priceOverride};};
 globalThis.fetch=async(url,opts)=>{
 const parsed=new URL(url),path=parsed.pathname.replace('/v1/',''),values=opts.body?Object.fromEntries(new URLSearchParams(opts.body)):null;
 assert.equal(parsed.hostname,'api.stripe.com');calls.push({path,values,key:opts.headers['Idempotency-Key']});let data;
 if(path.startsWith('prices/'))data=price(path.slice(7));
 else if(path.startsWith('tax_rates/'))data=tax;
 else if(path==='customers')data={id:'cus_u',livemode:false};
 else if(path==='subscriptions')data={data:subscriptions,has_more:false};
 else if(path==='checkout/sessions'){
 let session=Object.values(sessions).find(x=>x.key===opts.headers['Idempotency-Key']);if(!session){session={id:'cs_test_'+(Object.keys(sessions).length+1),url:'https://checkout.stripe.com/c/pay/test',status:'open',livemode:false,key:opts.headers['Idempotency-Key'],values};sessions[session.id]=session;}if(failSession){failSession=false;throw Error('lost response');}data=session;
 }else if(path.endsWith('/expire')){data=sessions[path.split('/')[2]];data.status='expired';}
 else if(path.startsWith('checkout/sessions/'))data=sessions[path.split('/')[2]];
 else if(path.startsWith('subscriptions/')){data=subscriptions.find(s=>s.id===path.split('/')[1]);data.cancel_at_period_end=values.cancel_at_period_end==='true';}
 else throw Error('Unexpected '+path);
 return Response.json(data);
 };
 const sub=(extra={})=>({id:'sub_u',customer:'cus_u',livemode:false,status:'active',created:now(),metadata:{app:'lync-to-mart',user_id:'u'},items:{data:[{quantity:1,price:price('price_starter_monthly'),current_period_end:now()+86400}]},latest_invoice:{status:'paid',customer:'cus_u'},cancel_at_period_end:false,...extra});
 return {DB,env,user,price,sub,calls,sessions,setSubs:s=>subscriptions=s,setTax:v=>tax={...tax,...v},setPrice:v=>priceOverride=v,loseResponse:()=>failSession=true};
}
async function signature(raw,secret,t=now()){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(t+'.'+raw));return `t=${t},v1=${Buffer.from(bytes).toString('hex')}`;
}
async function webhook(env,event,header){const raw=JSON.stringify(event);return worker.fetch(new Request('https://mart.test/api/billing/webhook',{method:'POST',headers:{'stripe-signature':header||await signature(raw,env.STRIPE_WEBHOOK_SECRET)},body:raw}),env,{});}
const event=(id,extra={})=>({id,type:'invoice.paid',livemode:false,data:{object:{customer:'cus_u'}},...extra});
test('Checkout is sandbox-only, validates price/tax, ignores client amount and reuses open session',async t=>{
 const f=await fixture(t),{env,user,DB}=f;assert.equal(billingReady(env),true);assert.equal(billingReady({...env,APP_ENV:'production'}),false);assert.equal(billingReady({...env,STRIPE_SECRET_KEY:'sk_live_no'}),false);
 await assert.rejects(checkout(env,{...user,email:'other@example.test'},{plan:'starter',period:'monthly'},'https://mart.test'),e=>e.status===403);
 await assert.rejects(checkout(env,user,{plan:'owner',period:'monthly'},'https://mart.test'),e=>e.status===400);
 f.setTax({inclusive:false});await assert.rejects(checkout(env,user,{plan:'starter',period:'monthly'},'https://mart.test'),e=>e.status===503);f.setTax({inclusive:true});
 f.setPrice({unit_amount:1});await assert.rejects(checkout(env,user,{plan:'starter',period:'monthly'},'https://mart.test'),e=>e.status===503);f.setPrice({tax_behavior:'unspecified',unit_amount:19900});await assert.rejects(checkout(env,user,{plan:'starter',period:'monthly'},'https://mart.test'),e=>e.status===503&&e.message.includes('Include tax in price'));f.setPrice({});
 const input={plan:'starter',period:'monthly',amount:1,price:'price_fake'};await checkout(env,user,input,'https://mart.test');await checkout(env,user,input,'https://mart.test');
 assert.equal(f.calls.filter(c=>c.path==='checkout/sessions').length,1);
 const params=f.calls.find(c=>c.path==='checkout/sessions').values;assert.equal(params['line_items[0][price]'],'price_starter_monthly');assert.equal(params['subscription_data[default_tax_rates][0]'],'txr_vat');assert.equal(params.payment_method_types,undefined);assert.equal(params.success_url,'https://mart.test/?billing=success');assert.equal((await DB.prepare('SELECT plan_id FROM users').first()).plan_id,'free');
 await checkout(env,user,{plan:'brand',period:'yearly'},'https://mart.test');assert.equal(f.sessions.cs_test_1.status,'expired');assert.equal(f.calls.filter(c=>c.path==='checkout/sessions').length,2);
});
test('lost Checkout response recovers with same key and concurrent attempts cannot duplicate subscriptions',async t=>{
 const f=await fixture(t),{env,user}=f;f.loseResponse();await assert.rejects(checkout(env,user,{plan:'starter',period:'monthly'},'https://mart.test'),e=>e.status===502);
 await assert.rejects(checkout(env,user,{plan:'brand',period:'yearly'},'https://mart.test'),e=>e.status===409);
 await checkout(env,user,{plan:'starter',period:'monthly'},'https://mart.test');const requests=f.calls.filter(c=>c.path==='checkout/sessions');assert.equal(requests[0].key,requests[1].key);assert.deepEqual(requests[0].values,requests[1].values);assert.equal(Object.keys(f.sessions).length,1);
 await f.DB.prepare('UPDATE billing_accounts SET lock_until=?').bind(now()+100).run();await assert.rejects(checkout(env,user,{plan:'starter',period:'monthly'},'https://mart.test'),e=>e.status===409);
});
test('signed webhooks reconcile current state, deduplicate, isolate customers and preserve promotions',async t=>{
 const f=await fixture(t),{env,user,DB}=f;await checkout(env,user,{plan:'starter',period:'monthly'},'https://mart.test');f.setSubs([f.sub()]);
 assert.equal((await webhook(env,event('evt_bad'),'t=1,v1=bad')).status,400);assert.equal((await DB.prepare('SELECT plan_id FROM users').first()).plan_id,'free');
 assert.equal((await webhook(env,event('evt_live',{livemode:true}))).status,400);
 assert.equal((await webhook(env,event('evt_1'))).status,200);assert.equal((await DB.prepare('SELECT plan_id FROM users').first()).plan_id,'starter');
 const n=f.calls.length;assert.equal((await webhook(env,event('evt_1'))).status,200);assert.equal(f.calls.length,n);
 await DB.prepare("INSERT INTO member_controls(user_id,override_plan) VALUES('u','brand')").run();assert.equal((await effectivePlan(env,user)).id,'brand');
 f.setSubs([f.sub({status:'canceled'})]);assert.equal((await webhook(env,event('evt_old_paid'))).status,200);assert.equal((await DB.prepare('SELECT plan_id FROM users').first()).plan_id,'free');assert.equal((await effectivePlan(env,user)).id,'brand');
 assert.equal((await webhook(env,event('evt_foreign',{data:{object:{customer:'cus_other'}}}))).status,200);assert.equal((await DB.prepare('SELECT count(*) n FROM billing_events').first()).n,2);
});
test('paid access expires safely; renewal cancellation preserves paid term; failures revoke access',async t=>{
 const f=await fixture(t),{env,user,DB}=f;await checkout(env,user,{plan:'starter',period:'monthly'},'https://mart.test');f.setSubs([f.sub()]);await refreshBilling(env,user);assert.equal((await effectivePlan(env,user)).id,'starter');
 await assert.rejects(checkout(env,user,{plan:'brand',period:'monthly'},'https://mart.test'),e=>e.status===409);
 const canceled=await cancelRenewal(env,user,{cancel:true});assert.equal(canceled.subscription.cancel_at_period_end,true);assert.equal((await effectivePlan(env,user)).id,'starter');await cancelRenewal(env,user,{cancel:false});
 await DB.prepare('UPDATE billing_accounts SET paid_until=?').bind(now()-1).run();assert.equal((await effectivePlan(env,user)).id,'free');
 f.setSubs([f.sub({status:'past_due',latest_invoice:{status:'open',customer:'cus_u'}})]);await refreshBilling(env,user);assert.equal((await effectivePlan(env,user)).id,'free');
 f.setSubs([f.sub({latest_invoice:{status:'open',customer:'cus_u'}})]);await refreshBilling(env,user);assert.equal((await effectivePlan(env,user)).id,'free');
 f.setSubs([f.sub({status:'canceled'})]);f.sessions.cs_test_1.status='complete';await checkout(env,user,{plan:'brand',period:'yearly'},'https://mart.test');assert.equal(Object.keys(f.sessions).length,2);
});
test('webhook retry after network failure, signature tampering and origin/session protections',async t=>{
 const f=await fixture(t),{env,user,DB}=f;await checkout(env,user,{plan:'starter',period:'monthly'},'https://mart.test');const fetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('network');};assert.equal((await webhook(env,event('evt_retry'))).status,502);assert.equal(await DB.prepare("SELECT id FROM billing_events WHERE id='evt_retry'").first(),null);globalThis.fetch=fetch;f.setSubs([f.sub()]);assert.equal((await webhook(env,event('evt_retry'))).status,200);
 const raw='{"ok":true}';const sig=await signature(raw,'secret');assert.equal(await verifySignature(raw,sig,'secret'),true);assert.equal(await verifySignature(raw+' ',sig,'secret'),false);assert.equal(await verifySignature(raw,await signature(raw,'secret',now()-301),'secret'),false);
 const req=(headers={})=>new Request('https://mart.test/api/billing/checkout',{method:'POST',headers,body:JSON.stringify({plan:'starter',period:'monthly'})});assert.equal((await worker.fetch(req(),env,{})).status,403);assert.equal((await worker.fetch(req({Origin:'https://mart.test'}),env,{})).status,401);assert.equal((await worker.fetch(req({Origin:'https://evil.test',Cookie:'mart_session=token'}),env,{})).status,403);assert.equal((await worker.fetch(req({Origin:'https://mart.test',Cookie:'mart_session=token; mart_swap=swap'}),env,{})).status,403);
});
