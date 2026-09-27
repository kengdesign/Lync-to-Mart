export function guardStoreForm({form,isBusy,notify,confirmDiscard=()=>form.ownerDocument.defaultView.confirm('ข้อมูลหน้าร้านยังไม่ได้บันทึก ต้องการออกและทิ้งการแก้ไขหรือไม่?')}){
 const win=form.ownerDocument.defaultView;
 const snapshot=()=>JSON.stringify([...form.querySelectorAll('input[name]:not([type=file]),textarea[name],select[name]')].map(el=>[el.name,el.type==='checkbox'?el.checked:el.value]));
 let baseline=snapshot();const dirty=()=>snapshot()!==baseline;
 const unload=event=>{if(form.isConnected&&(isBusy()||dirty())){event.preventDefault();event.returnValue='';}};
 win.addEventListener('beforeunload',unload);
 return {canLeave(){if(!form.isConnected)return true;if(isBusy()){notify('กรุณารอให้อัปโหลดหรือบันทึกเสร็จก่อน');return false;}return !dirty()||confirmDiscard();},markSaved(){baseline=snapshot();},cleanup(){win.removeEventListener('beforeunload',unload);}};
}
