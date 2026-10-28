import test from 'node:test';
import assert from 'node:assert/strict';
import {storefront} from '../src/storefront.mjs';
const shop={id:'shop',name:'Shop',slug:'chaba01',description:'Test',plan_id:'starter',showcase_json:'{}'};
test('custom domain root is used in form, canonical, navigation and schema',()=>{const html=storefront(shop,[],'https://customer.example',true,false,new URLSearchParams(),'/');assert.match(html,/action="\/"/);assert.match(html,/rel="canonical" href="https:\/\/customer.example\/"/);assert.doesNotMatch(html,/\/shop\/chaba01/);assert.match(html,/"url":"https:\/\/customer.example\/"/);});
test('ordinary Mart shop paths remain unchanged',()=>{const html=storefront(shop,[],'https://mart.lyncto.link');assert.match(html,/action="\/shop\/chaba01"/);assert.match(html,/https:\/\/mart.lyncto.link\/shop\/chaba01/);});
