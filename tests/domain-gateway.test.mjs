import test from 'node:test';
import assert from 'node:assert/strict';
import {serveDomain} from '../src/domain-gateway.mjs';
const active={status:'active',entitled:true,shopPublished:true,shopRestricted:false,slug:'shop-a'};
function context(overrides={}){return {resolveDomain:async()=>active,authorizeResource:async()=>false,service:{fetch:async()=>new Response('public')},...overrides};}
const request=(path,init)=>new Request('https://customer.example'+path,init);
test('rejects account, preview, API and mutating requests before resolution',async()=>{
 let reads=0;const ctx=context({resolveDomain:async()=>{reads++;return active;}});
 for(const path of ['/api/me','/api/admin','/preview/abc','/sh0rt-log1ng/','/register','/login'])assert.equal((await serveDomain(request(path),ctx)).status,404);
 assert.equal((await serveDomain(request('/',{method:'POST'}),ctx)).status,405);assert.equal(reads,0);
});
test('unknown, pending, expired and moderated domains cannot serve content',async()=>{
 for(const value of [null,{...active,status:'verified'},{...active,entitled:false},{...active,shopPublished:false},{...active,shopRestricted:true}])
 assert.equal((await serveDomain(request('/shop/shop-a'),context({resolveDomain:async()=>value}))).status,404);
});
test('only the mapped shop and authorized resources can pass',async()=>{
 const ctx=context();assert.equal((await serveDomain(request('/shop/shop-b'),ctx)).status,404);
 assert.equal((await serveDomain(request('/media/private'),ctx)).status,404);
 assert.equal((await serveDomain(request('/go/other'),ctx)).status,404);
 assert.equal((await serveDomain(request('/shop/shop-a'),ctx)).status,308);
 const res=await serveDomain(request('/?page=2'),ctx);assert.equal(res.status,200);assert.equal(res.headers.get('location'),null);
});
test('strips credentials and returned cookies, preserves requested range',async()=>{
 let received;const res=await serveDomain(request('/media/public',{headers:{cookie:'mart_session=secret',authorization:'Bearer secret','x-forwarded-host':'attacker.example',range:'bytes=0-5'}}),context({authorizeResource:async()=>true,service:{fetch:async r=>{received=r;return new Response('public',{headers:{'Set-Cookie':'bad=1'}});}}}));
 assert.equal(received.headers.get('cookie'),null);assert.equal(received.headers.get('authorization'),null);assert.equal(received.headers.get('x-forwarded-host'),null);assert.equal(received.headers.get('range'),'bytes=0-5');assert.equal(res.headers.get('set-cookie'),null);
});
test('does not expose an upstream login redirect',async()=>{
 const res=await serveDomain(request('/'),context({service:{fetch:async()=>Response.redirect('https://customer.example/login',302)}}));assert.equal(res.status,404);
});

test('root maps internally and old shop path redirects to root preserving query',async()=>{let received;const ctx=context({service:{fetch:async req=>{received=req;return new Response('store');}}});const res=await serveDomain(request('/?q=test&page=2',{headers:{'X-Mart-Storefront-Root':'evil'}}),ctx);assert.equal(res.status,200);assert.equal(received.url,'https://customer.example/shop/shop-a?q=test&page=2');assert.equal(received.headers.get('X-Mart-Storefront-Root'),'1');const old=await serveDomain(request('/shop/shop-a?q=test&page=2'),ctx);assert.equal(old.status,308);assert.equal(old.headers.get('location'),'https://customer.example/?q=test&page=2');});
