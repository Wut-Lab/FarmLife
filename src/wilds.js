// The Wilds: woods past the east end of town, made fresh each visit from a seed. Woods, clearings, ponds, rocks and berry bushes.
// wildsData(seed, season) gives editor data (see map-data.js), so the editor can open one and mapFromData can build it.
import { blankMap, retile, solidOf, PREFABS } from './map-data.js';
import { findPath } from './villagers.js';
import { TOWN } from './town-map.js';

export const WILDS_W = TOWN.W, WILDS_H = TOWN.H; // the same size as the town
// The path comes in on the rows where the town's stone road leaves its right edge.
const ENTRY = (() => { const r = [...Array(TOWN.H).keys()].filter(y => /^cobble/.test(TOWN.ground[y * TOWN.W + TOWN.W - 1])); return r.length ? r : [15, 16]; })();

// Trees by season: more orange in the fall, mostly pines in winter.
const TREES = {
  Spring: ['tree_green', 'tree_green', 'oak', 'pine'], Summer: ['tree_green', 'oak', 'oak', 'pine'],
  Fall: ['tree_orange', 'tree_orange', 'oak', 'pine'], Winter: ['pine', 'pine', 'pine', 'oak'],
};
const LITTLE = ['shrub_small', 'shrub_flower', 'mushrooms', 'rock_small', 'rock_medium', 'dandelions', 'roses', 'tulips'];

const rng = seed => { let s = (seed >>> 0) || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

// Smooth noise in 0..1: random values on a coarse grid, blended between.
function noise(W, H, cell, rand) {
  const gw = Math.ceil(W / cell) + 2, gh = Math.ceil(H / cell) + 2, g = [...Array(gw * gh)].map(rand);
  const s = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / cell, fy = y / cell, i = Math.floor(fx), j = Math.floor(fy), u = s(fx - i), v = s(fy - j), at = (a, b) => g[b * gw + a];
    return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v;
  };
}

export function wildsData(seed = Date.now(), season = 'Spring') {
  const rand = rng(seed), W = WILDS_W, H = WILDS_H, d = blankMap(W, H, seed % 100000 || 1), idx = (x, y) => y * W + x;
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const keep = new Uint8Array(W * H); // path and clearings: nothing grows here
  const clear = (cx, cy, r) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (inside(x, y) && (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r) keep[idx(x, y)] = 1; };

  // A dirt path wanders in from the town's road to a clearing somewhere in the middle.
  const end = [18 + Math.floor(rand() * 12), 6 + Math.floor(rand() * (H - 12))], wide = Math.min(ENTRY.length, 2);
  let y = ENTRY[0];
  for (let x = 0; x <= end[0]; x++) {
    const was = y;
    if (x > 3 && rand() < 0.35) y += rand() < 0.7 ? Math.sign(end[1] - y) : rand() < 0.5 ? -1 : 1;
    y = Math.max(3, Math.min(H - 3 - wide, y));
    for (let k = Math.min(was, y); k < Math.max(was, y) + wide; k++) { d.ground[idx(x, k)] = 'path4'; clear(x, k, 1); } // steps overlap, so the path stays joined
    if (x < 3) for (const r of ENTRY) { d.ground[idx(x, r)] = 'path4'; clear(x, r, 1); } // meets the whole road at the edge
  }
  clear(end[0], y, 4);
  for (let n = 1 + Math.floor(rand() * 3); n--;) clear(4 + Math.floor(rand() * (W - 8)), 4 + Math.floor(rand() * (H - 8)), 2 + Math.floor(rand() * 2)); // other clearings

  // Ponds: a blob of shallows, deep in the middle when it's big enough.
  for (let n = Math.floor(rand() * 3); n--;) {
    const cx = 6 + Math.floor(rand() * (W - 12)), cy = 5 + Math.floor(rand() * (H - 10)), rx = 2 + rand() * 3, ry = 2 + rand() * 2;
    for (let j = -4; j <= 4; j++) for (let i = -6; i <= 6; i++) {
      const x = cx + i, y = cy + j, e = (i / rx) ** 2 + (j / ry) ** 2 + (rand() - 0.5) * 0.3;
      if (!inside(x, y) || keep[idx(x, y)]) continue;
      if (e < 1) d.ground[idx(x, y)] = e < 0.35 && rx > 3 && ry > 2.5 ? 'deep0' : 'shallow0';
    }
  }
  // Meadows of wildflowers where the noise is high, out of the woods.
  const meadow = noise(W, H, 6, rand), woods = noise(W, H, 5, rand), warm = rand() < 0.5 ? 'wildwarm0' : 'wildcool0';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d.ground[idx(x, y)].startsWith('grass') && meadow(x, y) > 0.75) d.ground[idx(x, y)] = warm;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) retile(d, x, y, 0);

  // Trees: thick along the edges and wherever the woods noise is high; little things scattered between.
  const used = new Uint8Array(W * H), trees = TREES[season] ?? TREES.Spring;
  const water = (x, y) => /^(shallow|deep)/.test(d.ground[idx(x, y)]);
  const put = name => (x, y) => {
    const p = PREFABS[name];
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) {
      const a = x + i, b = y + j;
      if (!inside(a, b) || used[idx(a, b)] || keep[idx(a, b)] || water(a, b) || d.ground[idx(a, b)].startsWith('path')) return false;
    }
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) used[idx(x + i, y + j)] = 1;
    d.objects.push({ name, x, y });
    return true;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const edge = Math.min(x, y, W - 1 - x, H - 1 - y), r = rand();
    const p = edge < 2 ? 0.75 : woods(x, y) > 0.55 ? 0.45 : 0.04;
    if (r < p) put(trees[Math.floor(rand() * trees.length)])(x, y);
    else if (r < p + 0.035) put(LITTLE[Math.floor(rand() * LITTLE.length)])(x, y + 1);
    else if (r < p + 0.04 && !d.ground[idx(x, Math.max(0, y))].startsWith('wild')) put('rock_large')(x, y);
  }
  // Berry bushes along the edges of the path and clearings, so you can always reach them.
  const edges = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++)
    if (!keep[idx(x, y)] && !used[idx(x, y)] && !water(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => keep[idx(x + a, y + b)] && !water(x + a, y + b))) edges.push([x, y]);
  for (let n = 3 + Math.floor(rand() * 4); n > 0 && edges.length; n--) put('berry_bush')(...edges.splice(Math.floor(rand() * edges.length), 1)[0]);

  // Open up anything walled off, so every bit of open ground can be reached from the path.
  d.spawn = { x: 0, y: ENTRY[0] };
  for (let tries = 0; tries < 200; tries++) {
    const solid = solidOf(d), m = { W, H, solid }, reach = new Uint8Array(W * H);
    findPath(m, [0, ENTRY[0]], (x, y) => { reach[idx(x, y)] = 1; return false; });
    reach[idx(0, ENTRY[0])] = 1;
    const shut = [...Array(W * H).keys()].find(i => !solid[i] && !reach[i]);
    if (shut === undefined) break;
    // Take out the object nearest the shut-in tile that touches reachable ground.
    const sx = shut % W, sy = (shut - sx) / W, near = (o, p = PREFABS[o.name]) => Math.abs(o.x + (p.w >> 1) - sx) + Math.abs(o.y + p.h - 1 - sy);
    const opens = d.objects.filter(o => { const p = PREFABS[o.name]; for (let j = 0; j < p.h; j++) for (let i = -1; i <= p.w; i++) for (const b of [o.y + j - 1, o.y + j + 1, o.y + j]) if (inside(o.x + i, b) && reach[idx(o.x + i, b)]) return true; return false; });
    const o = (opens.length ? opens : d.objects).reduce((a, b) => (near(b) < near(a) ? b : a));
    d.objects.splice(d.objects.indexOf(o), 1);
  }
  return { ...d, name: 'The Wilds', exits: { left: 'town' }, npcs: [] };
}
