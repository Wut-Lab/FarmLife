// Locked areas. Each map's gate stays shut, and says `locked` when you Use it, until open(world) is true.
// The road's gate leads south to an area still being built; its unlock is picked once that area is fleshed out.
export const GATES = {
  road: { locked: 'Under Construction', open: () => false },
};
