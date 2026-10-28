import test from 'node:test';
import assert from 'node:assert/strict';
import {validateIsolation} from '../scripts/domain-isolation-preflight.mjs';
const valid=()=>({providerZone:'example.net',providerZoneId:'a'.repeat(32),cnameTarget:'shops.example.net',fallbackOrigin:'fallback.example.net',testHostname:'thaimart.logintimate.com',gatewayWorker:'lync-to-mart-domain-gateway-staging',maxHostnames:1,availableCapacity:1});
test('isolated provider accepts external customer test subdomain',()=>assert.deepEqual(validateIsolation(valid()),[]));
test('existing zones and delegated-looking subdomains are prohibited',()=>{
 for(const zone of ['lyncto.link','mart.lyncto.link','logintimate.com','thaimart.logintimate.com']) assert.ok(validateIsolation({...valid(),providerZone:zone}).length);
});
test('existing workers and targets are prohibited',()=>{
 assert.ok(validateIsolation({...valid(),gatewayWorker:'lyncto-redirect-worker'}).length);
 assert.ok(validateIsolation({...valid(),fallbackOrigin:'fallback.lyncto.link'}).length);
 assert.ok(validateIsolation({...valid(),cnameTarget:'custom.lyncto.link'}).length);
});
test('missing or insufficient budget capacity blocks setup',()=>{
 for(const patch of [{maxHostnames:0},{maxHostnames:2},{availableCapacity:undefined},{providerZoneId:''}]) assert.ok(validateIsolation({...valid(),...patch}).length);
});
