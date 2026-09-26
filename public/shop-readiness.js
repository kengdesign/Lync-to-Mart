const present=value=>typeof value==='string'&&value.trim().length>0;
const validPrice=value=>Number.isSafeInteger(value)&&value>=0;
export const readinessLabels={image:'ยังไม่มีรูปปก',description:'ยังไม่มีข้อความรายละเอียด',price:'ยังระบุราคาไม่ครบ',category:'ยังไม่มีหมวดหมู่'};
export function productIssues(product){
 return [!present(product.image_key)&&'image',!present(product.description)&&'description',
  (product.variants?.length?product.variants.some(v=>!validPrice(v.price)):!validPrice(product.price))&&'price',
  !present(product.category)&&'category'].filter(Boolean);
}
export function mountShopReadiness({root,shop,products,onEdit,onStore,onAdd}){
 const doc=root.ownerDocument;
 const el=(tag,text,className)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
 const button=(text,action)=>{const node=el('button',text,'secondary');node.type='button';node.onclick=action;return node;};
 root.replaceChildren();root.classList.add('shop-readiness');
 root.append(el('h2','ตรวจความพร้อมของร้าน'),el('p','ตรวจช่องข้อมูลที่บันทึกไว้ รวมฉบับร่างและสินค้าที่เผยแพร่แล้ว ไม่เปลี่ยนสถานะสินค้าอัตโนมัติ','muted'));
 const shopNotes=[];
 if(!present(shop.seo_description)&&!present(shop.description))shopNotes.push('ยังไม่มีคำอธิบายร้านสำหรับการค้นหาและแชร์');
 if(!present(shop.cover_key)&&!present(shop.logo_key))shopNotes.push('ยังไม่มีภาพปกหรือโลโก้ร้าน');
 if(!shop.published)shopNotes.push('หน้าร้านยังปิดอยู่');
 if(!products.some(p=>p.status==='published'))shopNotes.push('ยังไม่มีสินค้าที่เผยแพร่');
 if(shopNotes.length){const notice=el('div',undefined,'readiness-shop');notice.append(el('p',shopNotes.join(' · ')),button('ตั้งค่าหน้าร้าน',onStore));root.append(notice);}
 if(!products.length){root.append(el('p','เริ่มเพิ่มสินค้า แล้วกลับมาตรวจข้อมูลก่อนแชร์หน้าร้าน'),button('เพิ่มสินค้า',onAdd));return;}
 const rows=products.map(product=>({product,issues:productIssues(product)})).filter(row=>row.issues.length);
 const summary=el('p',`มีข้อมูลพื้นฐานครบ ${products.length-rows.length} / ${products.length} รายการ`,'readiness-summary');root.append(summary);
 root.append(el('small','ตรวจเฉพาะการมีข้อมูล ไม่ได้ตรวจว่ารูปเปิดได้ ข้อมูลถูกต้อง หรือรับประกันอันดับ SEO / การค้นหาด้วย AI · หากยังไม่ทราบราคา สามารถเว้นว่างไว้ได้'));
 if(!rows.length){root.append(el('p','ไม่พบช่องข้อมูลที่ขาดตามรายการตรวจนี้ ตรวจความถูกต้องของเนื้อหาอีกครั้งก่อนแชร์'));return;}
 const controls=el('div',undefined,'readiness-controls'),label=el('label','รายการที่ต้องตรวจ '),select=el('select');
 select.setAttribute('aria-label','กรองข้อมูลที่ต้องตรวจ');
 for(const [key,text] of [['all','ทั้งหมด'],...Object.entries(readinessLabels)]){const count=key==='all'?rows.length:rows.filter(row=>row.issues.includes(key)).length;const option=el('option',`${text} (${count})`);option.value=key;select.append(option);}
 label.append(select);controls.append(label);root.append(controls);
 const list=el('div',undefined,'readiness-list'),nav=el('div',undefined,'readiness-nav');root.append(list,nav);let page=1;
 function draw(){
  const filtered=rows.filter(row=>select.value==='all'||row.issues.includes(select.value)),pages=Math.max(1,Math.ceil(filtered.length/10));page=Math.min(page,pages);list.replaceChildren();nav.replaceChildren();
  for(const {product,issues} of filtered.slice((page-1)*10,page*10)){
   const row=el('div',undefined,'readiness-row'),info=el('div');info.append(el('strong',product.name),el('small',`${product.status==='published'?'เผยแพร่แล้ว':'ฉบับร่าง'} · ${issues.map(key=>readinessLabels[key]).join(' · ')}`));
   const edit=button('แก้ไข',()=>onEdit(product));edit.setAttribute('aria-label',`แก้ไข ${product.name}`);row.append(info,edit);list.append(row);
  }
  if(!filtered.length)list.append(el('p','ไม่พบสินค้าที่ต้องแก้ไขในหัวข้อนี้'));
  const status=el('span',`${filtered.length} รายการ · หน้า ${page} / ${pages}`);status.setAttribute('role','status');nav.append(status);
  if(pages>1){const actions=el('div',undefined,'actions');const back=button('← ก่อนหน้า',()=>{page--;draw();nav.querySelector('button:not(:disabled)')?.focus();});const next=button('ถัดไป →',()=>{page++;draw();nav.querySelector('button:not(:disabled)')?.focus();});back.disabled=page===1;next.disabled=page===pages;actions.append(back,next);nav.append(actions);}
 }
 select.onchange=()=>{page=1;draw();};draw();
}
