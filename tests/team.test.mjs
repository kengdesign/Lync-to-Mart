import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../scripts/adapter.mjs';
import {hash,passwordHash} from '../src/security.mjs';
import worker from '../src/worker.mjs';
const rights={role:'editor',products:true,publish:false,store:false,campaigns:false};
async function fixture(){
 const DB=database(),mail=[],password=await passwordHash('test-password-12345');
 const env={DB,APP_ENV:'production',CHECKOUT_HOSTS:'thaimart.com',POSTMARK_SERVER_TOKEN:'test',MAIL_FROM:'team@example.test',RECOVERY_ORIGIN:'https://mart.test',MAIL_FETCH:async(u,o)=>{mail.push(JSON.parse(o.body));return Response.json({ErrorCode:0});},MEDIA:{get:async()=>({body:new Uint8Array([1])}),put:async()=>{}},ASSETS:{fetch:async()=>new Response('asset')}};
 for(const [id,plan] of [['owner','brand'],['staff','free'],['outsider','free'],['other','brand']]){
  await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@example.test',password,plan).run();
  await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(id),id,Math.floor(Date.now()/1000)+3600).run();
 }
 for(const [id,owner] of [['shop-a','owner'],['shop-b','owner'],['shop-c','owner'],['shop-z','other']])await DB.prepare('INSERT INTO shops(id,owner_id,slug,name) VALUES(?,?,?,?)').bind(id,owner,id,id).run();
 const call=async(path,method='GET',data,actor='owner',shop)=>worker.fetch(new Request('https://mart.test/api'+path,{method,headers:{Origin:'https://mart.test',...(actor?{Cookie:'mart_session='+actor}:{}),...(shop?{'X-Mart-Shop':shop}:{})},...(data!==undefined?{body:JSON.stringify(data)}:{})}),env,{});
 const invite=async(email='staff@example.test',grants={'shop-a':rights})=>{const res=await call('/team','POST',{action:'invite',email,grants});assert.equal(res.status,200,await res.clone().text());return mail.at(-1).TextBody.match(/token=([a-f0-9]{64})/)[1];};
 return {DB,env,mail,call,invite,close:()=>DB.close()};
}
test('email invitation is single use, requires matching login, scopes products, media and owner-only operations',async()=>{
 const f=await fixture(),{DB,call,invite}=f;
 try{
  const token=await invite();assert.equal((await call('/team-invite/accept','POST',{token},'outsider')).status,401);
  assert.equal((await call('/team-invite/accept','POST',{token},null)).status,401);
  assert.equal((await call('/team-invite/accept','POST',{token},'staff')).status,200);
  assert.equal((await call('/team-invite/accept','POST',{token},'staff')).status,410);
  const me=await (await call('/me','GET',undefined,'staff')).json();assert.deepEqual(me.shops.map(s=>s.id),['shop-a']);assert.equal(me.shops[0].access.plan.id,'brand');assert.equal(me.user.id,'staff');
  assert.equal((await call('/shops/shop-b/products','GET',undefined,'staff','shop-b')).status,404);
  assert.equal((await call('/shops/shop-z/products','GET',undefined,'staff','shop-a')).status,403);
  for(const path of ['/billing/status','/billing/history','/usage'])assert.equal((await call(path,'GET',undefined,'staff','shop-a')).status,403);
  assert.equal((await call('/shops','POST',{name:'Bad',slug:'bad'},'staff','shop-a')).status,403);
  assert.equal((await call('/admin','GET',undefined,'staff')).status,403);
  assert.equal((await call('/account/sessions','GET',undefined,'staff','shop-a')).status,200);
  const product={name:'Item',source_url:'https://thaimart.com/products/aaaaaaaaaaaaaaaaaaaaaaaa',status:'draft',gallery:[]};
  const create=await call('/shops/shop-a/products','POST',product,'staff','shop-a');assert.equal(create.status,201,await create.clone().text());const {id}=await create.json();
  assert.equal((await call('/products/'+id,'PUT',{...product,status:'published'},'staff','shop-a')).status,403);
  assert.equal((await call('/products/'+id,'PUT',product,'staff','shop-b')).status,403);
  await DB.prepare("UPDATE products SET status='published' WHERE id=?").bind(id).run();
  assert.equal((await call('/products/'+id,'PUT',product,'staff','shop-a')).status,403);
  assert.equal((await call('/products/'+id,'DELETE',undefined,'staff','shop-a')).status,403);
  assert.equal((await call('/shops/shop-a/bulk-category','POST',{ids:[id],category:'New'},'staff','shop-a')).status,403);
  assert.equal((await call('/shops/shop-a','PUT',{name:'Changed',published:false},'staff','shop-a')).status,403);
  await DB.prepare("INSERT INTO media VALUES('owner/private','owner','image/png',1)").run();
  assert.equal((await call('/products/'+id,'GET',undefined,'staff','shop-a')).status,200);
  const privateImage=()=>worker.fetch(new Request('https://mart.test/media/owner%2Fprivate',{headers:{Cookie:'mart_session=staff'}}),f.env,{});
  assert.equal((await privateImage()).status,404);
  await DB.prepare("INSERT INTO team_media VALUES('owner/private','shop-a')").run();assert.equal((await privateImage()).status,200);
  const member=(await (await call('/team')).json()).members[0];
  assert.equal((await call('/team','POST',{action:'update',id:member.id,grants:{'shop-a':{...rights,publish:true,store:true}}})).status,200);
  assert.equal((await call('/products/'+id,'PUT',{...product,gallery:[{key:'owner/private',alt:'cover'}],status:'published'},'staff','shop-a')).status,200);
  await DB.prepare("INSERT INTO media VALUES('owner/other','owner','image/png',1)").run();
  assert.equal((await call('/products/'+id,'PUT',{...product,gallery:[{key:'owner/other'}]},'staff','shop-a')).status,403);
  assert.equal((await call('/shops/shop-a','PUT',{name:'Changed',published:true},'staff','shop-a')).status,403);
  assert.equal((await call('/products/'+id,'DELETE',undefined,'staff','shop-a')).status,200);
  assert.equal((await call('/trash/'+id,'DELETE',undefined,'staff','shop-a')).status,403);
  assert.equal((await call('/trash/'+id+'/restore','POST',{},'staff','shop-a')).status,200);
  assert.equal((await call('/team','POST',{action:'revoke',id:member.id})).status,200);
  assert.equal((await call('/shops/shop-a/products','GET',undefined,'staff','shop-a')).status,404);
  assert.equal((await privateImage()).status,404);
  assert.ok((await (await call('/team')).json()).audit.some(a=>a.actor==='staff@example.test'&&a.action.startsWith('POST')));
 }finally{f.close();}
});
test('new invited account sets its own password; expired/revoked invites and mail failures do not grant access',async()=>{
 const f=await fixture(),{DB,call,invite,env}=f;
 try{
  const token=await invite('new@example.test',{'shop-a':{role:'viewer'}});
  assert.equal((await call('/team-invite/info','POST',{token},null)).status,200);
  assert.equal((await call('/team-invite/accept','POST',{token,password:'short',confirm_password:'short'},null)).status,400);
  assert.equal((await call('/team-invite/accept','POST',{token,password:'new-password-1234',confirm_password:'new-password-1234'},null)).status,200);
  const login=await call('/login','POST',{email:'new@example.test',password:'new-password-1234'},null);assert.equal(login.status,200);
  const u=await DB.prepare("SELECT * FROM users WHERE email='new@example.test'").first();assert.equal(u.plan_id,'free');
  assert.equal((await DB.prepare('SELECT COUNT(*) n FROM user_verifications WHERE user_id=?').bind(u.id).first()).n,1);
  const expired=await invite('expired@example.test');await DB.prepare("UPDATE shop_team SET expires=0 WHERE email='expired@example.test'").run();assert.equal((await call('/team-invite/info','POST',{token:expired},null)).status,410);
  env.MAIL_FETCH=async()=>Response.json({ErrorCode:400},{status:422});assert.equal((await call('/team','POST',{action:'invite',email:'fail@example.test',grants:{'shop-a':rights}})).status,503);
  assert.equal((await DB.prepare("SELECT status FROM shop_team WHERE email='fail@example.test'").first()).status,'revoked');
 }finally{f.close();}
});
test('quota counts people once across Brand three shops, reserves pending seats, and enforces downgrade on existing sessions',async()=>{
 const f=await fixture(),{DB,call,invite}=f;
 try{
  const token=await invite('staff@example.test',{'shop-a':rights,'shop-b':rights,'shop-c':rights});await call('/team-invite/accept','POST',{token},'staff');
  for(let i=0;i<7;i++)await invite('person'+i+'@example.test');
  assert.equal((await call('/team','POST',{action:'invite',email:'overflow@example.test',grants:{'shop-a':rights}})).status,409);
  assert.equal((await (await call('/team')).json()).members.length,8);
  assert.equal((await (await call('/me','GET',undefined,'staff')).json()).shops.length,3);
  await DB.prepare("UPDATE users SET plan_id='starter' WHERE id='owner'").run();
  assert.equal((await call('/shops/shop-a/products','GET',undefined,'staff')).status,404);
  assert.equal((await (await call('/me','GET',undefined,'staff')).json()).shops.length,0);
  await DB.prepare("UPDATE users SET plan_id='growth' WHERE id='owner'").run();
  const list=await (await call('/team')).json();assert.equal(list.limit,3);assert.equal(list.members.filter(m=>m.enabled).length,3);
  assert.equal((await DB.prepare("SELECT COUNT(*) n FROM shops WHERE owner_id='owner'").first()).n,3);
  assert.equal((await call('/team','POST',{action:'invite',email:'bad@example.test',grants:{'shop-z':rights}})).status,403);
 }finally{f.close();}
});
test('viewer cannot mutate via any shop route and invite requires staging allowlist',async()=>{
 const f=await fixture(),{call,invite,env}=f;
 try{
  const token=await invite('staff@example.test',{'shop-a':{role:'viewer',products:true,publish:true}});await call('/team-invite/accept','POST',{token},'staff');
  for(const [path,method,data] of [['/shops/shop-a/products','POST',{}],['/shops/shop-a/showcase','PUT',{}],['/shops/shop-a','PUT',{}],['/import','POST',{}],['/media/import','POST',{}]])assert.equal((await call(path,method,data,'staff','shop-a')).status,403,path);
  env.APP_ENV='staging';assert.equal((await call('/team','POST',{action:'invite',email:'blocked@example.test',grants:{'shop-a':rights}})).status,403);
 }finally{f.close();}
});
test('store and campaign scopes are independent; team uploads belong to owner quota and one shop',async()=>{
 const f=await fixture(),{DB,call,invite,env}=f;
 try{
  const token=await invite('staff@example.test',{'shop-a':{role:'editor',store:true}});await call('/team-invite/accept','POST',{token},'staff');
  assert.equal((await call('/shops/shop-a','PUT',{name:'Updated',published:false},'staff','shop-a')).status,200);
  assert.equal((await call('/shops/shop-a/products','POST',{},'staff','shop-a')).status,403);
  const campaign={campaigns:[],featured:false,newest:false,order:['campaigns','featured','newest']};
  assert.equal((await call('/shops/shop-a/showcase','PUT',campaign,'staff','shop-a')).status,403);
  const upload=await worker.fetch(new Request('https://mart.test/api/media',{method:'POST',headers:{Origin:'https://mart.test',Cookie:'mart_session=staff','X-Mart-Shop':'shop-a'},body:new Uint8Array([137,80,78,71,13,10,26,10])}),env,{});
  assert.equal(upload.status,201);const {key}=await upload.json();
  assert.equal((await DB.prepare('SELECT owner_id FROM media WHERE key=?').bind(key).first()).owner_id,'owner');
  assert.equal((await DB.prepare('SELECT shop_id FROM team_media WHERE key=?').bind(key).first()).shop_id,'shop-a');
  const member=(await (await call('/team')).json()).members[0];await call('/team','POST',{action:'update',id:member.id,grants:{'shop-a':{role:'editor',campaigns:true}}});
  assert.equal((await call('/shops/shop-a/showcase','PUT',campaign,'staff','shop-a')).status,200);
  assert.equal((await call('/shops/shop-a','PUT',{name:'Updated',published:false},'staff','shop-a')).status,403);
 }finally{f.close();}
});
