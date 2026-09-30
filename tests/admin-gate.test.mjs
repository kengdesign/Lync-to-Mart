import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
const env={ADMIN_GATE_USER:'test-admin',ADMIN_GATE_PASSWORD:'fixture-only-password',ASSETS:{fetch:async()=>new Response('admin shell')}};
const request=(path,auth)=>new Request('https://mart.test'+path,{headers:auth?{Authorization:auth}:{}});
test('outer gate protects direct HTML, encoded paths and admin APIs before any assets or DB access',async()=>{
 for(const path of ['/sh0rt-log1ng/','/sh0rt-log1ng','/admin.html','/%61dmin.html','/admin','/api/admin','/api/admin/members']){
  const r=await worker.fetch(request(path),env,{});assert.equal(r.status,401);assert.match(r.headers.get('WWW-Authenticate'),/^Basic/);assert.equal(r.headers.get('Cache-Control'),'no-store');
 }
 for(const auth of ['Basic bad!','Bearer test','Basic '+btoa('test-admin:wrong')])assert.equal((await worker.fetch(request('/admin.html',auth),env,{})).status,401);
});
test('correct gate password permits shell but still requires an authenticated Mart account for APIs',async()=>{
 const auth='Basic '+btoa('test-admin:fixture-only-password');
 assert.equal((await worker.fetch(request('/sh0rt-log1ng/',auth),env,{})).status,200);
 const r=await worker.fetch(request('/api/admin',auth),env,{});assert.equal(r.status,401);assert.equal(r.headers.get('WWW-Authenticate'),null);
});
test('public storefront stays available; absent gate is opt-in; partial config fails closed',async()=>{
 assert.equal((await worker.fetch(request('/'),env,{})).status,200);
 assert.equal((await worker.fetch(request('/admin.html'),{ASSETS:env.ASSETS},{})).status,200);
 assert.equal((await worker.fetch(request('/admin.html'),{ADMIN_GATE_USER:'test'},{})).status,503);
});
