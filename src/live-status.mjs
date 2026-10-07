// Read-only public status feed. Never fetch playback, chat, or visitor credentials.
const FEED='https://live-stream-api-v2.marketplus.dev/v2/live-streams';
const id=value=>typeof value==='string'&&/^[a-f0-9]{24}$/.test(value);
export function liveProducts(rows){
 const products={};
 for(const live of rows){
  if(live.status!=='live'||live.endRequested!==false||!id(live.id)||!Array.isArray(live.products))continue;
  for(const product of live.products)if(id(product.productId)&&!products[product.productId])products[product.productId]=live.id;
 }
 return products;
}
export async function readLiveFeed(fetcher=fetch){
 const rows=[],seen=new Set();let cursor='';
 const signal=AbortSignal.timeout(8000);
 for(let page=0;page<3;page++){
 let response;try{response=await fetcher(FEED+(cursor?'?cursor='+encodeURIComponent(cursor):''),{redirect:'manual',signal});}catch(err){throw new Error(signal.aborted?'upstream_timeout':'upstream_fetch_failed');}
 if(!response.ok)throw new Error('upstream_http_'+response.status);
 const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,text='';
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2000000){await reader.cancel();throw new Error('upstream_too_large');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();
 let result;try{result=JSON.parse(text);}catch{throw new Error('upstream_invalid_json');}if(result.status?.code!==0||!Array.isArray(result.data))throw new Error('upstream_invalid_response');
 rows.push(...result.data);
 const next=result.pagination?.nextCursor;if(!result.pagination?.hasNext||typeof next!=='string'||!next||next.length>2000||seen.has(next))break;seen.add(next);cursor=next;
 }
 return liveProducts(rows);
}
export async function liveStatus(env,fetcher=fetch,now=Math.floor(Date.now()/1000)){
 if(env.LIVE_STATUS_ENABLED==='false')return {products:{},valid_until:0};
 const row=await env.DB.prepare('SELECT * FROM live_status_cache WHERE id=1').first();
 if(!row)return {products:{},valid_until:0};
 if(row.next_check>now){const cached=JSON.parse(row.payload);return {products:row.valid_until>now?(cached.products||cached):{},valid_until:row.valid_until,...(cached.reason?{reason:cached.reason}:{})};}
 // One global refresh lease per database, regardless of visitor/shop count.
 const lease=await env.DB.prepare('UPDATE live_status_cache SET next_check=? WHERE id=1 AND next_check<=?').bind(now+120,now).run();
 if(!lease.meta.changes)return {products:{},valid_until:0};
 try{
  const products=await readLiveFeed(fetcher),valid_until=now+120;
  await env.DB.prepare('UPDATE live_status_cache SET payload=?,valid_until=? WHERE id=1').bind(JSON.stringify({products}),valid_until).run();
  return {products,valid_until};
 }catch(err){
  const reason=/^upstream_(http_\d{3}|too_large|invalid_response|invalid_json|fetch_failed|timeout)$/.test(err.message)?err.message:err.name==='TimeoutError'?'upstream_timeout':'upstream_unavailable';
  await env.DB.prepare('UPDATE live_status_cache SET payload=?,valid_until=0 WHERE id=1').bind(JSON.stringify({products:{},reason})).run();
  return {products:{},valid_until:0,reason};
 }
}
