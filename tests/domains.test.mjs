import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../scripts/adapter.mjs';
import {domainRequest,normalizeDomain} from '../src/domains.mjs';
test('domain preparation enforces ownership, quotas and TXT; never provisions remote hostnames',async()=>{
 const DB=database(),env={DB},u={id:'u'};
 try{
 await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind('u','u@test.invalid','unused','starter').run();
 for(const id of ['a','b'])await DB.prepare('INSERT INTO shops(id,owner_id,name,slug) VALUES(?,?,?,?)').bind(id,'u',id,id).run();
 const call=(method,data,user=u,plan='starter')=>domainRequest(env,user,{id:plan},null,method,data);
 await assert.rejects(call('POST',{shop_id:'a',hostname:'shop.example.com'},u,'free'),/Starter/);
 let data=await call('POST',{shop_id:'a',hostname:'shop.example.com'});assert.equal(data.connection_enabled,false);assert.equal(data.items.length,1);
 await assert.rejects(call('POST',{shop_id:'b',hostname:'other.example.com'}),/โควตา/);
 await assert.rejects(call('GET',{}, {...u,team:{}}),/เจ้าของ/);
 const row=data.items[0];data=await domainRequest(env,u,{id:'starter'},null,'POST',{action:'check',id:row.id},async()=>Response.json({Status:0,Answer:[{type:16,data:JSON.stringify(row.verification_token)}]}));
 assert.equal(data.items[0].status,'verified');assert.equal(data.connection_enabled,false);
 await assert.rejects(call('POST',{action:'check',id:row.id}),/1 นาที/);
 data=await call('DELETE',{id:row.id});assert.equal(data.items.length,0);
 for(const bad of ['https://example.com','127.0.0.1','mart.lyncto.link','a.workers.dev','foo/bar'])assert.throws(()=>normalizeDomain(bad));
 }finally{DB.close();}
});
