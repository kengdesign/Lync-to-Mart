import {priceRange} from './content.mjs';
export const catalogSorts=[['recommended','แนะนำจากร้าน'],['newest','ใหม่ล่าสุด'],['price-asc','ราคาเริ่มต้น: ต่ำไปสูง'],['price-desc','ราคาเริ่มต้น: สูงไปต่ำ']];
export const PAGE_SIZE=12;
export function catalogPage(products,params=new URLSearchParams()){
 const raw=params.get('page')||'1';
 if(!/^[1-9]\d{0,5}$/.test(raw))throw Object.assign(new Error('หมายเลขหน้าไม่ถูกต้อง'),{status:400});
 const page=Number(raw),q=(params.get('q')||'').trim().slice(0,180),category=(params.get('category')||'').slice(0,500);
 const requested=params.get('sort')||'recommended',sort=catalogSorts.some(([id])=>id===requested)?requested:'recommended';
 const matches=products.filter(p=>(!q||`${p.name} ${p.description} ${p.category}`.toLocaleLowerCase('th-TH').includes(q.toLocaleLowerCase('th-TH')))&&(!category||p.category===category));
 if(sort==='newest')matches.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))||String(b.id).localeCompare(String(a.id)));
 if(sort.startsWith('price-')){const prices=new Map(matches.map(p=>[p,priceRange(p)?.[0]??null]));matches.sort((a,b)=>{const x=prices.get(a),y=prices.get(b);if(x===null)return y===null?0:1;if(y===null)return -1;return sort==='price-asc'?x-y:y-x;});}
 const pages=Math.max(1,Math.ceil(matches.length/PAGE_SIZE));
 if(page>pages)throw Object.assign(new Error('ไม่พบหน้าสินค้านี้'),{status:404});
 return {page,pages,q,category,sort,total:matches.length,start:matches.length?(page-1)*PAGE_SIZE+1:0,end:Math.min(page*PAGE_SIZE,matches.length),items:matches.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE)};
}
export function catalogURL(path,{page=1,q='',category='',sort='recommended'}){const params=new URLSearchParams();if(q)params.set('q',q);if(category)params.set('category',category);if(catalogSorts.some(([id])=>id===sort)&&sort!=='recommended')params.set('sort',sort);if(page>1)params.set('page',String(page));return path+(params.size?'?'+params:'');}
