// Hotbar + bag. Slots 0-2 hold the fixed tools; every other slot holds an item stack {id, n} or null.
export const TOOLS = {
  hoe:   { name: 'Hoe',          icon: 87 },
  can:   { name: 'Watering Can', icon: 84 },
  seeds: { name: 'Seeds' },
};
export const HOTBAR = 8, LOCKED = 3, BAG = 16;

export class Inventory {
  constructor() {
    this.slots = [{ id: 'hoe' }, { id: 'can' }, { id: 'seeds' }, ...Array(HOTBAR - LOCKED + BAG).fill(null)];
    this.sel = 0;
  }
  get held() { return this.slots[this.sel]; }
  count(id) { return this.slots.reduce((n, s) => n + (s?.id === id ? s.n : 0), 0); }

  // Stacks onto a matching slot, else the first empty bag slot, else the first empty hotbar slot.
  add(id, n = 1) {
    const s = this.slots.find(s => s?.id === id && s.n);
    if (s) { s.n += n; return true; }
    let i = this.slots.indexOf(null, HOTBAR);
    if (i < 0) i = this.slots.indexOf(null, LOCKED);
    if (i < 0) return false;
    this.slots[i] = { id, n };
    return true;
  }

  // Swap any two non-tool slots (hotbar or bag).
  swap(a, b) {
    if (a < LOCKED || b < LOCKED) return false;
    [this.slots[a], this.slots[b]] = [this.slots[b], this.slots[a]];
    return true;
  }
}
