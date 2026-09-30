import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountTeam} from '../public/team.js';
import {createProductEditor} from '../public/product-editor.js';
import {readFileSync} from 'node:fs';
const tick=()=>new Promise(r=>setTimeout(r,0));
test('team form invites one person to multiple shops with explicit scopes and resets edit mode on cancel',async()=>{
 const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main'),previous=globalThis.FormData;globalThis.FormData=dom.window.FormData;
 dom.window.HTMLElement.prototype.scrollIntoView=()=>{};const calls=[];
 const data={limit:8,shops:[{id:'a',name:'ร้าน A'},{id:'b',name:'ร้าน B'}],members:[{id:'m',email:'staff@example.test',status:'active',enabled:true,grants:{a:{role:'viewer'}}}],audit:[]};
 try{
  mountTeam({root,toast:()=>{},api:async(path,opts)=>{if(opts)calls.push(JSON.parse(opts.body));return data;}});await tick();
  root.querySelector('[data-edit-member]').click();assert.equal(root.querySelector('#team-email').disabled,true);root.querySelector('#team-cancel').click();await tick();assert.equal(root.querySelector('#team-email').disabled,false);
  root.querySelector('#team-email').value='new@example.test';
  for(const el of root.querySelectorAll('[data-shop]')){el.querySelector('[data-role]').value='editor';el.querySelector('[data-scope="products"]').checked=true;el.querySelector('[data-role]').dispatchEvent(new dom.window.Event('change',{bubbles:true}));}
  root.querySelector('[data-shop="a"] [data-scope="publish"]').checked=true;
  root.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await tick();
  assert.equal(calls.length,1);assert.deepEqual(Object.keys(calls[0].grants),['a','b']);assert.equal(calls[0].grants.a.publish,true);assert.equal(calls[0].grants.b.publish,false);assert.equal(calls[0].action,'invite');
 }finally{globalThis.FormData=previous;dom.window.close();}
});
test('product UI keeps publication locked for draft editor and presents published products read only',()=>{
 const dom=new JSDOM('<dialog id="editor"></dialog>',{url:'https://mart.test'}),previous={};
 for(const name of ['document','window','DOMParser','FormData']){previous[name]=globalThis[name];globalThis[name]=dom.window[name];}
 const modal=document.querySelector('dialog');modal.showModal=()=>modal.open=true;modal.close=()=>modal.open=false;
 try{
  const editor=createProductEditor({api:()=>{},send:()=>{},shopId:()=> 'a',onSaved:()=>{},toast:()=>{},canPublish:()=>false,canEdit:p=>p.status!=='published'});
  const product={name:'สินค้า',source_url:'https://thaimart.com/products/abc',gallery:[{key:'owner/pic'}]};editor.edit({...product,status:'draft'});
  assert.equal(document.querySelector('[data-save-status="published"]').disabled,true);assert.equal(document.querySelector('#save-product').disabled,false);
  editor.edit({...product,status:'published'});assert.equal(document.querySelector('#save-product').disabled,true);assert.equal(document.querySelector('#rich-editor').contentEditable,'false');assert.equal(document.querySelector('[data-close]').disabled,false);
 }finally{for(const [key,value] of Object.entries(previous))globalThis[key]=value;dom.window.close();}
});
test('dashboard switches team workspace permissions and owner Brand creation quota correctly',async()=>{
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const dom=new JSDOM('<div id="app"></div><div id="toast"></div><dialog id="editor"></dialog>',{url:'https://mart.test/dashboard',runScripts:'outside-only'}),w=dom.window;
 const imports=[...source.matchAll(/^import \{([^}]+)\}.*$/gm)].flatMap(m=>m[1].split(',').map(s=>s.trim()));for(const name of imports)w[name]=()=>{};
 w.createCatalogViews=()=>({clear(){}});w.createProductEditor=()=>({edit(){},importProduct(){}});w.themes=[{id:'classic',name:'Classic',detail:''}];w.effectiveTheme=()=> 'classic';w.paidThemes=()=>true;w.mountCoverPosition=()=>({});w.guardStoreForm=()=>({cleanup(){},canLeave:()=>true});
 const own={id:'own',owner_id:'self',name:'Own',slug:'own',access:{role:'owner'},published:0},shared={id:'shared',owner_id:'other',name:'Shared',slug:'shared',access:{role:'viewer',plan:{id:'brand',name:'Brand',shops:3,products:500}},published:0};
 const calls=[];w.fetch=async(path,opts)=>{calls.push({path,opts});return {ok:true,json:async()=>path==='/api/me'?{user:{id:'self',email:'self@example.test'},shops:[own,shared],plan:{id:'brand',name:'Brand',shops:3,products:500},capabilities:{}}:path.endsWith('/products')||path.endsWith('/stats')?[]:{}};};
 try{
  w.eval(source.replace(/^import .*$/gm,''));await tick();await tick();
  w.document.querySelector('[data-tab="store"]').click();await tick();await tick();assert.equal(w.document.querySelectorAll('[data-create-shop]').length,2);
  const picker=w.document.querySelector('#shop-picker');picker.value='shared';await picker.onchange({target:picker});
  assert.equal(w.document.querySelectorAll('[data-create-shop]').length,0);assert.equal(w.document.querySelector('#save-store').disabled,true);assert.equal(w.document.querySelector('[name=published]').disabled,true);
  assert.equal(w.document.querySelector('.nav [data-tab="team"]'),null);assert.equal(w.document.querySelector('.nav [data-tab="plans"]'),null);assert.ok(w.document.querySelector('.nav [data-tab="account"]'));assert.ok(w.document.querySelector('.nav [data-tab="help"]'));
  assert.ok(calls.some(c=>c.path==='/api/shops/shared/products'&&c.opts.headers['X-Mart-Shop']==='shared'));
 }finally{w.close();}
});
