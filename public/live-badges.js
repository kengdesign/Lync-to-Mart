let snapshot={products:{},valid_until:0},pending,lastCheck=0,expiry;
export function paintLiveBadges(root=document,now=Date.now()){
 for(const badge of root.querySelectorAll('[data-live-product]')){
  const live=snapshot.valid_until*1000>now?snapshot.products[badge.dataset.liveProduct]:null;
  badge.hidden=!/^[a-f0-9]{24}$/.test(live||'');
  if(badge.hidden)badge.removeAttribute('href');else badge.href='https://thaimart.com/live?id='+live;
 }
}
export async function refreshLiveBadges(){
 paintLiveBadges();
 if(document.hidden||!document.querySelector('[data-live-product]')||pending||Date.now()-lastCheck<30000)return;
 lastCheck=Date.now();pending=true;
 try{
  const response=await fetch('/api/public/live-status',{signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error();
  const data=await response.json();if(!data.products||typeof data.products!=='object'||!Number.isFinite(data.valid_until))throw new Error();
  snapshot=data;
 }catch{snapshot={products:{},valid_until:0};}
 finally{pending=false;clearTimeout(expiry);paintLiveBadges();if(snapshot.valid_until*1000>Date.now())expiry=setTimeout(()=>paintLiveBadges(),snapshot.valid_until*1000-Date.now()+25);}
}
if(typeof document!=='undefined'){
 refreshLiveBadges();
 new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches('[data-live-product]')||n.querySelector('[data-live-product]')))))refreshLiveBadges();}).observe(document.body,{childList:true,subtree:true});
 setInterval(()=>{if(!document.hidden)refreshLiveBadges();},60000);
 document.addEventListener('visibilitychange',()=>{paintLiveBadges();if(!document.hidden)refreshLiveBadges();});
}
