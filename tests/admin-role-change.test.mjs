import test from 'node:test';import assert from 'node:assert/strict';import {database} from '../scripts/adapter.mjs';import {hash} from '../src/security.mjs';import worker from '../src/worker.mjs';
test('role changes require Owner, verified active target, exact confirmation and revoke sessions',async()=>{
 const DB=database(),env={DB,APP_ENV:'production'};
 const call=(actor,data)=>worker.fetch(new Request('https://mart.test/api/admin/members',{method:'POST',headers:{Origin:'https://mart.test',Cookie:'mart_session='+actor},body:JSON.stringify({action:'role',user_id:'target',role:'admin',reason:'Appoint support team',confirm_email:'target@test.example',...data})}),env,{});
 try{
 for(const id of ['owner','target','staff']){await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@test.example','hash','free').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(id),id,Math.floor(Date.now()/1000)+3600).run();}await DB.prepare("INSERT INTO admin_roles VALUES('owner','owner'),('staff','admin')").run();
 assert.equal((await call('staff',{})).status,403);assert.equal((await call('target',{})).status,403);assert.equal((await call('owner',{})).status,409);
 await DB.prepare("INSERT INTO user_verifications(user_id) VALUES('target')").run();assert.equal((await call('owner',{confirm_email:'wrong'})).status,400);assert.equal((await call('owner',{role:'bogus'})).status,400);assert.equal((await call('owner',{user_id:'owner',confirm_email:'owner@test.example'})).status,403);
 await DB.prepare("INSERT INTO member_controls(user_id,status) VALUES('target','banned')").run();assert.equal((await call('owner',{})).status,403);await DB.prepare("UPDATE member_controls SET status='active' WHERE user_id='target'").run();
 assert.equal((await call('owner',{})).status,200);assert.equal((await DB.prepare("SELECT role FROM admin_roles WHERE user_id='target'").first()).role,'admin');assert.equal((await DB.prepare("SELECT COUNT(*) n FROM sessions WHERE user_id='target'").first()).n,0);
 assert.equal((await call('owner',{role:'member'})).status,200);assert.equal(await DB.prepare("SELECT role FROM admin_roles WHERE user_id='target'").first(),null);
 assert.equal((await call('owner',{role:'owner'})).status,200);assert.equal((await call('owner',{role:'member'})).status,403);
 assert.equal((await DB.prepare("SELECT COUNT(*) n FROM admin_audit WHERE action='member_role'").first()).n,3);assert.equal((await DB.prepare("SELECT plan_id FROM users WHERE id='target'").first()).plan_id,'free');
 }finally{DB.close();}
});
