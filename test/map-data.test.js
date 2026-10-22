import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFarm } from '../src/farm-map.js';
import { PREFABS, blankMap, mapFromData, dataFromMap } from '../src/map-data.js';

test('the farm survives a round trip through editor data', () => {
  const farm = buildFarm(), back = mapFromData(dataFromMap(farm));
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

test('editor overrides make tiles solid or walkable', () => {
  const d = blankMap(4, 4);
  d.objects.push({ name: 'sign', x: 1, y: 1 });
  d.block[0] = 1; d.block[5] = 2;
  const m = mapFromData(d);
  assert.equal(m.solid[0], 1); assert.equal(m.solid[5], 0);
});
