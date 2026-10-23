import { test } from 'node:test';
import assert from 'node:assert/strict';
import { petLook, KINDS, NAMES } from '../src/pets.js';

test('a made-up pet has a kind, a name and a full coat swap', () => {
  let s = 1; const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let n = 0; n < 50; n++) {
    const p = petLook(rand);
    assert.ok(p.kind in KINDS && NAMES.includes(p.name));
    assert.match(p.about, new RegExp(`${KINDS[p.kind]}$`));
    assert.equal(Object.keys(p.swap).length, 6);
    for (const c of Object.values(p.swap)) assert.match(c, /^#[0-9a-f]{6}$/);
  }
});
