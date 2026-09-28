const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let view='overview',page=1,sequence=0,controller;
const size=n=>new Intl.NumberFormat('th-TH',{maximumFractionDigits:1}).format(n/1048576)+' MB';
async function load(){
 const request=++sequence;controller?.abort();controller=new AbortController();$('#admin-status').textContent='กำลังโหลดข้อมูล…';
 try{
 const response=await fetch('/api/admin?'+new URLSearchParams({view,page,q:$('#admin-query').value}),{signal:controller.signal});const data=await response.json();if(request!==sequence)return;
 if(!response.ok){$('#admin-content').hidden=true;$('#admin-login').hidden=response.status!==401;throw Error(data.error||'โหลดข้อมูลไม่สำเร็จ');}
 $('#admin-content').hidden=false;$('#admin-login').hidden=true;$('#admin-status').textContent='สิทธิ์: '+data.role+' · ข้อมูลสำหรับผู้ดูแลระบบ';$('#admin-search').hidden=view==='overview';
 $('[data-view="audit"]').hidden=data.role!=='owner';
 $('label[for="admin-query"]').textContent=view==='audit'?'ค้นหาอีเมลผู้ดูแล อีเมลร้านค้า ชื่อร้าน หรือเหตุผล':'ค้นหาอีเมล ชื่อร้าน หรือชื่อในลิงก์';
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.view===view)));
 if(view==='overview'){
 const s=data.stats;$('#admin-results').innerHTML='<div class="admin-stats">'+[['สมาชิก',s.users],['ร้านค้าทั้งหมด',s.shops],['ร้านค้าที่เผยแพร่',s.published_shops],['สินค้าทั้งหมด',s.products],['สินค้าที่เผยแพร่',s.published_products],['พื้นที่ไฟล์',size(s.storage_bytes)]].map(([label,value])=>`<article class="admin-stat">${esc(label)}<strong>${esc(value)}</strong></article>`).join('')+'</div><p>ระบบ: '+esc(data.environment)+' · การชำระเงิน Stripe ยังไม่เปิดใช้</p><p>หน้านี้แสดงข้อมูลเพื่อตรวจสอบ การจัดการสิทธิ์และแพ็กเกจจะเพิ่มในขั้นถัดไป</p>';$('#admin-pages').replaceChildren();return;
 }
 const headings=view==='audit'?['เวลา (ประเทศไทย)','ผู้ดูแล','ร้านค้า / บัญชี','รายการ','เหตุผล']:view==='users'?['อีเมล','แพ็กเกจในบัญชี','จำนวนร้าน','พื้นที่ไฟล์']:['ร้านค้า','อีเมลเจ้าของ','สถานะ','สินค้า',...(data.role==='owner'?['เข้าดูหลังบ้าน']:[])];
 $('#admin-results').innerHTML='<div class="admin-table"><table><thead><tr>'+headings.map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+data.rows.map(r=>'<tr>'+(view==='audit'?[esc(new Date(r.created_at.replace(' ','T')+'Z').toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})),esc(r.actor_email||r.actor_id),esc(r.shop_name||r.shop_id)+'<br><small>'+esc(r.target_email||r.target_id)+'</small>',esc(({swap_start:'เริ่มเข้าดู',swap_stop:'กลับบัญชีแอดมิน'})[r.action]||r.action),'<span class="audit-reason">'+esc(r.reason||'—')+'</span>']:view==='users'?[esc(r.email),esc(r.plan_id),esc(r.shop_count),esc(size(r.storage_bytes))]:[esc(r.name)+'<br><small>/shop/'+esc(r.slug)+'</small>',esc(r.email),r.published?'เผยแพร่':'ฉบับร่าง',esc(r.product_count),...(data.role==='owner'?['<button type="button" data-swap="'+esc(r.id)+'">เข้าสู่หลังบ้านร้านค้า</button>']:[])]).map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'+(data.rows.length?'':'<p>ไม่พบรายการที่ตรงกับการค้นหา</p>');
 if(view==='audit')$('#admin-results').insertAdjacentHTML('afterbegin','<p>ประวัติการเริ่มเข้าดูและการกดกลับบัญชีแอดมิน · การปิดแท็บหรือหมดเวลา 30 นาทีจะไม่มีรายการกดกลับ</p>');
 document.querySelectorAll('[data-swap]').forEach(b=>b.onclick=()=>openSwap(data.rows.find(r=>r.id===b.dataset.swap)));
 $('#admin-pages').innerHTML=`<button id="admin-prev" ${page<=1?'disabled':''}>ก่อนหน้า</button><span>หน้า ${page} / ${data.pages} · ${data.total} รายการ</span><button id="admin-next" ${page>=data.pages?'disabled':''}>ถัดไป</button>`;
 $('#admin-prev').onclick=()=>{page--;load();};$('#admin-next').onclick=()=>{page++;load();};
 }catch(error){if(error.name!=='AbortError'&&request===sequence){$('#admin-status').textContent=error.message;$('#admin-results').replaceChildren();$('#admin-pages').replaceChildren();}}
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;page=1;$('#admin-query').value='';load();});$('#admin-search').onsubmit=e=>{e.preventDefault();page=1;load();};load();

function openSwap(shop){
 const dialog=document.createElement('dialog');dialog.className='swap-dialog';dialog.innerHTML=`<form><h2>เข้าสู่หลังบ้านร้านค้า</h2><p id="swap-shop"></p><p>เปิดดูด้วยสิทธิ์บัญชีร้านค้าแบบอ่านอย่างเดียว 30 นาที การเข้าดูจะถูกบันทึก และมีผลกับแท็บ Mart อื่นในเบราว์เซอร์นี้ด้วย</p><label for="swap-reason">เหตุผลในการเข้าดู</label><textarea id="swap-reason" required minlength="5" maxlength="500" placeholder="เช่น ตรวจสอบรูปภาพสินค้าตามที่ร้านค้าแจ้ง"></textarea><p role="status" id="swap-status"></p><div class="actions"><button type="button" id="swap-cancel">ยกเลิก</button><button type="submit">ยืนยันเข้าดูร้านค้า</button></div></form>`;
 document.body.append(dialog);dialog.querySelector('#swap-shop').textContent=shop.name+' · '+shop.email;let busy=false;
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>dialog.remove());dialog.querySelector('#swap-cancel').onclick=()=>dialog.close();
 dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;dialog.querySelectorAll('button').forEach(b=>b.disabled=true);try{
 const r=await fetch('/api/admin/swap/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shop_id:shop.id,reason:dialog.querySelector('textarea').value})});const data=await r.json();if(!r.ok)throw Error(data.error);location.assign('/dashboard?shop='+encodeURIComponent(data.shop_id));
 }catch(error){dialog.querySelector('#swap-status').textContent=error.message;busy=false;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}};dialog.showModal();
}
