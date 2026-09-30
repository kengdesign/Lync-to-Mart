import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export function productionPreflight(config,staging){
 const errors=[],v=config.vars||{};
 const require=(ok,message)=>{if(!ok)errors.push(message);};
 require(config.name==='lync-to-mart-production','Worker ต้องชื่อ lync-to-mart-production');
 require(v.APP_ENV==='production','APP_ENV ต้องเป็น production');
 require(config.workers_dev===false&&config.preview_urls===false,'ปิด workers.dev และ Preview URLs ของ Production');
 require(config.routes?.length===1&&config.routes[0].pattern==='mart.lyncto.link'&&config.routes[0].custom_domain===true,'กำหนด Custom Domain mart.lyncto.link');
 require(v.RECOVERY_ORIGIN==='https://mart.lyncto.link','ลิงก์อีเมลต้องกลับ mart.lyncto.link');
 require(!Object.keys(v).some(k=>k.startsWith('STAGING_')||k==='STRIPE_TEST_EMAILS'),'ห้ามคัดลอกตัวแปรสิทธิ์ทดสอบเข้า Production');
 require(!Object.keys(v).some(k=>/SECRET|TOKEN|PASSWORD/.test(k)),'เก็บ Secret ใน Cloudflare เท่านั้น ห้ามใส่ในไฟล์');
 const db=config.d1_databases?.find(d=>d.binding==='DB'),media=config.r2_buckets?.find(b=>b.binding==='MEDIA');
 require(db?.database_name==='lync-to-mart-production'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(db?.database_id||''),'ใส่ Database ID จริงของ D1 Production');
 require(db?.database_id!==staging.d1_databases?.[0]?.database_id,'D1 Production ต้องแยกจาก Staging');
 require(media?.bucket_name==='lync-to-mart-production-media'&&media.bucket_name!==staging.r2_buckets?.[0]?.bucket_name,'R2 Production ต้องแยกจาก Staging');
 require(v.SIGNUP_ENABLED==='false','รอบเตรียมระบบต้องปิดสมัครสาธารณะไว้ก่อน');
 require(['false','true'].includes(v.BILLING_ENABLED),'BILLING_ENABLED ต้องเป็น true หรือ false');
 if(v.BILLING_ENABLED==='true'){
  const keys=['STARTER','GROWTH','BRAND'].flatMap(plan=>['MONTHLY','YEARLY'].map(period=>'STRIPE_PRICE_'+plan+'_'+period));
  require(keys.every(key=>/^price_[A-Za-z0-9]+$/.test(v[key]||'')&&v[key]!==staging.vars?.[key]),'เปิด Billing ต้องตั้ง Price ทั้ง 6 รายการแยกจาก Staging');
  require(new Set(keys.map(key=>v[key])).size===6,'Price ทั้ง 6 รายการต้องไม่ซ้ำกัน');
  require(/^txr_[A-Za-z0-9]+$/.test(v.STRIPE_VAT_RATE_ID||'')&&v.STRIPE_VAT_RATE_ID!==staging.vars?.STRIPE_VAT_RATE_ID,'เปิด Billing ต้องตั้ง VAT Rate แยกจาก Staging');
 }

 return {configuration_valid:errors.length===0,launch_ready:false,errors,remaining:['ยืนยัน Webhook และการเปิดสิทธิ์จากรายการสมัครจริง (preflight ตรวจได้เฉพาะไฟล์ตั้งค่า)','ตั้ง Postmark Secret และทดสอบอีเมลบนโดเมนจริง','สร้างบัญชีเจ้าของและแต่งตั้งแอดมินสูงสุดในฐานข้อมูลใหม่','ยืนยันสำรองและกู้คืนข้อมูลบน Cloudflare จริง','ทดสอบสมัคร ร้านค้า ทีม และชำระเงินครบวงจรบน Production ก่อนเปิดสาธารณะ']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const result=productionPreflight(JSON.parse(readFileSync(process.argv[2]||'wrangler.production.example.jsonc','utf8')),JSON.parse(readFileSync('wrangler.jsonc','utf8')));console.log(JSON.stringify(result,null,2));process.exitCode=result.configuration_valid?0:1;}
 catch{console.error('อ่านไฟล์ตั้งค่าไม่สำเร็จ กรุณาระบุไฟล์ Production JSON ที่ถูกต้อง');process.exitCode=1;}
}
