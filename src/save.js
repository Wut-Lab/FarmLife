// Four save files in localStorage. The game auto-saves each morning after you sleep.
export const SLOTS = 4;
const key = slot => `farmlife.save.${slot}`;

export function readSave(slot) {
  try { return JSON.parse(localStorage.getItem(key(slot))); } catch { return null; }
}
export function writeSave(slot, data) {
  try { localStorage.setItem(key(slot), JSON.stringify({ ...data, savedAt: Date.now() })); return true; } catch { return false; }
}
export function deleteSave(slot) {
  try { localStorage.removeItem(key(slot)); } catch {}
}
export const listSaves = () => Array.from({ length: SLOTS }, (_, i) => readSave(i));
