import {parse} from 'parse5';
import {sanitizeContent,plainHTML,remoteImage} from './content.mjs';
export const cents=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0?Math.round(Number(value)*100):null;
// Read JSON embedded in the public HTML. Never evaluate scripts or call private APIs.
export function extractProduct(html,sourceURL=''){
 const scripts=[];function dom(n){if(n.tagName==='script')scripts.push({attrs:Object.fromEntries((n.attrs||[]).map(a=>[a.name,a.value])),text:(n.childNodes||[]).map(x=>x.value||'').join('')});for(const c of n.childNodes||[])dom(c);}dom(parse(html));
 const objects=[];function visit(n,depth=0){if(!n||typeof n!=='object'||depth>60)return;if(!Array.isArray(n))objects.push(n);for(const v of Object.values(n))visit(v,depth+1);}
 let flight='';for(const s of scripts){if(s.attrs.type==='application/ld+json'){try{visit(JSON.parse(s.text));}catch{}}
  const m=s.text.trim().match(/^self\.__next_f\.push\((\[[\s\S]*\])\);?$/);if(m){try{const v=JSON.parse(m[1]);if(v[0]===1&&typeof v[1]==='string')flight+=v[1];}catch{}}
 }
 const references=new Map(),encoded=new TextEncoder().encode(flight),decoder=new TextDecoder();let offset=0;
 while(offset<encoded.length){
  const prefix=decoder.decode(encoded.slice(offset,offset+80));const textRecord=prefix.match(/^([a-f0-9]+):T([a-f0-9]+),/i);
  if(textRecord){const start=offset+textRecord[0].length,length=parseInt(textRecord[2],16);if(start+length>encoded.length)break;references.set(textRecord[1],decoder.decode(encoded.slice(start,start+length)));offset=start+length;continue;}
  let end=encoded.indexOf(10,offset);if(end<0)end=encoded.length;const line=decoder.decode(encoded.slice(offset,end));offset=end+1;
  const m=line.match(/^[a-f0-9]+:([\[{][\s\S]*)$/i);if(m){try{visit(JSON.parse(m[1]));}catch{}}
 }
 let id;try{id=new URL(sourceURL).pathname.match(/^\/products\/([a-f0-9]{24})\/?$/i)?.[1];}catch{}
 const native=id&&objects.find(p=>p.id===id&&typeof p.name==='string'&&Array.isArray(p.variants)&&Array.isArray(p.images));
 const p=native||objects.find(p=>[p['@type']].flat().includes('Product')&&typeof p.name==='string');if(!p)return null;
 const warnings=[];if(p.video)warnings.push('ต้นทางมีวิดีโอ รุ่นนี้นำเข้าเฉพาะข้อความและรูปภาพ วิดีโอยังไม่นำเข้า');let description=typeof p.description==='string'?p.description:'';if(/^\$[a-f0-9]+$/i.test(description)&&references.has(description.slice(1)))description=references.get(description.slice(1));
 // Flight references are not product descriptions; refuse to fabricate missing content.
 if(/^\$[a-f0-9]+$/i.test(description)){description='';warnings.push('รายละเอียดต้นทางไม่ได้ส่งมาเป็นข้อความ กรุณาตรวจและเพิ่มรายละเอียด');}
 const content=sanitizeContent(/<\/?[a-z][\s\S]*>/i.test(description)?description:plainHTML(description),{remote:true});
 const rawImages=native?[...p.images,...p.variants.map(v=>v.image).filter(Boolean)]:[p.image||[]].flat();const gallery=[];
 for(const item of rawImages){const url=remoteImage(typeof item==='string'?item:item?.url||item?.contentUrl);if(url&&!gallery.some(x=>x.url===url))gallery.push({url,alt:p.name});else if(item&&!url)warnings.push('มีรูปจากโดเมนที่ยังไม่รองรับ กรุณาอัปโหลดเอง');}
 const mappedVariants=native?p.variants.map(v=>({sku:String(v.sku||''),image_url:remoteImage(v.image?.url)||'',attributes:(Array.isArray(v.attributes)?v.attributes:[]).map(a=>({key:String(a?.key??'').trim(),value:String(a?.value??'').trim()})).filter(a=>a.key||a.value),price:cents(v.markupPrice??v.price),weight:v.weight==null?'':String(v.weight),dimensions:v.dimensions?Object.entries(v.dimensions).map(([k,v])=>`${k}: ${v}`).join(' · '):'',available:v.isActive!==false&&Number(v.remainingQuantity??v.quantity??1)>0})):[];
 // A single attribute-free inventory row is the base product, not a buyer option.
 const baseVariant=mappedVariants.length===1&&mappedVariants[0].attributes.length===0?mappedVariants[0]:null;
 const variants=baseVariant?[]:mappedVariants;
 if(variants.some(v=>!v.attributes.length||v.attributes.some(a=>!a.key||!a.value)))throw new Error('ต้นทางมีรายการตัวเลือกแต่ข้อมูลคุณลักษณะไม่ครบ กรุณาตรวจและเพิ่มข้อมูลด้วยตนเอง');
 if(baseVariant){
  const specs=[baseVariant.sku?`SKU: ${baseVariant.sku}`:'',baseVariant.weight?`น้ำหนัก: ${baseVariant.weight}`:'',baseVariant.dimensions?`ขนาด: ${baseVariant.dimensions}`:''].filter(Boolean);
  if(specs.length)warnings.push('ข้อมูลรายการพื้นฐานจากต้นทาง (ไม่ใช่ตัวเลือกย่อย): '+specs.join(' · ')+' · ตรวจสอบหน่วยกับต้นทางก่อนนำไปใช้');
 }
 if(variants.length)warnings.push('ตรวจราคา ตัวเลือก น้ำหนัก และหน่วยขนาดกับต้นทางก่อนยืนยัน สต็อกไม่ซิงก์อัตโนมัติ');
 if(!content.text)warnings.push('ไม่พบรายละเอียดข้อความ กรุณาเพิ่มข้อมูลสินค้า');
 const offer=Array.isArray(p.offers)?p.offers[0]:p.offers;
 const price=native?(cents(p.minMarkupPrice??p.minPrice)??baseVariant?.price??null):(offer?.priceCurrency==='THB'?cents(offer.price):null);
 if(gallery.length>40||variants.length>100||content.html.length>100000)throw new Error('ข้อมูลสินค้ามากกว่าขีดจำกัดที่รองรับ กรุณาเพิ่มข้อมูลด้วยตนเอง');
 return {name:p.name.slice(0,180),description:content.text,description_html:content.html,gallery,variants,price,category:native?(p.categoryPath||[]).map(c=>c.name).join(' / '):String(p.category||''),source_currency:native?'THB':offer?.priceCurrency||null,image_detected:gallery.length>0,source_url:sourceURL,warnings:[...new Set(warnings)],imported_at:new Date().toISOString()};
}
export async function boundedHTML(response,limit=2000000){const reader=response.body?.getReader();if(!reader)throw new Error('ไม่พบข้อมูลต้นทาง');let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Error('ข้อมูลมีขนาดใหญ่เกินไป');}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return new TextDecoder().decode(bytes);}
