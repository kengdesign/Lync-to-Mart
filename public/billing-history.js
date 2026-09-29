const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={starter:'Starter',growth:'Growth',brand:'Brand'};
const states={paid:'ชำระแล้ว',open:'รอชำระ',draft:'ฉบับร่าง',void:'ยกเลิกบิล',uncollectible:'เรียกเก็บไม่สำเร็จ'};
const date=n=>new Date(n*1000).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok'});
const money=(n,currency='thb')=>new Intl.NumberFormat('th-TH',{style:'currency',currency}).format(n/100);
function link(value,host,label){try{const u=new URL(value);if(u.protocol==='https:'&&u.hostname===host&&!u.username&&!u.password&&!u.port)return `<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${label}<span class="muted"> ↗</span></a>`;}catch{}return '';}
export function mountBillingHistory({root,api}){
 let busy=false,cursor=null,loaded=false;
 root.innerHTML='<h3>ประวัติการชำระเงินและเอกสาร</h3><p class="muted">ข้อมูลทดสอบจาก Stripe · เปิดเอกสารในแท็บใหม่</p><button type="button" class="secondary" data-history-load>ดูประวัติการชำระเงิน</button><p data-history-message role="status" aria-live="polite"></p><div data-history-invoices></div><div data-history-upgrades></div>';
 const button=root.querySelector('[data-history-load]'),message=root.querySelector('[data-history-message]'),invoices=root.querySelector('[data-history-invoices]'),upgrades=root.querySelector('[data-history-upgrades]');
 button.onclick=async()=>{
  if(busy)return;busy=true;button.disabled=true;root.setAttribute('aria-busy','true');message.textContent='กำลังโหลดประวัติ…';
  try{
   const result=await api('/billing/history'+(cursor?'?after='+encodeURIComponent(cursor):''));if(!root.isConnected)return;
   if(!loaded)invoices.innerHTML='<h4>บิลสมัครและต่ออายุ</h4><div class="billing-history-list"></div>';
   const list=invoices.querySelector('.billing-history-list');
   list.insertAdjacentHTML('beforeend',result.invoices.map(i=>`<article class="billing-history-row"><div><strong>${esc(i.number||i.id)}</strong><p>${esc(date(i.created))} · ${esc(states[i.status]||i.status)}</p></div><div><strong>ยอดบิล ${esc(money(i.total,i.currency))}</strong><p>ชำระแล้ว ${esc(money(i.amount_paid,i.currency))}${i.amount_remaining>0?' · คงเหลือ '+esc(money(i.amount_remaining,i.currency)):''}</p></div><div class="billing-document-links">${link(i.url,'invoice.stripe.com','เปิดบิล')}${link(i.pdf,'pay.stripe.com','ดาวน์โหลด PDF')}${!i.url&&!i.pdf?'<span class="muted">ยังไม่มีเอกสาร</span>':''}</div></article>`).join(''));
   if(!loaded&&!result.invoices.length)list.textContent='ยังไม่มีบิลในบัญชีนี้';
   if(!loaded){upgrades.innerHTML='<h4>อัปเกรดที่ชำระและเปิดสิทธิ์แล้ว · ล่าสุดไม่เกิน 20 รายการ</h4><p class="muted">แสดงยอดชำระครั้งเดียว แยกจากบิลต่ออายุ รายการนี้ไม่มี PDF ในหน้านี้ และไม่ใช่สถานะการคืนเงิน</p><div class="billing-history-list">'+(result.upgrades.length?result.upgrades.map(u=>`<article class="billing-history-row"><div><strong>${esc(names[u.from_plan]||u.from_plan)} → ${esc(names[u.to_plan]||u.to_plan)}</strong><p>เปิดสิทธิ์ ${esc(date(u.updated_at))} · ราย${u.period==='yearly'?'ปี':'เดือน'}</p></div><div><strong>${esc(money(u.amount))}</strong><p>${u.pricing_mode==='full'?'ราคาเต็ม เริ่มรอบใหม่':'ส่วนต่างราคา คงรอบเดิม'}</p></div></article>`).join(''):'ยังไม่มีรายการอัปเกรดที่สำเร็จ')+'</div>';}
   loaded=true;cursor=result.next_cursor;button.hidden=!cursor;button.textContent='ดูบิลย้อนหลังเพิ่มเติม';message.textContent='โหลดประวัติแล้ว · การดูประวัติไม่เรียกเก็บเงินเพิ่ม';
  }catch(err){message.textContent='โหลดประวัติไม่สำเร็จ: '+err.message;button.textContent='ลองโหลดประวัติอีกครั้ง';}
  finally{busy=false;button.disabled=false;root.removeAttribute('aria-busy');}
 };
}
