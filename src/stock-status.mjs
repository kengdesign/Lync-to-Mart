import {boundedHTML} from './import.mjs';
import {productIdentity} from './duplicates.mjs';
export function soldOut(json,id){
 const p=json?.data,q=p?.remainingQuantity;
 if(json?.status?.code!==0||p?.id!==id||p.status!=='PRODUCT_STATUS_PUBLISHED'||typeof q!=='number'||!Number.isFinite(q)||q<0)return null;
 if(q>0)return false;
 if(!Array.isArray(p.variants)||!p.variants.length)return null;
 const active=p.variants.filter(v=>v.isActive!==false);
 if(!active.length||!active.every(v=>v.remainingQuantity===0))return null;
 return true;
}
export async function stockStatus(env,requested,fetcher=fetch,now=Math.floor(Date.now()/1000),scope=null){
 if(env.STOCK_STATUS_ENABLED==='false')return {products:{}};
 const ids=[...new Set(requested)];
 if(!ids.length||ids.length>12||ids.some(id=>!/^[-a-zA-Z0-9]{1,64}$/.test(id)))throw Object.assign(new Error('รายการสินค้าไม่ถูกต้อง'),{status:400});
 // Only published products in accessible shops may cause an upstream lookup.
 const {results:rows}=await env.DB.prepare(`SELECT p.id,p.source_url FROM products p JOIN shops s ON s.id=p.shop_id WHERE p.id IN (${ids.map(()=>'?').join(',')}) AND ${scope?"s.owner_id=? AND (?='' OR s.id=?)":"p.status='published' AND s.published=1 AND s.moderation_status='active' AND NOT EXISTS(SELECT 1 FROM member_controls m WHERE m.user_id=s.owner_id AND m.status<>'active')"}`).bind(...ids,...(scope?[scope.id,scope.team?.shop_id||'',scope.team?.shop_id||'']:[])).all();
 const links=rows.map(p=>({...p,native:productIdentity(p.source_url).split('/').pop()})).filter(p=>/^[a-f0-9]{24}$/.test(p.native||''));
 const native=[...new Set(links.map(p=>p.native))];if(!native.length)return {products:{}};
 const {results:cached}=await env.DB.prepare(`SELECT * FROM stock_status_cache WHERE product_id IN (${native.map(()=>'?').join(',')})`).bind(...native).all();
 const states=new Map(cached.map(p=>[p.product_id,p])),queue=[...native],signal=AbortSignal.timeout(8000);
 await Promise.all(Array.from({length:Math.min(4,native.length)},async()=>{
  while(queue.length){
   const id=queue.shift(),old=states.get(id);if(old?.next_check>now)continue;
   await env.DB.prepare('INSERT OR IGNORE INTO stock_status_cache(product_id) VALUES(?)').bind(id).run();
   const lease=await env.DB.prepare('UPDATE stock_status_cache SET next_check=? WHERE product_id=? AND next_check<=?').bind(now+300,id,now).run();if(!lease.meta.changes)continue;
   let value=null;
   try{
    const response=await fetcher('https://thaimart.com/api/products/'+id,{redirect:'manual',signal,headers:{Accept:'application/json'}});
    if(response.ok&&response.headers.get('content-type')?.includes('application/json'))value=soldOut(JSON.parse(await boundedHTML(response)),id);else await response.body?.cancel();
   }catch{}
   const state={sold_out:value===null?null:Number(value),valid_until:value===null?0:now+300};states.set(id,state);
   await env.DB.prepare('UPDATE stock_status_cache SET sold_out=?,valid_until=? WHERE product_id=?').bind(state.sold_out,state.valid_until,id).run();
  }
 }));
 const products={};for(const p of links){const s=states.get(p.native);if(s?.valid_until>now&&s.sold_out!==null)products[p.id]={sold_out:s.sold_out===1,valid_until:s.valid_until};}
 return {products};
}
