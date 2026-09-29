// Deliberately not exposed through any HTTP route or scheduled handler.
// Caller supplies only a dedicated empty restore-drill destination binding.
export async function restoreMediaVersion(backup,destination,versionKey){
 if(!backup||!destination||backup===destination)throw Error('Separate restore destination required');
 if(!versionKey.startsWith('objects/'))throw Error('Invalid backup version');
 const parts=versionKey.slice(8).split('/');if(parts.length!==2)throw Error('Invalid backup version');
 const key=decodeURIComponent(parts[0]);
 if(!key||key.startsWith('/')||key.split('/').includes('..'))throw Error('Invalid source key');
 const source=await backup.get(versionKey);if(!source?.body)throw Error('Backup version missing');
 const result=await destination.put(key,source.body,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:source.httpMetadata,customMetadata:source.customMetadata});
 if(!result)throw Error('Restore destination already contains this key');
 return {key,size:source.size};
}
