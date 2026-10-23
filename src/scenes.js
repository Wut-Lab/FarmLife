// Game scenes: main menu -> character select -> farm.
import { TILE, DIRS, Walker } from './engine.js';
import { Clock, MAX_ENERGY, SEASONS, DAYS_PER_SEASON } from './clock.js';
import { editorMaps, exitRows, isPaved, OPPOSITE, PREFABS, retile } from './map-data.js';
import { LOCATIONS } from './locations.js';

const FARM_LAYOUT = 2; // bump when the farm map changes, so saved plant moves from the old layout are dropped
import { CROPS, SEEDS, Field, aCrop, nCrops, inSeason } from './crops.js';
import { settings, saveSettings, DAY_SPEEDS, sfx, playMusic, stopMusic, musicName, songPlaying } from './audio.js';
import { SLOTS, listSaves, readSave, writeSave, deleteSave } from './save.js';
import { Villager, spawnVillagers, randomSpot, fits, feet, overlaps, planRoute, KEEPERS, STRANGER_LINES } from './villagers.js';
import { SCHEDULES, activity, weekday } from './schedule.js';
import { GOODS, STORE_HOURS, WEAR_SLOTS, storeOpen, goodsOf } from './store.js';
import { Events, MINSTREL_LINES } from './events.js';
import { GATES } from './unlocks.js';
import { Quests } from './quests.js';
import { UPGRADES, START_LEVELS, MAX_LEVEL, toolIcon, toolName, costText, area } from './upgrades.js';
import { FORAGE, SPREAD, scatterForage, bushAt, pickBush, regrowBushes } from './forage.js';
import { PLANTS, DIG_SPOTS, DIG_ENERGY, scatterDigs, digFind } from './dig.js';
import { A } from './art-index.js';
import { PET_CHANCE, KINDS, SOUNDS, TRUST, MAX_PETS, petLook, paintPet, earnTrust } from './pets.js';
import { TRAVELLER_CHANCE, STRANGER_CHANCE, HELLOS, LINES, travellerLook, paintTraveller } from './traveller.js';
import { Support, PEOPLE, PERK_AT, MAX_HEARTS, chatter } from './support.js';
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
  ['Forage', 'Walk over it; Use on berry bushes'],
  ['Tools', "Upgrade at Bella's store (T: Tool upgrades)"],
  ['Strays', 'Pet or give berries: 3 hearts to adopt'],
  ['Eat', 'Use while holding berries'],
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

// The tile a villager stands on, kept inside the map (they can be just past the edge while changing maps).
const tileOf = (m, v) => [Math.min(m.W - 1, Math.max(0, Math.round(v.x / TILE))), Math.min(m.H - 1, Math.max(0, Math.round(v.y / TILE)))];

export class World {
  constructor(sheet, slot = 0, save = null) { this.sheet = sheet; this.slot = slot; this.save = save; }
  enter(g) {
    this.g = g;
    const edited = new URLSearchParams(location.search).get('map') === 'editor' ? editorMaps() : {}; // ?map=editor play-tests the editor's maps
    this.maps = Object.fromEntries(Object.entries(LOCATIONS).map(([id, l]) => [id, { ...(edited[id] ?? l.build()), name: l.name }]));
    this.map = this.maps.farm;
    this.player = new Walker(this.sheet);
    for (const m of Object.values(this.maps)) m.villagers = spawnVillagers(m, sheet => SCHEDULES[sheet]?.length); // scheduled people are placed by schedule()
    this.people = {}; // sheet -> { key, id, v }: each scheduled person and the map they're on right now
    Object.assign(this, this.map.spawn);
    this.clock = new Clock({ msPerTick: DAY_SPEEDS[settings.speed].ms });
    this.menu = null; this.mi = 0; // pause / settings / controls overlay
    this.field = new Field(this.map.plots);
    this.seed = 0;
    this.support = new Support(); this.talk = null; this.fade = null;
    this.inv = new Inventory();
    this.gold = 200;
    this.seeds = { ...Object.fromEntries(SEEDS.map(c => [c, 0])), carrot: 5 };
    this.gear = {}; // things bought at the general store: id -> true
    this.worn = {}; // equipment slot -> id from GOODS
    this.moved = { gone: [], put: [] }; // farm plants moved with the shovel: tiles dug up, and [tile, plant] planted
    this.inv.canBin = id => !!(CROPS[id] || FORAGE[id]); // only crops and forage go in the shipping bin
    this.scatterDigs();
    this.shop = false;
    this.open = false; this.pick = -1;
    this.events = new Events(); // today's random events
    this.quests = new Quests();
    this.levels = { ...START_LEVELS }; this.upgrading = null; // tool levels, and the one Bella has overnight: { tool, level }
    this.tilled = []; this.storeTab = 'goods'; this.pets = []; // pets: adopted cats and dogs (their looks, from pets.js) // farm tiles the hoe has turned into new plots
    this.clock.on('overnight', () => {
      this.quests.tick(0, true);
      if (this.upgrading) { const { tool, level } = this.upgrading; this.levels[tool] = level; this.upgradeNews = ` Bella finished your ${toolName(tool, level)}!`; this.upgrading = null; }
      const k = this.clock, next = k.day >= DAYS_PER_SEASON ? (k.season + 1) % SEASONS.length : k.season;
      this.field.overnight(); this.support.overnight(Math.random, next); this.scatterDigs();
      this.paid = this.binValue(this.inv.emptyBin()); this.withered = 0;
      this.gold += this.paid;
    });
    this.toast = '';
    this.clock.on('season', k => { this.withered = this.field.wither(k.season); });
    this.clock.on('newDay', ({ passedOut }) => {
      this.map = this.maps.farm; Object.assign(this, this.map.spawn); this.player.dir = DIRS.down; // wake up outside the front door
      this.events.newDay();
      const saved = writeSave(this.slot, this.snapshot());
      this.say((passedOut ? 'You passed out! Half energy today.' : 'Good morning!') + this.openGates() + (this.upgradeNews ?? '') + (this.paid ? ` Shipping paid ${this.paid}g.` : '') + (this.withered ? ` ${this.withered} out-of-season crop${this.withered > 1 ? 's' : ''} withered.` : '') + (saved ? ' Game saved.' : '')); this.upgradeNews = '';
    });
    if (this.save) this.restore(this.save); else writeSave(this.slot, this.snapshot());
    playMusic(); // one of two tracks, picked at random each time you enter
  }

  // Everything a save file needs. Saved each morning, so time of day and position aren't stored.
  snapshot() {
    const k = this.clock;
    return {
      v: 1, layout: FARM_LAYOUT, sheet: this.sheet, gold: this.gold, seeds: this.seeds, seed: this.seed, gear: this.gear, worn: this.worn, moved: this.moved, quests: this.quests.state, levels: this.levels, upgrading: this.upgrading, tilled: this.tilled, pets: this.pets,
      clock: { day: k.day, season: k.season, year: k.year, energy: k.energy },
      plots: [...this.field.plots].filter(([, p]) => p), slots: this.inv.slots, sel: this.inv.sel, support: this.support.state,
    };
  }
  restore(s) {
    Object.assign(this.clock, s.clock);
    if (s.layout === FARM_LAYOUT) for (const key of s.tilled ?? []) this.tillTile(key); // new plots first, so their crops have somewhere to go
    for (const [key, p] of s.plots) if (this.field.has(key)) this.field.plots.set(key, p);
    Object.assign(this, { levels: { ...START_LEVELS, ...s.levels }, upgrading: s.upgrading ?? null });
    this.inv.slots = s.slots; this.inv.sel = s.sel;
    Object.assign(this, { gold: s.gold, seeds: { ...this.seeds, ...s.seeds }, seed: s.seed, gear: s.gear ?? {}, worn: s.worn ?? (s.gear?.shoes ? { shoes: 'shoes' } : {}) });
    this.moved = s.layout === FARM_LAYOUT && s.moved || { gone: [], put: [] }; // plants moved on an older farm layout don't carry over
    for (const key of this.moved.gone) this.unplant(key);
    for (const [key, id] of this.moved.put) this.plant(key, id);
    this.quests = new Quests(s.quests);
    this.pets = s.pets ?? []; this.homePets();
    this.wear();
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
      const offX = tx < 0 || tx >= W, offY = ty < 0 || ty >= H;
      if (offX && offY) return true;
      if (offX || offY) { // off the edge only along a road with an exit
        const side = offX ? (tx < 0 ? 'left' : 'right') : (ty < 0 ? 'up' : 'down'), edge = offX ? ty * W + (tx < 0 ? 0 : W - 1) : (ty < 0 ? 0 : H - 1) * W + tx;
        if (!this.map.exits?.[side] || !isPaved(this.map.ground[edge])) return true;
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
    if (inp.hit('KeyQ', 'Tab')) this.nextSeed();
    for (let i = 0; i < HOTBAR; i++) if (inp.hit('Digit' + (i + 1))) inv.sel = i;
    // Tap a slot: select it (tap the seed bag again to change seeds). With the bag open, tap two slots to swap them.
    const n = !this.open ? HOTBAR : HOTBAR + BAG + (this.binOpen ? BIN : 0);
    for (let i = 0; i < n; i++) if (inp.tapIn(...this.slotRect(i))) {
      if (this.open && i >= LOCKED) {
        if (this.pick < 0) this.pick = i; else { inv.swap(this.pick, i); this.pick = -1; }
      } else if (i < HOTBAR) {
        if (inv.sel === i && inv.held?.id === 'seeds') this.nextSeed();
        inv.sel = i;
      }
    }
    if (!this.open && (inp.hit('Space', 'KeyE', 'Enter') || inp.tapIn(...b.act))) this.act();
    this.clock.update(dt * 1000);
    this.schedule();
    this.events.update(this, dt);
    this.quests.tick(this.clock.minutes); this.openGates();
    if (this.toastT > 0) this.toastT -= dt;
    if (this.banner) this.banner.t += dt;
    if (this.open) return this.player.update(dt, false);
    const moving = d.x !== 0 || d.y !== 0;
    if (moving) {
      this.player.dir = Math.abs(d.x) > Math.abs(d.y) ? (d.x < 0 ? DIRS.left : DIRS.right) : (d.y < 0 ? DIRS.up : DIRS.down);
      const sp = SPEED * this.bonus('speed'), nx = this.x + d.x * sp * dt, ny = this.y + d.y * sp * dt; // running shoes: a little faster
      if (!this.blocked(nx, this.y)) this.x = nx;
      if (!this.blocked(this.x, ny)) this.y = ny;
    }
    this.player.update(dt, moving);
    this.gather();
    const me = feet(this.x, this.y);
    for (const v of this.villagers) if (v.heartT > 0) v.heartT -= dt;
    for (const m of Object.values(this.maps)) for (const v of m.villagers) v.update(dt, m === this.map ? (x, y) => overlaps(feet(x, y), me) : () => false);
    this.hop();
    // Walk off the end of the road into the next location.
    const { W, H, exits } = this.map, fx = this.x + 8, fy = this.y + 13; // feet past the edge (only possible on the road)
    const side = fx < 0 ? 'left' : fx > W * TILE ? 'right' : fy < 0 ? 'up' : fy > H * TILE ? 'down' : null;
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
    if (LOCATIONS[id].fresh) this.freshen(id);
    this.map = this.maps[id];
    // Come in on the opposite edge, lined up with the road there; if your row (or column) isn't road, use the nearest one that is.
    const across = side === 'left' || side === 'right', cells = exitRows(this.map, OPPOSITE[side]);
    const near = at => (cells.length && !cells.includes(at) ? cells.reduce((a, b) => (Math.abs(b - at) < Math.abs(a - at) ? b : a)) : at);
    if (across) {
      this.x = side === 'right' ? 0 : (this.map.W - 1) * TILE;
      this.y = near(Math.floor((this.y + 13) / TILE)) * TILE - 4;
    } else {
      this.y = side === 'down' ? -4 : (this.map.H - 1) * TILE - 4;
      this.x = near(Math.floor((this.x + 8) / TILE)) * TILE;
    }
    this.banner = { text: this.map.name, t: 0 }; playMusic(); // each region picks its music on entry
  }
  // A generated place is made anew for each visit, with its own loose earth to dig.
  freshen(id) {
    const m = this.maps[id] = { ...LOCATIONS[id].build(Date.now(), this.clock.seasonName), name: LOCATIONS[id].name, villagers: [] };
    m.digs = scatterDigs(m, DIG_SPOTS[id] ?? 0);
    if (SPREAD[id]) scatterForage(m, SPREAD[id]);
    const spot = id === 'wilds' && Math.random() < TRAVELLER_CHANCE && randomSpot({ ...m, solid: m.solid.map((s, i) => s || m.ground[i].startsWith('shallow')) }); // sometimes someone's out here
    if (spot) {
      const look = travellerLook(), v = new Villager({ sheet: 'traveller', ...spot });
      this.g.images.traveller = paintTraveller(this.g.images, look);
      Object.assign(v, { name: look.name, met: false });
      m.villagers.push(v);
    }
    const hood = id === 'wilds' && Math.random() < STRANGER_CHANCE && randomSpot({ ...m, solid: m.solid.map((s, i) => s || m.ground[i].startsWith('shallow')) }); // and, rarely, the hooded stranger
    if (hood) m.villagers.push(new Villager({ sheet: 'wanderer', x: hood.x, y: hood.y, size: 0 }));
    for (let i = 0; id === 'wilds' && i < 2 && Math.random() < PET_CHANCE; i++) { // a stray cat or dog or two, wandering about
      const at = randomSpot({ ...m, solid: m.solid.map((s, j) => s || m.ground[j].startsWith('shallow')) });
      if (!at) break;
      const look = petLook(), sheet = `pet${i}`;
      this.g.images[sheet] = paintPet(this.g.images, look);
      m.villagers.push(Object.assign(new Villager({ sheet, ...at, size: look.kind === 'cat' && Math.random() < 0.3 ? 0 : 1 }), { role: 'pet', px: 11, name: look.name, about: look.about, kind: KINDS[look.kind], look, trust: 0 }));
    }
  }
  get villagers() { return this.map.villagers; }
  // Petting a cat or dog. Strays warm up to you (see pets.js): at full trust, Use again takes them home to the farm.
  petPet(v) {
    v.walker.dir = [DIRS.up, DIRS.right, DIRS.left, DIRS.down][this.player.dir]; v.wait = 2;
    const said = SOUNDS[v.kind][Math.floor(Math.random() * SOUNDS[v.kind].length)], hi = !v.met; v.met = true;
    if (v.home) { v.heartT = 1.2; return this.say(`${v.name} ${said}`); }
    if (v.trust >= TRUST) { // trusts you: home it goes, if there's room
      if (this.pets.length >= MAX_PETS) return this.say(`${v.name} wants to come home with you, but your farm has all the pets it can handle for now.`);
      this.pets.push(v.look); this.map.villagers.splice(this.map.villagers.indexOf(v), 1); this.homePets(); sfx('coin');
      return this.say(`You adopted ${v.name}! They'll be waiting for you on the farm.`);
    }
    const treat = this.inv.held?.id === 'berries' && !v.fed, now = this.clock.minutes;
    if (treat && earnTrust(v, now, true)) this.inv.take('berries', 1);
    const got = treat || earnTrust(v, now);
    if (got) v.heartT = 1.2;
    const start = hi ? `A stray ${v.about}! It seems to answer to "${v.name}". ` : '';
    if (treat) return this.say(`${start}${v.name} gobbles up a berry! (${v.trust}/${TRUST} hearts)` + (v.trust >= TRUST ? ' Use again to take them home.' : ''));
    if (!got) return this.say(`${v.name} ${said} Give them a little time to get to know you.`);
    return this.say(`${start}${hi ? 'It' : v.name} ${said} (${v.trust}/${TRUST} hearts)` + (v.trust >= TRUST ? ` ${v.name} trusts you! Use again to take them home.` : ''));
  }
  // Adopted pets roam the farm near the house, each on its own painted sheet.
  homePets() {
    const m = this.maps.farm, [dx, dy] = m.door.split(',').map(Number);
    m.villagers = m.villagers.filter(v => !v.home);
    // Open 2x2 squares in front of the house, nearest the yard first; not on plots or where you wake up.
    const taken = new Set([`${Math.round(m.spawn.x / TILE)},${Math.round(m.spawn.y / TILE)}`]), spots = [], all = [];
    for (let y = dy + 1; y < dy + 10; y++) for (let x = dx - 9; x <= dx + 9; x++) all.push([x, y]);
    all.sort(([ax, ay], [bx, by]) => Math.hypot(ax - dx, ay - dy - 3) - Math.hypot(bx - dx, by - dy - 3));
    for (const [x, y] of all) {
      const near = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => `${x + a},${y + b}`);
      if (fits(m, { x, y, size: 1 }) && !near.some(k => m.plots.includes(k) || this.field.has(k) || taken.has(k))) { spots.push([x, y]); near.forEach(k => taken.add(k)); }
    }
    this.pets.forEach((look, i) => {
      const [x, y] = spots[i] ?? [dx, dy + 2], sheet = `home${i}`;
      this.g.images[sheet] = paintPet(this.g.images, look);
      m.villagers.push(Object.assign(new Villager({ sheet, x, y, size: look.kind === 'cat' && i % 2 ? 0 : 1 }), { role: 'pet', px: 11, home: true, name: look.name, kind: KINDS[look.kind] }));
    });
  }
  // Swing open any gate whose unlock has been earned; returns its news (for the morning message), or ''.
  openGates() {
    let news = '';
    for (const [id, g] of Object.entries(GATES)) {
      const m = this.maps[id];
      if (!m?.gates.length || !g.open(this)) continue;
      for (const o of m.objects) if (o.tiles[0][0] === 'gate_0') o.tiles = PREFABS.gate_open.tiles;
      for (const k of m.gates) { const [x, y] = k.split(',').map(Number); m.solid[y * m.W + x] = 0; }
      m.gates = []; news += ` ${g.opened}`;
    }
    return news;
  }
  // Pick up forage (pinecones, stones) you walk over.
  // With the forage basket, anything within its reach (1-3 tiles) too.
  gather() {
    if (!this.map.forage?.size) return;
    const tx = Math.floor((this.x + 8) / TILE), ty = Math.floor((this.y + 13) / TILE), reach = this.busy('basket') ? 0 : this.levels.basket;
    for (const [k, id] of this.map.forage) {
      const [x, y] = k.split(',').map(Number);
      if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) > reach) continue;
      if (!this.inv.add(id)) { if (this.toast !== 'Your bag is full.' || this.toastT <= 0) this.say('Your bag is full.'); return; }
      this.map.forage.delete(k); sfx('harvest'); this.say(`Picked up a ${FORAGE[id].name.toLowerCase()}.`);
    }
  }
  busy(tool) { return this.upgrading?.tool === tool; } // Bella has it today
  // Turn a farm tile into a new plot of tilled soil, joined up with the soil around it.
  tillTile(key) {
    const m = this.maps.farm, [x, y] = key.split(',').map(Number);
    if (this.field.has(key)) return;
    m.ground[y * m.W + x] = 'soil0'; retile(m, x, y, 1);
    m.plots.push(key); this.field.plots.set(key, null);
    if (!this.tilled.includes(key)) this.tilled.push(key);
    this.mini = null;
  }
  tillable(key) {
    const m = this.map, [x, y] = key.split(',').map(Number);
    if (!this.onFarm || x < 1 || y < 1 || x >= m.W - 1 || y >= m.H - 1 || this.field.has(key)) return false;
    return m.ground[y * m.W + x].startsWith('grass') && !m.solid[y * m.W + x] && ![m.door, ...m.bin].includes(key) && !m.forage?.has(key) && !m.digs?.has(key)
      && !m.objects.some(o => o.tiles.some((row, j) => row.some((_, i) => `${o.x / TILE + i},${o.y / TILE + j}` === key)));
  }
  // The hoe (level 2+) tills grass into new plots; level 3 does 3 tiles at once for the energy of one.
  till(key) {
    const lv = this.levels.hoe, keys = area('hoe', lv, key.split(',').map(Number), this.dirVec()).map(([x, y]) => `${x},${y}`).filter(k => this.tillable(k));
    if (!keys.length) return false;
    if (!this.clock.useEnergy(2)) { sfx('nope'); this.say('Too tired. Sleep at your front door.'); return true; }
    keys.forEach(k => this.tillTile(k)); sfx('dig');
    this.say(keys.length > 1 ? `Tilled ${keys.length} new plots.` : 'Tilled a new plot.');
    return true;
  }
  // The watering can (level 2+) waters every planted, dry plot in its area for the energy of one.
  water(key) {
    const f = this.field, keys = area('can', this.levels.can, key.split(',').map(Number), this.dirVec()).map(([x, y]) => `${x},${y}`).filter(k => f.get(k) && !f.get(k).wet);
    if (!keys.length) return false;
    if (!this.clock.useEnergy(this.support.has('green_thumb') ? 0 : 1)) { sfx('nope'); this.say('Too tired. Sleep at your front door.'); return true; }
    keys.forEach(k => f.act(k)); sfx('water');
    this.say(`Watered ${keys.length} plot${keys.length > 1 ? 's' : ''}.`);
    return true;
  }
  dirVec() { return [[0, 1], [-1, 0], [1, 0], [0, -1]][this.player.dir]; }
  // Pick a berry bush you're facing (it's bare until morning).
  pickBerries(o) {
    const n = pickBush(o);
    if (!n) return this.say("No berries left. They'll grow back by morning.");
    if (!this.inv.add('berries', n)) { regrowBushes({ objects: [o] }); return this.say('Your bag is full.'); }
    sfx('harvest'); this.say(`Picked ${n} ${n > 1 ? 'berries' : 'berry'}!`);
  }
  eat(id) {
    const k = this.clock;
    if (k.energy >= k.max) return this.say("You're already full of energy.");
    this.inv.take(id, 1); k.energy = Math.min(k.max, k.energy + FORAGE[id].energy); sfx('harvest');
    this.say(`Ate some ${FORAGE[id].name.toLowerCase()}. +${FORAGE[id].energy} energy!`);
  }
  // The minstrel's song while you're near him; the region's music otherwise.
  song(near) { if (near !== songPlaying('minstrel')) playMusic(near ? 'minstrel' : undefined); }
  found(msg) { sfx('coin'); this.say(msg); }

  // Send scheduled people somewhere new when their rule changes (wanderers pick a new spot each hour).
  // Awake, they walk there; waking up or going to bed, they just appear or vanish. Talking to someone holds them up:
  // the game doesn't run while you talk or shop, and they wait a moment after you're done.
  schedule() {
    const k = this.clock, hour = Math.floor(k.minutes / 60), day = weekday(k.day);
    for (const [sheet, rules] of Object.entries(SCHEDULES)) {
      if (!rules.length) continue; // not scheduled yet
      const r = activity(rules, hour, day, k.seasonName), map = this.maps[r.map];
      const key = r.act === 'sleep' || !map ? 'sleep' : `${k.day}:${rules.indexOf(r)}${r.act === 'wander' ? ':' + hour : ''}`;
      const p = this.people[sheet];
      if (p?.key === key) continue;
      const spot = key === 'sleep' ? null : r.act === 'wander' ? randomSpot(map) : fits(map, r) ? { x: r.x, y: r.y, size: r.size ?? 0 } : null;
      const here = p?.v && this.maps[p.id], legs = spot && here && planRoute(this.maps, p.id, tileOf(here, p.v), r.map, [spot.x, spot.y]);
      if (legs) { p.v.go(legs, spot); p.key = key; continue; }
      if (here) here.villagers.splice(here.villagers.indexOf(p.v), 1);
      const v = spot && new Villager({ sheet, ...spot });
      if (v) map.villagers.push(v);
      this.people[sheet] = { key, id: r.map, v };
    }
  }
  // Move travelling villagers who've walked off a map's edge into the next map.
  hop() {
    for (const p of Object.values(this.people)) {
      if (!p.v?.hopping) continue;
      const from = this.maps[p.id].villagers;
      from.splice(from.indexOf(p.v), 1);
      p.v.legs.shift(); p.id = p.v.legs[0].map;
      [p.v.x, p.v.y] = p.v.legs[0].from;
      this.maps[p.id].villagers.push(p.v);
    }
  }
  get mapId() { return Object.keys(this.maps).find(id => this.maps[id] === this.map); }
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
    if (v?.role === 'stranger') { // turns to you, says something cryptic
      v.walker.dir = [DIRS.up, DIRS.right, DIRS.left, DIRS.down][this.player.dir]; v.wait = 2;
      this.say(`Hooded stranger: ${STRANGER_LINES[Math.floor(Math.random() * STRANGER_LINES.length)]}`);
      return this.openShop(v);
    }
    if (v?.role === 'minstrel') { // stops to sing you a line
      v.walker.dir = [DIRS.up, DIRS.right, DIRS.left, DIRS.down][this.player.dir]; v.wait = 2;
      return this.say(`Wandering minstrel: ${MINSTREL_LINES[Math.floor(Math.random() * MINSTREL_LINES.length)]}`);
    }
    if (v?.role === 'pet') return this.petPet(v);
    if (v?.role === 'traveller') { // introduces themself, then just chats
      v.walker.dir = [DIRS.up, DIRS.right, DIRS.left, DIRS.down][this.player.dir]; v.wait = 2;
      const pick = a => a[Math.floor(Math.random() * a.length)], hi = !v.met; v.met = true;
      return this.say(`${v.name}: ${hi ? `Oh, hello! I'm ${v.name}. ${pick(HELLOS)}` : pick(LINES)}`);
    }
    const q = v && this.quests.talk(v.walker.sheet, id => this.inv.count(id), (id, n) => this.inv.take(id, n));
    if (q?.lines) { // a quest conversation
      v.walker.dir = [DIRS.up, DIRS.right, DIRS.left, DIRS.down][this.player.dir]; v.wait = 2;
      if (q.gold) { this.gold += q.gold; sfx('coin'); }
      this.talk = { id: v.walker.sheet, name: KEEPERS[v.walker.sheet]?.name ?? PEOPLE[v.walker.sheet]?.name, lines: q.lines }; return;
    }
    if (q?.remind) this.say(`${KEEPERS[v.walker.sheet]?.name ?? PEOPLE[v.walker.sheet]?.name}: ${q.remind}`);
    if (v) return v.role !== 'shop' ? this.meet(v) : this.closed(v.walker.sheet) ? this.say(this.closed(v.walker.sheet)) : this.openShop(v);
    if (key === this.map.door) { sfx('sleep'); return this.clock.sleep(); }
    if (this.map.gates?.includes(key)) { const g = GATES[this.mapId]; if (g && !g.open(this)) return this.say(g.locked); }
    const bush = bushAt(this.map, key);
    if (bush) return this.pickBerries(bush);
    const counter = Object.keys(KEEPERS).find(k => key === this.map[KEEPERS[k].building]);
    if (counter) { // the keeper sells, if they're here; otherwise the door opens the shop
      if (this.closed(counter)) return this.say(this.closed(counter));
      const keeper = this.villagers.find(v => v.walker.sheet === counter);
      return keeper ? this.say(`${KEEPERS[counter].name} runs the ${KEEPERS[counter].building}. Talk to them outside.`) : (this.shop = counter);
    }
    if (this.map.bin.includes(key)) { this.open = this.binOpen = true; this.pick = -1; return; }
    if (UPGRADES[held] && this.busy(held)) return this.say(`Bella has your ${toolName(held, this.levels[held])} until tomorrow morning.`);
    if (held === 'hoe' && this.levels.hoe >= 2 && this.till(key)) return;
    if (held === 'can' && this.levels.can >= 2 && this.onFarm && this.water(key)) return;
    if (held === 'shovel') return this.dig(key);
    if (PLANTS[held]) return this.replant(key, held);
    if (FORAGE[held]?.energy) return this.eat(held);
    if (!this.onFarm || !f.has(key)) return CROPS[held] && this.say(`That's ${aCrop(held)}.`);
    const p = f.get(key), tired = () => { sfx('nope'); this.say('Too tired. Sleep at your front door.'); };
    if (f.isRipe(p)) {
      if (!this.inv.add(p.crop)) return this.say('Your bag is full.');
      sfx('harvest'); f.act(key);
      const extra = Object.values(this.worn).reduce((n, id) => n + (GOODS[id]?.extraCrop === p.crop ? GOODS[id].extra : 0), 0); // the salesman's clothes: bonus peas
      if (Math.random() < extra && this.inv.add(p.crop)) return this.say(`Harvested ${aCrop(p.crop)}, and a bonus one!`); // the salesman's clothes
      return this.say(`Harvested ${aCrop(p.crop)}!`);
    }
    if (held === 'seeds') {
      if (p) return this.say(`Something is already growing here.`);
      const seed = SEEDS[this.seed];
      if (!this.seeds[seed]) return this.say(`Out of ${CROPS[seed].name} seeds. Buy more at the shop.`);
      if (!inSeason(seed, this.clock.season)) return this.say(`${CROPS[seed].name} only grows in ${SEASONS[CROPS[seed].season]}.`);
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
    const lines = [], cap = t => t[0].toUpperCase() + t.slice(1);
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
        lines.push({ love: `${cap(aCrop(held))}! I love these! Thank you!`, like: `Oh, ${aCrop(held)}. Thanks!`,
          neutral: `${cap(aCrop(held))}? Thanks, I suppose.`, dislike: `Ugh... ${aCrop(held)}. Not my favourite.` }[r.taste]);
      }
    } else {
      rewards = sup.talk(id);
      const say = [...who.hello, ...chatter(this.clock.minutes, this.clock.season)];
      lines.push(say[Math.floor(Math.random() * say.length)]);
    }
    const q = sup.people[id].quest;
    if (q) lines.push(`Could you bring me ${q.n} ${nCrops(q.item, q.n)}? I'll pay ${q.gold}g. (${q.days} day${q.days > 1 ? 's' : ''} left)`);
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
    const g = this.g, { id, lines } = this.talk, who = PEOPLE[id], w = Math.min(g.w - 16, 220), x = Math.round(g.w / 2 - w / 2); // who: villagers with hearts
    const paras = lines.map(l => this.wrap(l, w - 12, 6)), h = 26 + paras.flat().length * 8 + (paras.length - 1) * 4, y = g.h - h - 34;
    g.panel(x, y, w, h, '#3f2631f2');
    g.text(this.talk.name ?? who.name, x + 6, y + 4, { size: 7, color: '#fff3a8' });
    if (who) drawHearts(g, x + w - 6 - MAX_HEARTS * 6, y + 6, this.support.hearts(id));
    let ty = y + 16;
    for (const p of paras) { for (const l of p) { g.text(l, x + 6, ty, { size: 6 }); ty += 8; } ty += 4; }
    g.text('Tap or press Space', x + w - 6, y + h - 9, { size: 5, align: 'right', color: '#dcebc6' });
  }

  // Close button under the bag (and shipping bin) panel.
  closeRect() { const [, by] = this.slotRect(HOTBAR); return [this.g.w / 2 - 18, by + 45, 36, 11]; }

  // Shipping bin: 5 slots, filled from the bag; everything in it is sold overnight.
  binValue(stacks) { return stacks.reduce((sum, s) => sum + (CROPS[s.id] ? this.sellPrice(s.id) : FORAGE[s.id]?.price ?? 0) * s.n, 0); }
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
      { label: 'Equipment', go: () => this.openMenu('equipment') },
      { label: 'Friends', go: () => this.openMenu('friends') },
      { label: 'Quests', go: () => this.openMenu('quests') },
      { label: 'Controls', go: () => this.openMenu('controls') },
      { label: 'Settings', go: () => this.openMenu('settings') },
      { label: 'Quit to title', go: () => { stopMusic(); this.g.go(new SaveSelect()); } },
    ];
    if (this.menu === 'equipment') return [
      ...Object.entries(WEAR_SLOTS).map(([slot, label]) => {
        const opts = [null, ...Object.keys(GOODS).filter(id => GOODS[id].slot === slot && this.gear[id])], cur = this.worn[slot] ?? null;
        return { label, value: cur ? GOODS[cur].short : opts.length > 1 ? 'None' : 'Nothing yet',
          adj: d => this.wear(slot, opts[(opts.indexOf(cur) + d + opts.length) % opts.length]) };
      }),
      { label: 'Back', go: () => this.openMenu('pause') },
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
    const g = this.g, items = this.menuItems(), lines = this.menu === 'controls' ? CONTROLS.length : this.menu === 'friends' ? Object.keys(PEOPLE).length * 3 : this.menu === 'equipment' ? 2 : this.menu === 'quests' ? 2 * Math.max(1, this.quests.log(() => 0).length) : 0;
    const w = this.menu === 'friends' || this.menu === 'quests' ? 170 : this.menu === 'equipment' ? 180 : 150, h = 22 + lines * 9 + items.length * 18, x = Math.round(g.w / 2 - w / 2), y = Math.round(g.h / 2 - h / 2);
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
    const title = { pause: 'Paused', settings: 'Settings', controls: 'Controls', friends: 'Friends', equipment: 'Equipment', quests: 'Quests' }[this.menu];
    g.text(title, x + w / 2, y + 5, { size: 8, align: 'center', color: '#fff3a8' });
    if (this.menu === 'pause') g.text(`Saved this morning · ♪ ${musicName()}`, x + w / 2, y + h + 3, { size: 5, align: 'center', color: '#e2f0d4' });
    if (this.menu === 'friends') Object.entries(PEOPLE).forEach(([id, who], i) => {
      const p = this.support.people[id], n = this.support.hearts(id), yy = top + i * 27;
      g.text(who.name, x + 8, yy, { size: 6, color: '#fff3a8' });
      drawHearts(g, x + w - 8 - MAX_HEARTS * 6, yy + 2, n);
      const q = p.quest;
      g.text(q ? `Wants ${q.n} ${nCrops(q.item, q.n)} · ${q.gold}g · ${q.days}d left` : 'No request right now', x + 8, yy + 8, { size: 5 });
      g.text(`${n >= PERK_AT ? 'Perk' : `Perk at ${PERK_AT} hearts`}: ${who.perk.text}`, x + 8, yy + 15, { size: 5, color: n >= PERK_AT ? '#86cf5e' : '#dcebc6' });
    });
    if (this.menu === 'equipment') {
      const on = Object.values(this.worn).map(id => GOODS[id].about);
      this.wrap(on.length ? on.join(' ') : 'Buy clothes at the General Store, then wear them here.', w - 16, 5).slice(0, 2)
        .forEach((l, i) => g.text(l, x + 8, top + i * 9, { size: 5, color: on.length ? '#86cf5e' : '#dcebc6' }));
    }
    if (this.menu === 'quests') {
      const log = this.quests.log(id => this.inv.count(id));
      if (!log.length) g.text('No quests yet. Keep talking to people in town!', x + 8, top + 4, { size: 5, color: '#dcebc6' });
      log.forEach((q, i) => { g.text(q.title, x + 8, top + i * 18, { size: 6, color: '#fff3a8' }); g.text(q.text, x + 8, top + i * 18 + 8, { size: 5, color: q.done ? '#86cf5e' : '#e2f0d4' }); });
    }
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

  // Equipment: what's worn, and what it adds up to.
  bonus(kind) { return Object.values(this.worn).reduce((b, id) => (kind === 'speed' ? b * (GOODS[id]?.speed ?? 1) : b + (GOODS[id]?.[kind] ?? 0)), kind === 'speed' ? 1 : 0); }
  wear(slot, id) {
    if (slot) { if (id) this.worn[slot] = id; else delete this.worn[slot]; }
    this.clock.max = MAX_ENERGY + this.bonus('energy');
    this.clock.energy = Math.min(this.clock.energy, this.clock.max);
  }

  // The shovel: loose earth turns up finds; small plants come up so you can replant them on your farm.
  // Each morning (and on a new game): fresh loose earth, berry bushes grow back, a few pinecones and stones on the farm.
  scatterDigs() {
    for (const [id, n] of Object.entries(DIG_SPOTS)) if (this.maps[id]) this.maps[id].digs = scatterDigs(this.maps[id], n);
    for (const m of Object.values(this.maps)) regrowBushes(m);
    scatterForage(this.maps.farm, SPREAD.farm);
  }
  plantAt(key, map = this.map) {
    return map.objects.find(o => `${o.x / TILE},${o.y / TILE}` === key && o.tiles.length === 1 && o.tiles[0].length === 1 && PLANTS[o.tiles[0][0]]);
  }
  unplant(key, map = this.maps.farm) {
    const o = this.plantAt(key, map); if (!o) return null;
    const [x, y] = key.split(',').map(Number);
    map.objects.splice(map.objects.indexOf(o), 1); map.solid[y * map.W + x] = 0;
    return o.tiles[0][0];
  }
  plant(key, id, map = this.maps.farm) {
    const [x, y] = key.split(',').map(Number);
    map.objects.push({ x: x * TILE, y: y * TILE, base: (y + 1) * TILE, tiles: [[id]] });
    if (!PLANTS[id].walk) map.solid[y * map.W + x] = 1;
  }
  dig(key) {
    const m = this.map, tired = () => { sfx('nope'); this.say('Too tired. Sleep at your front door.'); };
    if (m.digs?.has(key)) {
      if (!this.clock.useEnergy(DIG_ENERGY)) return tired();
      const f = digFind(Math.random, this.levels.shovel); m.digs.delete(key); sfx('dig');
      if (f.gold) { this.gold += f.gold; sfx('coin'); return this.say(`Found some old coins! (+${f.gold}g)`); }
      if (f.seeds) { this.seeds[f.seeds] += f.n; return this.say(`Found ${f.n} ${CROPS[f.seeds].name} seed${f.n > 1 ? 's' : ''}!`); }
      if (f.item) return this.say(this.inv.add(f.item) ? `Found ${aCrop(f.item)}, growing wild!` : 'Found something, but your bag is full.');
      if (f.plant) return this.say(this.inv.add(f.plant) ? `Found ${PLANTS[f.plant].name}! Plant it on your farm.` : 'Found something, but your bag is full.');
      return this.say('Just dirt this time.');
    }
    const o = this.plantAt(key);
    if (!o) return this.say('Nothing to dig up here. Look for loose earth.');
    if (!this.onFarm) return this.say("That isn't yours to dig up. Try the plants on your farm.");
    const id = o.tiles[0][0];
    if (!this.inv.add(id)) return this.say('Your bag is full.');
    if (!this.clock.useEnergy(DIG_ENERGY)) { this.inv.take(id, 1); return tired(); }
    this.unplant(key); sfx('dig');
    const put = this.moved.put.findIndex(([k]) => k === key);
    if (put >= 0) this.moved.put.splice(put, 1); else this.moved.gone.push(key);
    this.say(`Dug up the ${PLANTS[id].name}. Plant it anywhere on your farm.`);
  }
  replant(key, id) {
    const m = this.map, [x, y] = key.split(',').map(Number);
    if (!this.onFarm) return this.say('Plant it on your farm.');
    const taken = this.field.has(key) || [m.door, ...m.bin].includes(key) || m.objects.some(o => o.tiles.some((row, j) => row.some((_, i) => `${o.x / TILE + i},${o.y / TILE + j}` === key)));
    if (x < 0 || y < 0 || x >= m.W || y >= m.H || taken || m.solid[y * m.W + x] || !m.ground[y * m.W + x].startsWith('grass')) return this.say('It needs an open patch of grass.');
    this.inv.take(id, 1); this.plant(key, id); sfx('plant');
    this.moved.put.push([key, id]);
    this.say(`Planted the ${PLANTS[id].name}.`);
  }

  // Why a keeper's shop is closed right now, or '' if it's open (only the general store keeps hours).
  closed(keeper) {
    const h = h => `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}`;
    return keeper === 'storekeeper' && !storeOpen(this.clock.minutes) ? `The General Store is closed. Open ${h(STORE_HOURS[0])} to ${h(STORE_HOURS[1])}.` : '';
  }
  // A shopkeeper turns to you and opens their shop.
  openShop(v) {
    v.walker.dir = [DIRS.up, DIRS.right, DIRS.left, DIRS.down][this.player.dir]; v.wait = 2;
    this.shop = v.walker.sheet; sfx('click');
  }

  // Next seed you have any of (Q, or tapping the seed bag again).
  nextSeed() {
    for (let i = 1; i <= SEEDS.length; i++) if (this.seeds[SEEDS[(this.seed + i) % SEEDS.length]]) { this.seed = (this.seed + i) % SEEDS.length; return; }
    this.seed = (this.seed + 1) % SEEDS.length;
  }
  // Seed shop: buy seeds (year-round ones and this season's, or the keeper's own stock), sell crops.
  shopSeeds() { return KEEPERS[this.shop]?.stock ?? SEEDS.filter(c => !CROPS[c].rare && inSeason(c, this.clock.season)); }
  shopRows() {
    const g = this.g, n = this.shopSeeds().length, h = 38 + n * 20, x = Math.round(g.w / 2 - 70), y = Math.round(g.h / 2 - h / 2);
    return { x, y, h, buy: this.shopSeeds().map((_, i) => [x + 4, y + 16 + i * 20, 132, 18]),
      ...(KEEPERS[this.shop]?.noBuying ? { close: [x + 38, y + 18 + n * 20, 64, 14] } : { sell: [x + 4, y + 18 + n * 20, 64, 14], close: [x + 72, y + 18 + n * 20, 64, 14] }) }; // some keepers don't buy crops
  }
  shopUpdate(inp, dt) {
    const r = this.shopRows();
    this.clock.update(dt * 1000);
    if (this.toastT > 0) this.toastT -= dt;
    this.player.update(dt, false);
    if (goodsOf(this.shop).length) return this.storeUpdate(inp);
    this.shopSeeds().forEach((s, i) => {
      if (!inp.hit('Digit' + (i + 1)) && !inp.tapIn(...r.buy[i])) return;
      const c = CROPS[s];
      if (this.gold < this.seedCost(c)) return this.say(`Not enough gold for ${c.name} seeds.`);
      sfx('coin'); this.gold -= this.seedCost(c); this.seeds[s]++; this.say(`Bought ${c.name} seeds. You have ${this.seeds[s]}.`);
    });
    if (r.sell && (inp.hit('KeyS') || inp.tapIn(...r.sell))) {
      const earned = SEEDS.reduce((sum, s) => sum + this.inv.take(s) * this.sellPrice(s), 0) + Object.keys(FORAGE).reduce((sum, id) => sum + this.inv.take(id) * FORAGE[id].price, 0);
      if (earned) sfx('coin'); this.gold += earned; this.say(earned ? `Sold your harvest for ${earned}g.` : 'Nothing to sell.');
    }
    if (inp.hit('Escape', 'KeyE', 'Space') || inp.tapIn(...r.close)) this.shop = false;
  }
  drawShop() {
    if (goodsOf(this.shop).length) return this.drawStore();
    const g = this.g, r = this.shopRows();
    g.panel(r.x, r.y, 140, r.h, '#3f2631ee');
    const keeper = typeof this.shop === 'string' && this.shop; // whose shop (true: an old-style shop with no keeper)
    if (keeper && this.villagers.some(v => v.walker.sheet === keeper)) { g.panel(r.x - 26, r.y, 24, 24, '#3f2631ee'); new Walker(keeper).draw(g, r.x - 22, r.y + 2); }
    g.text(`${KEEPERS[keeper]?.title ?? 'Seed Shop'} · ${this.gold}g`, r.x + 70, r.y + 4, { size: 7, align: 'center', color: '#fff3a8' });
    this.shopSeeds().forEach((s, i) => {
      const c = CROPS[s], [x, y, w, h] = r.buy[i];
      g.panel(x, y, w, h, '#5d7150cc');
      g.tile(c.packet, x + 1, y + 1);
      g.text(`${i + 1}. ${c.name}`, x + 20, y + 5, { size: 6 });
      g.text(`own ${this.seeds[s]}`, x + 82, y + 5, { size: 5, color: '#dcebc6' });
      g.text(`${this.seedCost(c)}g`, x + w - 3, y + 5, { size: 6, align: 'right', color: '#fff3a8' });
    });
    if (r.sell) { g.panel(...r.sell, '#e86a9a'); g.text('Sell harvest (S)', r.sell[0] + 32, r.sell[1] + 4, { size: 5, align: 'center' }); }
    g.panel(...r.close, '#5d7150'); g.text('Close (Esc)', r.close[0] + 32, r.close[1] + 4, { size: 5, align: 'center' });
  }

  // Goods shops (Bella's general store, the clothes salesman): each thing bought once.
  // Bella's has two pages: goods, and tool upgrades (T or tap a tab to switch).
  storeList() {
    return this.shop === 'storekeeper' && this.storeTab === 'tools' ? Object.keys(UPGRADES).map(tool => ({ tool })) : goodsOf(this.shop).map(id => ({ id }));
  }
  storeRows() {
    const g = this.g, list = this.storeList(), tabs = this.shop === 'storekeeper', rh = tabs && this.storeTab === 'tools' ? 25 : 26;
    const w = 160, top = tabs ? 30 : 16, n = list.length, h = top + 22 + n * rh, x = Math.round(g.w / 2 - w / 2), y = Math.round(g.h / 2 - h / 2);
    return { x, y, w, h, tabs: tabs && [[x + 4, y + 14, 74, 12], [x + 82, y + 14, 74, 12]], buy: list.map((_, i) => [x + 4, y + top + i * rh, w - 8, rh - 2]),
      close: [x + w / 2 - 32, y + top + 4 + n * rh, 64, 14] };
  }
  storeUpdate(inp) {
    const r = this.storeRows();
    if (r.tabs) for (const [i, tab] of ['goods', 'tools'].entries()) if (inp.tapIn(...r.tabs[i]) && this.storeTab !== tab) { this.storeTab = tab; return sfx('click'); }
    if (r.tabs && inp.hit('KeyT', 'Tab')) { this.storeTab = this.storeTab === 'goods' ? 'tools' : 'goods'; return sfx('click'); }
    this.storeList().forEach((row, i) => {
      if (!inp.hit('Digit' + (i + 1)) && !inp.tapIn(...r.buy[i])) return;
      if (row.tool) return this.upgrade(row.tool);
      const id = row.id, it = GOODS[id];
      if (this.gear[id]) return this.say(`You already have the ${it.name}.`);
      if (this.gold < it.price) return this.say(`Not enough gold for the ${it.name}.`);
      if (id === 'shovel' && !this.inv.add('shovel')) return this.say('Your bag is full.');
      sfx('coin'); this.gold -= it.price; this.gear[id] = true;
      if (!it.slot) return this.say(`Bought the ${it.name}! It's in your bag.`);
      const on = !this.worn[it.slot]; if (on) this.wear(it.slot, id);
      const them = it.them ? 'them' : 'it';
      this.say(`Bought the ${it.name}! ` + (on ? `You put ${them} on.` : `Wear ${them} from Pause > Equipment.`));
    });
    if (inp.hit('Escape', 'KeyE', 'Space') || inp.tapIn(...r.close)) this.shop = false;
  }
  // Buy the next level of a tool: the basket's first level is bought outright; upgrades stay with Bella overnight.
  upgrade(tool) {
    const lv = this.levels[tool], u = UPGRADES[tool], cost = u.cost[lv];
    if (lv >= MAX_LEVEL) return this.say(`Your ${toolName(tool, lv)} is as good as it gets.`);
    if (tool === 'shovel' && !this.gear.shovel) return this.say('Buy the shovel first.');
    if (this.upgrading) return this.say(`Bella is still working on your ${toolName(this.upgrading.tool, this.upgrading.level)}.`);
    const short = Object.entries(cost).find(([k, n]) => (k === 'gold' ? this.gold : this.inv.count(k)) < n);
    if (short) return this.say(`You need ${costText(cost)}.`);
    for (const [k, n] of Object.entries(cost)) if (k === 'gold') this.gold -= n; else this.inv.take(k, n);
    sfx('coin');
    if (lv === 0) { this.levels[tool] = 1; return this.say(`Bought the ${u.name}! It picks up forage near you as you walk.`); }
    this.upgrading = { tool, level: lv + 1 };
    this.say(`Bella will have your ${toolName(tool, lv + 1)} ready tomorrow morning.`);
  }
  drawStore() {
    const g = this.g, r = this.storeRows();
    g.panel(r.x, r.y, r.w, r.h, '#3f2631ee');
    if (this.villagers.some(v => v.walker.sheet === this.shop)) { g.panel(r.x - 26, r.y, 24, 24, '#3f2631ee'); new Walker(this.shop).draw(g, r.x - 22, r.y + 2); }
    g.text(`${KEEPERS[this.shop].title} · ${this.gold}g`, r.x + r.w / 2, r.y + 4, { size: 7, align: 'center', color: '#fff3a8' });
    if (r.tabs) for (const [i, [tab, label]] of [['goods', 'Goods'], ['tools', 'Tool upgrades (T)']].entries()) {
      g.panel(...r.tabs[i], this.storeTab === tab ? '#e86a9a' : '#5d715099'); g.text(label, r.tabs[i][0] + 37, r.tabs[i][1] + 3, { size: 5, align: 'center' });
    }
    this.storeList().forEach((row, i) => {
      const [x, y, w, h] = r.buy[i];
      if (row.tool) {
        const lv = this.levels[row.tool], max = lv >= MAX_LEVEL, away = this.busy(row.tool), next = max ? lv : lv + 1;
        g.panel(x, y, w, h, max || away ? '#5d715066' : '#5d7150cc');
        g.tile(toolIcon(row.tool, next), x + 2, y + 4);
        g.text(`${i + 1}. ${toolName(row.tool, next)}${lv === 0 ? '' : max ? ' (best)' : ''}`, x + 21, y + 2, { size: 6 });
        g.text(UPGRADES[row.tool].about[next - 1], x + 21, y + 10, { size: 5, color: '#dcebc6' });
        g.text(max ? 'Fully upgraded' : away ? 'At Bella\'s until morning' : row.tool === 'shovel' && !this.gear.shovel ? 'Buy the shovel first' : costText(UPGRADES[row.tool].cost[lv]),
          x + 21, y + 17, { size: 5, color: max || away ? '#dcebc6' : '#fff3a8' });
        return;
      }
      const it = GOODS[row.id], own = this.gear[row.id];
      g.panel(x, y, w, h, own ? '#5d715066' : '#5d7150cc');
      g.tile(it.icon, x + 2, y + 4);
      g.text(`${i + 1}. ${it.name}`, x + 21, y + 4, { size: 6 });
      g.text(it.about, x + 21, y + 14, { size: 5, color: '#dcebc6' });
      g.text(own ? 'Owned' : `${it.price}g`, x + w - 3, y + 4, { size: own ? 5 : 6, align: 'right', color: own ? '#dcebc6' : '#fff3a8' });
    });
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
    const icon = s.id === 'seeds' ? CROPS[SEEDS[this.seed]].packet : (UPGRADES[s.id] && toolIcon(s.id, this.levels[s.id])) ?? TOOLS[s.id]?.icon ?? PLANTS[s.id]?.icon ?? FORAGE[s.id]?.icon ?? CROPS[s.id].item;
    if (this.busy(s.id)) g.ctx.globalAlpha = 0.3; // at Bella's today
    g.tile(icon, x + 1, y + 1); g.ctx.globalAlpha = 1;
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
        const p = this.onFarm && this.field.get(`${x},${y}`), n = ground[y * W + x];
        g.tile(p?.wet && n.startsWith('soil') ? 'soilwet' + n.slice(4) : n, x * TILE - cx, y * TILE - cy); // watered soil is darker, and still joins up
        if (p) g.tile(this.field.sprite(p), x * TILE - cx, y * TILE - cy);
        if (this.map.digs?.has(`${x},${y}`)) g.tile('dig_spot', x * TILE - cx, y * TILE - cy);
        const fo = this.map.forage?.get(`${x},${y}`);
        if (fo) g.tile(FORAGE[fo].icon, x * TILE - cx + 3, y * TILE - cy + 4, 10); // forage lies small on the ground
      }
    this.events.drawGround(this, cx, cy);
    // Highlight the tile the player is facing.
    const [fx, fy] = this.facing().split(',').map(Number);
    if ((this.onFarm && this.field.has(`${fx},${fy}`)) || [this.map.door, this.map.shop, this.map.store, ...this.map.bin, ...(this.map.gates ?? [])].includes(`${fx},${fy}`) || this.map.digs?.has(`${fx},${fy}`)) {
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
    for (const v of this.villagers) if (v.role === 'pet' && !v.home && v.met && Math.hypot(v.x - this.x, v.y - this.y) < 40) // a stray's trust, over its head
      for (let i = 0; i < TRUST; i++) {
        const hx = Math.round(v.x + 1 + i * 5 - cx), hy = Math.round(v.y + 1 - cy);
        c.fillStyle = i < v.trust ? '#e8507a' : '#00000066';
        c.fillRect(hx, hy, 1, 1); c.fillRect(hx + 2, hy, 1, 1); c.fillRect(hx, hy + 1, 3, 1); c.fillRect(hx + 1, hy + 2, 1, 1);
      }
    for (const v of this.villagers) if (v.heartT > 0) { // a petted stray's heart, rising and fading
      const hx = Math.round(v.x + 5 - cx), hy = Math.round(v.y + 5 - (1.2 - v.heartT) * 8 - cy);
      c.globalAlpha = Math.min(1, v.heartT * 2); c.fillStyle = '#e8507a';
      c.fillRect(hx, hy, 2, 1); c.fillRect(hx + 3, hy, 2, 1); c.fillRect(hx, hy + 1, 5, 1); c.fillRect(hx + 1, hy + 2, 3, 1); c.fillRect(hx + 2, hy + 3, 1, 1);
      c.globalAlpha = 1;
    }
    this.events.drawAbove(this, cx, cy);
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
      put(p?.wet && n.startsWith('soil') ? 'soilwet' + n.slice(4) : n, x, y);
      if (p) put(this.field.sprite(p), x, y);
    });
    for (const o of [...m.objects].sort((a, b) => a.base - b.base)) o.tiles.forEach((row, j) => row.forEach((n, i) => put(n, o.x / TILE + i, o.y / TILE + j)));
    for (const v of this.villagers) { // villagers as small figures where they stand right now
      const f = v.walker, img = this.g.images[f.sheet];
      const k = (v.px ?? TILE) / TILE;
      if (img) c.drawImage(img, 0, 0, 32, 32, (v.x / TILE + (1 - k) / 2) * P, (v.y / TILE + 1 - k) * P, P * k, P * k);
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
    g.panel(x + 4, y + 24, (w - 8) * Math.min(1, k.energy / k.max), 5, '#86cf5e');
    // Hotbar, top left, with the held item's name under it.
    for (let i = 0; i < HOTBAR; i++) this.drawSlot(i);
    const h = this.inv.held;
    if (h && !this.open) g.text(h.id === 'seeds' ? `${CROPS[SEEDS[this.seed]].name} Seeds` : (UPGRADES[h.id] && toolName(h.id, this.levels[h.id])) ?? TOOLS[h.id]?.name ?? PLANTS[h.id]?.name ?? FORAGE[h.id]?.name ?? CROPS[h.id].name, 5, 24, { size: 5 });
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
