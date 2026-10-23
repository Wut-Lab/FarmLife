// Forage: things to pick up, mostly in the Wilds, with a few turning up on the farm each morning.
//   Berries come from berry bushes (press Use facing one; it grows back by morning). Eat them for a little energy.
//   Pinecones lie around pine trees, and stones in the open; walk over them to pick them up. (Both are for crafting, later.)
export const FORAGE = {
  berries: { name: 'Berries', icon: 'berries', price: 2, energy: 5 }, // energy: eaten with Use while held
  pinecone: { name: 'Pinecone', icon: 'pinecone', price: 2 },
  stone: { name: 'Stone', icon: 'stone', price: 2 },
};
export const BERRIES_PER_BUSH = [1, 3]; // picked at once (min, max)
// How much turns up: stones in the open, and the chance of a pinecone by each pine.
export const SPREAD = { wilds: { stones: [3, 6], pine: 0.4 }, farm: { stones: [0, 2], pine: 0.05, cap: 4 } };

const key = (x, y) => `${x},${y}`;
// Open grass on `map`: walkable, nothing on it, not a door/bin/plot/dig spot, and no forage already.
function open(map, x, y) {
  if (x < 1 || y < 1 || x >= map.W - 1 || y >= map.H - 1) return false;
  const k = key(x, y), i = y * map.W + x;
  return map.ground[i].startsWith('grass') && !map.solid[i] && !map.forage?.has(k) && !map.digs?.has(k) && !map.plots.includes(k)
    && ![map.door, map.shop, map.store, ...map.bin].includes(k) && !map.objects.some(o => o.tiles.some((row, j) => row.some((_, c) => o.x / 16 + c === x && o.y / 16 + j === y)));
}

// Scatter stones, then pinecones, on a map (map.forage: tile key -> item id). Adds to what's there, up to `cap` items.
export function scatterForage(map, { stones: [lo, hi], pine, cap = Infinity }, rand = Math.random) {
  map.forage ??= new Map();
  const room = () => map.forage.size < cap;
  for (let n = lo + Math.floor(rand() * (hi - lo + 1)), tries = 0; n > 0 && tries < 300 && room(); tries++) {
    const x = Math.floor(rand() * map.W), y = Math.floor(rand() * map.H);
    if (open(map, x, y)) { map.forage.set(key(x, y), 'stone'); n--; }
  }
  for (const o of map.objects) {
    if (o.tiles[0][0] !== 'pine_0' || rand() >= pine || !room()) continue;
    const bx = o.x / 16, by = o.y / 16 + 1, spots = [[-1, 0], [1, 0], [0, 1], [-1, 1], [1, 1]].map(([a, b]) => [bx + a, by + b]).filter(([x, y]) => open(map, x, y));
    if (spots.length) { const [x, y] = spots[Math.floor(rand() * spots.length)]; map.forage.set(key(x, y), 'pinecone'); }
  }
  return map.forage;
}

// Berry bushes: the object at a tile, if it's a bush; picking one leaves it bare, and every bush regrows overnight.
export const bushAt = (map, k) => map.objects.find(o => o.tiles[0][0].startsWith('berry_bush') && key(o.x / 16, o.y / 16) === k);
export function pickBush(o, rand = Math.random) {
  if (o.tiles[0][0] !== 'berry_bush') return 0;
  o.tiles = [['berry_bush_bare']];
  return BERRIES_PER_BUSH[0] + Math.floor(rand() * (BERRIES_PER_BUSH[1] - BERRIES_PER_BUSH[0] + 1));
}
export function regrowBushes(map) { for (const o of map.objects) if (o.tiles[0][0] === 'berry_bush_bare') o.tiles = [['berry_bush']]; }
