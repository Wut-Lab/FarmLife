import test from 'node:test';
import assert from 'node:assert/strict';
import { storeOpen } from '../src/store.js';

test('the general store is open 8 AM to 8 PM', () => {
  assert.deepEqual([7 * 60 + 50, 8 * 60, 19 * 60 + 50, 20 * 60].map(storeOpen), [false, true, true, false]);
});
