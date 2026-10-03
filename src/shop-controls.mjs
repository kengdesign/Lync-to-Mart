const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export async function manageShop(env,actor,role,b){
 if(role!=='owner')fail('เฉพาะแอดมินสูงสุดเท่านั้นที่จัดการสถานะร้านค้าได้',403);
 if(!b||!['active','suspended','banned','deleted'].includes(b.status))fail('สถานะร้านค้าไม่ถูกต้อง');
 const reason=typeof b.reason==='string'?b.reason.trim():'';
 if(reason.length<5||reason.length>500)fail('กรุณาระบุเหตุผล 5–500 ตัวอักษร');
 const shop=await env.DB.prepare('SELECT id,owner_id,slug,moderation_status FROM shops WHERE id=?').bind(typeof b.shop_id==='string'?b.shop_id:'').first();
 if(!shop)fail('ไม่พบร้านค้า',404);
 if(b.confirm_slug!==shop.slug)fail('กรุณาพิมพ์ชื่อในลิงก์ร้านให้ตรงเพื่อยืนยัน');
 if(b.expected_status!==shop.moderation_status)fail('สถานะร้านเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุด',409);
 // Keep products, media and publication choice intact. Restoring always returns a draft.
 await env.DB.batch([
  env.DB.prepare('INSERT INTO admin_audit(id,actor_id,target_id,shop_id,action,reason) SELECT ?,?,?,id,?,? FROM shops WHERE id=? AND moderation_status=?').bind(crypto.randomUUID(),actor.id,shop.owner_id,'shop_status',reason+' | '+JSON.stringify({from:shop.moderation_status,to:b.status}),shop.id,b.expected_status),
  env.DB.prepare("UPDATE shops SET moderation_status=?,moderation_reason=?,moderation_updated_at=CURRENT_TIMESTAMP,published=CASE WHEN ?='active' THEN 0 ELSE published END WHERE id=? AND moderation_status=?").bind(b.status,reason,b.status,shop.id,b.expected_status)
 ]).then(results=>{if(!results[1].meta.changes)fail('สถานะร้านเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุด',409);});
 return {ok:true,message:b.status==='active'?'คืนสถานะร้านเป็นฉบับร่างแล้ว เจ้าของร้านสามารถตรวจสอบและเผยแพร่อีกครั้ง':'บันทึกสถานะร้านแล้ว มีผลเฉพาะร้านนี้ โดยยังไม่เปลี่ยนการเรียกเก็บเงิน'};
}
