import {campaignVideo,videoPositions} from './campaign-video.js?v=1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountCampaignVideoEditor({root,data,limit,onChange,isBusy}){
 data.videos=Array.isArray(data.videos)?data.videos:[];
 data.video_position=videoPositions.includes(data.video_position)?data.video_position:'featured';
 const names={campaigns:'ก่อนภาพแคมเปญ',featured:'ก่อนสินค้าแนะนำ',newest:'ก่อนสินค้ามาใหม่',after:'ท้ายแคมเปญ ก่อนรายการสินค้าหลัก'};
 function draw(){
  root.innerHTML=`<h2>วิดีโอแคมเปญ</h2><p>ใช้แล้ว ${data.videos.length} / ${limit.videos} วิดีโอต่อร้าน · สิทธิ์เท่ากันทั้งรายเดือนและรายปี</p><p class="muted">วางลิงก์เต็มหรือโค้ด iframe: YouTube, Vimeo, TikTok และ Facebook · Dailymotion ใช้ iframe ที่มี Player ID ส่วนลิงก์ทั่วไป, Instagram และ X แสดงปุ่มเปิดต้นทาง · วิดีโอต้องเปิดให้รับชมและอนุญาตฝังบนเว็บ</p>${data.videos.length>limit.videos?'<p class="notice">เกินสิทธิ์แพ็กเกจปัจจุบัน กรุณานำรายการส่วนเกินออกก่อนบันทึก หน้าร้านจะแสดงตามโควตา</p>':''}<div>${data.videos.map((v,i)=>`<fieldset class="campaign-editor" data-video-index="${i}"><legend>วิดีโอ ${i+1}</legend><label class="inline-check"><input type="checkbox" data-video-field="enabled" ${v.enabled?'checked':''}>แสดงวิดีโอนี้</label><label>ลิงก์วิดีโอหรือโค้ด iframe<textarea data-video-field="url" maxlength="8000" rows="3" required placeholder="https://www.youtube.com/watch?v=…">${esc(v.url)}</textarea></label><p class="muted" data-video-feedback>${feedback(v.url)}</p><label>ชื่อวิดีโอ (ไม่บังคับ)<input data-video-field="title" maxlength="100" value="${esc(v.title)}"></label><div class="campaign-video-settings"><label>ตำแหน่งในแถว<select data-video-field="align"><option value="full" ${v.align==='full'?'selected':''}>เต็มแถว</option>${limit.videoAlign?`<option value="left" ${v.align==='left'?'selected':''}>ครึ่งแถวซ้าย</option><option value="right" ${v.align==='right'?'selected':''}>ครึ่งแถวขวา</option>`:''}</select></label><label>สัดส่วนกรอบ<select data-video-field="ratio">${[['auto','อัตโนมัติตามชนิดลิงก์'],['landscape','แนวนอน 16:9'],['portrait','แนวตั้ง 9:16'],['square','สี่เหลี่ยม 1:1']].map(([key,name])=>`<option value="${key}" ${v.ratio===key?'selected':''}>${name}</option>`).join('')}</select></label></div><small>มือถือแสดงเต็มแถว · เลือกสัดส่วนเองได้หากลิงก์ไม่ระบุแนววิดีโอ</small><div class="actions campaign-video-actions"><button type="button" class="secondary" data-video-action="up" ${i===0?'disabled':''}>เลื่อนขึ้น</button><button type="button" class="secondary" data-video-action="down" ${i===data.videos.length-1?'disabled':''}>เลื่อนลง</button><button type="button" class="secondary" data-video-action="remove">นำวิดีโอออก</button></div></fieldset>`).join('')}</div><button type="button" class="secondary" data-add-video ${data.videos.length>=limit.videos?'disabled':''}>＋ เพิ่มวิดีโอ</button>${!limit.videos?'<p class="muted">วิดีโอแคมเปญเริ่มที่ Starter</p>':''}<label class="campaign-video-position">ตำแหน่งส่วนวิดีโอ<select data-video-position ${!limit.videos?'disabled':''}>${videoPositions.map(p=>`<option value="${p}" ${data.video_position===p?'selected':''}>${names[p]}</option>`).join('')}</select></label><p class="muted">ตัวเล่นจะโหลดเมื่อผู้ชมกด ไม่โหลดวิดีโอทุกแพลตฟอร์มพร้อมเปิดหน้า · ไม่ใช้พื้นที่เก็บวิดีโอของ Mart · การนำออกจะมีผลเมื่อบันทึกแคมเปญ</p>`;
 }
 function feedback(url){const p=campaignVideo(url);return !url?'ยังไม่ได้ใส่ลิงก์':p?`${p.provider} · ${p.embed?'รองรับตัวเล่นในหน้าร้าน':'แสดงปุ่มเปิดต้นทาง ไม่โหลดตัวเล่น'}`:'ยังไม่รองรับลิงก์นี้ ใช้ลิงก์เต็มของวิดีโอหรือโค้ด iframe (ไม่ใช้ลิงก์ย่อ/โค้ด script)';}
 // Downgrading retains videos but resets unavailable alignment when saving.
 if(!limit.videoAlign)data.videos.forEach(v=>v.align='full');
 draw();
 root.addEventListener('input',event=>{
  if(event.target.matches('[data-video-position]'))data.video_position=event.target.value;
  const key=event.target.dataset.videoField,box=event.target.closest('[data-video-index]');
  if(key&&box){const v=data.videos[Number(box.dataset.videoIndex)];v[key]=key==='enabled'?event.target.checked:event.target.value;if(key==='url')box.querySelector('[data-video-feedback]').textContent=feedback(v.url);}
  onChange();
 });
 root.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b||isBusy())return;
  if(b.hasAttribute('data-add-video')){if(data.videos.length>=limit.videos)return;data.videos.push({url:'',title:'',align:'full',ratio:'auto',enabled:true});}
  else{const action=b.dataset.videoAction;if(!action)return;const i=Number(b.closest('[data-video-index]').dataset.videoIndex);
   if(action==='remove')data.videos.splice(i,1);
   if(action==='up'&&i>0)[data.videos[i-1],data.videos[i]]=[data.videos[i],data.videos[i-1]];
   if(action==='down'&&i<data.videos.length-1)[data.videos[i+1],data.videos[i]]=[data.videos[i],data.videos[i+1]];
  }
  draw();onChange();
 });
}
