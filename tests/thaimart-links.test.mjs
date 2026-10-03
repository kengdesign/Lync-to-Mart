import test from 'node:test';import assert from 'node:assert/strict';
import {importLink,readThaimartLink,shareDestination} from '../src/thaimart-links.mjs';
import {extractProduct} from '../src/import.mjs';
const id='6a43432bf7acc7c871e9632c',legacy='https://thaimart.com/products/'+id;
const slug='ชั้นไม้-3-ชั้น-AAABnxa-',url='https://thaimart.com/products/'+encodeURIComponent(slug);
const data={id,slug:encodeURIComponent(slug),name:'ชั้นไม้',description:'รายละเอียดสินค้า',images:[{url:'https://img-cdn.thaimart.com/example'}],variants:[{price:'169',attributes:[]}],minPrice:'169'};
const html=p=>'<script>self.__next_f.push('+JSON.stringify([1,'18:'+JSON.stringify({product:p})+'\n'])+')</script>';
test('app landing HTML follows webFallback, then relative HTTP redirect to the product',async()=>{
 const share='https://app.thaimart.com/p/I97UpOzC',web='https://thaimart.com/p/I97UpOzC';
 const landing='<script>(function(){var iosApp="thaimart://app.thaimart.com/p/I97UpOzC";var webFallback='+JSON.stringify(web)+';window.location.replace(webFallback);})();</script>';
 const calls=[];
 const result=await readThaimartLink(share,['thaimart.com'],async u=>{
  calls.push(u);
  if(u===share)return new Response(landing,{headers:{'content-type':'text/html; charset=utf-8'}});
  if(u===web)return new Response(null,{status:307,headers:{location:new URL(url).pathname}});
  assert.equal(u,url);return new Response(html(data),{headers:{'content-type':'text/html'}});
 });
 assert.deepEqual(calls,[share,web,url]);assert.equal(extractProduct(result.html,result.url).source_url,legacy);
});
test('legacy links still import without a share page',async()=>{
 const result=await readThaimartLink(legacy+'?share=true',['thaimart.com'],async()=>new Response(html(data),{headers:{'content-type':'text/html'}}));
 assert.equal(extractProduct(result.html,result.url).source_url,legacy);
});
test('share literals cannot execute code or follow foreign destinations',async()=>{
 for(const value of ['https://evil.test/products/a','http://127.0.0.1/','https://thaimart.com/','javascript:alert(1)','https://thaimart.com.evil.test/p/a'])assert.equal(shareDestination('<script>var webFallback='+JSON.stringify(value)+';</script>'),null);
 assert.equal(shareDestination('<script>var webFallback=fetch("https://evil.test");</script>'),null);
 assert.equal(shareDestination('<script>var webFallback="https://thaimart.com/p/a"+evil();</script>'),null);
 assert.equal(shareDestination('<script>var webFallback="https://thaimart.com/p/a";var webFallback="https://thaimart.com/p/b";</script>'),null);
 const share='https://app.thaimart.com/p/a';let calls=0;
 await assert.rejects(readThaimartLink(share,['thaimart.com'],async()=>{calls++;return new Response('<script>var webFallback="https://evil.test/products/a";</script>',{headers:{'content-type':'text/html'}});}),{status:422});assert.equal(calls,1);
});
test('allow product slugs, legacy and share links; reject foreign hosts and unsafe paths',()=>{
 for(const u of [legacy,url,'https://app.thaimart.com/p/1O27lo5z'])assert.ok(importLink(u));
 for(const u of ['https://evil.test/products/a','https://thaimart.com.evil.test/products/a','http://thaimart.com/products/a','https://user@thaimart.com/products/a','https://thaimart.com:8080/products/a','https://thaimart.com/products/a%2fb','https://thaimart.com/products/%5cfoo','https://thaimart.com/products/%00','https://thaimart.com/products/%GG','https://app.thaimart.com/','https://app.thaimart.com/p/../admin'])assert.equal(importLink(u),null,u);
});
test('follow bounded official redirects and extract exact product slug, preserving legacy identity and variants',async()=>{
 const calls=[];const result=await readThaimartLink('https://app.thaimart.com/p/1O27lo5z',['thaimart.com'],async(u,o)=>{calls.push(u);assert.equal(o.redirect,'manual');return calls.length===1?new Response(null,{status:302,headers:{location:url}}):new Response(html(data),{headers:{'content-type':'text/html'}});});
 const p=extractProduct(result.html,result.url);assert.equal(p.name,'ชั้นไม้');assert.equal(p.source_url,legacy);assert.equal(p.price,16900);assert.equal(p.gallery.length,1);assert.deepEqual(p.variants,[]);assert.equal(calls.length,2);
 assert.equal(extractProduct(html({...data,slug:'other-product'}),url),null);
 const variants=[{price:850,attributes:[{key:'ขนาด',value:'150g'}]},{price:1500,attributes:[{key:'ขนาด',value:'300g'}]}];assert.equal(extractProduct(html({...data,variants}),url).variants.length,2);
});
test('reject redirects outside allowlist, home fallback, loops, disabled import and non-HTML',async()=>{
 let calls=0;
 for(const dest of ['https://evil.test/products/a','http://127.0.0.1/','https://thaimart.com/']){calls=0;await assert.rejects(readThaimartLink(legacy,['thaimart.com'],async()=>{calls++;return new Response(null,{status:302,headers:{location:dest}});}),{status:422});assert.equal(calls,1);}
 await assert.rejects(readThaimartLink(legacy,[],async()=>{throw Error('must not fetch');}),{status:422});
 await assert.rejects(readThaimartLink(legacy,['thaimart.com'],async()=>new Response(null,{status:302,headers:{location:legacy}})),{status:422});
 await assert.rejects(readThaimartLink(legacy,['thaimart.com'],async()=>new Response('{}',{headers:{'content-type':'application/json'}})),{status:422});
});
