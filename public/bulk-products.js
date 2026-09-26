export function mountBulkProducts(root,{send,toast,shopId,published,onSaved,confirm=message=>window.confirm(message)}){
 const boxes=[...root.querySelectorAll('[data-select-product]')],all=root.querySelector('[data-select-all]');if(!all)return;
 const bar=root.ownerDocument.createElement('div');bar.className='bulk-products';bar.innerHTML='<span data-count aria-live="polite"></span><div class="actions"><button type="button" data-bulk="published">เผยแพร่ที่เลือก</button><button type="button" class="secondary" data-bulk="draft">เปลี่ยนเป็นฉบับร่าง</button><button type="button" class="link" data-clear>ยกเลิกการเลือก</button></div>';root.prepend(bar);
 const buttons=[...bar.querySelectorAll('button')];let busy=false;
 const selected=()=>boxes.filter(b=>b.checked).map(b=>b.dataset.selectProduct);
 function refresh(){const count=selected().length;bar.querySelector('[data-count]').textContent=`เลือก ${count} รายการ · สูงสุด 100 รายการต่อครั้ง`;all.checked=count===Math.min(boxes.length,100);all.indeterminate=count>0&&!all.checked;buttons.forEach(b=>b.disabled=busy||!count);boxes.forEach(b=>b.disabled=busy||(!b.checked&&count>=100));all.disabled=busy;}
 boxes.forEach(b=>b.onchange=refresh);all.onchange=()=>{boxes.forEach((b,i)=>b.checked=all.checked&&i<100);refresh();};bar.querySelector('[data-clear]').onclick=()=>{boxes.forEach(b=>b.checked=false);refresh();};
 bar.querySelectorAll('[data-bulk]').forEach(button=>button.onclick=async()=>{
  if(busy)return;const ids=selected(),status=button.dataset.bulk;if(!ids.length)return;
  const action=status==='published'?'เผยแพร่':'เปลี่ยนเป็นฉบับร่าง';
  if(!confirm(`${action}สินค้า ${ids.length} รายการที่เลือก?${status==='published'&&!published?'\nร้านยังไม่เผยแพร่ ลูกค้าจะเห็นสินค้าหลังเผยแพร่ร้านแล้ว':''}`))return;
  busy=true;refresh();try{const result=await send(`/shops/${shopId}/bulk-status`,{ids,status});onSaved(result);toast(`${action}แล้ว ${result.count} รายการ`);}catch(err){toast(err.message);}finally{busy=false;if(root.isConnected)refresh();}
 });refresh();
}
