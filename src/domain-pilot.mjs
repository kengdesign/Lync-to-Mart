import {domainProvider} from './domain-provider.mjs';
const HOST='thaimart.logintimate.com';
const ZONE='f0b5797bfb2571e56c55b7dedd8fbcbc';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
// One durable slot, including unknown outcomes. No automatic re-create after a timeout.
export const pilotSchema=`CREATE TABLE IF NOT EXISTS mart_domain_pilot (hostname TEXT PRIMARY KEY CHECK(hostname='thaimart.logintimate.com'),domain_id TEXT NOT NULL,provider_id TEXT,enabled INTEGER NOT NULL DEFAULT 0,attempted INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL)`;
export async function pilotRequest(env,user,role,method,data={},fetcher=fetch){
 if(env.APP_ENV!=='staging'||role!=='owner'||user.team||user.impersonation)fail('เฉพาะผู้ดูแลสูงสุดใน Staging',403);
 if(method!=='POST')fail('Method not allowed',405);
 const domain=await env.DB.prepare('SELECT * FROM shop_domains WHERE hostname=? AND owner_id=?').bind(HOST,user.id).first();
 if(!domain||domain.status!=='verified')fail('ต้องยืนยันเจ้าของโดเมนทดสอบก่อน');
 if(!['prepare','check','pause','disconnect'].includes(data.action))fail('คำสั่งไม่ถูกต้อง');
 await env.DB.prepare(pilotSchema).run();
 const provider=domainProvider(env,fetcher);
 let slot=await env.DB.prepare('SELECT * FROM mart_domain_pilot WHERE hostname=?').bind(HOST).first();
 if(slot&&slot.domain_id!==domain.id)fail('โดเมนนี้มีรายการเชื่อมต่อเดิม ต้องตรวจสอบก่อน',409);
 if(data.action==='pause'){await env.DB.prepare('UPDATE mart_domain_pilot SET enabled=0 WHERE hostname=?').bind(HOST).run();return {message:'ปิดการแสดงหน้าร้านแล้ว แต่ hostname ยังอยู่บน Cloudflare ให้ถอดการเชื่อมต่อหากต้องการหยุดนับโควตา'};}
 if(data.action==='disconnect'){
  if(!slot?.provider_id)fail('ไม่พบรหัส Cloudflare ที่ยืนยันได้ กรุณาให้ผู้ดูแลตรวจรายการก่อน');
  await env.DB.prepare('UPDATE mart_domain_pilot SET enabled=0 WHERE hostname=?').bind(HOST).run();
  await provider.remove({provider_zone_id:ZONE,managed_by:'lync-to-mart',provider_id:slot.provider_id,hostname:HOST});
  await env.DB.prepare('DELETE FROM mart_domain_pilot WHERE hostname=? AND provider_id=?').bind(HOST,slot.provider_id).run();
  return {message:'ลบ hostname จาก Cloudflare แล้ว กรุณาถอด CNAME ของโดเมนทดสอบด้วย'};
 }
 if(data.action==='prepare'&&!slot){
  const health=await fetcher('https://shops.lynctomart.com/__mart_gateway_health',{redirect:'manual',signal:AbortSignal.timeout(10000)});
  if(!health.ok)fail('Gateway ยังไม่พร้อม ต้อง Deploy Worker Gateway ก่อน',409);
  const h=await health.json();if(h.service!=='mart-domain-gateway'||h.environment!=='staging'||h.version!==1)fail('Gateway ปลายทางไม่ตรงกับ Mart Staging',409);
  const fallback=await provider.fallback();if(fallback.status!=='active'||fallback.origin!=='fallback.lynctomart.com')fail('Fallback ยังไม่พร้อม',409);
  const quota=await provider.quota();
  if(!Number.isFinite(quota.used)||!Number.isFinite(quota.allocated)||quota.used>=Math.min(quota.allocated,100)||quota.exceeded===true)fail('โควตาเกินเพดานทดสอบหรือยังยืนยันไม่ได้ หยุดสร้างไว้ก่อน',409);
  const dns=await fetcher('https://cloudflare-dns.com/dns-query?name='+encodeURIComponent('_lynctomart.'+HOST)+'&type=TXT',{headers:{Accept:'application/dns-json'},signal:AbortSignal.timeout(5000)});
  if(!dns.ok)fail('ตรวจ TXT ไม่สำเร็จ',502);const proof=await dns.json();
  if(proof.Status!==0||!proof.Answer?.some(a=>a.type===16&&a.data===JSON.stringify(domain.verification_token)))fail('ไม่พบ TXT ยืนยันเจ้าของปัจจุบัน',409);
  const claimed=await env.DB.prepare('INSERT OR IGNORE INTO mart_domain_pilot(hostname,domain_id,attempted,created_at) VALUES(?,?,1,?)').bind(HOST,domain.id,Math.floor(Date.now()/1000)).run();
  if(!claimed.meta.changes)fail('มีคำขอสร้างอยู่แล้ว กรุณาตรวจสถานะ',409);
  // If this fails, the durable slot stays occupied. Never create a second hostname blindly.
  const created=await provider.createPilot();
  if(created.hostname!==HOST||!created.id)fail('คำตอบ Cloudflare ไม่ตรง ต้องให้ผู้ดูแลตรวจสอบ',502);
  await env.DB.prepare('UPDATE mart_domain_pilot SET provider_id=? WHERE hostname=? AND domain_id=?').bind(created.id,HOST,domain.id).run();
  slot={provider_id:created.id};
 }
 if(!slot?.provider_id)fail(slot?'คำขอเดิมยังไม่ยืนยันผล ห้ามสร้างซ้ำ ให้ผู้ดูแลตรวจ Cloudflare':'ยังไม่ได้เริ่มเชื่อมต่อ กรุณากดเตรียมโดเมนทดสอบ',409);
 const remote=await provider.get(slot.provider_id);if(remote.hostname!==HOST)fail('Cloudflare hostname ไม่ตรง',409);
 const ready=remote.status==='active'&&remote.ssl?.status==='active';
 await env.DB.prepare('UPDATE mart_domain_pilot SET enabled=? WHERE hostname=? AND provider_id=?').bind(ready?1:0,HOST,slot.provider_id).run();
 const records=[];
 const proof=remote.ownership_verification;if(proof?.type==='txt'&&proof.name&&proof.value)records.push({type:'TXT',name:proof.name,value:proof.value});
 for(const r of remote.ssl?.validation_records||[])if(r.txt_name&&r.txt_value)records.push({type:'TXT',name:r.txt_name,value:r.txt_value});
 return {ready,hostname:HOST,records,message:ready?'Cloudflare hostname และ HTTPS พร้อมแล้ว เปิด https://'+HOST+' เพื่อตรวจหน้าร้านจริง':'สร้างรายการแล้ว · hostname: '+remote.status+' · HTTPS: '+remote.ssl?.status+' · ตั้ง CNAME ชื่อ thaimart ให้ชี้ shops.lynctomart.com แบบ DNS only แล้วกดตรวจสถานะอีกครั้ง'};
}
