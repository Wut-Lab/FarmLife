import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFarm } from '../src/farm-map.js';
import { LOCATIONS } from '../src/locations.js';
import { Villager, spawnVillagers } from '../src/villagers.js';

test('every farm villager fits, Fredrick included', () => assert.equal(spawnVillagers(LOCATIONS.farm.build()).length, 4));

test('a villager walks its square and comes back', () => {
  const v = new Villager({ sheet: 's', x: 2, y: 2, size: 2 });
  for (let i = 0; i < 1000; i++) v.update(0.05, () => false);
  const seen = new Set();
  for (let i = 0; i < 400; i++) { v.update(0.05, () => false); seen.add(`${Math.round(v.x)},${Math.round(v.y)}`); }
  for (const c of v.corners) assert.ok(seen.has(c.join(',')), c);
});

test('a villager waits while blocked', () => {
  const v = new Villager({ sheet: 's', x: 2, y: 2, size: 2 });
  for (let i = 0; i < 100; i++) v.update(0.05, () => true);
  assert.deepEqual([v.x, v.y], [32, 32]);
});
