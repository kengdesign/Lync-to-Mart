import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
test('admin shop team button opens roster and can close with keyboard or button',async()=>{
 const dom=new JSDOM(readFileSync('public/admin.html','utf8'),{url:'https://mart.test',runScripts:'outside-only'}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 const tick=()=>new Promise(r=>setTimeout(r,0));
 w.fetch=async url=>({ok:true,json:async()=>String(url).includes('view=team')?{role:'support',shop:{name:'Shop A'},owner_email:'owner@example.test',limit:8,used:1,members:[{email:'staff@example.test',status:'active',enabled:true,grant:{role:'viewer'}}]}:String(url).includes('view=shops')?{role:'support',rows:[{id:'a',name:'Shop A',slug:'a',email:'owner@example.test',effective_plan:'brand',team_count:1,team_used:1,team_limit:8}],page:1,pages:1,total:1}:{role:'support',stats:{}}});
 try{
  w.eval(readFileSync('public/admin.js','utf8').replace(/^import .*;$/gm,''));await tick();w.document.querySelector('[data-view="shops"]').click();await tick();
  assert.match(w.document.querySelector('#admin-results').textContent,/โควตาบัญชี 1 \/ 8/);
  w.document.querySelector('[data-team]').click();await tick();assert.match(w.document.querySelector('dialog').textContent,/staff@example.test/);assert.equal(w.document.querySelector('[data-team-member]'),null);
  w.document.querySelector('[data-close]').click();assert.equal(w.document.querySelector('dialog'),null);
 }finally{w.close();}
});
