import test from 'node:test';
import assert from 'node:assert/strict';
import { availableCollectionIds } from '../collection-availability.js';

const candidates = ['crops', 'tanks', 'tees', 'hoodies', 'pants', 'dark hippie', 'fall'];

test('returns only collections that contain a catalog product', () => {
  const products = [
    { id: 'crop-1', title: 'Festival Crop Tank', tags: ['Crop'] },
    { id: 'tank-1', title: 'Racerback Tank', tags: ['Tank Tops'] },
    { id: 'sticker-1', title: 'Kiss-Cut Stickers', tags: ['Stickers'] }
  ];
  const assignments = [
    { productId: 'crop-1', collections: ['crops'] },
    { productId: 'tank-1', collections: ['tanks'] },
    { productId: 'sticker-1', collections: ['dark hippie'] }
  ];
  assert.deepEqual(availableCollectionIds(products, assignments, candidates).sort(), ['crops', 'dark hippie', 'tanks']);
});

test('an empty manual assignment does not fall back to automatic tags', () => {
  const products = [{ id: 'tee-1', title: 'Statement Tee', tags: ['T-shirts'] }];
  assert.deepEqual(availableCollectionIds(products, [{ productId: 'tee-1', collections: [] }], candidates), []);
});

test('an unassigned product does not make a collection visible from tags alone', () => {
  const products = [{ id: 'hoodie-1', title: 'Fleece Hoodie', tags: ['Sweatshirt'] }];
  assert.deepEqual(availableCollectionIds(products, [], candidates), []);
});

test('ignores assignments for products that are no longer in the storefront catalog', () => {
  const assignments = [{ productId: 'deleted-product', collections: ['hoodies'] }];
  assert.deepEqual(availableCollectionIds([], assignments, candidates), []);
});
