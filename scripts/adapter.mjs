import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function database(path=':memory:'){
 const db=new DatabaseSync(path);db.exec(readFileSync(new URL('../migrations/0001_core.sql',import.meta.url),'utf8'));
 if(!db.prepare("PRAGMA table_info(products)").all().some(c=>c.name==='description_html'))db.exec(readFileSync(new URL('../migrations/0002_product_content.sql',import.meta.url),'utf8'));
 if(!db.prepare("PRAGMA table_info(shops)").all().some(c=>c.name==='logo_key'))db.exec(readFileSync(new URL('../migrations/0003_shop_presentation.sql',import.meta.url),'utf8'));
 if(!db.prepare("PRAGMA table_info(shops)").all().some(c=>c.name==='cover_position_y'))db.exec(readFileSync(new URL('../migrations/0004_cover_position.sql',import.meta.url),'utf8'));
 if(!db.prepare("PRAGMA table_info(products)").all().some(c=>c.name==='checkout_url'))db.exec(readFileSync(new URL('../migrations/0005_checkout_url.sql',import.meta.url),'utf8'));
 if(!db.prepare("PRAGMA table_info(products)").all().some(c=>c.name==='featured'))db.exec(readFileSync(new URL('../migrations/0006_featured_products.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migrations/0007_product_trash.sql',import.meta.url),'utf8'));
 if(!db.prepare("PRAGMA table_info(products)").all().some(c=>c.name==='import_provenance'))db.exec(readFileSync(new URL('../migrations/0008_import_provenance.sql',import.meta.url),'utf8'));
 if(!db.prepare("PRAGMA table_info(shops)").all().some(c=>c.name==='theme'))db.exec(readFileSync(new URL('../migrations/0009_shop_theme.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migrations/0010_password_resets.sql',import.meta.url),'utf8'));
 if(!db.prepare("PRAGMA table_info(shops)").all().some(c=>c.name==='showcase_json'))db.exec(readFileSync(new URL('../migrations/0011_shop_showcase.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migrations/0012_admin_roles.sql',import.meta.url),'utf8'));
 if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_swaps'").get())db.exec(readFileSync(new URL('../migrations/0013_admin_swap.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migrations/0014_registration.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migrations/0015_admin_audit_index.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migrations/0016_member_controls.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migrations/0017_billing.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migrations/0018_billing_upgrades.sql',import.meta.url),'utf8'));
 if(!db.prepare("PRAGMA table_info(billing_upgrades)").all().some(c=>c.name==='pricing_mode'))db.exec(readFileSync(new URL('../migrations/0019_upgrade_policy.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migrations/0020_billing_downgrades.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migrations/0021_billing_cards.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migrations/0022_shop_team.sql',import.meta.url),'utf8'));
 if(!db.prepare("PRAGMA table_info(shops)").all().some(c=>c.name==='moderation_status'))db.exec(readFileSync(new URL('../migrations/0023_shop_controls.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migrations/0024_live_status.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migrations/0025_product_destinations.sql',import.meta.url),'utf8'));
 const wrap=(sql,args=[])=>({bind(...values){return wrap(sql,values);},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}});
 return {prepare:sql=>wrap(sql),async batch(statements){db.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());db.exec('COMMIT');return results;}catch(err){db.exec('ROLLBACK');throw err;}},close(){db.close();}};
}

