import {canonicalDomain} from './domain-names.mjs';
// Intentionally not wired to public routes until durable capacity/lifecycle gates exist.
const ZONE='f0b5797bfb2571e56c55b7dedd8fbcbc';
export function domainProvider(env,fetcher=fetch){
 if(env.MART_DOMAIN_ZONE_ID!==ZONE || !env.MART_DOMAIN_API_TOKEN)throw new Error('Domain provider configuration unavailable');
 const base='https://api.cloudflare.com/client/v4/zones/'+ZONE+'/custom_hostnames';
 async function call(path='',method='GET',body){
  let res;try{res=await fetcher(base+path,{method,redirect:'manual',headers:{Authorization:'Bearer '+env.MART_DOMAIN_API_TOKEN,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});}catch{throw Object.assign(new Error('Domain provider request incomplete; reconcile before retrying'),{kind:'network'});}
  if(res.status>=300&&res.status<400)throw Object.assign(new Error('Unexpected provider redirect'),{kind:'api',status:res.status,codes:[]});
  let data;try{data=await res.json();}catch{throw Object.assign(new Error('Invalid domain provider response'),{kind:'invalid_response',status:res.status});}
  if(!res.ok || data.success!==true)throw Object.assign(new Error('Domain provider rejected request'),{kind:'api',status:res.status,codes:Array.isArray(data.errors)?data.errors.map(e=>e.code).filter(Number.isSafeInteger).slice(0,5):[]});
  return data.result;
 }
 const idPath=id=>{if(!/^[a-f0-9-]{32,36}$/.test(id||''))throw new Error('Invalid provider resource ID');return '/'+id;};
 return {
  create:hostname=>call('', 'POST', {hostname:canonicalDomain(hostname),ssl:{method:'http',type:'dv',settings:{min_tls_version:'1.2'}}}),
  find:hostname=>call('?hostname='+encodeURIComponent(canonicalDomain(hostname))+'&per_page=50'),
  createPilot:()=>call('', 'POST', {hostname:'thaimart.logintimate.com',ssl:{method:'http',type:'dv',settings:{min_tls_version:'1.2'}}}),
  fallback:()=>call('/fallback_origin'),
  quota:()=>call('/quota'),
  get:id=>call(idPath(id)),
  // ownerRecord is a persisted local lifecycle record, never browser-provided input.
  async remove(ownerRecord){
   if(ownerRecord?.provider_zone_id!==ZONE || ownerRecord?.managed_by!=='lync-to-mart')throw new Error('Refusing unmanaged domain deletion');
   const path=idPath(ownerRecord.provider_id),remote=await call(path);
   if(remote.hostname!==ownerRecord.hostname)throw new Error('Provider hostname mismatch');
   return call(path,'DELETE');
  }
 };
}
