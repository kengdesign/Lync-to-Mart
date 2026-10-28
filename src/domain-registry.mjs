// Durable registry. A hostname is claimed only after fresh DNS ownership proof.
// Deleting/uncertain rows retain both the name and capacity until remote absence is confirmed.
export const registrySchema=[
 `CREATE TABLE IF NOT EXISTS domain_intents(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,shop_id TEXT NOT NULL UNIQUE,hostname TEXT NOT NULL,token TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,checked_at INTEGER NOT NULL DEFAULT 0)`,
 `CREATE INDEX IF NOT EXISTS domain_intents_owner ON domain_intents(owner_id)`,
 `CREATE TABLE IF NOT EXISTS domain_registry(hostname TEXT PRIMARY KEY,intent_id TEXT NOT NULL UNIQUE,owner_id TEXT NOT NULL,shop_id TEXT NOT NULL UNIQUE,state TEXT NOT NULL CHECK(state IN ('verified','creating','pending','active','paused','deleting','uncertain')),provider_id TEXT UNIQUE,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,verified_at INTEGER NOT NULL,lease_until INTEGER NOT NULL DEFAULT 0,paused INTEGER NOT NULL DEFAULT 0,invalid_since INTEGER NOT NULL DEFAULT 0,last_check INTEGER NOT NULL DEFAULT 0,records_json TEXT NOT NULL DEFAULT '[]',create_attempted INTEGER NOT NULL DEFAULT 0,absent_since INTEGER NOT NULL DEFAULT 0)`,
 `CREATE TABLE IF NOT EXISTS domain_provider_lock(id INTEGER PRIMARY KEY CHECK(id=1),token TEXT NOT NULL DEFAULT '',expires_at INTEGER NOT NULL DEFAULT 0)`,
 `INSERT OR IGNORE INTO domain_provider_lock(id) VALUES(1)`
];
export const billableStates="('creating','pending','active','paused','deleting','uncertain')";
export async function ensureRegistry(DB){for(const sql of registrySchema)await DB.prepare(sql).run();}
export const packageDomainLimit=plan=>({starter:1,growth:2,brand:5}[plan]||0);
export async function claimDomain(DB,intent,limit,now){
 const result=await DB.prepare(`INSERT OR IGNORE INTO domain_registry(hostname,intent_id,owner_id,shop_id,state,created_at,updated_at,verified_at) SELECT ?,?,?,?,'verified',?,?,? WHERE (SELECT count(*) FROM domain_registry WHERE owner_id=?)<?`).bind(intent.hostname,intent.id,intent.owner_id,intent.shop_id,now,now,now,intent.owner_id,limit).run();
 if(result.meta.changes)return true;
 const existing=await DB.prepare('SELECT intent_id FROM domain_registry WHERE hostname=?').bind(intent.hostname).first();
 return existing?.intent_id===intent.id;
}
export async function withProviderLock(DB,now,fn){
 const token=crypto.randomUUID();
 const lock=await DB.prepare('UPDATE domain_provider_lock SET token=?,expires_at=? WHERE id=1 AND expires_at<=?').bind(token,now+120,now).run();
 if(!lock.meta.changes)throw Object.assign(new Error('ระบบกำลังจัดการโดเมนอีกคำขอ กรุณาลองใหม่สักครู่'),{status:409});
 try{return await fn();}finally{await DB.prepare("UPDATE domain_provider_lock SET token='',expires_at=0 WHERE id=1 AND token=?").bind(token).run();}
}
export async function reserveCreation(DB,hostname,cap,now){
 return (await DB.prepare(`UPDATE domain_registry SET state='creating',create_attempted=1,updated_at=?,lease_until=? WHERE hostname=? AND state='verified' AND provider_id IS NULL AND (SELECT count(*) FROM domain_registry WHERE state IN ${billableStates})<?`).bind(now,now+120,hostname,cap).run()).meta.changes===1;
}
export async function releaseConfirmed(DB,row){
 // Caller has confirmed the remote object is absent. Never release on network failure.
 await DB.batch([
  DB.prepare('DELETE FROM domain_registry WHERE hostname=? AND intent_id=? AND state=\'deleting\'').bind(row.hostname,row.intent_id),
  DB.prepare('DELETE FROM domain_intents WHERE id=? AND NOT EXISTS(SELECT 1 FROM domain_registry WHERE intent_id=?)').bind(row.intent_id,row.intent_id)
 ]);
}
