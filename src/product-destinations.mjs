import {productIdentity} from './duplicates.mjs';
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
export async function productDestination(env,raw){
 const key=productIdentity(raw);if(!key)return raw;
 // Preserve explicitly supplied tracking parameters instead of rewriting them.
 const u=new URL(raw);if([...u.searchParams.keys()].some(k=>k!=='share')||u.hash)return raw;
 const row=await env.DB.prepare('SELECT destination_url FROM product_destinations WHERE identity=?').bind(key).first();
 const target=importLink(row?.destination_url);
 return target?.hostname==='thaimart.com'&&target.pathname.startsWith('/products/')?target.href:raw;
}
