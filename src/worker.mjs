import {sanitizeContent,plainHTML,productRecord,remoteImage} from './content.mjs';
import {storefront} from './storefront.mjs';
import {hash,verifyPassword,safeURL,escape as e} from './security.mjs';
import {extractProduct,boundedHTML} from './import.mjs';
const json=(v,status=200,headers={})=>Response.json(v,{status,headers:{'Cache-Control':'no-store',...headers}});
const hosts=(s='')=>s.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const clean=(x,max)=>typeof x==='string'?x.trim().slice(0,max):'';
const now=()=>Math.floor(Date.now()/1000);
const query=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
async function body(req){if(Number(req.headers.get('content-length'))>200000)fail('ข้อมูลยาวเกินไป',413);const text=await boundedHTML(req,200000);if(text.length>200000)fail('ข้อมูลยาวเกินไป',413);try{return JSON.parse(text);}catch{fail('รูปแบบข้อมูลไม่ถูกต้อง');}}
async function owner(req,env){const token=req.headers.get('cookie')?.match(/(?:^|;\s*)mart_session=([^;]+)/)?.[1];if(!token)fail('กรุณาเข้าสู่ระบบ',401);const u=await query(env,'SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?',await hash(token),now()).first();if(!u)fail('กรุณาเข้าสู่ระบบอีกครั้ง',401);return u;}
async function shopFor(env,id,user){const s=await query(env,'SELECT * FROM shops WHERE id=? AND owner_id=?',id,user.id).first();if(!s)fail('ไม่พบร้านค้า',404);return s;}
async function planFor(env,user){return query(env,'SELECT * FROM plans WHERE id=?',user.plan_id).first();}
async function event(env,shop,product,kind){await query(env,'INSERT INTO events(id,shop_id,product_id,kind,day) VALUES(?,?,?,?,?)',crypto.randomUUID(),shop,product,kind,new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'})).run();}
function html(content,status=200){return new Response(content,{status,headers:{'content-type':'text/html; charset=utf-8','Cache-Control':'no-store'}});}
function page(title,content){return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)} | Lync to Mart</title><link rel="stylesheet" href="/styles.css"></head><body class="store-body">${content}</body></html>`;}
async function handle(req,env,ctx){
 const url=new URL(req.url),p=url.pathname,method=req.method;
 if(!['GET','HEAD','POST','PUT','DELETE'].includes(method))return json({error:'Method not allowed'},405);
 if(['POST','PUT','DELETE'].includes(method)&&req.headers.get('origin')!==url.origin)fail('ไม่อนุญาตคำขอจากเว็บไซต์อื่น',403);
 if(p==='/api/login'&&method==='POST'){
  const b=await body(req),email=clean(b.email,254).toLowerCase(),password=typeof b.password==='string'?b.password:'';
  if(password.length>256)fail('ข้อมูลไม่ถูกต้อง');
  const ip=await hash(req.headers.get('cf-connecting-ip')||'local'),key=await hash(email+'|'+ip);
  await query(env,`INSERT INTO login_attempts(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END`,key,now()+900,now(),now()).run();
  const a=await query(env,'SELECT count FROM login_attempts WHERE key=?',key).first();if(a.count>10)fail('ลองเข้าสู่ระบบใหม่ในอีก 15 นาที',429);
  const user=await query(env,'SELECT * FROM users WHERE email=?',email).first();
  const valid=await verifyPassword(password,user?.password||'00000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000');
  if(!user||!valid)fail('อีเมลหรือรหัสผ่านไม่ถูกต้อง',401);
  const token=crypto.randomUUID()+crypto.randomUUID();await env.DB.batch([query(env,'DELETE FROM sessions WHERE expires<?',now()),query(env,'INSERT INTO sessions VALUES(?,?,?)',await hash(token),user.id,now()+86400)]);
  return json({ok:true},200,{'Set-Cookie':`mart_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${url.protocol==='https:'?'; Secure':''}`});
 }
 if(p==='/api/logout'&&method==='POST'){const token=req.headers.get('cookie')?.match(/(?:^|;\s*)mart_session=([^;]+)/)?.[1];if(token)await query(env,'DELETE FROM sessions WHERE token_hash=?',await hash(token)).run();return json({ok:true},200,{'Set-Cookie':'mart_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
 if(p.startsWith('/preview/')&&method==='GET'){
  const user=await owner(req,env),shop=await shopFor(env,p.slice(9),user),plan=await planFor(env,user);
  const {results:products}=await query(env,'SELECT * FROM products WHERE shop_id=? ORDER BY created_at DESC',shop.id).all();
  return html(storefront({...shop,branding:plan.branding},products,url.origin,true,true));
 }
 if(p.startsWith('/shop/')&&method==='GET'){
  const slug=decodeURIComponent(p.slice(6));const s=await query(env,'SELECT s.*,pl.branding FROM shops s JOIN users u ON u.id=s.owner_id JOIN plans pl ON pl.id=u.plan_id WHERE s.slug=? AND s.published=1',slug).first();
  if(!s)return html(page('ไม่พบร้าน','<main class="missing"><h1>ร้านนี้ยังไม่เปิดให้เข้าชม</h1><p>ตรวจสอบลิงก์หรือติดต่อเจ้าของร้าน</p></main>'),404);
  const {results:products}=await query(env,"SELECT * FROM products WHERE shop_id=? AND status='published' ORDER BY created_at DESC",s.id).all();
  ctx.waitUntil(event(env,s.id,null,'view').catch(()=>{}));
  return html(storefront(s,products,url.origin,env.APP_ENV!=='production'));
 }
 if(p.startsWith('/go/')&&method==='GET'){
  const product=await query(env,"SELECT p.* FROM products p JOIN shops s ON s.id=p.shop_id WHERE p.id=? AND p.status='published' AND s.published=1",p.slice(4)).first();if(!product)fail('ไม่พบสินค้า',404);
  const target=safeURL(product.source_url,hosts(env.CHECKOUT_HOSTS));if(!target)fail('ยังไม่ได้เปิดการเชื่อมต่อร้านค้าปลายทาง',503);
  ctx.waitUntil(event(env,product.shop_id,product.id,'buy_click').catch(()=>{}));return new Response(null,{status:302,headers:{Location:target,'Cache-Control':'no-store','Referrer-Policy':'strict-origin-when-cross-origin'}});
 }
 if(p.startsWith('/media/')&&['GET','HEAD'].includes(method)){
  const key=decodeURIComponent(p.slice(7));const publicImage=await query(env,"SELECT p.id FROM products p JOIN shops s ON s.id=p.shop_id WHERE (p.image_key=? OR EXISTS(SELECT 1 FROM json_each(p.gallery_json) g WHERE json_extract(g.value,'$.key')=?) OR instr(p.description_html,?)>0) AND p.status='published' AND s.published=1 LIMIT 1",key,key,'src="/media/'+encodeURIComponent(key)+'"').first();
  const publicBrand=await query(env,'SELECT id FROM shops WHERE published=1 AND (logo_key=? OR cover_key=?) LIMIT 1',key,key).first();
  if(!publicImage&&!publicBrand){const u=await owner(req,env);if(!await query(env,'SELECT key FROM media WHERE key=? AND owner_id=?',key,u.id).first())fail('ไม่พบรูปภาพ',404);}
  const metadata=await query(env,'SELECT mime,size FROM media WHERE key=?',key).first();if(!metadata)fail('ไม่พบไฟล์',404);
  const headers={'Content-Type':metadata.mime,'Cache-Control':'private, no-store','Accept-Ranges':'bytes','Content-Length':String(metadata.size)};
  let range;const requested=req.headers.get('range');
  if(requested&&method==='GET'){
   const m=requested.match(/^bytes=(\d*)-(\d*)$/);let start,end;
   if(m&&(m[1]||m[2])){start=m[1]?Number(m[1]):Math.max(0,metadata.size-Number(m[2]));end=m[1]?(m[2]?Math.min(Number(m[2]),metadata.size-1):metadata.size-1):metadata.size-1;}
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=metadata.size||end<start)return new Response(null,{status:416,headers:{...headers,'Content-Length':'0','Content-Range':`bytes */${metadata.size}`}});
   range={offset:start,length:end-start+1};headers['Content-Range']=`bytes ${start}-${end}/${metadata.size}`;headers['Content-Length']=String(range.length);
  }
  if(method==='HEAD')return new Response(null,{headers});
  const object=await env.MEDIA.get(key,range?{range}:undefined);if(!object)fail('ไม่พบไฟล์',404);return new Response(object.body,{status:range?206:200,headers});
 }
 if(p.startsWith('/api/')){
  const user=await owner(req,env),plan=await planFor(env,user);
  if(p==='/api/me'&&method==='GET'){const {results:shops}=await query(env,'SELECT * FROM shops WHERE owner_id=? ORDER BY created_at',user.id).all();return json({user:{id:user.id,email:user.email},plan,shops,capabilities:{import:!!env.IMPORT_HOSTS,checkout:!!env.CHECKOUT_HOSTS,ai:false,billing:false}});}
  if(p==='/api/plans'&&method==='GET')return json((await env.DB.prepare('SELECT * FROM plans ORDER BY monthly').all()).results);
  if(p==='/api/shops'&&method==='POST'){
   const b=await body(req),name=clean(b.name,100),slug=clean(b.slug,50).toLowerCase();if(!name||!/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/.test(slug))fail('กรอกชื่อร้านและชื่อ URL ภาษาอังกฤษ 3–50 ตัว');
   const id=crypto.randomUUID();try{const r=await query(env,'INSERT INTO shops(id,owner_id,slug,name) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM shops WHERE owner_id=?)<?',id,user.id,slug,name,user.id,plan.shops).run();if(!r.meta.changes)fail('จำนวนร้านครบตามแพ็กเกจแล้ว',409);}catch(err){if(err.message.includes('UNIQUE'))fail('ชื่อ URL นี้ถูกใช้แล้ว',409);throw err;}return json({id},201);
  }
  const sm=p.match(/^\/api\/shops\/([^/]+)(?:\/(products|stats))?$/);
  if(sm){const shop=await shopFor(env,sm[1],user);
   if(!sm[2]&&method==='PUT'){const b=await body(req),name=clean(b.name,100),line=clean(b.line_url,500);if(!name)fail('กรอกชื่อร้าน');if(line&&!safeURL(line,['line.me','lin.ee']))fail('กรุณาใช้ลิงก์ LINE ที่ถูกต้อง');const images={};for(const field of ['logo_key','cover_key']){images[field]=b[field]===undefined?shop[field]:clean(b[field],150);if(images[field]&&!await query(env,"SELECT key FROM media WHERE key=? AND owner_id=? AND mime IN ('image/jpeg','image/png','image/webp')",images[field],user.id).first())fail('กรุณาใช้รูปภาพของบัญชีนี้',403);}
    const coverY=b.cover_position_y===undefined?shop.cover_position_y:Number(b.cover_position_y);if(b.cover_position_y===null||b.cover_position_y===''||!Number.isInteger(coverY)||coverY<0||coverY>100)fail('ตำแหน่งภาพปกต้องอยู่ระหว่าง 0–100');
    await query(env,'UPDATE shops SET name=?,description=?,line_url=?,published=?,logo_key=?,cover_key=?,seo_title=?,seo_description=?,cover_position_y=? WHERE id=? AND owner_id=?',name,clean(b.description,1500),line,b.published===true?1:0,images.logo_key,images.cover_key,b.seo_title===undefined?shop.seo_title:clean(b.seo_title,100),b.seo_description===undefined?shop.seo_description:clean(b.seo_description,200),coverY,shop.id,user.id).run();return json({ok:true});}
   if(sm[2]==='products'&&method==='GET')return json((await query(env,'SELECT * FROM products WHERE shop_id=? ORDER BY created_at DESC',shop.id).all()).results.map(productRecord));
   if(sm[2]==='stats'&&method==='GET')return json((await query(env,"SELECT day,kind,COUNT(*) AS count FROM events WHERE shop_id=? AND day>=date('now','+7 hours','-29 days') GROUP BY day,kind ORDER BY day",shop.id).all()).results);
   if(sm[2]==='products'&&method==='POST'){
    const b=await body(req),data=await productData(b,env,user),id=crypto.randomUUID();
    const result=await query(env,`INSERT INTO products(id,shop_id,name,description,price,source_url,image_key,status,description_html,gallery_json,variants_json,category) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM products p JOIN shops s ON s.id=p.shop_id WHERE s.owner_id=?)<?`,id,shop.id,...data,user.id,plan.products).run();if(!result.meta.changes)fail('จำนวนสินค้าครบตามแพ็กเกจแล้ว',409);return json({id},201);
   }
  }
  const pm=p.match(/^\/api\/products\/([^/]+)$/);
  if(pm){const product=await query(env,'SELECT p.* FROM products p JOIN shops s ON s.id=p.shop_id WHERE p.id=? AND s.owner_id=?',pm[1],user.id).first();if(!product)fail('ไม่พบสินค้า',404);
   if(method==='PUT'){const data=await productData(await body(req),env,user);await query(env,'UPDATE products SET name=?,description=?,price=?,source_url=?,image_key=?,status=?,description_html=?,gallery_json=?,variants_json=?,category=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',...data,product.id).run();return json({ok:true});}
   if(method==='DELETE'){await query(env,'DELETE FROM products WHERE id=?',product.id).run();return json({ok:true});}
  }
  if(p==='/api/import'&&method==='POST'){
   const b=await body(req),target=safeURL(b.url,hosts(env.IMPORT_HOSTS));if(!target||!/^\/products\/[a-f0-9]{24}\/?$/i.test(new URL(target).pathname))fail('ยังไม่เปิดนำเข้าจากโดเมนนี้ กรุณาเพิ่มข้อมูลสินค้าด้วยตนเอง',422);
   let response;try{response=await fetch(target,{redirect:'manual',signal:AbortSignal.timeout(8000),headers:{Accept:'text/html'}});}catch{fail('ดึงข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง',502);}
   if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))fail('ต้นทางไม่ส่งหน้าสินค้าที่อ่านได้ กรุณาเพิ่มข้อมูลเอง',422);
   let product;try{product=extractProduct(await boundedHTML(response),target);}catch(err){fail(err.message,422);}if(!product)fail('ไม่พบข้อมูลสินค้าแบบมีโครงสร้าง กรุณาเพิ่มข้อมูลเอง',422);
   return json({...product,source_url:target,status:'draft',notice:'ตรวจสอบข้อมูลและสิทธิ์ใช้รูป ก่อนยืนยันบันทึก รูปจะถูกคัดลอกมายังร้านของคุณ' });
  }
  if((p==='/api/media'||p==='/api/media/import'||p==='/api/media/video')&&method==='POST'){
   let source=req;
   if(p.endsWith('/import')){const b=await body(req),target=remoteImage(b.url);if(!target)fail('ไม่รองรับแหล่งรูปภาพนี้',422);
    try{source=await fetch(target,{redirect:'manual',signal:AbortSignal.timeout(12000)});}catch{fail('ดาวน์โหลดรูปไม่สำเร็จ กรุณาลองใหม่หรืออัปโหลดเอง',422);}
    if(!source.ok)fail('ต้นทางไม่อนุญาตให้ดาวน์โหลดรูปนี้ กรุณาอัปโหลดเอง',422);
   }
   const key=await saveImage(source,env,user,p.endsWith('/video'));return json({key},201);
  }

  return json({error:'ไม่พบรายการที่ขอ'},404);
 }
 if(method!=='GET'&&method!=='HEAD')return json({error:'ไม่พบรายการที่ขอ'},404);
 if(p==='/'||p==='/dashboard')return env.ASSETS.fetch(new Request(new URL('/index.html',url),req));
 return env.ASSETS.fetch(req);
}
async function productData(b,env,user){
 const name=clean(b.name,180),source=safeURL(b.source_url,hosts(env.CHECKOUT_HOSTS));if(!name)fail('กรอกชื่อสินค้า');if(!source)fail('ลิงก์สินค้าไม่ตรงกับโดเมน Thaimart ที่ตั้งค่าไว้');
 const parsePrice=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);if(!Number.isSafeInteger(n)||n<0||n>10000000000)fail('ราคาไม่ถูกต้อง');return n;};
 if(typeof b.description_html==='string'&&b.description_html.length>100000)fail('รายละเอียดสินค้าเกิน 100,000 ตัวอักษร');
 const content=sanitizeContent(b.description_html===undefined?plainHTML(clean(b.description,30000)):b.description_html);
 const gallery=b.gallery===undefined?(b.image_key?[{key:b.image_key,alt:name}]:[]):b.gallery;
 if(!Array.isArray(gallery)||gallery.length>40)fail('เพิ่มรูปแกลเลอรีได้ไม่เกิน 40 รูป');
 const images=gallery.map(g=>({key:clean(g.key,150),alt:clean(g.alt,180)}));
 const keys=[...new Set([...images.map(g=>g.key),...content.keys])];
 for(const key of keys){if(!key||!await query(env,'SELECT key FROM media WHERE key=? AND owner_id=?',key,user.id).first())fail('รูปภาพไม่ใช่ของบัญชีนี้',403);}
 if(b.description_html&&/<(?:img|video)\b[^>]*src=["']https?:/i.test(b.description_html))fail('กรุณานำเข้ารูปในรายละเอียดให้ครบก่อนบันทึก',422);
 const variants=b.variants||[];if(!Array.isArray(variants)||variants.length>100)fail('รองรับตัวเลือกสินค้าไม่เกิน 100 แบบ');
 const seen=new Set();const vs=variants.map(v=>{if(!Array.isArray(v.attributes)||!v.attributes.length||v.attributes.length>10)fail('กรอกคุณลักษณะของตัวเลือกสินค้า');
  const attributes=v.attributes.map(a=>({key:clean(a.key,60),value:clean(a.value,120)}));if(attributes.some(a=>!a.key||!a.value)||new Set(attributes.map(a=>a.key)).size!==attributes.length)fail('ชื่อและค่าตัวเลือกต้องครบและไม่ซ้ำ');
  const signature=JSON.stringify([...attributes].sort((a,b)=>a.key.localeCompare(b.key)));if(seen.has(signature))fail('มีตัวเลือกสินค้าแบบเดียวกันซ้ำ');seen.add(signature);
  return {sku:clean(v.sku,100),image_key:clean(v.image_key,150),attributes,price:parsePrice(v.price),weight:clean(v.weight,100),dimensions:clean(v.dimensions,150),available:v.available!==false};
 });
 for(const v of vs){if(v.image_key&&!images.some(g=>g.key===v.image_key))fail('รูปตัวเลือกต้องอยู่ในแกลเลอรีสินค้า');}
 const prices=vs.map(v=>v.price).filter(v=>v!==null),price=prices.length?Math.min(...prices):parsePrice(b.price);
 return [name,content.text,price,source,images[0]?.key||'',b.status==='published'?'published':'draft',content.html,JSON.stringify(images),JSON.stringify(vs),clean(b.category,500)];
}
async function saveImage(source,env,user,video=false){
 const limit=video?20000000:5000000;if(Number(source.headers.get('content-length'))>limit)fail(video?'วิดีโอต้องไม่เกิน 20 MB':'รูปภาพต้องไม่เกิน 5 MB',413);
 const reader=source.body?.getReader();if(!reader)fail('ไม่พบรูปภาพ');let size=0,chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();fail(video?'วิดีโอต้องไม่เกิน 20 MB':'รูปภาพต้องไม่เกิน 5 MB',413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 let mime;if(video){const h=new TextDecoder().decode(bytes.slice(4,12));if(h.slice(0,4)!=='ftyp'||!['isom','iso2','mp41','mp42','avc1','M4V '].includes(h.slice(4)))fail('กรุณาใช้ไฟล์ MP4 (H.264/AAC)');mime='video/mp4';}else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mime='image/jpeg';else if([137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x))mime='image/png';else if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')mime='image/webp';else fail('รองรับรูป JPG, PNG และ WebP เท่านั้น');
 const key=`${user.id}/${crypto.randomUUID()}`;
 const reserved=await query(env,'INSERT INTO media(key,owner_id,mime,size) SELECT ?,?,?,? WHERE (SELECT COALESCE(SUM(size),0) FROM media WHERE owner_id=?)+?<=500000000',key,user.id,mime,size,user.id,size).run();if(!reserved.meta.changes)fail('พื้นที่รูปภาพและวิดีโอเต็มแล้ว',409);
 try{await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:mime}});}catch(err){await query(env,'DELETE FROM media WHERE key=?',key).run();throw err;}return key;
}
export default {async fetch(req,env,ctx){let response;try{response=await handle(req,env,ctx);}catch(err){if(!err.status)console.error('Request failed',err.message);response=json({error:err.status?err.message:'ระบบขัดข้อง กรุณาลองอีกครั้ง'},err.status||500);}const out=new Response(response.body,response);out.headers.set('X-Content-Type-Options','nosniff');out.headers.set('Referrer-Policy','strict-origin-when-cross-origin');out.headers.set('Content-Security-Policy',"default-src 'self'; img-src 'self' blob: https://img-cdn.thaimart.com; style-src 'self'; font-src 'self' https://fonts.gstatic.com; media-src 'self'; frame-src https://www.youtube-nocookie.com; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");return out;}};
