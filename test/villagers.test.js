import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFarm } from '../src/farm-map.js';
import { LOCATIONS } from '../src/locations.js';
import { Villager, spawnVillagers, fits, planRoute } from '../src/villagers.js';
import { SCHEDULES, activity } from '../src/schedule.js';

test('every farm villager fits', () => assert.equal(spawnVillagers(LOCATIONS.farm.build()).length, 3));
test('Fredrick fits in town', () => assert.ok(spawnVillagers(LOCATIONS.town.build()).some(v => v.role === 'shop')));

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

test('schedules: the latest rule wins, a day-specific rule beats a plain one, and everyone sleeps at 9pm', () => {
  const pip = SCHEDULES.villager_child;
  assert.equal(activity(pip, 5, 'Mon', 'Spring').act, 'sleep');
  assert.equal(activity(pip, 11, 'Mon', 'Spring').map, 'farm');
  assert.equal(activity(pip, 11, 'Sat', 'Spring').map, 'town');
  assert.equal(activity(SCHEDULES.shopkeeper, 13, 'Mon', 'Fall').x, 13);
  for (const rules of Object.values(SCHEDULES)) assert.equal(activity(rules, 21, 'Sun', 'Winter').act, 'sleep');
});

test('every scheduled spot is walkable', () => {
  for (const rules of Object.values(SCHEDULES)) for (const r of rules)
    if (r.act === 'move') assert.ok(fits(LOCATIONS[r.map].build(), r), JSON.stringify(r));
});

test('every scheduled move can be walked to from any other', () => {
  const maps = Object.fromEntries(Object.entries(LOCATIONS).map(([id, l]) => [id, l.build()]));
  const spots = Object.values(SCHEDULES).flat().filter(r => r.act === 'move');
  for (const a of spots) for (const b of spots) assert.ok(planRoute(maps, a.map, [a.x, a.y], b.map, [b.x, b.y]), `${a.map} ${a.x},${a.y} -> ${b.map} ${b.x},${b.y}`);
});

test('a villager walks a route and settles at the end', () => {
  const v = new Villager({ sheet: 's', x: 0, y: 0, size: 0 });
  v.go([{ map: 'm', from: null, path: [[0, 0], [16, 0], [16, 16]] }], { x: 1, y: 1, size: 1 });
  for (let i = 0; i < 200 && v.legs; i++) v.update(0.05, () => false);
  assert.equal(v.legs, null); assert.deepEqual([v.x, v.y, v.still], [16, 16, false]);
});
