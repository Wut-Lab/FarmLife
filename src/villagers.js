// Villagers: each walks the edge of a small square, pausing at the corners, and waits if something is in the way.
import { TILE, DIRS, Walker } from './engine.js';
import { exitRows } from './map-data.js';

const SPEED = 24; // pixels per second, slower than the player
const TRAVEL = 40; // pixels per second when heading somewhere new
const PAUSE = 1.2; // seconds standing at each corner
const PUSHY = 1.5; // seconds a travelling villager waits for you to move before slipping past

// sheet, top-left tile of the square, side length in tiles (0: stands on that tile, facing down).
export const VILLAGERS = [
  { sheet: 'villager_male', x: 6, y: 15, size: 2 },
  { sheet: 'villager_female', x: 29, y: 15, size: 2 },
  { sheet: 'villager_child', x: 12, y: 15, size: 2 },
];
// What talking to someone does, if it isn't the usual chat (see support.js).
export const ROLES = { shopkeeper: 'shop', storekeeper: 'shop', wanderer: 'stranger', traveller: 'traveller', minstrel: 'minstrel', salesman: 'shop' };
// The hooded stranger won't give a name; one of these, at random, as their shop opens.
export const STRANGER_LINES = ['...', 'The road goes further than you think.', 'Not yet. Not yet.', 'You have kind eyes, farmer.', '..... .... ..', ' The sun hurts sometimes....'];
// Shopkeepers: who they are, their shop page's title, and the building (map.shop / map.store) whose door sends you to them.
export const KEEPERS = {
  shopkeeper: { name: 'Fredrick', title: "Fredrick's Seeds", building: 'shop' },
  storekeeper: { name: 'Bella', title: 'General Store', building: 'store' },
  salesman: { name: 'Clothes salesman', title: 'Wandering Threads' }, // some days, by Fredrick's shop (events.js); sells the GOODS marked seller: 'salesman'
  wanderer: { name: 'Hooded stranger', title: 'Curious Wares', stock: ['wheat'], noBuying: true }, // turns up in the Wilds now and then
};

// Feet box shared by villagers and the player: [x, y, w, h] in pixels.
export const feet = (x, y) => [x + 4, y + 11, 8, 5];
export const overlaps = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

export class Villager {
  constructor({ sheet, x, y, size }) {
    this.walker = new Walker(sheet); this.role = ROLES[sheet]; this.legs = null;
    this.settle({ x, y, size });
  }
  // Start walking the square at x, y (tiles).
  settle({ x, y, size }) {
    const s = size * TILE, x0 = x * TILE, y0 = y * TILE;
    this.corners = [[x0, y0], [x0 + s, y0], [x0 + s, y0 + s], [x0, y0 + s]]; // clockwise
    [this.x, this.y] = this.corners[0];
    this.next = 1; this.wait = PAUSE; this.still = !size;
  }
  // Walk a route from planRoute() to `spot`, then settle there. The world moves them between maps.
  go(legs, spot) { this.legs = legs; this.dest = spot; this.stuck = 0; }
  get hopping() { return this.legs?.length > 1 && !this.legs[0].path.length; } // at a map's edge, ready for the next one

  // blocked(x, y): true if the villager's feet can't stand at x, y (the player, mostly).
  update(dt, blocked) {
    if (this.wait > 0) { this.wait -= dt; return this.walker.update(dt, false); } // e.g. just finished talking to you
    if (this.legs) {
      const path = this.legs[0].path;
      if (!path.length) return this.walker.update(dt, false);
      const push = (this.stuck += dt) > PUSHY; // slip past you rather than wait forever
      if (this.step(path[0], TRAVEL, dt, push ? () => false : blocked)) this.stuck = 0;
      if (this.x === path[0][0] && this.y === path[0][1]) path.shift();
      if (!path.length && this.legs.length === 1) { this.legs = null; this.settle(this.dest); }
      return;
    }
    if (this.still) { this.walker.dir = DIRS.down; return this.walker.update(dt, false); } // back to facing out after a chat
    this.step(this.corners[this.next], SPEED, dt, blocked);
    if (this.x === this.corners[this.next][0] && this.y === this.corners[this.next][1]) { this.next = (this.next + 1) % 4; this.wait = PAUSE; }
  }
  // Walk toward [tx, ty]; false if something is in the way.
  step([tx, ty], speed, dt, blocked) {
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
    if (!d) return true;
    this.walker.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? DIRS.left : DIRS.right) : (dy < 0 ? DIRS.up : DIRS.down);
    const step = Math.min(d, speed * dt), nx = step === d ? tx : this.x + (dx / d) * step, ny = step === d ? ty : this.y + (dy / d) * step;
    if (blocked(nx, ny)) { this.walker.update(dt, false); return false; }
    this.x = nx; this.y = ny; this.walker.update(dt, true);
    return true;
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

// Shortest walk on a map's tile grid from `from` ([x, y] tiles) to the first tile where goal(x, y) is true; null if there's none.
export function findPath(map, [fx, fy], goal) {
  const { W, H, solid } = map, start = fy * W + fx, prev = new Map([[start, -1]]), queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i], x = c % W, y = (c - x) / W;
    if (goal(x, y)) {
      const path = [];
      for (let n = c; n !== start; n = prev.get(n)) path.unshift([n % W, Math.floor(n / W)]);
      return path;
    }
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const n = ny * W + nx;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && !solid[n] && !prev.has(n)) { prev.set(n, c); queue.push(n); }
    }
  }
  return null;
}

// A walk from tile `from` on map `fromId` to tile `to` on map `toId`, crossing maps along the road exits.
// Returns legs [{ map, from, path }] (from: where they step in, pixels; path: pixel waypoints), or null if there's no way.
export function planRoute(maps, fromId, from, toId, to) {
  const chain = mapChain(maps, fromId, toId);
  if (!chain) return null;
  const px = ([x, y]) => [x * TILE, y * TILE], legs = [];
  let at = from, entry = null;
  for (const [i, { id, side }] of chain.entries()) {
    const m = maps[id], rows = side && exitRows(m, side), edge = side === 'left' ? 0 : m.W - 1;
    if (m.solid[at[1] * m.W + at[0]] && entry) return null;
    const path = findPath(m, at, side ? (x, y) => x === edge && rows.includes(y) : (x, y) => x === to[0] && y === to[1]);
    if (!path) return null;
    path.unshift(at); // first onto a whole tile
    legs.push({ map: id, from: entry, path: path.map(px) });
    if (!side) break;
    const row = path.at(-1)[1], n = maps[chain[i + 1].id];
    legs.at(-1).path.push(px([side === 'left' ? -1 : m.W, row])); // step off the edge...
    entry = px([side === 'left' ? n.W : -1, row]); at = [side === 'left' ? n.W - 1 : 0, row]; // ...and in on the far side of the next map
  }
  return legs;
}

// The maps to walk through from one to another, each with the side you leave by: [{ id, side }].
function mapChain(maps, fromId, toId) {
  const prev = { [fromId]: null }, queue = [fromId];
  for (const id of queue) {
    if (id === toId) break;
    for (const [side, next] of Object.entries(maps[id].exits ?? {}))
      if (maps[next] && !(next in prev)) { prev[next] = { id, side }; queue.push(next); }
  }
  if (!(toId in prev)) return null;
  const chain = [{ id: toId, side: null }];
  for (let p = prev[toId]; p; p = prev[p.id]) chain.unshift({ id: p.id, side: p.side });
  return chain;
}
