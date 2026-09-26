const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>Number(value).toLocaleString('th-TH');
const mb=value=>(value/1000000).toLocaleString('th-TH',{maximumFractionDigits:2});
function card(title,q,storage=false){const format=storage?mb:number;return `<article class="usage-card ${q.status}"><div class="usage-card-heading"><h3>${title}</h3><span class="badge">${q.status==='full'?'ถึงขีดจำกัด':q.status==='near'?'ใกล้เต็ม':'ยังมีโควตา'}</span></div><div class="usage-value"><strong>${format(q.used)}</strong><span>/ ${format(q.limit)} ${storage?'MB':'รายการ'}</span></div><progress max="${Math.max(1,q.limit)}" value="${Math.min(q.used,q.limit)}" aria-label="${title} ใช้ ${format(q.used)} จาก ${format(q.limit)}">${q.percent}%</progress><p>เหลือ ${format(q.remaining)} ${storage?'MB':'รายการ'}${q.used>q.limit?' · ใช้เกินโควตาปัจจุบัน':''}</p></article>`;}
export function mountAccountUsage({root,api}){
 let sequence=0;
 async function refresh(){
  const request=++sequence;root.setAttribute('aria-busy','true');root.innerHTML='<p role="status">กำลังอ่านโควตาของบัญชี…</p>';
  try{
   const data=await api('/usage');if(!root.isConnected||request!==sequence)return;
   const alerts=[];
   if(data.products.status==='full')alerts.push('จำนวนสินค้าถึงขีดจำกัดแล้ว ยังแก้ไขสินค้าเดิมได้ หากต้องการเพิ่มรายการใหม่ ให้ลบสินค้าที่ไม่ใช้ก่อน');
   else if(data.products.status==='near')alerts.push(`โควตาสินค้าใกล้เต็ม เพิ่มได้อีก ${number(data.products.remaining)} รายการ`);
   if(data.storage.status==='full')alerts.push('พื้นที่ไฟล์ถึงขีดจำกัดแล้ว ไม่สามารถอัปโหลดเกินพื้นที่ที่เหลือได้ กรุณาติดต่อผู้ดูแล');
   else if(data.storage.status==='near')alerts.push(`พื้นที่ไฟล์ใกล้เต็ม เหลือ ${mb(data.storage.remaining)} MB`);
   root.innerHTML=`<div class="panel usage-overview"><div class="usage-heading"><div><span class="eyebrow">ACCOUNT USAGE</span><h2>แพ็กเกจ ${esc(data.plan.name)}</h2><p class="muted">การใช้งานรวมของบัญชี · อัปเดตเมื่อเปิดหน้านี้</p></div><button type="button" class="secondary" data-refresh>อัปเดตข้อมูล</button></div><div class="usage-cards">${card('ร้านค้า',data.shops)}${card('สินค้า',data.products)}${card('พื้นที่รูปและวิดีโอ',data.storage,true)}</div>${alerts.length?`<div class="notice" role="status">${alerts.map(x=>`<p>${esc(x)}</p>`).join('')}</div>`:''}<div class="usage-explanation"><p>สินค้านับรวมฉบับร่างและเผยแพร่แล้วของทุกร้าน การเปลี่ยนเป็นฉบับร่างไม่คืนโควตา</p><p>ไฟล์สะสม ${number(data.storage.files)} ไฟล์ · รูป ${mb(data.storage.image_bytes)} MB · วิดีโอ ${mb(data.storage.video_bytes)} MB</p><p>พื้นที่นับไฟล์ที่อัปโหลดและนำเข้าทั้งหมด รวมไฟล์ที่ยังไม่ได้ใช้ การนำรูปออกจากสินค้า หรือลบสินค้า ยังไม่คืนพื้นที่ไฟล์อัตโนมัติ</p><p>พื้นที่ทดสอบปัจจุบัน 500 MB ต่อบัญชีในทุกแพ็กเกจ · 1 MB = 1,000,000 ไบต์</p></div></div><section class="panel usage-stores"><h2>สินค้าของแต่ละร้าน</h2>${data.stores.length?`<div class="table-wrap"><table><thead><tr><th>ร้านค้า</th><th>ทั้งหมด</th><th>เผยแพร่</th><th>ฉบับร่าง</th></tr></thead><tbody>${data.stores.map(s=>`<tr><td><strong>${esc(s.name)}</strong><small class="usage-store-status">${s.published?'เปิดหน้าร้าน':'ปิดหน้าร้าน'}</small></td><td>${number(s.products)}</td><td>${number(s.published_products)}</td><td>${number(s.products-s.published_products)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">ยังไม่มีร้านค้า เริ่มสร้างร้านได้จากเมนูภาพรวม</p>'}</section>`;
   root.querySelector('[data-refresh]').onclick=refresh;
  }catch(error){if(!root.isConnected||request!==sequence)return;root.innerHTML=`<div class="panel"><p class="error" role="alert">${esc(error.message)}</p><button type="button" data-retry>ลองโหลดโควตาอีกครั้ง</button></div>`;root.querySelector('[data-retry]').onclick=refresh;}
  finally{if(root.isConnected&&request===sequence)root.removeAttribute('aria-busy');}
 }
 refresh();
}
