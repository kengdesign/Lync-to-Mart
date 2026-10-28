import test from 'node:test';import assert from 'node:assert/strict';import {database} from '../scripts/adapter.mjs';import {adminData} from '../src/admin.mjs';
test('domain admin protects access, counts shared account slots, filters and excludes proofs',async()=>{const DB=database(),env={DB,APP_ENV:'production'};try{
 for(const id of ['admin','u'])await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@example.com','hash','brand').run();await DB.prepare('INSERT INTO admin_roles VALUES(?,?)').bind('admin','support').run();
 for(const id of ['s1','s2']){await DB.prepare('INSERT INTO shops(id,owner_id,name,slug) VALUES(?,?,?,?)').bind(id,'u',id,id).run();await DB.prepare('INSERT INTO domain_intents(id,owner_id,shop_id,hostname,token,created_at,expires_at) VALUES(?,?,?,?,?,?,?)').bind(id,'u',id,id+'.example.com','private-proof',1,9999999999).run();}
 await assert.rejects(adminData(env,{id:'u'},new URL('https://x/?view=domains')),/ไม่มีสิทธิ์/);
 const d=await adminData(env,{id:'admin'},new URL('https://x/?view=domains'));assert.equal(d.total,2);assert.equal(d.rows[0].used,2);assert.equal(d.rows[0].limit,5);assert.doesNotMatch(JSON.stringify(d),/private-proof|provider_id/);
 assert.equal((await adminData(env,{id:'admin'},new URL('https://x/?view=domains&q=s1.example.com'))).total,1);
 assert.equal((await adminData(env,{id:'admin'},new URL('https://x/?view=domains&domain_state=active'))).total,0);
 const shops=await adminData(env,{id:'admin'},new URL('https://x/?view=shops'));assert.equal(shops.rows[0].domain_used,2);assert.equal(shops.rows[0].domains.length,1);
 }finally{DB.close();}});
