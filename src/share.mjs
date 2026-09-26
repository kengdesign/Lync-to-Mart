import qrcode from 'qrcode-generator';
export function shopShare(shop,origin){
 const url=new URL('/shop/'+encodeURIComponent(shop.slug),origin).href;
 const qr=qrcode(0,'M');qr.addData(url,'Byte');qr.make();
 const size=qr.getModuleCount();
 return {url,published:!!shop.published,svg:qr.createSvgTag({cellSize:8,margin:32}),modules:Array.from({length:size},(_,y)=>Array.from({length:size},(_,x)=>qr.isDark(y,x)))};
}
