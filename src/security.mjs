const enc=new TextEncoder();
export const hex=b=>Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('');
export const hash=async s=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
export async function passwordHash(password,salt=hex(crypto.getRandomValues(new Uint8Array(16)))) {const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);return `${salt}:${hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},key,256))}`;}
export async function verifyPassword(p,stored){const computed=await passwordHash(p,stored.split(':')[0]);let diff=computed.length^stored.length;for(let i=0;i<computed.length;i++)diff|=computed.charCodeAt(i)^(stored.charCodeAt(i)||0);return diff===0;}
export function safeURL(raw,hosts){try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&hosts.includes(u.hostname.toLowerCase())?u.href:null;}catch{return null;}}
export const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
