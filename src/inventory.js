// Hotbar + bag + shipping bin. Slots 0-2 hold the fixed tools; every other slot holds an item stack {id, n} or null.
export const TOOLS = {
  hoe:   { name: 'Hoe',          icon: 'hoe' },
  can:   { name: 'Watering Can', icon: 'can' },
  seeds: { name: 'Seeds' },
};
export const HOTBAR = 8, LOCKED = 3, BAG = 16, BIN = 5; // bin slots come after the bag

export class Inventory {
  constructor() {
    this.slots = [{ id: 'hoe' }, { id: 'can' }, { id: 'seeds' }, ...Array(HOTBAR - LOCKED + BAG + BIN).fill(null)];
    this.sel = 0;
  }
  get held() { return this.slots[this.sel]; }
  get carried() { return this.slots.slice(0, HOTBAR + BAG); }
  count(id) { return this.carried.reduce((n, s) => n + (s?.id === id ? s.n : 0), 0); }

  // Stacks onto a matching slot, else the first empty bag slot, else the first empty hotbar slot.
  add(id, n = 1) {
    const s = this.carried.find(s => s?.id === id && s.n);
    if (s) { s.n += n; return true; }
    let i = this.carried.indexOf(null, HOTBAR);
    if (i < 0) i = this.carried.indexOf(null, LOCKED);
    if (i < 0) return false;
    this.slots[i] = { id, n };
    return true;
  }

  // Removes every stack of an item; returns how many were removed.
  take(id) {
    let n = 0;
    this.carried.forEach((s, i) => { if (s?.id === id && s.n) { n += s.n; this.slots[i] = null; } });
    return n;
  }

  // Empties the shipping bin and returns what was in it.
  emptyBin() {
    const start = HOTBAR + BAG, out = this.slots.slice(start).filter(Boolean);
    this.slots.fill(null, start);
    return out;
  }

  // Swap any two non-tool slots (hotbar or bag).
  swap(a, b) {
    if (a < LOCKED || b < LOCKED) return false;
    [this.slots[a], this.slots[b]] = [this.slots[b], this.slots[a]];
    return true;
  }
}
