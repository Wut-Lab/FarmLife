import test from 'node:test';
import assert from 'node:assert/strict';
import { storeOpen } from '../src/store.js';

test('the general store is open 8 AM to 8 PM', () => {
  assert.deepEqual([7 * 60 + 50, 8 * 60, 19 * 60 + 50, 20 * 60].map(storeOpen), [false, true, true, false]);
});

import { digFind, scatterDigs } from '../src/dig.js';
import { LOCATIONS } from '../src/locations.js';

test('loose earth turns up on open grass, and digging finds things', () => {
  const m = LOCATIONS.farm.build(), spots = scatterDigs(m, 5);
  assert.equal(spots.size, 5);
  for (const k of spots) { const [x, y] = k.split(',').map(Number); assert.ok(!m.solid[y * m.W + x] && m.ground[y * m.W + x].startsWith('grass')); }
  const kinds = new Set(Array.from({ length: 200 }, () => Object.keys(digFind())[0] ?? 'nothing'));
  assert.deepEqual([...kinds].sort(), ['gold', 'item', 'nothing', 'plant', 'seeds']);
});
