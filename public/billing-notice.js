const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={starter:'Starter',growth:'Growth',brand:'Brand'};
const date=n=>new Date(n*1000).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'});
export function billingNotice(data,clock=Math.floor(Date.now()/1000)){
 if(!data.ready||!data.eligible)return null;
 const sub=data.subscription,up=data.upgrade,down=data.downgrade,card=data.card_update;
 if([up,down,card].some(x=>x?.status==='review'))return {tone:'warning',title:'มีรายการที่ต้องให้ผู้ดูแลตรวจสอบ',text:'รายการเปลี่ยนแพ็กเกจหรือบัตรยังยืนยันไม่ครบ กรุณาตรวจรายละเอียดและอย่าชำระซ้ำ',action:'ดูรายการที่ต้องตรวจสอบ'};
 if(['past_due','unpaid','incomplete'].includes(sub?.status))return {tone:'warning',title:sub.status==='incomplete'?'การสมัครยังรอยืนยันชำระเงิน':'พบปัญหาการชำระเงิน',text:'เปิดหน้าแพ็กเกจเพื่อตรวจสอบสถานะล่าสุดและบิลจาก Stripe ก่อนทำรายการต่อ',action:'ตรวจสอบการชำระเงิน'};
 if(up)return {tone:'info',title:'มีรายการอัปเกรดค้างอยู่',text:'กลับไปชำระรายการเดิมหรือยกเลิกรายการได้จากหน้าแพ็กเกจ หากชำระแล้วให้ตรวจสอบสถานะล่าสุดก่อน',action:'จัดการรายการอัปเกรด'};
 if(card?.status==='pending')return {tone:'info',title:'การเปลี่ยนบัตรยังไม่ยืนยันเสร็จ',text:'กลับไปบันทึกบัตร ตรวจสอบสถานะ หรือยกเลิกรายการได้จากหน้าแพ็กเกจ',action:'จัดการรายการเปลี่ยนบัตร'};
 if(down){const scheduled=down.status==='scheduled';return {tone:scheduled?'info':'warning',title:scheduled?'กำหนดลดแพ็กเกจแล้ว':'คำขอลดแพ็กเกจยังดำเนินการไม่เสร็จ',text:scheduled?`เปลี่ยนเป็น ${names[down.plan]||down.plan} วันที่ ${date(down.effective_at)} ตามคำขอ ตรวจรายละเอียดหรือยกเลิกคำขอได้ในหน้าแพ็กเกจ`:'กรุณาตรวจสอบหรือทำรายการเดิมต่อในหน้าแพ็กเกจ',action:'ดูคำขอลดแพ็กเกจ'};}
 if(sub?.paid_until&&sub.paid_until<=clock&&(sub.status==='active'||sub.status==='canceled'&&clock-sub.paid_until<=7*86400))return {tone:'warning',title:'ถึงวันสิ้นสุดสิทธิ์ชำระเงินที่บันทึกไว้แล้ว',text:'กรุณาตรวจสอบสถานะล่าสุดเพื่อยืนยันการต่ออายุ สิทธิ์โปรโมชั่นจากแอดมินอาจมีระยะเวลาแยกต่างหาก',action:'ตรวจสอบสถานะสมาชิก'};
 if(sub?.cancel_at_period_end&&sub.paid_until>clock&&sub.paid_until-clock<=7*86400)return {tone:'warning',title:'สิทธิ์ชำระเงินใกล้สิ้นสุด · ปิดต่ออายุไว้',text:`สิทธิ์รอบนี้ถึง ${date(sub.paid_until)} หากต้องการใช้ต่อ สามารถเปิดต่ออายุอีกครั้งในหน้าแพ็กเกจ ข้อมูลร้านและสินค้าจะไม่ถูกลบเมื่อสิ้นสุดรอบ`,action:'ดูตัวเลือกการต่ออายุ'};
 return null;
}
export async function mountBillingNotice({root,api,onManage,impersonation=false}){
 root.hidden=true;if(impersonation)return;
 let notice,data;
 try{data=await api('/billing/status');notice=billingNotice(data);}catch{notice={tone:'info',title:'ยังโหลดสถานะสมาชิกไม่ได้',text:'ตรวจสอบอีกครั้งได้จากหน้าแพ็กเกจ ส่วนอื่นของร้านยังใช้งานต่อได้',action:'ไปหน้าแพ็กเกจ'};}
 if(!root.isConnected||!notice)return;
 root.className='billing-overview-notice '+notice.tone;root.hidden=false;
 root.innerHTML=`<div><h2>${esc(notice.title)}</h2><p>${esc(notice.text)}</p>${data?.subscription?.updated_at?`<small>ข้อมูลสมาชิกที่บันทึกล่าสุด ${esc(new Date(data.subscription.updated_at*1000).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}))}</small>`:''}</div><button type="button">${esc(notice.action)}</button>`;
 root.querySelector('button').onclick=onManage;
}
