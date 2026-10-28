import test from 'node:test';
import assert from 'node:assert/strict';
import {mountDomains} from '../public/domains.js';
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
async function render(data){const nodes={};const root={isConnected:true,innerHTML:'',querySelector:s=>nodes[s]??=( {} ),querySelectorAll:()=>[]};await mountDomains({root,api:async()=>data,shop:{id:'s',name:'Test'},escape});return root.innerHTML;}
test('Free renders locked fieldset and paid entitlement explanation',async()=>{const html=await render({limit:0,items:[]});assert.match(html,/<fieldset disabled/);assert.match(html,/Starter 1 \/ Growth 2 \/ Brand 5/);});
test('ownership verification never implies DNS routing or HTTPS is active',async()=>{const html=await render({limit:1,items:[{id:'d',hostname:'example.com',verification_token:'token',status:'verified',checked_at:1}]});assert.match(html,/ผ่านแล้ว/);assert.match(html,/เชื่อมปลายทางร้าน: ยังไม่เปิดให้ทดสอบ/);assert.match(html,/เปิด HTTPS: ยังไม่เริ่ม/);assert.match(html,/ตรวจครั้งล่าสุด/);assert.doesNotMatch(html,/เชื่อมต่อสำเร็จ/);});
