// Crop data and the state of every planted plot. Growth happens overnight, and only if watered.
export const CROPS = {
  carrot:  { name: 'Carrot',  days: 3, price: 35,  seed: 15, stages: ['carrot0', 'carrot1', 'carrot2', 'carrot3'],     item: 'carrot_item',  packet: 'carrot_packet' },
  turnip:  { name: 'Turnip',  days: 4, price: 50,  seed: 20, stages: ['turnip0', 'turnip1', 'turnip2', 'turnip3'], item: 'turnip_item', packet: 'turnip_packet' },
  cabbage: { name: 'Cabbage', days: 6, price: 90,  seed: 40, stages: ['cabbage0', 'cabbage1', 'cabbage2', 'cabbage3'], item: 'cabbage_item', packet: 'cabbage_packet' },
  // Seasonal crops (season is an index into SEASONS): they only grow in their season and wither when it ends.
  spinach: { name: 'Spinach', days: 4, price: 60,  seed: 25, season: 0, some: true, stages: ['spinach0', 'spinach1', 'spinach2', 'spinach3'], item: 'spinach_item', packet: 'spinach_packet' },
  tomato:  { name: 'Tomato',  days: 7, price: 110, seed: 45, season: 1, plural: 'tomatoes', stages: ['tomato0', 'tomato1', 'tomato2', 'tomato3'], item: 'tomato_item', packet: 'tomato_packet' },
  arugula: { name: 'Arugula', days: 4, price: 55,  seed: 22, season: 2, some: true, stages: ['arugula0', 'arugula1', 'arugula2', 'arugula3'], item: 'arugula_item', packet: 'arugula_packet' },
  // Rare crops (rare: true) aren't sold at the seed shop; wheat comes from the robed stranger in the Wilds.
  wheat:   { name: 'Wheat',   days: 5, price: 80,  seed: 35, rare: true, some: true, stages: ['wheat0', 'wheat1', 'wheat2', 'wheat3'], item: 'wheat_item', packet: 'wheat_packet' },
  peas:    { name: 'Peas',    days: 5, price: 70,  seed: 30, season: 3, some: true, plural: 'peas', stages: ['peas0', 'peas1', 'peas2', 'peas3'], item: 'peas_item', packet: 'peas_packet' },
};
export const SEEDS = Object.keys(CROPS);
// "a carrot" / "some peas", and "carrots" / "tomatoes" / "spinach" for n of them.
export const aCrop = c => (CROPS[c].some ? 'some ' : 'a ') + CROPS[c].name.toLowerCase();
export const nCrops = (c, n) => n > 1 ? CROPS[c].plural ?? CROPS[c].name.toLowerCase() + (CROPS[c].some ? '' : 's') : CROPS[c].name.toLowerCase();
export const inSeason = (crop, season) => CROPS[crop].season === undefined || CROPS[crop].season === season;

export class Field {
  constructor(plots) { this.plots = new Map(plots.map(k => [k, null])); }

  has(key) { return this.plots.has(key); }
  get(key) { return this.plots.get(key); }
  isRipe(p) { return !!p && p.grown >= CROPS[p.crop].days; }

  // Tile name for a plot's current look.
  sprite(p) {
    const c = CROPS[p.crop];
    return c.stages[Math.min(c.stages.length - 1, Math.floor(p.grown / c.days * (c.stages.length - 1)))];
  }

  // One action on a plot: plant, water or harvest. Returns what happened.
  act(key, seed) {
    if (!this.has(key)) return null;
    const p = this.plots.get(key);
    if (!p) { this.plots.set(key, { crop: seed, grown: 0, wet: false }); return { did: 'plant', crop: seed }; }
    if (this.isRipe(p)) { this.plots.set(key, null); return { did: 'harvest', crop: p.crop }; }
    if (!p.wet) { p.wet = true; return { did: 'water', crop: p.crop }; }
    return { did: 'none', crop: p.crop };
  }

  overnight() {
    for (const p of this.plots.values()) if (p) {
      if (p.wet && !this.isRipe(p)) p.grown++;
      p.wet = false;
    }
  }

  // A new season: crops from the old one wither. Returns how many.
  wither(season) {
    let n = 0;
    for (const [k, p] of this.plots) if (p && !inSeason(p.crop, season)) { this.plots.set(k, null); n++; }
    return n;
  }
}
