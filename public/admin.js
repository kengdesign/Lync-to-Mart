const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let view='overview',page=1,sequence=0,controller;
const size=n=>new Intl.NumberFormat('th-TH',{maximumFractionDigits:1}).format(n/1048576)+' MB';
async function load(){
 const request=++sequence;controller?.abort();controller=new AbortController();$('#admin-status').textContent='กำลังโหลดข้อมูล…';
 try{
 const response=await fetch('/api/admin?'+new URLSearchParams({view,page,q:$('#admin-query').value}),{signal:controller.signal});const data=await response.json();if(request!==sequence)return;
 if(!response.ok){$('#admin-content').hidden=true;$('#admin-login').hidden=response.status!==401;throw Error(data.error||'โหลดข้อมูลไม่สำเร็จ');}
 $('#admin-content').hidden=false;$('#admin-login').hidden=true;$('#admin-status').textContent='สิทธิ์: '+data.role+' · ข้อมูลสำหรับผู้ดูแลระบบ';$('#admin-search').hidden=view==='overview';
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.view===view)));
 if(view==='overview'){
 const s=data.stats;$('#admin-results').innerHTML='<div class="admin-stats">'+[['สมาชิก',s.users],['ร้านค้าทั้งหมด',s.shops],['ร้านค้าที่เผยแพร่',s.published_shops],['สินค้าทั้งหมด',s.products],['สินค้าที่เผยแพร่',s.published_products],['พื้นที่ไฟล์',size(s.storage_bytes)]].map(([label,value])=>`<article class="admin-stat">${esc(label)}<strong>${esc(value)}</strong></article>`).join('')+'</div><p>ระบบ: '+esc(data.environment)+' · การชำระเงิน Stripe ยังไม่เปิดใช้</p><p>หน้านี้แสดงข้อมูลเพื่อตรวจสอบ การจัดการสิทธิ์และแพ็กเกจจะเพิ่มในขั้นถัดไป</p>';$('#admin-pages').replaceChildren();return;
 }
 const headings=view==='users'?['อีเมล','แพ็กเกจในบัญชี','จำนวนร้าน','พื้นที่ไฟล์']:['ร้านค้า','อีเมลเจ้าของ','สถานะ','สินค้า'];
 $('#admin-results').innerHTML='<div class="admin-table"><table><thead><tr>'+headings.map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+data.rows.map(r=>'<tr>'+(view==='users'?[esc(r.email),esc(r.plan_id),esc(r.shop_count),esc(size(r.storage_bytes))]:[esc(r.name)+'<br><small>/shop/'+esc(r.slug)+'</small>',esc(r.email),r.published?'เผยแพร่':'ฉบับร่าง',esc(r.product_count)]).map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'+(data.rows.length?'':'<p>ไม่พบรายการที่ตรงกับการค้นหา</p>');
 $('#admin-pages').innerHTML=`<button id="admin-prev" ${page<=1?'disabled':''}>ก่อนหน้า</button><span>หน้า ${page} / ${data.pages} · ${data.total} รายการ</span><button id="admin-next" ${page>=data.pages?'disabled':''}>ถัดไป</button>`;
 $('#admin-prev').onclick=()=>{page--;load();};$('#admin-next').onclick=()=>{page++;load();};
 }catch(error){if(error.name!=='AbortError'&&request===sequence){$('#admin-status').textContent=error.message;$('#admin-results').replaceChildren();$('#admin-pages').replaceChildren();}}
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;page=1;$('#admin-query').value='';load();});$('#admin-search').onsubmit=e=>{e.preventDefault();page=1;load();};load();
