import test from 'node:test';
import assert from 'node:assert/strict';
import { Inventory, HOTBAR, LOCKED, BAG } from '../src/inventory.js';

test('items stack in the bag and swap into the hotbar', () => {
  const inv = new Inventory();
  inv.add('carrot'); inv.add('carrot'); inv.add('turnip');
  assert.deepEqual(inv.slots[HOTBAR], { id: 'carrot', n: 2 });
  assert.ok(inv.swap(HOTBAR, LOCKED));
  assert.deepEqual(inv.slots[LOCKED], { id: 'carrot', n: 2 });
  inv.add('carrot');
  assert.equal(inv.count('carrot'), 3);
});

test('the can and seed bag are fixed; the hoe can move', () => {
  const inv = new Inventory();
  assert.equal(inv.swap(0, HOTBAR), false); assert.equal(inv.swap(1, HOTBAR), false);
  assert.equal(inv.slots[0].id, 'can');
  assert.ok(inv.swap(2, HOTBAR)); assert.equal(inv.slots[HOTBAR].id, 'hoe');
});

test('old saves move the can and seed bag to the front', () => {
  const inv = new Inventory();
  inv.load([{ id: 'hoe' }, { id: 'can' }, { id: 'seeds' }, null], 0);
  assert.deepEqual(inv.slots.slice(0, 3).map(s => s.id), ['can', 'seeds', 'hoe']);
  assert.equal(inv.held.id, 'hoe');
});

test('shipping bin slots are separate from the bag and empty overnight', () => {
  const inv = new Inventory();
  inv.add('carrot', 3);
  const bin = inv.slots.length - 1;
  assert.ok(inv.swap(HOTBAR, bin));
  assert.equal(inv.count('carrot'), 0);
  inv.add('carrot');
  assert.equal(inv.slots[HOTBAR].n, 1);
  assert.deepEqual(inv.emptyBin(), [{ id: 'carrot', n: 3 }]);
  assert.equal(inv.slots[bin], null);
});

test('tools stay out of the shipping bin', () => {
  const inv = new Inventory();
  inv.add('shovel'); const at = inv.slots.findIndex(s => s?.id === 'shovel');
  assert.equal(inv.swap(at, HOTBAR + BAG), false);
  inv.add('carrot'); assert.equal(inv.swap(inv.slots.findIndex(s => s?.id === 'carrot'), HOTBAR + BAG), true);
});
