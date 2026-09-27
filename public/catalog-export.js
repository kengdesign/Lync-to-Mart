const cell=value=>{let text=String(value??'');if(typeof value==='string'&&/^[\s\u0000-\u001f]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
const baht=value=>Number.isSafeInteger(value)&&value>=0?(value/100).toFixed(2):'';
export function catalogCSV(products,shopId){
 const rows=[['รหัสร้าน','รหัสสินค้า','ชื่อสินค้า','หมวดหมู่','สถานะ','ราคาเริ่มต้น (บาท)','ตัวเลือก','SKU','ราคาตัวเลือก (บาท)','น้ำหนักตามที่ระบุ','ขนาดตามที่ระบุ','พร้อมขายตามข้อมูลที่บันทึก','ลิงก์ต้นทาง','ลิงก์ซื้อที่กำหนด','ลิงก์ซื้อที่ใช้งาน','จำนวนรูปแกลเลอรี','รายละเอียด (ข้อความ)']];
 for(const p of products){for(const [index,v] of (p.variants?.length?p.variants:[null]).entries())rows.push([shopId,p.id,p.name,p.category,p.status==='published'?'เผยแพร่แล้ว':'ฉบับร่าง',baht(p.price),v?(v.attributes||[]).map(a=>`${a.key}: ${a.value}`).join(' | '):'',v?.sku||'',v?baht(v.price):'',v?.weight||'',v?.dimensions||'',v?(v.available===false?'ไม่พร้อมขาย':'พร้อมขาย'):'',index===0?p.source_url:'',index===0?p.checkout_url||'':'',index===0?p.checkout_url||p.source_url:'',p.gallery?.length|| (p.image_key?1:0),index===0?p.description||'':'']);}
 return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
function downloadCSV(text,name){const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function mountCatalogExport(root,{products,filtered,shopId,download=downloadCSV}){
 const previous=root.querySelector('select')?.value||'filtered',doc=root.ownerDocument;root.replaceChildren();root.className='catalog-export';
 const label=doc.createElement('label');label.textContent='ส่งออกสินค้า ';const select=doc.createElement('select');select.setAttribute('aria-label','ขอบเขตส่งออกสินค้า');
 for(const [key,text,items] of [['filtered','ตามคำค้นและตัวกรอง',filtered],['all','ทั้งร้าน',products]]){const option=doc.createElement('option');option.value=key;option.textContent=`${text} (${items.length} สินค้า)`;select.append(option);}select.value=previous;label.append(select);
 const button=doc.createElement('button');button.type='button';button.className='secondary';button.textContent='ดาวน์โหลด CSV';
 const note=doc.createElement('small');note.textContent='รวมทุกหน้าตามขอบเขตที่เลือก · สินค้ามีตัวเลือกจะแยกหนึ่งแถวต่อแบบ · รายละเอียดและลิงก์อยู่แถวแรกของสินค้า · เป็นข้อมูลที่บันทึกไว้ ไม่ใช่ราคา/สต็อกสด · ไม่รวมไฟล์รูปและวิดีโอ';
 const items=()=>select.value==='all'?products:filtered;select.onchange=()=>button.disabled=!items().length;select.onchange();
 button.onclick=()=>{if(!items().length)return;download(catalogCSV(items(),shopId),`lync-to-mart-products-${shopId}-${select.value}.csv`);};root.append(label,button,note);
}
