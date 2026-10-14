export function mountSellerStock({root,api}){
 if(!root)return ()=>{};
 let stopped=false,pending=false;const states=new Map();
 const badges=()=>[...root.querySelectorAll('[data-seller-stock]')];
 const paint=()=>{for(const el of badges()){const s=states.get(el.dataset.sellerStock);el.hidden=!(s?.sold_out===true&&s.valid_until*1000>Date.now());}};
 async function refresh(){
  if(stopped||!root.isConnected){cleanup();return;}paint();if(document.hidden||pending)return;
  const ids=badges().map(b=>b.dataset.sellerStock).filter(id=>(states.get(id)?.retry_at||0)<=Date.now());if(!ids.length)return;
  pending=true;
  try{for(let i=0;i<ids.length&&!stopped&&root.isConnected;i+=12){
   const batch=ids.slice(i,i+12);for(const id of batch)states.set(id,{retry_at:Date.now()+60000});
   try{const data=await api('/stock-status?ids='+encodeURIComponent(batch.join(',')),{signal:AbortSignal.timeout(12000)});if(stopped||!root.isConnected)return;
    for(const id of batch){const s=data.products?.[id];if(typeof s?.sold_out==='boolean'&&Number.isFinite(s.valid_until))states.set(id,{...s,retry_at:Math.max(Date.now()+60000,s.valid_until*1000)});}
   }catch{}paint();
  }}finally{pending=false;}
 }
 const timer=setInterval(refresh,15000);
 function cleanup(){stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);}
 document.addEventListener('visibilitychange',refresh);refresh();return cleanup;
}
