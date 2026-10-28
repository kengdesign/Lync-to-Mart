import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountDomains} from '../public/domains.js';
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
test('back navigation keeps active domain connected and never calls mutation API',async()=>{
 const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main'),calls=[];
 await mountDomains({root,shop:{id:'s',name:'Shop'},escape,api:async(...args)=>{calls.push(args);return {limit:1,connection_enabled:true,items:[{id:'d',shop_id:'s',hostname:'shop.example.com',status:'verified',gateway_enabled:true,provider_created:true,connection_reserved:true,verification_token:'token'}]};}});
 assert.equal(root.querySelectorAll('.domain-back-actions').length,3);
 root.querySelector('[data-step-nav="2"]').click();
 assert.equal(root.ownerDocument.activeElement,root.querySelectorAll('.domain-step')[1]);
 assert.equal(calls.length,1);
 assert.equal(root.querySelector('.domain-open').href,'https://shop.example.com/');
 assert.equal(root.querySelectorAll('[data-remove]').length,0);
});
test('future steps stay locked while draft can be edited or canceled',async()=>{
 const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main');
 await mountDomains({root,shop:{id:'s',name:'Shop'},escape,api:async()=>({limit:1,connection_enabled:true,items:[{id:'d',shop_id:'s',hostname:'shop.example.com',status:'pending_dns',verification_token:'token'}]})});
 assert.equal(root.querySelector('[data-step-nav="3"]').disabled,true);
 assert.ok(root.querySelector('[data-edit-domain]'));
 assert.ok(root.querySelector('.domain-back-actions [data-remove]'));
});
