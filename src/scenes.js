// Game scenes: main menu -> character select -> farm.
import { TILE, DIRS, Walker } from './engine.js';
import { Clock, MAX_ENERGY } from './clock.js';
import { buildFarm } from './farm-map.js';
import { CROPS, SEEDS, Field } from './crops.js';

const CHARACTERS = [
  { sheet: 'male', label: 'Male' },
  { sheet: 'female', label: 'Female' },
];

// Grassy, flowery backdrop shared by the menus.
function meadow(g, t) {
  const ox = -Math.floor(t * 6) % TILE;
  for (let y = 0; y < g.h; y += TILE) for (let x = ox; x < g.w; x += TILE) {
    const k = ((x - ox) / TILE * 7 + y / TILE * 13 + Math.floor(t * 6 / TILE) * 7) % 11;
    g.tile('town', k === 0 ? 2 : k < 3 ? 1 : 0, x, y);
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
    if (this.g.input.hit('Enter', 'Space')) this.g.go(new CharacterSelect());
  }
  draw() {
    const g = this.g, cx = g.w / 2;
    meadow(g, this.t);
    g.text('FarmLife', cx, g.h * 0.2, { size: 28, align: 'center', color: '#fff3a8' });
    g.text('A farming & life sim', cx, g.h * 0.2 + 32, { size: 8, align: 'center' });
    this.walkers.forEach((w, i) => w.draw(g, ((this.t * 24 + i * 20) % (g.w + 40)) - 20, g.h * 0.2 + 48));
    if (button(g, 'New Game', cx - 45, g.h * 0.62, 90, 20, true)) g.go(new CharacterSelect());
    g.text('Enter or tap to start', cx, g.h * 0.62 + 26, { size: 6, align: 'center', color: '#e2f0d4' });
  }
}

export class CharacterSelect {
  enter(g) { this.g = g; this.t = 0; this.pick = 0; this.walkers = CHARACTERS.map(c => new Walker(c.sheet)); }
  update(dt) {
    const inp = this.g.input;
    this.t += dt;
    if (inp.hit('ArrowLeft', 'KeyA')) this.pick = 0;
    if (inp.hit('ArrowRight', 'KeyD')) this.pick = 1;
    if (inp.hit('Escape')) this.g.go(new Menu());
    if (inp.hit('Enter', 'Space')) this.start();
    this.walkers.forEach((w, i) => w.update(dt, i === this.pick));
  }
  start() { this.g.go(new World(CHARACTERS[this.pick].sheet)); }
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
    if (button(g, 'Back', 4, 4, 36, 14, false)) g.go(new Menu());
  }
}

const SPEED = 64; // pixels per second, 4 tiles

export class World {
  constructor(sheet) { this.sheet = sheet; }
  enter(g) {
    this.g = g;
    this.map = buildFarm();
    this.player = new Walker(this.sheet);
    Object.assign(this, this.map.spawn);
    this.clock = new Clock();
    this.field = new Field(this.map.plots);
    this.seed = 0;
    this.bag = Object.fromEntries(SEEDS.map(s => [s, 0]));
    this.clock.on('overnight', () => this.field.overnight());
    this.toast = '';
    this.clock.on('newDay', ({ passedOut }) => this.say(passedOut ? 'You passed out! Half energy today.' : 'Good morning!'));
  }
  say(msg) { this.toast = msg; this.toastT = 3; }

  // Feet hitbox: 8x5 pixels at the bottom of the 16x16 sprite.
  blocked(x, y) {
    const { W, H, solid } = this.map;
    for (const [px, py] of [[x + 4, y + 11], [x + 11, y + 11], [x + 4, y + 15], [x + 11, y + 15]]) {
      const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
      if (tx < 0 || ty < 0 || tx >= W || ty >= H || solid[ty * W + tx]) return true;
    }
    return false;
  }

  update(dt) {
    const inp = this.g.input, d = inp.dir;
    if (inp.hit('Escape')) return this.g.go(new Menu());
    const b = this.buttons();
    if (inp.hit('KeyQ', 'Tab') || inp.tapIn(...b.seed)) this.seed = (this.seed + 1) % SEEDS.length;
    if (inp.hit('Space', 'KeyE', 'Enter') || inp.tapIn(...b.act)) this.act();
    this.clock.update(dt * 1000);
    if (this.toastT > 0) this.toastT -= dt;
    const moving = d.x !== 0 || d.y !== 0;
    if (moving) {
      this.player.dir = Math.abs(d.x) > Math.abs(d.y) ? (d.x < 0 ? DIRS.left : DIRS.right) : (d.y < 0 ? DIRS.up : DIRS.down);
      const nx = this.x + d.x * SPEED * dt, ny = this.y + d.y * SPEED * dt;
      if (!this.blocked(nx, this.y)) this.x = nx;
      if (!this.blocked(this.x, ny)) this.y = ny;
    }
    this.player.update(dt, moving);
  }

  // The tile in front of the player's feet.
  facing() {
    const [dx, dy] = [[0, 1], [-1, 0], [1, 0], [0, -1]][this.player.dir];
    return `${Math.floor((this.x + 8 + dx * 10) / TILE)},${Math.floor((this.y + 13 + dy * 10) / TILE)}`;
  }

  act() {
    const key = this.facing(), seed = SEEDS[this.seed];
    if (key === this.map.door) return this.clock.sleep();
    const p = this.field.get(key);
    const cost = !this.field.has(key) ? 0 : !p ? 1 : this.field.isRipe(p) ? 0 : p.wet ? 0 : 1;
    if (cost && !this.clock.useEnergy(cost)) return this.say('Too tired. Sleep at your front door.');
    const r = this.field.act(key, seed);
    if (!r) return;
    const name = CROPS[r.crop].name;
    if (r.did === 'harvest') { this.bag[r.crop]++; this.say(`Harvested a ${name}!`); }
    else if (r.did === 'plant') this.say(`Planted ${name} seeds. Water them daily.`);
    else if (r.did === 'none') this.say(`${name}: watered today. Ready in ${CROPS[r.crop].days - p.grown} day(s).`);
  }

  buttons() {
    const g = this.g, r = 22;
    return { act: [g.w - r - 6, g.h - r - 6, r, r], seed: [g.w - 2 * r - 12, g.h - r - 6, r, r] };
  }

  draw(c) {
    const g = this.g, { W, H, ground, objects } = this.map;
    const clamp = (v, size, view) => (size <= view ? (size - view) / 2 : Math.max(0, Math.min(size - view, v)));
    const cx = Math.round(clamp(this.x + 8 - g.w / 2, W * TILE, g.w));
    const cy = Math.round(clamp(this.y + 8 - g.h / 2, H * TILE, g.h));
    const x0 = Math.max(0, Math.floor(cx / TILE)), y0 = Math.max(0, Math.floor(cy / TILE));
    for (let y = y0; y < Math.min(H, y0 + g.h / TILE + 2); y++)
      for (let x = x0; x < Math.min(W, x0 + g.w / TILE + 2); x++) {
        const [sheet, i] = ground[y * W + x];
        if (sheet === 'farm') g.tile('town', 0, x * TILE - cx, y * TILE - cy);
        g.tile(sheet, i, x * TILE - cx, y * TILE - cy);
        const p = this.field.get(`${x},${y}`);
        if (p?.wet) { c.fillStyle = '#3f263155'; c.fillRect(x * TILE - cx + 2, y * TILE - cy + 3, 12, 10); }
        if (p) g.tile('farm', this.field.sprite(p), x * TILE - cx, y * TILE - cy);
      }
    // Highlight the tile the player is facing.
    const [fx, fy] = this.facing().split(',').map(Number);
    if (this.field.has(`${fx},${fy}`) || `${fx},${fy}` === this.map.door) {
      c.strokeStyle = '#fff8e8aa'; c.lineWidth = 1;
      c.strokeRect(fx * TILE - cx + 0.5, fy * TILE - cy + 0.5, 15, 15);
    }
    // Draw objects and the player back to front by their bottom edge.
    const list = objects.filter(o => o.x - cx < g.w && o.base - cy > 0 && o.x + o.tiles[0].length * TILE - cx > 0 && o.y - cy < g.h);
    list.push({ base: this.y + 16, player: true });
    list.sort((a, b) => a.base - b.base);
    for (const o of list) {
      if (o.player) this.player.draw(g, this.x - cx, this.y - cy);
      else o.tiles.forEach((row, j) => row.forEach(([s, i], k) => g.tile(s, i, o.x + k * TILE - cx, o.y + j * TILE - cy)));
    }
    // Night falls after 6 PM.
    const dark = Math.max(0, this.clock.dayProgress - 0.6) * 1.6;
    if (dark > 0) { c.fillStyle = `rgba(11,20,48,${dark.toFixed(3)})`; c.fillRect(0, 0, g.w, g.h); }
    this.hud();
  }

  hud() {
    const g = this.g, k = this.clock, w = 78, x = g.w - w - 4;
    g.panel(x, 4, w, 34);
    g.text(`${k.seasonName} ${k.day}, Y${k.year}`, x + 4, 7, { size: 7 });
    g.text(k.timeString, x + 4, 16, { size: 7, color: '#fff3a8' });
    g.panel(x + 4, 28, w - 8, 5, '#24361a');
    g.panel(x + 4, 28, (w - 8) * k.energy / MAX_ENERGY, 5, '#86cf5e');
    // Harvest counts, top left.
    SEEDS.forEach((s, i) => {
      g.panel(4 + i * 30, 4, 28, 18);
      g.tile('farm', CROPS[s].item, 5 + i * 30, 5);
      g.text(String(this.bag[s]), 21 + i * 30, 9, { size: 7 });
    });
    // Seed picker and action button, bottom right.
    const b = this.buttons(), seed = SEEDS[this.seed];
    g.panel(...b.seed, '#3f2631dd'); g.tile('farm', CROPS[seed].item, b.seed[0] + 3, b.seed[1] + 1);
    g.text(CROPS[seed].name, b.seed[0] + 11, b.seed[1] + 15, { size: 5, align: 'center' });
    g.panel(...b.act, '#e86a9a'); g.text('Use', b.act[0] + 11, b.act[1] + 7, { size: 7, align: 'center' });
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
