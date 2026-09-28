import test from 'node:test';import assert from 'node:assert/strict';
import {database} from '../scripts/adapter.mjs';
import {amounts,previewDowngrade,scheduleDowngrade,cancelDowngrade,refreshBilling,cancelRenewal,previewUpgrade} from '../src/billing.mjs';
import {addBillingMonths} from '../src/billing-policy.mjs';
const now=()=>Math.floor(Date.now()/1000);
async function fixture(t,period='monthly'){
 const DB=database(),user={id:'u',email:'u@example.test'},env={DB,APP_ENV:'staging',BILLING_ENABLED:'true',STRIPE_SECRET_KEY:'rk_test_fixture',STRIPE_WEBHOOK_SECRET:'secret',STRIPE_VAT_RATE_ID:'txr_vat',STRIPE_TEST_EMAILS:user.email};
 for(const p of Object.keys(amounts))for(const per of ['monthly','yearly'])env[`STRIPE_PRICE_${p.toUpperCase()}_${per.toUpperCase()}`]=`price_${p}_${per}`;
 await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(user.id,user.email,'hash','brand').run();await DB.prepare("INSERT INTO billing_accounts(user_id,customer_id,subscription_id,status,plan_id,period) VALUES('u','cus_u','sub_u','active','brand',?)").bind(period).run();
 const price=id=>{const [,plan,per]=id.split('_');return {id,active:true,livemode:false,currency:'thb',tax_behavior:'inclusive',unit_amount:amounts[plan][per],recurring:{interval:per==='monthly'?'month':'year',interval_count:1}};};
 const sub={id:'sub_u',customer:'cus_u',livemode:false,status:'active',created:now(),metadata:{app:'lync-to-mart',user_id:'u'},items:{data:[{id:'si_u',quantity:1,price:price('price_brand_'+period),current_period_start:now()-86400,current_period_end:addBillingMonths(now(),period==='yearly'?12:1)}]},latest_invoice:{status:'paid',customer:'cus_u'},cancel_at_period_end:false,schedule:null};
 let sched=null,lose='',denied=false,calls=[],createCache=new Map();const old=globalThis.fetch;t.after(()=>{globalThis.fetch=old;DB.close();});
 globalThis.fetch=async(url,opts)=>{
  const path=new URL(url).pathname.replace('/v1/',''),v=opts.body?Object.fromEntries(new URLSearchParams(opts.body)):null,key=opts.headers['Idempotency-Key'];calls.push({path,v,key});let data;
  if(path==='subscriptions')data={data:[sub],has_more:false};else if(path==='subscriptions/sub_u'){data=sub;if(v)throw Error('must not mutate subscription for scheduling');}
  else if(path.startsWith('prices/'))data=price(path.slice(7));else if(path.startsWith('tax_rates/'))data={active:true,inclusive:true,percentage:7,livemode:false};
  else if(path==='subscription_schedules'){
   if(denied)return Response.json({error:{}},{status:403});
   assert.deepEqual(v,{from_subscription:'sub_u'});data=createCache.get(key);
   if(!data){assert.equal(sub.schedule,null);sched={id:'sub_sched_u',customer:'cus_u',subscription:'sub_u',livemode:false,status:'active',metadata:{},current_phase:{start_date:sub.items.data[0].current_period_start},phases:[],end_behavior:'release'};sub.schedule=sched.id;data=sched;createCache.set(key,sched);}
   if(lose==='create'){lose='';throw Error('lost create response');}
  }else if(path==='subscription_schedules/sub_sched_u'){
   data=sched;if(v){sched.metadata.mart_downgrade_id=v['metadata[mart_downgrade_id]'];sched.end_behavior=v.end_behavior;sched.phases=[0,1].map(i=>({start_date:Number(v[`phases[${i}][start_date]`]),end_date:Number(v[`phases[${i}][end_date]`]),items:[{price:v[`phases[${i}][items][0][price]`],quantity:Number(v[`phases[${i}][items][0][quantity]`])}]}));assert.equal(v.proration_behavior,'none');assert.equal(v['phases[0][proration_behavior]'],'none');assert.equal(v['phases[1][proration_behavior]'],'none');if(lose==='configure'){lose='';throw Error('lost configure response');}}
  }else if(path==='subscription_schedules/sub_sched_u/release'){
   sched.status='released';sched.released_subscription='sub_u';sched.subscription=null;sub.schedule=null;data=sched;if(lose==='release'){lose='';throw Error('lost release response');}
  }else throw Error('Unexpected request '+path);
  return Response.json(data);
 };
 const input=q=>({plan:q.plan,from:q.from,period:q.period,amount:q.amount,effective_at:q.effective_at});
 const transition=(paid=true)=>{const p=sched.phases[1];sub.items.data[0].price=price(p.items[0].price);sub.items.data[0].current_period_start=p.start_date;sub.items.data[0].current_period_end=p.end_date;sub.metadata.mart_downgrade_id=sched.metadata.mart_downgrade_id;sub.latest_invoice.status=paid?'paid':'open';sub.status=paid?'active':'past_due';};
 return {DB,env,user,sub,input,calls,transition,get schedule(){return sched;},lose:stage=>lose=stage,deny:v=>denied=v};
}
test('monthly/yearly downgrades preserve current rights and bill lower plan only at next period',async t=>{
 for(const period of ['monthly','yearly'])await t.test(period,async t=>{
  const f=await fixture(t,period),quote=await previewDowngrade(f.env,f.user,{plan:'growth'});assert.equal(quote.amount,amounts.growth[period]);await scheduleDowngrade(f.env,f.user,f.input(quote));
  let status=await refreshBilling(f.env,f.user);assert.equal(status.subscription.plan,'brand');assert.equal(status.downgrade.status,'scheduled');assert.equal(status.downgrade.effective_at,quote.effective_at);
  assert.equal(f.schedule.phases[0].items[0].price,'price_brand_'+period);assert.equal(f.schedule.phases[1].items[0].price,'price_growth_'+period);assert.equal(f.schedule.phases[1].start_date,quote.effective_at);assert.equal(f.calls.some(c=>c.path==='checkout/sessions'),false);
  f.transition();status=await refreshBilling(f.env,f.user);assert.equal(status.subscription.plan,'growth');assert.equal(status.downgrade,null);assert.equal(f.sub.schedule,null);assert.equal(f.sub.status,'active');
  await refreshBilling(f.env,f.user);assert.equal(f.calls.filter(c=>c.path.endsWith('/release')).length,1);
 });
});
test('cancel downgrade releases only the schedule, retaining old plan and renewal',async t=>{
 const f=await fixture(t),quote=await previewDowngrade(f.env,f.user,{plan:'starter'});await scheduleDowngrade(f.env,f.user,f.input(quote));
 await assert.rejects(cancelRenewal(f.env,f.user,{cancel:true}),e=>e.status===409);await assert.rejects(previewUpgrade(f.env,f.user,{plan:'growth'}),e=>e.status===409);
 await cancelDowngrade(f.env,f.user);const status=await refreshBilling(f.env,f.user);assert.equal(status.subscription.plan,'brand');assert.equal(status.subscription.cancel_at_period_end,false);assert.equal(status.downgrade,null);assert.equal(f.sub.status,'active');
});
test('creation and configuration response loss recover idempotently; release loss does not cancel membership',async t=>{
 for(const stage of ['create','configure','release'])await t.test(stage,async t=>{
  const f=await fixture(t),quote=await previewDowngrade(f.env,f.user,{plan:'growth'});
  if(stage!=='release'){f.lose(stage);await assert.rejects(scheduleDowngrade(f.env,f.user,f.input(quote)));await scheduleDowngrade(f.env,f.user,f.input(quote));}
  else{await scheduleDowngrade(f.env,f.user,f.input(quote));f.lose('release');await assert.rejects(cancelDowngrade(f.env,f.user));await cancelDowngrade(f.env,f.user);}
  const status=await refreshBilling(f.env,f.user);assert.equal(status.subscription.plan,'brand');assert.equal(status.downgrade?.status||null,stage==='release'?null:'scheduled');
  const creates=f.calls.filter(c=>c.path==='subscription_schedules');assert.equal(new Set(creates.map(c=>c.key)).size,1);
 });
});
test('stale quotes, non-lower tiers, canceled renewals and blocked permissions fail safely',async t=>{
 const f=await fixture(t),quote=await previewDowngrade(f.env,f.user,{plan:'growth'});await assert.rejects(scheduleDowngrade(f.env,f.user,{...f.input(quote),amount:1}));assert.equal(f.sub.schedule,null);
 await assert.rejects(previewDowngrade(f.env,f.user,{plan:'brand'}));f.sub.cancel_at_period_end=true;await assert.rejects(previewDowngrade(f.env,f.user,{plan:'growth'}));f.sub.cancel_at_period_end=false;
 f.deny(true);await assert.rejects(scheduleDowngrade(f.env,f.user,f.input(quote)),e=>e.status===503&&e.message.includes('Subscription schedules'));assert.equal(f.sub.schedule,null);assert.equal((await f.DB.prepare('SELECT plan_id FROM users').first()).plan_id,'brand');
 f.deny(false);await scheduleDowngrade(f.env,f.user,f.input(quote));assert.equal((await refreshBilling(f.env,f.user)).downgrade.status,'scheduled');
});
test('failed payment at phase transition never grants lower paid tier; paid retry grants it',async t=>{
 const f=await fixture(t),quote=await previewDowngrade(f.env,f.user,{plan:'growth'});await scheduleDowngrade(f.env,f.user,f.input(quote));f.transition(false);
 const status=await refreshBilling(f.env,f.user);assert.equal(status.subscription.plan,'free');assert.equal(status.downgrade,null);assert.equal(f.sub.schedule,null);
 f.sub.status='active';f.sub.latest_invoice.status='paid';assert.equal((await refreshBilling(f.env,f.user)).subscription.plan,'growth');
});
test('prepaid full term preserves trial_end in current schedule phase',async t=>{
 const f=await fixture(t),end=f.sub.items.data[0].current_period_end;f.sub.status='trialing';f.sub.trial_end=end;f.sub.metadata.mart_upgrade_id='prepaid';
 await f.DB.prepare("INSERT INTO billing_upgrades(id,user_id,subscription_id,item_id,from_plan,to_plan,target_price,amount,period_end,cancel_at_period_end,session_params,status,created_at,updated_at,period,pricing_mode,applied_start,applied_end) VALUES('prepaid','u','sub_u','si_u','growth','brand','price_brand_monthly',99000,?,0,'{}','applied',?,?,'monthly','full',?,?)").bind(end,now(),now(),now()-86400,end).run();
 const quote=await previewDowngrade(f.env,f.user,{plan:'growth'});await scheduleDowngrade(f.env,f.user,f.input(quote));const params=f.calls.find(c=>c.path==='subscription_schedules/sub_sched_u'&&c.v).v;assert.equal(params['phases[0][trial_end]'],String(end));assert.equal(params['phases[1][trial_end]'],undefined);assert.equal((await refreshBilling(f.env,f.user)).subscription.plan,'brand');
});
