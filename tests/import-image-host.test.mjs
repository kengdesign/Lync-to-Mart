import test from 'node:test';import assert from 'node:assert/strict';
import {remoteImage} from '../src/content.mjs';import {extractProduct} from '../src/import.mjs';
test('verified Makro CDN images survive product import while lookalike hosts are refused',()=>{
 const url='https://images.mango-prod.siammakro.cloud/product-images/example.jpeg';
 assert.equal(remoteImage(url),url);assert.equal(remoteImage(url.replace('.cloud/','.cloud.evil.test/')),null);
 const id='6a9a2fc8937e762483eb90a6',p={id,name:'ดีนี่',images:[{url}],variants:[{price:'353',attributes:[]}],minPrice:'353'};
 const html='<script>self.__next_f.push('+JSON.stringify([1,'18:'+JSON.stringify({product:p})+'\n'])+')</script>';
 const product=extractProduct(html,'https://thaimart.com/products/'+id);
 assert.equal(product.gallery[0].url,url);assert.equal(product.warnings.some(w=>w.includes('โดเมน')),false);
});
