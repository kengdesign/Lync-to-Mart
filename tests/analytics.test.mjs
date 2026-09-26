import test from 'node:test';import assert from 'node:assert/strict';
import {database} from '../scripts/adapter.mjs';import {hash} from '../src/security.mjs';import worker from '../src/worker.mjs';
test('owner analytics uses inclusive Thai date windows, isolates shops and retains deleted product clicks',async()=>{
 const DB=database(),env={DB,CHECKOUT_HOSTS:'thaimart.com',APP_ENV:'staging'};
 const call=(path,method='GET',data,user='alice')=>worker.fetch(new Request('https://mart.test'+path,{method,headers:{Origin:'https://mart.test',...(user?{Cookie:'mart_session='+user}:{})},...(data?{body:JSON.stringify(data)}:{})}),env,{waitUntil(){}});
 try{
  for(const id of ['alice','bob']){await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@example.test','unused','free').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(id),id,Math.floor(Date.now()/1000)+3600).run();}
  const {id:shop}=await(await call('/api/shops','POST',{name:'ร้าน',slug:'test-shop'})).json();
  const {id:other}=await(await call('/api/shops','POST',{name:'Other',slug:'other-shop'},'bob')).json();
  let sourceId=1;const create=async name=>(await(await call('/api/shops/'+shop+'/products','POST',{name,source_url:'https://thaimart.com/products/'+String(sourceId++).padStart(24,'0'),status:'published'})).json()).id;
  const first=await create('A'),zero=await create('B'),deleted=await create('Deleted');
  const add=async(product,offset,kind='buy_click',shopId=shop)=>DB.prepare("INSERT INTO events(id,shop_id,product_id,kind,day) VALUES(?,?,?,?,date('now','+7 hours',?))").bind(crypto.randomUUID(),shopId,product,kind,offset+' days').run();
  await add(first,0);await add(first,-6);await add(first,-7);await add(first,-29);await add(first,-30);await add(first,1);await add(first,0,'view');await add(first,0,'buy_click',other);await add(deleted,0);
  await call('/api/products/'+deleted,'DELETE');
  const endpoint='/api/shops/'+shop+'/analytics';
  const seven=await(await call(endpoint+'?days=7')).json();assert.equal(seven.total,3);assert.equal(seven.products.find(p=>p.id===first).clicks,2);assert.equal(seven.products.find(p=>p.id===zero).clicks,0);assert.equal(seven.products.find(p=>p.id===deleted).status,'deleted');
  const thirty=await(await call(endpoint)).json();assert.equal(thirty.days,30);assert.equal(thirty.total,5);assert.equal(thirty.end,new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'}));
  assert.equal((await call(endpoint+'?days=8')).status,400);assert.equal((await call(endpoint,'GET',null,'bob')).status,404);assert.equal((await call(endpoint,'GET',null,null)).status,401);
  const empty=await(await call('/api/shops/'+other+'/analytics?days=7','GET',null,'bob')).json();assert.equal(empty.total,1);assert.equal(empty.products[0].name,'สินค้าที่ลบแล้ว');
 }finally{DB.close();}
});
