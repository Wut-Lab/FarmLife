// Story quests: set requests from particular people, each done once. (Villagers' everyday random requests are in support.js.)
// Talking to the giver asks; talking again with the items hands them in. Some quests open a gate (see unlocks.js).
export const QUESTS = {
  pinecones: {
    giver: 'shopkeeper', item: 'pinecone', n: 5, gold: 5,
    ask: "I was hoping to go gather some pinecones, this morning. But, they blocked off my usual place, down on the road and now I'm too busy. Can you help me out?",
    remind: n => `Any luck with those pinecones? (${n}/5)`,
    thanks: 'Great! Thank you! I hope they finish what they are doing soon, so I can get out there tomorrow morning.',
    opensAt: 25 * 60, // the road's gate opens at 1 AM that night (or by morning, if you sleep first)
  },
};

export class Quests {
  constructor(state) { this.state = JSON.parse(JSON.stringify(state ?? {})); } // id -> { step: 'asked' | 'done', open }
  // Talking to `giver`: { lines, gold } for a quest conversation, { remind } while they're waiting, or null.
  talk(giver, count, take) {
    for (const [id, q] of Object.entries(QUESTS)) {
      if (q.giver !== giver) continue;
      const s = this.state[id];
      if (!s) { this.state[id] = { step: 'asked' }; return { lines: [q.ask] }; }
      if (s.step !== 'asked') continue;
      if (count(q.item) < q.n) return { remind: q.remind(count(q.item)) };
      take(q.item, q.n); s.step = 'done';
      return { lines: [q.thanks, `(+${q.gold}g)`], gold: q.gold };
    }
    return null;
  }
  // Finished quests whose reward waits for a time of night come due at that time, or overnight.
  tick(minutes, night = false) {
    for (const [id, s] of Object.entries(this.state)) if (s.step === 'done' && !s.open && (night || minutes >= (QUESTS[id].opensAt ?? 0))) s.open = true;
  }
  isOpen(id) { return !!this.state[id]?.open; }
}
