// Ignore share/tracking parameters only for recognized ThaiMart product URLs.
export function productIdentity(raw){try{const u=new URL(raw);const id=u.pathname.match(/^\/products\/([a-f0-9]{24})\/?$/i)?.[1];return u.protocol==='https:'&&u.hostname==='thaimart.com'&&!u.username&&!u.password&&!u.port&&id?'https://thaimart.com/products/'+id.toLowerCase():'';}catch{return '';}}
const withoutQuery="substr(source_url,1,instr(source_url||'?','?')-1)";
const normalized=`lower(rtrim(substr(${withoutQuery},1,instr(${withoutQuery}||'#','#')-1),'/'))`;
export const duplicateSQL=`SELECT * FROM products WHERE shop_id=? AND id<>? AND ${normalized}=?`;
export async function findDuplicate(env,shop,id,url){const key=productIdentity(url);return key?await env.DB.prepare(duplicateSQL).bind(shop,id||'',key).first():null;}
