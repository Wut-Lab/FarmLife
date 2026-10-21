// Core engine: screen fitting, game loop, scenes, images, input and drawing helpers.
export const TILE = 16;
const TARGET = 180; // logical pixels along the screen's shorter side

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
    this.scale = Math.max(1, Math.floor(Math.min(this.canvas.width, this.canvas.height) / TARGET));
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

  // Draw tile i from a 12-column Kenney packed tilemap.
  tile(sheet, i, x, y) {
    this.ctx.drawImage(this.images[sheet], (i % 12) * TILE, Math.floor(i / 12) * TILE, TILE, TILE,
      Math.round(x), Math.round(y), TILE, TILE);
  }

  text(str, x, y, { size = 8, color = '#fff8e8', align = 'left', shadow = '#3f2631' } = {}) {
    const c = this.ctx;
    c.font = `${size}px "Pixelify Sans", monospace`;
    c.textAlign = align;
    c.textBaseline = 'top';
    if (shadow) { c.fillStyle = shadow; c.fillText(str, x + size / 8, y + size / 8); }
    c.fillStyle = color;
    c.fillText(str, x, y);
  }

  panel(x, y, w, h, fill = '#3f2631cc') {
    const c = this.ctx;
    c.fillStyle = fill;
    c.beginPath();
    c.roundRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h), 3);
    c.fill();
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
    const cv = game.canvas;
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

  endFrame() { this.pressed.clear(); this.tap = null; }
}

// A character sprite sheet: rows down/left/right/up, columns idle/stepA/stepB.
export const DIRS = { down: 0, left: 1, right: 2, up: 3 };
export class Walker {
  constructor(sheet) { this.sheet = sheet; this.dir = DIRS.down; this.t = 0; this.moving = false; }
  update(dt, moving) { this.moving = moving; this.t = moving ? this.t + dt : 0; }
  get frame() { return this.moving ? [1, 0, 2, 0][Math.floor(this.t * 8) % 4] : 0; }
  draw(game, x, y, size = TILE) {
    game.ctx.drawImage(game.images[this.sheet], this.frame * TILE, this.dir * TILE, TILE, TILE,
      Math.round(x), Math.round(y), size, size);
  }
}
