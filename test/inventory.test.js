import test from 'node:test';
import assert from 'node:assert/strict';
import { Inventory, HOTBAR, LOCKED } from '../src/inventory.js';

test('items stack in the bag and swap into the hotbar', () => {
  const inv = new Inventory();
  inv.add('carrot'); inv.add('carrot'); inv.add('turnip');
  assert.deepEqual(inv.slots[HOTBAR], { id: 'carrot', n: 2 });
  assert.ok(inv.swap(HOTBAR, LOCKED));
  assert.deepEqual(inv.slots[LOCKED], { id: 'carrot', n: 2 });
  inv.add('carrot');
  assert.equal(inv.count('carrot'), 3);
});

test('tool slots cannot be swapped', () => {
  const inv = new Inventory();
  assert.equal(inv.swap(0, HOTBAR), false);
  assert.equal(inv.slots[0].id, 'hoe');
});
