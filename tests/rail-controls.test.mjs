import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

test('rail controls follow overflow, scroll edges and replacement catalog nodes',async()=>{
 const dom=new JSDOM('<button data-rail="rail" data-direction="-1"></button><button data-rail="rail" data-direction="1"></button><div id="rail" class="showcase-rail"></div>',{runScripts:'outside-only',pretendToBeVisual:true});
 const {window:w}=dom;let observed=[];
 w.ResizeObserver=class{observe(node){observed.push(node);}disconnect(){observed=[];}};
 const dimensions=(node,width,total,left=0)=>{Object.defineProperties(node,{clientWidth:{configurable:true,value:width},scrollWidth:{configurable:true,value:total}});node.scrollLeft=left;};
 let rail=w.document.getElementById('rail');dimensions(rail,400,400);
 w.eval((await readFile(new URL('../public/product-lightbox.js',import.meta.url),'utf8')).replace('export function','function')+'\n'+(await readFile(new URL('../public/storefront.js',import.meta.url),'utf8')).replace(/^import .*$/gm,''));
 const buttons=[...w.document.querySelectorAll('button')];
 assert.deepEqual(buttons.map(b=>b.disabled),[true,true]);
 dimensions(rail,400,1200);w.dispatchEvent(new w.Event('resize'));
 assert.deepEqual(buttons.map(b=>b.disabled),[true,false]);
 rail.scrollLeft=400;rail.dispatchEvent(new w.Event('scroll'));
 await new Promise(resolve=>w.requestAnimationFrame(resolve));
 assert.deepEqual(buttons.map(b=>b.disabled),[false,false]);
 rail.scrollLeft=800;rail.dispatchEvent(new w.Event('scroll'));
 await new Promise(resolve=>w.requestAnimationFrame(resolve));
 assert.deepEqual(buttons.map(b=>b.disabled),[false,true]);
 const replacement=rail.cloneNode();dimensions(replacement,300,900);rail.replaceWith(replacement);w.eval('connectRails()');
 assert.deepEqual(observed,[replacement]);
 assert.deepEqual(buttons.map(b=>b.disabled),[true,false]);
 w.close();
});
