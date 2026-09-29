// Separate Worker: never deployed with the storefront configuration.
// Source binding is read-only by convention; this module never writes/deletes it.
const STATE = '_backup/state.json';
const PREFIX = 'objects/';
export async function backupBatch(env) {
  if (env.BACKUP_ENABLED !== 'true') return {status:'disabled'};
  if (!env.SOURCE_MEDIA || !env.BACKUP_MEDIA) throw new Error('Backup bindings missing');
  const previous = await env.BACKUP_MEDIA.get(STATE);
  const state = previous ? await previous.json() : {};
  const started = new Date().toISOString();
  let copied = 0, skipped = 0, bytes = 0;
  try {
    const page = await env.SOURCE_MEDIA.list({limit:20, ...(state.cursor ? {cursor:state.cursor} : {})});
    for (const item of page.objects) {
      // Immutable version path keeps changed/deleted source objects recoverable.
      const key = `${PREFIX}${encodeURIComponent(item.key)}/${encodeURIComponent(item.etag)}`;
      if (await env.BACKUP_MEDIA.head(key)) { skipped++; continue; }
      const source = await env.SOURCE_MEDIA.get(item.key, {onlyIf:{etagMatches:item.etag}});
      if (!source || !source.body) throw new Error('Source changed during backup; retry batch');
      await env.BACKUP_MEDIA.put(key, source.body, {
        httpMetadata: source.httpMetadata,
        customMetadata: {...source.customMetadata, martSourceKey:item.key, martSourceEtag:item.etag, martBackedUpAt:started}
      });
      copied++; bytes += source.size;
    }
    const result = {status:page.truncated?'running':'complete',cursor:page.truncated?page.cursor:null,
      lastBatchAt:started,lastCompleteAt:page.truncated?(state.lastCompleteAt||null):new Date().toISOString(),
      copied,skipped,bytes,error:null};
    await env.BACKUP_MEDIA.put(STATE,JSON.stringify(result),{httpMetadata:{contentType:'application/json'}});
    return result;
  } catch (error) {
    await env.BACKUP_MEDIA.put(STATE,JSON.stringify({...state,status:'error',lastBatchAt:started,error:'Batch failed; cursor retained for retry'}));
    throw error;
  }
}
// Singleton Durable Object serializes batches without a lease expiring mid-copy.
export class BackupCoordinator {
  constructor(ctx,env){this.ctx=ctx;this.env=env;this.busy=false;}
  async fetch(req){
    if(req.method!=='POST')return new Response('Not found',{status:404});
    if(this.busy)return Response.json({status:'busy'});
    this.busy=true;
    try {
      const result=await backupBatch(this.env);
      if(result.status!=='disabled')await retentionBatch(this.env,this.ctx.storage);
      return Response.json(result);
    } catch {return Response.json({status:'error'},{status:500});}
    finally {this.busy=false;}
  }
}
// Retention starts when a version is first observed absent/replaced, NOT on upload.
// No writes or deletions are ever issued against SOURCE_MEDIA.
export async function retentionBatch(env,storage,now=Date.now()){
  const cursor=await storage.get('gcCursor');
  const page=await env.BACKUP_MEDIA.list({prefix:PREFIX,limit:20,...(cursor?{cursor}:{})});
  for(const item of page.objects){
    const parts=item.key.slice(PREFIX.length).split('/');
    if(parts.length!==2)continue;
    const sourceKey=decodeURIComponent(parts[0]),etag=decodeURIComponent(parts[1]);
    const marker='stale:'+item.key;
    const current=await env.SOURCE_MEDIA.head(sourceKey);
    if(current?.etag===etag){await storage.delete(marker);continue;}
    const since=await storage.get(marker);
    if(since===undefined){await storage.put(marker,now);continue;}
    if(now-since<30*86400000)continue;
    // A second read protects a version restored while GC was working.
    if((await env.SOURCE_MEDIA.head(sourceKey))?.etag===etag){await storage.delete(marker);continue;}
    if(env.BACKUP_GC_ENABLED==='true'){
      await env.BACKUP_MEDIA.delete(item.key);
      await storage.delete(marker);
    }
  }
  await storage.put('gcCursor',page.truncated?page.cursor:null);
}
export default {
  async scheduled(event,env,ctx) {
    if(env.BACKUP_ENABLED!=='true')return;
    const stub=env.BACKUP_COORDINATOR.get(env.BACKUP_COORDINATOR.idFromName('mart-media-backup'));
    ctx.waitUntil(stub.fetch('https://backup.internal/run',{method:'POST'}).then(r=>{if(!r.ok)throw Error('Backup batch failed');}));
  },
  async fetch() { return new Response('Not found',{status:404}); }
};
