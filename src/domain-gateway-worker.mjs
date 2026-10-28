import {domainEntitled} from './domain-managed.mjs';
import {productIdentity} from './duplicates.mjs';
import {serveDomain} from './domain-gateway.mjs';
import {planExpression,planBindings} from './plans.mjs';
import {showcaseLimits,readShowcase} from '../public/showcase-limits.js';
const PILOT='thaimart.logintimate.com';
const notFound=()=>new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
export async function resolvePilot(env,hostname){
 if(env.MART_DOMAINS_ENABLED==='true'&&await env.DB.prepare("SELECT name FROM sqlite_master WHERE name='domain_registry'").first()){
  const domain=await env.DB.prepare("SELECT * FROM domain_registry WHERE hostname=? AND state='active' AND paused=0").bind(hostname).first();
  if(domain){
   if(!await domainEntitled(env,domain))return null;
   const row=await env.DB.prepare(`SELECT s.*,(${planExpression}) AS plan_id FROM shops s JOIN users u ON u.id=s.owner_id WHERE s.id=? AND s.owner_id=? AND s.published=1 AND s.moderation_status='active'`).bind(...planBindings(env),domain.shop_id,domain.owner_id).first();
   return row?{...row,status:'active',entitled:true,shopPublished:true,shopRestricted:false}:null;
  }
 }
 if(env.APP_ENV!=='staging'||env.MART_PILOT_ENABLED!=='true'||hostname!==PILOT)return null;
 const slot=await env.DB.prepare('SELECT domain_id FROM mart_domain_pilot WHERE hostname=? AND enabled=1 AND provider_id IS NOT NULL').bind(hostname).first();if(!slot)return null;
 const row=await env.DB.prepare(`SELECT s.*,(${planExpression}) AS plan_id FROM shop_domains d JOIN shops s ON s.id=d.shop_id AND s.owner_id=d.owner_id JOIN users u ON u.id=s.owner_id WHERE d.hostname=? AND d.status='verified' AND s.published=1 AND s.moderation_status='active' AND NOT EXISTS(SELECT 1 FROM member_controls mc WHERE mc.user_id=u.id AND mc.status<>'active')`).bind(...planBindings(env),hostname).first();
 if(!row)return null;
 const match=await env.DB.prepare('SELECT id FROM shop_domains WHERE id=? AND shop_id=?').bind(slot.domain_id,row.id).first();if(!match)return null;
 const admin=await env.DB.prepare("SELECT role FROM admin_roles WHERE user_id=? AND role='owner'").bind(row.owner_id).first();
 const stagingAdmin=env.STAGING_ADMIN_SHOP_ID&&await env.DB.prepare('SELECT id FROM shops WHERE id=? AND owner_id=?').bind(env.STAGING_ADMIN_SHOP_ID,row.owner_id).first();
 if(!admin&&!stagingAdmin&&!['starter','growth','brand'].includes(row.plan_id))return null;
 return {...row,status:'active',entitled:true,shopPublished:true,shopRestricted:false};
}
export async function authorizePilotResource(env,domain,type,path){
 if(type==='product')return !!await env.DB.prepare("SELECT id FROM products WHERE id=? AND shop_id=? AND status='published'").bind(path.slice(4),domain.id).first();
 let key;try{key=decodeURIComponent(path.slice(7));}catch{return false;}
 if([domain.logo_key,domain.cover_key].filter(Boolean).includes(key))return true;
 const limits=showcaseLimits(domain.plan_id),campaigns=readShowcase(domain.showcase_json).campaigns||[];
 if(campaigns.slice(0,limits.images).some(c=>c.enabled&&(c.key===key||(limits.mobile&&c.mobile===key))))return true;
 return !!await env.DB.prepare(`SELECT id FROM products WHERE shop_id=? AND status='published' AND (image_key=? OR EXISTS(SELECT 1 FROM json_each(gallery_json) g WHERE json_extract(g.value,'$.key')=?) OR instr(description_html,?)>0) LIMIT 1`).bind(domain.id,key,key,'src="/media/'+encodeURIComponent(key)+'"').first();
}
export default {async fetch(req,env){
 try{
  const url=new URL(req.url);
  // This probe contains no customer records, account details or credentials.
  if(['fallback.lynctomart.com','shops.lynctomart.com'].includes(url.hostname)&&url.pathname==='/__mart_gateway_health'&&req.method==='GET')return Response.json({service:'mart-domain-gateway',environment:env.APP_ENV||'staging',version:1},{headers:{'Cache-Control':'no-store'}});
  if(url.protocol!=='https:')return notFound();
  if(req.method==='GET'&&['/api/public/live-status','/api/public/stock-status'].includes(url.pathname)){
   const domain=await resolvePilot(env,url.hostname);if(!domain)return notFound();
   const rows=(await env.DB.prepare("SELECT id,source_url FROM products WHERE shop_id=? AND status='published'").bind(domain.id).all()).results;
   const live=url.pathname.endsWith('/live-status');
   const allowed=new Set(rows.map(p=>live?productIdentity(p.source_url).split('/').pop():p.id).filter(Boolean));
   if(!live){const ids=(url.searchParams.get('ids')||'').split(',').filter(Boolean);if(ids.length>12||ids.some(id=>!allowed.has(id)))return notFound();}
   const response=await env.MART.fetch(new Request(url,{redirect:'manual'}));if(!response.ok)return notFound();
   const data=await response.json();return Response.json({...data,products:Object.fromEntries(Object.entries(data.products||{}).filter(([id])=>allowed.has(id)))},{headers:{'Cache-Control':'no-store'}});
  }
  return await serveDomain(req,{resolveDomain:host=>resolvePilot(env,host),authorizeResource:(domain,type,path)=>authorizePilotResource(env,domain,type,path),service:env.MART});
 }catch{return new Response('Store temporarily unavailable',{status:503,headers:{'Cache-Control':'no-store','Retry-After':'30'}});}
}};
