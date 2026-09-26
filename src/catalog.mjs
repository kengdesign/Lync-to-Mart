export const PAGE_SIZE=12;
export function catalogPage(products,params=new URLSearchParams()){
 const raw=params.get('page')||'1';
 if(!/^[1-9]\d{0,5}$/.test(raw))throw Object.assign(new Error('หมายเลขหน้าไม่ถูกต้อง'),{status:400});
 const page=Number(raw),q=(params.get('q')||'').trim().slice(0,180),category=(params.get('category')||'').slice(0,500);
 const matches=products.filter(p=>(!q||`${p.name} ${p.description} ${p.category}`.toLocaleLowerCase('th-TH').includes(q.toLocaleLowerCase('th-TH')))&&(!category||p.category===category));
 const pages=Math.max(1,Math.ceil(matches.length/PAGE_SIZE));
 if(page>pages)throw Object.assign(new Error('ไม่พบหน้าสินค้านี้'),{status:404});
 return {page,pages,q,category,total:matches.length,start:matches.length?(page-1)*PAGE_SIZE+1:0,end:Math.min(page*PAGE_SIZE,matches.length),items:matches.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE)};
}
export function catalogURL(path,{page=1,q='',category=''}){const params=new URLSearchParams();if(q)params.set('q',q);if(category)params.set('category',category);if(page>1)params.set('page',String(page));return path+(params.size?'?'+params:'');}
