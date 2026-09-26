import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import {shopShare} from '../src/share.mjs';
import {database} from '../scripts/adapter.mjs';
import {hash} from '../src/security.mjs';
import worker from '../src/worker.mjs';
test('QR decodes to exact public storefront URL, including longest supported slug',()=>{
 for(const slug of ['chaba01','a'.repeat(50)]){
  const data=shopShare({slug,published:1},'https://lync-to-mart-staging.paiboon.workers.dev');
  const scale=5,size=(data.modules.length+8)*scale,pixels=new Uint8ClampedArray(size*size*4).fill(255);
  data.modules.forEach((row,y)=>row.forEach((dark,x)=>{if(dark)for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){const i=(((y+4)*scale+dy)*size+(x+4)*scale+dx)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;}}));
  assert.equal(jsQR(pixels,size,size)?.data,data.url);
  assert.equal(data.url,'https://lync-to-mart-staging.paiboon.workers.dev/shop/'+slug);
  assert.match(data.svg,/<svg/);assert.doesNotMatch(data.svg,/<script|<foreignObject/);
 }
});
test('share endpoint requires owner and reports publication state without creating events',async()=>{
 const DB=database(),env={DB};
 const call=(user)=>worker.fetch(new Request('https://mart.test/api/shops/shop1/share',{headers:user?{Cookie:'mart_session='+user}:{}}),env,{});
 try{
  for(const id of ['alice','bob']){await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@example.test','unused','free').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(id),id,Math.floor(Date.now()/1000)+3600).run();}
  await DB.prepare('INSERT INTO shops(id,owner_id,slug,name) VALUES(?,?,?,?)').bind('shop1','alice','chaba01','ชบา').run();
  assert.equal((await call()).status,401);assert.equal((await call('bob')).status,404);
  let r=await call('alice');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');let data=await r.json();assert.equal(data.published,false);assert.equal(data.url,'https://mart.test/shop/chaba01');
  await DB.prepare('UPDATE shops SET published=1 WHERE id=?').bind('shop1').run();data=await(await call('alice')).json();assert.equal(data.published,true);
  assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM events').first()).n,0);
 }finally{DB.close();}
});
