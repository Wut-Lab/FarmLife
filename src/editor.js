// Map editor (editor.html): pick a location, paint ground, place objects and villagers, adjust collision, the spawn
// point and the road exits, then export JSON or play-test (index.html?map=editor). Each location autosaves to localStorage.
import { A } from './art-index.js';
import { LOCATIONS } from './locations.js';
import { ROLES } from './villagers.js';
import { PREFABS, EDITOR_KEY, BLOB_SETS, blankMap, blobTile, dataFromMap, solidOf, grassTile, isGround, editorData, exitRows } from './map-data.js';

const $ = s => document.querySelector(s);
const art = new Image(); art.src = 'assets/art/world.png'; await art.decode();
const cv = $('#map'), ctx = cv.getContext('2d');
const T = 32; // screen pixels per tile at zoom 1
const ZMIN = 0.2, ZMAX = 6; // zoom limits; the slider runs on a log scale between them

// ---------- map state, autosave, undo ----------
const NPCS = { villager_male: 'Villager (man)', villager_female: 'Villager (woman)', villager_child: 'Villager (child)', shopkeeper: 'Fredrick (shopkeeper)' };
const sheets = Object.fromEntries(await Promise.all(Object.keys(NPCS).map(async k => {
  const im = new Image(); im.src = `assets/characters/${k}.png`; await im.decode(); return [k, im];
})));
const all = editorData(); // every location's edited map; untouched locations use the game's own
let loc = 'farm', d;
const fresh = id => dataFromMap(LOCATIONS[id].build());
function openLoc(id) {
  loc = id; d = valid(all[id]) ? all[id] : fresh(id); undo.length = redo.length = 0;
  $('#loc').value = id; changed(true, false); fitView();
}
function valid(m) {
  if (!m || !(m.W > 0 && m.H > 0) || m.ground?.length !== m.W * m.H || !Array.isArray(m.objects)) return false;
  m.block = m.block?.length === m.W * m.H ? m.block : Array(m.W * m.H).fill(0);
  m.spawn ??= { x: m.W >> 1, y: m.H >> 1 };
  m.objects = m.objects.filter(o => PREFABS[o.name]);
  m.exits = { ...m.exits }; m.npcs = (m.npcs ?? []).filter(v => NPCS[v.sheet]);
  return true;
}
const save = () => { all[loc] = d; try { localStorage.setItem(EDITOR_KEY, JSON.stringify(all)); } catch {} };
const undo = [], redo = [];
const snap = () => { undo.push(JSON.stringify(d)); if (undo.length > 200) undo.shift(); redo.length = 0; };
function history(from, to) {
  if (!from.length) return;
  to.push(JSON.stringify(d)); d = JSON.parse(from.pop()); changed(true);
}
function replace(m) { snap(); d = m; changed(true); fitView(); }
function changed(sizes, store = true) {
  if (store) save();
  draw();
  if (sizes) { $('#mw').value = d.W; $('#mh').value = d.H; $('#exitL').value = d.exits.left ?? ''; $('#exitR').value = d.exits.right ?? ''; }
}

// ---------- brushes ----------
const patch = f => [[blobTile(f, 2 | 4 | 32), blobTile(f, 8 | 4 | 64)], [blobTile(f, 1 | 2 | 16), blobTile(f, 1 | 8 | 128)]]; // 2x2 preview
const AUTO = [
  { id: 'grass', label: 'Grass', icon: [['grass1']], ground: true, auto: 'grass' },
  { id: 'path', label: 'Path (auto)', icon: [['path4']], ground: true, auto: 'path' },
  { id: 'soil', label: 'Field soil (auto)', icon: [['soil1']], ground: true, auto: 'soil' },
  { id: 'cobble0', label: 'Cobble', icon: [['cobble0']], ground: true, tile: 'cobble0' },
  { id: 'cobbleb', label: 'Cobble (border)', icon: patch('cobbleb'), ground: true, auto: 'cobbleb' },
  { id: 'brick0', label: 'Brick', icon: [['brick0']], ground: true, tile: 'brick0' },
  { id: 'brickb', label: 'Brick (border)', icon: patch('brickb'), ground: true, auto: 'brickb' },
  { id: 'shallow', label: 'Shallow water', icon: patch('shallow'), ground: true, auto: 'shallow' },
  { id: 'deep', label: 'Deep water', icon: patch('deep'), ground: true, auto: 'deep' },
];
const brushes = [...AUTO,
  ...Object.keys(A).filter(n => isGround(n) && /^(grass|path|soil)\d+$/.test(n)).map(n => ({ id: n, label: n, icon: [[n]], ground: true, tile: n })),
  { id: 'fence', label: 'Fence (auto)', icon: [['fence0', 'fence2'], ['fence3', null]], prefab: 'fence1', auto: 'fence' },
  ...Object.values(PREFABS).map(p => ({ id: p.name, label: p.name.replace(/_/g, ' '), icon: p.tiles, prefab: p.name })),
  ...Object.entries(NPCS).map(([k, label]) => ({ id: k, label, npc: k }))];
const group = b => b.ground ? 'Ground' : b.npc ? 'Villagers' : /house|shop|bin|sign|fence/.test(b.id) ? 'Buildings & props'
  : /tree|pine|oak|shrub|mushroom|flower|bush|rock/.test(b.id) ? 'Nature' : 'Other';
let brush = brushes.find(b => b.id === 'path');

function thumb(rows) {
  const c = document.createElement('canvas'), h = rows.length, w = rows[0].length, s = Math.max(w, h) * 32;
  c.width = c.height = s; const g = c.getContext('2d');
  rows.forEach((row, j) => row.forEach((n, i) => cell(g, n, (s - w * 32) / 2 + i * 32, (s - h * 32) + j * 32, 32)));
  return c;
}
function npcThumb(k) {
  const c = document.createElement('canvas'); c.width = c.height = 32; c.getContext('2d').drawImage(sheets[k], 0, 0, 32, 32, 0, 0, 32, 32); return c;
}
function cell(g, n, x, y, size) {
  const i = A[n]; if (i === undefined) return;
  g.drawImage(art, (i % 16) * 32, Math.floor(i / 16) * 32, 32, 32, x, y, size, size);
}
function buildPalette() {
  const pal = $('#palette'), groups = {};
  for (const b of brushes) (groups[group(b)] ??= []).push(b);
  for (const [name, list] of Object.entries(groups)) {
    const h = document.createElement('h2'); h.textContent = name; pal.append(h);
    const grid = document.createElement('div'); grid.className = 'grid'; pal.append(grid);
    for (const b of list) {
      const el = document.createElement('div'); el.className = 'brush'; el.title = b.label;
      el.append(b.npc ? npcThumb(b.npc) : thumb(b.icon), b.label); b.el = el;
      el.onclick = () => { pickBrush(b); if (!['paint', 'rect', 'fill'].includes(tool)) setTool('paint'); };
      grid.append(el);
    }
  }
}
function pickBrush(b) { brush.el?.classList.remove('on'); brush = b; b.el?.classList.add('on'); opts(); }

// ---------- tools ----------
const TOOLS = [
  ['paint', 'Paint', 'B', 'Click or drag to paint the selected brush'],
  ['rect', 'Box', 'R', 'Drag a box: fills ground, or places a grid of objects'],
  ['fill', 'Fill', 'F', 'Flood-fill a patch of matching ground'],
  ['erase', 'Erase', 'E', 'Remove objects (and collision overrides)'],
  ['pick', 'Pick', 'I', 'Pick up the brush under the cursor (or Alt+click)'],
  ['block', 'Collide', 'C', 'Left: blocks walking. Right/Shift: walkable. Erase resets'],
  ['spawn', 'Spawn', 'S', 'Where the player starts'],
  ['pan', 'Pan', 'H', 'Drag to move the view (or middle-drag / Space+drag)'],
];
let tool = 'paint', lastTool = 'paint';
for (const [id, label, key, tip] of TOOLS) {
  const b = document.createElement('button'); b.textContent = label; b.title = `${tip} (${key})`; b.id = 't-' + id;
  b.onclick = () => setTool(id); $('#tools').append(b);
}
function setTool(t) {
  $('#t-' + tool).classList.remove('on'); if (t === 'pan' && tool !== 'pan') lastTool = tool;
  tool = t; $('#t-' + t).classList.add('on'); $('#move')?.classList.toggle('on', t === 'pan');
  if (t === 'block') showSolid(true);
  opts(); draw();
}
function opts() {
  const tip = TOOLS.find(t => t[0] === tool)[3];
  $('#opts').textContent = brush.npc && ['paint', 'rect'].includes(tool) ? `${brush.label}: click to set where their walk starts, or drag a Box to set the square they walk.`
    + (ROLES[brush.npc] ? ' A Box of one tile makes them stand still.' : '') : ['paint', 'rect', 'fill'].includes(tool) ? `${tip}. Brush: ${brush.label}` : tip;
}

// ---------- editing ----------
const inside = (x, y) => x >= 0 && y >= 0 && x < d.W && y < d.H;
const fam = n => n.replace(/\d+$/, '');
function setGround(x, y, b) {
  if (!inside(x, y) || !b.ground) return;
  const k = y * d.W + x;
  if (b.auto === 'grass') d.ground[k] = isGrass(x, y) ? d.ground[k] : grassTile(Math.random());
  else if (BLOB_SETS.includes(b.auto)) d.ground[k] = b.auto + '0';
  else d.ground[k] = b.auto === 'path' ? 'path4' : b.auto === 'soil' ? 'soil1' : b.tile;
  // Deep water gets a ring of shallows so it never meets land directly.
  if (b.auto === 'deep') for (let j = y - 1; j <= y + 1; j++) for (let i = x - 1; i <= x + 1; i++)
    if (inside(i, j) && !/^(shallow|deep)\d+$/.test(d.ground[j * d.W + i])) d.ground[j * d.W + i] = 'shallow0';
  retileAround(x, y, b.auto === 'deep' ? 2 : 1); // neighbours re-pick their edges
  if (b.tile) d.ground[k] = b.tile; // a hand-picked tile stays exactly as painted
}
const isGrass = (x, y) => fam(d.ground[y * d.W + x]) === 'grass';
// Autotiling. Paths and paving join each other (no border between them); shallow water joins deep; off-map counts as joined.
// Dirt paths and soil use their 9/3-piece sets, everything in BLOB_SETS its 47-piece set.
const PAVED = /^(path|cobbleb?|brickb?)\d+$/;
function joins(f, n) {
  if (f === 'path' || f === 'cobbleb' || f === 'brickb') return PAVED.test(n);
  if (f === 'shallow') return /^(shallow|deep)\d+$/.test(n);
  return fam(n) === f;
}
function retileAround(x, y, r = 1) {
  for (let j = y - r; j <= y + r; j++) for (let i = x - r; i <= x + r; i++) {
    if (!inside(i, j)) continue;
    const n = d.ground[j * d.W + i], f = fam(n), same = (a, b) => !inside(a, b) || joins(f, d.ground[b * d.W + a]);
    if (BLOB_SETS.includes(f)) {
      const bits = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
      d.ground[j * d.W + i] = blobTile(f, bits.reduce((m, [a, b], k) => (same(i + a, j + b) ? m | (1 << k) : m), 0));
      continue;
    }
    if (!/^(path|soil)\d$/.test(n)) continue;
    const col = !same(i - 1, j) && same(i + 1, j) ? 0 : same(i - 1, j) && !same(i + 1, j) ? 2 : 1;
    if (f === 'soil') d.ground[j * d.W + i] = 'soil' + col;
    else d.ground[j * d.W + i] = 'path' + ((!same(i, j - 1) ? 0 : !same(i, j + 1) ? 2 : 1) * 3 + col);
  }
}
// Object footprint when the cursor is at (x, y): cursor marks the bottom row, centred.
function footprint(b, x, y) {
  const p = PREFABS[b.prefab]; return { name: b.prefab, x: x - ((p.w - 1) >> 1), y: y - p.h + 1, w: p.w, h: p.h };
}
const rectOf = o => ({ x: o.x, y: o.y, w: PREFABS[o.name].w, h: PREFABS[o.name].h });
const hits = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
function place(b, x, y) {
  const f = footprint(b, x, y);
  if (f.x < 0 || f.y < 0 || f.x + f.w > d.W || f.y + f.h > d.H || d.objects.some(o => hits(rectOf(o), f))) return false;
  d.objects.push({ name: f.name, x: f.x, y: f.y });
  if (b.auto === 'fence') retileFence(f.x, f.y);
  return true;
}
const isFence = o => /^fence\d$/.test(o.name);
// Fences join up: rows get end posts, columns use the vertical piece.
function retileFence(x, y) {
  const at = (i, j) => d.objects.find(o => isFence(o) && o.x === i && o.y === j);
  for (let j = y - 1; j <= y + 1; j++) for (let i = x - 1; i <= x + 1; i++) {
    const o = at(i, j); if (!o) continue;
    const l = !!at(i - 1, j), r = !!at(i + 1, j), v = !!(at(i, j - 1) || at(i, j + 1));
    o.name = !l && r ? 'fence0' : l && !r ? 'fence2' : !l && !r && v ? 'fence3' : 'fence1';
  }
}
function objectAt(x, y) {
  let best = null;
  for (const o of d.objects) {
    const r = rectOf(o);
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h && (!best || r.y + r.h >= best.y + PREFABS[best.name].h)) best = o;
  }
  return best;
}
// Villagers: one of each per location. They walk the edge of a square whose top-left corner is (x, y).
const npcAt = (x, y) => d.npcs.find(v => v.x === x && v.y === y);
function putNpc(sheet, x, y, size) {
  if (!inside(x, y)) return;
  const old = d.npcs.find(v => v.sheet === sheet);
  d.npcs = d.npcs.filter(v => v !== old && !(v.x === x && v.y === y));
  d.npcs.push({ sheet, x, y, size: size ?? old?.size ?? (ROLES[sheet] ? 0 : 2) });
}
// A villager's square must be walkable all the way round, like the game checks.
const npcOk = v => { const s = solidOf(d); for (let j = 0; j <= v.size; j++) for (let i = 0; i <= v.size; i++) if (!inside(v.x + i, v.y + j) || s[(v.y + j) * d.W + v.x + i]) return false; return true; };
function erase(x, y) {
  const v = npcAt(x, y), o = objectAt(x, y);
  if (v) d.npcs.splice(d.npcs.indexOf(v), 1);
  else if (o) { d.objects.splice(d.objects.indexOf(o), 1); if (isFence(o)) retileFence(o.x, o.y); }
  else if (inside(x, y)) d.block[y * d.W + x] = 0;
}
function apply(x, y, e) {
  if (tool === 'paint') { if (brush.ground) setGround(x, y, brush); else if (brush.npc) putNpc(brush.npc, x, y); else place(brush, x, y); }
  else if (tool === 'erase') erase(x, y);
  else if (tool === 'block' && inside(x, y)) d.block[y * d.W + x] = e.button === 2 || e.shiftKey ? 2 : 1;
  else if (tool === 'spawn' && inside(x, y)) d.spawn = { x, y };
}
function boxFill(x0, y0, x1, y1) {
  [x0, x1] = [Math.min(x0, x1), Math.max(x0, x1)]; [y0, y1] = [Math.min(y0, y1), Math.max(y0, y1)];
  if (brush.ground) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setGround(x, y, brush); return; }
  if (brush.npc) return putNpc(brush.npc, x0, y0, Math.min(x1 - x0, y1 - y0));
  const p = PREFABS[brush.prefab];
  if (brush.auto === 'fence') { for (let x = x0; x <= x1; x++) for (const y of new Set([y0, y1])) place(brush, x, y);
    for (let y = y0 + 1; y < y1; y++) for (const x of new Set([x0, x1])) place(brush, x, y); return; }
  for (let y = Math.min(y0 + p.h - 1, y1); y <= y1; y += p.h) for (let x = Math.min(x0 + ((p.w - 1) >> 1), x1); x <= x1; x += p.w) place(brush, x, y);
}
function flood(x, y) {
  if (!inside(x, y) || !brush.ground) return;
  const key = n => (fam(n) === 'grass' || BLOB_SETS.includes(fam(n)) ? fam(n) : n), target = key(d.ground[y * d.W + x]);
  if (brush.auto ? fam(target) === brush.auto : target === brush.tile) return;
  const todo = [[x, y]], seen = new Set();
  while (todo.length) {
    const [i, j] = todo.pop(), k = j * d.W + i;
    if (!inside(i, j) || seen.has(k) || key(d.ground[k]) !== target) continue;
    seen.add(k); setGround(i, j, brush);
    todo.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
  }
}
function pick(x, y) {
  if (!inside(x, y)) return;
  const v = npcAt(x, y), o = objectAt(x, y), n = d.ground[y * d.W + x];
  pickBrush(brushes.find(b => b.id === (v ? v.sheet : o ? (isFence(o) ? 'fence' : o.name) : BLOB_SETS.includes(fam(n)) ? fam(n) : n)) ?? brush);
  brush.el?.scrollIntoView({ block: 'nearest' });
}
function resize(W, H) {
  W = Math.max(8, Math.min(200, W | 0)); H = Math.max(8, Math.min(200, H | 0));
  if (W === d.W && H === d.H) return;
  const m = blankMap(W, H, Date.now() % 100000);
  for (let y = 0; y < Math.min(H, d.H); y++) for (let x = 0; x < Math.min(W, d.W); x++) {
    m.ground[y * W + x] = d.ground[y * d.W + x]; m.block[y * W + x] = d.block[y * d.W + x];
  }
  m.objects = d.objects.filter(o => { const r = rectOf(o); return r.x + r.w <= W && r.y + r.h <= H; });
  m.spawn = { x: Math.min(d.spawn.x, W - 1), y: Math.min(d.spawn.y, H - 1) };
  m.exits = d.exits; m.npcs = d.npcs.filter(v => v.x + v.size < W && v.y + v.size < H);
  replace(m);
}

// ---------- view ----------
let zoom = 1, ox = 0, oy = 0, grid = true, solidView = false, hover = null, box = null;
function fitView() {
  const r = cv.getBoundingClientRect();
  zoom = Math.max(ZMIN, Math.min(ZMAX, (r.width - 24) / ((d.W + 2) * T), (r.height - 24) / (d.H * T)));
  ox = Math.round((r.width - d.W * T * zoom) / 2); oy = Math.round((r.height - d.H * T * zoom) / 2); zoomUI(); draw();
}
// Zoom to z, keeping the map point under screen point (cx, cy) still (default: the view's centre).
function zoomTo(z, cx, cy) {
  const r = cv.getBoundingClientRect(); cx ??= r.width / 2; cy ??= r.height / 2;
  z = Math.max(ZMIN, Math.min(ZMAX, z));
  ox = cx - (cx - ox) * z / zoom; oy = cy - (cy - oy) * z / zoom; zoom = z; zoomUI(); draw();
}
// Buttons and keys step through round levels: 25%, 50%, 75%, 100%, 150%, 200%...
const LEVELS = [0.2, 0.25, 0.33, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6];
const zoomBy = (step, cx, cy) => zoomTo(step > 0 ? LEVELS.find(z => z > zoom * 1.01) ?? ZMAX : [...LEVELS].reverse().find(z => z < zoom / 1.01) ?? ZMIN, cx, cy);
const toSlider = z => Math.round(1000 * Math.log(z / ZMIN) / Math.log(ZMAX / ZMIN));
function zoomUI() { $('#zpct').textContent = Math.round(zoom * 100) + '%'; $('#zslide').value = toSlider(zoom); }
function showSolid(on) { solidView = on; $('#solidT').classList.toggle('on', on); draw(); }
let queued = false;
function draw() { if (!queued) { queued = true; requestAnimationFrame(render); } }
function render() {
  queued = false;
  const r = cv.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#243a1a'; ctx.fillRect(0, 0, r.width, r.height);
  const s = T * zoom, X = x => ox + x * s, Y = y => oy + y * s;
  const x0 = Math.max(0, Math.floor(-ox / s)), y0 = Math.max(0, Math.floor(-oy / s));
  const x1 = Math.min(d.W, Math.ceil((r.width - ox) / s)), y1 = Math.min(d.H, Math.ceil((r.height - oy) / s));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) cell(ctx, d.ground[y * d.W + x], X(x), Y(y), s + 0.5);
  // Objects back to front by their bottom edge, with the placement preview mixed in.
  const list = d.objects.map(o => ({ ...o, ghost: false }));
  const ghosts = previewObjects();
  list.push(...ghosts);
  list.sort((a, b) => (a.y + PREFABS[a.name].h) - (b.y + PREFABS[b.name].h) || a.x - b.x);
  for (const o of list) {
    ctx.globalAlpha = o.ghost ? (o.bad ? 0.3 : 0.65) : 1;
    PREFABS[o.name].tiles.forEach((row, j) => row.forEach((n, i) => cell(ctx, n, X(o.x + i), Y(o.y + j), s + 0.5)));
  }
  ctx.globalAlpha = 1;
  // Villagers at the start of their walk, with the square they walk (red if something blocks it).
  for (const v of d.npcs) {
    ctx.strokeStyle = npcOk(v) ? '#fff8e8cc' : '#ff6b5b'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    ctx.strokeRect(X(v.x + 0.5), Y(v.y + 0.5), v.size * s, v.size * s); ctx.setLineDash([]);
    ctx.drawImage(sheets[v.sheet], 0, 0, 32, 32, X(v.x), Y(v.y), s, s);
  }
  if (solidView) {
    const solid = solidOf(d);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const k = y * d.W + x;
      if (solid[k]) { ctx.fillStyle = '#d9483b66'; ctx.fillRect(X(x), Y(y), s, s); }
      if (d.block[k]) { ctx.strokeStyle = d.block[k] === 1 ? '#ff6b5b' : '#5bc8ff'; ctx.lineWidth = 2; ctx.strokeRect(X(x) + 3, Y(y) + 3, s - 6, s - 6); }
    }
  }
  if (grid && s >= 12) {
    ctx.strokeStyle = '#00000026'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = x0; x <= x1; x++) { ctx.moveTo(Math.round(X(x)) + 0.5, Y(y0)); ctx.lineTo(Math.round(X(x)) + 0.5, Y(y1)); }
    for (let y = y0; y <= y1; y++) { ctx.moveTo(X(x0), Math.round(Y(y)) + 0.5); ctx.lineTo(X(x1), Math.round(Y(y)) + 0.5); }
    ctx.stroke();
  }
  ctx.strokeStyle = '#fff8e8'; ctx.lineWidth = 2; ctx.strokeRect(X(0) - 1, Y(0) - 1, d.W * s + 2, d.H * s + 2);
  // Road exits: arrows off each edge where the road reaches it, labelled with where they lead.
  ctx.font = `${Math.max(10, s * 0.4)}px "Pixelify Sans", monospace`; ctx.textBaseline = 'middle';
  for (const side of ['left', 'right']) {
    const to = d.exits[side], rows = exitRows(d, side), ex = side === 'left' ? -1 : d.W, edge = side === 'left' ? 0 : d.W - 1;
    const tx = side === 'left' ? X(0) + 4 : X(d.W) - 4; // labels sit just inside the edge, above the road
    ctx.textAlign = side === 'left' ? 'left' : 'right'; ctx.textBaseline = 'bottom';
    if (to && !rows.length) { // an exit with no road to walk off on
      ctx.strokeStyle = '#ff6b5b'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.moveTo(X(edge + (side === 'left' ? 0 : 1)), Y(0)); ctx.lineTo(X(edge + (side === 'left' ? 0 : 1)), Y(d.H)); ctx.stroke(); ctx.setLineDash([]);
      const msg = `No road reaches this edge (exit to ${LOCATIONS[to].name})`, w = ctx.measureText(msg).width;
      ctx.fillStyle = '#3f2631dd'; ctx.fillRect(side === 'left' ? tx - 3 : tx - w - 3, Y(d.H / 2) - s * 0.5 - 2, w + 6, s * 0.5 + 4);
      ctx.fillStyle = '#ff6b5b'; ctx.fillText(msg, tx, Y(d.H / 2)); ctx.textBaseline = 'middle'; continue;
    }
    for (const y of rows) {
      ctx.fillStyle = to ? '#f6d04d99' : '#ffffff22'; ctx.fillRect(X(ex), Y(y), s, s);
      ctx.strokeStyle = to ? '#f6d04d' : '#ffffff55'; ctx.lineWidth = 2; ctx.strokeRect(X(edge) + 1, Y(y) + 1, s - 2, s - 2);
      ctx.fillStyle = '#3f2631'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(side === 'left' ? '◀' : '▶', X(ex + 0.5), Y(y + 0.5) + 1);
    }
    if (rows.length) {
      ctx.textAlign = side === 'left' ? 'left' : 'right'; ctx.textBaseline = 'bottom'; ctx.fillStyle = '#3f2631cc';
      const label = to ? `${side === 'left' ? '◀' : ''} To ${LOCATIONS[to].name} ${side === 'left' ? '' : '▶'}` : 'No exit set', w = ctx.measureText(label).width;
      ctx.fillRect(side === 'left' ? tx - 3 : tx - w - 3, Y(rows[0]) - s * 0.5 - 6, w + 6, s * 0.5 + 4);
      ctx.fillStyle = to ? '#f6d04d' : '#fff8e8'; ctx.fillText(label, tx, Y(rows[0]) - 4); ctx.textBaseline = 'middle';
    }
  }
  // Spawn marker.
  ctx.fillStyle = '#f6d04d'; ctx.strokeStyle = '#3f2631'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(X(d.spawn.x + 0.5), Y(d.spawn.y + 0.5), s * 0.3, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3f2631'; ctx.font = `${Math.max(9, s * 0.35)}px "Pixelify Sans", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('S', X(d.spawn.x + 0.5), Y(d.spawn.y + 0.5) + 1);
  // Hover and box outlines.
  const outline = (x, y, w, h, c) => { ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.strokeRect(X(x) + 1, Y(y) + 1, w * s - 2, h * s - 2); };
  if (box) outline(Math.min(box.x0, box.x1), Math.min(box.y0, box.y1), Math.abs(box.x1 - box.x0) + 1, Math.abs(box.y1 - box.y0) + 1, '#fff8e8');
  else if (hover && inside(hover.x, hover.y)) {
    const o = tool === 'erase' && objectAt(hover.x, hover.y);
    if (o) { const q = rectOf(o); outline(q.x, q.y, q.w, q.h, '#ff6b5b'); } else outline(hover.x, hover.y, 1, 1, '#fff8e8cc');
  }
}
function previewObjects() {
  if (!hover || brush.ground || brush.npc || !['paint', 'rect'].includes(tool) || (tool === 'rect' && !box)) return [];
  if (tool === 'paint') {
    const f = footprint(brush, hover.x, hover.y);
    const bad = f.x < 0 || f.y < 0 || f.x + f.w > d.W || f.y + f.h > d.H || d.objects.some(o => hits(rectOf(o), f));
    return [{ ...f, ghost: true, bad }];
  }
  return [];
}

// ---------- input ----------
const tileAt = e => { const r = cv.getBoundingClientRect(), s = T * zoom; return { x: Math.floor((e.clientX - r.left - ox) / s), y: Math.floor((e.clientY - r.top - oy) / s) }; };
let drag = null, space = false;
const touches = new Map(); // active pointers, for two-finger pinch zoom
function pinchInfo() {
  const [a, b] = [...touches.values()], r = cv.getBoundingClientRect();
  return { dist: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
}
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId);
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 2) { // second finger: undo the stroke the first one started, then pinch
    if (drag && !drag.pan && !drag.pinch) { d = JSON.parse(undo.pop()); box = null; }
    drag = { pinch: true, ...pinchInfo() }; return draw();
  }
  if (touches.size > 2) return;
  const t = tileAt(e);
  if (e.button === 1 || space || tool === 'pan' || (e.button === 2 && tool !== 'block')) { drag = { pan: true, x: e.clientX, y: e.clientY }; cv.style.cursor = 'grabbing'; return; }
  if (e.altKey || tool === 'pick') { pick(t.x, t.y); return; }
  snap(); drag = { last: t, e };
  if (tool === 'rect') box = { x0: t.x, y0: t.y, x1: t.x, y1: t.y };
  else if (tool === 'fill') { flood(t.x, t.y); drag = null; changed(); }
  else { apply(t.x, t.y, e); draw(); }
});
cv.addEventListener('pointermove', e => {
  if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (drag?.pinch) {
    if (touches.size < 2) return;
    const p = pinchInfo();
    ox += p.x - drag.x; oy += p.y - drag.y; zoomTo(zoom * p.dist / drag.dist, p.x, p.y);
    Object.assign(drag, p); return;
  }
  const t = tileAt(e);
  if (!hover || t.x !== hover.x || t.y !== hover.y) { hover = t; status(); draw(); }
  if (!drag) return;
  if (drag.pan) { ox += e.clientX - drag.x; oy += e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; draw(); return; }
  if (box) { box.x1 = Math.max(0, Math.min(d.W - 1, t.x)); box.y1 = Math.max(0, Math.min(d.H - 1, t.y)); return draw(); }
  // Fill in every tile between the last two pointer positions so fast strokes leave no gaps.
  const { last } = drag, n = Math.max(Math.abs(t.x - last.x), Math.abs(t.y - last.y));
  for (let k = 1; k <= n; k++) apply(Math.round(last.x + (t.x - last.x) * k / n), Math.round(last.y + (t.y - last.y) * k / n), drag.e);
  drag.last = t; draw();
});
const end = e => {
  touches.delete(e.pointerId);
  if (drag?.pinch) { if (!touches.size) drag = null; return; }
  if (!drag) return;
  if (box) { boxFill(box.x0, box.y0, box.x1, box.y1); box = null; }
  if (!drag.pan) changed();
  drag = null; cv.style.cursor = space ? 'grab' : 'crosshair';
};
cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
cv.addEventListener('pointerleave', () => { hover = null; status(); draw(); });
// Wheel / two-finger scroll moves the view (Shift turns it sideways); Ctrl+wheel (or trackpad pinch) zooms toward the cursor.
cv.addEventListener('wheel', e => {
  e.preventDefault(); const r = cv.getBoundingClientRect(), k = e.deltaMode === 1 ? 33 : 1;
  const dx = e.deltaX * k, dy = e.deltaY * k;
  if (!e.ctrlKey && !e.metaKey) { if (e.shiftKey) ox -= dx + dy; else { ox -= dx; oy -= dy; } return draw(); }
  zoomTo(zoom * Math.exp(-dy * 0.01), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });
// On-screen arrows scroll the map while held; the Move button toggles drag-to-move.
for (const b of document.querySelectorAll('.pad button')) {
  const [dx, dy] = b.dataset.d.split(',').map(Number);
  let id = null;
  const stop = () => { clearInterval(id); id = null; };
  b.onpointerdown = e => { e.preventDefault(); stop(); const go = () => { ox += dx * 12; oy += dy * 12; draw(); }; go(); id = setInterval(go, 16); };
  b.onpointerup = b.onpointerleave = b.onpointercancel = stop;
}
$('#move').onclick = () => setTool(tool === 'pan' ? lastTool : 'pan');
addEventListener('keydown', e => {
  if (['INPUT', 'SELECT'].includes(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); return e.shiftKey ? history(redo, undo) : history(undo, redo); }
  if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); return history(redo, undo); }
  if (e.ctrlKey || e.metaKey) return;
  if (e.code === 'Space') { space = true; cv.style.cursor = 'grab'; e.preventDefault(); return; }
  const t = TOOLS.find(t => t[2].toLowerCase() === k);
  if (t) return setTool(t[0]);
  if (k === 'g') { grid = !grid; $('#gridT').classList.toggle('on', grid); draw(); }
  if (k === 'v') showSolid(!solidView);
  if (k === '+' || k === '=') zoomBy(1);
  if (k === '-') zoomBy(-1);
  if (k === '0') fitView();
  if (k === '1') zoomTo(1);
  const step = 64, arrows = { arrowleft: [step, 0], arrowright: [-step, 0], arrowup: [0, step], arrowdown: [0, -step] }[k];
  if (arrows) { ox += arrows[0]; oy += arrows[1]; draw(); e.preventDefault(); }
});
addEventListener('keyup', e => { if (e.code === 'Space') { space = false; cv.style.cursor = 'crosshair'; } });
addEventListener('resize', draw);

function status() {
  if (!hover || !inside(hover.x, hover.y)) { $('#pos').textContent = `${d.W} × ${d.H} tiles`; $('#info').textContent = ''; return; }
  const o = npcAt(hover.x, hover.y) ?? objectAt(hover.x, hover.y), k = hover.y * d.W + hover.x;
  $('#pos').innerHTML = `<b>${hover.x}, ${hover.y}</b>`;
  $('#info').textContent = [d.ground[k], o && (o.name ?? NPCS[o.sheet]), solidOf(d)[k] ? 'blocked' : 'walkable'].filter(Boolean).join(' · ');
}

// ---------- header buttons ----------
$('#new').onclick = () => confirm(`Start ${LOCATIONS[loc].name} over as empty grass? (Undo can bring this one back.)`)
  && replace({ ...blankMap(+$('#mw').value || 40, +$('#mh').value || 30, Date.now() % 100000), exits: d.exits, npcs: [] });
$('#reset').onclick = () => confirm(`Go back to the game's own ${LOCATIONS[loc].name}? (Undo can bring yours back.)`) && replace(fresh(loc));
for (const [id, l] of Object.entries(LOCATIONS)) $('#loc').append(new Option(l.name, id));
$('#loc').onchange = e => openLoc(e.target.value);
for (const side of ['L', 'R']) {
  const sel = $('#exit' + side); sel.append(new Option('No exit', ''));
  for (const [id, l] of Object.entries(LOCATIONS)) sel.append(new Option(l.name, id));
  sel.onchange = e => { snap(); d.exits[side === 'L' ? 'left' : 'right'] = e.target.value || undefined; changed(); };
}
$('#export').onclick = () => {
  const name = (prompt('File name', 'hub') ?? '').trim().replace(/\.json$/i, '');
  if (!name) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: 'application/json' }));
  a.download = name + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('#import').onclick = () => $('#file').click();
$('#file').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const m = JSON.parse(await f.text()); if (!valid(m)) throw 0; replace(m); } catch { alert("That file isn't a FarmLife map."); }
};
$('#play').onclick = () => { save(); open('index.html?map=editor', '_blank'); };
$('#undo').onclick = () => history(undo, redo);
$('#redo').onclick = () => history(redo, undo);
$('#zin').onclick = () => zoomBy(1);
$('#zout').onclick = () => zoomBy(-1);
$('#zfit').onclick = fitView;
$('#z100').onclick = () => zoomTo(1);
$('#zslide').oninput = e => zoomTo(ZMIN * (ZMAX / ZMIN) ** (e.target.value / 1000));
$('#gridT').onclick = () => { grid = !grid; $('#gridT').classList.toggle('on', grid); draw(); };
$('#solidT').onclick = () => showSolid(!solidView);
$('#resize').onclick = () => resize(+$('#mw').value, +$('#mh').value);
$('#hint').textContent = 'Alt+click: pick · Wheel / arrows / ◀▶ pad / Move or Right-drag / Space+drag: scroll · Ctrl+wheel / pinch / + −: zoom · 0: fit · 1: actual size · Ctrl+Z: undo';

buildPalette(); pickBrush(brush); setTool('paint'); openLoc('farm'); status();
