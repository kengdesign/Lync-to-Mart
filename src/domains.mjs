const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export const domainLimit=plan=>({starter:1,growth:2,brand:5}[plan]||0);
export function normalizeDomain(value){
 const host=String(value||'').trim().toLowerCase();
 if(host.length>253||!host.includes('.')||host.endsWith('.lyncto.link')||host==='lyncto.link'||host.endsWith('.workers.dev')||!host.split('.').every(s=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s))||!/[a-z]/.test(host.split('.').at(-1)))fail('กรอกเฉพาะชื่อโดเมน เช่น shop.example.com ไม่ต้องใส่ https:// หรือ /');
 return host;
}
export async function domainRequest(env,user,plan,role,method,data={},fetcher=fetch){
 if(user.team||user.impersonation)fail('เฉพาะเจ้าของบัญชีจัดการโดเมนได้',403);
 const limit=role==='owner'?100000:domainLimit(plan.id);
 const list=async()=>{
 const items=(await env.DB.prepare('SELECT * FROM shop_domains WHERE owner_id=? ORDER BY created_at DESC').bind(user.id).all()).results;
 if(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mart_domain_pilot'").first()){
  const slot=await env.DB.prepare('SELECT domain_id,provider_id,enabled FROM mart_domain_pilot').first();
  for(const item of items)if(item.id===slot?.domain_id){item.connection_reserved=true;item.provider_created=!!slot.provider_id;item.gateway_enabled=slot.enabled===1;}
 }
 return {limit:role==='owner'?null:limit,connection_enabled:false,provider_diagnostics:role==='owner'&&env.APP_ENV==='staging',items};
 };
 if(method==='GET')return list();
 if(method==='DELETE'){
 if(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mart_domain_pilot'").first()){if(await env.DB.prepare('SELECT hostname FROM mart_domain_pilot WHERE domain_id=?').bind(data.id||'').first())fail('ต้องถอดการเชื่อมต่อ Cloudflare ก่อนลบรายการที่เตรียมไว้',409);}
 await env.DB.prepare('DELETE FROM shop_domains WHERE id=? AND owner_id=?').bind(data.id||'',user.id).run();return list();}
 if(data.action==='check'){
  const row=await env.DB.prepare('SELECT * FROM shop_domains WHERE id=? AND owner_id=?').bind(data.id||'',user.id).first();if(!row)fail('ไม่พบโดเมน',404);
  const now=Math.floor(Date.now()/1000);
  const claim=await env.DB.prepare('UPDATE shop_domains SET checked_at=? WHERE id=? AND checked_at<=?').bind(now,row.id,now-60).run();if(!claim.meta.changes)fail('กรุณารอ 1 นาทีก่อนตรวจอีกครั้ง',429);
  const res=await fetcher('https://cloudflare-dns.com/dns-query?name='+encodeURIComponent('_lynctomart.'+row.hostname)+'&type=TXT',{headers:{Accept:'application/dns-json'},signal:AbortSignal.timeout(5000)});
  if(!res.ok)fail('ตรวจ DNS ไม่สำเร็จ ลองใหม่ภายหลัง',502);
  const dns=await res.json();if(dns.Status!==0&&dns.Status!==3)fail('ผู้ให้บริการ DNS ยังตอบกลับไม่ได้ ลองใหม่ภายหลัง',502);
  const verified=(dns.Answer||[]).some(a=>a.type===16&&a.data==='"'+row.verification_token+'"');
  await env.DB.prepare('UPDATE shop_domains SET status=? WHERE id=? AND owner_id=?').bind(verified?'verified':'pending_dns',row.id,user.id).run();return list();
 }
 if(!limit)fail('เชื่อมโดเมนสำหรับ Starter, Growth และ Brand',403);
 const shop=await env.DB.prepare('SELECT * FROM shops WHERE id=? AND owner_id=?').bind(data.shop_id||'',user.id).first();if(!shop)fail('ไม่พบร้าน',404);if(shop.moderation_status&&shop.moderation_status!=='active')fail('ร้านนี้ถูกจำกัดการใช้งาน',403);
 const host=normalizeDomain(data.hostname);
 try{const result=await env.DB.prepare('INSERT INTO shop_domains(id,owner_id,shop_id,hostname,verification_token,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT count(*) FROM shop_domains WHERE owner_id=?)<?').bind(crypto.randomUUID(),user.id,shop.id,host,'lynctomart='+crypto.randomUUID(),Math.floor(Date.now()/1000),user.id,limit).run();if(!result.meta.changes)fail('ครบโควตาโดเมนของแพ็กเกจแล้ว');}catch(err){if(err.status)throw err;fail('ร้านหรือโดเมนนี้มีรายการอยู่แล้ว กรุณาถอดรายการเดิมก่อน');}
 return list();
}
