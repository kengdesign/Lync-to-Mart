import {productIdentity} from './duplicates.mjs';
export async function issueImportReceipt(env,user,source){
 const id=crypto.randomUUID(),read_at=new Date().toISOString(),now=Math.floor(Date.now()/1000);
 await env.DB.batch([
  env.DB.prepare('DELETE FROM import_receipts WHERE owner_id=? AND expires_at<=?').bind(user.id,now),
  env.DB.prepare('INSERT INTO import_receipts(id,owner_id,source_url,read_at,expires_at) VALUES(?,?,?,?,?)').bind(id,user.id,source,read_at,now+7*86400)
 ]);
 return {import_receipt:id,imported_at:read_at};
}
export async function savedProvenance(env,user,body,source,existing={}){
 if(body.import_receipt!==undefined){
  const receipt=typeof body.import_receipt==='string'&&body.import_receipt.length<=100?await env.DB.prepare('SELECT source_url,read_at FROM import_receipts WHERE id=? AND owner_id=? AND expires_at>?').bind(body.import_receipt,user.id,Math.floor(Date.now()/1000)).first():null;
  if(!receipt||!productIdentity(source)||productIdentity(receipt.source_url)!==productIdentity(source))throw Object.assign(new Error('ข้อมูลการนำเข้าไม่ตรงกับลิงก์หรือหมดอายุ กรุณาอ่านลิงก์ใหม่แล้วตรวจทานอีกครั้ง'),{status:422});
  return JSON.stringify({source_url:receipt.source_url,read_at:receipt.read_at});
 }
 return source===existing.source_url||(productIdentity(source)&&productIdentity(source)===productIdentity(existing.source_url))?existing.import_provenance||'':'';
}
