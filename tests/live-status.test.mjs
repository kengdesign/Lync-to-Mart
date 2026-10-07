import test from 'node:test';import assert from 'node:assert/strict';import {database} from '../scripts/adapter.mjs';import {liveProducts,liveStatus,readLiveFeed} from '../src/live-status.mjs';
const product='6a55bc71c1fbfa55fa5842ed',stream='6ac5c2f833609de35aaa268e';
const live={id:stream,status:'live',endRequested:false,products:[{productId:product}]};
test('live badges require explicit live status and exact product IDs',()=>{
 assert.deepEqual(liveProducts([live]),{[product]:stream});
 for(const patch of [{status:'ended'},{status:'interrupted'},{endRequested:true},{endRequested:undefined},{id:'javascript:bad'}])assert.deepEqual(liveProducts([{...live,...patch}]),{});
});
test('feed pagination is bounded and only status/product mapping is returned',async()=>{
 let calls=0;const result=await readLiveFeed(async()=>{calls++;return Response.json({status:{code:0},data:[live],pagination:{hasNext:true,nextCursor:String(calls)}});});assert.equal(calls,3);assert.deepEqual(result,{[product]:stream});
});
test('global refresh lease prevents repeated requests, expired/error statuses hide and switch disables',async()=>{
 const DB=database(),env={DB};let calls=0,fail=false;
 const fetcher=async()=>{calls++;if(fail)throw new Error('offline');return Response.json({status:{code:0},data:[live]});};
 try{
 assert.equal((await liveStatus(env,fetcher,1000)).products[product],stream);
 for(let i=0;i<10;i++)assert.equal((await liveStatus(env,fetcher,1010)).products[product],stream);
 assert.equal(calls,1);fail=true;assert.deepEqual((await liveStatus(env,fetcher,1121)).products,{});
 await liveStatus(env,fetcher,1122);assert.equal(calls,2);
 assert.deepEqual((await liveStatus({...env,LIVE_STATUS_ENABLED:'false'},fetcher,1400)).products,{});assert.equal(calls,2);
 }finally{DB.close();}
});
