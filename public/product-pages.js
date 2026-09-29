export function productPage(products,{search='',status='all',category=undefined,page=1,size=20,sort='default'}={}){
 size=[20,50,100].includes(Number(size))?Number(size):20;
 const normalize=value=>String(value??'').normalize('NFC').toLocaleLowerCase('th-TH');
 const needle=normalize(search.trim());
 const filtered=products.filter(p=>{
  if(status!=='all'&&p.status!==status)return false;
  if(category!==undefined&&String(p.category||'').trim()!==(category===null?'':category))return false;
  if(!needle)return true;
  const values=[p.name,p.description,p.category,...(p.variants||[]).flatMap(v=>[v.sku,...(v.attributes||[]).flatMap(a=>[a.key,a.value])])];
  return values.some(value=>normalize(value).includes(needle));
 });
 const compare={
  name:(a,b)=>String(a.name||'').localeCompare(String(b.name||''),'th'),
  price_low:(a,b)=>(a.price??0)-(b.price??0),
  price_high:(a,b)=>(b.price??0)-(a.price??0),
  featured:(a,b)=>Number(!!b.featured)-Number(!!a.featured)
 }[sort];
 if(compare)filtered.sort(compare);
 const total=filtered.length,pages=Math.max(1,Math.ceil(total/size));page=Math.min(pages,Math.max(1,Math.trunc(Number(page))||1));
 const start=(page-1)*size;
 return {matches:filtered,items:filtered.slice(start,start+size),page,pages,size,total,start:total?start+1:0,end:Math.min(start+size,total)};
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

export function mountCategoryFilter(select,products){
 const doc=select.ownerDocument,counts=new Map();let missing=0;
 for(const product of products){const category=String(product.category||'').trim();if(category)counts.set(category,(counts.get(category)||0)+1);else missing++;}
 select.replaceChildren();
 const option=(value,label)=>{const node=doc.createElement('option');node.value=value;node.textContent=label;select.append(node);};
 option('all',`ทุกหมวดหมู่ (${products.length})`);option('null',`ยังไม่มีหมวดหมู่ (${missing})`);
 for(const [category,count] of [...counts].sort(([a],[b])=>a.localeCompare(b,'th')))option(JSON.stringify(category),`${category} (${count})`);
}
