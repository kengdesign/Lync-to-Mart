import test from 'node:test';import assert from 'node:assert/strict';
import {database} from '../scripts/adapter.mjs';import {amounts,startCardUpdate,cancelCardUpdate,refreshBilling,previewDowngrade} from '../src/billing.mjs';
const now=()=>Math.floor(Date.now()/1000);
async function fixture(t){
 const DB=database(),user={id:'u',email:'u@test.example'},env={DB,APP_ENV:'staging',BILLING_ENABLED:'true',STRIPE_SECRET_KEY:'rk_test_fixture',STRIPE_WEBHOOK_SECRET:'secret',STRIPE_VAT_RATE_ID:'txr_vat',STRIPE_TEST_EMAILS:user.email,RECOVERY_ORIGIN:'https://mart.test'};
 for(const p of Object.keys(amounts))for(const period of ['monthly','yearly'])env[`STRIPE_PRICE_${p.toUpperCase()}_${period.toUpperCase()}`]=`price_${p}_${period}`;
 await DB.prepare("INSERT INTO users VALUES('u',?,'hash','brand')").bind(user.email).run();await DB.prepare("INSERT INTO billing_accounts(user_id,customer_id,subscription_id,status,plan_id,period) VALUES('u','cus_u','sub_u','active','brand','monthly')").run();
 const sub={id:'sub_u',customer:'cus_u',livemode:false,status:'active',metadata:{app:'lync-to-mart',user_id:'u'},default_payment_method:'pm_old',cancel_at_period_end:true,items:{data:[{id:'si_u',quantity:1,current_period_start:now()-86400,current_period_end:now()+864000,price:{id:'price_brand_monthly',currency:'thb',unit_amount:99000,recurring:{interval:'month',interval_count:1},tax_behavior:'inclusive',livemode:false}}]},latest_invoice:{status:'paid',customer:'cus_u'}};
 let session=null,intent=null,lose='',calls=[];const old=globalThis.fetch;t.after(()=>{globalThis.fetch=old;DB.close();});
 globalThis.fetch=async(url,opts)=>{
  const path=new URL(url).pathname.replace('/v1/',''),v=opts.body?Object.fromEntries(new URLSearchParams(opts.body)):null;calls.push({path,v,key:opts.headers['Idempotency-Key']});let data;
  if(path==='subscriptions')data={data:[sub],has_more:false};
  else if(path==='subscriptions/sub_u'){if(v){assert.deepEqual(v,{default_payment_method:'pm_new'});sub.default_payment_method=v.default_payment_method;if(lose==='apply'){lose='';throw Error('lost response');}}data=sub;}
  else if(path==='checkout/sessions'){
   assert.equal(v.mode,'setup');assert.equal(v['payment_method_types[0]'],'card');assert.equal(v['line_items[0][price]'],undefined);assert.equal(v.success_url,'https://mart.test/?billing=card-return');
   if(!session){session={id:'cs_test_card',livemode:false,mode:'setup',customer:'cus_u',client_reference_id:'u',metadata:{mart_card_id:v['metadata[mart_card_id]']},status:'open',url:'https://checkout.stripe.com/c/pay/card',setup_intent:'seti_card'};intent={id:'seti_card',livemode:false,status:'succeeded',customer:'cus_u',metadata:{mart_card_id:v['setup_intent_data[metadata][mart_card_id]'],subscription_id:'sub_u'},payment_method:{id:'pm_new',customer:'cus_u',livemode:false,type:'card'}};}
   if(lose==='create'){lose='';throw Error('lost response');}data=session;
  }else if(path==='checkout/sessions/cs_test_card')data=session;
  else if(path==='checkout/sessions/cs_test_card/expire'){session.status='expired';data=session;}
  else if(path==='setup_intents/seti_card')data=intent;
  else throw Error('Unexpected '+path);
  return Response.json(data);
 };
 return {env,user,DB,sub,calls,lose:s=>lose=s,get session(){return session;},get intent(){return intent;}};
}
test('setup saves only verified card, preserves plan/term/cancel and applies once',async t=>{
 const f=await fixture(t),term=f.sub.items.data[0].current_period_end;
 const start=await startCardUpdate(f.env,f.user,'https://untrusted.test');assert.match(start.url,/checkout.stripe.com/);assert.equal(f.sub.default_payment_method,'pm_old');
 await startCardUpdate(f.env,f.user,'https://mart.test');assert.equal(f.calls.filter(c=>c.path==='checkout/sessions').length,1);
 await assert.rejects(previewDowngrade(f.env,f.user,{plan:'growth'}),e=>e.status===409);
 f.session.status='complete';let status=await refreshBilling(f.env,f.user);assert.equal(status.card_update.status,'applied');assert.equal(f.sub.default_payment_method,'pm_new');assert.equal(f.sub.cancel_at_period_end,true);assert.equal(f.sub.items.data[0].current_period_end,term);assert.equal(status.subscription.plan,'brand');
 await refreshBilling(f.env,f.user);assert.equal(f.calls.filter(c=>c.path==='subscriptions/sub_u'&&c.v).length,1);
});
test('lost create/apply responses recover without duplicate sessions or subscription mutations',async t=>{
 for(const stage of ['create','apply'])await t.test(stage,async t=>{
  const f=await fixture(t);
  if(stage==='create'){f.lose(stage);await assert.rejects(startCardUpdate(f.env,f.user,'https://mart.test'));await startCardUpdate(f.env,f.user,'https://mart.test');const keys=f.calls.filter(c=>c.path==='checkout/sessions').map(c=>c.key);assert.equal(new Set(keys).size,1);}
  else{await startCardUpdate(f.env,f.user,'https://mart.test');f.session.status='complete';f.lose(stage);await assert.rejects(refreshBilling(f.env,f.user));await refreshBilling(f.env,f.user);assert.equal(f.calls.filter(c=>c.path==='subscriptions/sub_u'&&c.v).length,1);}
 });
});
test('abandoning an open setup expires session and retains original card',async t=>{
 const f=await fixture(t);await startCardUpdate(f.env,f.user,'https://mart.test');await cancelCardUpdate(f.env,f.user);assert.equal(f.session.status,'expired');assert.equal(f.sub.default_payment_method,'pm_old');assert.equal((await refreshBilling(f.env,f.user)).card_update.status,'canceled');
});
test('foreign payment methods, unsuccessful setup and conflicting schedule require review without applying',async t=>{
 for(const reason of ['foreign','failed','schedule'])await t.test(reason,async t=>{
  const f=await fixture(t);await startCardUpdate(f.env,f.user,'https://mart.test');f.session.status='complete';
  if(reason==='foreign')f.intent.payment_method.customer='cus_other';if(reason==='failed')f.intent.status='requires_payment_method';if(reason==='schedule')f.sub.schedule='sub_sched_external';
  const result=await refreshBilling(f.env,f.user);assert.equal(result.card_update.status,'review');assert.equal(f.sub.default_payment_method,'pm_old');assert.equal(f.calls.some(c=>c.path==='subscriptions/sub_u'&&c.v),false);
 });
});
test('blocked users and production cannot create card setup',async t=>{
 const f=await fixture(t);await assert.rejects(startCardUpdate(f.env,{...f.user,email:'other@test.example'},'https://mart.test'),e=>e.status===403);await assert.rejects(startCardUpdate({...f.env,APP_ENV:'production'},f.user,'https://mart.test'),e=>e.status===503);assert.equal(f.calls.length,0);
});
