import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
import {refreshStockBadges,paintStockBadges} from '../public/stock-badges.js';
test('badge is informational, expires, disappears after restock and handles replaced catalog cards',async()=>{
 const dom=new JSDOM('<div><a id="photo" href="/media/photo"><img></a><span hidden data-stock-product="one">สินค้าหมด</span><a id="buy" href="/go/one">ซื้อ</a></div>',{url:'https://mart.test',pretendToBeVisual:true});
 const old={document:globalThis.document,fetch:globalThis.fetch,setTimeout:globalThis.setTimeout};let value=true;
 globalThis.document=dom.window.document;globalThis.fetch=async()=>Response.json({products:{one:{sold_out:value,valid_until:Date.now()/1000+300},two:{sold_out:false,valid_until:Date.now()/1000+300}}});globalThis.setTimeout=()=>0;
 try{
  await refreshStockBadges();assert.equal(document.querySelector('span').hidden,false);
  assert.equal(document.querySelector('#photo').getAttribute('href'),'/media/photo');assert.equal(document.querySelector('#buy').getAttribute('href'),'/go/one');
  paintStockBadges(document,Date.now()+301000);assert.equal(document.querySelector('span').hidden,true);
  document.querySelector('span').dataset.stockProduct='two';await refreshStockBadges();assert.equal(document.querySelector('span').hidden,true);
 }finally{Object.assign(globalThis,old);dom.window.close();}
});
