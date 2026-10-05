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
