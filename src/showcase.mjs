import {scopedMedia} from './team.mjs';
import {showcaseLimits,showcaseOrder,readShowcase} from '../public/showcase-limits.js';
import {escape as e} from './security.mjs';
import {imageURL,priceLabel} from './content.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export async function saveShowcase(env,user,shop,plan,data){
 const limit=showcaseLimits(plan.id);
 if(!data||!Array.isArray(data.campaigns)||data.campaigns.length>limit.images)fail('จำนวนภาพแคมเปญเกินสิทธิ์แพ็กเกจ',403);
 if(typeof data.featured!=='boolean'||typeof data.newest!=='boolean')fail('การตั้งค่าแถวสินค้าไม่ถูกต้อง');
 if((data.featured&&!limit.featured)||(data.newest&&!limit.newest))fail('แพ็กเกจนี้ยังไม่รองรับแถวสินค้าที่เลือก',403);
 if(!Array.isArray(data.order)||data.order.length!==3||new Set(data.order).size!==3||data.order.some(x=>!showcaseOrder.includes(x)))fail('ลำดับส่วนแสดงผลไม่ถูกต้อง');
 if(!limit.reorder&&data.order.join()!==showcaseOrder.join())fail('จัดลำดับส่วนแสดงผลได้ใน Brand',403);
 const campaigns=[];
 for(const row of data.campaigns){
  if(!row||typeof row.enabled!=='boolean')fail('ข้อมูลแคมเปญไม่ถูกต้อง');
  const item={enabled:row.enabled};
  for(const [key,max] of [['key',150],['mobile',150],['title',100],['caption',400],['alt',200],['product',100],['category',500]]){
   if(typeof row[key]!=='string'||row[key].length>max)fail('ข้อมูลแคมเปญไม่ถูกต้อง');
   item[key]=row[key].trim();
  }
  if(!item.key||!item.alt)fail('กรุณาใส่ภาพและคำอธิบายภาพ');
  if(item.mobile&&!limit.mobile)fail('ภาพเฉพาะมือถือสำหรับ Brand',403);
  for(const key of [item.key,item.mobile].filter(Boolean)){
   if(!await scopedMedia(env,user,key))fail('รูปภาพไม่ใช่ของร้านนี้',403);
   if(!await env.DB.prepare("SELECT key FROM media WHERE key=? AND owner_id=? AND size<=1500000 AND mime IN ('image/jpeg','image/png','image/webp')").bind(key,user.id).first())fail('ใช้รูปภาพของบัญชีนี้ ขนาดไม่เกิน 1.5 MB',403);
  }
  for(const field of ['width','height','mobile_width','mobile_height']){
   if(!Number.isInteger(row[field])||row[field]<1||row[field]>10000)fail('ขนาดภาพไม่ถูกต้อง');
   item[field]=row[field];
  }
  if(item.product&&item.category)fail('เลือกลิงก์สินค้า หรือหมวดหมู่อย่างใดอย่างหนึ่ง');
  if(item.product&&!await env.DB.prepare('SELECT id FROM products WHERE id=? AND shop_id=?').bind(item.product,shop.id).first())fail('ไม่พบสินค้าในร้านนี้');
  if(item.category&&!await env.DB.prepare('SELECT id FROM products WHERE shop_id=? AND category=? LIMIT 1').bind(shop.id,item.category).first())fail('ไม่พบหมวดหมู่ในร้านนี้');
  campaigns.push(item);
 }
 const value={campaigns,featured:data.featured,newest:data.newest,order:data.order};
 await env.DB.prepare('UPDATE shops SET showcase_json=? WHERE id=? AND owner_id=?').bind(JSON.stringify(value),shop.id,user.id).run();
 return {ok:true};
}
export function renderShowcase(shop,products,{path,catalog,preview,catalogURL}){
 if(catalog.page!==1||catalog.q||catalog.category||catalog.sort!=='recommended')return '';
 const limit=showcaseLimits(shop.plan_id),data=readShowcase(shop.showcase_json);
 const live=products.filter(p=>p.status==='published');
 const campaigns=(Array.isArray(data.campaigns)?data.campaigns:[]).slice(0,limit.images).filter(c=>c.enabled&&c.key).map(c=>{
  const target=c.product?live.find(p=>p.id===c.product):null;
  const link=target?(preview?catalogURL(path,{q:target.name}):'/go/'+encodeURIComponent(target.id)):c.category?catalogURL(path,{category:c.category}):'';
  const picture=`<picture>${limit.mobile&&c.mobile?`<source media="(max-width: 600px)" srcset="${imageURL(c.mobile)}" width="${c.mobile_width}" height="${c.mobile_height}">`:''}<img src="${imageURL(c.key)}" alt="${e(c.alt)}" width="${c.width}" height="${c.height}" loading="lazy" decoding="async"></picture>`;
  return `<article class="campaign">${link?`<a href="${e(link)}"${target&&!preview?' target="_blank" rel="noopener nofollow"':''}>${picture}</a>`:picture}${c.title?`<h2>${e(c.title)}</h2>`:''}${c.caption?`<p>${e(c.caption)}</p>`:''}</article>`;
 }).join('');
 const rail=(id,title,items)=>!items.length?'':`<section class="showcase-section"><div class="section-heading"><h2>${title}</h2><div class="actions"><button type="button" class="secondary" data-rail="${id}" data-direction="-1" aria-label="เลื่อน${title}ไปทางซ้าย"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="14 5 7 12 14 19"/></svg></button><button type="button" class="secondary" data-rail="${id}" data-direction="1" aria-label="เลื่อน${title}ไปทางขวา"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="10 5 17 12 10 19"/></svg></button></div></div><div class="showcase-rail" id="${id}" tabindex="0" aria-label="${title} เลื่อนเพื่อดูสินค้า">${items.map(p=>`<article class="showcase-product">${(p.gallery[0]?.key||p.image_key)?`<img src="${imageURL(p.gallery[0]?.key||p.image_key)}" alt="${e(p.name)}" width="320" height="320" loading="lazy" decoding="async">`:''}<h3>${e(p.name)}</h3><strong>${priceLabel(p)}</strong><a class="button" href="${e(preview?catalogURL(path,{q:p.name}):'/go/'+encodeURIComponent(p.id))}"${preview?'':' target="_blank" rel="noopener nofollow"'}>${preview?'ดูในตัวอย่าง':'ซื้อที่ Thaimart ↗'}</a></article>`).join('')}</div></section>`;
 const sections={campaigns,featured:data.featured?rail('showcase-featured','สินค้าแนะนำ',live.filter(p=>p.featured).slice(0,limit.featured)):'',newest:data.newest?rail('showcase-newest','สินค้ามาใหม่',[...live].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))||String(b.id).localeCompare(String(a.id))).slice(0,limit.newest)):''};
 const order=limit.reorder&&Array.isArray(data.order)?[...new Set(data.order.filter(x=>showcaseOrder.includes(x))),...showcaseOrder.filter(x=>!data.order.includes(x))]:showcaseOrder;
 const html=order.map(key=>sections[key]).join('');
 return html?`<div class="shop-showcase">${html}</div>`:'';
}
