// How to Play and Credits: a book of pages. Lines: '# Heading' (bold), '- bullet', '1. numbered step', ['Key', 'what it does'], or a plain paragraph.
export const GOAL = 'Turn your little plot into a thriving farm. Grow and sell crops through the seasons, make friends in town, and find out what lies beyond the gate. New here? Start with the first page.';

export const CONTROLS = [
  ['Move', 'Arrows / WASD, or drag'],
  ['Use', 'Space / E, or tap Use'],
  ['Hotbar', '1-8, or tap a slot'],
  ['Seeds', 'Q, or tap the seed bag again: pick a kind'],
  ['Bag', 'I, or tap Bag; tap 2 slots to swap'],
  ['Sleep', 'Use on your front door'],
  ['Villagers', 'Use to talk; hold a crop to gift it'],
  ['Forage', 'Walk over it; Use on berry bushes'],
  ['Tools', "Upgrade at Bella's store (T: Tool upgrades)"],
  ['Strays', 'Pet or give berries: 3 hearts to adopt'],
  ['Eat', 'Use while holding berries or jam'],
  ['Craft', 'Pause > Crafting: sprinklers, berry jam'],
  ['Pause', 'Esc / P, or tap II'],
  ['Help', '? key, or tap ?'],
  ['Map', 'M, or tap the globe'],
];

export const GUIDE = [
  { title: 'Start Here', lines: [
    '# Your First Day',
    '1. You wake up outside your house with 200 gold and 5 carrot seeds.',
    '2. Walk down a few steps to the brown soil. That is your field.',
    '3. Pick the seed bag in your hotbar (key 2), face a plot of soil and press Use to plant.',
    '4. Pick the watering can (key 1) and press Use on each planted plot.',
    '5. Water your crops every day. Carrots are ready in 3 days.',
    '6. After 4 PM, press Use on your front door to sleep. The game saves each morning.',
    '# When Your Crops Are Ripe',
    '1. Face a ripe crop and press Use to pick it.',
    '2. Put it in the shipping bin beside your door. It sells overnight.',
    "3. Walk right, along the road, to town. Buy more seeds at Fredrick's Seeds.",
    '# Tips',
    '- Tools cost energy. When the green bar runs out, go to bed.',
    '- Rain waters your crops for you.',
    '- Press Esc (or tap II) any time to pause. How to Play is in the pause menu.',
  ] },
  { title: 'Farming', lines: [
    '# Growing',
    '- Crops grow overnight, but only if they were watered that day.',
    '- Face a ripe crop and press Use to pick it.',
    '- The hoe digs up a crop you no longer want. A better hoe from Bella turns grass into new plots.',
    '# Seeds',
    '- Carrots, turnips and cabbages grow all year.',
    '- Spinach (Spring), tomatoes (Summer), arugula (Fall) and peas (Winter) grow only in their season. They wither when it ends.',
    "- Buy seeds at Fredrick's Seeds in town.",
    '# Selling',
    '- Put crops in the shipping bin. It pays out overnight.',
    '- You can also sell straight to Fredrick.',
  ] },
  { title: 'Days and Energy', lines: [
    '# Days',
    '- A day runs from 6 AM to 2 AM. You can sleep from 4 PM.',
    '- Stay up past 2 AM and you pass out, waking with half your energy.',
    '- A season lasts 28 days. The land changes color with each one.',
    '# Energy',
    '- Using tools and fishing cost energy. Sleep refills it.',
    '- Hold berries and press Use to eat them for a little energy.',
    '# Saving',
    '- The game saves each morning and when you quit. There are four save files.',
  ] },
  { title: 'Town and Friends', lines: [
    '# Friends',
    '- Talk to Hank, Rosa, Pip and Wren once a day to earn hearts.',
    '- Hold a crop (or a fish) and talk to someone to give it as a gift, once a day.',
    '- Sometimes they ask for crops. Bring them in time for gold.',
    '- At 5 hearts, each friend gives you a perk. See Pause > Friends.',
    '- Wren paints somewhere new each season and is home from 8 PM to 6 AM.',
    '# Shops',
    "- Fredrick's Seeds: seeds, and he buys your crops.",
    "- Bella's General Store (8 AM to 8 PM): clothes, a shovel, a fishing rod and tool upgrades.",
    '- Wear clothes from Pause > Equipment.',
  ] },
  { title: 'Exploring', lines: [
    '# The Wilds',
    '- Past town is the Wilds. Walk over forage to pick it up.',
    '- Pet stray cats and dogs, or give them berries. At 3 hearts, you can adopt one.',
    '# Fishing',
    "1. Buy a fishing rod from Bella and select it in your hotbar.",
    '2. Face water and press Use to cast.',
    '3. When "!" appears, press Use quickly to reel it in.',
    '# More',
    '- A shovel digs up loose earth for finds.',
    '- Press M, or tap the globe, to see the map.',
    '- The gate on the road is closed at first. Helping people in town may open it.',
  ] },
  { title: 'Controls', lines: CONTROLS },
];

export const CREDITS = [{ title: 'Credits', lines: [
  '# Art',
  '- Crop items and seed bags come from the Farming Set (Pixel-Art) by ScratchIO (CC0 1.0). The turnip is a recolored beet.',
  '- Everything else is original pixel art made for FarmLife.',
  "- Earlier versions used Kenney's Tiny Town and Tiny Farm (CC0 1.0). Thanks, Kenney!",
  '# Fonts',
  '- Pixelify Sans by Stefie Justprince, and Tiny5 by Stefan Schmidt, both under the SIL Open Font License 1.1.',
] }];

// Word-wrap `str` to width `w` at `size`.
export function wrap(g, str, w, size, bold = false) {
  const c = g.ctx, out = [];
  c.font = `${bold ? 'bold ' : ''}${size}px "Pixelify Sans", monospace`;
  for (const word of str.split(' ')) {
    const last = out[out.length - 1];
    if (last !== undefined && c.measureText(last + ' ' + word).width <= w) out[out.length - 1] = last + ' ' + word; else out.push(word);
  }
  return out;
}

// A book over the whole screen: an intro and a button per topic, or (with one topic) just that page. onBack leaves it.
export class Book {
  constructor(topics, onBack, intro = null) { this.topics = topics; this.onBack = onBack; this.intro = intro; this.page = topics.length === 1 ? 0 : -1; this.pick = 0; this.scroll = 0; }
  frame(g) { const m = 6, x = m, y = m, w = g.w - 2 * m, h = g.h - 2 * m; return { x, y, w, h, back: [x + w - 30, y + 4, 26, 11] }; }
  back() { if (this.page < 0 || this.topics.length === 1) this.onBack(); else { this.pick = this.page; this.page = -1; this.scroll = 0; } }
  // Topic buttons, two to a row, under the intro.
  index(g) {
    const { x, y, w } = this.frame(g), intro = this.intro ? wrap(g, this.intro, w - 20, 6) : [], top = y + 26 + intro.length * 8 + (intro.length ? 6 : 0), bw = (w - 24) / 2;
    return { intro, rows: this.topics.map((_, i) => [x + 8 + (i % 2) * (bw + 8), top + Math.floor(i / 2) * 22, bw, 18]) };
  }
  // The page laid out: [{ y, text, size, bold, color, x }], and its full height.
  layout(g) {
    const { x, w } = this.frame(g), out = []; let y = 0;
    for (const l of this.topics[this.page].lines) {
      if (Array.isArray(l)) { const v = wrap(g, l[1], w - 70, 6); out.push({ y, text: l[0], size: 6, bold: true, color: '#fff3a8', x: x + 10 }); v.forEach((t, i) => out.push({ y: y + i * 8, text: t, size: 6, x: x + 58 })); y += v.length * 8 + 2; }
      else if (l.startsWith('# ')) { y += out.length ? 6 : 0; out.push({ y, text: l.slice(2), size: 8, bold: true, color: '#fff3a8', x: x + 8 }); y += 12; }
      else if (/^\d+\. /.test(l)) { const [n, t] = l.split(/\. (.*)/), v = wrap(g, t, w - 32, 6); out.push({ y, text: n + '.', size: 6, bold: true, color: '#fff3a8', x: x + 10 }); v.forEach((t, i) => out.push({ y: y + i * 8, text: t, size: 6, x: x + 20 })); y += v.length * 8 + 3; }
      else if (l.startsWith('- ')) { const v = wrap(g, l.slice(2), w - 32, 6); out.push({ y, text: '•', size: 6, x: x + 12 }); v.forEach((t, i) => out.push({ y: y + i * 8, text: t, size: 6, x: x + 20 })); y += v.length * 8 + 3; }
      else { const v = wrap(g, l, w - 20, 6); v.forEach((t, i) => out.push({ y: y + i * 8, text: t, size: 6, x: x + 10 })); y += v.length * 8 + 4; }
    }
    return { out, height: y };
  }
  maxScroll(g) { const { h } = this.frame(g); return Math.max(0, this.layout(g).height - (h - 30)); }
  update(g, dt) {
    const inp = g.input;
    if (inp.hit('Escape', 'Backspace') || inp.tapIn(...this.frame(g).back)) return this.back();
    if (this.page < 0) {
      const { rows } = this.index(g), n = rows.length;
      if (inp.hit('ArrowUp', 'KeyW')) this.pick = (this.pick + n - 2) % n;
      if (inp.hit('ArrowDown', 'KeyS')) this.pick = (this.pick + 2) % n;
      if (inp.hit('ArrowLeft', 'KeyA')) this.pick = (this.pick + n - 1) % n;
      if (inp.hit('ArrowRight', 'KeyD')) this.pick = (this.pick + 1) % n;
      const t = rows.findIndex(r => inp.tapIn(...r));
      if (t >= 0) this.pick = t;
      if (t >= 0 || inp.hit('Enter', 'Space')) { this.page = this.pick; this.scroll = 0; }
      return;
    }
    // Scroll with the arrows, a drag (like a phone) or the mouse wheel.
    const d = inp.drag?.moved ? (inp.drag.y0 - inp.drag.y) / 8 : inp.dir.y;
    this.scroll = Math.max(0, Math.min(this.maxScroll(g), this.scroll + d * 120 * dt + inp.wheel / 4));
  }
  draw(g) {
    const { x, y, w, h, back } = this.frame(g), c = g.ctx;
    g.panel(x, y, w, h, '#3f2631');
    g.text(this.page < 0 ? 'How to Play' : this.topics[this.page].title, x + w / 2, y + 6, { size: 10, bold: true, align: 'center', color: '#fff3a8' });
    g.button(...back, '#5d7150'); g.text('Back', back[0] + back[2] / 2, back[1] + 2, { size: 6, align: 'center' });
    if (this.page < 0) {
      const { intro, rows } = this.index(g);
      intro.forEach((t, i) => g.text(t, x + w / 2, y + 24 + i * 8, { size: 6, align: 'center' }));
      rows.forEach((r, i) => { g.button(...r, i === this.pick ? '#e86a9a' : '#5d7150cc'); g.text(this.topics[i].title, r[0] + r[2] / 2, r[1] + 5, { size: 7, align: 'center' }); });
      return;
    }
    const top = y + 22, { out } = this.layout(g), max = this.maxScroll(g);
    c.save(); c.beginPath(); c.rect(x, top, w, h - 26); c.clip();
    for (const l of out) g.text(l.text, l.x, top + 2 + l.y - this.scroll, { size: l.size, bold: l.bold, color: l.color });
    c.restore();
    if (max > 0) { const bh = (h - 26) * (h - 26) / (h - 26 + max); g.panel(x + w - 4, top + (h - 26 - bh) * this.scroll / max, 2, bh, '#fff3a888'); }
  }
}
