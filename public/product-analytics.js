const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>Number(value).toLocaleString('th-TH');
export function mountProductAnalytics({root,shopId,api}){
 let sequence=0;
 root.innerHTML=`<div class="analytics-heading"><div><span class="eyebrow">PRODUCT PERFORMANCE</span><h2>สินค้าไหนพาคนไป Thaimart</h2><p class="muted">เรียงตามจำนวนคลิกจากหน้าร้านของคุณ</p></div><label>ช่วงเวลา<select data-days aria-label="ช่วงเวลาสถิติรายสินค้า"><option value="7">7 วันล่าสุด</option><option value="30" selected>30 วันล่าสุด</option></select></label></div><div data-results aria-live="polite"></div><p class="analytics-note">นับตามเวลาไทย รวมวันนี้และการคลิกซ้ำ อาจรวมบอต · ไม่ใช่จำนวนลูกค้า ยอดขาย หรือค่าคอมมิชชัน</p>`;
 const results=root.querySelector('[data-results]'),select=root.querySelector('[data-days]');
 async function refresh(){
  const request=++sequence;results.setAttribute('aria-busy','true');results.textContent='กำลังโหลดสถิติ…';
  try{
   const data=await api(`/shops/${encodeURIComponent(shopId)}/analytics?days=${select.value}`);
   if(!root.isConnected||request!==sequence)return;
   results.innerHTML=`<div class="analytics-summary"><strong>${number(data.total)} <small>คลิกไป Thaimart</small></strong><span>${esc(data.start)} – ${esc(data.end)}</span></div>${data.products.length?`${!data.total?'<p class="notice">ยังไม่มีคลิกในช่วงเวลานี้ ลองแชร์หน้าร้านเพื่อให้ลูกค้าเข้าถึงสินค้า</p>':''}<ol class="analytics-list">${data.products.map((p,i)=>`<li><span class="analytics-rank">${i+1}</span><div class="analytics-product"><strong>${esc(p.name)}</strong><small>${p.status==='deleted'?'ลบแล้ว · เก็บสถิติย้อนหลัง':p.status==='draft'?'ฉบับร่าง':'เผยแพร่แล้ว'}</small><meter min="0" max="${Math.max(1,data.products[0].clicks)}" value="${p.clicks}" aria-label="${esc(p.name)} ${p.clicks} คลิก">${p.clicks}</meter></div><strong class="analytics-count">${number(p.clicks)}<small>คลิก</small></strong></li>`).join('')}</ol>`:'<div class="empty"><h3>ยังไม่มีสินค้า</h3><p>เพิ่มสินค้าและเผยแพร่หน้าร้าน แล้วดูสถิติได้ที่นี่</p></div>'}`;
  }catch(error){
   if(!root.isConnected||request!==sequence)return;
   results.innerHTML=`<p class="error" role="alert">${esc(error.message)}</p><button type="button" class="secondary" data-retry>ลองอีกครั้ง</button>`;
   results.querySelector('[data-retry]').onclick=refresh;
  }finally{if(root.isConnected&&request===sequence)results.removeAttribute('aria-busy');}
 }
 select.onchange=refresh;refresh();
}
