import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {campaignVideo,campaignThumbnail,connectCampaignVideos} from '../public/campaign-video.js';
import {mountShowcaseEditor} from '../public/showcase-editor.js';
import {database} from '../scripts/adapter.mjs';
import {hash} from '../src/security.mjs';
import worker from '../src/worker.mjs';
import {serveDomain} from '../src/domain-gateway.mjs';

test('allowlisted providers normalize embeds and discard executable HTML',()=>{
 for(const [url,provider,embed] of [
  ['https://youtu.be/abcdefghijk','YouTube',true],['https://www.youtube.com/shorts/abcdefghijk','YouTube',true],
  ['https://vimeo.com/123456/abcdef1234','Vimeo',true],['https://www.tiktok.com/@seller/video/123456789','TikTok',true],
  ['https://www.facebook.com/seller/videos/123456/','Facebook',true],
  ['https://geo.dailymotion.com/player/x123.html?video=x456','Dailymotion',true],['https://dai.ly/x456','Dailymotion',false],
  ['https://www.instagram.com/reel/ABC_123/','Instagram',false],['https://x.com/seller/status/12345','X',false]
 ]){const p=campaignVideo(url);assert.equal(p?.provider,provider,url);assert.equal(!!p.embed,embed);}
 const p=campaignVideo('<iframe onload="evil()" srcdoc="evil" src="https://player.vimeo.com/video/123?h=abcdef1234&amp;autoplay=1"></iframe><script>evil()</script>');
 assert.equal(p.embed,'https://player.vimeo.com/video/123?autoplay=0&h=abcdef1234');
 for(const url of ['javascript:alert(1)','https://youtube.com.evil.test/embed/abcdefghijk','https://evil.test/','https://user@vimeo.com/123','https://vimeo.com:444/123','<script src="https://youtube.com"></script>','<iframe src="https://evil.test"></iframe>','https://geo.dailymotion.com/player.html?video=x123'])assert.equal(campaignVideo(url),null,url);
});

test('YouTube thumbnails use only validated IDs and failed images leave playable controls',()=>{
 assert.equal(campaignThumbnail('https://youtu.be/abcdefghijk'),'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg');
 assert.equal(campaignThumbnail('https://youtube.com.evil.test/watch?v=abcdefghijk'),'');
 assert.equal(campaignThumbnail('https://vimeo.com/123'),'');
 const dom=new JSDOM('<button class="campaign-play has-thumbnail" data-campaign-play="https://youtu.be/abcdefghijk"><img data-campaign-thumbnail src="https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg"><span>play</span></button>');
 const root=dom.window.document;connectCampaignVideos(root);
 root.querySelector('img').dispatchEvent(new dom.window.Event('error'));
 assert.equal(root.querySelector('img'),null);assert.equal(root.querySelector('button').classList.contains('has-thumbnail'),false);
 root.querySelector('button span').click();assert.ok(root.querySelector('iframe'));dom.window.close();
});

test('player is created only after click, once, with fallback link retained',()=>{
 const dom=new JSDOM('<div class="campaign-player"><button data-campaign-play="https://youtu.be/abcdefghijk">play</button></div><a href="https://youtu.be/abcdefghijk">ต้นทาง</a>');
 const old=globalThis.document;globalThis.document=dom.window.document;
 try{connectCampaignVideos(document);assert.equal(document.querySelector('iframe'),null);document.querySelector('button').click();assert.equal(document.querySelectorAll('iframe').length,1);assert.match(document.querySelector('iframe').src,/autoplay=0/);assert.equal(document.querySelector('iframe').referrerPolicy,'strict-origin-when-cross-origin');assert.ok(document.querySelector('a'));}finally{globalThis.document=old;dom.window.close();}
});

test('editor saves video changes, reorders and guards unsaved content',async()=>{
 const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main');let sent;
 const guard=mountShowcaseEditor({root,shop:{id:'s',showcase_json:'{}'},plan:{id:'growth',name:'Growth'},products:[],api:async(_,options)=>{sent=JSON.parse(options.body);},onSaved:async()=>{},notify:()=>{}});
 const input=(selector,value)=>{const el=root.querySelector(selector);el.value=value;el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));};
 root.querySelector('[data-add-video]').click();input('[data-video-field="url"]','https://youtu.be/abcdefghijk');input('[data-video-field="title"]','แนะนำร้าน');input('[data-video-field="align"]','left');
 root.querySelector('[data-add-video]').click();assert.equal(root.querySelector('[data-add-video]').disabled,true);
 input('[data-video-index="1"] [data-video-field="url"]','https://vimeo.com/123');input('[data-video-index="1"] [data-video-field="align"]','right');
 root.querySelector('[data-video-index="1"] [data-video-action="up"]').click();input('[data-video-position]','campaigns');
 assert.match(root.querySelector('input[name="showcase"]').value,/vimeo/);
 dom.window.confirm=()=>false;assert.equal(guard.canLeave(),false);
 await root.querySelector('form').onsubmit({preventDefault(){}});
 assert.equal(sent.videos.length,2);assert.equal(sent.videos[0].url,'https://vimeo.com/123');assert.equal(sent.video_position,'campaigns');assert.equal(guard.canLeave(),true);
 guard.cleanup();dom.window.close();
});

test('server enforces quotas, downgrade, escaping, placement, and old payload compatibility',async()=>{
 const DB=database(),env={DB,APP_ENV:'staging'},ctx={waitUntil(){}};
 const call=(path,method='GET',data,user='alice')=>worker.fetch(new Request('https://mart.test'+path,{method,headers:{Origin:'https://mart.test',Cookie:'mart_session='+user},...(data?{body:JSON.stringify(data)}:{})}),env,ctx);
 const video={url:'https://www.youtube.com/shorts/abcdefghijk',title:'<img onerror=evil()>',enabled:true,align:'full',ratio:'auto'};
 const payload=(n=1)=>({campaigns:[],featured:false,newest:false,order:['campaigns','featured','newest'],video_position:'campaigns',videos:Array.from({length:n},()=>({...video}))});
 try{
  for(const id of ['alice','bob']){await DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(id,id+'@test.example','unused','free').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(id),id,Math.floor(Date.now()/1000)+3600).run();await DB.prepare('INSERT INTO shops(id,owner_id,slug,name,published) VALUES(?,?,?,?,1)').bind(id,id,id+'-shop',id).run();}
  const save=data=>call('/api/shops/alice/showcase','PUT',data);
  assert.equal((await save(payload())).status,403);
  for(const [plan,max] of [['starter',1],['growth',2],['brand',2]]){
   await DB.prepare('UPDATE users SET plan_id=? WHERE id=?').bind(plan,'alice').run();assert.equal((await save(payload(max))).status,200);assert.equal((await save(payload(max+1))).status,403);
  }
  let p=payload(2);p.videos[0].align='left';p.videos[1].align='right';assert.equal((await save(p)).status,200);
  let res=await call('/shop/alice-shop'),html=await res.text();assert.equal((html.match(/data-campaign-play=/g)||[]).length,2);assert.doesNotMatch(html,/<iframe|<img onerror/);assert.match(html,/&lt;img onerror/);assert.match(html,/ratio-portrait/);assert.match(html,/data-campaign-thumbnail/);assert.match(html,/loading="lazy"/);assert.match(html,/https:\/\/i.ytimg.com\/vi\/abcdefghijk\/hqdefault.jpg/);assert.match(html,/align-left/);assert.match(res.headers.get('Content-Security-Policy'),/https:\/\/www.tiktok.com/);
  // Old cached editors must not silently erase videos.
  const old=payload();delete old.videos;delete old.video_position;assert.equal((await save(old)).status,200);assert.equal(JSON.parse((await DB.prepare("SELECT showcase_json FROM shops WHERE id='alice'").first()).showcase_json).videos.length,2);
  p=payload();p.videos[0].url='https://evil.test';assert.equal((await save(p)).status,400);
  assert.equal((await call('/api/shops/alice/showcase','PUT',payload(),'bob')).status,404);
  await DB.prepare("UPDATE users SET plan_id='starter' WHERE id='alice'").run();p=payload();p.videos[0].align='left';assert.equal((await save(p)).status,403);
  html=await(await call('/shop/alice-shop')).text();assert.equal((html.match(/data-campaign-play=/g)||[]).length,1);assert.match(html,/align-full/);
  await DB.prepare("UPDATE users SET plan_id='free' WHERE id='alice'").run();assert.doesNotMatch(await(await call('/shop/alice-shop')).text(),/data-campaign-play/);
 }finally{DB.close();}
});

test('custom domains allow only public video player dependencies',async()=>{
 const options={resolveDomain:async()=>({status:'active',entitled:true,shopPublished:true,slug:'s'}),authorizeResource:async()=>false,service:{fetch:async()=>new Response('ok')}};
 for(const path of ['/campaign-video.js?v=1','/video.js'])assert.equal((await serveDomain(new Request('https://shop.test'+path),options)).status,200);
 assert.equal((await serveDomain(new Request('https://shop.test/campaign-video-editor.js'),options)).status,404);
});
