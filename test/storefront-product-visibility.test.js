import test from 'node:test';
import assert from 'node:assert/strict';
import { isStorefrontProductVisible } from '../storefront-product-visibility.js';

test('hides the Moonlight Mushroom kiss-cut sticker from storefront listings', () => {
  assert.equal(isStorefrontProductVisible({
    id: '6aa32cd5f4fa63b37c005985',
    title: 'Kiss-Cut Stickers',
    visible: true
  }), false);
});

test('continues to hide generic sticker sheets', () => {
  assert.equal(isStorefrontProductVisible({ id: 'sheet-1', title: 'Sticker Sheets', visible: true }), false);
});

test('keeps ordinary visible merchandise in storefront listings', () => {
  assert.equal(isStorefrontProductVisible({ id: 'tank-1', title: 'Moonlight Flower Tank', visible: true }), true);
});


test('hides products unless Printify explicitly reports them visible', () => {
  for (const visible of [false, undefined, null, 'true', 1]) {
    assert.equal(isStorefrontProductVisible({id:'draft',title:'Draft product',visible}),false);
  }
});

test('keeps the unpublished Moo Crew Tote hidden despite the API visible flag', () => {
  assert.equal(isStorefrontProductVisible({id:'6ac4552d287cd44de30125be',title:'Moo Crew Tote',visible:true}),false);
});
