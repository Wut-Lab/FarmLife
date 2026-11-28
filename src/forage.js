// Forage: things to pick up, mostly in the Wilds, with a few turning up on the farm each morning.
//   Berries come from berry bushes (press Use facing one; it grows back by morning). Eat them for a little energy.
//   Pinecones lie around pine trees, sticks around the other trees, and stones in the open; walk over them to pick them up.
//   Stones, sticks and berries are for crafting (Pause > Crafting); pinecones, later.
export const FORAGE = {
  berries: { name: 'Berries', icon: 'berries', price: 2, energy: 5 }, // energy: eaten with Use while held
  pinecone: { name: 'Pinecone', icon: 'pinecone', price: 2 },
  stone: { name: 'Stone', icon: 'stone', price: 2 },
  stick: { name: 'Stick', icon: 'stick', price: 2 },
  jam: { name: 'Berry Jam', icon: 'jam', price: 30, energy: 25 }, // crafted from berries (crafting.js)
  // Fish: press Use facing water to cast, and again when it bites.
  fish_minnow: { name: 'Minnow', icon: 'fish_minnow', price: 12 }, fish_trout: { name: 'Trout', icon: 'fish_trout', price: 45 },
  fish_sunfish: { name: 'Sunfish', icon: 'fish_sunfish', price: 15 }, fish_catfish: { name: 'Catfish', icon: 'fish_catfish', price: 55 },
  fish_perch: { name: 'Perch', icon: 'fish_perch', price: 18 }, fish_salmon: { name: 'Salmon', icon: 'fish_salmon', price: 60 },
  fish_smelt: { name: 'Smelt', icon: 'fish_smelt', price: 14 }, fish_pike: { name: 'Pike', icon: 'fish_pike', price: 70 },
  fish_carp: { name: 'Golden Carp', icon: 'fish_carp', price: 250 },
};
// Fishing: each season has a common fish and a rarer one; the golden carp turns up anywhere, very rarely.
export const FISH = [['fish_minnow', 'fish_trout'], ['fish_sunfish', 'fish_catfish'], ['fish_perch', 'fish_salmon'], ['fish_smelt', 'fish_pike']];
export const CAST_ENERGY = 4, BITE_WAIT = [1.5, 4.5], BITE_TIME = 0.8; // energy per cast; seconds until a bite (min, max); seconds you have to reel it in
export function catchFish(season, rand = Math.random) { const r = rand(); return r < 0.03 ? 'fish_carp' : FISH[season][r < 0.3 ? 1 : 0]; }
// What falls by each kind of tree (by its top-left tile).
const DROPS = { pine_0: 'pinecone', oak_0: 'stick', tree_green_0: 'stick', tree_orange_0: 'stick' };
export const BERRIES_PER_BUSH = [1, 3]; // picked at once (min, max)
// How much turns up: stones in the open, and the chance of a pinecone or stick by each tree.
export const SPREAD = { wilds: { stones: [3, 6], tree: 0.3 }, farm: { stones: [0, 2], tree: 0.04, cap: 4 } };

const key = (x, y) => `${x},${y}`;
// Open grass on `map`: walkable, nothing on it, not a door/bin/plot/dig spot, and no forage already.
function open(map, x, y) {
  if (x < 1 || y < 1 || x >= map.W - 1 || y >= map.H - 1) return false;
  const k = key(x, y), i = y * map.W + x;
  return map.ground[i].startsWith('grass') && !map.solid[i] && !map.forage?.has(k) && !map.digs?.has(k) && !map.plots.includes(k)
    && ![map.door, map.shop, map.store, ...map.bin].includes(k) && !map.objects.some(o => o.tiles.some((row, j) => row.some((_, c) => o.x / 16 + c === x && o.y / 16 + j === y)));
}

// Scatter stones, then pinecones and sticks, on a map (map.forage: tile key -> item id). Adds to what's there, up to `cap` items.
export function scatterForage(map, { stones: [lo, hi], tree, cap = Infinity }, rand = Math.random) {
  map.forage ??= new Map();
  const room = () => map.forage.size < cap;
  for (let n = lo + Math.floor(rand() * (hi - lo + 1)), tries = 0; n > 0 && tries < 300 && room(); tries++) {
    const x = Math.floor(rand() * map.W), y = Math.floor(rand() * map.H);
    if (open(map, x, y)) { map.forage.set(key(x, y), 'stone'); n--; }
  }
  for (const o of map.objects) {
    const drop = DROPS[o.tiles[0][0]];
    if (!drop || rand() >= tree || !room()) continue;
    const bx = o.x / 16 + (o.tiles[0].length > 1 ? Math.floor(rand() * 2) : 0), by = o.y / 16 + o.tiles.length - 1, spots = [[-1, 0], [1, 0], [0, 1], [-1, 1], [1, 1]].map(([a, b]) => [bx + a, by + b]).filter(([x, y]) => open(map, x, y));
    if (spots.length) { const [x, y] = spots[Math.floor(rand() * spots.length)]; map.forage.set(key(x, y), drop); }
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
