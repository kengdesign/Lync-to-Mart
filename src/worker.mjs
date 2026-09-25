import {hash,verifyPassword,safeURL,escape as e} from './security.mjs';
import {extractProduct,boundedHTML} from './import.mjs';
const json=(v,status=200,headers={})=>Response.json(v,{status,headers:{'Cache-Control':'no-store',...headers}});
const hosts=(s='')=>s.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const clean=(x,max)=>typeof x==='string'?x.trim().slice(0,max):'';
const now=()=>Math.floor(Date.now()/1000);
const query=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
async function body(req){if(Number(req.headers.get('content-length'))>20000)fail('ข้อมูลยาวเกินไป',413);const text=await boundedHTML(req);if(text.length>20000)fail('ข้อมูลยาวเกินไป',413);try{return JSON.parse(text);}catch{fail('รูปแบบข้อมูลไม่ถูกต้อง');}}
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
 if(p.startsWith('/shop/')&&method==='GET'){
  const slug=decodeURIComponent(p.slice(6));const s=await query(env,'SELECT s.*,pl.branding FROM shops s JOIN users u ON u.id=s.owner_id JOIN plans pl ON pl.id=u.plan_id WHERE s.slug=? AND s.published=1',slug).first();
  if(!s)return html(page('ไม่พบร้าน','<main class="missing"><h1>ร้านนี้ยังไม่เปิดให้เข้าชม</h1><p>ตรวจสอบลิงก์หรือติดต่อเจ้าของร้าน</p></main>'),404);
  const {results:products}=await query(env,"SELECT * FROM products WHERE shop_id=? AND status='published' ORDER BY created_at DESC",s.id).all();
  ctx.waitUntil(event(env,s.id,null,'view').catch(()=>{}));
  return html(page(s.name,`<header class="store-top"><a href="/shop/${e(s.slug)}">${e(s.name)}</a><span>ร้านค้าออนไลน์</span></header><main class="store-main"><section class="store-intro"><span class="eyebrow">ยินดีต้อนรับสู่ร้านของเรา</span><h1>${e(s.name)}</h1><p>${e(s.description)}</p>${s.line_url?`<a class="button light" href="${e(s.line_url)}" rel="noopener noreferrer">ติดต่อร้านทาง LINE</a>`:''}</section><div class="section-heading"><h2>สินค้าของเรา</h2><span>${products.length} รายการ</span></div><section class="catalog">${products.map(x=>`<article class="product-card">${x.image_key?`<img src="/media/${encodeURIComponent(x.image_key)}" alt="${e(x.name)}" loading="lazy">`:'<div class="no-photo">ยังไม่มีรูปสินค้า</div>'}<div class="product-info"><h3>${e(x.name)}</h3><p>${e(x.description)}</p><strong>${x.price==null?'ดูราคาที่ Thaimart':'฿'+(x.price/100).toLocaleString('th-TH')}</strong><a class="button" href="/go/${x.id}" rel="nofollow">ดูสินค้าและซื้อที่ Thaimart ↗</a></div></article>`).join('')||'<p class="empty">ร้านกำลังเตรียมสินค้า กลับมาเยี่ยมชมอีกครั้งนะคะ</p>'}</section><p class="store-note">ราคาและสถานะสินค้าล่าสุด รวมถึงการชำระเงิน ตรวจสอบที่ Thaimart</p></main>${s.branding?'<footer class="store-footer">Powered by <strong>Lync to Mart</strong></footer>':''}`));
 }
 if(p.startsWith('/go/')&&method==='GET'){
  const product=await query(env,"SELECT p.* FROM products p JOIN shops s ON s.id=p.shop_id WHERE p.id=? AND p.status='published' AND s.published=1",p.slice(4)).first();if(!product)fail('ไม่พบสินค้า',404);
  const target=safeURL(product.source_url,hosts(env.CHECKOUT_HOSTS));if(!target)fail('ยังไม่ได้เปิดการเชื่อมต่อร้านค้าปลายทาง',503);
  ctx.waitUntil(event(env,product.shop_id,product.id,'buy_click').catch(()=>{}));return new Response(null,{status:302,headers:{Location:target,'Cache-Control':'no-store','Referrer-Policy':'strict-origin-when-cross-origin'}});
 }
 if(p.startsWith('/media/')&&method==='GET'){
  const key=decodeURIComponent(p.slice(7));const publicImage=await query(env,"SELECT p.id FROM products p JOIN shops s ON s.id=p.shop_id WHERE p.image_key=? AND p.status='published' AND s.published=1 LIMIT 1",key).first();
  if(!publicImage){const u=await owner(req,env);if(!await query(env,'SELECT key FROM media WHERE key=? AND owner_id=?',key,u.id).first())fail('ไม่พบรูปภาพ',404);}
  const object=await env.MEDIA.get(key);if(!object)fail('ไม่พบรูปภาพ',404);return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'private, no-store'}});
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
   if(!sm[2]&&method==='PUT'){const b=await body(req),name=clean(b.name,100),line=clean(b.line_url,500);if(!name)fail('กรอกชื่อร้าน');if(line&&!safeURL(line,['line.me','lin.ee']))fail('กรุณาใช้ลิงก์ LINE ที่ถูกต้อง');await query(env,'UPDATE shops SET name=?,description=?,line_url=?,published=? WHERE id=? AND owner_id=?',name,clean(b.description,1500),line,b.published===true?1:0,shop.id,user.id).run();return json({ok:true});}
   if(sm[2]==='products'&&method==='GET')return json((await query(env,'SELECT * FROM products WHERE shop_id=? ORDER BY created_at DESC',shop.id).all()).results);
   if(sm[2]==='stats'&&method==='GET')return json((await query(env,"SELECT day,kind,COUNT(*) AS count FROM events WHERE shop_id=? AND day>=date('now','+7 hours','-29 days') GROUP BY day,kind ORDER BY day",shop.id).all()).results);
   if(sm[2]==='products'&&method==='POST'){
    const b=await body(req),data=await productData(b,env,user),id=crypto.randomUUID();
    const result=await query(env,`INSERT INTO products(id,shop_id,name,description,price,source_url,image_key,status) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM products p JOIN shops s ON s.id=p.shop_id WHERE s.owner_id=?)<?`,id,shop.id,...data,user.id,plan.products).run();if(!result.meta.changes)fail('จำนวนสินค้าครบตามแพ็กเกจแล้ว',409);return json({id},201);
   }
  }
  const pm=p.match(/^\/api\/products\/([^/]+)$/);
  if(pm){const product=await query(env,'SELECT p.* FROM products p JOIN shops s ON s.id=p.shop_id WHERE p.id=? AND s.owner_id=?',pm[1],user.id).first();if(!product)fail('ไม่พบสินค้า',404);
   if(method==='PUT'){const data=await productData(await body(req),env,user);await query(env,'UPDATE products SET name=?,description=?,price=?,source_url=?,image_key=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',...data,product.id).run();return json({ok:true});}
   if(method==='DELETE'){await query(env,'DELETE FROM products WHERE id=?',product.id).run();return json({ok:true});}
  }
  if(p==='/api/import'&&method==='POST'){
   const b=await body(req),target=safeURL(b.url,hosts(env.IMPORT_HOSTS));if(!target)fail('ยังไม่เปิดนำเข้าจากโดเมนนี้ กรุณาเพิ่มข้อมูลสินค้าด้วยตนเอง',422);
   let response;try{response=await fetch(target,{redirect:'manual',signal:AbortSignal.timeout(8000),headers:{Accept:'text/html'}});}catch{fail('ดึงข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง',502);}
   if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))fail('ต้นทางไม่ส่งหน้าสินค้าที่อ่านได้ กรุณาเพิ่มข้อมูลเอง',422);
   const product=extractProduct(await boundedHTML(response));if(!product)fail('ไม่พบข้อมูลสินค้าแบบมีโครงสร้าง กรุณาเพิ่มข้อมูลเอง',422);
   return json({...product,source_url:target,status:'draft',notice:'ตรวจสอบชื่อ รายละเอียด ราคา และอัปโหลดรูปที่คุณมีสิทธิ์ใช้งาน ก่อนเผยแพร่'});
  }
  if(p==='/api/media'&&method==='POST'){
   const used=await query(env,'SELECT COALESCE(SUM(size),0) AS bytes FROM media WHERE owner_id=?',user.id).first();if(used.bytes>=500000000)fail('พื้นที่รูปภาพเต็มแล้ว',409);
   const reader=req.body?.getReader();if(!reader)fail('ไม่พบรูปภาพ');let size=0,chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>5000000){await reader.cancel();fail('รูปภาพต้องไม่เกิน 5 MB',413);}chunks.push(value);}const bytes=new Uint8Array(size);let o=0;for(const c of chunks){bytes.set(c,o);o+=c.length;}
   let mime;if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mime='image/jpeg';else if([137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x))mime='image/png';else if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')mime='image/webp';else fail('รองรับรูป JPG, PNG และ WebP เท่านั้น');
   const key=`${user.id}/${crypto.randomUUID()}`;await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:mime}});await query(env,'INSERT INTO media VALUES(?,?,?,?)',key,user.id,mime,size).run();return json({key},201);
  }
  return json({error:'ไม่พบรายการที่ขอ'},404);
 }
 if(method!=='GET'&&method!=='HEAD')return json({error:'ไม่พบรายการที่ขอ'},404);
 if(p==='/'||p==='/dashboard')return env.ASSETS.fetch(new Request(new URL('/index.html',url),req));
 return env.ASSETS.fetch(req);
}
async function productData(b,env,user){const name=clean(b.name,180),source=safeURL(b.source_url,hosts(env.CHECKOUT_HOSTS));if(!name)fail('กรอกชื่อสินค้า');if(!source)fail('ลิงก์สินค้าไม่ตรงกับโดเมน Thaimart ที่ตั้งค่าไว้');const price=b.price===null||b.price===''?null:Number(b.price);if(price!==null&&(!Number.isSafeInteger(price)||price<0||price>10000000000))fail('ราคาไม่ถูกต้อง');const image=clean(b.image_key,150);if(image&&!await query(env,'SELECT key FROM media WHERE key=? AND owner_id=?',image,user.id).first())fail('รูปภาพไม่ใช่ของบัญชีนี้',403);return [name,clean(b.description,5000),price,source,image,b.status==='published'?'published':'draft'];}
export default {async fetch(req,env,ctx){let response;try{response=await handle(req,env,ctx);}catch(err){if(!err.status)console.error('Request failed',err.message);response=json({error:err.status?err.message:'ระบบขัดข้อง กรุณาลองอีกครั้ง'},err.status||500);}const out=new Response(response.body,response);out.headers.set('X-Content-Type-Options','nosniff');out.headers.set('Referrer-Policy','strict-origin-when-cross-origin');out.headers.set('Content-Security-Policy',"default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");return out;}};
