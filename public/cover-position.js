export const coverPosition=value=>Number.isFinite(Number(value))?Math.max(0,Math.min(100,Math.round(Number(value)))):50;
export function positionClass(value){return 'cover-y-'+coverPosition(value);}
export function mountCoverPosition(form){
 const frame=form.querySelector('.brand-image.cover_key'),img=frame.querySelector('img'),field=form.querySelector('[name="cover_position_y"]'),reset=form.querySelector('#cover-center'),hint=form.querySelector('#cover-position-hint');
 let drag=null,position=coverPosition(field.value),overflow=0,x=0,raf=0,canMove=false;
 frame.tabIndex=0;frame.setAttribute('role','slider');frame.setAttribute('aria-label','จุดโฟกัสภาพปก ลากขึ้นลงหรือใช้ปุ่มลูกศร');frame.setAttribute('aria-orientation','vertical');frame.setAttribute('aria-valuemin','0');frame.setAttribute('aria-valuemax','100');frame.setAttribute('aria-describedby','cover-position-hint');
 // One composited transform per animation frame; never read layout during pointermove.
 function paint(){raf=0;img.style.transform=`translate3d(${x}px,${-overflow*position/100}px,0)`;}
 function schedule(){if(!raf)raf=requestAnimationFrame(paint);}
 function commit(){field.value=coverPosition(position);frame.setAttribute('aria-valuenow',field.value);frame.setAttribute('aria-valuetext',field.value+'% จากด้านบน');}
 function set(value){position=Math.max(0,Math.min(100,value));commit();schedule();}
 function finish(ev){if(!drag||ev&&drag.id!==ev.pointerId)return;const id=drag.id;drag=null;frame.classList.remove('cover-dragging');commit();if(frame.hasPointerCapture(id))frame.releasePointerCapture(id);}
 function refresh(){
  if(!form.isConnected)return;
  finish();const width=frame.clientWidth,height=frame.clientHeight,loaded=!!form.elements.cover_key.value&&!img.hidden&&img.complete&&img.naturalWidth>0;
  if(loaded){const scale=Math.max(width/img.naturalWidth,height/img.naturalHeight);const w=img.naturalWidth*scale,h=img.naturalHeight*scale;overflow=Math.max(0,h-height);x=(width-w)/2;img.style.width=w+'px';img.style.height=h+'px';}else{overflow=0;x=0;}
  canMove=loaded&&overflow>1;reset.disabled=!loaded;frame.classList.toggle('cover-draggable',canMove);frame.setAttribute('aria-disabled',String(!canMove));
  hint.textContent=!loaded?'อัปโหลดภาพปกก่อนเลือกจุดโฟกัส':canMove?'คลิกค้างหรือนิ้วแตะค้างบนภาพ แล้วลากขึ้น–ลง · ใช้ปุ่มลูกศรได้ · กดบันทึกเมื่อจัดตำแหน่งแล้ว':'ภาพพอดีกับความสูงของกรอบแล้ว ไม่มีส่วนเกินให้เลื่อนขึ้น–ลง';commit();schedule();
 }
 img.draggable=false;img.addEventListener('dragstart',ev=>ev.preventDefault());img.addEventListener('load',refresh);img.addEventListener('error',refresh);reset.addEventListener('click',()=>set(50));
 frame.addEventListener('pointerdown',ev=>{if(!canMove||drag||ev.isPrimary===false||(ev.pointerType==='mouse'&&ev.button!==0))return;ev.preventDefault();frame.focus({preventScroll:true});drag={id:ev.pointerId,y:ev.clientY,position,overflow};frame.setPointerCapture(ev.pointerId);frame.classList.add('cover-dragging');});
 frame.addEventListener('pointermove',ev=>{if(!drag||drag.id!==ev.pointerId)return;position=Math.max(0,Math.min(100,drag.position-(ev.clientY-drag.y)/drag.overflow*100));schedule();});
 frame.addEventListener('pointerup',ev=>{if(drag?.id===ev.pointerId){position=Math.max(0,Math.min(100,drag.position-(ev.clientY-drag.y)/drag.overflow*100));schedule();}finish(ev);});
 frame.addEventListener('pointercancel',finish);frame.addEventListener('lostpointercapture',finish);
 frame.addEventListener('keydown',ev=>{if(!canMove)return;const actions={ArrowUp:position-2,ArrowDown:position+2,Home:0,End:100};if(ev.key in actions){ev.preventDefault();set(actions[ev.key]);}});
 // Cover frame has fixed dimensions. Observe only actual dimension changes.
 let lastWidth=-1,lastHeight=-1;const observer=new ResizeObserver(entries=>{if(!form.isConnected){observer.disconnect();if(raf)cancelAnimationFrame(raf);return;}const {width,height}=entries[0].contentRect;if(width===lastWidth&&height===lastHeight)return;lastWidth=width;lastHeight=height;refresh();});observer.observe(frame);
 form.addEventListener('submit',commit,true);refresh();return {refresh,reset(){position=50;commit();refresh();}};
}
