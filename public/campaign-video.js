// Shared allowlist: never execute pasted embed HTML or fetch seller-supplied URLs.
import {youtubeID} from './video.js';
export const videoPositions=['campaigns','featured','newest','after'];
export function campaignVideo(input){
 if(typeof input!=='string'||input.length>8000)return null;
 let raw=input.trim();
 if(raw.startsWith('<')){
  // Only extract a quoted iframe source; every other attribute/element is discarded.
  const matches=[...raw.matchAll(/<iframe\b[^>]*?\s+src\s*=\s*(["'])(.*?)\1/gi)];
  if(matches.length!==1)return null;
  raw=matches[0][2].replace(/&amp;/gi,'&').replace(/&#38;/g,'&');
 }
 try{
  const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
  const host=u.hostname,path=u.pathname;
  const result=(provider,url,embed='',portrait=false)=>({provider,url,embed,portrait});
  const yt=youtubeID(raw);if(yt)return result('YouTube',`https://www.youtube.com/watch?v=${yt}`,`https://www.youtube-nocookie.com/embed/${yt}?autoplay=0`,path.startsWith('/shorts/'));
  if(['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(host)){
   const m=path.match(/^\/(?:video\/)?(\d+)(?:\/([a-f0-9]+))?\/?$/);if(!m)return null;
   const h=u.searchParams.get('h')||m[2]||'';if(h&&!/^[a-f0-9]{6,64}$/i.test(h))return null;
   return result('Vimeo',`https://vimeo.com/${m[1]}${h?'/'+h:''}`,`https://player.vimeo.com/video/${m[1]}?autoplay=0${h?'&h='+h:''}`);
  }
  if(['www.tiktok.com','tiktok.com'].includes(host)){
   const m=path.match(/^\/@[\w.-]+\/video\/(\d+)\/?$/)||path.match(/^\/player\/v1\/(\d+)\/?$/);
   if(m)return result('TikTok',`https://www.tiktok.com/@_/video/${m[1]}`,`https://www.tiktok.com/player/v1/${m[1]}?autoplay=0`,true);
  }
  if(host==='geo.dailymotion.com'){
   const m=path.match(/^\/player\/([a-zA-Z0-9]+)\.html$/),id=u.searchParams.get('video');
   if(m&&/^[a-zA-Z0-9]+$/.test(id||''))return result('Dailymotion',`https://www.dailymotion.com/video/${id}`,`https://geo.dailymotion.com/player/${m[1]}.html?video=${id}`);
  }
  if(['www.dailymotion.com','dailymotion.com','dai.ly'].includes(host)){
   const m=path.match(host==='dai.ly'?/^\/([a-zA-Z0-9]+)\/?$/:/^\/video\/([a-zA-Z0-9]+)\/?$/);
   if(m)return result('Dailymotion',`https://www.dailymotion.com/video/${m[1]}`);
  }
  if(['www.facebook.com','facebook.com','m.facebook.com'].includes(host)){
   if(path==='/plugins/video.php')return campaignVideo(u.searchParams.get('href')||'');
   const m=path.match(/^\/(?:[^/]+\/videos|reel)\/(\d+)\/?$/);
   const id=m?.[1]||((path==='/watch/'||path==='/watch'||path==='/video.php')?u.searchParams.get('v'):null);
   if(/^\d+$/.test(id||'')){
    const url=`https://www.facebook.com/watch/?v=${id}`;
    return result('Facebook',url,`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=false`,path.startsWith('/reel/'));
   }
  }
  if(['instagram.com','www.instagram.com'].includes(host)&&/^\/(?:p|reel)\/[\w-]+\/?$/.test(path))return result('Instagram',`https://www.instagram.com${path}`,'',true);
  if(['x.com','www.x.com','twitter.com','www.twitter.com'].includes(host)&&/^\/[\w]+\/status\/\d+\/?$/.test(path))return result('X',`https://x.com${path}`);
  return null;
 }catch{return null;}
}
export function campaignThumbnail(url){
 const id=youtubeID(url);
 return id?`https://i.ytimg.com/vi/${id}/hqdefault.jpg`:'';
}
export function connectCampaignVideos(root=document){
 // Image failures must leave the play control usable, including after catalog navigation.
 const discardThumbnail=image=>{image.closest('.campaign-play')?.classList.remove('has-thumbnail');image.remove();};
 root.addEventListener('error',event=>{if(event.target.matches?.('img[data-campaign-thumbnail]'))discardThumbnail(event.target);},true);
 root.querySelectorAll('img[data-campaign-thumbnail]').forEach(image=>{if(image.complete&&!image.naturalWidth)discardThumbnail(image);});
 root.addEventListener('click',event=>{
  const button=event.target.closest('[data-campaign-play]');if(!button)return;
  const video=campaignVideo(button.dataset.campaignPlay);if(!video?.embed)return;
  const frame=(root.ownerDocument||root).createElement('iframe');frame.src=video.embed;
  frame.title=button.dataset.title||`วิดีโอ ${video.provider}`;
  frame.allow='fullscreen; encrypted-media; picture-in-picture';frame.allowFullscreen=true;
  frame.referrerPolicy='strict-origin-when-cross-origin';frame.loading='lazy';
  button.replaceWith(frame);
 });
}
