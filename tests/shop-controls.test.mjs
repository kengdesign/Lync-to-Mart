import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../scripts/adapter.mjs';
import {manageShop} from '../src/shop-controls.mjs';
test('shop controls enforce role, confirmation, stale state and isolate stores; restore keeps products and returns draft',async()=>{
 const DB=database(),env={DB},actor={id:'admin'};
 try{
 await DB.prepare("INSERT INTO users(id,email,password,plan_id) VALUES('seller','seller@example.com','x','brand'),('admin','admin@example.com','x','free')").run();
 await DB.prepare("INSERT INTO shops(id,owner_id,slug,name,published) VALUES('one','seller','one','One',1),('two','seller','two','Two',1)").run();
 await DB.prepare("INSERT INTO products(id,shop_id,name,source_url,status) VALUES('p','one','Product','https://thaimart.com/products/a','published')").run();
 const change=(b={},role='owner')=>manageShop(env,actor,role,{shop_id:'one',status:'suspended',expected_status:'active',confirm_slug:'one',reason:'Customer support case',...b});
 for(const role of ['admin','support',null])await assert.rejects(change({},role),{status:403});
 await assert.rejects(change({confirm_slug:'two'}),{status:400});
 await assert.rejects(change({reason:''}),{status:400});
 await assert.rejects(change({status:'unknown'}),{status:400});
 await assert.rejects(change({expected_status:'banned'}),{status:409});
 let previous='active';for(const status of ['suspended','banned','deleted']){
 await change({status,expected_status:previous});previous=status;
 const visible=(await DB.prepare("SELECT id FROM shops s WHERE s.published=1 AND s.moderation_status='active'").all()).results;
 assert.deepEqual(visible.map(s=>s.id),['two']);
 assert.equal((await DB.prepare("SELECT plan_id FROM users WHERE id='seller'").first()).plan_id,'brand');
 }
 await change({status:'active',expected_status:'deleted'});
 assert.equal((await DB.prepare("SELECT published FROM shops WHERE id='one'").first()).published,0);
 assert.equal((await DB.prepare("SELECT COUNT(*) n FROM products WHERE shop_id='one'").first()).n,1);
 assert.equal((await DB.prepare("SELECT COUNT(*) n FROM admin_audit WHERE action='shop_status' AND shop_id='one'").first()).n,4);
 }finally{DB.close();}
});
