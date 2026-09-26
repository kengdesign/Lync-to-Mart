import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
import {createProductEditor} from '../public/product-editor.js';
test('import must save draft first, locks all controls while copying and retries failed images without publishing',async()=>{
 const dom=new JSDOM('<dialog id="editor"></dialog>',{url:'https://mart.test'}),previous={};
 for(const name of ['document','window','DOMParser','FormData']){previous[name]=globalThis[name];globalThis[name]=dom.window[name];}
 const modal=document.querySelector('dialog');modal.showModal=()=>modal.open=true;modal.close=()=>modal.open=false;
 const photo=n=>'https://img-cdn.thaimart.com/'+n+'.jpg';let failSecond=true,release,started;const gate=new Promise(r=>release=r),begin=new Promise(r=>started=r);const copies=[],saves=[];let stored;
 const api=async path=>{assert.equal(path,'/products/saved');return stored;};
 const send=async(path,data)=>{
  if(path.endsWith('/duplicate'))return {product:null};
  if(path==='/media/import'){copies.push(data.url);if(data.url===photo(1)){started();await gate;}if(data.url===photo(2)&&failSecond)throw new Error('รูปที่สองยังโหลดไม่สำเร็จ');return {key:'alice/'+(data.url===photo(1)?'one':'two')};}
  saves.push(structuredClone(data));stored={...structuredClone(data),id:'saved'};return {id:'saved'};
 };
 try{
  const editor=createProductEditor({api,send,shopId:()=> 'shop',onSaved:async()=>{},toast:()=>{}});
  editor.edit({imported_at:'now',import_receipt:'verified-receipt',status:'published',name:'ทดสอบ',source_url:'https://thaimart.com/products/6a8489fba9ceed89ab290994',description_html:`<p>รายละเอียด</p><img src="${photo(2)}">`,gallery:[{url:photo(1)},{url:photo(2)}],variants:[{attributes:[{key:'สี',value:'แดง'}],price:100,image_url:photo(1)}]});
  const form=document.querySelector('form'),publish=document.querySelector('[data-save-status="published"]'),save=document.querySelector('#save-product');
  assert.ok(publish.disabled);assert.ok(document.querySelector('#pstatus').disabled);assert.equal(document.querySelector('#pstatus').value,'draft');
  await form.onsubmit({preventDefault(){},target:form,submitter:publish});assert.equal(saves.length,0);assert.equal(copies.length,0);
  const saving=form.onsubmit({preventDefault(){},target:form,submitter:save});await begin;
  assert.ok([...modal.querySelectorAll('button,input,select,textarea')].every(el=>el.disabled));assert.equal(document.querySelector('#rich-editor').contentEditable,'false');
  release();await saving;assert.equal(saves.length,0);assert.ok(publish.disabled);assert.ok(!save.disabled);assert.match(document.querySelector('#product-error').textContent,/รูปที่สอง/);
  failSecond=false;await form.onsubmit({preventDefault(){},target:form,submitter:save});
  assert.equal(saves.length,1);assert.equal(saves[0].status,'draft');assert.equal(saves[0].import_receipt,'verified-receipt');assert.equal(saves[0].gallery[0].key,'alice/one');assert.equal(saves[0].gallery[1].key,'alice/two');assert.equal(saves[0].variants[0].image_key,'alice/one');assert.match(saves[0].description_html,/\/media\/alice%2Ftwo/);assert.equal(copies.filter(x=>x===photo(1)).length,1);
  assert.equal(document.querySelector('[data-save-status="published"]').disabled,false);assert.equal(document.querySelector('#pstatus').disabled,false);assert.match(modal.textContent,/บันทึกฉบับร่างสำเร็จ/);
  const next=document.querySelector('form');await next.onsubmit({preventDefault(){},target:next,submitter:document.querySelector('[data-save-status="published"]')});assert.equal(saves[1].status,'published');assert.equal(saves[1].import_receipt,undefined);assert.equal(copies.length,3);
 }finally{for(const [name,value] of Object.entries(previous)){if(value===undefined)delete globalThis[name];else globalThis[name]=value;}dom.window.close();}
});

test('server refuses unresolved imported images and only owner can read saved product',async()=>{
 const {database}=await import('../scripts/adapter.mjs'),{hash}=await import('../src/security.mjs'),{default:worker}=await import('../src/worker.mjs');
 const DB=database(),env={DB,CHECKOUT_HOSTS:'thaimart.com',APP_ENV:'staging'};
 const call=(path,method='GET',data,user='alice')=>worker.fetch(new Request('https://mart.test'+path,{method,headers:{Origin:'https://mart.test',...(user?{Cookie:'mart_session='+user}:{})},...(data?{body:JSON.stringify(data)}:{})}),env,{waitUntil(){}});
 try{
  for(const id of ['alice','bob']){await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@example.test','unused','free').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(id),id,Math.floor(Date.now()/1000)+3600).run();}
  const {id:shop}=await(await call('/api/shops','POST',{name:'ร้าน',slug:'test-shop'})).json();
  const base={name:'สินค้า',source_url:'https://thaimart.com/products/6a8489fba9ceed89ab290994',status:'published'},endpoint='/api/shops/'+shop+'/products';
  assert.equal((await call(endpoint,'POST',{...base,gallery:[{url:'https://img-cdn.thaimart.com/a.jpg'}]})).status,422);
  assert.equal((await call(endpoint,'POST',{...base,variants:[{attributes:[{key:'สี',value:'แดง'}],image_url:'https://img-cdn.thaimart.com/a.jpg'}]})).status,422);
  assert.equal((await(await call(endpoint)).json()).length,0);
  await DB.prepare('INSERT INTO media VALUES(?,?,?,?)').bind('alice/image','alice','image/png',100).run();
  const {id}=await(await call(endpoint,'POST',{...base,status:'draft',gallery:[{key:'alice/image'}]})).json();
  const saved=await(await call('/api/products/'+id)).json();assert.equal(saved.status,'draft');assert.equal(saved.gallery[0].key,'alice/image');
  assert.equal((await call('/api/products/'+id,'GET',null,'bob')).status,404);assert.equal((await call('/api/products/'+id,'GET',null,null)).status,401);
 }finally{DB.close();}
});

test('rescan compares unsaved edits, cancel preserves them, accept keeps checkout and requires draft save',async()=>{
 const dom=new JSDOM('<dialog id="editor"></dialog>',{url:'https://mart.test'}),previous={};for(const name of ['document','window','DOMParser','FormData']){previous[name]=globalThis[name];globalThis[name]=dom.window[name];}
 const modal=document.querySelector('dialog');modal.showModal=()=>modal.open=true;modal.close=()=>modal.open=false;let writes=0;
 const draft={imported_at:'now',name:'ชื่อใหม่',category:'ใหม่',price:null,source_url:'https://thaimart.com/products/6a8489fba9ceed89ab290994',description_html:'<p>รายละเอียดใหม่</p>',gallery:[],variants:[],warnings:['ตรวจสอบราคา']};
 const send=async(path)=>{if(path.endsWith('/duplicate'))return {product:null};if(path==='/import')return structuredClone(draft);writes++;throw new Error('Unexpected write');};
 const tick=async()=>{for(let i=0;i<10&&!document.querySelector('[data-keep]');i++)await new Promise(r=>setTimeout(r,0));assert.ok(document.querySelector('[data-keep]'));};
 try{
  const editor=createProductEditor({api:async()=>{},send,shopId:()=> 'shop',onSaved:async()=>{},toast(){}});
  editor.edit({id:'saved',name:'เดิม',price:100,status:'published',gallery:[{key:'alice/image'}],source_url:draft.source_url,checkout_url:'https://thaimart.com/buy?affiliate=keep',description_html:'<p>รายละเอียดเดิม</p>'});
  document.querySelector('#pname').value='แก้ไว้ยังไม่บันทึก <img onerror=alert(1)>';
  const originalForm=document.querySelector('#product-form');const cancel=document.querySelector('#rescan').onclick();await tick();
  assert.match(document.querySelector('.import-review').textContent,/แก้ไว้ยังไม่บันทึก/);assert.match(document.querySelector('.import-review').textContent,/ไม่ระบุราคา/);assert.equal(document.querySelector('.import-review [onerror]'),null);assert.equal(document.querySelector('#save-product').disabled,true);
  document.querySelector('[data-keep]').click();await cancel;assert.equal(document.querySelector('#product-form'),originalForm);assert.match(document.querySelector('#pname').value,/แก้ไว้/);assert.equal(document.querySelector('#pstatus').value,'published');assert.equal(document.querySelector('#save-product').disabled,false);assert.equal(writes,0);
  const accept=document.querySelector('#rescan').onclick();await tick();document.querySelector('[data-apply]').click();await accept;
  assert.equal(document.querySelector('#pname').value,'ชื่อใหม่');assert.equal(document.querySelector('#pcheckout').value,'https://thaimart.com/buy?affiliate=keep');assert.equal(document.querySelector('#pstatus').value,'draft');assert.equal(document.querySelector('[data-save-status="published"]').disabled,true);assert.equal(writes,0);
 }finally{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}dom.window.close();}
});

test('deleting locks save and close until completion and restores editor after failure',async()=>{
 const dom=new JSDOM('<dialog id="editor"></dialog>',{url:'https://mart.test'}),previous={};for(const name of ['document','window','DOMParser','FormData','confirm']){previous[name]=globalThis[name];globalThis[name]=name==='confirm'?()=>true:dom.window[name];}
 const modal=document.querySelector('dialog');modal.showModal=()=>modal.open=true;modal.close=()=>modal.open=false;let resolve,reject,saves=0,loaded=0;
 try{const editor=createProductEditor({api:async(path,options)=>{assert.equal(path,'/products/saved');assert.equal(options.method,'DELETE');return new Promise((res,rej)=>{resolve=res;reject=rej;});},send:async()=>{saves++;},shopId:()=> 'shop',onSaved:async()=>{loaded++;},toast(){}});
 editor.edit({id:'saved',name:'ทดสอบ',source_url:'https://thaimart.com/products/6a8489fba9ceed89ab290994'});
 const deleting=document.querySelector('#delete-product').onclick(),form=document.querySelector('form');assert.ok([...modal.querySelectorAll('button,input,select,textarea')].every(el=>el.disabled));
 await form.onsubmit({preventDefault(){},target:form});document.querySelector('[data-close]').onclick();assert.equal(saves,0);assert.equal(modal.open,true);reject(new Error('ลบไม่สำเร็จ'));await deleting;assert.match(document.querySelector('#product-error').textContent,/ลบไม่สำเร็จ/);assert.equal(document.querySelector('#save-product').disabled,false);
 const retry=document.querySelector('#delete-product').onclick();resolve({ok:true});await retry;assert.equal(modal.open,false);assert.equal(loaded,1);
 }finally{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}dom.window.close();}
});

test('saved empty gallery never claims image import success and cannot publish through editor',async()=>{
 const dom=new JSDOM('<dialog id="editor"></dialog>',{url:'https://mart.test'}),previous={};for(const name of ['document','window','DOMParser','FormData']){previous[name]=globalThis[name];globalThis[name]=dom.window[name];}const modal=document.querySelector('dialog');modal.showModal=()=>modal.open=true;modal.close=()=>modal.open=false;let writes=0;
 try{createProductEditor({api:async()=>{},send:async()=>{writes++;},shopId:()=> 'shop',onSaved:async()=>{},toast(){}}).edit({id:'saved',name:'สินค้า',source_url:'https://thaimart.com/products/6aa8a98ed792ee0753ff3dba',gallery:[],_import_ready:true});
 assert.match(modal.textContent,/บันทึกฉบับร่างแล้ว แต่ยังไม่มีรูปสินค้า/);assert.doesNotMatch(modal.textContent,/นำเข้ารูปและบันทึกฉบับร่างสำเร็จแล้ว/);const publish=document.querySelector('[data-save-status="published"]');assert.ok(publish.disabled);assert.ok(document.querySelector('#pstatus [value="published"]').disabled);const form=document.querySelector('form');await form.onsubmit({preventDefault(){},target:form,submitter:publish});assert.equal(writes,0);assert.match(document.querySelector('#product-error').textContent,/เพิ่มรูปปก/);
 }finally{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}dom.window.close();}
});
