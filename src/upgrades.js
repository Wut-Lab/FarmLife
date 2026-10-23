// Tool levels. Every tool has 3 levels; Bella upgrades them for gold and forage, keeping the tool overnight
// (it's back, better, the next morning). The forage basket is bought from her at level 1.
import { FORAGE } from './forage.js';

export const MAX_LEVEL = 3;
const METAL = [null, null, 'copper', 'gold']; // icon/name tier by level
export const UPGRADES = {
  can: { name: 'Watering Can', icon: 'can', about: ['Waters 1 plot.', 'Waters 3 plots in a row.', 'Waters a 3x3 patch.'],
    cost: [null, { gold: 300, stone: 5 }, { gold: 800, stone: 15, stick: 5 }] },
  hoe: { name: 'Hoe', icon: 'hoe', about: ['Clears a plot.', 'Tills grass into new plots on your farm.', 'Tills 3 tiles at once, for less energy.'],
    cost: [null, { gold: 300, stick: 5 }, { gold: 800, stick: 10, stone: 10 }] },
  shovel: { name: 'Shovel', icon: 'shovel', about: ['Digs loose earth, moves plants.', 'Better finds: never just dirt.', 'Best finds, sometimes rare wheat seeds.'],
    cost: [null, { gold: 250, stone: 5 }, { gold: 700, stone: 10, pinecone: 5 }] },
  basket: { name: 'Forage Basket', icon: 'basket', about: ['Picks up forage 1 tile away.', 'Picks up forage 2 tiles away.', 'Picks up forage 3 tiles away.'],
    cost: [{ gold: 150, stick: 5 }, { gold: 300, pinecone: 10 }, { gold: 700, pinecone: 20, stick: 10 }] },
};
export const START_LEVELS = { can: 1, hoe: 1, shovel: 1, basket: 0 }; // the shovel still has to be bought from Bella first

export const toolIcon = (tool, level) => (METAL[level] ? `${UPGRADES[tool].icon}_${METAL[level]}` : UPGRADES[tool].icon);
export const toolName = (tool, level) => (METAL[level] ? `${METAL[level][0].toUpperCase()}${METAL[level].slice(1)} ` : '') + UPGRADES[tool].name;
// "300g + 5 Stone" for a cost.
export const costText = c => [`${c.gold}g`, ...Object.entries(c).filter(([k]) => k !== 'gold').map(([k, n]) => `${n} ${FORAGE[k].name}${n > 1 && k !== 'berries' ? 's' : ''}`)].join(' + ');

// Tiles a tool works on at a level, from the tile in front of you ([x, y]) and the way you face ([dx, dy]).
export function area(tool, level, [x, y], [dx, dy]) {
  const line = n => [...Array(n)].map((_, i) => [x + dx * i, y + dy * i]);
  if (tool === 'can' && level >= 3) { const cx = x + dx, cy = y + dy, out = []; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) out.push([cx + i, cy + j]); return out; }
  if ((tool === 'can' && level === 2) || (tool === 'hoe' && level >= 3)) return line(3);
  return line(1);
}
