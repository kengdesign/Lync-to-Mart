import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {analyticsCSV,mountProductAnalytics} from '../public/product-analytics.js';
const report=(name='สินค้า')=>({start:'2026-09-20',end:'2026-09-26',total:4,products:[{id:'p1',name,status:'published',clicks:4},{id:'old',name:'สินค้าที่ลบแล้ว',status:'deleted',clicks:0}]});
test('CSV preserves Thai, quotes, multiline text, date scope and neutralizes spreadsheet formulas',()=>{
 const data=report('ไทย, "พิเศษ"\nบรรทัดใหม่'),csv=analyticsCSV(data,'shop');assert.ok(csv.startsWith('\uFEFF'));assert.match(csv,/"ไทย, ""พิเศษ""\nบรรทัดใหม่"/);assert.match(csv,/Asia\/Bangkok/);assert.match(csv,/2026-09-20/);assert.match(csv,/ลบแล้ว/);assert.match(csv,/ไม่ใช่จำนวนลูกค้า/);assert.match(csv,/,"4",/);assert.match(csv,/,"0",/);
 for(const name of ['=HYPERLINK("evil")','+SUM(1)','-1+2','@SUM(1)',' \t=1'])assert.ok(analyticsCSV(report(name),'shop').includes('"\''+name.replaceAll('"','""')+'"'));
 assert.equal(analyticsCSV({...data,products:[]},'shop').split('\r\n').length,2);
});
test('export is locked during loading and failure, ignores stale responses and exports selected period',async()=>{
 const dom=new JSDOM('<section></section>'),root=dom.window.document.querySelector('section'),requests=[],files=[];
 mountProductAnalytics({root,shopId:'shop',api:path=>new Promise((resolve,reject)=>requests.push({path,resolve,reject})),download:(text,name)=>files.push({text,name})});
 const button=root.querySelector('[data-export]'),select=root.querySelector('[data-days]');assert.ok(button.disabled);
 select.value='7';select.onchange();requests[1].resolve(report('ล่าสุด'));await new Promise(r=>setTimeout(r,0));assert.equal(button.disabled,false);requests[0].resolve(report('เก่า'));await new Promise(r=>setTimeout(r,0));button.click();assert.match(files[0].text,/ล่าสุด/);assert.doesNotMatch(files[0].text,/"เก่า"/);assert.match(files[0].name,/2026-09-20-2026-09-26.csv$/);
 select.value='30';select.onchange();assert.ok(button.disabled);requests[2].reject(new Error('offline'));await new Promise(r=>setTimeout(r,0));assert.ok(button.disabled);button.click();assert.equal(files.length,1);
 root.querySelector('[data-retry]').click();requests[3].resolve({...report(),products:[]});await new Promise(r=>setTimeout(r,0));assert.ok(button.disabled);dom.window.close();
});
