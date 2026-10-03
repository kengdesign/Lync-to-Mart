import {boundedHTML} from './import.mjs';
const fail=message=>{throw Object.assign(new Error(message),{status:422});};
export function importLink(raw){
 try{
  if(typeof raw!=='string'||raw.length>4096)return null;
  const u=new URL(raw.trim());if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
  const path=decodeURIComponent(u.pathname);
  if(u.hostname==='app.thaimart.com'&&/^\/p\/[A-Za-z0-9_-]{1,128}\/?$/.test(path))return u;
  if(u.hostname==='thaimart.com'&&/^\/products\/[^/\\\s?#\x00-\x1f]+\/?$/u.test(path))return u;
 }catch{}
 return null;
}
export async function readThaimartLink(raw,enabledHosts,fetcher=fetch){
 if(!enabledHosts.includes('thaimart.com'))fail('ยังไม่เปิดนำเข้าจาก Thaimart กรุณาติดต่อผู้ดูแล');
 let target=importLink(raw);if(!target)fail('กรุณาวางลิงก์สินค้าจาก thaimart.com/products/... หรือลิงก์แชร์ app.thaimart.com/p/...');
 const seen=new Set(),signal=AbortSignal.timeout(15000);
 for(let hop=0;hop<5;hop++){
  if(seen.has(target.href))fail('ลิงก์แชร์เปลี่ยนเส้นทางวนซ้ำ กรุณาคัดลอก URL จากหน้าสินค้าโดยตรง');seen.add(target.href);
  let response;try{response=await fetcher(target.href,{redirect:'manual',signal,headers:{Accept:'text/html'}});}catch{fail('เชื่อมต่อ Thaimart ไม่สำเร็จ กรุณาลองอีกครั้ง');}
  if([301,302,303,307,308].includes(response.status)){
   const location=response.headers.get('location');await response.body?.cancel();
   let next;try{next=location&&importLink(new URL(location,target).href);}catch{}
   if(!next)fail('ลิงก์แชร์ไม่ได้พาไปหน้าสินค้า กรุณาเปิดสินค้าใน Thaimart แล้วคัดลอก URL จากแถบที่อยู่');
   target=next;continue;
  }
  if(!response.ok){await response.body?.cancel();fail('Thaimart ไม่ส่งหน้าสินค้าที่อ่านได้ กรุณาตรวจว่าลิงก์ยังเปิดได้');}
  if(target.hostname!=='thaimart.com'||!response.headers.get('content-type')?.includes('text/html')){await response.body?.cancel();fail('ลิงก์แชร์นี้ยังไม่ส่งหน้าสินค้า กรุณาคัดลอก URL จากแถบที่อยู่ของหน้าสินค้า');}
  return {url:target.href,html:await boundedHTML(response)};
 }
 fail('ลิงก์แชร์เปลี่ยนเส้นทางหลายครั้งเกินไป กรุณาคัดลอก URL จากหน้าสินค้าโดยตรง');
}
