export const coverPosition=value=>Number.isFinite(Number(value))?Math.max(0,Math.min(100,Math.round(Number(value)))):50;
export function positionClass(value){return 'cover-y-'+coverPosition(value);}
export function mountCoverPosition(form){
 const frame=form.querySelector('.brand-image.cover_key'),img=frame.querySelector('img'),range=form.querySelector('[name="cover_position_y"]'),reset=form.querySelector('#cover-center'),hint=form.querySelector('#cover-position-hint');let drag=null;
 function apply(value){range.value=coverPosition(value);for(const c of [...img.classList])if(c.startsWith('cover-y-'))img.classList.remove(c);img.classList.add(positionClass(range.value));range.setAttribute('aria-valuetext',range.value+'% จากด้านบน');}
 function overflow(){if(!img.naturalWidth||!img.naturalHeight)return 0;const scale=Math.max(frame.clientWidth/img.naturalWidth,frame.clientHeight/img.naturalHeight);return Math.max(0,img.naturalHeight*scale-frame.clientHeight);}
 function refresh(){const loaded=!!form.elements.cover_key.value&&!img.hidden&&img.complete&&img.naturalWidth>0,canMove=loaded&&overflow()>1;range.disabled=!canMove;reset.disabled=!loaded;frame.classList.toggle('cover-draggable',canMove);hint.textContent=!loaded?'อัปโหลดภาพปกก่อนเลือกจุดโฟกัส':canMove?'ลากภาพขึ้น–ลง หรือใช้แถบเลื่อน แล้วกดบันทึกการเปลี่ยนแปลง':'ภาพนี้พอดีกับความสูงของกรอบแล้ว จึงไม่มีส่วนเกินให้เลื่อนขึ้น–ลง';apply(range.value);}
 img.draggable=false;img.addEventListener('load',refresh);img.addEventListener('error',refresh);range.addEventListener('input',()=>apply(range.value));reset.addEventListener('click',()=>apply(50));
 frame.addEventListener('pointerdown',ev=>{if(range.disabled||ev.button!==0)return;ev.preventDefault();drag={id:ev.pointerId,y:ev.clientY,value:Number(range.value),overflow:overflow()};frame.setPointerCapture(ev.pointerId);frame.classList.add('cover-dragging');});
 frame.addEventListener('pointermove',ev=>{if(!drag||drag.id!==ev.pointerId)return;apply(drag.value-(ev.clientY-drag.y)/drag.overflow*100);});
 function end(ev){if(drag?.id!==ev.pointerId)return;drag=null;frame.classList.remove('cover-dragging');if(frame.hasPointerCapture(ev.pointerId))frame.releasePointerCapture(ev.pointerId);}
 frame.addEventListener('pointerup',end);frame.addEventListener('pointercancel',end);frame.addEventListener('lostpointercapture',()=>{drag=null;frame.classList.remove('cover-dragging');});
 const observer=new ResizeObserver(()=>{if(!form.isConnected){observer.disconnect();return;}refresh();});observer.observe(frame);
 apply(range.value);refresh();return {refresh,reset(){apply(50);refresh();}};
}
