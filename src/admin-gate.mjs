// Optional outer HTTP Basic gate. Credentials belong in Worker Secrets, never source.
export async function adminGate(req,env){
 let path;try{path=decodeURIComponent(new URL(req.url).pathname);}catch{return null;}
 if(!(path==='/sh0rt-log1ng'||path.startsWith('/sh0rt-log1ng/')||path==='/admin.html'||path==='/admin'||path==='/admin/'||path==='/api/admin'||path.startsWith('/api/admin/')))return null;
 if(!env.ADMIN_GATE_USER&&!env.ADMIN_GATE_PASSWORD)return null;
 const headers={'Cache-Control':'no-store','Vary':'Authorization','Content-Type':'text/plain; charset=utf-8'};
 if(!env.ADMIN_GATE_USER||!env.ADMIN_GATE_PASSWORD)return new Response('Admin access configuration incomplete',{status:503,headers});
 const auth=req.headers.get('Authorization')||'';
 let supplied='';try{if(/^Basic /i.test(auth)&&auth.length<4096)supplied=atob(auth.slice(6).trim());}catch{}
 const digest=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
 const [actual,expected]=await Promise.all([digest(supplied),digest(env.ADMIN_GATE_USER+':'+env.ADMIN_GATE_PASSWORD)]);
 let difference=0;for(let i=0;i<expected.length;i++)difference|=actual[i]^expected[i];
 if(difference===0)return null;
 return new Response('กรุณาใส่ชื่อผู้ใช้และรหัสผ่านสำหรับเข้าพื้นที่แอดมิน',{status:401,headers:{...headers,'WWW-Authenticate':'Basic realm="Mart Admin", charset="UTF-8"'}});
}
