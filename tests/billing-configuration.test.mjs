import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../scripts/adapter.mjs';
import {adminData} from '../src/admin.mjs';
import {amounts} from '../src/billing.mjs';
test('owner diagnostic checks all Live prices while billing disabled, denies other roles and never writes Stripe',async t=>{
 const DB=database(),env={DB,APP_ENV:'production',BILLING_ENABLED:'false',STRIPE_SECRET_KEY:'rk_live_private',STRIPE_WEBHOOK_SECRET:'whsec_private',STRIPE_VAT_RATE_ID:'txr_vat'};
 t.after(()=>DB.close());for(const role of ['owner','admin','support']){await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(role,role+'@example.test','hash','free').run();await DB.prepare('INSERT INTO admin_roles VALUES(?,?)').bind(role,role).run();}
 for(const plan of Object.keys(amounts))for(const period of ['monthly','yearly'])env[`STRIPE_PRICE_${plan.toUpperCase()}_${period.toUpperCase()}`]=`price_${plan}_${period}`;
 let calls=0,bad=false;const old=globalThis.fetch;t.after(()=>globalThis.fetch=old);
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(options.method,'GET');assert.equal(options.body,undefined);const id=new URL(url).pathname.split('/').at(-1);if(id==='txr_vat')return Response.json({active:true,livemode:true,percentage:7,inclusive:true});const [,plan,period]=id.split('_');return Response.json({id,active:true,livemode:true,currency:'thb',unit_amount:amounts[plan][period],tax_behavior:bad?'unspecified':'inclusive',recurring:{interval:period==='monthly'?'month':'year',interval_count:1}});};
 const check=role=>adminData(env,{id:role},new URL('https://mart.test/api/admin?view=billing-check'));
 for(const role of ['admin','support'])await assert.rejects(check(role),e=>e.status===403);assert.equal(calls,0);
 const result=await check('owner');assert.equal(result.configuration_ok,true);assert.equal(result.billing_enabled,false);assert.equal(result.webhook_verified,false);assert.equal(result.checks.length,8);assert.equal(calls,12);assert.doesNotMatch(JSON.stringify(result),/rk_live_private|whsec_private/);assert.equal(env.BILLING_ENABLED,'false');
 assert.equal(result.last_processed_webhook,null);
 await DB.prepare('INSERT INTO billing_events VALUES(?,?,?)').bind('evt_verified','invoice.paid',123).run();
 const observed=await check('owner');assert.deepEqual({...observed.last_processed_webhook},{id:'evt_verified',type:'invoice.paid',processed_at:123});assert.equal(observed.webhook_verified,false);
 bad=true;assert.equal((await check('owner')).configuration_ok,false);
 env.STRIPE_SECRET_KEY='rk_test_wrong';calls=0;assert.equal((await check('owner')).configuration_ok,false);assert.equal(calls,0);
});
