import assert from 'node:assert/strict';
import {readThaimartLink} from '../src/thaimart-links.mjs';
import {extractProduct} from '../src/import.mjs';
for(const url of ['https://app.thaimart.com/p/1O27lo5z','https://thaimart.com/products/6a8489fba9ceed89ab290994?share=true']){
 const page=await readThaimartLink(url,['thaimart.com']);const p=extractProduct(page.html,page.url);
 assert.ok(p?.name);assert.ok(p.gallery.length);assert.ok(p.description);if(url.includes('/p/')){assert.match(p.name,/Alpha Plus/);assert.equal(p.variants.length,2);}
 console.log(JSON.stringify({input:url,final:page.url,name:p.name,price:p.price,images:p.gallery.length,variants:p.variants.length,source:p.source_url}));
}
