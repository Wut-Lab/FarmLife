// Travellers: one-off people you might meet in the Wilds, made up on the spot. A random name, body style and colours.
// The body sheets (assets/characters/traveller_<style>.png, drawn by tools/make_art.py) use key colours that get swapped here.
export const TRAVELLER_CHANCE = 0.6; // chance someone is out in the Wilds when you walk in
export const STRANGER_CHANCE = 0.25; // chance the hooded stranger (and their shop) is there too
export const STYLES = ['short', 'long', 'tail', 'bald', 'cap'];
export const NAMES = [
  'Juniper', 'Rowan', 'Hazel', 'Wren', 'Ash', 'Briar', 'Clover', 'Fern', 'Sorrel', 'Linden', 'Marigold', 'Basil', 'Sage', 'Thistle',
  'Olive', 'Reed', 'Aspen', 'Ivy', 'Cedar', 'Poppy', 'Moss', 'Flint', 'Bramble', 'Heather', 'Birch', 'Laurel', 'Tansy', 'Quill',
  'Pepper', 'Robin', 'Lark', 'Otto', 'Mabel', 'Tobias', 'Greta', 'Silas', 'Agnes', 'Hugo', 'Edith', 'Jasper', 'Ines', 'Milo',
];
// What they say: the first time you talk, they introduce themselves; after that, one of the others.
export const HELLOS = ["I'm just passing through.", "Didn't expect to see anyone out here!", 'Lovely woods, these.', 'Out for a long walk.'];
export const LINES = [
  'I heard there are old coins buried around here.', "I've been walking since sunrise.", 'Watch your step near the ponds.',
  'The town is just back down the path, right?', 'Every time I come through, the trees seem to have moved.',
  'I collect pretty rocks. Found any?', 'Nice to meet a friendly face.', "I'll be gone by tomorrow. Always on the move.",
];

const SKINS = [['#f5c7a0', '#ffdcc0', '#d99a78'], ['#e8b48a', '#f6caa4', '#c48a64'], ['#c68a5e', '#dca47a', '#9e6640'],
  ['#9a6440', '#b47e58', '#744628'], ['#6e4430', '#885a44', '#4e2e20'], ['#fbd8c0', '#fff0e0', '#e0b090']];
const HAIRS = [['#2a2228', '#443a40', '#18121a'], ['#5a3a28', '#7a5440', '#3a2418'], ['#8a5a36', '#a8744a', '#5f3b25'],
  ['#e6a64a', '#f6c66a', '#b06a2c'], ['#c8603a', '#e07e52', '#8a3a22'], ['#b8b4b0', '#dcd8d4', '#888480'], ['#f4f0e0', '#ffffff', '#c8c0a8']];
const EYES = [['#4a3a2a', '#8a6a4a'], ['#2f4f8a', '#6f9ad8'], ['#3a6a4a', '#7aaa7a'], ['#5a4a6a', '#9a8aaa']];
const SHOES = ['#5f3b25', '#3a3036', '#7a4a2a'];

// A colour from hue/saturation/lightness (0-360, 0-1, 0-1) as '#rrggbb'.
function hsl(h, s, l) {
  const f = n => { const k = (n + h / 30) % 12, c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(c * 255).toString(16).padStart(2, '0'); };
  return `#${f(0)}${f(8)}${f(4)}`;
}
const shades = (h, s, l) => [hsl(h, s, l), hsl(h, s, Math.min(0.9, l + 0.12)), hsl(h, s, Math.max(0.1, l - 0.15))];

// A made-up traveller: { name, style, swap: { key colour: new colour } }.
export function travellerLook(rand = Math.random) {
  const pick = a => a[Math.floor(rand() * a.length)];
  const [hair, skin, eye] = [pick(HAIRS), pick(SKINS), pick(EYES)];
  const shirt = shades(rand() * 360, 0.35 + rand() * 0.4, 0.45 + rand() * 0.15), pants = shades(rand() * 360, 0.2 + rand() * 0.3, 0.3 + rand() * 0.15);
  const swap = {
    '#ff0001': hair[0], '#ff0002': hair[1], '#ff0003': hair[2], '#00ff01': shirt[0], '#00ff02': shirt[1], '#00ff03': shirt[2],
    '#0100ff': pants[0], '#0200ff': pants[1], '#0300ff': pants[2], '#ff01ff': eye[0], '#ff02ff': eye[1],
    '#01ffff': skin[0], '#02ffff': skin[1], '#03ffff': skin[2], '#fe0101': pick(SHOES),
  };
  return { name: pick(NAMES), style: pick(STYLES), swap };
}

// The traveller's sprite sheet: their style's sheet with the key colours swapped.
export function paintTraveller(images, look) {
  const src = images[`traveller_${look.style}`], c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext('2d'); ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height), px = img.data, hex = i => '#' + [0, 1, 2].map(k => px[i + k].toString(16).padStart(2, '0')).join('');
  for (let i = 0; i < px.length; i += 4) {
    const to = px[i + 3] && look.swap[hex(i)];
    if (to) for (let k = 0; k < 3; k++) px[i + k] = parseInt(to.slice(1 + 2 * k, 3 + 2 * k), 16);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
