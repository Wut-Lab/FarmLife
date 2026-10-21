// Game scenes: main menu -> character select -> farm.
import { TILE, DIRS, Walker } from './engine.js';
import { Clock, MAX_ENERGY } from './clock.js';
import { buildFarm } from './farm-map.js';
import { CROPS, SEEDS, Field } from './crops.js';
import { Inventory, TOOLS, HOTBAR, LOCKED, BAG } from './inventory.js';

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
    this.inv = new Inventory();
    this.gold = 200;
    this.seeds = { carrot: 5, turnip: 0, cabbage: 0 };
    this.shop = false;
    this.open = false; this.pick = -1;
    this.clock.on('overnight', () => this.field.overnight());
    this.toast = '';
    this.clock.on('newDay', ({ passedOut }) => this.say(passedOut ? 'You passed out! Half energy today.' : 'Good morning!'));
  }
  say(msg) { this.toast = msg; this.toastT = 3; }

  // Feet hitbox: 8x5 pixels at the bottom of the 16x16 logical sprite.
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
    if (this.shop) return this.shopUpdate(inp, dt);
    if (inp.hit('Escape')) return this.g.go(new Menu());
    const b = this.buttons(), inv = this.inv;
    if (inp.hit('KeyI') || inp.tapIn(...b.bag)) { this.open = !this.open; this.pick = -1; }
    if (inp.hit('KeyQ', 'Tab')) this.seed = (this.seed + 1) % SEEDS.length;
    for (let i = 0; i < HOTBAR; i++) if (inp.hit('Digit' + (i + 1))) inv.sel = i;
    // Tap a slot: select it (tap the seed bag again to change seeds). With the bag open, tap two slots to swap them.
    const n = this.open ? HOTBAR + BAG : HOTBAR;
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
    if (this.open) return this.player.update(dt, false);
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

  // Ripe crops are picked by hand; otherwise the held tool decides what happens.
  act() {
    const key = this.facing(), f = this.field, held = this.inv.held?.id;
    if (key === this.map.door) return this.clock.sleep();
    if (key === this.map.shop) { this.shop = true; return; }
    if (!f.has(key)) return held && !TOOLS[held] && this.say(`That's a ${CROPS[held].name}.`);
    const p = f.get(key), tired = () => this.say('Too tired. Sleep at your front door.');
    if (f.isRipe(p)) {
      if (!this.inv.add(p.crop)) return this.say('Your bag is full.');
      f.act(key); return this.say(`Harvested a ${CROPS[p.crop].name}!`);
    }
    if (held === 'seeds') {
      if (p) return this.say(`Something is already growing here.`);
      const seed = SEEDS[this.seed];
      if (!this.seeds[seed]) return this.say(`Out of ${CROPS[seed].name} seeds. Buy more at the shop.`);
      if (!this.clock.useEnergy(1)) return tired();
      this.seeds[seed]--;
      const r = f.act(key, seed); return this.say(`Planted ${CROPS[r.crop].name} seeds. Water them daily.`);
    }
    if (held === 'can') {
      if (!p) return this.say('Nothing to water. Plant some seeds first.');
      if (p.wet) return this.say(`${CROPS[p.crop].name}: watered today. Ready in ${CROPS[p.crop].days - p.grown} day(s).`);
      if (!this.clock.useEnergy(1)) return tired();
      return f.act(key);
    }
    if (held === 'hoe') {
      if (!p) return this.say('The soil is already tilled.');
      if (!this.clock.useEnergy(2)) return tired();
      f.plots.set(key, null); return this.say(`Dug up the ${CROPS[p.crop].name}.`);
    }
    this.say('Pick a tool from your hotbar (1-3).');
  }

  buttons() {
    const g = this.g, r = 22;
    return { act: [g.w - r - 6, g.h - r - 6, r, r], bag: [g.w - 2 * r - 12, g.h - r - 6, r, r] };
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
      if (this.gold < c.seed) return this.say(`Not enough gold for ${c.name} seeds.`);
      this.gold -= c.seed; this.seeds[s]++; this.say(`Bought ${c.name} seeds. You have ${this.seeds[s]}.`);
    });
    if (inp.hit('KeyS') || inp.tapIn(...r.sell)) {
      const earned = SEEDS.reduce((sum, s) => sum + this.inv.take(s) * CROPS[s].price, 0);
      this.gold += earned; this.say(earned ? `Sold your crops for ${earned}g.` : 'No crops to sell.');
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
      g.text(`${c.seed}g`, x + w - 3, y + 5, { size: 6, align: 'right', color: '#fff3a8' });
    });
    g.panel(...r.sell, '#e86a9a'); g.text('Sell crops (S)', r.sell[0] + 32, r.sell[1] + 4, { size: 5, align: 'center' });
    g.panel(...r.close, '#5d7150'); g.text('Close (Esc)', r.close[0] + 32, r.close[1] + 4, { size: 5, align: 'center' });
  }

  // Slots 0-7 are the hotbar (top left); 8+ are the bag grid shown when it's open.
  slotRect(i) {
    if (i < HOTBAR) return [4 + i * 19, 4, 18, 18];
    const j = i - HOTBAR, x0 = Math.round(this.g.w / 2 - 76), y0 = Math.round(this.g.h / 2 - 16);
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
        const p = this.field.get(`${x},${y}`);
        if (p?.wet) { c.fillStyle = '#3f263155'; c.fillRect(x * TILE - cx, y * TILE - cy + 3, 16, 11); }
        if (p) g.tile(this.field.sprite(p), x * TILE - cx, y * TILE - cy);
      }
    // Highlight the tile the player is facing.
    const [fx, fy] = this.facing().split(',').map(Number);
    if (this.field.has(`${fx},${fy}`) || [this.map.door, this.map.shop].includes(`${fx},${fy}`)) {
      c.strokeStyle = '#fff8e8aa'; c.lineWidth = 1;
      c.strokeRect(fx * TILE - cx + 0.5, fy * TILE - cy + 0.5, 15, 15);
    }
    // Draw objects and the player back to front by their bottom edge.
    const list = objects.filter(o => o.x - cx < g.w && o.base - cy > 0 && o.x + o.tiles[0].length * TILE - cx > 0 && o.y - cy < g.h);
    list.push({ base: this.y + 16, player: true });
    list.sort((a, b) => a.base - b.base);
    for (const o of list) {
      if (o.player) this.player.draw(g, this.x - cx, this.y - cy);
      else o.tiles.forEach((row, j) => row.forEach((n, k) => g.tile(n, o.x + k * TILE - cx, o.y + j * TILE - cy)));
    }
    // Night falls after 6 PM.
    const dark = Math.max(0, this.clock.dayProgress - 0.6) * 1.6;
    if (dark > 0) { c.fillStyle = `rgba(11,20,48,${dark.toFixed(3)})`; c.fillRect(0, 0, g.w, g.h); }
    this.hud();
  }

  hud() {
    const g = this.g, k = this.clock, w = 78, x = g.w - w - 4;
    const y = g.w < HOTBAR * 19 + w + 12 ? 26 : 4; // Drop below the hotbar on narrow screens.
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
      g.text(this.pick < 0 ? 'Bag: tap two slots to swap' : 'Now tap where it goes', g.w / 2, by - 11, { size: 6, align: 'center' });
      for (let i = HOTBAR; i < HOTBAR + BAG; i++) this.drawSlot(i);
    }
    if (this.shop) this.drawShop();
    // Bag and action buttons, bottom right.
    const b = this.buttons();
    g.panel(...b.bag, this.open ? '#e86a9a' : '#3f2631dd'); g.tile('bag', b.bag[0] + 3, b.bag[1] + 1);
    g.text('Bag', b.bag[0] + 11, b.bag[1] + 15, { size: 5, align: 'center' });
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
