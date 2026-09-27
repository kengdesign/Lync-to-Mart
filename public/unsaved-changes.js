export function guardUnsavedChanges({modal,snapshot,pending=false,isBusy=()=>false,confirmDiscard=()=>modal.ownerDocument.defaultView.confirm('มีข้อมูลที่ยังไม่ได้บันทึก ต้องการปิดและทิ้งการแก้ไขหรือไม่?')}){
 const win=modal.ownerDocument.defaultView;let baseline=snapshot(),unconfirmed=pending;
 const dirty=()=>unconfirmed||snapshot()!==baseline;
 const beforeUnload=event=>{if(modal.open&&(isBusy()||dirty())){event.preventDefault();event.returnValue='';}};
 const canClose=()=>!isBusy()&&(!dirty()||confirmDiscard());
 const cancel=event=>{if(!canClose())event.preventDefault();};
 const cleanup=()=>{win.removeEventListener('beforeunload',beforeUnload);modal.removeEventListener('cancel',cancel);modal.removeEventListener('close',cleanup);};
 win.addEventListener('beforeunload',beforeUnload);modal.addEventListener('cancel',cancel);modal.addEventListener('close',cleanup);
 return {canClose,cleanup,markSaved(){baseline=snapshot();unconfirmed=false;}};
}
