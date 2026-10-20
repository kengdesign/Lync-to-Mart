import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../scripts/adapter.mjs';
import {showcaseLimits} from '../public/showcase-limits.js';
test('paid quota expansion preserves prices and Free, shared by both billing periods',async()=>{
 const DB=database();
 try {
  const {results}=await DB.prepare('SELECT id,products,shops,monthly,yearly FROM plans ORDER BY monthly').all();
  assert.deepEqual(results.map(r=>({...r})),[
   {id:'free',products:10,shops:1,monthly:0,yearly:0},
   {id:'starter',products:50,shops:1,monthly:19900,yearly:199000},
   {id:'growth',products:200,shops:2,monthly:49900,yearly:499000},
   {id:'brand',products:1000,shops:5,monthly:99000,yearly:990000}
  ]);
  assert.equal(showcaseLimits('brand').images,6);
 } finally {DB.close();}
});
