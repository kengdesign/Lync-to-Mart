import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function database(path=':memory:'){
 const db=new DatabaseSync(path);db.exec(readFileSync(new URL('../migrations/0001_core.sql',import.meta.url),'utf8'));
 const wrap=(sql,args=[])=>({bind(...values){return wrap(sql,values);},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}});
 return {prepare:sql=>wrap(sql),async batch(statements){db.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());db.exec('COMMIT');return results;}catch(err){db.exec('ROLLBACK');throw err;}},close(){db.close();}};
}
