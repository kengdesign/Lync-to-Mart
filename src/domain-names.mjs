const reserved=['lyncto.link','lynctomart.com','workers.dev','pages.dev','localhost'];
export function canonicalDomain(value){
 const input=String(value||'').trim().replace(/\.$/,'');
 if(!input||/[\s/:?#@\\%]/.test(input))throw new Error('กรอกเฉพาะชื่อโดเมน ไม่ใส่ https:// หรือเส้นทาง');
 let host;try{host=new URL('https://'+input).hostname.toLowerCase();}catch{throw new Error('ชื่อโดเมนไม่ถูกต้อง');}
 const labels=host.split('.');
 if(host.length>253||labels.length<2||!labels.every(l=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l))||!/[a-z]/.test(labels.at(-1))||reserved.some(r=>host===r||host.endsWith('.'+r)))throw new Error('ไม่สามารถใช้ชื่อโดเมนนี้ได้');
 return host;
}
