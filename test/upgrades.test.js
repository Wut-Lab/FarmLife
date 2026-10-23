import test from 'node:test';
import assert from 'node:assert/strict';
import { UPGRADES, MAX_LEVEL, area, costText, toolIcon, toolName } from '../src/upgrades.js';
import { digFind } from '../src/dig.js';
import { A } from '../src/art-index.js';

test('every tool has 3 levels, with icons for each', () => {
  for (const [tool, u] of Object.entries(UPGRADES)) {
    assert.equal(u.about.length, MAX_LEVEL); assert.equal(u.cost.length, MAX_LEVEL);
    for (let lv = 1; lv <= MAX_LEVEL; lv++) assert.ok(A[toolIcon(tool, lv)] !== undefined, `${tool} ${lv}`);
  }
  assert.equal(toolName('can', 2), 'Copper Watering Can'); assert.equal(toolName('hoe', 3), 'Gold Hoe');
  assert.equal(costText({ gold: 800, stone: 15, stick: 5 }), '800g + 15 Stones + 5 Sticks');
});
test('the can waters 1, then 3 in a row, then 3x3; the gold hoe tills 3 in a row', () => {
  assert.deepEqual(area('can', 1, [5, 5], [1, 0]), [[5, 5]]);
  assert.deepEqual(area('can', 2, [5, 5], [1, 0]), [[5, 5], [6, 5], [7, 5]]);
  const sq = area('can', 3, [5, 5], [0, 1]); assert.equal(sq.length, 9); assert.ok(sq.some(([x, y]) => x === 5 && y === 5) && sq.some(([x, y]) => x === 6 && y === 7));
  assert.deepEqual(area('hoe', 2, [5, 5], [0, -1]), [[5, 5]]); assert.deepEqual(area('hoe', 3, [5, 5], [0, -1]), [[5, 5], [5, 4], [5, 3]]);
});
test('better shovels never find just dirt, and the gold one finds wheat', () => {
  let n = 0; const seq = v => () => v[n++ % v.length];
  assert.deepEqual(digFind(seq([0.99]), 1), {});
  n = 0; assert.notDeepEqual(digFind(seq([0.99, 0.5]), 2), {});
  n = 0; assert.equal(digFind(seq([0.5, 0.01, 0.9]), 3).seeds, 'wheat');
});
