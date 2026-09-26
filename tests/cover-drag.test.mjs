import test from 'node:test';
import assert from 'node:assert/strict';
import {mountCoverPosition} from '../public/cover-position.js';

test('cover drag coalesces movement, avoids layout reads and commits mouse/touch positions',()=>{
 const saved={requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame,ResizeObserver:globalThis.ResizeObserver};
 const queue=new Map();let next=0,reads=0;
 globalThis.requestAnimationFrame=fn=>{queue.set(++next,fn);return next;};
 globalThis.cancelAnimationFrame=id=>queue.delete(id);
 globalThis.ResizeObserver=class{observe(){}disconnect(){}};
 class Element extends EventTarget{
  style={};attrs={};classList={add(){},remove(){},toggle(){}};
  setAttribute(k,v){this.attrs[k]=v;}focus(){}setPointerCapture(id){this.capture=id;}hasPointerCapture(id){return this.capture===id;}releasePointerCapture(){this.capture=null;}
 }
 const frame=new Element(),img=new Element(),field={value:'50'},reset=new Element(),hint={};
 Object.defineProperties(frame,{clientWidth:{get(){reads++;return 600;}},clientHeight:{get(){reads++;return 200;}}});
 Object.assign(img,{complete:true,naturalWidth:1200,naturalHeight:800,hidden:false});frame.querySelector=()=>img;
 const form=new Element();form.isConnected=true;form.elements={cover_key:{value:'cover.jpg'}};
 form.querySelector=s=>({'.brand-image.cover_key':frame,'[name="cover_position_y"]':field,'#cover-center':reset,'#cover-position-hint':hint}[s]);
 const fire=(type,props)=>{const ev=new Event(type,{cancelable:true});Object.assign(ev,props);frame.dispatchEvent(ev);};
 const flush=()=>{const tasks=[...queue.values()];queue.clear();tasks.forEach(fn=>fn());};
 try{
  mountCoverPosition(form);flush();assert.equal(img.style.transform,'translate3d(0px,-100px,0)');const initialReads=reads;
  fire('pointerdown',{pointerId:1,pointerType:'mouse',button:0,isPrimary:true,clientY:100});
  for(let y=99;y>=50;y--)fire('pointermove',{pointerId:1,clientY:y});
  assert.equal(queue.size,1);assert.equal(reads,initialReads);assert.equal(field.value,50);
  flush();assert.equal(img.style.transform,'translate3d(0px,-150px,0)');
  fire('pointerup',{pointerId:1,clientY:40});flush();assert.equal(field.value,80);assert.equal(img.style.transform,'translate3d(0px,-160px,0)');
  fire('pointerdown',{pointerId:2,pointerType:'touch',isPrimary:true,clientY:40});
  fire('pointermove',{pointerId:3,clientY:500});assert.equal(queue.size,0);
  fire('pointermove',{pointerId:2,clientY:1000});fire('pointercancel',{pointerId:2});flush();assert.equal(field.value,0);
  fire('keydown',{key:'End'});flush();assert.equal(field.value,100);
  fire('keydown',{key:'Home'});flush();assert.equal(field.value,0);
  assert.equal(reads,initialReads);
 }finally{Object.assign(globalThis,saved);}
});
