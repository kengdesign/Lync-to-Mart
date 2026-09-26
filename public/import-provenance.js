export function mountImportProvenance(root,raw){
 root.replaceChildren();if(!raw)return;
 let data;try{data=JSON.parse(raw);}catch{return;}
 if(!data||typeof data!=='object')return;
 const date=new Date(data.read_at);if(!Number.isFinite(date.getTime()))return;
 const doc=root.ownerDocument,heading=doc.createElement('strong'),time=doc.createElement('p'),source=doc.createElement('p'),note=doc.createElement('small');
 root.className='import-summary import-provenance';heading.textContent='ข้อมูลต้นทางที่ยืนยันบันทึกล่าสุด';
 time.textContent='อ่านข้อมูลเมื่อ '+new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(date)+' (เวลาไทย)';
 source.textContent=String(data.source_url||'');source.className='provenance-url';
 note.textContent='ร้านค้าอาจแก้ไขข้อมูลหลังนำเข้าแล้ว · ไม่ใช่เวลาอัปเดตจาก Thaimart และยังไม่ซิงก์ราคา/สต็อกอัตโนมัติ';
 root.append(heading,time,source,note);
}
