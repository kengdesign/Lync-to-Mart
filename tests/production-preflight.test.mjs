import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {productionPreflight} from '../scripts/production-preflight.mjs';
const load=p=>JSON.parse(readFileSync(p,'utf8'));
test('production preparation rejects staging bindings, test overrides, secrets and premature public opening',()=>{
 const c=load('wrangler.production.example.jsonc'),s=load('wrangler.jsonc');
 assert.equal(productionPreflight(c,s).configuration_valid,false);
 c.d1_databases[0].database_id='11111111-2222-3333-4444-555555555555';
 const valid=productionPreflight(c,s);assert.equal(valid.configuration_valid,true);assert.equal(valid.launch_ready,false);
 for(const mutate of [c=>c.d1_databases[0].database_id=s.d1_databases[0].database_id,c=>c.r2_buckets[0].bucket_name=s.r2_buckets[0].bucket_name,c=>c.vars.STAGING_TEST_PLAN='brand',c=>c.vars.STRIPE_SECRET_KEY='secret',c=>c.vars.BILLING_ENABLED='true',c=>c.vars.SIGNUP_ENABLED='true',c=>c.workers_dev=true]){
  const copy=structuredClone(c);mutate(copy);assert.equal(productionPreflight(copy,s).configuration_valid,false);
 }
});

test('production billing accepts configured live prices but rejects missing, duplicate or staging IDs',()=>{
 const c=load('wrangler.production.jsonc'),s=load('wrangler.jsonc');
 assert.equal(c.vars.BILLING_ENABLED,'true');
 assert.equal(productionPreflight(c,s).configuration_valid,true);
 assert.equal(productionPreflight(c,s).launch_ready,false);
 for(const mutate of [c=>delete c.vars.STRIPE_PRICE_BRAND_YEARLY,c=>c.vars.STRIPE_PRICE_STARTER_MONTHLY=c.vars.STRIPE_PRICE_GROWTH_MONTHLY,c=>c.vars.STRIPE_PRICE_STARTER_MONTHLY=s.vars.STRIPE_PRICE_STARTER_MONTHLY,c=>delete c.vars.STRIPE_VAT_RATE_ID,c=>c.vars.BILLING_ENABLED='yes']){
  const copy=structuredClone(c);mutate(copy);assert.equal(productionPreflight(copy,s).configuration_valid,false);
 }
});
