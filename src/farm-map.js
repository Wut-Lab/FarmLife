// The farm: a hand-placed layout with a seeded scatter of flowers and trees.
import { TILE } from './engine.js';
import { ROAD, paveRoad } from './locations.js';

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
    ground.push(r < 0.06 ? 'grass2' : r < 0.18 ? 'grass1' : 'grass0');
  }
  const used = new Uint8Array(W * H);
  const free = (x, y, w, h) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++)
      if (i < 0 || j < 0 || i >= W || j >= H || used[at(i, j)]) return false;
    return true;
  };
  // tiles: rows of tile names; solidRows: how many bottom rows block movement
  const place = (x, y, tiles, solidRows = tiles.length) => {
    const h = tiles.length, w = tiles[0].length;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      used[at(x + i, y + j)] = 1;
      if (j >= h - solidRows) solid[at(x + i, y + j)] = 1;
    }
    objects.push({ x: x * TILE, y: y * TILE, base: (y + h) * TILE, tiles });
  };

  // Path (3 rows high so its grass edges line up), house, field and fence.
  for (let x = 3; x < 37; x++) for (let j = 0; j < 3; j++) {
    const col = x === 3 ? 0 : 1; // runs straight into the stone road
    ground[at(x, 15 + j)] = 'path' + (j * 3 + col);
    used[at(x, 15 + j)] = 1;
  }
  // Stone road off the right edge, toward town.
  paveRoad(ground, W, H, (x, y) => x >= 37 && ROAD.includes(y));
  for (const y of ROAD) for (let x = 37; x < W; x++) used[at(x, y)] = 1;
  place(17, 10, [['house_0', 'house_1', 'house_2'], ['house_3', 'house_4', 'house_5'], ['house_6', 'house_7', 'house_8']]);
  place(25, 12, [['bin_0', 'bin_1']]); // shipping bin
  const plots = [];
  for (let y = 20; y < 26; y += 2) for (let x = 6; x < 16; x++) {
    plots.push(`${x},${y}`);
    ground[at(x, y)] = 'soil' + (x === 6 ? 0 : x === 15 ? 2 : 1);
  }
  for (let y = 20; y < 26; y++) for (let x = 5; x < 17; x++) used[at(x, y)] = 1;
  place(5, 19, [['fence0', ...Array(10).fill('fence1'), 'fence2']]);

  // Border of tall trees, then scattered trees, shrubs and mushrooms.
  const tall = () => { const r = rand(); return r < 0.25 ? [['tree_orange_0'], ['tree_orange_1']] : r < 0.45 ? [['pine_0'], ['pine_1']] : [['tree_green_0'], ['tree_green_1']]; };
  for (let x = 0; x < W; x++) { if (free(x, 0, 1, 2)) place(x, 0, tall(), 1); if (free(x, H - 2, 1, 2)) place(x, H - 2, tall(), 1); }
  for (let y = 2; y < H - 2; y += 1) { if (free(0, y, 1, 2)) place(0, y, tall(), 1); if (free(W - 1, y, 1, 2)) place(W - 1, y, tall(), 1); }
  for (let n = 0; n < 40; n++) {
    const x = 2 + Math.floor(rand() * (W - 4)), y = 2 + Math.floor(rand() * (H - 4));
    const r = rand();
    if (r < 0.1) { if (free(x - 1, y - 1, 4, 4)) place(x, y, [['oak_0', 'oak_1'], ['oak_2', 'oak_3']], 1); continue; }
    if (r < 0.2) { if (free(x - 1, y - 1, 3, 4)) place(x, y, [['pine_0'], ['pine_1']], 1); continue; }
    if (r < 0.3) { if (free(x - 1, y - 1, 4, 3)) place(x, y, [['shrub_large_0', 'shrub_large_1']]); continue; }
    const kind = r < 0.4 ? 'shrub_flower' : r < 0.8 ? 'tree' : 'mushrooms';
    if (free(x - 1, y - 1, 3, 3)) place(x, y, [[kind]], kind === 'mushrooms' ? 0 : 1);
  }

  return { W, H, ground, solid, objects, plots, door: '18,12', shop: null, bin: ['25,12', '26,12'], name: 'Farm', exits: { right: 'road' }, spawn: { x: 18 * TILE, y: 13 * TILE } };
}
