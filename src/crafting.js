// Crafting (Pause > Crafting): turn forage into things. Sprinklers go on your farm and water the 8 plots around them each morning.
export const RECIPES = {
  sprinkler: { name: 'Sprinkler', needs: { stone: 4, stick: 3 }, about: 'Place it on your farm: waters the 8 plots around it each morning.' },
  jam: { name: 'Berry Jam', needs: { berries: 5 }, about: 'Sells for 30g, or eat it for 25 energy.' },
};
// What's still missing for a recipe, given count(id) of what you carry: [[id, short by], ...] (empty: you can make it).
export const missing = (id, count) => Object.entries(RECIPES[id].needs).filter(([k, n]) => count(k) < n).map(([k, n]) => [k, n - count(k)]);
// The plots a set of sprinklers waters: the 8 tiles around each one.
export function sprinkled(keys) {
  const out = new Set();
  for (const key of keys) {
    const [x, y] = key.split(',').map(Number);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) out.add(`${x + dx},${y + dy}`);
  }
  return out;
}
