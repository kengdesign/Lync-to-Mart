import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {guardUnsavedChanges} from '../public/unsaved-changes.js';
test('unsaved guard protects close/Escape/reload, accepts revert and cleans listeners',()=>{
 const dom=new JSDOM('<dialog open></dialog>'),modal=dom.window.document.querySelector('dialog');let value='original',busy=false,answer=false,questions=0;
 const guard=guardUnsavedChanges({modal,snapshot:()=>value,isBusy:()=>busy,confirmDiscard:()=>{questions++;return answer;}});
 const event=type=>{const ev=new dom.window.Event(type,{cancelable:true});(type==='cancel'?modal:dom.window).dispatchEvent(ev);return ev.defaultPrevented;};
 assert.equal(guard.canClose(),true);assert.equal(questions,0);value='edited';assert.equal(guard.canClose(),false);assert.equal(event('cancel'),true);assert.equal(event('beforeunload'),true);answer=true;assert.equal(guard.canClose(),true);
 value='original';assert.equal(event('beforeunload'),false);busy=true;const previous=questions;assert.equal(guard.canClose(),false);assert.equal(questions,previous);assert.equal(event('beforeunload'),true);busy=false;
 value='saved';guard.markSaved();assert.equal(event('beforeunload'),false);value='later';modal.dispatchEvent(new dom.window.Event('close'));assert.equal(event('beforeunload'),false);dom.window.close();
});
test('imported but unconfirmed content warns without edits and save clears the warning',()=>{
 const dom=new JSDOM('<dialog open></dialog>'),modal=dom.window.document.querySelector('dialog');const guard=guardUnsavedChanges({modal,snapshot:()=>'',pending:true,confirmDiscard:()=>false});assert.equal(guard.canClose(),false);guard.markSaved();assert.equal(guard.canClose(),true);guard.cleanup();dom.window.close();
});
