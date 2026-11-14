// Core engine: screen fitting, game loop, scenes, images, input and drawing helpers.
import { A } from './art-index.js';
export const TILE = 16; // logical units per tile; art is 32x32, drawn at double density
const TARGET = 300; // art pixels along the screen's shorter side

// A copy of the art sheet for a season: the greens of grass and plants turn sun-baked in summer, orange in fall, snowy in winter (with iced water, frosted soil and snow on the roofs).
const NATURE = /^(grass|path|cobbleb|brickb|soil|shallow|wild|tree|oak|pine|shrub|berry_bush|dandelions|roses|tulips|mushrooms|rock|dig_spot)/;
const ROOFS = [['house', 3, 3], ['shop', 3, 3], ['barn', 4, 4], ['store', 6, 4], ['house_brown', 3, 4], ['house_blue', 3, 4], ['stone_house', 5, 4]]; // buildings: name, tiles wide, tiles high
function tint(img, season) {
  const cv = document.createElement('canvas'), c = cv.getContext('2d');
  cv.width = img.width; cv.height = img.height; c.drawImage(img, 0, 0);
  try {
    const d = c.getImageData(0, 0, cv.width, cv.height), p = d.data, at = (name, x, y) => (((A[name] >> 4) * 32 + y) * cv.width + (A[name] % 16) * 32 + x) * 4;
    const mix = (k, to, m) => to.forEach((v, j) => { p[k + j] += (v - p[k + j]) * m; });
    for (const name of Object.keys(A)) {
      const nature = NATURE.test(name), water = season === 3 && /^(shallow|deep)/.test(name), soil = season === 3 && /^soil/.test(name), plant = /^(tree|oak|pine|shrub|berry)/.test(name);
      if (!nature && !water) continue;
      const m = season === 3 ? (plant ? 0.6 : 1) : season === 2 ? (/^pine/.test(name) ? 0.2 : plant ? 1 : 0.55) : 1; // snow only dusts the trees; fall grass half turns, pines barely
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const k = at(name, x, y), r = p[k], g = p[k + 1], b = p[k + 2];
        if (nature && g > r * 1.05 && g > b * 1.05) mix(k, season === 1 ? [r * 1.2 + 10, g * 1.02, b * 0.7] : season === 2 ? [g * 1.1 + 20, g * 0.8, b * 0.55] : [g * 0.3 + 172, g * 0.3 + 184, g * 0.3 + 200], m); // the greens
        else if (water && b > r && b >= g) mix(k, [214, 232, 244], 0.6); // water ices over
        else if (soil && r > g && g > b) mix(k, [236, 240, 248], 0.22); // frost on the soil
      }
    }
    // Winter: snow lies along the top of every roof (the top pixels of each column of a building).
    if (season === 3) for (const [name, w, h] of ROOFS) for (let x = 0; x < w * 32; x++) {
      let n = 0; const deep = 9 + (x >> 1) * 5 % 4; // a ragged lower edge
      for (let y = 0; y < h * 32 && n < deep; y++) {
        const k = at(`${name}_${(y >> 5) * w + (x >> 5)}`, x % 32, y % 32);
        if (p[k + 3] > 200) mix(k, n++ < deep - 2 ? [246, 249, 255] : [176, 196, 226], 1);
      }
    }
    c.putImageData(d, 0, 0);
  } catch { return img; } // e.g. opened from a file: the canvas can't be read
  return cv;
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.images = {};
    this.input = new Input(this);
    this.fit();
    addEventListener('resize', () => this.fit());
  }

  // Fill the window at a whole-number pixel scale so the art stays crisp on any screen.
  fit() {
    const dpr = window.devicePixelRatio || 1;
    const w = innerWidth, h = innerHeight;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    // Even scale, so each 32px art tile maps to whole device pixels inside a 16-unit logical tile.
    this.scale = 2 * Math.max(1, Math.floor(Math.min(this.canvas.width, this.canvas.height) / TARGET));
    this.w = Math.floor(this.canvas.width / this.scale);
    this.h = Math.floor(this.canvas.height / this.scale);
  }

  async load(images) {
    await Promise.all(Object.entries(images).map(async ([name, src]) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      this.images[name] = img;
    }));
  }

  go(scene) {
    this.scene = scene;
    scene.enter?.(this);
  }

  start(scene) {
    this.go(scene);
    let last = performance.now();
    const frame = now => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.scene.update?.(dt);
      this.draw();
      this.input.endFrame();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  draw() {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#2f4a22';
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    c.imageSmoothingEnabled = false;
    this.scene.draw(c);
  }

  // The art for this.season (0 = Spring ... 3 = Winter): the sheet itself in spring, a recoloured copy otherwise.
  sheet() { const s = this.season ?? 0; return s ? (this.sheets ??= [])[s] ??= tint(this.images.art, s) : this.images.art; }

  // Draw a named 32x32 tile from assets/art/world.png into a 16-unit logical tile (or `size` units).
  tile(name, x, y, size = TILE) {
    const i = A[name];
    this.ctx.drawImage(this.sheet(), (i % 16) * 32, Math.floor(i / 16) * 32, 32, 32,
      Math.round(x * 2) / 2, Math.round(y * 2) / 2, size, size);
  }

  // Text in Pixelify Sans, with digits in Tiny5 (Pixelify's 5 looks like an S). Tiny5 is drawn on an 8-units-per-pixel grid,
  // so digits get the nearest size that lands on whole screen pixels, sitting on the same line as the letters.
  text(str, x, y, { size = 8, color = '#fff8e8', align = 'left', shadow = '#3f2631', bold = false } = {}) {
    const c = this.ctx, k = this.scale, letters = `${bold ? 'bold ' : ''}${size}px "Pixelify Sans", monospace`;
    const ds = Math.max(1, Math.round(size / 8 * k)) * 8 / k, digits = `${ds}px "Tiny5", "Pixelify Sans", monospace`;
    const runs = String(str).split(/(\d+)/).filter(Boolean).map(t => ({ t, digit: /^\d/.test(t) }));
    for (const r of runs) { c.font = r.digit ? digits : letters; r.w = c.measureText(r.t).width; }
    const w = runs.reduce((n, r) => n + r.w, 0), dy = Math.round((size * 0.925 - ds * 0.875) * k) / k; // line up the bottoms
    c.textAlign = 'left'; c.textBaseline = 'top';
    const draw = (x0, y0) => {
      let at = align === 'center' ? x0 - w / 2 : align === 'right' ? x0 - w : x0;
      for (const r of runs) { c.font = r.digit ? digits : letters; c.fillText(r.t, r.digit ? Math.round(at * k) / k : at, r.digit ? y0 + dy : y0); at += r.w; }
    };
    if (shadow) { c.fillStyle = shadow; draw(x + size / 8, y + size / 8); }
    c.fillStyle = color; draw(x, y);
  }

  panel(x, y, w, h, fill = '#3f2631cc') {
    const c = this.ctx;
    c.fillStyle = fill;
    c.beginPath();
    c.roundRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h), 3);
    c.fill();
  }
  // A panel you can tap: the same, with a thin black edge.
  button(x, y, w, h, fill) {
    this.panel(x, y, w, h, fill);
    const c = this.ctx;
    c.strokeStyle = '#000'; c.lineWidth = 0.5;
    c.beginPath(); c.roundRect(Math.round(x) + 0.25, Math.round(y) + 0.25, Math.round(w) - 0.5, Math.round(h) - 0.5, 3); c.stroke();
  }
}

// Keyboard, mouse and touch. A drag acts as a virtual joystick; a short press is a tap.
class Input {
  constructor(game) {
    this.game = game;
    this.keys = new Set();
    this.pressed = new Set();
    this.tap = null;
    this.drag = null;
    this.wheel = 0; // mouse wheel this frame
    const cv = game.canvas;
    cv.addEventListener('wheel', e => { this.wheel += e.deltaY; e.preventDefault(); }, { passive: false });
    addEventListener('keydown', e => {
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      const p = this.pos(e);
      this.drag = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y, moved: false };
    });
    cv.addEventListener('pointermove', e => {
      if (this.drag?.id !== e.pointerId) return;
      Object.assign(this.drag, this.pos(e));
      if (Math.hypot(this.drag.x - this.drag.x0, this.drag.y - this.drag.y0) > 6) this.drag.moved = true;
    });
    const up = e => {
      if (this.drag?.id !== e.pointerId) return;
      if (!this.drag.moved && e.type === 'pointerup') this.tap = { x: this.drag.x, y: this.drag.y };
      this.drag = null;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  }

  pos(e) {
    const r = this.game.canvas.getBoundingClientRect(), k = this.game.dpr / this.game.scale;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
  }

  down(...codes) { return codes.some(c => this.keys.has(c)); }
  hit(...codes) { return codes.some(c => this.pressed.has(c)); }
  tapIn(x, y, w, h) { const t = this.tap; return !!t && t.x >= x && t.x < x + w && t.y >= y && t.y < y + h; }

  // Movement direction from keys or joystick drag, normalized.
  get dir() {
    let x = 0, y = 0;
    if (this.down('ArrowLeft', 'KeyA')) x--;
    if (this.down('ArrowRight', 'KeyD')) x++;
    if (this.down('ArrowUp', 'KeyW')) y--;
    if (this.down('ArrowDown', 'KeyS')) y++;
    if (this.drag?.moved) { x = this.drag.x - this.drag.x0; y = this.drag.y - this.drag.y0; }
    const d = Math.hypot(x, y);
    return d > 0.5 ? { x: x / d, y: y / d } : { x: 0, y: 0 };
  }

  endFrame() { this.pressed.clear(); this.tap = null; this.wheel = 0; }
}

// A character sprite sheet: rows down/left/right/up, columns idle/stepA/stepB.
export const DIRS = { down: 0, left: 1, right: 2, up: 3 };
export class Walker {
  constructor(sheet) { this.sheet = sheet; this.dir = DIRS.down; this.t = 0; this.moving = false; }
  update(dt, moving) { this.moving = moving; this.t = moving ? this.t + dt : 0; }
  get frame() { return this.moving ? [1, 0, 2, 0][Math.floor(this.t * 8) % 4] : 0; }
  draw(game, x, y, size = TILE) {
    game.ctx.drawImage(game.images[this.sheet], this.frame * 32, this.dir * 32, 32, 32,
      Math.round(x * 2) / 2, Math.round(y * 2) / 2, size, size);
  }
}
