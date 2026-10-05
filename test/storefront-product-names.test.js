import test from 'node:test';
import assert from 'node:assert/strict';
import { storefrontProductTitle } from '../storefront-product-names.js';

test('gives each weekender design a distinct customer-facing name', () => {
  const ids = [
    '6aaaf4f3332b26efaf03e20a',
    '6aaaf4220cca3e76890b9658',
    '6aaaf1499fd6d9606f09cbac',
    '6aaaf0be5939e03c7c049fb5'
  ];
  const names = ids.map(id => storefrontProductTitle({ id, title: 'Weekender Bag' }));
  assert.equal(new Set(names).size, 4);
  assert.equal(names.every(name => name.endsWith('Weekender Bag')), true);
});

test('keeps the Printify title when no storefront default exists', () => {
  assert.equal(storefrontProductTitle({ id: 'other', title: 'Moonlight Flower Tank' }), 'Moonlight Flower Tank');
});
