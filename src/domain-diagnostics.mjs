import {domainProvider} from './domain-provider.mjs';
function diagnosticError(error){
 const status=Number.isInteger(error?.status)?error.status:0;
 const codes=Array.isArray(error?.codes)?error.codes.filter(Number.isSafeInteger).join(','):'';
 const label=error?.kind==='network'?'เครือข่ายหรือหมดเวลารอ':error?.kind==='invalid_response'?'รูปแบบคำตอบไม่ถูกต้อง':status===401||status===403?'Cloudflare ปฏิเสธการเข้าถึง':status===404?'ไม่พบทรัพยากรที่ร้องขอ':'คำขอไม่สำเร็จ';
 return label+(status?' · HTTP '+status:'')+(codes?' · CF code '+codes:'');
}
export async function providerDiagnostics(env,user,role,method,fetcher=fetch){
 const fail=(message,status)=>{throw Object.assign(new Error(message),{status});};
 if(env.APP_ENV!=='staging'||env.DOMAIN_PREPARATION_ENABLED!=='true')fail('ยังไม่เปิดการตรวจระบบโดเมน',404);
 if(role!=='owner'||user.team||user.impersonation)fail('เฉพาะผู้ดูแลระบบสูงสุดตรวจการเชื่อมต่อได้',403);
 if(method!=='GET')fail('Method not allowed',405);
 if(!env.MART_DOMAIN_API_TOKEN||env.MART_DOMAIN_ZONE_ID!=='f0b5797bfb2571e56c55b7dedd8fbcbc')return {ready:false,message:'ยังไม่ได้ตั้งค่า Token หรือ Zone ของ Mart ให้ครบ'};
 const provider=domainProvider(env,fetcher);
 const results=await Promise.allSettled([provider.fallback(),provider.quota()]);
 const fallback=results[0],quota=results[1];
 if(fallback.status!=='fulfilled')return {ready:false,message:'ตรวจ Fallback ไม่สำเร็จ: '+diagnosticError(fallback.reason)+' · Zone lynctomart.com · ส่งข้อความนี้ให้ผู้ดูแลตรวจสอบ'};
 const active=fallback.value?.status==='active'&&fallback.value?.origin==='fallback.lynctomart.com';
 return {ready:false,token_verified:true,fallback_active:active,quota_checked:quota.status==='fulfilled',message:active?'Token ใช้งานได้ · Fallback ของ lynctomart.com เป็น Active · '+(quota.status==='fulfilled'?'อ่านข้อมูลโควตาได้':'ยังอ่านโควตาไม่ได้: '+diagnosticError(quota.reason))+' · ยังต้องตั้ง Gateway และทดสอบ HTTPS ก่อนเปิดร้านผ่านโดเมนจริง':'Token ใช้งานได้ แต่ Fallback ยังไม่พร้อมหรือชื่อปลายทางไม่ตรงกับ fallback.lynctomart.com'};
}
