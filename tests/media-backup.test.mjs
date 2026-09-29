import test from 'node:test';
import assert from 'node:assert/strict';
import {backupBatch} from '../src/media-backup.mjs';
function fixture(){
 const saved=new Map(); let reads=0;
 const env={BACKUP_ENABLED:'true',SOURCE_MEDIA:{
  async list(){return {objects:[{key:'shop/image.jpg',etag:'v1'}],truncated:false};},
  async get(){reads++;return {body:'image',size:5,httpMetadata:{contentType:'image/jpeg'},customMetadata:{label:'original'}};}
 },BACKUP_MEDIA:{async get(k){return saved.has(k)?{json:async()=>JSON.parse(saved.get(k).body)}:null;},async head(k){return saved.has(k)?{}:null;},async put(k,body,options){saved.set(k,{body,options});}}};
 return {env,saved,reads:()=>reads};
}
test('copies bytes and metadata once; never removes retained versions',async()=>{
 const {env,saved,reads}=fixture();
 assert.equal((await backupBatch(env)).copied,1);
 assert.equal((await backupBatch(env)).skipped,1);assert.equal(reads(),1);
 const object=saved.get('objects/shop%2Fimage.jpg/v1');
 assert.equal(object.options.httpMetadata.contentType,'image/jpeg');
 assert.equal(object.options.customMetadata.martSourceKey,'shop/image.jpg');
});
test('disabled needs no bindings',async()=>assert.equal((await backupBatch({})).status,'disabled'));
test('failed batch keeps cursor and last successful completion',async()=>{
 const {env,saved}=fixture();
 saved.set('_backup/state.json',{body:JSON.stringify({cursor:'next',lastCompleteAt:'before'})});
 env.SOURCE_MEDIA.get=async()=>({});
 await assert.rejects(backupBatch(env));
 const state=JSON.parse(saved.get('_backup/state.json').body);
 assert.equal(state.cursor,'next');assert.equal(state.lastCompleteAt,'before');assert.equal(state.status,'error');
});

import {BackupCoordinator,retentionBatch} from '../src/media-backup.mjs';
import {adminBackup} from '../src/admin-backup.mjs';
const storage=()=>{const m=new Map();return {get:async k=>m.get(k),put:async(k,v)=>m.set(k,v),delete:async k=>m.delete(k)};};
test('singleton rejects overlapping work',async()=>{
 const {env}=fixture();let release;env.SOURCE_MEDIA.list=()=>new Promise(r=>release=r);
 const coordinator=new BackupCoordinator({storage:storage()},env);
 const first=coordinator.fetch(new Request('https://internal',{method:'POST'}));
 await new Promise(r=>setTimeout(r,0));
 assert.equal((await (await coordinator.fetch(new Request('https://internal',{method:'POST'}))).json()).status,'busy');
 env.BACKUP_MEDIA.list=async()=>({objects:[],truncated:false});release({objects:[],truncated:false});
 assert.equal((await first).status,200);
});
test('retention preserves live files, waits 30 days from absence, GC disabled by default',async()=>{
 const {env,saved}=fixture();await backupBatch(env);
 const key='objects/shop%2Fimage.jpg/v1',st=storage();
 env.BACKUP_MEDIA.list=async()=>({objects:[{key}],truncated:false});
 env.BACKUP_MEDIA.delete=async k=>saved.delete(k);
 env.SOURCE_MEDIA.head=async()=>({etag:'v1'});
 await retentionBatch(env,st,0);await retentionBatch(env,st,60*86400000);assert.ok(saved.has(key));
 env.SOURCE_MEDIA.head=async()=>null;
 await retentionBatch(env,st,60*86400000);
 await retentionBatch(env,st,89*86400000);assert.ok(saved.has(key));
 await retentionBatch(env,st,91*86400000);assert.ok(saved.has(key));
 env.BACKUP_GC_ENABLED='true';await retentionBatch(env,st,91*86400000);assert.ok(!saved.has(key));
});
test('Owner status denies other roles and does not expose object keys',async()=>{
 await assert.rejects(adminBackup({},'admin'),e=>e.status===403);
 assert.equal((await adminBackup({},'owner')).status,'not_connected');
 const {env}=fixture();await backupBatch(env);const result=await adminBackup(env,'owner');
 assert.equal(result.status,'complete');assert.equal(result.cursor,undefined);
});
import {restoreMediaVersion} from '../src/media-restore.mjs';
test('restore copies bytes and metadata into empty destination, refusing overwrite',async()=>{
 const backup={get:async()=>({body:'image',size:5,httpMetadata:{contentType:'image/jpeg'}})};
 const restored=new Map();const target={put:async(k,bytes,options)=>{
  assert.deepEqual(options.onlyIf,{etagDoesNotMatch:'*'});
  if(restored.has(k))return null;restored.set(k,{bytes,mime:options.httpMetadata.contentType});return {};
 }};
 await restoreMediaVersion(backup,target,'objects/shop%2Fimage.jpg/v1');
 assert.deepEqual(restored.get('shop/image.jpg'),{bytes:'image',mime:'image/jpeg'});
 await assert.rejects(restoreMediaVersion(backup,target,'objects/shop%2Fimage.jpg/v1'),/already contains/);
 await assert.rejects(restoreMediaVersion(backup,backup,'objects/shop/v1'),/Separate/);
});
import {JSDOM} from 'jsdom';
import {renderAdminBackup} from '../public/admin-backup.js';
test('Owner panel handles missing state and escapes injected text',()=>{
 const dom=new JSDOM('<main></main>');globalThis.document=dom.window.document;
 const root=document.querySelector('main');
 renderAdminBackup(root,{status:'not_connected'});assert.match(root.textContent,/ยังไม่เชื่อม/);
 renderAdminBackup(root,{status:'complete',copied:'<img src=x>',lastBatchAt:'invalid'});
 assert.equal(root.querySelector('img'),null);assert.match(root.textContent,/ยังไม่มี/);
 delete globalThis.document;dom.window.close();
});
