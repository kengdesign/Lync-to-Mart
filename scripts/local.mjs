import http from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {randomBytes} from 'node:crypto';
import worker from '../src/worker.mjs';
import {database} from './adapter.mjs';
import {passwordHash} from '../src/security.mjs';
const root=resolve(new URL('..',import.meta.url).pathname),dir=resolve(root,'.local');await mkdir(dir,{recursive:true});
const DB=database(resolve(dir,'mart.sqlite'));
if(!await DB.prepare('SELECT id FROM users LIMIT 1').first()){
 const password=process.env.MART_LOCAL_PASSWORD||randomBytes(16).toString('base64url');
 await DB.prepare('INSERT INTO users(id,email,password) VALUES(?,?,?)').bind(crypto.randomUUID(),'owner@example.test',await passwordHash(password)).run();
 await writeFile(resolve(dir,'login.txt'),`Local test only\nEmail: owner@example.test\nPassword: ${password}\n`,{mode:0o600});
 console.log('Created local test account; credentials are in .local/login.txt');
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const env={DB,APP_ENV:'local',CHECKOUT_HOSTS:process.env.CHECKOUT_HOSTS||'marketplace.example.test',IMPORT_HOSTS:process.env.IMPORT_HOSTS||'',
 ASSETS:{async fetch(req){const p=new URL(req.url).pathname;if(!['/index.html','/app.js','/styles.css','/product-editor.js','/video.js','/storefront.js','/cover-position.js','/shop-share.js'].includes(p))return new Response('Not found',{status:404});return new Response(await readFile(resolve(root,'public',p.slice(1))),{headers:{'content-type':mime[extname(p)]}});}},
 MEDIA:{async put(key,bytes,options){const path=resolve(dir,'media',key);await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path,bytes);await writeFile(path+'.json',JSON.stringify(options));},async get(key,options){if(!/^[a-zA-Z0-9/-]+$/.test(key))return null;try{const bytes=await readFile(resolve(dir,'media',key));const r=options?.range;return {body:r?bytes.subarray(r.offset,r.offset+r.length):bytes,...(JSON.parse(await readFile(resolve(dir,'media',key+'.json'),'utf8')))};}catch{return null;}}}}
const server=http.createServer(async(req,res)=>{try{const request=new Request(`http://127.0.0.1:${server.address().port}${req.url}`,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})});const out=await worker.fetch(request,env,{waitUntil:p=>p.catch(console.error)});res.writeHead(out.status,Object.fromEntries(out.headers));res.end(Buffer.from(await out.arrayBuffer()));}catch{res.writeHead(500);res.end('Local server error');}});
server.listen(Number(process.env.PORT)||8787,'127.0.0.1',()=>console.log(`Local preview: http://127.0.0.1:${server.address().port}`));
