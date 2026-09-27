import {showcaseLimits,showcaseOrder,readShowcase} from './showcase-limits.js?v=1';
import {guardStoreForm} from './store-guard.js?v=storeguard1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function optimize(file,mobile){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10000000)throw Error('ใช้ JPG, PNG หรือ WebP ไม่เกิน 10 MB');
 const image=await createImageBitmap(file);
 try{
  if(image.width*image.height>40000000)throw Error('รูปมีความละเอียดสูงเกินไป กรุณาย่อรูปก่อน');
  const scale=Math.min(1,(mobile?900:1600)/image.width,3000/image.height),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.82));
  if(!blob||blob.size>1500000)throw Error('รูปหลังย่อยังเกิน 1.5 MB กรุณาใช้รูปขนาดเล็กลง');
  return {blob,width:canvas.width,height:canvas.height};
 }finally{image.close();}
}
export function mountShowcaseEditor({root,shop,plan,products,api,onSaved,notify}){
 const limit=showcaseLimits(plan.id),saved=readShowcase(shop.showcase_json);
 let data={campaigns:Array.isArray(saved.campaigns)?structuredClone(saved.campaigns):[],featured:!!saved.featured&&!!limit.featured,newest:!!saved.newest&&!!limit.newest,order:limit.reorder&&Array.isArray(saved.order)?[...saved.order]:[...showcaseOrder]},busy=false;
 root.innerHTML=`<div class="heading"><div><h1>แคมเปญหน้าร้าน</h1><p>ภาพโปรโมชั่นและแถวสินค้าใต้ภาพปก · ${esc(plan.name)}</p></div></div><form class="panel" id="showcase-form"><input type="hidden" name="showcase"><p class="notice">แสดงในหน้าแรกของรายการสินค้า เมื่อไม่มีคำค้นหาหรือตัวกรอง · ไม่มีเนื้อหาจะซ่อนส่วนนี้ · ภาพและสินค้าจริงจะเปลี่ยนเมื่อกดบันทึก</p><p>ภาพแคมเปญ ${limit.images} ภาพต่อร้าน · แนะนำ ${limit.featured} รายการ · มาใหม่ ${limit.newest} รายการ</p>${!limit.images?'<p>Free ใช้ภาพปกและรายการสินค้าปกติได้ ส่วนแคมเปญเพิ่มเติมเริ่มที่ Starter</p>':''}<div id="campaign-list"></div><button type="button" class="secondary" id="add-campaign">＋ เพิ่มภาพแคมเปญ</button><p class="muted">แนะนำภาพแนวนอนกว้าง 1600 px ระบบย่อเป็น WebP อัตโนมัติ ไม่ครอปข้อความ · รับไฟล์ไม่เกิน 10 MB และหลังย่อไม่เกิน 1.5 MB · ใช้โควตาพื้นที่บัญชีร่วมกับสินค้า</p><div class="field"><label class="inline-check"><input type="checkbox" name="featured" ${data.featured?'checked':''} ${!limit.featured?'disabled':''}>แสดงแถวสินค้าแนะนำ</label><small>ใช้สินค้าที่ปักหมุดแนะนำในหน้าสินค้า สูงสุด ${limit.featured} รายการที่เผยแพร่แล้ว</small></div><div class="field"><label class="inline-check"><input type="checkbox" name="newest" ${data.newest?'checked':''} ${!limit.newest?'disabled':''}>แสดงแถวสินค้ามาใหม่</label><small>ใช้วันที่เพิ่มสินค้า สูงสุด ${limit.newest} รายการที่เผยแพร่แล้ว</small></div><div id="showcase-order"></div><p id="showcase-status" role="status"></p><div class="actions"><button type="submit">บันทึกแคมเปญ</button><a class="button secondary" href="/preview/${encodeURIComponent(shop.id)}" target="_blank" rel="noopener">ดูตัวอย่างที่บันทึกแล้ว ↗</a></div></form>`;
 const form=root.querySelector('form'),status=root.querySelector('#showcase-status'),list=root.querySelector('#campaign-list');
 const sync=()=>{data.featured=form.elements.featured.checked;data.newest=form.elements.newest.checked;form.elements.showcase.value=JSON.stringify(data);};
 const labels={campaigns:'ภาพแคมเปญ',featured:'สินค้าแนะนำ',newest:'สินค้ามาใหม่'};
 const categories=[...new Set(products.map(p=>p.category).filter(Boolean))];
 function draw(){
  list.innerHTML=data.campaigns.map((c,i)=>`<fieldset class="campaign-editor" data-index="${i}"><legend>แคมเปญ ${i+1}</legend><label class="inline-check"><input type="checkbox" data-field="enabled" ${c.enabled?'checked':''}>แสดงแคมเปญนี้</label>${c.key?`<img class="campaign-editor-image" src="/media/${encodeURIComponent(c.key)}" alt="ตัวอย่างภาพแคมเปญ">`:''}<label>ภาพหลัก<input type="file" data-upload="key" accept="image/jpeg,image/png,image/webp"></label>${limit.mobile?`<label>ภาพเฉพาะมือถือ (ไม่บังคับ)<input type="file" data-upload="mobile" accept="image/jpeg,image/png,image/webp"></label>${c.mobile?`<img class="campaign-editor-image mobile-image" src="/media/${encodeURIComponent(c.mobile)}" alt="ตัวอย่างภาพมือถือ"><button type="button" class="secondary" data-action="clear-mobile">นำภาพมือถือออก</button>`:''}`:''}${[['title','หัวข้อ',100],['caption','คำอธิบายใต้ภาพ',400],['alt','คำอธิบายภาพสำหรับการเข้าถึงและค้นหา',200]].map(([key,label,max])=>`<label>${label}<input data-field="${key}" value="${esc(c[key])}" maxlength="${max}" ${key==='alt'?'required':''}></label>`).join('')}<label>คลิกภาพแล้วไปที่<select data-field="destination"><option value="">ไม่ใส่ลิงก์</option>${products.map(p=>`<option value="p:${esc(p.id)}" ${c.product===p.id?'selected':''}>สินค้า: ${esc(p.name)}${p.status==='draft'?' (ฉบับร่าง)':''}</option>`).join('')}${categories.map(category=>`<option value="c:${esc(category)}" ${c.category===category?'selected':''}>หมวดหมู่: ${esc(category)}</option>`).join('')}</select></label><small>ลิงก์ซื้อใช้ปลายทางของสินค้า รวม Affiliate ที่คุณตั้งไว้ สินค้าฉบับร่างหรือถูกลบจะไม่เป็นลิงก์ซื้อ</small><div class="actions">${limit.images>1?`<button type="button" class="secondary" data-action="up" ${i===0?'disabled':''}>เลื่อนขึ้น</button><button type="button" class="secondary" data-action="down" ${i===data.campaigns.length-1?'disabled':''}>เลื่อนลง</button>`:''}<button type="button" class="danger" data-action="remove">นำแคมเปญออก</button></div></fieldset>`).join('');
  root.querySelector('#add-campaign').disabled=data.campaigns.length>=limit.images;
  root.querySelector('#showcase-order').innerHTML=`<h2>ลำดับส่วนแสดงผล</h2>${data.order.map((key,i)=>`<div class="showcase-order-row"><span>${esc(labels[key])}</span>${limit.reorder?`<button type="button" class="secondary" data-order="${i}" ${!i?'disabled':''}>เลื่อนขึ้น</button>`:''}</div>`).join('')}${!limit.reorder?'<small>จัดลำดับส่วนแสดงผลได้ใน Brand</small>':''}`;
 }
 if(!limit.mobile&&data.campaigns.some(c=>c.mobile)){status.textContent='แพ็กเกจนี้ไม่รองรับภาพมือถือ เมื่อบันทึกใหม่จะใช้ภาพหลักแทน';data.campaigns.forEach(c=>c.mobile='');}
 draw();sync();
 const guard=guardStoreForm({form,isBusy:()=>busy,notify});
 form.addEventListener('input',ev=>{
  const field=ev.target.dataset.field,index=ev.target.closest('[data-index]')?.dataset.index;
  if(field&&index!==undefined){const c=data.campaigns[Number(index)];if(field==='destination'){c.product=ev.target.value.startsWith('p:')?ev.target.value.slice(2):'';c.category=ev.target.value.startsWith('c:')?ev.target.value.slice(2):'';}else c[field]=field==='enabled'?ev.target.checked:ev.target.value;}
  sync();
 });
 root.querySelector('#add-campaign').onclick=()=>{if(busy||data.campaigns.length>=limit.images)return;data.campaigns.push({key:'',mobile:'',title:'',caption:'',alt:'',product:'',category:'',enabled:true,width:1,height:1,mobile_width:1,mobile_height:1});draw();sync();};
 form.addEventListener('click',ev=>{
  const button=ev.target.closest('button');if(!button||busy)return;
  if(button.dataset.order){const i=Number(button.dataset.order);if(i>0&&limit.reorder){[data.order[i-1],data.order[i]]=[data.order[i],data.order[i-1]];draw();sync();}return;}
  const action=button.dataset.action,i=Number(button.closest('[data-index]')?.dataset.index);if(!action)return;
  if(action==='remove')data.campaigns.splice(i,1);
  if(action==='clear-mobile')data.campaigns[i].mobile='';
  if(action==='up'&&i>0)[data.campaigns[i-1],data.campaigns[i]]=[data.campaigns[i],data.campaigns[i-1]];
  if(action==='down'&&i<data.campaigns.length-1)[data.campaigns[i+1],data.campaigns[i]]=[data.campaigns[i],data.campaigns[i+1]];
  draw();sync();
 });
 form.addEventListener('change',async ev=>{
  if(!ev.target.dataset.upload||busy)return;
  const file=ev.target.files[0];if(!file)return;
  const i=Number(ev.target.closest('[data-index]').dataset.index),field=ev.target.dataset.upload;
  busy=true;form.inert=true;status.textContent='กำลังย่อและอัปโหลดภาพ…';
  try{const image=await optimize(file,field==='mobile');const result=await api('/media',{method:'POST',body:image.blob});data.campaigns[i][field]=result.key;const prefix=field==='mobile'?'mobile_':'';data.campaigns[i][prefix+'width']=image.width;data.campaigns[i][prefix+'height']=image.height;draw();sync();status.textContent='อัปโหลดแล้ว กดบันทึกแคมเปญเพื่อใช้บนหน้าร้าน';}catch(err){status.textContent=err.message;}finally{busy=false;form.inert=false;}
 });
 form.onsubmit=async ev=>{ev.preventDefault();if(busy)return;sync();busy=true;form.inert=true;status.textContent='กำลังบันทึก…';try{await api('/shops/'+encodeURIComponent(shop.id)+'/showcase',{method:'PUT',body:JSON.stringify(data)});guard.markSaved();await onSaved();notify('บันทึกแคมเปญแล้ว');}catch(err){status.textContent=err.message;}finally{busy=false;form.inert=false;}};
 return guard;
}
