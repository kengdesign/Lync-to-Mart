import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../scripts/adapter.mjs';
import {hash} from '../src/security.mjs';
import worker from '../src/worker.mjs';
test('showcases enforce plans, media and product ownership, survive downgrade and hide on catalog navigation',async()=>{
 const DB=database(),env={DB,APP_ENV:'staging'};
 const call=(path,method='GET',data,user='alice',origin='https://mart.test')=>worker.fetch(new Request('https://mart.test'+path,{method,headers:{Origin:origin,Cookie:'mart_session='+user},...(data?{body:JSON.stringify(data)}:{})}),env,{waitUntil:()=>{}});
 const campaign={key:'alice/banner',mobile:'',title:'<script>sale</script>',caption:'รายละเอียดโปรโมชั่น',alt:'สินค้าโปรโมชั่น',product:'',category:'',enabled:true,width:1600,height:800,mobile_width:1,mobile_height:1};
 const payload=n=>({campaigns:Array.from({length:n},()=>({...campaign})),featured:false,newest:false,order:['campaigns','featured','newest']});
 try{
  for(const id of ['alice','bob']){await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@example.test','unused','free').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(id),id,Math.floor(Date.now()/1000)+3600).run();await DB.prepare('INSERT INTO shops(id,owner_id,slug,name,published) VALUES(?,?,?,?,1)').bind(id,id,id+'-shop',id).run();await DB.prepare('INSERT INTO media(key,owner_id,mime,size) VALUES(?,?,?,?)').bind(id+'/campaign',id,'image/webp',100).run();}
  await DB.prepare("INSERT INTO media(key,owner_id,mime,size) VALUES('alice/banner','alice','image/webp',100)").run();
  const publicMedia=()=>worker.fetch(new Request('https://mart.test/media/alice%2Fbanner',{method:'HEAD'}),env,{waitUntil:()=>{}});
  assert.equal((await publicMedia()).status,401);
  for(let i=0;i<14;i++)await DB.prepare('INSERT INTO products(id,shop_id,name,source_url,status,featured,image_key) VALUES(?,?,?,?,?,?,?)').bind('p'+i,'alice','Product '+i,'https://thaimart.com/test',i===13?'draft':'published',1,'alice/campaign').run();
  await DB.prepare("INSERT INTO products(id,shop_id,name,source_url) VALUES('other','bob','other','https://thaimart.com/test')").run();
  const save=data=>call('/api/shops/alice/showcase','PUT',data);
  assert.equal((await save(payload(1))).status,403);
  for(const [plan,max] of [['starter',1],['growth',3],['brand',5]]){
   await DB.prepare('UPDATE users SET plan_id=? WHERE id=?').bind(plan,'alice').run();
   assert.equal((await save(payload(max))).status,200);
   assert.equal((await save(payload(max+1))).status,403);
  }
  let p=payload(1);p.campaigns[0].key='bob/campaign';assert.equal((await save(p)).status,403);
  p=payload(1);p.campaigns[0].product='other';assert.equal((await save(p)).status,400);
  assert.equal((await call('/api/shops/alice/showcase','PUT',payload(1),'bob')).status,404);
  assert.equal((await call('/api/shops/alice/showcase','PUT',payload(1),'alice','https://evil.test')).status,403);
  p=payload(1);p.featured=true;p.newest=true;p.campaigns[0].mobile='alice/campaign';p.order=['newest','campaigns','featured'];
  assert.equal((await save(p)).status,200);
  assert.equal((await publicMedia()).status,200);
  let html=await(await call('/shop/alice-shop')).text();
  assert.match(html,/class="shop-showcase"/);assert.match(html,/&lt;script&gt;sale&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>sale/);
  assert.equal((html.match(/class="showcase-product"/g)||[]).length,16);
  assert.doesNotMatch(html,/Product 13/);assert.match(html,/<source media=/);
  assert.ok(html.indexOf('id="showcase-newest"')<html.indexOf('class="campaign"'));
  for(const query of ['?q=Product','?page=2','?sort=price-asc','?category=none'])assert.doesNotMatch(await(await call('/shop/alice-shop'+query)).text(),/class="shop-showcase"/);
  const stored=(await DB.prepare("SELECT showcase_json FROM shops WHERE id='alice'").first()).showcase_json;
  await DB.prepare("UPDATE users SET plan_id='starter' WHERE id='alice'").run();
  assert.equal((await save(p)).status,403);
  html=await(await call('/shop/alice-shop')).text();assert.equal((html.match(/class="showcase-product"/g)||[]).length,4);assert.doesNotMatch(html,/<source media=/);
  await DB.prepare("UPDATE users SET plan_id='free' WHERE id='alice'").run();
  assert.doesNotMatch(await(await call('/shop/alice-shop')).text(),/class="shop-showcase"/);
  assert.equal((await publicMedia()).status,401);
  assert.equal((await DB.prepare("SELECT showcase_json FROM shops WHERE id='alice'").first()).showcase_json,stored);
  env.STAGING_TEST_PLAN='brand';env.STAGING_TEST_SHOP_ID='alice';assert.equal((await save(p)).status,200);
 }finally{DB.close();}
});
