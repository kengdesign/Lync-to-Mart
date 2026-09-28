import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../scripts/adapter.mjs';
import {amounts,previewUpgrade,startUpgrade,refreshBilling,cancelRenewal,abandonUpgrade,billingWebhook} from '../src/billing.mjs';
const now=()=>Math.floor(Date.now()/1000);
async function fixture(t,from='starter',cancel=false){
 const DB=database(),env={DB,APP_ENV:'staging',BILLING_ENABLED:'true',STRIPE_SECRET_KEY:'rk_test_fixture',STRIPE_WEBHOOK_SECRET:'secret',STRIPE_VAT_RATE_ID:'txr_vat',STRIPE_TEST_EMAILS:'u@example.test'},user={id:'u',email:'u@example.test'};
 for(const p of Object.keys(amounts))for(const period of ['monthly','yearly'])env[`STRIPE_PRICE_${p.toUpperCase()}_${period.toUpperCase()}`]=`price_${p}_${period}`;
 await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind('u',user.email,'hash',from).run();
 await DB.prepare("INSERT INTO billing_accounts(user_id,customer_id,subscription_id,status,plan_id,period) VALUES('u','cus_u','sub_u','active',?,'monthly')").bind(from).run();
 const price=(id)=>{const [,plan,period]=id.split('_');return {id,active:true,livemode:false,currency:'thb',unit_amount:amounts[plan][period],tax_behavior:'inclusive',recurring:{interval:period==='monthly'?'month':'year',interval_count:1}};};
 const sub={id:'sub_u',customer:'cus_u',livemode:false,status:'active',created:now(),metadata:{app:'lync-to-mart',user_id:'u'},items:{data:[{id:'si_u',quantity:1,price:price('price_'+from+'_monthly'),current_period_start:now()-86400,current_period_end:now()+86400*20}]},latest_invoice:{status:'paid',customer:'cus_u'},cancel_at_period_end:cancel};
 if(cancel)sub.cancel_at=sub.items.data[0].current_period_end;
 let sessions=[],calls=[],loseCheckout=false,loseApply=false,denyApply=false;
 const old=globalThis.fetch;t.after(()=>{globalThis.fetch=old;DB.close();});
 globalThis.fetch=async(url,opts)=>{
 const parsed=new URL(url),path=parsed.pathname.replace('/v1/',''),v=opts.body?Object.fromEntries(new URLSearchParams(opts.body)):null,key=opts.headers['Idempotency-Key'];calls.push({path,v,key});let result;
 if(path.startsWith('prices/'))result=price(path.slice(7));
 else if(path.startsWith('tax_rates/'))result={active:true,inclusive:true,percentage:7,livemode:false};
 else if(path==='subscriptions')result={data:[sub],has_more:false};
 else if(path==='subscriptions/sub_u'){
  if(v){if(denyApply)throw Error('temporary unavailable');if(v['items[0][price]']){sub.items.data[0].price=price(v['items[0][price]']);sub.metadata.mart_upgrade_id=v['metadata[mart_upgrade_id]'];assert.equal(v.proration_behavior,'none');assert.equal(v.billing_cycle_anchor,undefined);}
  sub.cancel_at_period_end=v.cancel_at_period_end==='true';sub.cancel_at=sub.cancel_at_period_end?sub.items.data[0].current_period_end:null;
  if(loseApply){loseApply=false;throw Error('lost response after applied');}}
  result=sub;
 }else if(path==='checkout/sessions'){
  result=sessions.find(s=>s.key===key);if(!result){result={id:'cs_test_'+(sessions.length+1),key,status:'open',payment_status:'unpaid',livemode:false,mode:v.mode,customer:v.customer,client_reference_id:v.client_reference_id,currency:'thb',amount_total:Number(v['line_items[0][price_data][unit_amount]']),metadata:{app:v['metadata[app]'],user_id:v['metadata[user_id]'],upgrade_id:v['metadata[upgrade_id]']},url:'https://checkout.stripe.com/c/pay/test'};sessions.push(result);}
  if(loseCheckout){loseCheckout=false;throw Error('lost response after session created');}
 }else if(path.startsWith('checkout/sessions/')){
  result=sessions.find(s=>s.id===path.split('/')[2]);if(path.endsWith('/expire')){if(result.status!=='open')return Response.json({error:{}},{status:400});result.status='expired';}
 }else throw Error('Unexpected path '+path);
 return Response.json(result);
 };
 const pay=()=>Object.assign(sessions.at(-1),{status:'complete',payment_status:'paid'});
 const input=q=>({plan:q.plan,from:q.from,amount:q.amount,period_end:q.period_end,expected_cancel:q.cancel_at_period_end,keep_cancelled:q.cancel_at_period_end});
 return {DB,env,user,sub,calls,sessions,pay,input,loseCheckout:()=>loseCheckout=true,loseApply:()=>loseApply=true,denyApply:v=>denyApply=v};
}
test('monthly upgrades charge exactly 300, 791 and 491 baht, independent of remaining time',async t=>{
 for(const [from,to,difference] of [['starter','growth',30000],['starter','brand',79100],['growth','brand',49100]])await t.test(from+' → '+to,async t=>{
  const f=await fixture(t,from),end=f.sub.items.data[0].current_period_end;
  const quote=await previewUpgrade(f.env,f.user,{plan:to});assert.equal(quote.amount,difference);
  f.sub.items.data[0].current_period_end=now()+86400;assert.equal((await previewUpgrade(f.env,f.user,{plan:to})).amount,difference);f.sub.items.data[0].current_period_end=end;
  await startUpgrade(f.env,f.user,f.input(quote),'https://mart.test');
  const create=f.calls.find(c=>c.path==='checkout/sessions');assert.equal(create.v.mode,'payment');assert.equal(create.v['line_items[0][price_data][unit_amount]'],String(difference));assert.equal(create.v['line_items[0][price_data][tax_behavior]'],'inclusive');assert.equal(create.v['line_items[0][tax_rates][0]'],'txr_vat');
  await refreshBilling(f.env,f.user);assert.equal((await f.DB.prepare('SELECT plan_id FROM users').first()).plan_id,from);
  f.pay();const status=await refreshBilling(f.env,f.user);assert.equal(status.subscription.plan,to);assert.equal(status.subscription.paid_until,end);assert.equal(status.upgrade,null);
  await refreshBilling(f.env,f.user);assert.equal(f.calls.filter(c=>c.path==='subscriptions/sub_u'&&c.v).length,1);assert.equal(f.sessions.length,1);
 });
});
test('canceled renewal is preserved by default; resuming requires explicit choice',async t=>{
 for(const keep of [true,false])await t.test('keep canceled '+keep,async t=>{
  const f=await fixture(t,'starter',true),quote=await previewUpgrade(f.env,f.user,{plan:'growth'});
  await startUpgrade(f.env,f.user,{...f.input(quote),keep_cancelled:keep},'https://mart.test');
  await assert.rejects(cancelRenewal(f.env,f.user,{cancel:false}),e=>e.status===409);
  f.pay();const result=await refreshBilling(f.env,f.user);assert.equal(result.subscription.cancel_at_period_end,keep);
 });
});
test('stale or tampered quotes, downgrade, annual change and renewal boundary cannot charge',async t=>{
 const f=await fixture(t),quote=await previewUpgrade(f.env,f.user,{plan:'growth'});
 for(const change of [{amount:1},{from:'brand'},{period_end:quote.period_end+1},{expected_cancel:true},{keep_cancelled:'false'}])await assert.rejects(startUpgrade(f.env,f.user,{...f.input(quote),...change},'https://mart.test'));
 await assert.rejects(previewUpgrade(f.env,f.user,{plan:'starter'}));
 f.sub.items.data[0].current_period_end=now()+7000;await assert.rejects(previewUpgrade(f.env,f.user,{plan:'growth'}));assert.equal(f.sessions.length,0);
});
test('lost session and apply responses recover without a second payment or duplicate update',async t=>{
 const f=await fixture(t),quote=await previewUpgrade(f.env,f.user,{plan:'growth'}),input=f.input(quote);
 f.loseCheckout();await assert.rejects(startUpgrade(f.env,f.user,input,'https://mart.test'));await startUpgrade(f.env,f.user,input,'https://mart.test');assert.equal(f.sessions.length,1);
 const creates=f.calls.filter(c=>c.path==='checkout/sessions');assert.deepEqual(creates[0],creates[1]);
 await assert.rejects(startUpgrade(f.env,f.user,{...input,plan:'brand'},'https://mart.test'),e=>e.status===409);
 f.pay();f.loseApply();await assert.rejects(refreshBilling(f.env,f.user));assert.equal((await refreshBilling(f.env,f.user)).subscription.plan,'growth');assert.equal(f.calls.filter(c=>c.path==='subscriptions/sub_u'&&c.v).length,1);
});
test('abandon or expire unpaid upgrade leaves old plan and permits a fresh selection',async t=>{
 const f=await fixture(t),quote=await previewUpgrade(f.env,f.user,{plan:'growth'});await startUpgrade(f.env,f.user,f.input(quote),'https://mart.test');
 await abandonUpgrade(f.env,f.user);assert.equal(f.sessions[0].status,'expired');assert.equal((await refreshBilling(f.env,f.user)).subscription.plan,'starter');
 const brand=await previewUpgrade(f.env,f.user,{plan:'brand'});await startUpgrade(f.env,f.user,f.input(brand),'https://mart.test');assert.equal(f.sessions.length,2);f.sessions[1].status='expired';assert.equal((await refreshBilling(f.env,f.user)).upgrade,null);
});
test('wrong payment or changed billing cycle enters review, without granting rights or charging again',async t=>{
 for(const mutate of [f=>f.sessions[0].amount_total=1,f=>f.sessions[0].customer='cus_other',f=>f.sub.items.data[0].current_period_end+=86400])await t.test('review guard',async t=>{
  const f=await fixture(t),quote=await previewUpgrade(f.env,f.user,{plan:'growth'});await startUpgrade(f.env,f.user,f.input(quote),'https://mart.test');f.pay();mutate(f);
  const result=await refreshBilling(f.env,f.user);assert.equal(result.upgrade.status,'review');assert.equal(result.subscription.plan,'starter');assert.equal(f.calls.filter(c=>c.path==='subscriptions/sub_u'&&c.v).length,0);
 });
});
test('signed payment webhook applies upgrade and retries a temporary subscription update failure',async t=>{
 const f=await fixture(t),quote=await previewUpgrade(f.env,f.user,{plan:'growth'});await startUpgrade(f.env,f.user,f.input(quote),'https://mart.test');f.pay();
 const raw=JSON.stringify({id:'evt_upgrade',type:'checkout.session.completed',livemode:false,data:{object:{customer:'cus_u'}}}),ts=now();
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('secret'),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(ts+'.'+raw))).toString('hex');
 const req=()=>new Request('https://mart.test/api/billing/webhook',{method:'POST',body:raw,headers:{'stripe-signature':`t=${ts},v1=${sig}`}});
 f.denyApply(true);await assert.rejects(billingWebhook(req(),f.env));assert.equal(await f.DB.prepare("SELECT * FROM billing_events WHERE id='evt_upgrade'").first(),null);
 f.denyApply(false);await billingWebhook(req(),f.env);await billingWebhook(req(),f.env);assert.equal((await f.DB.prepare('SELECT plan_id FROM users').first()).plan_id,'growth');
});
