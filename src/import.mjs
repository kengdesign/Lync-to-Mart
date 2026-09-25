export function extractProduct(html){
  const nodes=[];
  function visit(x){if(!x||typeof x!=='object')return;if(Array.isArray(x)){x.forEach(visit);return;}nodes.push(x);if(x['@graph'])visit(x['@graph']);}
  for(const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)){try{visit(JSON.parse(m[1]));}catch{}}
  const p=nodes.find(n=>[n['@type']].flat().includes('Product'));
  if(!p||typeof p.name!=='string')return null;
  const offer=Array.isArray(p.offers)?p.offers[0]:p.offers;
  const value=offer?.price, n=Number(value);
  return {name:p.name.slice(0,180),description:typeof p.description==='string'?p.description.slice(0,5000):'',price:value!=null&&value!==''&&offer?.priceCurrency==='THB'&&Number.isFinite(n)&&n>=0?Math.round(n*100):null,source_currency:offer?.priceCurrency||null,image_detected:!!p.image};
}
export async function boundedHTML(response){const reader=response.body?.getReader();if(!reader)throw new Error('ไม่พบข้อมูลต้นทาง');let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1000000){await reader.cancel();throw new Error('หน้าสินค้ามีขนาดใหญ่เกินไป');}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return new TextDecoder().decode(bytes);}
