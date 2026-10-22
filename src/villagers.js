// Villagers: each walks the edge of a small square, pausing at the corners, and waits if something is in the way.
import { TILE, DIRS, Walker } from './engine.js';

const SPEED = 24; // pixels per second, slower than the player
const PAUSE = 1.2; // seconds standing at each corner

// sheet, top-left tile of the square, side length in tiles.
export const VILLAGERS = [
  { sheet: 'villager_male', x: 6, y: 15, size: 2 },
  { sheet: 'villager_female', x: 29, y: 15, size: 2 },
  { sheet: 'villager_child', x: 12, y: 15, size: 2 },
];

// Feet box shared by villagers and the player: [x, y, w, h] in pixels.
export const feet = (x, y) => [x + 4, y + 11, 8, 5];
export const overlaps = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

export class Villager {
  constructor({ sheet, x, y, size }) {
    this.walker = new Walker(sheet);
    const s = size * TILE, x0 = x * TILE, y0 = y * TILE;
    this.corners = [[x0, y0], [x0 + s, y0], [x0 + s, y0 + s], [x0, y0 + s]]; // clockwise
    [this.x, this.y] = this.corners[0];
    this.next = 1; this.wait = PAUSE;
  }

  // blocked(x, y): true if the villager's feet can't stand at x, y (the player, mostly).
  update(dt, blocked) {
    if (this.wait > 0) { this.wait -= dt; return this.walker.update(dt, false); }
    const [tx, ty] = this.corners[this.next], dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
    this.walker.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? DIRS.left : DIRS.right) : (dy < 0 ? DIRS.up : DIRS.down);
    const step = Math.min(d, SPEED * dt), nx = this.x + (dx / d) * step, ny = this.y + (dy / d) * step;
    if (blocked(nx, ny)) return this.walker.update(dt, false);
    this.x = nx; this.y = ny;
    if (step === d) { this.next = (this.next + 1) % 4; this.wait = PAUSE; }
    this.walker.update(dt, true);
  }

  draw(g, cx, cy) { this.walker.draw(g, this.x - cx, this.y - cy); }
}

// Villagers whose whole square is walkable on this map.
export function spawnVillagers(map) {
  const clear = v => {
    for (let j = 0; j <= v.size; j++) for (let i = 0; i <= v.size; i++) {
      const x = v.x + i, y = v.y + j;
      if (x < 0 || y < 0 || x >= map.W || y >= map.H || map.solid[y * map.W + x]) return false;
    }
    return true;
  };
  return VILLAGERS.filter(clear).map(v => new Villager(v));
}
