export function connectProductLightbox(doc=document){
 let active=null;
 doc.addEventListener('click',event=>{
  const link=event.target.closest?.('.product-gallery a, .product-extra-gallery a');
  if(!link||event.button!==0||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
  const card=link.closest('.product-card');if(!card||!link.querySelector('img')||typeof doc.createElement('dialog').showModal!=='function')return;
  const links=[...card.querySelectorAll('.product-gallery a, .product-extra-gallery a')];
  const images=links.map(a=>({src:a.href,alt:a.querySelector('img')?.alt||'รูปสินค้า'}));
  if(!images.length)return;
  event.preventDefault();active?.close();
  const dialog=doc.createElement('dialog');active=dialog;dialog.className='product-lightbox';dialog.setAttribute('aria-label','รูปภาพสินค้า');
  dialog.innerHTML='<div class="lightbox-toolbar"><span role="status" aria-live="polite"></span><button type="button" data-close aria-label="ปิดรูปภาพ">ปิด ✕</button></div><div class="lightbox-stage"><img alt=""><p data-error role="status" hidden>โหลดรูปไม่สำเร็จ ลองเปิดรูปต้นฉบับ</p></div><div class="lightbox-controls"><button type="button" data-prev aria-label="รูปก่อนหน้า">← ก่อนหน้า</button><a target="_blank" rel="noopener" data-original>เปิดรูปต้นฉบับ ↗</a><button type="button" data-next aria-label="รูปถัดไป">ถัดไป →</button></div>';
  let index=Math.max(0,links.indexOf(link));
  const img=dialog.querySelector('img'),status=dialog.querySelector('[role="status"]'),error=dialog.querySelector('[data-error]');
  function show(){const item=images[index];error.hidden=true;img.hidden=false;img.alt=item.alt;img.src=item.src;status.textContent=`รูป ${index+1} / ${images.length}`;dialog.querySelector('[data-original]').href=item.src;dialog.querySelector('[data-prev]').disabled=index===0;dialog.querySelector('[data-next]').disabled=index===images.length-1;}
  const stage=dialog.querySelector('.lightbox-stage');
  let gesture=null;
  stage.addEventListener('touchstart',e=>{
   gesture=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY,id:e.touches[0].identifier}:null;
  },{passive:true});
  stage.addEventListener('touchmove',e=>{if(e.touches.length!==1)gesture=null;},{passive:true});
  stage.addEventListener('touchcancel',()=>{gesture=null;},{passive:true});
  stage.addEventListener('touchend',e=>{
   const start=gesture;gesture=null;if(!start||e.touches.length)return;
   const touch=[...e.changedTouches].find(t=>t.identifier===start.id);if(!touch)return;
   const dx=touch.clientX-start.x,dy=touch.clientY-start.y;
   // Ignore scrolling, taps and pinch zoom; change once on release.
   if(Math.abs(dx)<50||Math.abs(dx)<Math.abs(dy)*1.5)return;
   dialog.querySelector(dx<0?'[data-next]':'[data-prev]').click();
  },{passive:true});
  img.onerror=()=>{img.hidden=true;error.hidden=false;};
  dialog.querySelector('[data-prev]').onclick=()=>{if(index>0){index--;show();}};
  dialog.querySelector('[data-next]').onclick=()=>{if(index<images.length-1){index++;show();}};
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();dialog.querySelector(e.key==='ArrowLeft'?'[data-prev]':'[data-next]').click();}});
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{dialog.remove();if(active===dialog)active=null;if(link.isConnected)link.focus({preventScroll:true});});
  doc.body.append(dialog);show();dialog.showModal();dialog.querySelector('[data-close]').focus();
 });
}
