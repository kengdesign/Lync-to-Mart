import {test} from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../scripts/adapter.mjs';
import {hash} from '../src/security.mjs';
import worker from '../src/worker.mjs';
import {effectiveTheme} from '../public/shop-themes.js';
import {effectivePlan} from '../src/plans.mjs';
test('theme entitlement, ownership, persistence, downgrade and staging-only test plan',async()=>{
 const DB=database(),env={DB,APP_ENV:'staging',ASSETS:{fetch:async()=>new Response('asset')}};
 const call=(path,method='GET',data,user='alice')=>worker.fetch(new Request('https://mart.test'+path,{method,headers:{Origin:'https://mart.test',Cookie:'mart_session='+user},...(data?{body:JSON.stringify(data)}:{})}),env,{waitUntil:()=>{}});
 try{
 for(const id of ['alice','bob']){await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@example.test','unused','free').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(id),id,Math.floor(Date.now()/1000)+3600).run();}
 const {id}=await (await call('/api/shops','POST',{name:'Theme test',slug:'theme-test'})).json();
 const save=(theme,user)=>call('/api/shops/'+id,'PUT',{name:'Theme test',published:true,...(theme===undefined?{}:{theme})},user);
 assert.equal((await save('midnight')).status,403);assert.equal((await save('bogus')).status,400);assert.equal((await save('classic','bob')).status,404);
 for(const plan of ['starter','growth','brand']){await DB.prepare('UPDATE users SET plan_id=? WHERE id=?').bind(plan,'alice').run();for(const theme of ['classic','midnight','ocean','sand']){assert.equal((await save(theme)).status,200);const html=await (await call('/shop/theme-test')).text();assert.match(html,new RegExp('data-theme="'+theme+'"'));assert.match(html,/store-themes.css/);assert.match(html,/rel="canonical"/);}}
 await save();assert.equal((await DB.prepare('SELECT theme FROM shops WHERE id=?').bind(id).first()).theme,'sand');
 await DB.prepare("UPDATE users SET plan_id='free' WHERE id='alice'").run();assert.match(await (await call('/shop/theme-test')).text(),/data-theme="classic"/);
 env.STAGING_TEST_PLAN='brand';env.STAGING_TEST_SHOP_ID=id;
 const alice={id:'alice',plan_id:'free'},bob={id:'bob',plan_id:'free'};
 assert.equal((await effectivePlan(env,alice)).id,'brand');assert.equal((await effectivePlan(env,alice)).staging_test,true);assert.equal((await effectivePlan(env,bob)).id,'free');assert.equal((await save('midnight')).status,200);
 env.APP_ENV='production';assert.equal((await effectivePlan(env,alice)).id,'free');assert.equal((await save('ocean')).status,403);assert.match(await (await call('/shop/theme-test')).text(),/data-theme="classic"/);
 assert.equal(effectiveTheme('<script>','brand'),'classic');assert.equal((await DB.prepare("SELECT plan_id FROM users WHERE id='alice'").first()).plan_id,'free');
 }finally{DB.close();}
});
