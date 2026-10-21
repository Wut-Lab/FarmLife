// Crop data and the state of every planted plot. Growth happens overnight, and only if watered.
export const CROPS = {
  carrot:  { name: 'Carrot',  days: 3, price: 35,  seed: 15, stages: ['carrot0', 'carrot1', 'carrot2', 'carrot3'],     item: 'carrot_item',  packet: 'carrot_packet' },
  turnip:  { name: 'Turnip',  days: 4, price: 50,  seed: 20, stages: ['turnip0', 'turnip1', 'turnip2', 'turnip3'], item: 'turnip_item', packet: 'turnip_packet' },
  cabbage: { name: 'Cabbage', days: 6, price: 90,  seed: 40, stages: ['cabbage0', 'cabbage1', 'cabbage2', 'cabbage3'], item: 'cabbage_item', packet: 'cabbage_packet' },
};
export const SEEDS = Object.keys(CROPS);

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
}
