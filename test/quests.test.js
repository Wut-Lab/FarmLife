import test from 'node:test';
import assert from 'node:assert/strict';
import { Quests, QUESTS } from '../src/quests.js';
import { GATES } from '../src/unlocks.js';

test("Fredrick's pinecone quest: ask, remind, hand in 5 for 5g, gate opens at 1 AM", () => {
  const q = new Quests(), bag = { pinecone: 3 }, count = id => bag[id] ?? 0, take = (id, n) => (bag[id] -= n);
  assert.match(q.talk('shopkeeper', count, take).lines[0], /blocked off my usual place/);
  assert.equal(q.talk('shopkeeper', count, take).remind, 'Any luck with those pinecones? (3/5)');
  assert.equal(q.talk('villager_male', count, take), null);
  bag.pinecone = 6;
  const done = q.talk('shopkeeper', count, take);
  assert.equal(done.gold, 5); assert.equal(bag.pinecone, 1); assert.match(done.lines[0], /^Great! Thank you!/);
  assert.equal(q.talk('shopkeeper', count, take), null); // nothing more to say: the shop opens as usual
  const w = { quests: q };
  q.tick(24 * 60 + 50); assert.equal(GATES.road.open(w), false);
  q.tick(25 * 60); assert.equal(GATES.road.open(w), true);
  const slept = new Quests({ pinecones: { step: 'done' } }); slept.tick(0, true); assert.ok(slept.isOpen('pinecones')); // slept before 1 AM
  assert.equal(QUESTS.pinecones.n, 5);
});
