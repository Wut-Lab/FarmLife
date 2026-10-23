// The shovel: loose earth to dig for finds, and small plants you can dig up and replant on your farm.
import { CROPS, SEEDS } from './crops.js';
const COMMON = SEEDS.filter(c => !CROPS[c].rare);

// Plants the shovel can move (single-tile objects); walk: you can walk over them.
export const PLANTS = {
  tree: { name: 'Young Tree', icon: 'tree' },
  shrub_flower: { name: 'Flowering Shrub', icon: 'shrub_flower' },
  shrub_small: { name: 'Small Shrub', icon: 'shrub_small' },
  mushrooms: { name: 'Mushrooms', icon: 'mushrooms', walk: true },
  roses: { name: 'Roses', icon: 'roses', walk: true },
  tulips: { name: 'Tulips', icon: 'tulips', walk: true },
};
export const DIG_SPOTS = { farm: 3, road: 2, town: 3, wilds: 6 }; // loose earth that turns up each morning
export const DIG_ENERGY = 2;

// Tiles on `map` for n new spots of loose earth: grass, walkable, nothing on it, away from the edges.
export function scatterDigs(map, n, rand = Math.random) {
  const out = new Set(), taken = new Set([map.door, map.shop, map.store, ...map.bin, ...map.plots]);
  for (const o of map.objects) o.tiles.forEach((row, j) => row.forEach((_, i) => taken.add(`${o.x / 16 + i},${o.y / 16 + j}`)));
  for (let k = 0; k < 300 && out.size < n; k++) {
    const x = 2 + Math.floor(rand() * (map.W - 4)), y = 2 + Math.floor(rand() * (map.H - 4)), key = `${x},${y}`;
    if (map.ground[y * map.W + x].startsWith('grass') && !map.solid[y * map.W + x] && !taken.has(key)) out.add(key);
  }
  return out;
}

// What a spot of loose earth turns up: { gold } | { seeds, n } | { item: crop } | { plant } | {} (nothing).
export function digFind(rand = Math.random) {
  const r = rand(), pick = a => a[Math.floor(rand() * a.length)];
  if (r < 0.3) return { gold: 10 + Math.floor(rand() * 41) };
  if (r < 0.55) return { seeds: pick(COMMON), n: 1 + Math.floor(rand() * 3) };
  if (r < 0.7) return { item: pick(COMMON) };
  if (r < 0.85) return { plant: pick(['roses', 'tulips', 'shrub_small', 'shrub_flower']) };
  return {};
}
