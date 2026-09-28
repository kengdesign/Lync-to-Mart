// Mart authorization is independent of WordPress and subscription plans.
export async function adminRole(env,user){
 const stored=await env.DB.prepare('SELECT role FROM admin_roles WHERE user_id=?').bind(user.id).first();
 if(stored)return stored.role;
 if(env.APP_ENV==='staging'&&env.STAGING_ADMIN_SHOP_ID){
  const shop=await env.DB.prepare('SELECT id FROM shops WHERE id=? AND owner_id=?').bind(env.STAGING_ADMIN_SHOP_ID,user.id).first();
  if(shop)return 'owner';
 }
 return null;
}
export async function adminData(env,user,url){
 const role=await adminRole(env,user);
 if(!role)throw Object.assign(new Error('บัญชีนี้ไม่มีสิทธิ์เข้าถึงแอดมิน Mart'),{status:403});
 const view=url.searchParams.get('view')||'overview';
 if(!['overview','users','shops'].includes(view))throw Object.assign(new Error('ไม่พบรายการ'),{status:404});
 const page=Math.max(1,Math.min(100000,Number.parseInt(url.searchParams.get('page'),10)||1));
 const search=(url.searchParams.get('q')||'').trim().slice(0,100);
 const pattern='%'+search.replace(/[\\%_]/g,'\\$&')+'%';
 if(view==='overview'){
  const stats=await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM users) users,(SELECT COUNT(*) FROM shops) shops,(SELECT COUNT(*) FROM shops WHERE published=1) published_shops,(SELECT COUNT(*) FROM products) products,(SELECT COUNT(*) FROM products WHERE status='published') published_products,(SELECT COALESCE(SUM(size),0) FROM media) storage_bytes`).first();
  return {role,view,stats,environment:env.APP_ENV||'unknown',billing_connected:false};
 }
 const from=view==='users'?`FROM users u WHERE u.email LIKE ? ESCAPE '\\'`:`FROM shops s JOIN users u ON u.id=s.owner_id WHERE (s.name LIKE ? ESCAPE '\\' OR s.slug LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\')`;
 const args=view==='users'?[pattern]:[pattern,pattern,pattern];
 const total=(await env.DB.prepare('SELECT COUNT(*) total '+from).bind(...args).first()).total;
 const fields=view==='users'?`u.id,u.email,u.plan_id,(SELECT COUNT(*) FROM shops s WHERE s.owner_id=u.id) shop_count,(SELECT COALESCE(SUM(size),0) FROM media m WHERE m.owner_id=u.id) storage_bytes`:`s.id,s.name,s.slug,s.published,u.email,(SELECT COUNT(*) FROM products p WHERE p.shop_id=s.id) product_count`;
 const rows=(await env.DB.prepare(`SELECT ${fields} ${from} ORDER BY ${view==='users'?'u.id':'s.created_at DESC,s.id'} LIMIT 25 OFFSET ?`).bind(...args,(page-1)*25).all()).results;
 return {role,view,rows,total,page,pages:Math.max(1,Math.ceil(total/25))};
}
