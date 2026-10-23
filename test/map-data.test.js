import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCATIONS } from '../src/locations.js';
import { PREFABS, BLOB, blobTile, blankMap, mapFromData, dataFromMap } from '../src/map-data.js';

test('the farm survives a round trip through editor data', () => {
  const farm = LOCATIONS.farm.build(), back = mapFromData(dataFromMap(farm));
  assert.deepEqual(back.ground, farm.ground);
  assert.deepEqual([...back.solid], [...farm.solid]);
  assert.deepEqual(back.plots.sort(), farm.plots.slice().sort());
  assert.equal(back.door, farm.door); assert.equal(back.shop, farm.shop); assert.deepEqual(back.bin, farm.bin);
  assert.deepEqual(back.spawn, farm.spawn);
});

test('prefabs know their size and blocking rows', () => {
  assert.deepEqual([PREFABS.oak.w, PREFABS.oak.h, PREFABS.oak.solid], [2, 2, 1]);
  assert.deepEqual(PREFABS.house.tiles[2], ['house_6', 'house_7', 'house_8']);
  assert.equal(PREFABS.mushrooms.solid, 0);
  assert.equal(PREFABS.carrot0, undefined);
});

test('the store blocks three rows, but its open patio only along the deck', () => {
  const d = blankMap(8, 6); d.objects.push({ name: 'store', x: 0, y: 0 });
  const m = mapFromData(d), at = (x, y) => m.solid[y * 8 + x];
  assert.deepEqual([at(3, 0), at(3, 1), at(3, 3)], [0, 1, 1]);
  assert.deepEqual([at(4, 2), at(5, 2), at(4, 3), at(5, 3)], [0, 0, 1, 1]);
});

test('editor overrides make tiles solid or walkable', () => {
  const d = blankMap(4, 4);
  d.objects.push({ name: 'sign', x: 1, y: 1 });
  d.block[0] = 1; d.block[5] = 2;
  const m = mapFromData(d);
  assert.equal(m.solid[0], 1); assert.equal(m.solid[5], 0);
});

test('blob autotiles: 47 pieces, deep water blocks', () => {
  assert.equal(BLOB.length, 47);
  assert.equal(blobTile('shallow', 255), 'shallow46');
  assert.equal(blobTile('shallow', 1 | 2 | 16 | 32), blobTile('shallow', 1 | 2 | 16)); // SE ignored without S
  const d = blankMap(3, 3); d.ground[4] = 'deep46'; d.ground[0] = 'shallow46';
  const m = mapFromData(d);
  assert.equal(m.solid[4], 1); assert.equal(m.solid[0], 0);
});

test('locations keep their exits and villagers through the editor, and every exit has a road', async () => {
  const { LOCATIONS } = await import('../src/locations.js');
  const { exitRows } = await import('../src/map-data.js');
  for (const l of Object.values(LOCATIONS)) {
    const m = l.build(), back = mapFromData(dataFromMap(m));
    assert.deepEqual(back.exits, m.exits); assert.deepEqual(back.npcs, m.npcs ?? []);
    for (const side of Object.keys(m.exits)) assert.ok(exitRows(m, side).length, `${l.name} ${side}`);
  }
});

test('the general store has a door like the shop, and vehicles just block like houses', () => {
  const d = blankMap(20, 20);
  d.objects.push({ name: 'store', x: 2, y: 2 }, { name: 'pickup', x: 10, y: 2 });
  const m = mapFromData(d);
  assert.equal(m.store, '4,5'); assert.equal(m.door, null);
  assert.equal(m.solid[3 * 20 + 10], 1); assert.equal(m.solid[2 * 20 + 10], 0); // pickup: bottom row solid, roof walk-behind
});

test('the wilds: town-sized, joined to the town road, all reachable, different each seed', async () => {
  const { LOCATIONS } = await import('../src/locations.js');
  const { exitRows } = await import('../src/map-data.js');
  const { findPath } = await import('../src/villagers.js');
  const town = LOCATIONS.town.build(), seen = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const m = LOCATIONS.wilds.build(seed, ['Spring', 'Summer', 'Fall', 'Winter'][seed % 4]), rows = exitRows(m, 'left');
    assert.equal(m.W, town.W); assert.equal(m.H, town.H);
    for (const r of exitRows(town, 'right').filter(r => town.ground[r * town.W + town.W - 1].startsWith('cobble'))) assert.ok(rows.includes(r), `seed ${seed} row ${r}`);
    const reach = new Set();
    findPath(m, [0, rows[0]], (x, y) => { reach.add(y * m.W + x); return false; });
    for (let i = 0; i < m.W * m.H; i++) if (!m.solid[i]) assert.ok(reach.has(i) || i === rows[0] * m.W, `seed ${seed} tile ${i % m.W},${Math.floor(i / m.W)} shut in`);
    seen.add(m.ground.join() + m.objects.length);
  }
  assert.equal(seen.size, 40);
});

test('the road has a locked gate at the foot of a path down its right side', async () => {
  const { LOCATIONS } = await import('../src/locations.js');
  const { GATES } = await import('../src/unlocks.js');
  const m = LOCATIONS.road.build();
  assert.deepEqual(m.gates, ['38,27', '38,28']);
  assert.ok(m.solid[28 * m.W + 38] && m.solid[27 * m.W + 38]);
  for (let y = 18; y < m.H; y++) assert.ok(m.ground[y * m.W + 38].startsWith('path'), `row ${y}`);
  assert.deepEqual(exitRowsOf(m), [15, 16, 17]); // the new path doesn't make a new exit
  assert.equal(GATES.road.locked, 'Under Construction'); assert.equal(GATES.road.open({ quests: { isOpen: () => false } }), false);
});
const exitRowsOf = m => [...Array(m.H).keys()].filter(y => /^(path|cobble)/.test(m.ground[y * m.W + m.W - 1]));

test('the road leads down to the area behind the gate, and back up', async () => {
  const { LOCATIONS } = await import('../src/locations.js');
  const { exitRows } = await import('../src/map-data.js');
  const road = LOCATIONS.road.build(), south = LOCATIONS.south.build();
  assert.equal(road.exits.down, 'south'); assert.equal(south.exits.up, 'road');
  assert.deepEqual(exitRows(road, 'down'), [38]); assert.deepEqual(exitRows(south, 'up'), [37, 38]);
  assert.equal([south.W, south.H].join(), '40,30');
});
