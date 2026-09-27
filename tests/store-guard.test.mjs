import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {guardStoreForm} from '../public/store-guard.js';
test('store guard tracks cover position, media, SEO and publish state; busy navigation and unload stay protected',()=>{
 const dom=new JSDOM('<form><input name="name" value="ร้าน"><input type="hidden" name="cover_position_y" value="50"><input type="hidden" name="cover_key"><textarea name="seo_description"></textarea><input type="checkbox" name="published"><input type="file"></form>'),form=dom.window.document.querySelector('form');let busy=false,accept=false,questions=0,notices=0;
 const guard=guardStoreForm({form,isBusy:()=>busy,notify:()=>notices++,confirmDiscard:()=>{questions++;return accept;}}),unload=()=>{const ev=new dom.window.Event('beforeunload',{cancelable:true});dom.window.dispatchEvent(ev);return ev.defaultPrevented;};
 assert.equal(guard.canLeave(),true);assert.equal(questions,0);
 for(const key of ['name','cover_position_y','cover_key','seo_description']){const field=form.elements[key],before=field.value;field.value='เปลี่ยน';assert.equal(guard.canLeave(),false);assert.equal(unload(),true);field.value=before;assert.equal(guard.canLeave(),true);}
 form.elements.published.checked=true;assert.equal(guard.canLeave(),false);accept=true;assert.equal(guard.canLeave(),true);guard.markSaved();assert.equal(unload(),false);
 busy=true;const previous=questions;assert.equal(guard.canLeave(),false);assert.equal(questions,previous);assert.equal(notices,1);assert.equal(unload(),true);busy=false;
 form.elements.cover_key.value='new';guard.cleanup();assert.equal(unload(),false);form.remove();assert.equal(guard.canLeave(),true);dom.window.close();
});
