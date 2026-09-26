import {test} from 'node:test';
import assert from 'node:assert/strict';
import {youtubeID} from '../public/video.js';
import {sanitizeContent} from '../src/content.mjs';
import {database} from '../scripts/adapter.mjs';
import {hash} from '../src/security.mjs';
import worker from '../src/worker.mjs';
test('YouTube URLs are normalized and unsafe embeds are removed',()=>{
 for(const u of ['https://youtu.be/abcdefghijk?si=share','https://www.youtube.com/watch?v=abcdefghijk','https://youtube.com/shorts/abcdefghijk','https://www.youtube-nocookie.com/embed/abcdefghijk'])assert.equal(youtubeID(u),'abcdefghijk');
 for(const u of ['https://youtube.com.evil.test/watch?v=abcdefghijk','javascript:alert(1)','https://user@youtube.com/watch?v=abcdefghijk','https://youtu.be/invalid'])assert.equal(youtubeID(u),null);
 const s=sanitizeContent('<p>ก่อน 😀</p><iframe src="https://youtube.com/embed/abcdefghijk" srcdoc="evil" onload="bad()"></iframe><iframe src="https://evil.test"></iframe><video autoplay onplay="bad()" src="/media/alice%2Fclip"></video><button>ลบวิดีโอ</button><p>หลัง</p>');
 assert.match(s.html,/youtube-nocookie.com\/embed\/abcdefghijk/);assert.match(s.html,/<video[^>]+controls playsinline/);assert.doesNotMatch(s.html,/srcdoc|onload|onplay|autoplay|evil|ลบวิดีโอ/);assert.deepEqual(s.keys,['alice/clip']);assert.match(s.text,/ก่อน 😀\nหลัง/);
 assert.doesNotMatch(sanitizeContent(s.html,{remote:true}).html,/iframe|video/);
});
test('video upload, tenant ownership, byte ranges, publication and quota',async()=>{
 const DB=database(),objects=new Map();const env={DB,APP_ENV:'staging',CHECKOUT_HOSTS:'thaimart.com',MEDIA:{async put(k,b,o){objects.set(k,{bytes:b,...o});},async get(k,o){const v=objects.get(k);if(!v)return null;const r=o?.range;return {body:r?v.bytes.slice(r.offset,r.offset+r.length):v.bytes,httpMetadata:v.httpMetadata};}},ASSETS:{fetch:async()=>new Response('asset')}};
 const call=(path,{method='GET',data,bytes,auth=true,headers={}}={})=>worker.fetch(new Request('https://mart.test'+path,{method,headers:{Origin:'https://mart.test',...(auth?{Cookie:'mart_session=video-session'}:{}),...headers},...((data||bytes)?{body:bytes||JSON.stringify(data)}:{})}),env,{waitUntil:p=>p.catch(()=>{})});
 try{
 await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind('alice','alice@example.test','unused','free').run();await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind('bob','bob@example.test','unused','free').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash('video-session'),'alice',Math.floor(Date.now()/1000)+3600).run();
 const bytes=new Uint8Array(64);bytes.set([0,0,0,24]);bytes.set(new TextEncoder().encode('ftypisom'),4);
 assert.equal((await call('/api/media/video',{method:'POST',bytes,auth:false})).status,401);
 assert.equal((await call('/api/media/video',{method:'POST',bytes:new TextEncoder().encode('<script>bad</script>')})).status,400);
 assert.equal((await call('/api/media/video',{method:'POST',bytes,headers:{'Content-Length':'20000001'}})).status,413);
 let r=await call('/api/media/video',{method:'POST',bytes});assert.equal(r.status,201);const {key}=await r.json(),url='/media/'+encodeURIComponent(key);
 assert.equal((await call(url,{auth:false})).status,401);
 r=await call(url,{headers:{Range:'bytes=4-11'}});assert.equal(r.status,206);assert.equal(r.headers.get('Content-Range'),'bytes 4-11/64');assert.equal(await r.text(),'ftypisom');
 r=await call(url,{headers:{Range:'bytes=-4'}});assert.equal(r.status,206);assert.equal((await r.arrayBuffer()).byteLength,4);
 assert.equal((await call(url,{headers:{Range:'bytes=99-100'}})).status,416);
 r=await call(url,{method:'HEAD'});assert.equal(r.status,200);assert.equal(r.headers.get('Content-Length'),'64');assert.equal(await r.text(),'');
 const {id:shop}=await (await call('/api/shops',{method:'POST',data:{name:'ร้านวิดีโอ',slug:'video-test'}})).json();
 const data={name:'สินค้า',source_url:'https://thaimart.com/products/6a8489fba9ceed89ab290994',status:'published',description_html:`<p>ก่อน</p><video src="${url}"></video><iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe><p>หลัง</p>`};
 r=await call(`/api/shops/${shop}/products`,{method:'POST',data});assert.equal(r.status,201);const {id}=await r.json();
 await DB.prepare('INSERT INTO media VALUES(?,?,?,?)').bind('bob/video','bob','video/mp4',64).run();assert.equal((await call(`/api/products/${id}`,{method:'PUT',data:{...data,description_html:'<video src="/media/bob%2Fvideo"></video>'}})).status,403);
 await call(`/api/shops/${shop}`,{method:'PUT',data:{name:'ร้านวิดีโอ',published:true}});
 r=await call('/shop/video-test',{auth:false});const html=await r.text();assert.match(html,/<video/);assert.match(html,/youtube-nocookie/);assert.match(r.headers.get('Content-Security-Policy'),/media-src 'self'; frame-src https:\/\/www.youtube-nocookie.com/);
 assert.equal((await call(url,{auth:false,headers:{Range:'bytes=0-10'}})).status,206);
 await call(`/api/products/${id}`,{method:'PUT',data:{...data,description_html:'<p>/media/bob%2Fvideo</p>'}});assert.equal((await call('/media/bob%2Fvideo',{auth:false})).status,401);
 await call(`/api/products/${id}`,{method:'PUT',data:{...data,status:'draft'}});assert.equal((await call(url,{auth:false})).status,401);
 await DB.prepare('INSERT INTO media VALUES(?,?,?,?)').bind('alice/quota','alice','video/mp4',499999936).run();assert.equal((await call('/api/media/video',{method:'POST',bytes})).status,409);
 }finally{DB.close();}
});
