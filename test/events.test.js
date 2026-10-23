import test from 'node:test';
import assert from 'node:assert/strict';
import { VISITORS, BIRD_SEEDS, rollDay, CHANCES } from '../src/events.js';
import { LOCATIONS } from '../src/locations.js';
import { fits } from '../src/villagers.js';
import { GOODS, goodsOf } from '../src/store.js';

test('event visitors fit where they stand', () => {
  for (const [sheet, s] of Object.entries(VISITORS)) assert.ok(fits(LOCATIONS[s.map].build(), s), sheet);
});
test('the macaw brings the first three all-season seeds', () => assert.deepEqual(BIRD_SEEDS, ['carrot', 'turnip', 'cabbage']));
test('each day rolls every event at its chance', () => {
  let n = 0; const rand = () => (n++ % 2 ? 0.99 : 0);
  assert.deepEqual(Object.keys(rollDay(rand)), Object.keys(CHANCES));
  assert.deepEqual(rollDay(() => 0.99), { minstrel: false, bird: false, salesman: false });
});
test('the salesman sells four clothes, each worth +0.5% bonus crops; Bella keeps her goods', () => {
  assert.deepEqual(goodsOf('salesman'), ['beanie', 'longsleeve', 'jeans', 'white_sneakers']);
  assert.ok(goodsOf('salesman').every(id => GOODS[id].extra === 0.005 && GOODS[id].slot));
  assert.deepEqual(goodsOf('storekeeper'), ['shoes', 'sneakers', 'shovel']);
});
