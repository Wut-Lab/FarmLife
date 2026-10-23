// Pets: stray cats and dogs that wander the Wilds, made up on the spot like travellers. A random name, kind, coat and pattern.
// (Adopting one comes later.) The sheets (assets/characters/pet_<kind>.png, drawn by tools/make_art.py) use key colours swapped here.
import { paintSheet } from './traveller.js';

export const PET_CHANCE = 0.7; // chance of a stray when you walk into the Wilds (and again for a second one)
export const KINDS = { cat: 'cat', dog: 'dog', pup: 'dog' }; // sheet -> what it is (pup: the pointy-eared dog)
export const NAMES = ['Biscuit', 'Pepper', 'Mochi', 'Pickles', 'Bean', 'Noodle', 'Waffles', 'Clementine', 'Turnip', 'Juniper', 'Pumpkin', 'Socks',
  'Ziggy', 'Maple', 'Olive', 'Toast', 'Dumpling', 'Radish', 'Scout', 'Fig', 'Button', 'Pip', 'Hazel', 'Barley', 'Nutmeg', 'Rufus', 'Luna', 'Clover'];
// Coats: name, then base / light / dark.
const COATS = {
  cat: [['ginger', '#e08a3a', '#f4aa5a', '#a85e24'], ['black', '#3a3236', '#54484e', '#221c20'], ['grey', '#8a8a96', '#a8a8b4', '#626270'],
    ['cream', '#e8d0a8', '#f8e6c8', '#c0a07a'], ['brown', '#8a5a3a', '#a8744e', '#603c24'], ['white', '#ecebe6', '#ffffff', '#c4c2bc']],
  dog: [['black', '#3a3236', '#54484e', '#221c20'], ['brown', '#8a5a3a', '#a8744e', '#603c24'], ['golden', '#d8a050', '#ecbe74', '#a87434'],
    ['sandy', '#c89a5a', '#e0b878', '#94683a'], ['grey', '#8a8a96', '#a8a8b4', '#626270'], ['white', '#ecebe6', '#ffffff', '#c4c2bc']],
};
const WHITE = '#f4f0e8', EYES = { cat: ['#6ab04a', '#e8c040', '#5a9ad8', '#d88a3a'], dog: ['#4a3a2a', '#6a4a2a', '#5a9ad8'] };
// What they do when you pet them.
export const SOUNDS = { cat: ['purrs.', 'mrrps at you.', 'headbutts your hand.', 'slow-blinks at you.'], dog: ['wags its tail.', 'licks your hand.', 'rolls over for belly rubs.', 'gives a happy woof!'] };

// A made-up pet: { kind (sheet), name, about ("ginger tabby cat"), swap: { key colour: new colour } }.
export function petLook(rand = Math.random) {
  const pick = a => a[Math.floor(rand() * a.length)], kind = pick(Object.keys(KINDS)), what = KINDS[kind];
  const [coat, B, Bl, Bd] = pick(COATS[what]), dark = B === '#3a3236';
  // Pattern: cats are tabby, tuxedo or plain; dogs are patched, white-chested or plain.
  const pattern = pick(what === 'cat' ? ['tabby', 'tuxedo', 'plain'] : ['patched', 'white-chested', 'plain']);
  const mark = pattern === 'tabby' ? (dark ? Bl : Bd) : pattern === 'patched' ? (dark || coat === 'grey' ? WHITE : Bd) : B;
  const [belly, bellyD] = pattern === 'plain' || coat === 'white' ? [Bl, B] : [WHITE, '#d4cabc']; // plain coats are just lighter underneath
  const swap = { '#ff1001': B, '#ff1002': Bl, '#ff1003': Bd, '#10ff01': mark, '#0110ff': belly, '#0110fe': bellyD, '#ff10ff': pick(EYES[what]) };
  const about = `${coat}${pattern === 'plain' ? '' : ` ${pattern}`} ${what}`.replace('white white-chested', 'white');
  return { kind, name: pick(NAMES), about, swap };
}
export const paintPet = (images, look) => paintSheet(images[`pet_${look.kind}`], look.swap);
