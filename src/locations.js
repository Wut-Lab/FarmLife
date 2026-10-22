// The places you can walk between. Each location is a map plus exits on its left/right edges along the stone road.
import { blobTile, mapFromData, grassTile } from './map-data.js';
import { buildFarm } from './farm-map.js';
import { VILLAGERS } from './villagers.js';

export const ROAD = [15, 16, 17]; // the stone road's rows, the same in every location so walking across lines up

// Pave cells with bordered cobble; `on(x, y)` may be true past the map edge so the road runs off-screen.
export function paveRoad(ground, W, H, on) {
  const bits = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (on(x, y))
    ground[y * W + x] = blobTile('cobbleb', bits.reduce((m, [a, b], k) => (on(x + a, y + b) ? m | (1 << k) : m), 0));
}

// A blank grass area ringed by trees, with gaps where the road leaves.
function area(W, H, seed, on, extra = () => {}) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const ground = [...Array(W * H)].map(() => grassTile(rand()));
  paveRoad(ground, W, H, on);
  const objects = [], used = new Set();
  const put = (name, x, y, w = 1, h = 2) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (used.has(`${x + i},${y + j}`) || on(x + i, y + j)) return;
    for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) used.add(`${x + i},${y + j}`);
    objects.push({ name, x, y });
  };
  extra(put, ground);
  const tree = () => ['tree_green', 'tree_green', 'pine', 'tree_orange'][Math.floor(rand() * 4)];
  for (let x = 0; x < W; x++) { put(tree(), x, 0); put(tree(), x, H - 2); }
  for (let y = 2; y < H - 2; y++) { put(tree(), 0, y); put(tree(), W - 1, y); }
  for (let n = 0; n < 30; n++) {
    const x = 2 + Math.floor(rand() * (W - 4)), y = 2 + Math.floor(rand() * (H - 4)), r = rand();
    if (r < 0.5) put(tree(), x, y); else put(r < 0.75 ? 'shrub_flower' : 'mushrooms', x, y, 1, 1);
  }
  return mapFromData({ W, H, ground, objects, spawn: { x: 1, y: ROAD[1] } });
}
const onRoad = y => ROAD.includes(y);

// Every location, by id: its name and how to build its default map. The editor can replace any of them.
export const LOCATIONS = {
  farm: { name: 'Farm', build: () => ({ ...buildFarm(), npcs: VILLAGERS }) },
  road: { name: 'Road to Town', build: () => buildRoad() },
  town: { name: 'Town', build: () => buildTown() },
};

// Road to town: a stone road straight across. Blank for now, to build on later.
export function buildRoad() {
  return { ...area(40, 30, 11, (x, y) => onRoad(y)), name: 'Road to Town', exits: { left: 'farm', right: 'town' } };
}

// Town: the road comes in from the left and opens into a square. Buildings come later.
export function buildTown() {
  const square = (x, y) => x >= 14 && x <= 27 && y >= 9 && y <= 22;
  const m = area(40, 30, 23, (x, y) => (x <= 14 && onRoad(y)) || square(x, y), put => put('sign', 12, 14, 1, 1));
  return { ...m, name: 'Town', exits: { left: 'road' } };
}
