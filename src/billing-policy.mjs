// Calendar arithmetic in the storefront's Thai timezone, with end-of-month clamping.
export function addBillingMonths(seconds,months){
 const d=new Date((seconds+7*3600)*1000),day=d.getUTCDate();
 d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);
 const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
 d.setUTCDate(Math.min(day,last));return Math.floor(d.getTime()/1000)-7*3600;
}
export function upgradePolicy(period,start,end,clock){
 if(!['monthly','yearly'].includes(period)||!Number.isInteger(start)||start<=0||start>clock||!Number.isInteger(end)||end<=clock)throw Error('ไม่พบวันเริ่มรอบสมาชิกที่ถูกต้อง กรุณาตรวจสอบสถานะล่าสุด');
 const deadline=period==='monthly'?start+15*86400:addBillingMonths(start,6);
 return {pricing_mode:clock<=deadline?'difference':'full',discount_deadline:deadline,period_start:start,period_end:end,period};
}
