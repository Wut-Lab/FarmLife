// Map editor (editor.html): paint ground, place objects, adjust collision and the spawn point, then export JSON
// or play-test it (index.html?map=editor). The map autosaves to localStorage.
import { A } from './art-index.js';
import { buildFarm } from './farm-map.js';
import { PREFABS, EDITOR_KEY, blankMap, dataFromMap, solidOf, grassTile, isGround } from './map-data.js';

const $ = s => document.querySelector(s);
const art = new Image(); art.src = 'assets/art/world.png'; await art.decode();
const cv = $('#map'), ctx = cv.getContext('2d');
const T = 32; // screen pixels per tile at zoom 1
const ZOOMS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];

// ---------- map state, autosave, undo ----------
let d = load() ?? dataFromMap(buildFarm());
function load() {
  try { const m = JSON.parse(localStorage.getItem(EDITOR_KEY)); return valid(m) ? m : null; } catch { return null; }
}
function valid(m) {
  if (!m || !(m.W > 0 && m.H > 0) || m.ground?.length !== m.W * m.H || !Array.isArray(m.objects)) return false;
  m.block = m.block?.length === m.W * m.H ? m.block : Array(m.W * m.H).fill(0);
  m.spawn ??= { x: m.W >> 1, y: m.H >> 1 };
  m.objects = m.objects.filter(o => PREFABS[o.name]);
  return true;
}
const save = () => { try { localStorage.setItem(EDITOR_KEY, JSON.stringify(d)); } catch {} };
const undo = [], redo = [];
const snap = () => { undo.push(JSON.stringify(d)); if (undo.length > 200) undo.shift(); redo.length = 0; };
function history(from, to) {
  if (!from.length) return;
  to.push(JSON.stringify(d)); d = JSON.parse(from.pop()); changed(true);
}
function replace(m) { snap(); d = m; changed(true); fitView(); }
function changed(sizes) {
  save(); draw();
  if (sizes) { $('#mw').value = d.W; $('#mh').value = d.H; }
}

// ---------- brushes ----------
const AUTO = [
  { id: 'grass', label: 'Grass', icon: [['grass1']], ground: true, auto: 'grass' },
  { id: 'path', label: 'Path (auto)', icon: [['path4']], ground: true, auto: 'path' },
  { id: 'soil', label: 'Field soil (auto)', icon: [['soil1']], ground: true, auto: 'soil' },
];
const brushes = [...AUTO,
  ...Object.keys(A).filter(isGround).map(n => ({ id: n, label: n, icon: [[n]], ground: true, tile: n })),
  { id: 'fence', label: 'Fence (auto)', icon: [['fence0', 'fence2'], ['fence3', null]], prefab: 'fence1', auto: 'fence' },
  ...Object.values(PREFABS).map(p => ({ id: p.name, label: p.name.replace(/_/g, ' '), icon: p.tiles, prefab: p.name }))];
const group = b => b.ground ? 'Ground' : /house|shop|bin|sign|fence/.test(b.id) ? 'Buildings & props'
  : /tree|pine|oak|shrub|mushroom|flower|bush|rock/.test(b.id) ? 'Nature' : 'Other';
let brush = brushes.find(b => b.id === 'path');

function thumb(rows) {
  const c = document.createElement('canvas'), h = rows.length, w = rows[0].length, s = Math.max(w, h) * 32;
  c.width = c.height = s; const g = c.getContext('2d');
  rows.forEach((row, j) => row.forEach((n, i) => cell(g, n, (s - w * 32) / 2 + i * 32, (s - h * 32) + j * 32, 32)));
  return c;
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
      el.append(thumb(b.icon), b.label); b.el = el;
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
let tool = 'paint';
for (const [id, label, key, tip] of TOOLS) {
  const b = document.createElement('button'); b.textContent = label; b.title = `${tip} (${key})`; b.id = 't-' + id;
  b.onclick = () => setTool(id); $('#tools').append(b);
}
function setTool(t) {
  $('#t-' + tool).classList.remove('on'); tool = t; $('#t-' + t).classList.add('on');
  if (t === 'block') showSolid(true);
  opts(); draw();
}
function opts() {
  const tip = TOOLS.find(t => t[0] === tool)[3];
  $('#opts').textContent = ['paint', 'rect', 'fill'].includes(tool) ? `${tip}. Brush: ${brush.label}` : tip;
}

// ---------- editing ----------
const inside = (x, y) => x >= 0 && y >= 0 && x < d.W && y < d.H;
const fam = n => n.replace(/\d+$/, '');
function setGround(x, y, b) {
  if (!inside(x, y) || !b.ground) return;
  d.ground[y * d.W + x] = b.auto === 'grass' ? (isGrass(x, y) ? d.ground[y * d.W + x] : grassTile(Math.random()))
    : b.auto === 'path' ? 'path4' : b.auto === 'soil' ? 'soil1' : b.tile;
  if (b.auto === 'path' || b.auto === 'soil' || b.auto === 'grass') retileAround(x, y);
}
const isGrass = (x, y) => fam(d.ground[y * d.W + x]) === 'grass';
// Paths pick their edge pieces from their neighbours; soil picks a row end or middle. Off-map counts as continuing.
function retileAround(x, y) {
  for (let j = y - 1; j <= y + 1; j++) for (let i = x - 1; i <= x + 1; i++) {
    if (!inside(i, j)) continue;
    const n = d.ground[j * d.W + i], f = fam(n), same = (a, b) => !inside(a, b) || fam(d.ground[b * d.W + a]) === f;
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
function erase(x, y) {
  const o = objectAt(x, y);
  if (o) { d.objects.splice(d.objects.indexOf(o), 1); if (isFence(o)) retileFence(o.x, o.y); }
  else if (inside(x, y)) d.block[y * d.W + x] = 0;
}
function apply(x, y, e) {
  if (tool === 'paint') { if (brush.ground) setGround(x, y, brush); else place(brush, x, y); }
  else if (tool === 'erase') erase(x, y);
  else if (tool === 'block' && inside(x, y)) d.block[y * d.W + x] = e.button === 2 || e.shiftKey ? 2 : 1;
  else if (tool === 'spawn' && inside(x, y)) d.spawn = { x, y };
}
function boxFill(x0, y0, x1, y1) {
  [x0, x1] = [Math.min(x0, x1), Math.max(x0, x1)]; [y0, y1] = [Math.min(y0, y1), Math.max(y0, y1)];
  if (brush.ground) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setGround(x, y, brush); return; }
  const p = PREFABS[brush.prefab];
  if (brush.auto === 'fence') { for (let x = x0; x <= x1; x++) for (const y of new Set([y0, y1])) place(brush, x, y);
    for (let y = y0 + 1; y < y1; y++) for (const x of new Set([x0, x1])) place(brush, x, y); return; }
  for (let y = Math.min(y0 + p.h - 1, y1); y <= y1; y += p.h) for (let x = Math.min(x0 + ((p.w - 1) >> 1), x1); x <= x1; x += p.w) place(brush, x, y);
}
function flood(x, y) {
  if (!inside(x, y) || !brush.ground) return;
  const key = n => (fam(n) === 'grass' ? 'grass' : n), target = key(d.ground[y * d.W + x]);
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
  const o = objectAt(x, y), n = d.ground[y * d.W + x];
  pickBrush(brushes.find(b => b.id === (o ? (isFence(o) ? 'fence' : o.name) : n)) ?? brush);
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
  replace(m);
}

// ---------- view ----------
let zoom = 1, ox = 0, oy = 0, grid = true, solidView = false, hover = null, box = null;
function fitView() {
  const r = cv.getBoundingClientRect();
  zoom = [...ZOOMS].reverse().find(z => d.W * T * z <= r.width - 20 && d.H * T * z <= r.height - 20) ?? ZOOMS[0];
  ox = Math.round((r.width - d.W * T * zoom) / 2); oy = Math.round((r.height - d.H * T * zoom) / 2); draw();
}
function zoomBy(step, cx, cy) {
  const r = cv.getBoundingClientRect(); cx ??= r.width / 2; cy ??= r.height / 2;
  const z = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + step))];
  ox = cx - (cx - ox) * z / zoom; oy = cy - (cy - oy) * z / zoom; zoom = z; draw();
}
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
  if (!hover || brush.ground || !['paint', 'rect'].includes(tool) || (tool === 'rect' && !box)) return [];
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
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId);
  const t = tileAt(e);
  if (e.button === 1 || space || tool === 'pan' || (e.button === 2 && tool !== 'block')) { drag = { pan: true, x: e.clientX, y: e.clientY }; cv.style.cursor = 'grabbing'; return; }
  if (e.altKey || tool === 'pick') { pick(t.x, t.y); return; }
  snap(); drag = { last: t, e };
  if (tool === 'rect') box = { x0: t.x, y0: t.y, x1: t.x, y1: t.y };
  else if (tool === 'fill') { flood(t.x, t.y); drag = null; changed(); }
  else { apply(t.x, t.y, e); draw(); }
});
cv.addEventListener('pointermove', e => {
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
const end = () => {
  if (!drag) return;
  if (box) { boxFill(box.x0, box.y0, box.x1, box.y1); box = null; }
  if (!drag.pan) changed();
  drag = null; cv.style.cursor = space ? 'grab' : 'crosshair';
};
cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
cv.addEventListener('pointerleave', () => { hover = null; status(); draw(); });
let wheel = 0;
cv.addEventListener('wheel', e => {
  e.preventDefault(); const r = cv.getBoundingClientRect();
  if (e.shiftKey) { ox -= e.deltaY + e.deltaX; return draw(); }
  wheel += e.deltaY; if (Math.abs(wheel) < 50) return;
  zoomBy(wheel < 0 ? 1 : -1, e.clientX - r.left, e.clientY - r.top); wheel = 0;
}, { passive: false });
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
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
  const step = 64, arrows = { arrowleft: [step, 0], arrowright: [-step, 0], arrowup: [0, step], arrowdown: [0, -step] }[k];
  if (arrows) { ox += arrows[0]; oy += arrows[1]; draw(); e.preventDefault(); }
});
addEventListener('keyup', e => { if (e.code === 'Space') { space = false; cv.style.cursor = 'crosshair'; } });
addEventListener('resize', draw);

function status() {
  if (!hover || !inside(hover.x, hover.y)) { $('#pos').textContent = `${d.W} × ${d.H} tiles`; $('#info').textContent = ''; return; }
  const o = objectAt(hover.x, hover.y), k = hover.y * d.W + hover.x;
  $('#pos').innerHTML = `<b>${hover.x}, ${hover.y}</b>`;
  $('#info').textContent = [d.ground[k], o && o.name, solidOf(d)[k] ? 'blocked' : 'walkable'].filter(Boolean).join(' · ');
}

// ---------- header buttons ----------
$('#new').onclick = () => confirm('Start a new empty map? (Undo can bring this one back.)') && replace(blankMap(+$('#mw').value || 40, +$('#mh').value || 30, Date.now() % 100000));
$('#farm').onclick = () => confirm('Open the current farm map? (Undo can bring this one back.)') && replace(dataFromMap(buildFarm()));
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
$('#gridT').onclick = () => { grid = !grid; $('#gridT').classList.toggle('on', grid); draw(); };
$('#solidT').onclick = () => showSolid(!solidView);
$('#resize').onclick = () => resize(+$('#mw').value, +$('#mh').value);
$('#hint').textContent = 'Alt+click: pick · Right-drag / Space+drag / arrows: pan · Wheel: zoom · 0: fit · Ctrl+Z: undo';

buildPalette(); pickBrush(brush); setTool('paint'); changed(true); fitView(); status();
