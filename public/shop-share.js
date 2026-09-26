export function mountShopShare({root,shop,api,toast}){
 const status=root.querySelector('[data-share-status]'),qr=root.querySelector('[data-qr-preview]');
 const png=root.querySelector('[data-qr-png]'),svg=root.querySelector('[data-qr-svg]'),share=root.querySelector('[data-native-share]');
 const link=root.querySelector('[data-share-link]');let data;
 function download(blob,extension){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`lync-to-mart-${shop.slug}.${extension}`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 async function copy(){try{await navigator.clipboard.writeText(link.value);toast('คัดลอกลิงก์หน้าร้านแล้ว');}catch{link.focus();link.select();toast('เลือกลิงก์ไว้แล้ว กดคัดลอกได้เลย');}}
 root.querySelector('[data-share-copy]').onclick=copy;
 share.onclick=async()=>{if(!data?.published)return;try{if(navigator.share)await navigator.share({title:shop.name,text:shop.seo_description||'เลือกชมสินค้าจาก '+shop.name,url:data.url});else await copy();}catch(err){if(err.name!=='AbortError')toast('แชร์ไม่สำเร็จ ลองใช้ปุ่มคัดลอกลิงก์');}};
 svg.onclick=()=>{if(data?.published)download(new Blob([data.svg],{type:'image/svg+xml'}),'svg');};
 png.onclick=()=>{if(!data?.published)return;png.disabled=true;try{const scale=20,padding=4,size=data.modules.length,canvas=document.createElement('canvas');canvas.width=canvas.height=(size+padding*2)*scale;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000';data.modules.forEach((row,y)=>row.forEach((dark,x)=>{if(dark)ctx.fillRect((x+padding)*scale,(y+padding)*scale,scale,scale);}));canvas.toBlob(blob=>{png.disabled=false;if(blob)download(blob,'png');else toast('สร้าง PNG ไม่สำเร็จ ลองดาวน์โหลด SVG');},'image/png');}catch{png.disabled=false;toast('สร้าง PNG ไม่สำเร็จ ลองดาวน์โหลด SVG');}};
 async function load(){status.textContent='กำลังสร้าง QR Code…';try{const result=await api(`/shops/${shop.id}/share`);if(!root.isConnected)return;data=result;link.value=result.url;qr.innerHTML=result.svg;png.disabled=svg.disabled=share.disabled=!result.published;status.textContent=result.published?'พร้อมแชร์ · QR Code เปิดหน้าร้านสาธารณะ':'ร้านยังปิดอยู่ เปิดหน้าร้านและบันทึกก่อนดาวน์โหลด QR หรือแชร์';}catch(err){if(root.isConnected){status.textContent=err.message;const retry=document.createElement('button');retry.type='button';retry.className='secondary';retry.textContent='ลองสร้าง QR อีกครั้ง';retry.onclick=()=>{retry.remove();load();};status.after(retry);}}}
 load();
}
