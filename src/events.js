// Random events: each morning rolls which ones happen today.
//   Minstrel: wanders the dirt patch on the road in the morning, singing; notes rise from his mouth, and his song plays when you're near.
//   Macaw: perches on your farmhouse roof from noon, flies off at 4 PM and leaves a seed or two by your door.
//   Clothes salesman: stands by Fredrick's shop for the day, selling clothes (see store.js).
import { TILE } from './engine.js';
import { CROPS, SEEDS } from './crops.js';
import { Villager } from './villagers.js';

export const CHANCES = { minstrel: 0.15, bird: 0.2, salesman: 0.2 };
// Where and when (hours) the visitors stand: size is the side of the square they walk (0: stands still).
export const VISITORS = {
  minstrel: { map: 'road', x: 32, y: 21, size: 4, from: 6, to: 12 },
  salesman: { map: 'town', x: 13, y: 8, size: 0, from: 9, to: 17 },
};
export const BIRD_HOURS = [12, 16];
export const BIRD_SEEDS = SEEDS.filter(c => CROPS[c].season === undefined && !CROPS[c].rare).slice(0, 3); // the first three all-season crops
export const NOTES = ['note_red', 'note_yellow', 'note_blue']; // primary colours, one at random per note
export const NEAR = 4 * TILE; // how close you have to be to hear the minstrel's song
export const MINSTREL_LINES = ['♪ La la laaa! ♪', 'Every road needs a song!', "I'm still standing, after all these miles!", 'Music for the morning, friend!'];

export const rollDay = (rand = Math.random) => Object.fromEntries(Object.entries(CHANCES).map(([k, p]) => [k, rand() < p]));

export class Events {
  constructor(rand = Math.random) { this.rand = rand; this.newDay(); }
  newDay() { this.today = rollDay(this.rand); this.bird = null; this.notes = []; this.noteT = 0; }

  // w: the World. Keeps visitors on their maps during their hours, runs the bird, notes and dropped seeds.
  update(w, dt) {
    const hour = Math.floor(w.clock.minutes / 60), ft = TILE / 2;
    for (const [sheet, s] of Object.entries(VISITORS)) {
      const list = w.maps[s.map].villagers, v = list.find(v => v.walker.sheet === sheet), want = this.today[sheet] && hour >= s.from && hour < s.to;
      if (want && !v) list.push(new Villager({ sheet, x: s.x, y: s.y, size: s.size }));
      if (!want && v) list.splice(list.indexOf(v), 1);
    }
    // Notes rise from the minstrel's mouth now and then.
    const m = w.map.villagers.find(v => v.walker.sheet === 'minstrel');
    if (m && (this.noteT -= dt) <= 0) {
      this.noteT = 0.5 + this.rand() * 0.6;
      this.notes.push({ x: m.x + 6 + this.rand() * 4, y: m.y + 4, t: 0, tile: NOTES[Math.floor(this.rand() * NOTES.length)], sway: this.rand() * 6 });
    }
    for (const n of this.notes) { n.t += dt; n.y -= 14 * dt; }
    this.notes = this.notes.filter(n => n.t < 1.8);
    w.song(!!m && Math.hypot(m.x - w.x, m.y - w.y) < NEAR);
    // The macaw: perched from noon, gone at four, leaving seeds in front of the door.
    if (this.today.bird && !this.bird && hour >= BIRD_HOURS[0] && hour < BIRD_HOURS[1]) this.bird = { state: 'perch', t: 0 };
    if (this.bird) {
      this.bird.t += dt;
      if (this.bird.state === 'perch' && hour >= BIRD_HOURS[1]) {
        const [x, y] = w.maps.farm.door.split(',').map(Number), crop = BIRD_SEEDS[Math.floor(this.rand() * BIRD_SEEDS.length)];
        w.maps.farm.drops = [...(w.maps.farm.drops ?? []), { key: `${x},${y + 1}`, crop, n: 1 + (this.rand() < 0.5) }];
        this.bird = { state: 'fly', t: 0 };
      }
      if (this.bird.state === 'fly' && this.bird.t > 4) this.bird = { state: 'gone' };
    }
    // Pick up dropped seeds by walking over them.
    const here = `${Math.floor((w.x + ft) / TILE)},${Math.floor((w.y + 13) / TILE)}`, drop = w.map.drops?.find(d => d.key === here);
    if (drop) {
      w.map.drops.splice(w.map.drops.indexOf(drop), 1);
      w.seeds[drop.crop] += drop.n;
      w.found(`The macaw left you ${drop.n} ${CROPS[drop.crop].name} seed${drop.n > 1 ? 's' : ''}!`);
    }
  }

  // Seeds on the ground, under everything else.
  drawGround(w, cx, cy) {
    for (const d of w.map.drops ?? []) { const [x, y] = d.key.split(',').map(Number); w.g.tile(CROPS[d.crop].packet, x * TILE - cx, y * TILE - cy); }
  }
  // The macaw on the roof (or flying off) and the minstrel's notes, over everything else.
  drawAbove(w, cx, cy) {
    const g = w.g, c = g.ctx, b = this.bird;
    if (b && b.state !== 'gone' && w.onFarm) {
      const [x, y] = w.map.door.split(',').map(Number), rx = (x + 0.6) * TILE - cx, ry = (y - 2) * TILE - cy + 3; // on the roof, just right of the middle (below the hotbar)
      if (b.state === 'perch') g.tile(Math.floor(b.t / 0.7) % 3 === 2 ? 'bird1' : 'bird0', rx, ry); // bobs its head now and then
      else g.tile(Math.floor(b.t * 8) % 2 ? 'bird_fly1' : 'bird_fly0', rx - b.t * 40, ry - b.t * 30 + Math.sin(b.t * 6) * 3);
    }
    for (const n of this.notes) {
      if (w.map.villagers.every(v => v.walker.sheet !== 'minstrel')) break;
      c.globalAlpha = Math.max(0, Math.min(1, (1.8 - n.t) / 0.6));
      g.tile(n.tile, n.x + Math.sin(n.t * 4) * n.sway / 2 - cx - 4, n.y - cy - 8, 10);
      c.globalAlpha = 1;
    }
  }
}
