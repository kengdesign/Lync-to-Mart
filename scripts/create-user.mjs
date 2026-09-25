import {passwordHash} from '../src/security.mjs';
import {writeFile} from 'node:fs/promises';
const email=process.env.MART_USER_EMAIL?.trim().toLowerCase(),password=process.env.MART_USER_PASSWORD;
if(!email||!email.includes('@')||!password||password.length<12){console.error('Set MART_USER_EMAIL and MART_USER_PASSWORD (at least 12 characters) in your local terminal.');process.exit(1);}
const quote=x=>"'"+x.replaceAll("'","''")+"'";
const sql=`INSERT INTO users(id,email,password) VALUES(${quote(crypto.randomUUID())},${quote(email)},${quote(await passwordHash(password))});\n`;
await writeFile('.user-bootstrap.sql',sql,{mode:0o600});console.log('Created .user-bootstrap.sql. Apply to the intended staging database, then remove this file.');
