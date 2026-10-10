import {productIdentity} from './duplicates.mjs';
import {boundedHTML} from './import.mjs';
import {importLink} from './thaimart-links.mjs';
// Keep the native identity used by duplicates/provenance/live badges separate
// from the verified public product page. Only server-fetched imports write here.
export async function rememberDestination(env,identity,raw){
 const key=productIdentity(identity),url=importLink(raw);
 if(!key||!url||url.hostname!=='thaimart.com'||!url.pathname.startsWith('/products/'))return;
 // Shared across shops: never persist another merchant's referral/query tokens.
 const destination=url.origin+url.pathname;
 if(productIdentity(destination))return; // Legacy ID pages must not replace a slug.
 await env.DB.prepare('INSERT INTO product_destinations(identity,destination_url) VALUES(?,?) ON CONFLICT(identity) DO UPDATE SET destination_url=excluded.destination_url,updated_at=CURRENT_TIMESTAMP').bind(key,destination).run();
}
export async function productDestination(env,raw,fetcher=fetch,now=Math.floor(Date.now()/1000)){
 const key=productIdentity(raw);if(!key)return raw;
 // Preserve explicitly supplied tracking parameters instead of rewriting them.
 const u=new URL(raw);if([...u.searchParams.keys()].some(k=>k!=='share')||u.hash)return raw;
 const row=await env.DB.prepare('SELECT destination_url FROM product_destinations WHERE identity=?').bind(key).first();
 const target=importLink(row?.destination_url);
 if(target?.hostname==='thaimart.com'&&target.pathname.startsWith('/products/')&&!productIdentity(target.href))return target.href;
 if(env.THAIMART_LEGACY_RESOLVE!=='true')return raw;
 // One bounded lookup per product; failed lookups back off globally for an hour.
 await env.DB.prepare('INSERT OR IGNORE INTO product_destinations(identity,destination_url) VALUES(?,?)').bind(key,key).run();
 const lease=await env.DB.prepare('UPDATE product_destinations SET next_check=? WHERE identity=? AND next_check<=?').bind(now+3600,key,now).run();
 if(!lease.meta.changes)return raw;
 try{
  const id=key.split('/').pop();
  const response=await fetcher('https://thaimart.com/api/products/'+id,{redirect:'manual',signal:AbortSignal.timeout(8000),headers:{Accept:'application/json'}});
  if(!response.ok||!response.headers.get('content-type')?.includes('application/json')){await response.body?.cancel();return raw;}
  const json=JSON.parse(await boundedHTML(response,2000000));
  const url=verifiedProductURL(json,id);if(!url)return raw;
  await rememberDestination(env,key,url);return url;
 }catch{return raw;}
}
// This endpoint is used by ThaiMart's public web client. No auth or private API.
export function verifiedProductURL(json,id){
 const p=json?.data;
 if(json?.status?.code!==0||p?.id!==id||p.status!=='PRODUCT_STATUS_PUBLISHED'||typeof p.slug!=='string'||p.slug.length>3000)return null;
 try{
  const slug=decodeURIComponent(p.slug);
  if(!slug||/[\\/\s?#%\x00-\x1f]/u.test(slug)||slug==='.'||slug==='..')return null;
  const url=importLink('https://thaimart.com/products/'+encodeURIComponent(slug));
  return url&&!productIdentity(url.href)?url.href:null;
 }catch{return null;}
}
