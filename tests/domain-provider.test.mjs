import test from 'node:test';
import assert from 'node:assert/strict';
import {domainProvider} from '../src/domain-provider.mjs';
const env={MART_DOMAIN_ZONE_ID:'f0b5797bfb2571e56c55b7dedd8fbcbc',MART_DOMAIN_API_TOKEN:'test-only'};
const id='a'.repeat(32);
test('provider rejects any other zone before network access',()=>assert.throws(()=>domainProvider({...env,MART_DOMAIN_ZONE_ID:'b'.repeat(32)})));
test('inventory is restricted to new zone and GET',async()=>{
 const calls=[];const provider=domainProvider(env,async(url,options)=>{calls.push([url,options]);return Response.json({success:true,result:{}});});
 await provider.fallback();await provider.quota();assert.equal(calls.length,2);
 for(const [url,options] of calls){assert.ok(url.startsWith('https://api.cloudflare.com/client/v4/zones/'+env.MART_DOMAIN_ZONE_ID+'/custom_hostnames/'));assert.equal(options.method,'GET');assert.equal(options.redirect,'error');}
});
test('deletion requires recorded ownership and matching remote hostname',async()=>{
 const calls=[];const provider=domainProvider(env,async(url,options)=>{calls.push(options.method);return Response.json({success:true,result:{hostname:'shop.customer.com'}});});
 await assert.rejects(provider.remove({provider_id:id}));assert.equal(calls.length,0);
 const record={provider_id:id,provider_zone_id:env.MART_DOMAIN_ZONE_ID,managed_by:'lync-to-mart',hostname:'wrong.customer.com'};
 await assert.rejects(provider.remove(record));assert.deepEqual(calls,['GET']);
 calls.length=0;await provider.remove({...record,hostname:'shop.customer.com'});assert.deepEqual(calls,['GET','DELETE']);
});
test('errors never reflect provider secrets or response text',async()=>{
 const provider=domainProvider(env,async()=>Response.json({success:false,errors:[{message:env.MART_DOMAIN_API_TOKEN}]},{status:403}));
 await assert.rejects(provider.quota(),err=>err.message==='Domain provider rejected request'&&!err.message.includes(env.MART_DOMAIN_API_TOKEN));
});
