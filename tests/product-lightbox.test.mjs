import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {connectProductLightbox} from '../public/product-lightbox.js';
test('product gallery opens only selected image, supports keyboard, closes and restores focus',()=>{
 const dom=new JSDOM('<article class="product-card"><div class="product-gallery"><a href="/media/one"><img alt="รูปแรก"></a></div><div class="product-extra-gallery"><a href="/media/two"><img alt="รูปสอง"></a></div></article>',{url:'https://mart.test'}),w=dom.window,d=w.document;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.dispatchEvent(new w.Event('close'));};
 try{
  connectProductLightbox(d);const link=d.querySelector('a');link.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
  const modal=d.querySelector('dialog');assert.ok(modal.open);assert.equal(modal.querySelectorAll('img').length,1);assert.match(modal.querySelector('img').src,/\/one$/);assert.equal(modal.querySelector('[data-prev]').disabled,true);
  modal.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight'}));assert.match(modal.querySelector('img').src,/\/two$/);assert.equal(modal.querySelector('img').alt,'รูปสอง');assert.equal(modal.querySelector('[data-next]').disabled,true);
  modal.querySelector('img').dispatchEvent(new w.Event('error'));assert.equal(modal.querySelector('[data-error]').hidden,false);
  modal.querySelector('[data-close]').click();assert.equal(d.querySelector('dialog'),null);assert.equal(d.activeElement,link);
  const modified=new w.MouseEvent('click',{bubbles:true,cancelable:true,ctrlKey:true});link.dispatchEvent(modified);assert.equal(modified.defaultPrevented,false);assert.equal(d.querySelector('dialog'),null);
 }finally{w.close();}
});
test('touch gallery changes one image for horizontal swipe but ignores vertical scroll, pinch and canceled gestures',()=>{
 const dom=new JSDOM('<article class="product-card"><div class="product-gallery"><a href="/one"><img></a><a href="/two"><img></a></div></article>',{url:'https://mart.test'}),w=dom.window,d=w.document;
 w.HTMLDialogElement.prototype.showModal=function(){};
 try{
  connectProductLightbox(d);d.querySelector('a').dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
  const stage=d.querySelector('.lightbox-stage'),img=stage.querySelector('img');
  const point=(x,y,id=1)=>({clientX:x,clientY:y,identifier:id});
  const send=(type,touches,changedTouches=[])=>{const e=new w.Event(type);Object.assign(e,{touches,changedTouches});stage.dispatchEvent(e);};
  const swipe=(x,y)=>{send('touchstart',[point(150,150)]);send('touchend',[],[point(x,y)]);};
  swipe(50,155);assert.match(img.src,/two$/);swipe(50,155);assert.match(img.src,/two$/);swipe(250,155);assert.match(img.src,/one$/);
  swipe(100,280);assert.match(img.src,/one$/);swipe(130,150);assert.match(img.src,/one$/);
  send('touchstart',[point(150,150)]);send('touchmove',[point(140,150),point(200,150,2)]);send('touchend',[],[point(50,150)]);assert.match(img.src,/one$/);
  send('touchstart',[point(150,150)]);send('touchcancel',[]);send('touchend',[],[point(50,150)]);assert.match(img.src,/one$/);
 }finally{w.close();}
});
