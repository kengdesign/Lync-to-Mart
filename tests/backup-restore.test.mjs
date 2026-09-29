import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,writeFileSync,readFileSync,rmSync,mkdirSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';import {database} from '../scripts/adapter.mjs';
test('isolated restore drill checks full schema, foreign keys, media and snapshot checksums',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'mart-backup-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const dbfile=join(dir,'source.sqlite'),sql=join(dir,'database.sql'),media=join(dir,'media');mkdirSync(media);mkdirSync(join(media,'owner'));
 const db=database(dbfile);await db.prepare("INSERT INTO users VALUES('u','example@test.invalid','fixture-hash','brand')").run();await db.prepare("INSERT INTO shops(id,owner_id,slug,name) VALUES('s','u','test','ทดสอบกู้คืน')").run();await db.prepare("INSERT INTO products(id,shop_id,name,source_url,image_key) VALUES('p','s','สินค้า 🌺','https://thaimart.com/products/test','owner/image.png')").run();await db.prepare("INSERT INTO media VALUES('owner/image.png','u','image/png',4)").run();db.close();writeFileSync(join(media,'owner/image.png'),'test');
 const dump=spawnSync('python3',['-c',"import sqlite3,sys; d=sqlite3.connect(sys.argv[1]); print('\\n'.join(d.iterdump())); d.close()",dbfile],{encoding:'utf8'});assert.equal(dump.status,0);writeFileSync(sql,dump.stdout);
 const run=(extra=[])=>spawnSync('python3',['scripts/verify-backup.py','--sql',sql,'--media',media,...extra],{encoding:'utf8'});
 let r=run();assert.equal(r.status,0,r.stdout+r.stderr);let report=JSON.parse(r.stdout);assert.equal(report.tables.products,1);assert.equal(report.tables.shops,1);assert.equal(report.media_files,1);assert.equal(report.media_bytes,4);assert.doesNotMatch(r.stdout,/fixture-hash|example@test.invalid/);
 const expected=join(dir,'verified.json');writeFileSync(expected,r.stdout);assert.equal(run(['--expected',expected]).status,0);
 writeFileSync(join(media,'owner/image.png'),'xxxx');r=run(['--expected',expected]);assert.equal(r.status,1);assert.match(r.stdout,/media_sha256/);
 rmSync(join(media,'owner/image.png'));r=run();assert.equal(r.status,1);assert.match(r.stdout,/Missing or unsafe media/);writeFileSync(join(media,'owner/image.png'),'test');
 writeFileSync(sql,dump.stdout.replace("'p','s'","'p','missing-shop'"));r=run();assert.equal(r.status,1);assert.match(r.stdout,/Foreign key/);
 writeFileSync(sql,"ATTACH DATABASE '"+join(dir,'forbidden.sqlite')+"' AS other;");r=run();assert.equal(r.status,1);assert.match(r.stdout,/DatabaseError/);
 // The source remains untouched by all verification attempts.
 const inspect=spawnSync('python3',['-c',"import sqlite3,sys; print(sqlite3.connect(sys.argv[1]).execute('select count(*) from products').fetchone()[0])",dbfile],{encoding:'utf8'});assert.equal(inspect.stdout.trim(),'1');
});
