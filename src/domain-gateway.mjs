// Public storefront boundary. Caller must resolve only activated, entitled domains.
// No browser authentication headers are forwarded to the Mart service.
const assets=new Set(['/styles.css','/store-themes.css','/storefront.js','/campaign-video.js','/video.js','/product-lightbox.js','/live-badges.js','/stock-badges.js','/favicon.svg']);
const deny=()=>new Response('Not found',{status:404,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function serveDomain(req,{resolveDomain,authorizeResource,service}) {
 const url=new URL(req.url);
 if(!['GET','HEAD'].includes(req.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD','Cache-Control':'no-store'}});
 const blocked=['/api/','/preview/','/sh0rt-log1ng','/admin','/login','/register'];
 if(blocked.some(p=>url.pathname.startsWith(p)))return deny();
 const domain=await resolveDomain(url.hostname);
 if(!domain || domain.status!=='active' || !domain.entitled || !domain.shopPublished || domain.shopRestricted)return deny();
 const shopPath='/shop/'+encodeURIComponent(domain.slug);
 const rootPage=url.pathname==='/';
 if(url.pathname===shopPath){
  url.pathname='/';return new Response(null,{status:308,headers:{Location:url.toString(),'Cache-Control':'no-store'}});
 }
 const resource=url.pathname.startsWith('/media/')?'media':url.pathname.startsWith('/go/')?'product':null;
 if(!rootPage && !assets.has(url.pathname)){
  if(!resource || !await authorizeResource(domain,resource,url.pathname))return deny();
 }
 const headers=new Headers();
 for(const key of ['accept','range','if-range'])if(req.headers.has(key))headers.set(key,req.headers.get(key));
 if(rootPage){url.pathname=shopPath;headers.set('X-Mart-Storefront-Root','1');}
 const result=await service.fetch(new Request(url,{method:rootPage?'GET':req.method,headers,redirect:'manual'}));
 const response=new Response(req.method==='HEAD'?null:result.body,result);
 response.headers.delete('Set-Cookie');
 response.headers.set('Cache-Control','no-store');
 response.headers.set('X-Content-Type-Options','nosniff');
 // Never follow an upstream redirect into an account/admin page.
 if(result.status>=300 && result.status<400 && result.headers.has('location')){
  let target;try{target=new URL(result.headers.get('location'),url);}catch{return deny();}
  if(target.origin===url.origin && target.pathname!==shopPath)return deny();
  if(target.origin!==url.origin && (resource!=='product'||target.protocol!=='https:'||target.username||target.password||target.port||!['thaimart.com','app.thaimart.com'].includes(target.hostname)))return deny();
 }
 return response;
}
