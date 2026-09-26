let controller,sequence=0,timer;
async function navigate(target,{historyMode='push',focusSearch=false,scroll=false}={}){
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
  for(const selector of ['link[rel="canonical"]','meta[name="robots"]','meta[property="og:url"]','script[type="application/ld+json"]']){const old=document.querySelector(selector),fresh=doc.querySelector(selector);if(old&&fresh)old.replaceWith(fresh);}
  if(historyMode==='push')history.pushState(null,'',target);
  if(focusSearch){const field=next.querySelector('#catalog-search');field.focus({preventScroll:true});try{field.setSelectionRange(selection,selection);}catch{}}
  else if(scroll){next.focus({preventScroll:true});next.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 }catch(error){if(error.name==='AbortError'||request!==sequence)return;const box=document.querySelector('#catalog-error');box.textContent=error.message+' ';const retry=document.createElement('a');retry.href=target;retry.textContent='เปิดรายการนี้อีกครั้ง';box.append(retry);}
 finally{if(request===sequence)document.querySelector('#catalog-region')?.removeAttribute('aria-busy');}
}
function searchURL(form){const url=new URL(form.action,location.origin);for(const [key,value] of new FormData(form)){if(value.trim())url.searchParams.set(key,value.trim());}return url.pathname+url.search;}
document.addEventListener('click',event=>{const link=event.target.closest('a[data-catalog-link]');if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();navigate(link.href,{scroll:true});});
document.addEventListener('submit',event=>{if(!event.target.matches('.catalog-tools'))return;event.preventDefault();navigate(searchURL(event.target),{focusSearch:true});});
document.addEventListener('input',event=>{if(event.target.id!=='catalog-search')return;clearTimeout(timer);controller?.abort();sequence++;document.querySelector('#catalog-region')?.removeAttribute('aria-busy');timer=setTimeout(()=>navigate(searchURL(event.target.form),{focusSearch:true}),450);});
document.addEventListener('change',event=>{if(event.target.id==='catalog-category')navigate(searchURL(event.target.form),{scroll:true});});
document.addEventListener('toggle',event=>{if(!event.target.matches('.product-card details'))return;const card=event.target.closest('.product-card');card.classList.toggle('expanded',!!card.querySelector('details[open]'));},true);
window.addEventListener('popstate',()=>navigate(location.href,{historyMode:'none',scroll:true}));
