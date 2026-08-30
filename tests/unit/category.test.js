import { test } from 'node:test';
import assert from 'node:assert/strict';
import { subtreeIdsFrom } from '../../src/controllers/category.controller.js';

// Tree:  X ─┬─ Y
//            └─ Z ── Z1
const CATS = [
  { id: 'X', parentId: null },
  { id: 'Y', parentId: 'X' },
  { id: 'Z', parentId: 'X' },
  { id: 'Z1', parentId: 'Z' },
  { id: 'W', parentId: null }, // unrelated root
];

test('category subtree walk', async (t) => {
  await t.test('parent rolls up all descendants (any depth)', () => {
    assert.deepEqual(subtreeIdsFrom('X', CATS).sort(), ['X', 'Y', 'Z', 'Z1']);
  });

  await t.test('child returns only itself + its own descendants', () => {
    assert.deepEqual(subtreeIdsFrom('Z', CATS).sort(), ['Z', 'Z1']);
  });

  await t.test('leaf returns only itself', () => {
    assert.deepEqual(subtreeIdsFrom('Y', CATS), ['Y']);
  });

  await t.test('unknown id returns null (→ empty result, not all)', () => {
    assert.equal(subtreeIdsFrom('nope', CATS), null);
  });

  await t.test('cycle-safe (does not loop forever)', () => {
    const cyclic = [
      { id: 'A', parentId: 'B' },
      { id: 'B', parentId: 'A' },
    ];
    assert.deepEqual(subtreeIdsFrom('A', cyclic).sort(), ['A', 'B']);
  });
});
