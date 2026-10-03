export function shopStatus(shop){
 if(!shop)return null;
 const status=shop.moderation_status||'active';
 const states={
  suspended:{tone:'warning',title:'ร้านค้าถูกระงับชั่วคราว',detail:'หน้าร้านไม่เปิดให้ผู้เข้าชม และยังไม่สามารถแก้ไขข้อมูลร้านหรือสินค้าได้ กรุณาติดต่อผู้ดูแลระบบ Mart'},
  banned:{tone:'danger',title:'ร้านค้าถูกแบน',detail:'หน้าร้านไม่เปิดให้ผู้เข้าชม และไม่สามารถแก้ไขข้อมูลร้านหรือสินค้าได้ กรุณาติดต่อผู้ดูแลระบบ Mart'},
  deleted:{tone:'muted',title:'ร้านค้าถูกลบ',detail:'หน้าร้านถูกปิดแล้ว ข้อมูลยังเก็บไว้ในระบบ หากต้องการกู้คืน กรุณาติดต่อผู้ดูแลระบบ Mart'}
 };
 if(states[status])return {...states[status],reason:shop.moderation_reason||'กรุณาติดต่อผู้ดูแลระบบ Mart เพื่อสอบถามเหตุผล',blocked:true};
 if(!shop.published)return {tone:'info',title:'ร้านค้าเป็นฉบับร่าง · ยังไม่เผยแพร่',detail:'ลูกค้ายังเข้าชมหน้าร้านไม่ได้ คุณสามารถตรวจสอบข้อมูลและเปิดเผยแพร่ได้จากเมนูหน้าร้าน',reason:shop.moderation_reason||'',blocked:false};
 return null;
}
export function mountShopStatus(root,shop,onRefresh){
 root.replaceChildren();const status=shopStatus(shop);root.hidden=!status;if(!status)return;
 root.className='shop-status-banner shop-status-'+status.tone;
 root.setAttribute('role','status');root.setAttribute('aria-live','polite');
 const content=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('p');
 title.textContent=status.title+' · '+shop.name;detail.textContent=status.detail;content.append(title,detail);
 if(status.reason){const reason=document.createElement('p');reason.className='shop-status-reason';reason.textContent='เหตุผลจากผู้ดูแล: '+status.reason;content.append(reason);}
 const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='ตรวจสอบสถานะล่าสุด';
 button.onclick=async()=>{button.disabled=true;try{await onRefresh();}finally{button.disabled=false;}};
 root.append(content,button);
}
