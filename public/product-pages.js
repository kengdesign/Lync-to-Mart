export function productPage(products,{search='',status='all',page=1,size=20}={}){
 size=[20,50,100].includes(Number(size))?Number(size):20;
 const needle=search.trim().toLocaleLowerCase('th-TH');
 const filtered=products.filter(p=>p.name.toLocaleLowerCase('th-TH').includes(needle)&&(status==='all'||p.status===status));
 const total=filtered.length,pages=Math.max(1,Math.ceil(total/size));page=Math.min(pages,Math.max(1,Math.trunc(Number(page))||1));
 const start=(page-1)*size;
 return {items:filtered.slice(start,start+size),page,pages,size,total,start:total?start+1:0,end:Math.min(start+size,total)};
}
export function mountProductPager(root,data,onPage){
 const doc=root.ownerDocument;root.replaceChildren();root.className='product-pager';root.setAttribute('aria-label','แบ่งหน้ารายการสินค้า');
 const summary=doc.createElement('span');summary.setAttribute('role','status');summary.textContent=`แสดง ${data.start}–${data.end} จาก ${data.total} รายการ`;root.append(summary);
 if(data.pages<=1)return;
 const actions=doc.createElement('div');actions.className='actions';
 const button=(label,page,disabled)=>{const el=doc.createElement('button');el.type='button';el.className='secondary';el.textContent=label;el.disabled=disabled;el.onclick=()=>onPage(page);return el;};
 const select=doc.createElement('select');select.setAttribute('aria-label','เลือกหน้ารายการสินค้า');for(let i=1;i<=data.pages;i++){const option=doc.createElement('option');option.value=String(i);option.textContent=`หน้า ${i} / ${data.pages}`;option.selected=i===data.page;select.append(option);}select.onchange=()=>onPage(Number(select.value));
 actions.append(button('← ก่อนหน้า',data.page-1,data.page===1),select,button('ถัดไป →',data.page+1,data.page===data.pages));root.append(actions);
}
