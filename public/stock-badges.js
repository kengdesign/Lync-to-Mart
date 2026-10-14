const states=new Map();let pending=false,timer;
export function paintStockBadges(root=document,now=Date.now()){
 for(const badge of root.querySelectorAll('[data-stock-product]')){
  const state=states.get(badge.dataset.stockProduct);
  badge.hidden=!(state?.sold_out===true&&state.valid_until*1000>now);
 }
}
export async function refreshStockBadges(){
 paintStockBadges();if(document.hidden||pending)return;
 const ids=[...new Set([...document.querySelectorAll('[data-stock-product]')].map(b=>b.dataset.stockProduct))].filter(id=>(states.get(id)?.retry_at||0)<=Date.now());
 if(!ids.length)return;pending=true;
 try{
  for(let i=0;i<ids.length;i+=12){
   const batch=ids.slice(i,i+12);for(const id of batch)states.set(id,{retry_at:Date.now()+60000});
   try{
    const r=await fetch('/api/public/stock-status?ids='+encodeURIComponent(batch.join(',')),{signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error();
    const data=await r.json();for(const id of batch){const s=data.products?.[id];if(typeof s?.sold_out==='boolean'&&Number.isFinite(s.valid_until))states.set(id,{...s,retry_at:Math.max(Date.now()+60000,s.valid_until*1000)});}
   }catch{} // Unknown is never shown as out of stock.
   paintStockBadges();
  }
 }finally{pending=false;queueMicrotask(refreshStockBadges);clearTimeout(timer);const valid=[...states.values()].map(s=>s.valid_until*1000).filter(t=>t>Date.now());if(valid.length)timer=setTimeout(()=>{paintStockBadges();refreshStockBadges();},Math.min(...valid)-Date.now()+25);}
}
if(typeof document!=='undefined'){
 refreshStockBadges();
 new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches('[data-stock-product]')||n.querySelector('[data-stock-product]')))))refreshStockBadges();}).observe(document.body,{childList:true,subtree:true});
 setInterval(()=>{if(!document.hidden)refreshStockBadges();},60000);
 document.addEventListener('visibilitychange',()=>{paintStockBadges();if(!document.hidden)refreshStockBadges();});
}
