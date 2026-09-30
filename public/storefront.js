import {connectProductLightbox} from './product-lightbox.js?v=1';
connectProductLightbox();
let controller,sequence=0,timer,composing=false,searchHistory=false;
async function navigate(target,{historyMode='push',focusSearch=false,scroll=false}={}){
 if(!focusSearch)searchHistory=false;
 clearTimeout(timer);controller?.abort();controller=new AbortController();const request=++sequence;
 const root=document.querySelector('#catalog-region');if(!root)return;
 root.setAttribute('aria-busy','true');document.querySelector('#catalog-error').textContent='';
 const input=root.querySelector('#catalog-search'),selection=input.selectionStart;
 try{
  const response=await fetch(target,{signal:controller.signal,headers:{Accept:'text/html'}});if(!response.ok)throw new Error('เปิดรายการไม่สำเร็จ กรุณาลองอีกครั้ง');
  const doc=new DOMParser().parseFromString(await response.text(),'text/html'),next=doc.querySelector('#catalog-region');
  if(!next)throw new Error('เปิดรายการไม่สำเร็จ กรุณารีเฟรชหน้าและเข้าสู่ระบบอีกครั้ง');
  if(request!==sequence)return;
  root.replaceWith(next);
  connectRails();
  for(const selector of ['link[rel="canonical"]','meta[name="robots"]','meta[property="og:url"]','script[type="application/ld+json"]']){const old=document.querySelector(selector),fresh=doc.querySelector(selector);if(old&&fresh)old.replaceWith(fresh);}
  if(historyMode==='search'){history[searchHistory?'replaceState':'pushState'](null,'',target);searchHistory=true;}
  else if(historyMode==='push'&&new URL(target,location.href).href!==location.href)history.pushState(null,'',target);
  if(focusSearch){const field=next.querySelector('#catalog-search');field.focus({preventScroll:true});try{field.setSelectionRange(selection,selection);}catch{}}
  else if(scroll){next.focus({preventScroll:true});next.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 }catch(error){if(error.name==='AbortError'||request!==sequence)return;const box=document.querySelector('#catalog-error');box.textContent=error.message+' ';const retry=document.createElement('a');retry.href=target;retry.textContent='เปิดรายการนี้อีกครั้ง';box.append(retry);}
 finally{if(request===sequence)document.querySelector('#catalog-region')?.removeAttribute('aria-busy');}
}
function searchURL(form){const url=new URL(form.action,location.origin);for(const [key,value] of new FormData(form)){if(value.trim())url.searchParams.set(key,value.trim());}return url.pathname+url.search;}
document.addEventListener('click',event=>{const link=event.target.closest('a[data-catalog-link]');if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();navigate(link.href,{scroll:true});});
document.addEventListener('submit',event=>{if(!event.target.matches('.catalog-tools'))return;event.preventDefault();if(composing)return;navigate(searchURL(event.target),{focusSearch:true,historyMode:'search'});});
function cancelSearch(){clearTimeout(timer);controller?.abort();sequence++;document.querySelector('#catalog-region')?.removeAttribute('aria-busy');}
function scheduleSearch(field){cancelSearch();timer=setTimeout(()=>navigate(searchURL(field.form),{focusSearch:true,historyMode:'search'}),450);}
document.addEventListener('compositionstart',event=>{if(event.target.id!=='catalog-search')return;composing=true;cancelSearch();});
document.addEventListener('compositionend',event=>{if(event.target.id!=='catalog-search')return;composing=false;scheduleSearch(event.target);});
document.addEventListener('input',event=>{if(event.target.id!=='catalog-search')return;if(composing||event.isComposing){cancelSearch();return;}scheduleSearch(event.target);});
document.addEventListener('change',event=>{if(['catalog-category','catalog-sort'].includes(event.target.id))navigate(searchURL(event.target.form),{scroll:true});});
document.addEventListener('toggle',event=>{if(!event.target.matches('.product-card details'))return;const card=event.target.closest('.product-card');card.classList.toggle('expanded',!!card.querySelector('details[open]'));},true);
window.addEventListener('popstate',()=>navigate(location.href,{historyMode:'none',scroll:true}));

document.addEventListener('click',event=>{const button=event.target.closest('[data-rail]');if(!button||button.disabled)return;const rail=document.getElementById(button.dataset.rail);rail?.scrollBy({left:Number(button.dataset.direction)*rail.clientWidth*.8,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});

// Reconnect after catalog navigation; a single observer releases removed rails.
const railObserver=typeof ResizeObserver==='function'?new ResizeObserver(updateRailButtons):null;
function updateRailButtons(){
 for(const button of document.querySelectorAll('[data-rail]')){
  const rail=document.getElementById(button.dataset.rail);
  button.disabled=!rail||(Number(button.dataset.direction)<0?rail.scrollLeft<=1:rail.scrollLeft>=rail.scrollWidth-rail.clientWidth-1);
 }
}
function connectRails(){
 railObserver?.disconnect();
 const ids=new Set([...document.querySelectorAll('[data-rail]')].map(button=>button.dataset.rail));
 for(const id of ids){const rail=document.getElementById(id);if(rail)railObserver?.observe(rail);}
 updateRailButtons();
}
let railFrame;
document.addEventListener('scroll',event=>{
 if(!event.target.matches?.('.showcase-rail'))return;
 cancelAnimationFrame(railFrame);railFrame=requestAnimationFrame(updateRailButtons);
},true);
window.addEventListener('resize',updateRailButtons);
connectRails();
