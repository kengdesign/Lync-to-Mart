import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createCatalogViews} from '../public/catalog-view.js';
test('restores filters and page by shop, discards removed categories and clears on login',()=>{
 const dom=new JSDOM('<input id="search"><select id="category-filter"><option value="all">All</option><option value="flowers">Flowers</option></select>');
 const root=dom.window.document,views=createCatalogViews();root.querySelector('input').value='กุหลาบ';root.querySelector('select').value='flowers';views.save('one',root,3);
 root.querySelector('input').value='';root.querySelector('select').value='all';assert.equal(views.restore('two',root),1);assert.equal(root.querySelector('input').value,'');
 assert.equal(views.restore('one',root),3);assert.equal(root.querySelector('input').value,'กุหลาบ');assert.equal(root.querySelector('select').value,'flowers');
 root.querySelector('option[value="flowers"]').remove();assert.equal(views.restore('one',root),3);assert.equal(root.querySelector('select').value,'all');
 views.clear();assert.equal(views.restore('one',root),1);dom.window.close();
});
