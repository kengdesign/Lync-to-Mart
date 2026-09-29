export async function adminBackup(env,role){
 if(role!=='owner')throw Object.assign(new Error('เฉพาะแอดมินสูงสุดเท่านั้น'),{status:403});
 if(!env.BACKUP_MEDIA)return {role,view:'backup',status:'not_connected'};
 try{
  const object=await env.BACKUP_MEDIA.get('_backup/state.json');
  if(!object)return {role,view:'backup',status:'waiting'};
  const s=await object.json();
  return {role,view:'backup',status:['running','complete','error','disabled'].includes(s.status)?s.status:'unknown',
   lastBatchAt:s.lastBatchAt||null,lastCompleteAt:s.lastCompleteAt||null,
   copied:Number(s.copied)||0,skipped:Number(s.skipped)||0,bytes:Number(s.bytes)||0};
 }catch{return {role,view:'backup',status:'unavailable'};}
}
