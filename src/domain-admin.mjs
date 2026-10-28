import {domainProvider} from './domain-provider.mjs';
import {ensureRegistry,withProviderLock,releaseConfirmed,billableStates} from './domain-registry.mjs';
export async function domainAdminRequest(env,user,role,method,data={},fetcher=fetch,now=Math.floor(Date.now()/1000)){
 const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
 if(env.MART_DOMAINS_ENABLED!=='true'||role!=='owner'||user.team||user.impersonation)fail('เฉพาะผู้ดูแลสูงสุด',403);
 await ensureRegistry(env.DB);
 if(method==='GET')return {cap:Number(env.MART_DOMAIN_MAX_HOSTNAMES||90),used:(await env.DB.prepare(`SELECT count(*) AS n FROM domain_registry WHERE state IN ${billableStates}`).first()).n,items:(await env.DB.prepare('SELECT hostname,owner_id,shop_id,state,provider_id,created_at,updated_at,invalid_since FROM domain_registry ORDER BY updated_at LIMIT 100').all()).results};
 if(method!=='POST'||!['adopt','confirm_absent'].includes(data.action))fail('คำสั่งไม่ถูกต้อง');
 return withProviderLock(env.DB,now,async()=>{
 const row=await env.DB.prepare('SELECT * FROM domain_registry WHERE hostname=?').bind(String(data.hostname||'')).first();
 if(!row||!['uncertain','deleting'].includes(row.state))fail('รายการนี้ไม่ใช่คำขอที่รอตรวจสอบ',409);
 const provider=domainProvider(env,fetcher);
 const audit=action=>env.DB.prepare('INSERT INTO admin_audit(id,actor_id,target_id,shop_id,action,reason) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),user.id,row.owner_id,row.shop_id,action,row.hostname);
 if(data.action==='adopt'){
  if(row.provider_id)fail('มีรหัส hostname อยู่แล้ว ให้ระบบลองลบซ้ำตามรอบ',409);
  const remote=await provider.get(String(data.provider_id||'')),created=Date.parse(remote.created_at)/1000;
  if(remote.hostname!==row.hostname||!Number.isFinite(created)||created<row.verified_at-60||created>now+60)fail('ชื่อหรือเวลาสร้างไม่ตรงกับคำขอเดิม ต้องตรวจสอบเพิ่มเติม',409);
  await env.DB.batch([env.DB.prepare("UPDATE domain_registry SET provider_id=?,state='pending',paused=1,updated_at=? WHERE hostname=? AND provider_id IS NULL").bind(remote.id,now,row.hostname),audit('domain_reconcile_adopt')]);
  return {message:'ผูกรหัส hostname เดิมแล้ว โดยยังปิดหน้าร้านไว้ ให้เจ้าของตรวจและเปิดใหม่ หรือถอดการเชื่อมต่อ'};
 }
 if(row.provider_id)fail('มีรหัส hostname อยู่แล้ว ต้องตรวจลบจากรหัสเดิม',409);
 if(now<row.updated_at+900)fail('รออย่างน้อย 15 นาทีหลังคำขอเดิม เพื่อยืนยันว่าไม่ได้สร้างล่าช้า',409);
 const matches=await provider.find(row.hostname);if(!Array.isArray(matches)||matches.some(r=>r.hostname===row.hostname))fail('ยังพบ hostname ที่ Cloudflare ต้องผูกรหัสเดิมก่อน ห้ามคืนชื่อ',409);
 if(!row.absent_since){await env.DB.prepare('UPDATE domain_registry SET absent_since=? WHERE hostname=?').bind(now,row.hostname).run();return {message:'ไม่พบ hostname ครั้งแรก กรุณายืนยันซ้ำหลัง 60 วินาที'};}
 if(now<row.absent_since+60)fail('รอ 60 วินาทีก่อนตรวจยืนยันครั้งที่สอง',409);
 await env.DB.batch([env.DB.prepare("UPDATE domain_registry SET state='deleting' WHERE hostname=?").bind(row.hostname),audit('domain_reconcile_absent')]);
 await releaseConfirmed(env.DB,row);return {message:'ยืนยันไม่พบ hostname สองครั้งแล้ว คืนชื่อและโควตาเรียบร้อย'};
 });
}
