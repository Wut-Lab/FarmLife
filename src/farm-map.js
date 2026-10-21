// The farm: a hand-placed layout with a seeded scatter of flowers and trees.
import { TILE } from './engine.js';

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildFarm(seed = 7) {
  const W = 40, H = 30, rand = rng(seed);
  const ground = [], solid = new Uint8Array(W * H), objects = [];
  const at = (x, y) => y * W + x;
  for (let i = 0; i < W * H; i++) {
    const r = rand();
    ground.push(['town', r < 0.06 ? 2 : r < 0.18 ? 1 : 0]);
  }
  const used = new Uint8Array(W * H);
  const free = (x, y, w, h) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++)
      if (i < 0 || j < 0 || i >= W || j >= H || used[at(i, j)]) return false;
    return true;
  };
  // tiles: rows of [sheet, index]; solidRows: how many bottom rows block movement
  const place = (x, y, tiles, solidRows = tiles.length) => {
    const h = tiles.length, w = tiles[0].length;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      used[at(x + i, y + j)] = 1;
      if (j >= h - solidRows) solid[at(x + i, y + j)] = 1;
    }
    objects.push({ x: x * TILE, y: y * TILE, base: (y + h) * TILE, tiles });
  };
  const T = i => ['town', i], F = i => ['farm', i];

  // Path (3 rows high so its grass edges line up), house, field and fence.
  for (let x = 3; x < 37; x++) for (let j = 0; j < 3; j++) {
    const col = x === 3 ? 0 : x === 36 ? 2 : 1;
    ground[at(x, 15 + j)] = T([12, 24, 36][j] + col);
    used[at(x, 15 + j)] = 1;
  }
  place(17, 10, [[T(52), T(53), T(54)], [T(64), T(65), T(66)], [T(72), T(73), T(74)]]);
  // Seed shop next to the house, with a sign.
  place(21, 10, [[T(48), T(49), T(50)], [T(60), T(61), T(62)], [T(88), T(89), T(88)]]);
  place(24, 12, [[T(83)]]);
  const plots = [];
  for (let y = 20; y < 26; y += 2) for (let x = 6; x < 16; x++) {
    plots.push(`${x},${y}`);
    ground[at(x, y)] = F(x === 6 ? 48 : x === 15 ? 51 : 49 + (x % 2));
  }
  for (let y = 20; y < 26; y++) for (let x = 5; x < 17; x++) used[at(x, y)] = 1;
  place(5, 19, [[T(80), ...Array(10).fill(T(81)), T(82)]]);

  // Border of tall trees, then scattered single trees and mushrooms.
  const tall = () => (rand() < 0.3 ? [[T(3)], [T(15)]] : [[T(4)], [T(16)]]);
  for (let x = 0; x < W; x++) { if (free(x, 0, 1, 2)) place(x, 0, tall(), 1); if (free(x, H - 2, 1, 2)) place(x, H - 2, tall(), 1); }
  for (let y = 2; y < H - 2; y += 1) { if (free(0, y, 1, 2)) place(0, y, tall(), 1); if (free(W - 1, y, 1, 2)) place(W - 1, y, tall(), 1); }
  for (let n = 0; n < 40; n++) {
    const x = 2 + Math.floor(rand() * (W - 4)), y = 2 + Math.floor(rand() * (H - 4));
    const tree = rand() < 0.75;
    if (free(x - 1, y - 1, 3, 3)) place(x, y, [[tree ? T(28) : T(29)]], tree ? 1 : 0);
  }

  return { W, H, ground, solid, objects, plots, door: '19,12', shop: '22,12', spawn: { x: 18 * TILE, y: 13 * TILE } };
}
