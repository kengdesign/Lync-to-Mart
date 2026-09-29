import {adminBackup} from './admin-backup.mjs';
import {adminBilling} from './admin-billing.mjs';
import {billingReady} from './billing.mjs';
import {planExpression,planBindings} from './plans.mjs';
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
 if(view==='backup')return adminBackup(env,role);
 if(view==='billing')return adminBilling(env,role,url);
 if(!['overview','users','shops','audit'].includes(view))throw Object.assign(new Error('ไม่พบรายการ'),{status:404});
 const page=Math.max(1,Math.min(100000,Number.parseInt(url.searchParams.get('page'),10)||1));
 const search=(url.searchParams.get('q')||'').trim().slice(0,100);
 const pattern='%'+search.replace(/[\\%_]/g,'\\$&')+'%';
 if(view==='audit'){
  if(role!=='owner')throw Object.assign(new Error('เฉพาะแอดมินสูงสุดเท่านั้นที่ดูประวัติการเข้าถึงได้'),{status:403});
  const from=`FROM admin_audit a LEFT JOIN users actor ON actor.id=a.actor_id LEFT JOIN users target ON target.id=a.target_id LEFT JOIN shops s ON s.id=a.shop_id WHERE (COALESCE(actor.email,'') LIKE ? ESCAPE '\\' OR COALESCE(target.email,'') LIKE ? ESCAPE '\\' OR COALESCE(s.name,'') LIKE ? ESCAPE '\\' OR a.reason LIKE ? ESCAPE '\\' OR a.shop_id=?)`;
  const args=[pattern,pattern,pattern,pattern,search];
  const total=(await env.DB.prepare('SELECT COUNT(*) total '+from).bind(...args).first()).total;
  const rows=(await env.DB.prepare(`SELECT a.id,a.actor_id,a.target_id,a.shop_id,a.action,a.reason,a.created_at,actor.email AS actor_email,target.email AS target_email,s.name AS shop_name ${from} ORDER BY a.created_at DESC,a.id DESC LIMIT 25 OFFSET ?`).bind(...args,(page-1)*25).all()).results;
  return {role,view,rows,total,page,pages:Math.max(1,Math.ceil(total/25))};
 }
 if(view==='overview'){
  const stats=await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM users) users,(SELECT COUNT(*) FROM shops) shops,(SELECT COUNT(*) FROM shops WHERE published=1) published_shops,(SELECT COUNT(*) FROM products) products,(SELECT COUNT(*) FROM products WHERE status='published') published_products,(SELECT COALESCE(SUM(size),0) FROM media) storage_bytes`).first();
  return {role,view,stats,environment:env.APP_ENV||'unknown',billing_connected:billingReady(env)};
 }
 if(view==='users'){
 const roleFilter=url.searchParams.get('role')||'',planFilter=url.searchParams.get('plan')||'',statusFilter=url.searchParams.get('status')||'';
 if(roleFilter&&!['owner','admin','support','member'].includes(roleFilter)||planFilter&&!['free','starter','growth','brand'].includes(planFilter)||statusFilter&&!['active','invited','suspended','banned','deleted'].includes(statusFilter))throw Object.assign(new Error('ตัวกรองไม่ถูกต้อง'),{status:400});
 const cte=`WITH members AS (SELECT u.id,u.email,u.plan_id,(${planExpression}) AS effective_plan,COALESCE(mc.status,'active') AS status,mc.override_plan,mc.override_expires,COALESCE(ar.role,CASE WHEN ?='staging' AND EXISTS(SELECT 1 FROM shops grant_shop WHERE grant_shop.id=? AND grant_shop.owner_id=u.id) THEN 'owner' ELSE 'member' END) AS member_role FROM users u LEFT JOIN member_controls mc ON mc.user_id=u.id LEFT JOIN admin_roles ar ON ar.user_id=u.id)`;
 const where=`WHERE email LIKE ? ESCAPE '\\' AND (?='' OR member_role=?) AND (?='' OR plan_id=?) AND (?='' OR status=?)`;
 const args=[...planBindings(env),env.APP_ENV||'',env.STAGING_ADMIN_SHOP_ID||'',pattern,roleFilter,roleFilter,planFilter,planFilter,statusFilter,statusFilter];
 const total=(await env.DB.prepare(`${cte} SELECT COUNT(*) total FROM members ${where}`).bind(...args).first()).total;
 const rows=(await env.DB.prepare(`${cte} SELECT m.*,(SELECT COUNT(*) FROM shops s WHERE s.owner_id=m.id) shop_count,(SELECT COALESCE(SUM(size),0) FROM media mm WHERE mm.owner_id=m.id) storage_bytes FROM members m ${where} ORDER BY m.id LIMIT 25 OFFSET ?`).bind(...args,(page-1)*25).all()).results;
 return {role,view,rows,total,page,pages:Math.max(1,Math.ceil(total/25))};
 }
 const from=view==='users'?`FROM users u WHERE u.email LIKE ? ESCAPE '\\'`:`FROM shops s JOIN users u ON u.id=s.owner_id WHERE (s.name LIKE ? ESCAPE '\\' OR s.slug LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\')`;
 const args=view==='users'?[pattern]:[pattern,pattern,pattern];
 const total=(await env.DB.prepare('SELECT COUNT(*) total '+from).bind(...args).first()).total;
 const fields=view==='users'?`u.id,u.email,u.plan_id,(SELECT COUNT(*) FROM shops s WHERE s.owner_id=u.id) shop_count,(SELECT COALESCE(SUM(size),0) FROM media m WHERE m.owner_id=u.id) storage_bytes`:`s.id,s.name,s.slug,s.published,u.email,(SELECT COUNT(*) FROM products p WHERE p.shop_id=s.id) product_count`;
 const rows=(await env.DB.prepare(`SELECT ${fields} ${from} ORDER BY ${view==='users'?'u.id':'s.created_at DESC,s.id'} LIMIT 25 OFFSET ?`).bind(...args,(page-1)*25).all()).results;
 return {role,view,rows,total,page,pages:Math.max(1,Math.ceil(total/25))};
}
