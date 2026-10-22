// Villagers: each walks the edge of a small square, pausing at the corners, and waits if something is in the way.
import { TILE, DIRS, Walker } from './engine.js';

const SPEED = 24; // pixels per second, slower than the player
const PAUSE = 1.2; // seconds standing at each corner

// sheet, top-left tile of the square, side length in tiles (0: stands on that tile, facing down).
export const VILLAGERS = [
  { sheet: 'villager_male', x: 6, y: 15, size: 2 },
  { sheet: 'villager_female', x: 29, y: 15, size: 2 },
  { sheet: 'villager_child', x: 12, y: 15, size: 2 },
];
// What talking to someone does, if it isn't the usual chat (see support.js).
export const ROLES = { shopkeeper: 'shop', storekeeper: 'shop' };
// Shopkeepers: who they are, their shop page's title, and the building (map.shop / map.store) whose door sends you to them.
export const KEEPERS = {
  shopkeeper: { name: 'Fredrick', title: "Fredrick's Seeds", building: 'shop' },
  storekeeper: { name: 'The storekeeper', title: 'General Store', building: 'store' },
};

// Feet box shared by villagers and the player: [x, y, w, h] in pixels.
export const feet = (x, y) => [x + 4, y + 11, 8, 5];
export const overlaps = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

export class Villager {
  constructor({ sheet, x, y, size }) {
    this.walker = new Walker(sheet);
    const s = size * TILE, x0 = x * TILE, y0 = y * TILE;
    this.corners = [[x0, y0], [x0 + s, y0], [x0 + s, y0 + s], [x0, y0 + s]]; // clockwise
    [this.x, this.y] = this.corners[0];
    this.next = 1; this.wait = PAUSE; this.still = !size; this.role = ROLES[sheet];
  }

  // blocked(x, y): true if the villager's feet can't stand at x, y (the player, mostly).
  update(dt, blocked) {
    if (this.wait > 0) { this.wait -= dt; return this.walker.update(dt, false); }
    if (this.still) { this.walker.dir = DIRS.down; return this.walker.update(dt, false); } // back to facing out after a chat
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

// True if a villager's whole square (top-left x, y; side `size` tiles) is walkable.
export function fits(map, { x, y, size }) {
  for (let j = 0; j <= size; j++) for (let i = 0; i <= size; i++) {
    const tx = x + i, ty = y + j;
    if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H || map.solid[ty * map.W + tx]) return false;
  }
  return true;
}

// A random spot for a small square walk, away from the map's edges.
export function randomSpot(map, rand = Math.random) {
  for (let n = 0; n < 200; n++) {
    const v = { x: 2 + Math.floor(rand() * (map.W - 6)), y: 2 + Math.floor(rand() * (map.H - 6)), size: 1 };
    if (fits(map, v)) return v;
  }
  return null;
}

// The map's villagers (map.npcs) whose whole square is walkable; `skip(sheet)` leaves out people who follow a schedule.
export function spawnVillagers(map, skip = () => false) {
  return (map.npcs ?? []).filter(v => !skip(v.sheet) && fits(map, v)).map(v => new Villager(v));
}
