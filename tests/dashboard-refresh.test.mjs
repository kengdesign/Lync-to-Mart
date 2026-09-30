import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const tick=()=>new Promise(r=>setTimeout(r,0));
test('navigation reads fresh store state and an older response cannot overwrite a newer refresh',async()=>{
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const dom=new JSDOM('<div id="app"></div><div id="toast"></div><dialog id="editor"></dialog>',{url:'https://mart.test/dashboard',runScripts:'outside-only'}),w=dom.window;
 for(const m of source.matchAll(/^import \{([^}]+)\}.*$/gm))for(const n of m[1].split(','))w[n.trim()]=()=>{};
 w.createCatalogViews=()=>({clear(){}});w.createProductEditor=()=>({});w.themes=[{id:'classic',name:'Classic'}];w.effectiveTheme=()=> 'classic';w.paidThemes=()=>true;w.mountCoverPosition=()=>({});w.guardStoreForm=()=>({cleanup(){},canLeave:()=>true});
 const shop={id:'s',name:'Before',slug:'shop',owner_id:'u',access:{role:'owner'},published:0};
 const me=()=>({user:{id:'u',email:'u@example.test'},shops:[{...shop}],plan:{id:'free',name:'Free',shops:1,products:10},capabilities:{}});
 let hold=false,release;const modes=[];
 w.fetch=async(path,options)=>{modes.push(options.cache);if(path==='/api/me'){const value=me();if(hold){hold=false;await new Promise(r=>release=r);}return {ok:true,json:async()=>value};}return {ok:true,json:async()=>path.endsWith('/products')||path.endsWith('/stats')?[]:{}};};
 try{
  w.eval(source.replace(/^import .*$/gm,'')+'\nwindow.reloadMart=load;');await tick();await tick();
  shop.name='Updated';await w.document.querySelector('[data-tab="store"]').onclick();
  assert.equal(w.document.querySelector('[name=name]').value,'Updated');assert.ok(w.document.querySelector('#go-publish-store'));
  hold=true;shop.name='Old response';const old=w.reloadMart();await tick();
  shop.name='Newest';shop.published=1;await w.reloadMart();release();await old;
  assert.equal(w.document.querySelector('[name=name]').value,'Newest');assert.equal(w.document.querySelector('#go-publish-store'),null);assert.equal(w.document.querySelector('[name=published]').checked,true);
  assert.ok(modes.every(mode=>mode==='no-store'));
 }finally{w.close();}
});
