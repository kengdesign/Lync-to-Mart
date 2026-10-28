import {planExpression,planBindings} from './plans.mjs';
import {packageDomainLimit} from './domain-registry.mjs';
export async function domainReport(env,url){
 const exists=await env.DB.prepare("SELECT name FROM sqlite_master WHERE name='domain_intents'").first();
 if(!exists)return {rows:[],total:0,page:1,pages:1,stats:{},cap:Number(env.MART_DOMAIN_MAX_HOSTNAMES)||90};
 const page=Math.max(1,parseInt(url.searchParams.get('page'))||1),q=(url.searchParams.get('q')||'').trim().slice(0,100).toLowerCase(),state=url.searchParams.get('domain_state')||'',plan=url.searchParams.get('domain_plan')||'';
 const base=`FROM domain_intents i JOIN shops s ON s.id=i.shop_id JOIN users u ON u.id=i.owner_id LEFT JOIN domain_registry r ON r.intent_id=i.id`;
 const cte=`WITH domains AS (SELECT i.id,i.hostname,i.owner_id,i.shop_id,i.created_at,i.expires_at,s.name AS shop_name,s.slug,u.email,COALESCE(r.state,'draft') AS state,COALESCE(r.last_check,i.checked_at) AS checked_at,COALESCE(r.invalid_since,0) AS invalid_since,COALESCE(r.paused,0) AS paused,r.provider_id,(${planExpression}) AS plan_id,EXISTS(SELECT 1 FROM admin_roles a WHERE a.user_id=u.id AND a.role='owner') AS unlimited,(SELECT COUNT(*) FROM domain_intents x WHERE x.owner_id=i.owner_id) AS used ${base})`;
 const where=" WHERE (?='' OR instr(lower(hostname),?)>0 OR instr(lower(shop_name),?)>0 OR instr(lower(email),?)>0) AND (?='' OR state=?) AND (?='' OR plan_id=?)";
 const args=[...planBindings(env),q,q,q,q,state,state,plan,plan];
 const total=(await env.DB.prepare(cte+' SELECT COUNT(*) AS n FROM domains'+where).bind(...args).first()).n;
 const rows=(await env.DB.prepare(cte+' SELECT * FROM domains'+where+' ORDER BY created_at DESC,id LIMIT 25 OFFSET ?').bind(...args,(page-1)*25).all()).results;
 rows.forEach(r=>{r.limit=r.unlimited?null:packageDomainLimit(r.plan_id);r.provider_created=!!r.provider_id;delete r.provider_id;});
 const stats={};for(const r of (await env.DB.prepare("SELECT COALESCE(r.state,'draft') AS state,COUNT(*) AS n FROM domain_intents i LEFT JOIN domain_registry r ON r.intent_id=i.id GROUP BY COALESCE(r.state,'draft')").all()).results)stats[r.state]=r.n;
 return {rows,total,page,pages:Math.max(1,Math.ceil(total/25)),stats,cap:Number(env.MART_DOMAIN_MAX_HOSTNAMES)||90};
}
export async function attachShopDomains(env,rows){
 if(!rows.length||!await env.DB.prepare("SELECT name FROM sqlite_master WHERE name='domain_intents'").first())return;
 for(const row of rows){row.domains=(await env.DB.prepare("SELECT i.hostname,COALESCE(r.state,'draft') AS state FROM domain_intents i LEFT JOIN domain_registry r ON r.intent_id=i.id WHERE i.shop_id=?").bind(row.id).all()).results;row.domain_used=(await env.DB.prepare('SELECT COUNT(*) AS n FROM domain_intents WHERE owner_id=?').bind(row.owner_id).first()).n;row.domain_limit=await env.DB.prepare("SELECT 1 FROM admin_roles WHERE user_id=? AND role='owner'").bind(row.owner_id).first()?null:packageDomainLimit(row.effective_plan);}
}
