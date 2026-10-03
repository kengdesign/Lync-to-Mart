import {escape as xml} from './security.mjs';
import {PAGE_SIZE} from './catalog.mjs';
const SHOPS_PER_FILE=100;
const response=(body,type,method,status=200)=>new Response(method==='HEAD'?null:body,{status,headers:{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
const document=(kind,items)=>`<?xml version="1.0" encoding="UTF-8"?><${kind} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</${kind}>`;
export async function discovery(req,env){
 const url=new URL(req.url),path=url.pathname,method=req.method;
 if(path!=='/robots.txt'&&path!=='/sitemap.xml'&&!/^\/sitemaps\/shops-\d+\.xml$/.test(path))return null;
 if(!['GET','HEAD'].includes(method))return response('Method not allowed','text/plain',method,405);
 const production=env.APP_ENV==='production';
 if(path==='/robots.txt')return response(production?`User-agent: *\nDisallow: /api/\nDisallow: /preview/\nDisallow: /go/\nAllow: /shop/\nSitemap: ${url.origin}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n','text/plain',method);
 if(!production)return response('Sitemaps are available on production only.','text/plain',method,404);
 if(path==='/sitemap.xml'){
  const {n}=await env.DB.prepare("SELECT COUNT(*) AS n FROM shops s WHERE published=1 AND s.moderation_status='active' AND NOT EXISTS(SELECT 1 FROM member_controls mc WHERE mc.user_id=s.owner_id AND mc.status<>'active')").first();
  const entries=Array.from({length:Math.ceil(n/SHOPS_PER_FILE)},(_,i)=>`<sitemap><loc>${xml(url.origin+'/sitemaps/shops-'+(i+1)+'.xml')}</loc></sitemap>`).join('');
  return response(document('sitemapindex',entries),'application/xml',method);
 }
 const part=Number(path.match(/shops-(\d+)\.xml$/)[1]);if(!Number.isSafeInteger(part)||part<1)return response('Not found','text/plain',method,404);
 const {results}=await env.DB.prepare(`SELECT s.id,s.slug,(SELECT COUNT(*) FROM products p WHERE p.shop_id=s.id AND p.status='published') AS products FROM shops s WHERE s.published=1 AND s.moderation_status='active' AND NOT EXISTS(SELECT 1 FROM member_controls mc WHERE mc.user_id=s.owner_id AND mc.status<>'active') ORDER BY s.id LIMIT ? OFFSET ?`).bind(SHOPS_PER_FILE,(part-1)*SHOPS_PER_FILE).all();
 if(!results.length)return response('Not found','text/plain',method,404);
 const entries=results.flatMap(shop=>Array.from({length:Math.max(1,Math.ceil(shop.products/PAGE_SIZE))},(_,i)=>`<url><loc>${xml(url.origin+'/shop/'+encodeURIComponent(shop.slug)+(i?'?page='+(i+1):''))}</loc></url>`)).join('');
 return response(document('urlset',entries),'application/xml',method);
}

