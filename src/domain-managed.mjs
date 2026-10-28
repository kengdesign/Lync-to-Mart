import {canonicalDomain} from './domain-names.mjs';
import {domainProvider} from './domain-provider.mjs';
import {ensureRegistry,claimDomain,reserveCreation,withProviderLock,releaseConfirmed,packageDomainLimit} from './domain-registry.mjs';
import {effectivePlan} from './plans.mjs';
import {adminRole} from './admin.mjs';
const ZONE='f0b5797bfb2571e56c55b7dedd8fbcbc',DAY=86400;
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const nowSeconds=()=>Math.floor(Date.now()/1000);
export async function migratePilot(env,now){
 // Preserve the already verified pilot. Other preparation rows get fresh challenges on entry.
 if(env.APP_ENV!=='staging'||!await env.DB.prepare("SELECT name FROM sqlite_master WHERE name='mart_domain_pilot'").first())return;
 const p=await env.DB.prepare("SELECT p.*,d.owner_id,d.shop_id,d.verification_token,d.created_at AS reserved_at FROM mart_domain_pilot p JOIN shop_domains d ON d.id=p.domain_id WHERE p.provider_id IS NOT NULL").first();if(!p)return;
 await env.DB.batch([
  env.DB.prepare('INSERT OR IGNORE INTO domain_intents(id,owner_id,shop_id,hostname,token,created_at,expires_at) VALUES(?,?,?,?,?,?,?)').bind(p.domain_id,p.owner_id,p.shop_id,p.hostname,p.verification_token,p.reserved_at,now+DAY),
  env.DB.prepare('INSERT OR IGNORE INTO domain_registry(hostname,intent_id,owner_id,shop_id,state,provider_id,created_at,updated_at,verified_at,paused) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(p.hostname,p.domain_id,p.owner_id,p.shop_id,p.enabled?'active':'paused',p.provider_id,p.created_at,now,now,p.enabled?0:1)
 ]);
 // Transfer authority once only; do not leave a second writer for the same hostname.
 const transferred=await env.DB.prepare('SELECT provider_id FROM domain_registry WHERE hostname=? AND intent_id=?').bind(p.hostname,p.domain_id).first();
 if(transferred?.provider_id===p.provider_id)await env.DB.prepare('DELETE FROM mart_domain_pilot WHERE hostname=? AND provider_id=?').bind(p.hostname,p.provider_id).run();
}
export async function domainAllowance(env,user){
 const plan=await effectivePlan(env,user),role=await adminRole(env,user);
 return {limit:role==='owner'?100000:packageDomainLimit(plan.id),role,plan};
}
export async function domainEntitled(env,row){
 const user=await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(row.owner_id).first();if(!user)return false;
 const member=await env.DB.prepare("SELECT status FROM member_controls WHERE user_id=? AND status<>'active'").bind(user.id).first();if(member)return false;
 const shop=await env.DB.prepare("SELECT id FROM shops WHERE id=? AND owner_id=? AND moderation_status='active'").bind(row.shop_id,row.owner_id).first();if(!shop)return false;
 const {limit}=await domainAllowance(env,user);if(!limit)return false;
 const allowed=(await env.DB.prepare('SELECT hostname FROM domain_registry WHERE owner_id=? ORDER BY created_at,hostname LIMIT ?').bind(user.id,limit).all()).results;
 return allowed.some(d=>d.hostname===row.hostname);
}
async function ownershipProof(host,token,fetcher){
 const response=await fetcher('https://cloudflare-dns.com/dns-query?name='+encodeURIComponent('_lynctomart.'+host)+'&type=TXT',{headers:{Accept:'application/dns-json'},signal:AbortSignal.timeout(7000)});
 if(!response.ok)fail('ตรวจ DNS ไม่สำเร็จ ลองใหม่ภายหลัง',502);
 const dns=await response.json();return dns.Status===0&&dns.Answer?.some(a=>a.type===16&&a.data===JSON.stringify(token));
}
function validationRecords(remote){
 const records=[],p=remote.ownership_verification;
 if(p?.type==='txt'&&p.name&&p.value)records.push({type:'TXT',name:p.name,value:p.value});
 for(const r of remote.ssl?.validation_records||[])if(r.txt_name&&r.txt_value)records.push({type:'TXT',name:r.txt_name,value:r.txt_value});
 return records;
}
async function reconcile(env,provider,row,now){
 const remote=await provider.get(row.provider_id);if(remote.hostname!==row.hostname)fail('รหัสโดเมนปลายทางไม่ตรง กรุณาติดต่อผู้ดูแล',409);
 const ready=remote.status==='active'&&remote.ssl?.status==='active';
 const state=row.paused?'paused':ready?'active':'pending';
 await env.DB.prepare("UPDATE domain_registry SET state=CASE WHEN paused=1 THEN 'paused' ELSE ? END,records_json=?,updated_at=?,last_check=? WHERE hostname=? AND provider_id=? AND state NOT IN ('deleting','uncertain')").bind(state,JSON.stringify(validationRecords(remote)),now,now,row.hostname,row.provider_id).run();
 return {ready:ready&&!row.paused,message:row.paused?'ปิดชั่วคราวอยู่ · หากต้องการเปิด ให้กดเปิดการเชื่อมต่ออีกครั้ง':ready?'DNS และ HTTPS พร้อมแล้ว เปิดหน้าร้านในขั้นที่ 4 ได้เลย':'กำลังรอ DNS / ใบรับรอง HTTPS กรุณาตั้ง DNS ตามที่แสดง แล้วตรวจซ้ำภายหลัง'};
}
async function deleteRemote(env,provider,row,now){
 await env.DB.prepare("UPDATE domain_registry SET state='deleting',paused=1,updated_at=? WHERE hostname=?").bind(now,row.hostname).run();
 if(row.provider_id){
  let remote;
  try{remote=await provider.get(row.provider_id);}catch(error){if(error.status===404){await releaseConfirmed(env.DB,row);return true;}throw error;}
  if(remote.hostname!==row.hostname)fail('ไม่สามารถลบได้: รหัส hostname ไม่ตรง',409);
  await provider.remove({managed_by:'lync-to-mart',provider_zone_id:ZONE,provider_id:row.provider_id,hostname:row.hostname});
  try{await provider.get(row.provider_id);}catch(error){if(error.status===404){await releaseConfirmed(env.DB,row);return true;}throw error;}
  return false;
 }
 // A verified reservation has never made a create request. Uncertain/creating cannot be released blindly.
 if(!row.create_attempted){await releaseConfirmed(env.DB,row);return true;}
 return false;
}
async function list(env,user,allowance,now){
 const rows=(await env.DB.prepare(`SELECT i.*,r.state,r.provider_id,r.paused,r.invalid_since,r.records_json FROM domain_intents i LEFT JOIN domain_registry r ON r.intent_id=i.id WHERE i.owner_id=? ORDER BY i.created_at`).bind(user.id).all()).results;
 return {limit:allowance.role==='owner'?null:allowance.limit,connection_enabled:true,domain_admin:allowance.role==='owner',provider_diagnostics:allowance.role==='owner'&&env.APP_ENV==='staging',items:rows.map(r=>({...r,verification_token:r.token,status:r.state?'verified':'pending_dns',connection_reserved:!!r.state&&r.state!=='verified',provider_created:!!r.provider_id,gateway_enabled:r.state==='active'&&!r.paused,connection_state:r.state||'draft',expires_at:r.state?null:r.expires_at,records:JSON.parse(r.records_json||'[]')}))};
}
export async function managedDomainRequest(env,user,method,data={},fetcher=fetch,now=nowSeconds()){
 if(env.MART_DOMAINS_ENABLED!=='true'||user.team||user.impersonation)fail('ไม่เปิดให้จัดการโดเมนในบริบทนี้',403);
 const allowance=await domainAllowance(env,user);
 if(env.APP_ENV==='staging'&&allowance.role!=='owner')fail('ระหว่างทดสอบเปิดเฉพาะผู้ดูแลระบบ',403);
 await ensureRegistry(env.DB);await migratePilot(env,now);
 if(method==='GET')return list(env,user,allowance,now);
 if(!['POST','DELETE'].includes(method))fail('Method not allowed',405);
 const action=method==='DELETE'?'delete':data.action||'save';
 if(action==='save'){
  if(!allowance.limit)fail('ฟีเจอร์สำหรับ Starter, Growth และ Brand',403);
  const shop=await env.DB.prepare("SELECT id FROM shops WHERE id=? AND owner_id=? AND moderation_status='active'").bind(data.shop_id||'',user.id).first();if(!shop)fail('ไม่พบร้านที่จัดการได้',404);
  let hostname;try{hostname=canonicalDomain(data.hostname);}catch(err){fail(err.message);}
  if(await env.DB.prepare('SELECT hostname FROM domain_registry WHERE hostname=?').bind(hostname).first())fail('โดเมนนี้มีการเชื่อมต่ออยู่แล้ว ต้องถอดการเชื่อมต่อเดิมก่อน',409);
  // Multiple owners may obtain challenges; only the first fresh proof can claim the global name.
  try{const r=await env.DB.prepare('INSERT INTO domain_intents(id,owner_id,shop_id,hostname,token,created_at,expires_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT count(*) FROM domain_intents WHERE owner_id=?)<?').bind(crypto.randomUUID(),user.id,shop.id,hostname,'lynctomart='+crypto.randomUUID(),now,now+DAY,user.id,allowance.limit).run();if(!r.meta.changes)fail('ครบจำนวนโดเมนของแพ็กเกจแล้ว',409);}catch(err){if(err.status)throw err;fail('ร้านนี้มีโดเมนที่บันทึกไว้แล้ว กรุณาถอดรายการเดิมก่อน',409);}
  return {message:'บันทึกแล้ว ยืนยัน TXT ภายใน 24 ชั่วโมงเพื่อจองชื่อโดเมน'};
 }
 const intent=await env.DB.prepare('SELECT * FROM domain_intents WHERE id=? AND owner_id=?').bind(data.id||'',user.id).first();if(!intent)fail('ไม่พบโดเมน',404);
 let row=await env.DB.prepare('SELECT * FROM domain_registry WHERE intent_id=? AND owner_id=?').bind(intent.id,user.id).first();
 if(action==='delete'){
  if(row&&row.state!=='verified')fail('ต้องถอดการเชื่อมต่อ Cloudflare ให้สำเร็จก่อนลบ',409);
  if(row){await env.DB.prepare("UPDATE domain_registry SET state='deleting' WHERE hostname=? AND state='verified'").bind(row.hostname).run();await releaseConfirmed(env.DB,row);}
  else await env.DB.prepare('DELETE FROM domain_intents WHERE id=?').bind(intent.id).run();
  return {message:'ลบรายการและคืนชื่อโดเมนแล้ว'};
 }
 if(action==='check'){
  if(row)return {message:'ยืนยันเจ้าของแล้ว ให้ดำเนินการขั้นที่ 3'};
  if(intent.expires_at<=now)fail('รหัสยืนยันหมดอายุ กรุณาลบรายการแล้วบันทึกใหม่',409);
  if(!allowance.limit)fail('แพ็กเกจไม่มีสิทธิ์เชื่อมโดเมน',403);
  const rate=await env.DB.prepare('UPDATE domain_intents SET checked_at=? WHERE id=? AND checked_at<=?').bind(now,intent.id,now-60).run();if(!rate.meta.changes)fail('รอ 1 นาทีก่อนตรวจ TXT อีกครั้ง',429);
  if(!await ownershipProof(intent.hostname,intent.token,fetcher))return {message:'ยังไม่พบ TXT ที่ตรงกัน กรุณาตรวจชื่อและค่า DNS แล้วลองใหม่'};
  if(!await claimDomain(env.DB,intent,allowance.limit,now))fail('โดเมนถูกเชื่อมแล้ว หรือครบโควตาแพ็กเกจ กรุณาตรวจรายการ',409);
  return {message:'ยืนยันเจ้าของและจองชื่อแล้ว ไปขั้นที่ 3 เพื่อเชื่อมต่อภายใน 24 ชั่วโมง'};
 }
 if(!row)fail('ยืนยันเจ้าของโดเมนก่อน',409);
 if(action==='pause'){
  await env.DB.prepare("UPDATE domain_registry SET paused=1,state=CASE WHEN state='active' THEN 'paused' ELSE state END,updated_at=? WHERE hostname=?").bind(now,row.hostname).run();return {message:'ปิดหน้าร้านผ่านโดเมนแล้ว ยังนับโควตาจนกว่าจะถอดการเชื่อมต่อ'};
 }
 if(!['prepare','status','resume','disconnect'].includes(action))fail('คำสั่งไม่ถูกต้อง');
 const provider=domainProvider(env,fetcher);
 return withProviderLock(env.DB,now,async()=>{
  row=await env.DB.prepare('SELECT * FROM domain_registry WHERE intent_id=?').bind(intent.id).first();if(!row)fail('รายการถูกยกเลิกแล้ว',409);
  if(action==='disconnect'){
   const released=await deleteRemote(env,provider,row,now);
   return {message:released?'ถอดการเชื่อมต่อและคืนชื่อโดเมนแล้ว กรุณาลบ DNS ที่ชี้มาที่ Mart':'กำลังยืนยันการลบกับ Cloudflare ชื่อและโควตายังถูกเก็บไว้จนกว่าจะลบสำเร็จ'};
  }
  if(!await domainEntitled(env,row))fail('ร้านหรือแพ็กเกจไม่มีสิทธิ์เชื่อมโดเมนในขณะนี้',403);
  if(['creating','uncertain','deleting'].includes(row.state))fail('รายการอยู่ระหว่างตรวจสอบ ห้ามสร้างซ้ำ กรุณาติดต่อผู้ดูแล',409);
  if(action==='prepare'&&row.state==='verified'){
   if(!await ownershipProof(intent.hostname,intent.token,fetcher))fail('ไม่พบ TXT ยืนยันปัจจุบัน กรุณาคืนค่า TXT ก่อนเชื่อม',409);
   const health=await fetcher('https://shops.lynctomart.com/__mart_gateway_health',{redirect:'manual',signal:AbortSignal.timeout(10000)});
   if(!health.ok)fail('Gateway ยังไม่พร้อม',503);const h=await health.json();if(h.service!=='mart-domain-gateway'||h.environment!==env.APP_ENV)fail('Gateway ไม่ตรงกับระบบนี้',503);
   const f=await provider.fallback();if(f.status!=='active'||f.origin!=='fallback.lynctomart.com')fail('Fallback ยังไม่พร้อม',503);
   const q=await provider.quota(),cap=Number(env.MART_DOMAIN_MAX_HOSTNAMES||90);
   if(!Number.isInteger(cap)||cap<1||cap>100||!Number.isFinite(q.used)||!Number.isFinite(q.allocated)||q.used>=Math.min(cap,q.allocated)||q.exceeded)fail('ถึงเพดาน hostname หรือยืนยันโควตาไม่ได้',409);
   const existing=await provider.find(row.hostname);if(!Array.isArray(existing)||existing.some(x=>x.hostname===row.hostname))fail('มี hostname อยู่ที่ Cloudflare แล้ว ต้องตรวจสอบก่อนสร้าง',409);
   if(!await reserveCreation(env.DB,row.hostname,cap,now))fail('ถึงเพดานหรือมีคำขอสร้างอยู่แล้ว',409);
   try{
    const remote=await provider.create(row.hostname);if(remote.hostname!==row.hostname||!remote.id)throw Error('Unexpected create response');
    await env.DB.prepare("UPDATE domain_registry SET provider_id=?,state='pending',updated_at=?,verified_at=? WHERE hostname=? AND state='creating'").bind(remote.id,now,now,row.hostname).run();
    row={...row,provider_id:remote.id,state:'pending'};
   }catch(error){await env.DB.prepare("UPDATE domain_registry SET state='uncertain',updated_at=? WHERE hostname=? AND state='creating'").bind(now,row.hostname).run();fail('ผลสร้าง hostname ยังไม่ยืนยัน ระบบล็อกชื่อและโควตาไว้เพื่อป้องกันการสร้างซ้ำ ให้ผู้ดูแลตรวจสอบ',502);}
  }
  if(!row.provider_id)fail('ยังไม่ได้สร้างการเชื่อมต่อ',409);
  if(action==='resume'){await env.DB.prepare('UPDATE domain_registry SET paused=0 WHERE hostname=?').bind(row.hostname).run();row.paused=0;}
  if(action==='status'&&row.last_check>now-30)fail('รอ 30 วินาทีก่อนตรวจอีกครั้ง',429);
  return reconcile(env,provider,row,now);
 });
}
export async function cleanupDomains(env,fetcher=fetch,now=nowSeconds()){
 if(env.MART_DOMAINS_ENABLED!=='true')return;
 await ensureRegistry(env.DB);
 await env.DB.prepare('DELETE FROM domain_intents WHERE expires_at<=? AND NOT EXISTS(SELECT 1 FROM domain_registry r WHERE r.intent_id=domain_intents.id)').bind(now).run();
 const rows=(await env.DB.prepare('SELECT * FROM domain_registry ORDER BY last_check,created_at LIMIT 10').all()).results;
 for(const row of rows){
  try{
   await env.DB.prepare('UPDATE domain_registry SET last_check=? WHERE hostname=?').bind(now,row.hostname).run();
   const entitled=await domainEntitled(env,row);
   if(!entitled&&!row.invalid_since)await env.DB.prepare('UPDATE domain_registry SET invalid_since=? WHERE hostname=?').bind(now,row.hostname).run();
   if(entitled&&row.invalid_since)await env.DB.prepare('UPDATE domain_registry SET invalid_since=0 WHERE hostname=?').bind(row.hostname).run();
   const expiredClaim=row.state==='verified'&&row.verified_at+DAY<=now;
   const abandoned=row.state==='pending'&&row.verified_at+7*DAY<=now;
   const expiredPlan=!entitled&&row.invalid_since>0&&row.invalid_since+7*DAY<=now;
   if(row.state==='creating'&&row.lease_until<now){await env.DB.prepare("UPDATE domain_registry SET state='uncertain' WHERE hostname=? AND state='creating'").bind(row.hostname).run();continue;}
   if(row.state==='uncertain')continue; // Requires operator reconciliation; never silently frees billable capacity.
   if(row.state==='deleting'||expiredClaim||abandoned||expiredPlan){await withProviderLock(env.DB,now,()=>deleteRemote(env,domainProvider(env,fetcher),row,now));}
   else if(entitled&&row.provider_id&&['pending','active'].includes(row.state)){await withProviderLock(env.DB,now,()=>reconcile(env,domainProvider(env,fetcher),row,now));}
  }catch{console.warn('Domain lifecycle retry needed');}
 }
}
