import test from 'node:test';import assert from 'node:assert/strict';import {database} from '../scripts/adapter.mjs';import {hash} from '../src/security.mjs';import worker from '../src/worker.mjs';
test('audit is owner-only, searchable, paginated and retains deleted entity records',async()=>{
 const DB=database(),env={DB,APP_ENV:'production'};
 const call=(id,query='')=>worker.fetch(new Request('https://mart.test/api/admin?view=audit'+query,{headers:{Cookie:'mart_session='+id}}),env,{});
 try{
 for(const id of ['owner','admin','support','seller']){await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@test.example','secret-hash','free').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(id),id,Math.floor(Date.now()/1000)+3600).run();if(id!=='seller')await DB.prepare('INSERT INTO admin_roles VALUES(?,?)').bind(id,id).run();}
 for(const id of ['admin','support','seller','unknown'])assert.ok([401,403].includes((await call(id)).status));
 for(let i=0;i<27;i++)await DB.prepare('INSERT INTO admin_audit(id,actor_id,target_id,shop_id,action,reason) VALUES(?,?,?,?,?,?)').bind('event-'+String(i).padStart(2,'0'),'owner','deleted-user','deleted-shop','swap_start',i===26?'ตรวจรูปภาพ <script>':'support').run();
 const first=await(await call('owner')).json();assert.equal(first.total,27);assert.equal(first.rows.length,25);assert.equal(first.rows[0].id,'event-26');assert.equal(first.rows[0].shop_name,null);assert.equal(first.rows[0].actor_email,'owner@test.example');assert.equal((await(await call('owner','&page=2')).json()).rows.length,2);
 assert.equal((await(await call('owner','&q='+encodeURIComponent('ตรวจรูปภาพ'))).json()).total,1);assert.equal((await(await call('owner','&q=%25')).json()).total,0);assert.equal((await(await call('owner','&q=deleted-shop')).json()).total,27);assert.doesNotMatch(JSON.stringify(first),/secret-hash|token_hash/);
 }finally{DB.close();}
});
