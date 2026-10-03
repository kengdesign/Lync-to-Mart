import assert from 'node:assert/strict';
import {readThaimartLink} from '../src/thaimart-links.mjs';
import {extractProduct} from '../src/import.mjs';
for(const url of ['https://app.thaimart.com/p/I97UpOzC','https://app.thaimart.com/p/1O27lo5z','https://thaimart.com/products/6a8489fba9ceed89ab290994?share=true']){
 try{const page=await readThaimartLink(url,['thaimart.com'],async(u,o)=>{const r=await fetch(u,o);console.log(JSON.stringify({request:u,status:r.status,location:r.headers.get('location'),type:r.headers.get('content-type')}));if(!r.ok&&r.status>=400)console.log((await r.clone().text()).slice(0,1000));return r;});const p=extractProduct(page.html,page.url);
 assert.ok(p?.name);assert.ok(p.gallery.length);assert.ok(p.description);if(url.includes('1O27lo5z')){assert.match(p.name,/Alpha Plus/);assert.equal(p.variants.length,2);}
 console.log(JSON.stringify({input:url,final:page.url,name:p.name,price:p.price,images:p.gallery.length,variants:p.variants.length,source:p.source_url}));}catch(error){console.error(error.message);process.exitCode=1;}
}
