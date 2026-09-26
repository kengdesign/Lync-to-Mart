export const STORAGE_LIMIT=500000000;
export function quota(used,limit){return {used,limit,remaining:Math.max(0,limit-used),percent:limit>0?Math.round(used/limit*100):used?100:0,status:used>=limit?'full':used>=limit*.8?'near':'available'};}
export async function accountUsage(env,user,plan){
 const totals=await env.DB.prepare(`SELECT
 (SELECT COUNT(*) FROM shops WHERE owner_id=?) AS shops,
 (SELECT COUNT(*) FROM products p JOIN shops s ON s.id=p.shop_id WHERE s.owner_id=?) AS products,
 (SELECT COALESCE(SUM(size),0) FROM media WHERE owner_id=?) AS bytes,
 (SELECT COUNT(*) FROM media WHERE owner_id=?) AS files,
 (SELECT COALESCE(SUM(size),0) FROM media WHERE owner_id=? AND mime='video/mp4') AS video_bytes`).bind(user.id,user.id,user.id,user.id,user.id).first();
 const {results:shops}=await env.DB.prepare(`SELECT s.id,s.name,s.published,COUNT(p.id) AS products,
 COALESCE(SUM(CASE WHEN p.status='published' THEN 1 ELSE 0 END),0) AS published_products
 FROM shops s LEFT JOIN products p ON p.shop_id=s.id WHERE s.owner_id=? GROUP BY s.id ORDER BY s.created_at,s.id`).bind(user.id).all();
 return {plan:{id:plan.id,name:plan.name},shops:quota(totals.shops,plan.shops),products:quota(totals.products,plan.products),storage:{...quota(totals.bytes,STORAGE_LIMIT),files:totals.files,image_bytes:totals.bytes-totals.video_bytes,video_bytes:totals.video_bytes},stores:shops};
}
