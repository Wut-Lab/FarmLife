// Hand-built maps: the JSON the map editor (editor.html) saves, and turning it into the map shape the game uses.
// Data: { W, H, ground: [tile name per cell], objects: [{ name, x, y }], block: [0 auto | 1 solid | 2 walkable], spawn: { x, y },
//   name, exits: { left, right: location id }, npcs: [{ sheet, x, y, size }] }
import { A } from './art-index.js';
import { CROPS } from './crops.js';
import { VILLAGERS } from './villagers.js';
export const TILE = 16;
export const EDITOR_KEY = 'farmlife-editor-maps'; // { [location id]: data }
const OLD_EDITOR_KEY = 'farmlife-editor-map'; // a single farm map, from before locations

// Autotiling (the editor's brushes and generated maps). Paths and paving join each other (no border between them); shallow water joins deep; wildflowers join wildflowers; off-map counts as joined.
// Dirt paths and soil use their 9/3-piece sets, everything in BLOB_SETS its 47-piece set.
const fam = n => n.replace(/\d+$/, '');
function joins(f, n) {
  if (f === 'path' || f === 'cobbleb' || f === 'brickb') return isPaved(n);
  if (f === 'shallow') return /^(shallow|deep)\d+$/.test(n);
  if (f === 'wildcool' || f === 'wildwarm') return /^wild(cool|warm)\d+$/.test(n); // the two meadows blend into each other
  return fam(n) === f;
}
export function retile(d, x, y, r = 1) {
  const inside = (i, j) => i >= 0 && j >= 0 && i < d.W && j < d.H;
  for (let j = y - r; j <= y + r; j++) for (let i = x - r; i <= x + r; i++) {
    if (!inside(i, j)) continue;
    const n = d.ground[j * d.W + i], f = fam(n), same = (a, b) => !inside(a, b) || joins(f, d.ground[b * d.W + a]);
    if (BLOB_SETS.includes(f)) {
      const bits = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
      d.ground[j * d.W + i] = blobTile(f, bits.reduce((m, [a, b], k) => (same(i + a, j + b) ? m | (1 << k) : m), 0));
      continue;
    }
    if (!/^(path|soil)\d$/.test(n)) continue;
    const col = !same(i - 1, j) && same(i + 1, j) ? 0 : same(i - 1, j) && !same(i + 1, j) ? 2 : 1;
    if (f === 'soil') d.ground[j * d.W + i] = 'soil' + col;
    else d.ground[j * d.W + i] = 'path' + ((!same(i, j - 1) ? 0 : !same(i, j + 1) ? 2 : 1) * 3 + col);
  }
}
// Multi-tile objects: size in tiles and how many bottom rows block movement (default: all rows);
// cols overrides that per column, e.g. an open patio you can walk behind; door is the door's column (default: middle).
const SIZES = {
  house: { w: 3, h: 3 }, shop: { w: 3, h: 3 }, barn: { w: 4, h: 4, solid: 3 }, bin: { w: 2, h: 1 },
  tree_green: { w: 1, h: 2, solid: 1 }, tree_orange: { w: 1, h: 2, solid: 1 },
  pine: { w: 1, h: 2, solid: 1 }, oak: { w: 2, h: 2, solid: 1 }, shrub_large: { w: 2, h: 1 },
  house_brown: { w: 3, h: 4, solid: 3 }, house_blue: { w: 3, h: 4, solid: 3 },
  store: { w: 6, h: 4, solid: 3, cols: { 4: 1, 5: 1 }, door: 2 },   pickup: { w: 3, h: 2, solid: 1 }, car_small: { w: 2, h: 2, solid: 1 }, box_truck: { w: 4, h: 3, solid: 2 },
  taxi: { w: 3, h: 2, solid: 1 }, suv: { w: 3, h: 2, solid: 1 }, rock_large: { w: 2, h: 2, solid: 1 }, stone_house: { w: 5, h: 4, solid: 3 },
};
const WALK_THROUGH = new Set(['mushrooms', 'roses', 'tulips', 'dandelions', 'rock_small']);
const NOT_PLACEABLE = new Set(['hoe', 'can', 'bag', 'shovel', 'shoes', 'sneakers', 'dig_spot', 'berry_bush_bare', 'berries', 'pinecone', 'stone', 'stick', 'beanie', 'longsleeve', 'jeans', 'white_sneakers', 'note_red', 'note_yellow', 'note_blue', 'bird0', 'bird1', 'bird_fly0', 'bird_fly1', ...Object.values(CROPS).flatMap(c => [...c.stages, c.item, c.packet])]);
export const isGround = n => /^(grass|path|soil|cobbleb?|brickb?|shallow|deep|wildcool|wildwarm)\d+$/.test(n);
export const isPaved = n => /^(path|cobbleb?|brickb?)\d+$/.test(n);
// Rows where a road reaches the map's left or right edge: walking off there takes you through that side's exit.
export const exitRows = (m, side) => [...Array(m.H).keys()].filter(y => isPaved(m.ground[y * m.W + (side === 'left' ? 0 : m.W - 1)]));
export const BLOB_SETS = ['cobbleb', 'brickb', 'shallow', 'deep', 'wildcool', 'wildwarm']; // 47-piece autotile sets drawn by tools/make_art.py

// Blob autotiles: neighbour bits N, E, S, W, NE, SE, SW, NW. A corner only counts when both sides next to it do,
// which leaves 47 distinct masks; a set's tile number is the mask's position in this sorted list (same as make_art.py).
const CORNERS = [[16, 1, 2], [32, 4, 2], [64, 4, 8], [128, 1, 8]];
const reduce = m => CORNERS.reduce((m, [c, a, b]) => (m & a && m & b ? m : m & ~c), m);
export const BLOB = [...new Set([...Array(256).keys()].map(reduce))].sort((a, b) => a - b);
export const blobTile = (set, mask) => set + BLOB.indexOf(reduce(mask));

// Every placeable object, from the art index: { name, w, h, solid, tiles: rows of tile names }.
export const PREFABS = {};
for (const n of Object.keys(A)) {
  if (isGround(n) || NOT_PLACEABLE.has(n)) continue;
  const m = n.match(/^(.*)_(\d+)$/);
  if (m && A[m[1] + '_0'] !== undefined) {
    if (m[2] !== '0') continue;
    const count = Object.keys(A).filter(k => k.startsWith(m[1] + '_') && /^\d+$/.test(k.slice(m[1].length + 1))).length;
    const { w = count, h = 1, solid = h, cols, door } = SIZES[m[1]] ?? {};
    PREFABS[m[1]] = { name: m[1], w, h, solid, cols, door, tiles: [...Array(h)].map((_, j) => [...Array(w)].map((_, i) => `${m[1]}_${j * w + i}`)) };
  } else PREFABS[n] = { name: n, w: 1, h: 1, solid: WALK_THROUGH.has(n) ? 0 : 1, tiles: [[n]] };
}

export function blankMap(W = 40, H = 30, seed = 1) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const ground = [...Array(W * H)].map(() => grassTile(rand()));
  return { W, H, ground, objects: [], block: Array(W * H).fill(0), spawn: { x: W >> 1, y: H >> 1 } };
}
export const grassTile = r => (r < 0.06 ? 'grass2' : r < 0.18 ? 'grass1' : 'grass0');

// Solid flags from objects, then the editor's per-tile overrides.
export function solidOf(d) {
  const solid = new Uint8Array(d.W * d.H);
  for (const o of d.objects) {
    const p = PREFABS[o.name]; if (!p) continue;
    for (let i = 0; i < p.w; i++) for (let j = p.h - (p.cols?.[i] ?? p.solid); j < p.h; j++) {
      const x = o.x + i, y = o.y + j;
      if (x >= 0 && y >= 0 && x < d.W && y < d.H) solid[y * d.W + x] = 1;
    }
  }
  d.ground.forEach((n, i) => { if (n.startsWith('deep')) solid[i] = 1; }); // deep water can't be waded
  d.block?.forEach((b, i) => { if (b) solid[i] = b === 1 ? 1 : 0; });
  return solid;
}

// Data -> the game's map: houses get a door, shops a counter, bins their tiles, soil becomes plots.
export function mapFromData(d) {
  const { W, H } = d, key = (x, y) => `${x},${y}`;
  const out = { W, H, ground: d.ground.slice(), solid: solidOf(d), objects: [], plots: [], door: null, shop: null, store: null, bin: [],
    name: d.name, exits: { ...d.exits }, npcs: (d.npcs ?? []).map(v => ({ ...v })) };
  for (const o of d.objects) {
    const p = PREFABS[o.name]; if (!p) continue;
    out.objects.push({ x: o.x * TILE, y: o.y * TILE, base: (o.y + p.h) * TILE, tiles: p.tiles });
    const front = key(o.x + (p.door ?? p.w >> 1), o.y + p.h - 1);
    if (o.name === 'house') out.door ??= front;
    if (o.name === 'shop') out.shop ??= front;
    if (o.name === 'store') out.store ??= front;
    if (o.name === 'bin' && !out.bin.length) for (let i = 0; i < p.w; i++) out.bin.push(key(o.x + i, o.y + p.h - 1));
  }
  d.ground.forEach((n, i) => { if (n.startsWith('soil')) out.plots.push(key(i % W, Math.floor(i / W))); });
  const sp = d.spawn ?? { x: W >> 1, y: H >> 1 };
  out.spawn = { x: sp.x * TILE, y: sp.y * TILE };
  return out;
}

// The game's map (e.g. a location's build()) -> editor data, so an existing map can be opened and changed.
export function dataFromMap(m) {
  const d = { W: m.W, H: m.H, ground: m.ground.slice(), objects: [], block: Array(m.W * m.H).fill(0),
    spawn: { x: Math.round(m.spawn.x / TILE), y: Math.round(m.spawn.y / TILE) },
    name: m.name, exits: { ...m.exits }, npcs: (m.npcs ?? []).map(v => ({ ...v })) };
  for (const o of m.objects) o.tiles.forEach((row, j) => row.forEach((n, i) => {
    const name = n.endsWith('_0') ? n.slice(0, -2) : n;
    if (PREFABS[name]) d.objects.push({ name, x: o.x / TILE + i, y: o.y / TILE + j });
  }));
  const auto = solidOf({ ...d, block: null });
  for (let i = 0; i < auto.length; i++) if (auto[i] !== m.solid[i]) d.block[i] = m.solid[i] ? 1 : 2;
  return d;
}

// The maps saved by the editor, by location id, for play-testing with index.html?map=editor.
export function editorData() {
  try {
    const all = JSON.parse(localStorage.getItem(EDITOR_KEY)) ?? {}, old = JSON.parse(localStorage.getItem(OLD_EDITOR_KEY));
    if (old && !all.farm) all.farm = { name: 'Farm', exits: { right: 'road' }, npcs: VILLAGERS, ...old };
    return all;
  } catch { return {}; }
}
export const editorMaps = () => Object.fromEntries(Object.entries(editorData()).map(([id, d]) => [id, mapFromData(d)]));
