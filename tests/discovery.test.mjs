import test from 'node:test';import assert from 'node:assert/strict';
import {database} from '../scripts/adapter.mjs';import worker from '../src/worker.mjs';
test('discovery publishes only public catalog pages, partitions shops and stays closed on staging',async()=>{
 const DB=database(),env={DB,APP_ENV:'production'};
 const call=(path,method='GET')=>worker.fetch(new Request('https://mart.test'+path,{method}),env,{});
 try{
 await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind('u','u@test.example','unused','brand').run();
 for(let i=0;i<102;i++)await DB.prepare('INSERT INTO shops(id,owner_id,slug,name,published) VALUES(?,?,?,?,?)').bind('s'+String(i).padStart(3,'0'),'u','store-'+i,'shop',i===101?0:1).run();
 for(let i=0;i<25;i++)await DB.prepare('INSERT INTO products(id,shop_id,name,source_url,status) VALUES(?,?,?,?,?)').bind('p'+i,'s000','product','https://thaimart.com/test',i===24?'draft':'published').run();
 assert.match(await(await call('/robots.txt')).text(),/Sitemap: https:\/\/mart.test\/sitemap.xml/);
 const index=await(await call('/sitemap.xml')).text();assert.match(index,/shops-2.xml/);assert.doesNotMatch(index,/shops-3.xml/);
 const content=await(await call('/sitemaps/shops-1.xml')).text();assert.match(content,/store-0\?page=2/);assert.doesNotMatch(content,/page=3|preview|sort=|store-101/);
 const second=await(await call('/sitemaps/shops-2.xml')).text();assert.match(second,/store-100/);assert.doesNotMatch(second,/store-101/);
 assert.equal((await call('/sitemaps/shops-3.xml')).status,404);assert.equal(await(await call('/sitemap.xml','HEAD')).text(),'');
 env.APP_ENV='staging';assert.match(await(await call('/robots.txt')).text(),/Disallow: \/\n/);assert.equal((await call('/sitemap.xml')).status,404);assert.equal((await call('/sitemaps/shops-1.xml')).status,404);
 }finally{DB.close();}
});
