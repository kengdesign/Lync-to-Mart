import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {renderShopOpening} from '../public/shop-opening.js';
const render=(shop={},isTeam=false)=>new JSDOM('<form>'+renderShopOpening({slug:'demo',published:0,...shop},[],{isTeam,escape:s=>s})+'</form>').window.document;
test('closed shop has explicit submit action at top and draft save keeps it closed',()=>{
 const d=render(),form=d.querySelector('form'),button=d.querySelector('[value="open-shop"]');
 assert.equal(button.type,'submit');assert.equal(form.elements.published.checked,false);
 assert.match(d.body.textContent,/ยังไม่เห็นสินค้า/);
 let submitted=false;form.addEventListener('submit',e=>{e.preventDefault();submitted=e.submitter===button;});button.click();assert.equal(submitted,true);
});
test('open shop exposes real storefront link and closing control',()=>{
 const d=render({published:1});assert.equal(d.querySelector('[value="open-shop"]'),null);
 assert.equal(d.querySelector('a').getAttribute('href'),'/shop/demo');assert.equal(d.querySelector('[name=published]').checked,true);
});
test('team and moderated shops cannot use opening CTA',()=>{
 for(const d of [render({},true),render({moderation_status:'suspended'}),render({moderation_status:'banned'})]){
 assert.equal(d.querySelector('[value="open-shop"]'),null);assert.equal(d.querySelector('[name=published]').disabled,true);
 }
});
