import test from 'node:test';
import assert from 'node:assert';
import { Clock, MAX_ENERGY } from '../src/clock.js';

test('ticks advance 10 minutes', () => {
  const c = new Clock({ msPerTick: 100 });
  c.update(250);
  assert.equal(c.timeString, '6:20 AM');
});

test('passing out at 2 AM starts a new day with half energy', () => {
  const c = new Clock();
  for (let i = 0; i < 120; i++) c.tick();
  assert.equal(c.day, 2);
  assert.equal(c.timeString, '6:00 AM');
  assert.equal(c.energy, MAX_ENERGY / 2);
});

test('season and year roll over', () => {
  const c = new Clock();
  for (let i = 0; i < 28 * 4; i++) c.sleep();
  assert.equal(c.seasonName, 'Spring');
  assert.equal(c.year, 2);
});

test('energy cannot go negative', () => {
  const c = new Clock();
  assert.equal(c.useEnergy(MAX_ENERGY + 1), false);
  assert.ok(c.useEnergy(5));
  c.sleep();
  assert.equal(c.energy, MAX_ENERGY);
});
