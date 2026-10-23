import test from 'node:test';
import assert from 'node:assert';
import { Field, CROPS } from '../src/crops.js';

test('plant, water, grow and harvest a carrot', () => {
  const f = new Field(['1,1']);
  assert.equal(f.act('1,1', 'carrot').did, 'plant');
  for (let d = 0; d < CROPS.carrot.days; d++) {
    assert.equal(f.act('1,1').did, 'water');
    f.overnight();
  }
  assert.equal(f.sprite(f.get('1,1')), CROPS.carrot.stages.at(-1));
  assert.equal(f.act('1,1').did, 'harvest');
  assert.equal(f.get('1,1'), null);
});

test('unwatered crops do not grow, and non-field tiles are ignored', () => {
  const f = new Field(['0,0']);
  f.act('0,0', 'turnip');
  f.overnight();
  assert.equal(f.get('0,0').grown, 0);
  assert.equal(f.act('5,5', 'turnip'), null);
});

test('seasonal crops wither when their season ends; year-round ones keep growing', async () => {
  const { inSeason } = await import('../src/crops.js');
  assert.equal(inSeason('tomato', 1), true); assert.equal(inSeason('tomato', 2), false); assert.equal(inSeason('carrot', 3), true);
  const f = new Field(['0,0', '1,0']);
  f.act('0,0', 'tomato'); f.act('1,0', 'carrot');
  assert.equal(f.wither(2), 1);
  assert.equal(f.get('0,0'), null); assert.equal(f.get('1,0').crop, 'carrot');
});
