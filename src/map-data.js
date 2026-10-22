// Hand-built maps: the JSON the map editor (editor.html) saves, and turning it into the map shape the game uses.
// Data: { W, H, ground: [tile name per cell], objects: [{ name, x, y }], block: [0 auto | 1 solid | 2 walkable], spawn: { x, y } }
import { A } from './art-index.js';
import { CROPS } from './crops.js';
export const TILE = 16;
export const EDITOR_KEY = 'farmlife-editor-map';

// Multi-tile objects: size in tiles and how many bottom rows block movement (default: all rows).
const SIZES = {
  house: { w: 3, h: 3 }, shop: { w: 3, h: 3 }, bin: { w: 2, h: 1 },
  tree_green: { w: 1, h: 2, solid: 1 }, tree_orange: { w: 1, h: 2, solid: 1 },
  pine: { w: 1, h: 2, solid: 1 }, oak: { w: 2, h: 2, solid: 1 }, shrub_large: { w: 2, h: 1 },
};
const WALK_THROUGH = new Set(['mushrooms']);
const NOT_PLACEABLE = new Set(['hoe', 'can', 'bag', ...Object.values(CROPS).flatMap(c => [...c.stages, c.item, c.packet])]);
export const isGround = n => /^(grass|path|soil)\d+$/.test(n);

// Every placeable object, from the art index: { name, w, h, solid, tiles: rows of tile names }.
export const PREFABS = {};
for (const n of Object.keys(A)) {
  if (isGround(n) || NOT_PLACEABLE.has(n)) continue;
  const m = n.match(/^(.*)_(\d+)$/);
  if (m && A[m[1] + '_0'] !== undefined) {
    if (m[2] !== '0') continue;
    const count = Object.keys(A).filter(k => k.startsWith(m[1] + '_') && /^\d+$/.test(k.slice(m[1].length + 1))).length;
    const { w = count, h = 1, solid = h } = SIZES[m[1]] ?? {};
    PREFABS[m[1]] = { name: m[1], w, h, solid, tiles: [...Array(h)].map((_, j) => [...Array(w)].map((_, i) => `${m[1]}_${j * w + i}`)) };
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
    for (let j = p.h - p.solid; j < p.h; j++) for (let i = 0; i < p.w; i++) {
      const x = o.x + i, y = o.y + j;
      if (x >= 0 && y >= 0 && x < d.W && y < d.H) solid[y * d.W + x] = 1;
    }
  }
  d.block?.forEach((b, i) => { if (b) solid[i] = b === 1 ? 1 : 0; });
  return solid;
}

// Data -> the game's map: houses get a door, shops a counter, bins their tiles, soil becomes plots.
export function mapFromData(d) {
  const { W, H } = d, key = (x, y) => `${x},${y}`;
  const out = { W, H, ground: d.ground.slice(), solid: solidOf(d), objects: [], plots: [], door: null, shop: null, bin: [] };
  for (const o of d.objects) {
    const p = PREFABS[o.name]; if (!p) continue;
    out.objects.push({ x: o.x * TILE, y: o.y * TILE, base: (o.y + p.h) * TILE, tiles: p.tiles });
    const front = key(o.x + (p.w >> 1), o.y + p.h - 1);
    if (o.name === 'house') out.door ??= front;
    if (o.name === 'shop') out.shop ??= front;
    if (o.name === 'bin' && !out.bin.length) for (let i = 0; i < p.w; i++) out.bin.push(key(o.x + i, o.y + p.h - 1));
  }
  d.ground.forEach((n, i) => { if (n.startsWith('soil')) out.plots.push(key(i % W, Math.floor(i / W))); });
  const sp = d.spawn ?? { x: W >> 1, y: H >> 1 };
  out.spawn = { x: sp.x * TILE, y: sp.y * TILE };
  return out;
}

// The game's map (e.g. buildFarm()) -> editor data, so an existing map can be opened and changed.
export function dataFromMap(m) {
  const d = { W: m.W, H: m.H, ground: m.ground.slice(), objects: [], block: Array(m.W * m.H).fill(0),
    spawn: { x: Math.round(m.spawn.x / TILE), y: Math.round(m.spawn.y / TILE) } };
  for (const o of m.objects) o.tiles.forEach((row, j) => row.forEach((n, i) => {
    const name = n.endsWith('_0') ? n.slice(0, -2) : n;
    if (PREFABS[name]) d.objects.push({ name, x: o.x / TILE + i, y: o.y / TILE + j });
  }));
  const auto = solidOf({ ...d, block: null });
  for (let i = 0; i < auto.length; i++) if (auto[i] !== m.solid[i]) d.block[i] = m.solid[i] ? 1 : 2;
  return d;
}

// The map saved by the editor, for play-testing with index.html?map=editor.
export function editorMap() {
  try { const d = JSON.parse(localStorage.getItem(EDITOR_KEY)); return d ? mapFromData(d) : null; } catch { return null; }
}
