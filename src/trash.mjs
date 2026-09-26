import {duplicateSQL,productIdentity,findDuplicate} from './duplicates.mjs';
const columns=['id','shop_id','name','description','price','source_url','image_key','status','created_at','updated_at','description_html','gallery_json','variants_json','category','checkout_url','featured','import_provenance'];
const snapshotSQL=`json_object(${columns.map(c=>`'${c}',${c}`).join(',')})`;
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status});};
export async function trashProduct(env,id){
 // Snapshot the current database row and remove it in one transaction.
 const results=await env.DB.batch([
  env.DB.prepare(`INSERT INTO product_trash(id,shop_id,snapshot) SELECT id,shop_id,${snapshotSQL} FROM products WHERE id=?`).bind(id),
  env.DB.prepare('DELETE FROM products WHERE id=? AND EXISTS(SELECT 1 FROM product_trash WHERE id=?)').bind(id,id)
 ]);
 if(!results[0].meta.changes)fail('ไม่พบสินค้า หรือสินค้าถูกย้ายเข้าถังขยะแล้ว',404);
}
export async function ownedTrash(env,id,user){
 const row=await env.DB.prepare('SELECT t.* FROM product_trash t JOIN shops s ON s.id=t.shop_id WHERE t.id=? AND s.owner_id=?').bind(id,user.id).first();
 if(!row)fail('ไม่พบสินค้าในถังขยะ',404);return row;
}
export async function restoreProduct(env,row,user,plan){
 const product=JSON.parse(row.snapshot);
 if(await findDuplicate(env,row.shop_id,'',product.source_url))fail('มีสินค้าลิงก์เดียวกันในร้านแล้ว กรุณาจัดการรายการนั้นก่อนกู้คืน');
 const values=columns.map(c=>c==='status'?"'draft'":c==='updated_at'?'CURRENT_TIMESTAMP':c==='import_provenance'?"COALESCE(json_extract(t.snapshot,'$.import_provenance'),'')":`json_extract(t.snapshot,'$.${c}')`);
 const results=await env.DB.batch([
  env.DB.prepare(`INSERT INTO products(${columns.join(',')}) SELECT ${values.join(',')} FROM product_trash t WHERE t.id=? AND t.shop_id=? AND (SELECT COUNT(*) FROM products p JOIN shops s ON s.id=p.shop_id WHERE s.owner_id=?)<? AND NOT EXISTS(${duplicateSQL})`).bind(row.id,row.shop_id,user.id,plan.products,row.shop_id,'',productIdentity(product.source_url)),
  env.DB.prepare('DELETE FROM product_trash WHERE id=? AND EXISTS(SELECT 1 FROM products WHERE id=? AND shop_id=?)').bind(row.id,row.id,row.shop_id)
 ]);
 if(!results[0].meta.changes){if(await findDuplicate(env,row.shop_id,'',product.source_url))fail('มีสินค้าลิงก์เดียวกันในร้านแล้ว กรุณาจัดการรายการนั้นก่อนกู้คืน');fail('กู้คืนไม่ได้ โควตาสินค้าอาจเต็มหรือรายการถูกเปลี่ยนไป กรุณาโหลดใหม่');}
 return {id:row.id,status:'draft'};
}
