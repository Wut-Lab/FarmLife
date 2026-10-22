// Game scenes: main menu -> character select -> farm.
import { TILE, DIRS, Walker } from './engine.js';
import { Clock, MAX_ENERGY, SEASONS } from './clock.js';
import { editorMaps, exitRows, isPaved } from './map-data.js';
import { LOCATIONS } from './locations.js';
import { CROPS, SEEDS, Field } from './crops.js';
import { settings, saveSettings, DAY_SPEEDS, sfx, playMusic, stopMusic, musicName } from './audio.js';
import { SLOTS, listSaves, readSave, writeSave, deleteSave } from './save.js';
import { spawnVillagers, feet, overlaps } from './villagers.js';
import { A } from './art-index.js';
import { Support, PEOPLE, PERK_AT, MAX_HEARTS } from './support.js';
import { Inventory, TOOLS, HOTBAR, LOCKED, BAG, BIN } from './inventory.js';

const CHARACTERS = [
  { sheet: 'male', label: 'Male' },
  { sheet: 'female', label: 'Female' },
];

// Grassy, flowery backdrop shared by the menus.
function meadow(g, t) {
  const ox = -Math.floor(t * 6) % TILE;
  for (let y = 0; y < g.h; y += TILE) for (let x = ox; x < g.w; x += TILE) {
    const k = ((x - ox) / TILE * 7 + y / TILE * 13 + Math.floor(t * 6 / TILE) * 7) % 11;
    g.tile('grass' + (k === 0 ? 2 : k < 3 ? 1 : 0), x, y);
  }
}

function button(g, label, x, y, w, h, focused) {
  g.panel(x, y, w, h, focused ? '#e86a9a' : '#3f2631dd');
  g.text(label, x + w / 2, y + (h - 10) / 2, { size: 10, align: 'center' });
  return g.input.tapIn(x, y, w, h);
}

export class Menu {
  enter(g) { this.g = g; this.t = 0; this.walkers = CHARACTERS.map(c => Object.assign(new Walker(c.sheet), { dir: DIRS.right })); }
  update(dt) {
    this.t += dt;
    this.walkers.forEach(w => w.update(dt, true));
    if (this.g.input.hit('Enter', 'Space')) this.g.go(new SaveSelect());
  }
  draw() {
    const g = this.g, cx = g.w / 2;
    meadow(g, this.t);
    g.text('FarmLife', cx, g.h * 0.2, { size: 28, align: 'center', color: '#fff3a8' });
    g.text('A farming & life sim', cx, g.h * 0.2 + 32, { size: 8, align: 'center' });
    this.walkers.forEach((w, i) => w.draw(g, ((this.t * 24 + i * 20) % (g.w + 40)) - 20, g.h * 0.2 + 48));
    if (button(g, 'Play', cx - 45, g.h * 0.62, 90, 20, true)) g.go(new SaveSelect());
    g.text('Enter or tap to start', cx, g.h * 0.62 + 26, { size: 6, align: 'center', color: '#e2f0d4' });
  }
}

// Four save files: continue a farm, or start a new one in an empty slot.
export class SaveSelect {
  enter(g) { this.g = g; this.t = 0; this.pick = 0; this.confirm = -1; this.saves = listSaves(); }
  update(dt) {
    const inp = this.g.input;
    this.t += dt;
    if (inp.hit('ArrowUp', 'KeyW')) { this.pick = (this.pick + SLOTS - 1) % SLOTS; this.confirm = -1; }
    if (inp.hit('ArrowDown', 'KeyS')) { this.pick = (this.pick + 1) % SLOTS; this.confirm = -1; }
    if (inp.hit('Escape')) this.g.go(new Menu());
    if (inp.hit('Enter', 'Space')) this.choose(this.pick);
    if (inp.hit('Delete', 'Backspace')) this.erase(this.pick);
  }
  choose(i) {
    const s = this.saves[i];
    this.g.go(s ? new World(s.sheet, i, s) : new CharacterSelect(i));
  }
  // Deleting takes two presses so a farm is never lost by accident.
  erase(i) {
    if (!this.saves[i]) return;
    if (this.confirm !== i) { this.confirm = i; this.pick = i; return; }
    deleteSave(i); this.saves[i] = null; this.confirm = -1;
  }
  draw() {
    const g = this.g, cx = g.w / 2, w = Math.min(170, g.w - 16), x = cx - w / 2, top = 26;
    const h = Math.max(24, Math.min(30, Math.floor((g.h - top - 12) / SLOTS) - 4));
    meadow(g, this.t);
    g.text('Choose a save file', cx, 8, { size: 12, align: 'center' });
    this.saves.forEach((s, i) => {
      const y = top + i * (h + 4);
      g.panel(x, y, w, h, i === this.pick ? '#e86a9a' : '#3f2631dd');
      g.text(`File ${i + 1}`, x + 6, y + 2, { size: 6, color: '#fff3a8' });
      if (s) {
        const c = s.clock;
        g.ctx.save(); g.ctx.beginPath(); g.ctx.rect(x + 4, y + 8, 16, h - 8); g.ctx.clip();
        new Walker(s.sheet).draw(g, x + 4, y + h - 16); g.ctx.restore();
        g.text(`${SEASONS[c.season]} ${c.day}, Year ${c.year}`, x + 24, y + 9, { size: 7 });
        g.text(`${s.gold}g`, x + 24, y + 17, { size: 6, color: '#fff3a8' });
        const del = [x + w - 34, y + h - 13, 30, 10];
        g.panel(...del, this.confirm === i ? '#c34b35' : '#5d7150');
        g.text(this.confirm === i ? 'Sure?' : 'Delete', del[0] + 15, del[1] + 2, { size: 5, align: 'center' });
        if (g.input.tapIn(...del)) return this.erase(i);
      } else g.text('Empty: start a new farm', x + 24, y + 12, { size: 7, color: '#dcebc6' });
      if (g.input.tapIn(x, y, w, h)) this.pick === i ? this.choose(i) : ((this.pick = i), (this.confirm = -1));
    });
    g.text('Enter: play  ·  Delete: erase (press twice)', cx, top + SLOTS * (h + 4) + 1, { size: 5, align: 'center', color: '#e2f0d4' });
    if (button(g, 'Back', 4, 4, 30, 12, false)) g.go(new Menu());
  }
}

export class CharacterSelect {
  constructor(slot = 0) { this.slot = slot; }
  enter(g) { this.g = g; this.t = 0; this.pick = 0; this.walkers = CHARACTERS.map(c => new Walker(c.sheet)); }
  update(dt) {
    const inp = this.g.input;
    this.t += dt;
    if (inp.hit('ArrowLeft', 'KeyA')) this.pick = 0;
    if (inp.hit('ArrowRight', 'KeyD')) this.pick = 1;
    if (inp.hit('Escape')) this.g.go(new SaveSelect());
    if (inp.hit('Enter', 'Space')) this.start();
    this.walkers.forEach((w, i) => w.update(dt, i === this.pick));
  }
  start() { this.g.go(new World(CHARACTERS[this.pick].sheet, this.slot)); }
  draw() {
    const g = this.g, cx = g.w / 2, size = 48, gap = 12, cardW = size + 16, cardH = size + 28;
    meadow(g, this.t);
    g.text('Choose your farmer', cx, g.h * 0.12, { size: 12, align: 'center' });
    const top = g.h * 0.12 + 22, left = cx - cardW - gap / 2;
    CHARACTERS.forEach((c, i) => {
      const x = left + i * (cardW + gap);
      g.panel(x, top, cardW, cardH, i === this.pick ? '#e86a9a' : '#3f2631cc');
      this.walkers[i].draw(g, x + 8, top + 6, size);
      g.text(c.label, x + cardW / 2, top + size + 12, { size: 8, align: 'center' });
      if (g.input.tapIn(x, top, cardW, cardH)) this.pick === i ? this.start() : (this.pick = i);
    });
    const by = top + cardH + 12;
    if (button(g, 'Start', cx - 40, by, 80, 18, true)) this.start();
    if (button(g, 'Back', 4, 4, 36, 14, false)) g.go(new SaveSelect());
  }
}

const CONTROLS = [
  ['Move', 'Arrows / WASD, or drag'],
  ['Use', 'Space / E, or tap Use'],
  ['Hotbar', '1-8, or tap a slot'],
  ['Seeds', 'Q, or tap the seed bag again'],
  ['Bag', 'I, or tap Bag; tap 2 slots to swap'],
  ['Sleep', 'Use on your front door'],
  ['Villagers', 'Use to talk; hold a crop to gift it'],
  ['Pause', 'Esc / P, or tap II'],
  ['Help', '? key, or tap ?'],
  ['Map', 'M, or tap the globe'],
];

const SPEED = 64; // pixels per second, 4 tiles
const BANNER = [0.5, 1.5, 0.7]; // location name: seconds fading in, shown, fading out
const FADE = 0.2; // seconds to fade out (and again to fade in) between locations

// Ten small pixel hearts, filled up to n.
function drawHearts(g, x, y, n) {
  const c = g.ctx;
  for (let i = 0; i < MAX_HEARTS; i++) {
    c.fillStyle = i < n ? '#e8507a' : '#00000055';
    const hx = x + i * 6;
    c.fillRect(hx, y, 2, 1); c.fillRect(hx + 3, y, 2, 1); c.fillRect(hx, y + 1, 5, 1); c.fillRect(hx + 1, y + 2, 3, 1); c.fillRect(hx + 2, y + 3, 1, 1);
  }
}

export class World {
  constructor(sheet, slot = 0, save = null) { this.sheet = sheet; this.slot = slot; this.save = save; }
  enter(g) {
    this.g = g;
    const edited = new URLSearchParams(location.search).get('map') === 'editor' ? editorMaps() : {}; // ?map=editor play-tests the editor's maps
    this.maps = Object.fromEntries(Object.entries(LOCATIONS).map(([id, l]) => [id, { ...(edited[id] ?? l.build()), name: l.name }]));
    this.map = this.maps.farm;
    this.player = new Walker(this.sheet);
    for (const m of Object.values(this.maps)) m.villagers = spawnVillagers(m);
    Object.assign(this, this.map.spawn);
    this.clock = new Clock({ msPerTick: DAY_SPEEDS[settings.speed].ms });
    this.menu = null; this.mi = 0; // pause / settings / controls overlay
    this.field = new Field(this.map.plots);
    this.seed = 0;
    this.support = new Support(); this.talk = null; this.fade = null;
    this.inv = new Inventory();
    this.gold = 200;
    this.seeds = { carrot: 5, turnip: 0, cabbage: 0 };
    this.shop = false;
    this.open = false; this.pick = -1;
    this.clock.on('overnight', () => {
      this.field.overnight(); this.support.overnight();
      this.paid = this.binValue(this.inv.emptyBin());
      this.gold += this.paid;
    });
    this.toast = '';
    this.clock.on('newDay', ({ passedOut }) => {
      this.map = this.maps.farm; Object.assign(this, this.map.spawn); this.player.dir = DIRS.down; // wake up outside the front door
      const saved = writeSave(this.slot, this.snapshot());
      this.say((passedOut ? 'You passed out! Half energy today.' : 'Good morning!') + (this.paid ? ` Shipping paid ${this.paid}g.` : '') + (saved ? ' Game saved.' : ''));
    });
    if (this.save) this.restore(this.save); else writeSave(this.slot, this.snapshot());
    playMusic(); // one of two tracks, picked at random each time you enter
  }

  // Everything a save file needs. Saved each morning, so time of day and position aren't stored.
  snapshot() {
    const k = this.clock;
    return {
      v: 1, sheet: this.sheet, gold: this.gold, seeds: this.seeds, seed: this.seed,
      clock: { day: k.day, season: k.season, year: k.year, energy: k.energy },
      plots: [...this.field.plots].filter(([, p]) => p), slots: this.inv.slots, sel: this.inv.sel, support: this.support.state,
    };
  }
  restore(s) {
    Object.assign(this.clock, s.clock);
    for (const [key, p] of s.plots) if (this.field.has(key)) this.field.plots.set(key, p);
    this.inv.slots = s.slots; this.inv.sel = s.sel;
    Object.assign(this, { gold: s.gold, seeds: s.seeds, seed: s.seed });
    this.support = new Support(s.support);
    this.say('Welcome back!');
  }
  say(msg) { this.toast = msg; this.toastT = 3; }

  // Feet hitbox: 8x5 pixels at the bottom of the 16x16 logical sprite. Villagers block too,
  // unless you already overlap one (so you can always step away).
  blocked(x, y) {
    const { W, H, solid } = this.map, me = feet(this.x, this.y), next = feet(x, y);
    for (const v of this.villagers) { const f = feet(v.x, v.y); if (overlaps(next, f) && !overlaps(me, f)) return true; }
    for (const [px, py] of [[x + 4, y + 11], [x + 11, y + 11], [x + 4, y + 15], [x + 11, y + 15]]) {
      const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
      if (ty < 0 || ty >= H) return true;
      if (tx < 0 || tx >= W) { // off the edge only along a road with an exit
        if (!this.map.exits?.[tx < 0 ? 'left' : 'right'] || !isPaved(this.map.ground[ty * W + (tx < 0 ? 0 : W - 1)])) return true;
        continue;
      }
      if (solid[ty * W + tx]) return true;
    }
    return false;
  }

  update(dt) {
    const inp = this.g.input, d = inp.dir;
    if (this.menu) return this.menuUpdate(inp);
    if (this.shop) return this.shopUpdate(inp, dt);
    if (this.talk) return this.talkUpdate(inp);
    if (this.mapView) return this.mapUpdate(inp);
    if (this.fade) return this.fadeUpdate(dt);
    const b = this.buttons(), inv = this.inv;
    if ((inp.hit('Escape', 'KeyP') && !this.open) || inp.tapIn(...b.pause)) return this.openMenu('pause');
    if (inp.hit('Slash') || inp.tapIn(...b.help)) return this.openMenu('controls', null);
    if (inp.hit('KeyM') || inp.tapIn(...b.map)) { this.mapView = true; this.mini = null; this.open = this.binOpen = false; return sfx('click'); }
    if (inp.hit('KeyI', ...(this.open ? ['Escape'] : [])) || inp.tapIn(...b.bag) || (this.open && inp.tapIn(...this.closeRect()))) { this.open = !this.open; this.binOpen = false; this.pick = -1; }
    if (inp.hit('KeyQ', 'Tab')) this.seed = (this.seed + 1) % SEEDS.length;
    for (let i = 0; i < HOTBAR; i++) if (inp.hit('Digit' + (i + 1))) inv.sel = i;
    // Tap a slot: select it (tap the seed bag again to change seeds). With the bag open, tap two slots to swap them.
    const n = !this.open ? HOTBAR : HOTBAR + BAG + (this.binOpen ? BIN : 0);
    for (let i = 0; i < n; i++) if (inp.tapIn(...this.slotRect(i))) {
      if (this.open && i >= LOCKED) {
        if (this.pick < 0) this.pick = i; else { inv.swap(this.pick, i); this.pick = -1; }
      } else if (i < HOTBAR) {
        if (inv.sel === i && inv.held?.id === 'seeds') this.seed = (this.seed + 1) % SEEDS.length;
        inv.sel = i;
      }
    }
    if (!this.open && (inp.hit('Space', 'KeyE', 'Enter') || inp.tapIn(...b.act))) this.act();
    this.clock.update(dt * 1000);
    if (this.toastT > 0) this.toastT -= dt;
    if (this.banner) this.banner.t += dt;
    if (this.open) return this.player.update(dt, false);
    const moving = d.x !== 0 || d.y !== 0;
    if (moving) {
      this.player.dir = Math.abs(d.x) > Math.abs(d.y) ? (d.x < 0 ? DIRS.left : DIRS.right) : (d.y < 0 ? DIRS.up : DIRS.down);
      const nx = this.x + d.x * SPEED * dt, ny = this.y + d.y * SPEED * dt;
      if (!this.blocked(nx, this.y)) this.x = nx;
      if (!this.blocked(this.x, ny)) this.y = ny;
    }
    this.player.update(dt, moving);
    const me = feet(this.x, this.y);
    for (const v of this.villagers) v.update(dt, (x, y) => overlaps(feet(x, y), me));
    // Walk off the end of the road into the next location.
    const { W, exits } = this.map, side = this.x + 8 < 0 ? 'left' : this.x + 8 > W * TILE ? 'right' : null; // centre past the edge (only possible on the road)
    if (side && exits?.[side]) this.fade = { t: 0, id: exits[side], side };
  }
  // Fade to black, switch location at the darkest point, then fade back in.
  fadeUpdate(dt) {
    const f = this.fade;
    if (f.t < FADE && f.t + dt >= FADE) this.travel(f.id, f.side);
    f.t += dt; if (this.banner) this.banner.t += dt;
    this.player.update(dt, f.t < FADE);
    if (f.t >= 2 * FADE) this.fade = null;
  }
  travel(id, side) {
    this.map = this.maps[id];
    this.x = side === 'right' ? 0 : (this.map.W - 1) * TILE;
    // Line up with the road on the side you came in; if the row you were on isn't road there, use the nearest road row.
    const rows = exitRows(this.map, side === 'right' ? 'left' : 'right'), row = Math.floor((this.y + 13) / TILE);
    if (rows.length && !rows.includes(row)) this.y = rows.reduce((a, b) => (Math.abs(b - row) < Math.abs(a - row) ? b : a)) * TILE - 4;
    this.banner = { text: this.map.name, t: 0 }; playMusic(); // each region picks its music on entry
  }
  get villagers() { return this.map.villagers; }
  get onFarm() { return this.map === this.maps.farm; }

  // The tile in front of the player's feet.
  facing() {
    const [dx, dy] = [[0, 1], [-1, 0], [1, 0], [0, -1]][this.player.dir];
    return `${Math.floor((this.x + 8 + dx * 10) / TILE)},${Math.floor((this.y + 13 + dy * 10) / TILE)}`;
  }

  // Ripe crops are picked by hand; otherwise the held tool decides what happens.
  act() {
    const key = this.facing(), f = this.field, held = this.inv.held?.id;
    const v = this.villagerAhead();
    if (v) return this.meet(v);
    if (key === this.map.door) { sfx('sleep'); return this.clock.sleep(); }
    if (key === this.map.shop) { this.shop = true; return; }
    if (this.map.bin.includes(key)) { this.open = this.binOpen = true; this.pick = -1; return; }
    if (!this.onFarm || !f.has(key)) return held && !TOOLS[held] && this.say(`That's a ${CROPS[held].name}.`);
    const p = f.get(key), tired = () => { sfx('nope'); this.say('Too tired. Sleep at your front door.'); };
    if (f.isRipe(p)) {
      if (!this.inv.add(p.crop)) return this.say('Your bag is full.');
      sfx('harvest'); f.act(key); return this.say(`Harvested a ${CROPS[p.crop].name}!`);
    }
    if (held === 'seeds') {
      if (p) return this.say(`Something is already growing here.`);
      const seed = SEEDS[this.seed];
      if (!this.seeds[seed]) return this.say(`Out of ${CROPS[seed].name} seeds. Buy more at the shop.`);
      if (!this.clock.useEnergy(1)) return tired();
      this.seeds[seed]--;
      sfx('plant'); const r = f.act(key, seed); return this.say(`Planted ${CROPS[r.crop].name} seeds. Water them daily.`);
    }
    if (held === 'can') {
      if (!p) return this.say('Nothing to water. Plant some seeds first.');
      if (p.wet) return this.say(`${CROPS[p.crop].name}: watered today. Ready in ${CROPS[p.crop].days - p.grown} day(s).`);
      if (!this.clock.useEnergy(this.support.has('green_thumb') ? 0 : 1)) return tired();
      sfx('water'); return f.act(key);
    }
    if (held === 'hoe') {
      if (!p) return this.say('The soil is already tilled.');
      if (!this.clock.useEnergy(2)) return tired();
      sfx('dig'); f.plots.set(key, null); return this.say(`Dug up the ${CROPS[p.crop].name}.`);
    }
    this.say('Pick a tool from your hotbar (1-3).');
  }

  buttons() {
    const g = this.g, r = 22;
    return { act: [g.w - r - 6, g.h - r - 6, r, r], bag: [g.w - 2 * r - 12, g.h - r - 6, r, r], help: [g.w - 14, 4, 10, 10], map: [g.w - 14, 16, 10, 10], pause: [g.w - 14, 28, 10, 10] };
  }

  // Support: talking, gifts and quests with villagers.
  villagerAhead() {
    const [dx, dy] = [[0, 1], [-1, 0], [1, 0], [0, -1]][this.player.dir], px = this.x + 8 + dx * 10, py = this.y + 13 + dy * 10;
    return this.villagers.find(v => { const [x, y, w, h] = feet(v.x, v.y); return px > x - 4 && px < x + w + 4 && py > y - 8 && py < y + h + 4; });
  }
  meet(v) {
    const id = v.walker.sheet, who = PEOPLE[id], sup = this.support, held = this.inv.held?.id;
    if (!who) return;
    v.walker.dir = [DIRS.up, DIRS.right, DIRS.left, DIRS.down][this.player.dir]; v.wait = Math.max(v.wait, 2); // turn to face you
    const lines = [], name = c => CROPS[c].name.toLowerCase();
    let rewards = [];
    const done = sup.turnIn(id, c => this.inv.count(c), (c, n) => this.inv.take(c, n));
    if (done) {
      this.gold += done.gold; rewards = done.rewards; sfx('coin');
      lines.push(`You brought them! Thank you so much. (+${done.gold}g)`);
    } else if (CROPS[held]) {
      const r = sup.gift(id, held);
      if (!r) lines.push(`You already gave me something today. Come back tomorrow!`);
      else {
        this.inv.take(held, 1); rewards = r.rewards; sfx(r.taste === 'dislike' ? 'nope' : 'harvest');
        lines.push({ love: `A ${name(held)}! I love these! Thank you!`, like: `Oh, a ${name(held)}. Thanks!`,
          neutral: `A ${name(held)}? Thanks, I suppose.`, dislike: `Ugh... a ${name(held)}. Not my favourite.` }[r.taste]);
      }
    } else {
      rewards = sup.talk(id);
      lines.push(who.hello[Math.floor(Math.random() * who.hello.length)]);
    }
    const q = sup.people[id].quest;
    if (q) lines.push(`Could you bring me ${q.n} ${name(q.item)}${q.n > 1 ? 's' : ''}? I'll pay ${q.gold}g. (${q.days} day${q.days > 1 ? 's' : ''} left)`);
    for (const r of rewards) {
      const got = [r.gold && `${r.gold}g`, ...Object.entries(r.seeds ?? {}).map(([c, n]) => `${n} ${CROPS[c].name} seeds`)].filter(Boolean);
      if (r.gold) this.gold += r.gold;
      for (const [c, n] of Object.entries(r.seeds ?? {})) this.seeds[c] += n;
      lines.push(`${r.hearts} heart${r.hearts > 1 ? "s" : ""} with ${who.name}!` + (got.length ? ` Gift: ${got.join(', ')}.` : '') + (r.perk ? ` Perk: ${r.perk.text}!` : ''));
      sfx('coin');
    }
    this.talk = { id, lines };
  }
  talkUpdate(inp) {
    this.player.update(0, false);
    if (inp.hit('Space', 'KeyE', 'Enter', 'Escape') || inp.tapIn(0, 0, this.g.w, this.g.h)) this.talk = null;
  }
  wrap(str, w, size) {
    const c = this.g.ctx, out = [];
    c.font = `${size}px "Pixelify Sans", monospace`;
    for (const word of str.split(' ')) {
      const last = out[out.length - 1];
      if (last !== undefined && c.measureText(last + ' ' + word).width <= w) out[out.length - 1] = last + ' ' + word; else out.push(word);
    }
    return out;
  }
  drawTalk() {
    const g = this.g, { id, lines } = this.talk, who = PEOPLE[id], w = Math.min(g.w - 16, 220), x = Math.round(g.w / 2 - w / 2);
    const paras = lines.map(l => this.wrap(l, w - 12, 6)), h = 26 + paras.flat().length * 8 + (paras.length - 1) * 4, y = g.h - h - 34;
    g.panel(x, y, w, h, '#3f2631f2');
    g.text(who.name, x + 6, y + 4, { size: 7, color: '#fff3a8' });
    drawHearts(g, x + w - 6 - MAX_HEARTS * 6, y + 6, this.support.hearts(id));
    let ty = y + 16;
    for (const p of paras) { for (const l of p) { g.text(l, x + 6, ty, { size: 6 }); ty += 8; } ty += 4; }
    g.text('Tap or press Space', x + w - 6, y + h - 9, { size: 5, align: 'right', color: '#dcebc6' });
  }

  // Close button under the bag (and shipping bin) panel.
  closeRect() { const [, by] = this.slotRect(HOTBAR); return [this.g.w / 2 - 18, by + 45, 36, 11]; }

  // Shipping bin: 5 slots, filled from the bag; everything in it is sold overnight.
  binValue(stacks) { return stacks.reduce((sum, s) => sum + (CROPS[s.id] ? this.sellPrice(s.id) : 0) * s.n, 0); }
  // Perks from villagers' support change prices.
  sellPrice(crop) { return Math.round(CROPS[crop].price * (this.support.has('bargain') ? 1.1 : 1)); }
  seedCost(c) { return Math.ceil(c.seed * (this.support.has('discount') ? 0.9 : 1)); }

  // Pause menu, settings and controls help. The clock stops while any of them is open.
  openMenu(name, back = name === 'pause' ? null : 'pause') {
    this.menu = name; this.back = back; this.mi = 0; this.open = this.binOpen = false; this.shop = false;
    sfx('click');
  }
  menuItems() {
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    if (this.menu === 'pause') return [
      { label: 'Resume', go: () => { this.menu = null; } },
      { label: 'Friends', go: () => this.openMenu('friends') },
      { label: 'Controls', go: () => this.openMenu('controls') },
      { label: 'Settings', go: () => this.openMenu('settings') },
      { label: 'Quit to title', go: () => { stopMusic(); this.g.go(new SaveSelect()); } },
    ];
    if (this.menu === 'settings') {
      const vol = (k, label) => ({ label, value: settings[k] ? `${settings[k] * 10}%` : 'Off', adj: d => { settings[k] = clamp(settings[k] + d, 0, 10); saveSettings(); } });
      return [
        vol('music', 'Music'), vol('sfx', 'Sound effects'),
        { label: 'Day speed', value: DAY_SPEEDS[settings.speed].label, adj: d => {
          settings.speed = clamp(settings.speed + d, 0, DAY_SPEEDS.length - 1); saveSettings();
          this.clock.msPerTick = DAY_SPEEDS[settings.speed].ms;
        } },
        { label: 'Back', go: () => this.openMenu('pause') },
      ];
    }
    return [{ label: 'Back', go: () => (this.back ? this.openMenu(this.back) : (this.menu = null)) }];
  }
  menuLayout() {
    const g = this.g, items = this.menuItems(), lines = this.menu === 'controls' ? CONTROLS.length : this.menu === 'friends' ? Object.keys(PEOPLE).length * 3 : 0;
    const w = this.menu === 'friends' ? 170 : 150, h = 22 + lines * 9 + items.length * 18, x = Math.round(g.w / 2 - w / 2), y = Math.round(g.h / 2 - h / 2);
    const rows = items.map((it, i) => ({ ...it, r: [x + 6, y + 18 + lines * 9 + i * 18, w - 12, 16] }));
    return { x, y, w, h, rows, top: y + 18 };
  }
  menuUpdate(inp) {
    const { rows } = this.menuLayout(), n = rows.length;
    this.player.update(0, false);
    if (inp.hit('ArrowUp', 'KeyW')) this.mi = (this.mi + n - 1) % n;
    if (inp.hit('ArrowDown', 'KeyS')) this.mi = (this.mi + 1) % n;
    const cur = rows[this.mi];
    if (cur.adj && inp.hit('ArrowLeft', 'KeyA')) { cur.adj(-1); sfx('click'); }
    if (cur.adj && inp.hit('ArrowRight', 'KeyD')) { cur.adj(1); sfx('click'); }
    if (cur.go && inp.hit('Enter', 'Space')) return cur.go();
    if (inp.hit('Escape')) return this.menu === 'pause' ? rows[0].go() : rows[n - 1].go(); // Esc resumes or goes back
    rows.forEach((it, i) => {
      const [x, y, w, h] = it.r;
      if (it.adj) {
        if (inp.tapIn(x + w - 70, y, 16, h)) { it.adj(-1); sfx('click'); this.mi = i; }
        if (inp.tapIn(x + w - 16, y, 16, h)) { it.adj(1); sfx('click'); this.mi = i; }
      } else if (inp.tapIn(...it.r)) it.go();
    });
  }
  drawMenu() {
    const g = this.g, { x, y, w, h, rows, top } = this.menuLayout();
    g.ctx.fillStyle = '#0b142888'; g.ctx.fillRect(0, 0, g.w, g.h);
    g.panel(x, y, w, h, '#3f2631f2');
    const title = { pause: 'Paused', settings: 'Settings', controls: 'Controls', friends: 'Friends' }[this.menu];
    g.text(title, x + w / 2, y + 5, { size: 8, align: 'center', color: '#fff3a8' });
    if (this.menu === 'pause') g.text(`Saved this morning · ♪ ${musicName()}`, x + w / 2, y + h + 3, { size: 5, align: 'center', color: '#e2f0d4' });
    if (this.menu === 'friends') Object.entries(PEOPLE).forEach(([id, who], i) => {
      const p = this.support.people[id], n = this.support.hearts(id), yy = top + i * 27;
      g.text(who.name, x + 8, yy, { size: 6, color: '#fff3a8' });
      drawHearts(g, x + w - 8 - MAX_HEARTS * 6, yy + 2, n);
      const q = p.quest;
      g.text(q ? `Wants ${q.n} ${CROPS[q.item].name}${q.n > 1 ? "s" : ""} · ${q.gold}g · ${q.days}d left` : 'No request right now', x + 8, yy + 8, { size: 5 });
      g.text(`${n >= PERK_AT ? 'Perk' : `Perk at ${PERK_AT} hearts`}: ${who.perk.text}`, x + 8, yy + 15, { size: 5, color: n >= PERK_AT ? '#86cf5e' : '#dcebc6' });
    });
    if (this.menu === 'controls') CONTROLS.forEach(([k, v], i) => {
      g.text(k, x + 8, top + i * 9, { size: 5, color: '#fff3a8' });
      g.text(v, x + 52, top + i * 9, { size: 5 });
    });
    rows.forEach((it, i) => {
      const [rx, ry, rw, rh] = it.r;
      g.panel(rx, ry, rw, rh, i === this.mi ? '#e86a9a' : '#5d7150cc');
      g.text(it.label, it.adj ? rx + 6 : rx + rw / 2, ry + 4, { size: 6, align: it.adj ? 'left' : 'center' });
      if (it.adj) {
        g.text('<', rx + rw - 62, ry + 4, { size: 6, align: 'center', color: '#fff3a8' });
        g.text(it.value, rx + rw - 35, ry + 4, { size: 6, align: 'center' });
        g.text('>', rx + rw - 8, ry + 4, { size: 6, align: 'center', color: '#fff3a8' });
      }
    });
  }

  // Seed shop: buy seeds, sell crops.
  shopRows() {
    const g = this.g, x = Math.round(g.w / 2 - 70), y = Math.round(g.h / 2 - 56);
    return { x, y, buy: SEEDS.map((_, i) => [x + 4, y + 16 + i * 20, 132, 18]), sell: [x + 4, y + 78, 64, 14], close: [x + 72, y + 78, 64, 14] };
  }
  shopUpdate(inp, dt) {
    const r = this.shopRows();
    this.clock.update(dt * 1000);
    if (this.toastT > 0) this.toastT -= dt;
    this.player.update(dt, false);
    SEEDS.forEach((s, i) => {
      if (!inp.hit('Digit' + (i + 1)) && !inp.tapIn(...r.buy[i])) return;
      const c = CROPS[s];
      if (this.gold < this.seedCost(c)) return this.say(`Not enough gold for ${c.name} seeds.`);
      sfx('coin'); this.gold -= this.seedCost(c); this.seeds[s]++; this.say(`Bought ${c.name} seeds. You have ${this.seeds[s]}.`);
    });
    if (inp.hit('KeyS') || inp.tapIn(...r.sell)) {
      const earned = SEEDS.reduce((sum, s) => sum + this.inv.take(s) * this.sellPrice(s), 0);
      if (earned) sfx('coin'); this.gold += earned; this.say(earned ? `Sold your crops for ${earned}g.` : 'No crops to sell.');
    }
    if (inp.hit('Escape', 'KeyE', 'Space') || inp.tapIn(...r.close)) this.shop = false;
  }
  drawShop() {
    const g = this.g, r = this.shopRows();
    g.panel(r.x, r.y, 140, 96, '#3f2631ee');
    g.text(`Seed Shop · ${this.gold}g`, r.x + 70, r.y + 4, { size: 7, align: 'center', color: '#fff3a8' });
    SEEDS.forEach((s, i) => {
      const c = CROPS[s], [x, y, w, h] = r.buy[i];
      g.panel(x, y, w, h, '#5d7150cc');
      g.tile(c.packet, x + 1, y + 1);
      g.text(`${i + 1}. ${c.name}`, x + 20, y + 5, { size: 6 });
      g.text(`own ${this.seeds[s]}`, x + 82, y + 5, { size: 5, color: '#dcebc6' });
      g.text(`${this.seedCost(c)}g`, x + w - 3, y + 5, { size: 6, align: 'right', color: '#fff3a8' });
    });
    g.panel(...r.sell, '#e86a9a'); g.text('Sell crops (S)', r.sell[0] + 32, r.sell[1] + 4, { size: 5, align: 'center' });
    g.panel(...r.close, '#5d7150'); g.text('Close (Esc)', r.close[0] + 32, r.close[1] + 4, { size: 5, align: 'center' });
  }

  // Slots 0-7 are the hotbar (top left); 8+ are the bag grid shown when it's open.
  slotRect(i) {
    if (i < HOTBAR) return [4 + i * 19, 4, 18, 18];
    if (i >= HOTBAR + BAG) return [Math.round(this.g.w / 2 - BIN * 19 / 2) + (i - HOTBAR - BAG) * 19, Math.round(this.g.h / 2 - 46), 18, 18];
    const j = i - HOTBAR, x0 = Math.round(this.g.w / 2 - 76), y0 = Math.round(this.g.h / 2 - (this.binOpen ? 8 : 16));
    return [x0 + (j % 8) * 19, y0 + Math.floor(j / 8) * 19, 18, 18];
  }

  drawSlot(i) {
    const g = this.g, s = this.inv.slots[i], [x, y] = this.slotRect(i);
    g.panel(x, y, 18, 18, i === this.pick ? '#e86a9add' : undefined);
    if (i === this.inv.sel) { g.ctx.strokeStyle = '#fff3a8'; g.ctx.lineWidth = 1; g.ctx.strokeRect(x + 0.5, y + 0.5, 17, 17); }
    if (!s) return;
    const icon = s.id === 'seeds' ? CROPS[SEEDS[this.seed]].packet : TOOLS[s.id]?.icon ?? CROPS[s.id].item;
    g.tile(icon, x + 1, y + 1);
    const n = s.id === 'seeds' ? this.seeds[SEEDS[this.seed]] : s.n;
    if (n !== undefined) g.text(String(n), x + 17, y + 11, { size: 5, align: 'right' });
  }

  draw(c) {
    const g = this.g, { W, H, ground, objects } = this.map;
    const clamp = (v, size, view) => (size <= view ? (size - view) / 2 : Math.max(0, Math.min(size - view, v)));
    const cx = Math.round(clamp(this.x + 8 - g.w / 2, W * TILE, g.w));
    const cy = Math.round(clamp(this.y + 8 - g.h / 2, H * TILE, g.h));
    const x0 = Math.max(0, Math.floor(cx / TILE)), y0 = Math.max(0, Math.floor(cy / TILE));
    for (let y = y0; y < Math.min(H, y0 + g.h / TILE + 2); y++)
      for (let x = x0; x < Math.min(W, x0 + g.w / TILE + 2); x++) {
        g.tile(ground[y * W + x], x * TILE - cx, y * TILE - cy);
        const p = this.onFarm && this.field.get(`${x},${y}`);
        if (p?.wet) { c.fillStyle = '#3f263155'; c.fillRect(x * TILE - cx, y * TILE - cy + 3, 16, 11); }
        if (p) g.tile(this.field.sprite(p), x * TILE - cx, y * TILE - cy);
      }
    // Highlight the tile the player is facing.
    const [fx, fy] = this.facing().split(',').map(Number);
    if ((this.onFarm && this.field.has(`${fx},${fy}`)) || [this.map.door, this.map.shop, ...this.map.bin].includes(`${fx},${fy}`)) {
      c.strokeStyle = '#fff8e8aa'; c.lineWidth = 1;
      c.strokeRect(fx * TILE - cx + 0.5, fy * TILE - cy + 0.5, 15, 15);
    }
    // Draw objects and the player back to front by their bottom edge.
    const list = objects.filter(o => o.x - cx < g.w && o.base - cy > 0 && o.x + o.tiles[0].length * TILE - cx > 0 && o.y - cy < g.h);
    list.push({ base: this.y + 16, player: true }, ...this.villagers.map(v => ({ base: v.y + 16, villager: v })));
    list.sort((a, b) => a.base - b.base);
    for (const o of list) {
      if (o.player) this.player.draw(g, this.x - cx, this.y - cy);
      else if (o.villager) o.villager.draw(g, cx, cy);
      else o.tiles.forEach((row, j) => row.forEach((n, k) => g.tile(n, o.x + k * TILE - cx, o.y + j * TILE - cy)));
    }
    // Night falls after 6 PM.
    const dark = Math.max(0, this.clock.dayProgress - 0.6) * 1.6;
    if (dark > 0) { c.fillStyle = `rgba(11,20,48,${dark.toFixed(3)})`; c.fillRect(0, 0, g.w, g.h); }
    if (this.fade) { const t = this.fade.t / FADE; c.fillStyle = `rgba(0,0,0,${Math.min(1, t < 1 ? t : 2 - t).toFixed(3)})`; c.fillRect(0, 0, g.w, g.h); }
    this.hud();
    if (this.talk) this.drawTalk();
    if (this.mapView) this.drawMap();
    if (this.menu) this.drawMenu();
  }

  drawGlobe(cx, cy) { // a small line-drawn globe for the Map button
    const c = this.g.ctx;
    c.strokeStyle = '#fff8e8'; c.lineWidth = 0.6;
    c.beginPath(); c.arc(cx, cy, 3.5, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.ellipse(cx, cy, 1.5, 3.5, 0, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(cx - 3.5, cy); c.lineTo(cx + 3.5, cy); c.moveTo(cx - 3, cy - 1.8); c.lineTo(cx + 3, cy - 1.8); c.moveTo(cx - 3, cy + 1.8); c.lineTo(cx + 3, cy + 1.8); c.stroke();
  }

  // Map overlay: the whole current location, shrunk to fit, with a marker where you are. The clock stops while it's open.
  mapLayout() {
    const g = this.g, { W, H } = this.map, k = Math.min((g.w - 20) / (W * TILE), (g.h - 46) / (H * TILE));
    const w = Math.round(W * TILE * k), h = Math.round(H * TILE * k), x = Math.round((g.w - w) / 2), y = Math.round((g.h - h - 36) / 2) + 14;
    return { x, y, w, h, k, exit: [Math.round(g.w / 2 - 20), y + h + 5, 40, 13] };
  }
  mapUpdate(inp) {
    this.player.update(0, false);
    if (inp.hit('KeyM', 'Escape', 'Enter', 'Space') || inp.tapIn(...this.mapLayout().exit) || inp.tapIn(...this.buttons().map)) { this.mapView = false; sfx('click'); }
  }
  miniMap() { // redrawn each time the map opens (16px per tile), so it shows the latest crops, buildings and villagers
    const m = this.map;
    if (this.mini) return this.mini;
    const P = 16, cv = document.createElement('canvas'), c = cv.getContext('2d'), art = this.g.images.art;
    cv.width = m.W * P; cv.height = m.H * P; c.imageSmoothingEnabled = false;
    const put = (n, x, y) => { const i = A[n]; if (i !== undefined) c.drawImage(art, (i % 16) * 32, Math.floor(i / 16) * 32, 32, 32, x * P, y * P, P, P); };
    m.ground.forEach((n, i) => {
      const x = i % m.W, y = Math.floor(i / m.W), p = this.onFarm && this.field.get(`${x},${y}`);
      put(n, x, y);
      if (p?.wet) { c.fillStyle = '#3f263155'; c.fillRect(x * P, y * P + 3, P, 11); }
      if (p) put(this.field.sprite(p), x, y);
    });
    for (const o of [...m.objects].sort((a, b) => a.base - b.base)) o.tiles.forEach((row, j) => row.forEach((n, i) => put(n, o.x / TILE + i, o.y / TILE + j)));
    for (const v of this.villagers) { // villagers as small figures where they stand right now
      const f = v.walker, img = this.g.images[f.sheet];
      if (img) c.drawImage(img, 0, 0, 32, 32, v.x / TILE * P, v.y / TILE * P, P, P);
    }
    return (this.mini = cv);
  }
  drawMap() {
    const g = this.g, c = g.ctx, { x, y, w, h, k, exit } = this.mapLayout();
    c.fillStyle = '#0b1428bb'; c.fillRect(0, 0, g.w, g.h);
    g.panel(x - 4, y - 14, w + 8, h + 36, '#3f2631f2');
    g.text(this.map.name, g.w / 2, y - 11, { size: 8, align: 'center', bold: true, color: '#fff3a8' });
    c.imageSmoothingEnabled = false; c.drawImage(this.miniMap(), x, y, w, h);
    // You-are-here marker, gently pulsing.
    const px = x + (this.x + 8) * k, py = y + (this.y + 12) * k, r = 2.5 + Math.sin(performance.now() / 200) * 0.6;
    c.beginPath(); c.arc(px, py, r + 1, 0, Math.PI * 2); c.fillStyle = '#fff8e8'; c.fill();
    c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fillStyle = '#e8507a'; c.fill();
    g.text('You', px, py - r - 8, { size: 5, align: 'center' });
    g.panel(...exit, '#e86a9a'); g.text('Exit', exit[0] + exit[2] / 2, exit[1] + 3, { size: 6, align: 'center' });
  }

  hud() {
    const g = this.g, k = this.clock, w = 78, x = g.w - w - 18;
    const y = g.w < HOTBAR * 19 + w + 26 ? 26 : 4; // Drop below the hotbar on narrow screens.
    g.panel(x, y, w, 34);
    g.text(`${k.seasonName} ${k.day}, Y${k.year}`, x + 4, y + 3, { size: 7 });
    g.text(k.timeString, x + 4, y + 12, { size: 7, color: '#fff3a8' });
    g.text(`${this.gold}g`, x + w - 4, y + 12, { size: 7, align: 'right', color: '#fff3a8' });
    g.panel(x + 4, y + 24, w - 8, 5, '#24361a');
    g.panel(x + 4, y + 24, (w - 8) * k.energy / MAX_ENERGY, 5, '#86cf5e');
    // Hotbar, top left, with the held item's name under it.
    for (let i = 0; i < HOTBAR; i++) this.drawSlot(i);
    const h = this.inv.held;
    if (h && !this.open) g.text(h.id === 'seeds' ? `${CROPS[SEEDS[this.seed]].name} Seeds` : TOOLS[h.id]?.name ?? CROPS[h.id].name, 5, 24, { size: 5 });
    // Bag grid.
    if (this.open) {
      const [bx, by] = this.slotRect(HOTBAR);
      g.panel(bx - 4, by - 14, 8 * 19 + 7, 2 * 19 + 17, '#3f2631ee');
      const worth = this.binValue(this.inv.slots.slice(HOTBAR + BAG).filter(Boolean));
      g.text(this.pick >= 0 ? 'Now tap where it goes' : this.binOpen ? `Shipping bin above · ${worth}g tonight` : 'Bag: tap two slots to swap', g.w / 2, by - 11, { size: 6, align: 'center' });
      for (let i = HOTBAR; i < HOTBAR + BAG; i++) this.drawSlot(i);
      if (this.binOpen) {
        const [x, y] = this.slotRect(HOTBAR + BAG);
        g.panel(x - 3, y - 3, BIN * 19 + 5, 24, '#8a5a3aee');
        for (let i = HOTBAR + BAG; i < HOTBAR + BAG + BIN; i++) this.drawSlot(i);
      }
      const cr = this.closeRect();
      g.panel(...cr, '#e86a9a'); g.text('Close', cr[0] + cr[2] / 2, cr[1] + 2, { size: 6, align: 'center' });
    }
    if (this.shop) this.drawShop();
    // Help and pause buttons, top right.
    const hb = this.buttons();
    g.panel(...hb.help, '#000000cc'); g.text('?', hb.help[0] + 5, hb.help[1] + 1, { size: 7, align: 'center' });
    g.panel(...hb.map, '#000000cc'); this.drawGlobe(hb.map[0] + 5, hb.map[1] + 5);
    g.panel(...hb.pause, '#000000cc'); g.text('II', hb.pause[0] + 5, hb.pause[1] + 2, { size: 5, align: 'center' });
    // Bag and action buttons, bottom right.
    const b = this.buttons();
    g.panel(...b.bag, this.open ? '#e86a9a' : '#3f2631dd'); g.tile('bag', b.bag[0] + 3, b.bag[1] + 1);
    g.text('Bag', b.bag[0] + 11, b.bag[1] + 15, { size: 5, align: 'center' });
    g.panel(...b.act, '#e86a9a'); g.text('Use', b.act[0] + 11, b.act[1] + 7, { size: 7, align: 'center' });
    // Location name: fades in and out at the top centre after you arrive (lower on narrow screens, clear of the hotbar).
    if (this.banner) {
      const t = this.banner.t, a = t < BANNER[0] ? t / BANNER[0] : t < BANNER[0] + BANNER[1] ? 1 : 1 - (t - BANNER[0] - BANNER[1]) / BANNER[2];
      if (a <= 0) this.banner = null;
      else { g.ctx.globalAlpha = a; g.text(this.banner.text, g.w / 2, g.w > 420 ? 6 : 64, { size: 12, align: 'center', bold: true }); g.ctx.globalAlpha = 1; }
    }
    if (this.toastT > 0) {
      g.panel(4, g.h - 46, g.w - 8, 14);
      g.text(this.toast, g.w / 2, g.h - 43, { size: 7, align: 'center' });
    }
    const d = g.input.drag;
    if (d?.moved) {
      const c = g.ctx;
      c.strokeStyle = '#fff8e888'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(d.x0, d.y0, 16, 0, Math.PI * 2); c.stroke();
      const dx = d.x - d.x0, dy = d.y - d.y0, r = Math.min(16, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
      c.fillStyle = '#fff8e8aa';
      c.beginPath(); c.arc(d.x0 + Math.cos(a) * r, d.y0 + Math.sin(a) * r, 6, 0, Math.PI * 2); c.fill();
    }
  }
}
