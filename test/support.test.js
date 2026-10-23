import test from 'node:test';
import assert from 'node:assert/strict';
import { Support, PER_HEART, PERK_AT } from '../src/support.js';

test('gifts: one a day, loved gifts count most, hearts pay out once', () => {
  const s = new Support();
  assert.equal(s.gift('villager_male', 'cabbage').taste, 'love');
  assert.equal(s.gift('villager_male', 'cabbage'), null);
  s.overnight(() => 1);
  assert.equal(s.gift('villager_child', 'cabbage').taste, 'dislike');
  const r = s.add('villager_male', 2 * PER_HEART);
  assert.deepEqual(r.map(x => x.hearts), [1, 2]);
  assert.equal(r[1].gold, 100);
  s.add('villager_male', -PER_HEART); assert.deepEqual(s.add('villager_male', PER_HEART), []);
});

test('perk unlocks at its heart level', () => {
  const s = new Support();
  assert.equal(s.has('discount'), false);
  const r = s.add('villager_female', PERK_AT * PER_HEART);
  assert.equal(r.at(-1).perk.id, 'discount');
  assert.equal(s.has('discount'), true);
});

test('quests: offered overnight, handed in for gold, expire', () => {
  const s = new Support();
  s.overnight(() => 0); // every villager asks for 1 carrot
  const q = s.people.villager_male.quest;
  assert.deepEqual([q.item, q.n, q.days], ['carrot', 1, 3]);
  let have = 0;
  assert.equal(s.turnIn('villager_male', () => have, () => {}), null);
  have = 1; const taken = [];
  const done = s.turnIn('villager_male', () => have, (c, n) => taken.push([c, n]));
  assert.equal(done.gold, q.gold); assert.deepEqual(taken, [['carrot', 1]]);
  assert.equal(s.people.villager_male.quest, null);
  for (let i = 0; i < 3; i++) s.overnight(() => 1);
  assert.equal(s.people.villager_female.quest, null);
  const saved = JSON.parse(JSON.stringify(s.state));
  assert.equal(new Support(saved).people.villager_male.pts, s.people.villager_male.pts);
});

test('villagers chat about the time of day and season, and only ask for crops in season', async () => {
  const { chatter } = await import('../src/support.js');
  assert.deepEqual(chatter(7 * 60, 3), ['Brrrr...', 'Good morning!']);
  assert.equal(chatter(13 * 60, 0)[1], "There's so much day left!");
  assert.equal(chatter(17 * 60, 1)[1], 'The Sun is getting low.');
  assert.equal(chatter(11.5 * 60, 2).length, 1);
  const s = new Support(), seen = new Set();
  for (let i = 0; i < 200; i++) { s.overnight(Math.random, 3); for (const p of Object.values(s.people)) { if (p.quest) seen.add(p.quest.item); p.quest = null; } }
  assert.ok(seen.has('peas')); assert.ok(!seen.has('tomato'));
});
