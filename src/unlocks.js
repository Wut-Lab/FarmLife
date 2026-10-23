// Locked areas. Each map's gate stays shut, and says `locked` when you Use it, until open(world) is true; then it swings open.
export const GATES = {
  road: { locked: 'Under Construction', open: w => w.quests.isOpen('pinecones'), opened: 'The gate on the road is open now.' }, // Fredrick's pinecone quest
};
