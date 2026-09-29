export function renderAdminBackup(root,data){
 root.replaceChildren();
 const labels={not_connected:'ยังไม่เชื่อมพื้นที่สำรอง',waiting:'ยังไม่มีผลการสำรอง',running:'กำลังสำรองเป็นชุดย่อย',complete:'สำรองครบหนึ่งรอบแล้ว',error:'สำรองผิดพลาด ต้องตรวจสอบ',disabled:'ปิดงานสำรอง',unknown:'ไม่ทราบสถานะ',unavailable:'อ่านสถานะไม่ได้ กรุณาลองใหม่'};
 const heading=document.createElement('h2');heading.textContent='สำรองรูปภาพ R2';root.append(heading);
 const text=document.createElement('p');text.textContent=labels[data.status]||labels.unknown;root.append(text);
 const date=value=>{const d=new Date(value);return value&&Number.isFinite(+d)?d.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}):'ยังไม่มี';};
 for(const [label,value] of [['ครบทั้งรอบล่าสุด',date(data.lastCompleteAt)],['ทำงานชุดล่าสุด',date(data.lastBatchAt)],['คัดลอก / ข้าม (ชุดล่าสุด)',`${data.copied||0} / ${data.skipped||0}`]]){
  const p=document.createElement('p');p.textContent=label+': '+value;root.append(p);
 }
 const note=document.createElement('p');note.textContent='สถานะนี้เฉพาะรูปภาพ ไม่ใช่ผลสำรอง D1 หรือการรับรองว่ากู้คืนทั้งระบบแล้ว วันที่ล่าสุดอาจเก่าได้หากงานหยุดทำงาน';root.append(note);
}
