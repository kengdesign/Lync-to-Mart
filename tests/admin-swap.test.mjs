import test from 'node:test';import assert from 'node:assert/strict';import {database} from '../scripts/adapter.mjs';import {hash} from '../src/security.mjs';import worker from '../src/worker.mjs';
test('owner swap is session-bound, read-only, audited, expiring and revocable',async()=>{
 const DB=database(),env={DB,APP_ENV:'staging'},ctx={waitUntil(){}};
 const call=(path,token='owner',swap='',method='GET',body={},origin='https://mart.test')=>worker.fetch(new Request('https://mart.test'+path,{method,headers:{Origin:origin,Cookie:'mart_session='+token+(swap?'; mart_swap='+swap:'')},...(method==='POST'?{body:JSON.stringify(body)}:{})}),env,ctx);
 try{
 for(const id of ['owner','admin','support','seller']){await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@test.example','hidden','free').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(id),id,Math.floor(Date.now()/1000)+3600).run();}
 for(const role of ['owner','admin','support'])await DB.prepare('INSERT INTO admin_roles VALUES(?,?)').bind(role,role).run();
 await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash('owner-other'),'owner',Math.floor(Date.now()/1000)+3600).run();
 await DB.prepare('INSERT INTO shops(id,owner_id,slug,name) VALUES(?,?,?,?)').bind('seller-shop','seller','seller-shop','Seller').run();
 const input={shop_id:'seller-shop',reason:'ตรวจปัญหาสินค้าตามที่แจ้ง'};
 for(const actor of ['admin','support','seller'])assert.equal((await call('/api/admin/swap/start',actor,'','POST',input)).status,403);
 assert.equal((await call('/api/admin/swap/start','owner','','POST',input,'https://evil.test')).status,403);
 assert.equal((await call('/api/admin/swap/start','owner','','POST',{...input,reason:''})).status,400);
 const start=await call('/api/admin/swap/start','owner','','POST',input);assert.equal(start.status,200);assert.match(start.headers.get('set-cookie'),/HttpOnly; SameSite=Strict; Path=\/; Max-Age=1800; Secure/);const token=start.headers.get('set-cookie').match(/mart_swap=([^;]+)/)[1];
 const me=await (await call('/api/me','owner',token)).json();assert.equal(me.user.id,'seller');assert.equal(me.impersonation.read_only,true);assert.equal(me.shops[0].id,'seller-shop');
 assert.equal((await call('/api/me','owner-other',token)).status,409);
 assert.equal((await call('/api/me','seller',token)).status,409);
 for(const path of ['/api/shops','/api/account/password','/api/account/logout-others','/api/media','/api/forgot-password'])assert.equal((await call(path,'owner',token,'POST',{})).status,403);
 assert.equal((await call('/api/account/sessions','owner',token)).status,403);
 assert.equal((await call('/api/admin','owner',token)).status,200);
 assert.equal((await DB.prepare("SELECT COUNT(*) n FROM admin_audit WHERE action='swap_start'").first()).n,1);
 await DB.prepare("UPDATE admin_roles SET role='support' WHERE user_id='owner'").run();assert.equal((await call('/api/me','owner',token)).status,409);
 await DB.prepare("UPDATE admin_roles SET role='owner' WHERE user_id='owner'").run();await DB.prepare('UPDATE admin_swaps SET expires=0').run();assert.equal((await call('/api/me','owner',token)).status,409);
 const stop=await call('/api/admin/swap/stop','owner',token,'POST');assert.equal(stop.status,200);assert.match(stop.headers.get('set-cookie'),/Max-Age=0/);assert.equal((await DB.prepare('SELECT COUNT(*) n FROM admin_swaps').first()).n,0);
 assert.equal((await DB.prepare("SELECT COUNT(*) n FROM admin_audit WHERE action='swap_stop'").first()).n,1);
 assert.equal((await (await call('/api/me')).json()).user.id,'owner');
 const again=await call('/api/admin/swap/start','owner','','POST',input);const t=again.headers.get('set-cookie').match(/mart_swap=([^;]+)/)[1];await call('/api/logout','owner',t,'POST');assert.equal((await call('/api/me')).status,200);assert.equal((await DB.prepare("SELECT COUNT(*) n FROM sessions WHERE user_id='seller'").first()).n,1);
 }finally{DB.close();}
});
