export function mountBulkProducts(root,{send,toast,shopId,published,onSaved,categories=[],confirm=message=>window.confirm(message)}){
 const boxes=[...root.querySelectorAll('[data-select-product]')],all=root.querySelector('[data-select-all]');if(!all)return;
 const bar=root.ownerDocument.createElement('div');bar.className='bulk-products';bar.innerHTML='<span data-count aria-live="polite"></span><div class="actions"><button type="button" class="danger" data-bulk-trash>ย้ายที่เลือกไปถังขยะ</button><button type="button" data-bulk="published">เผยแพร่ที่เลือก</button><button type="button" class="secondary" data-bulk="draft">เปลี่ยนเป็นฉบับร่าง</button><button type="button" class="secondary" data-open-category>จัดหมวดหมู่</button><button type="button" class="link" data-clear>ยกเลิกการเลือก</button></div>';root.prepend(bar);
 const panel=root.ownerDocument.createElement('div');panel.className='bulk-category';panel.hidden=true;panel.innerHTML='<label>หมวดหมู่สำหรับสินค้าที่เลือก<input data-category-name maxlength="500" placeholder="พิมพ์ชื่อหมวดหมู่" aria-label="หมวดหมู่สำหรับสินค้าที่เลือก"></label><select data-existing-category aria-label="เลือกหมวดหมู่เดิม"><option value="">หรือเลือกหมวดหมู่เดิม</option></select><div class="actions"><button type="button" data-apply-category>บันทึกหมวดหมู่</button><button type="button" class="secondary" data-remove-category>นำหมวดหมู่ออกจากที่เลือก</button><button type="button" class="link" data-cancel-category>ยกเลิก</button></div><small>เปลี่ยนเฉพาะหมวดหมู่ สถานะเผยแพร่ ราคา และรูปยังคงเดิม</small>';bar.append(panel);
 const input=panel.querySelector('[data-category-name]'),existing=panel.querySelector('[data-existing-category]');
 for(const category of [...new Set(categories.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'))){const option=root.ownerDocument.createElement('option');option.value=category;option.textContent=category;existing.append(option);}

 const buttons=[...bar.querySelectorAll('button')];let busy=false;
 function closeCategory(){panel.hidden=true;input.value='';existing.value='';refresh();bar.querySelector('[data-open-category]').focus();}

 const selected=()=>boxes.filter(b=>b.checked).map(b=>b.dataset.selectProduct);
 function refresh(){const count=selected().length;bar.querySelector('[data-bulk-trash]').textContent=count?`ย้ายที่เลือกไปถังขยะ (${count})`:'ย้ายที่เลือกไปถังขยะ';if(!count)panel.hidden=true;bar.querySelector('[data-count]').textContent=`เลือก ${count} รายการ · สูงสุด 100 รายการต่อครั้ง`;all.checked=count===Math.min(boxes.length,100);all.indeterminate=count>0&&!all.checked;buttons.forEach(b=>b.disabled=busy||!count);boxes.forEach(b=>b.disabled=busy||(!b.checked&&count>=100));all.disabled=busy;input.disabled=existing.disabled=busy||!count;panel.querySelector('[data-apply-category]').disabled=busy||!count||!input.value.trim();}
 boxes.forEach(b=>b.onchange=refresh);all.onchange=()=>{boxes.forEach((b,i)=>b.checked=all.checked&&i<100);refresh();};bar.querySelector('[data-clear]').onclick=()=>{if(busy)return;panel.hidden=true;input.value='';existing.value='';boxes.forEach(b=>b.checked=false);refresh();};
 bar.querySelectorAll('[data-bulk]').forEach(button=>button.onclick=async()=>{
  if(busy)return;const ids=selected(),status=button.dataset.bulk;if(!ids.length)return;
  const action=status==='published'?'เผยแพร่':'เปลี่ยนเป็นฉบับร่าง';
  if(!confirm(`${action}สินค้า ${ids.length} รายการที่เลือก?${status==='published'&&!published?'\nร้านยังไม่เผยแพร่ ลูกค้าจะเห็นสินค้าหลังเผยแพร่ร้านแล้ว':''}`))return;
  busy=true;refresh();try{const result=await send(`/shops/${shopId}/bulk-status`,{ids,status});onSaved(result);toast(`${action}แล้ว ${result.count} รายการ`);}catch(err){toast(err.message);}finally{busy=false;if(root.isConnected)refresh();}
 });
 bar.querySelector('[data-bulk-trash]').onclick=async()=>{
  if(busy)return;const ids=selected();if(!ids.length)return;
  if(!confirm(`ย้ายสินค้า ${ids.length} รายการที่เลือกไปถังขยะ?\nสินค้าจะหายจากหน้าร้านทันที และสามารถกู้คืนจากถังขยะได้`))return;
  busy=true;refresh();const moved=[];let failure;
  try{
   for(const id of ids){bar.querySelector('[data-count]').textContent=`กำลังย้ายไปถังขยะ ${moved.length+1}/${ids.length}…`;try{await send(`/products/${encodeURIComponent(id)}`,{},'DELETE');moved.push(id);}catch(err){failure=err;break;}}
   if(moved.length)await onSaved({ids:moved,trashed:true,count:moved.length});
   toast(failure?`ย้ายแล้ว ${moved.length}/${ids.length} รายการ · ${failure.message} · ตรวจรายการที่เหลือแล้วลองอีกครั้ง`:`ย้ายไปถังขยะแล้ว ${moved.length} รายการ · กู้คืนได้จากถังขยะ`);
  }catch(err){toast(`ย้ายไปถังขยะแล้ว ${moved.length} รายการ แต่โหลดรายการใหม่ไม่สำเร็จ กรุณารีเฟรชหน้า · ${err.message}`);}
  finally{busy=false;if(root.isConnected)refresh();}
 };
 bar.querySelector('[data-open-category]').onclick=()=>{if(busy)return;if(!panel.hidden){closeCategory();return;}panel.hidden=false;input.focus();};
 panel.querySelector('[data-cancel-category]').onclick=()=>{if(!busy)closeCategory();};
 panel.onkeydown=event=>{if(event.key==='Escape'&&!busy){event.preventDefault();event.stopPropagation();closeCategory();}};
 input.oninput=refresh;existing.onchange=()=>{if(existing.value)input.value=existing.value;refresh();};
 async function categoryChange(clear){
  if(busy)return;const ids=selected(),category=clear?'':input.value.trim();if(!ids.length||(!clear&&!category))return;
  if(!confirm(clear?`นำหมวดหมู่ออกจากสินค้า ${ids.length} รายการที่เลือก?`:`เปลี่ยนหมวดหมู่สินค้า ${ids.length} รายการเป็น “${category}”?`))return;
  busy=true;refresh();try{const result=await send(`/shops/${shopId}/bulk-category`,{ids,category});onSaved(result);toast(`ปรับหมวดหมู่แล้ว ${result.count} รายการ`);}catch(err){toast(err.message);}finally{busy=false;if(root.isConnected)refresh();}
 }
 panel.querySelector('[data-apply-category]').onclick=()=>categoryChange(false);panel.querySelector('[data-remove-category]').onclick=()=>categoryChange(true);refresh();
}
