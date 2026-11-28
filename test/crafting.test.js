import test from 'node:test';
import assert from 'node:assert/strict';
import { RECIPES, missing, sprinkled } from '../src/crafting.js';

test('a recipe says what you are short of', () => {
  const have = { stone: 4, stick: 1 }, count = id => have[id] ?? 0;
  assert.deepEqual(missing('sprinkler', count), [['stick', 2]]);
  have.stick = 3; assert.deepEqual(missing('sprinkler', count), []);
  assert.ok(RECIPES.jam.needs.berries > 0);
});

test('a sprinkler waters the 8 tiles around it, not its own', () => {
  const s = sprinkled(['5,5']);
  assert.equal(s.size, 8); assert.ok(s.has('4,4') && s.has('6,6')); assert.ok(!s.has('5,5'));
  assert.equal(sprinkled(['5,5', '6,5']).size, 12);
});
