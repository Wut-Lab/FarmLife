import test from 'node:test';
import assert from 'node:assert/strict';
import { FORAGE, SPREAD, scatterForage, bushAt, pickBush, regrowBushes } from '../src/forage.js';
import { LOCATIONS } from '../src/locations.js';
import { findPath } from '../src/villagers.js';
import { exitRows } from '../src/map-data.js';

test('forage sells for 2 gold each, and berries can be eaten', () => {
  for (const f of Object.values(FORAGE)) assert.equal(f.price, 2);
  assert.ok(FORAGE.berries.energy > 0);
});
let sticks = 0;
test('the wilds get stones, pinecones and sticks by trees, and reachable berry bushes', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const m = LOCATIONS.wilds.build(seed, 'Winter'), f = scatterForage(m, SPREAD.wilds);
    const ids = [...f.values()];
    assert.ok(ids.filter(i => i === 'stone').length >= SPREAD.wilds.stones[0], `seed ${seed} stones`);
    assert.ok(ids.every(i => FORAGE[i]), `seed ${seed} ids`);
    if (seed === 1) sticks = 0;
    sticks += ids.filter(i => i === 'stick').length;
    const reach = new Set(), start = [0, exitRows(m, 'left')[0]];
    findPath(m, start, (x, y) => { reach.add(`${x},${y}`); return false; });
    for (const k of f.keys()) assert.ok(reach.has(k), `seed ${seed}: ${k} out of reach`);
    const bushes = m.objects.filter(o => o.tiles[0][0] === 'berry_bush');
    assert.ok(bushes.length >= 1, `seed ${seed} bushes`);
    if (seed === 20) assert.ok(sticks > 0, 'some sticks');
    for (const o of bushes) { const x = o.x / 16, y = o.y / 16; assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => reach.has(`${x + a},${y + b}`)), `seed ${seed} bush ${x},${y}`); }
  }
});
test('a picked bush is bare until it regrows', () => {
  const m = LOCATIONS.wilds.build(3), o = m.objects.find(o => o.tiles[0][0] === 'berry_bush'), k = `${o.x / 16},${o.y / 16}`;
  assert.equal(bushAt(m, k), o);
  const n = pickBush(o, () => 0.99); assert.equal(n, 3); assert.equal(pickBush(o), 0);
  regrowBushes(m); assert.equal(o.tiles[0][0], 'berry_bush');
});
test('the farm only gets a few at a time', () => {
  const m = LOCATIONS.farm.build();
  for (let i = 0; i < 10; i++) scatterForage(m, SPREAD.farm);
  assert.ok(m.forage.size <= SPREAD.farm.cap);
});
