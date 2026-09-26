import {youtubeID,youtubeHTML} from '../public/video.js';
import {parseFragment} from 'parse5';
import {escape as e,safeURL} from './security.mjs';
export const imageURL=key=>'/media/'+encodeURIComponent(key);
export const remoteImage=raw=>safeURL(raw,['img-cdn.thaimart.com','cf.shopee.co.th']);
export function localImageKey(raw){try{if(!raw.startsWith('/media/'))return null;const key=decodeURIComponent(raw.slice(7));return /^[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+$/.test(key)?key:null;}catch{return null;}}
export function plainHTML(text){return '<p>'+e(text||'').replace(/\r\n?/g,'\n').replace(/\n/g,'<br>')+'</p>';}
export function sanitizeContent(input,{remote=false}={}){
 const keys=new Set(),urls=new Set();let plain=[];
 const allowed=new Set(['p','div','br','h2','h3','h4','ul','ol','li','strong','b','em','i','u','s','blockquote','hr']);
 const blocked=new Set(['script','button','style','object','embed','svg','math','template','noscript','audio','form']);
 function walk(n,depth=0){if(depth>80)return '';if(n.nodeName==='#text'){plain.push(n.value);return e(n.value);}const tag=n.tagName;if(blocked.has(tag))return '';const a=Object.fromEntries((n.attrs||[]).map(x=>[x.name,x.value]));
  if(tag==='iframe'){const id=youtubeID(a.src);return !remote&&id?youtubeHTML(id):'';}
  if(tag==='video'){const key=localImageKey(a.src||'');if(remote||!key)return '';keys.add(key);return `<video src="${e(imageURL(key))}" controls playsinline preload="metadata">เบราว์เซอร์นี้ไม่รองรับวิดีโอ</video>`;}
  if(tag==='img'){const key=localImageKey(a.src||''),url=remote&&remoteImage(a.src||'');if(!key&&!url)return '';if(key)keys.add(key);if(url)urls.add(url);return `<img src="${e(key?imageURL(key):url)}" alt="${e((a.alt||'').slice(0,180))}" loading="lazy">`;}
  const children=(n.childNodes||[]).map(x=>walk(x,depth+1)).join('');
  if(tag==='a'){let url;try{const u=new URL(a.href);if(u.protocol==='https:'&&!u.username&&!u.password)url=u.href;}catch{}return url?`<a href="${e(url)}" rel="nofollow noopener noreferrer">${children}</a>`:children;}
  if(!allowed.has(tag))return children;
  if(['p','div','br','li','h2','h3','h4'].includes(tag))plain.push('\n');
  return ['br','hr'].includes(tag)?`<${tag}>`:`<${tag}>${children}</${tag}>`;
 }
 const html=walk(parseFragment(String(input||'')));return {html,text:plain.join('').trim(),keys:[...keys],urls:[...urls]};
}
export function productRecord(p){return {...p,gallery:JSON.parse(p.gallery_json||'[]'),variants:JSON.parse(p.variants_json||'[]')};}
export function priceRange(p){const values=p.variants?.length?p.variants.map(v=>v.price).filter(v=>Number.isSafeInteger(v)&&v>=0):[p.price].filter(v=>Number.isSafeInteger(v)&&v>=0);return values.length?[Math.min(...values),Math.max(...values)]:null;}
export function priceLabel(p){const r=priceRange(p),f=v=>'฿'+(v/100).toLocaleString('th-TH',{maximumFractionDigits:2});return !r?'ดูราคาที่ Thaimart':r[0]===r[1]?f(r[0]):`${f(r[0])} – ${f(r[1])}`;}
