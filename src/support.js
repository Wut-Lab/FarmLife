// Support: friendship with each villager, raised by talking, gifts and quests. Hearts unlock rewards and perks.
import { CROPS, SEEDS } from './crops.js';

export const PER_HEART = 100, MAX_HEARTS = 10;
const TALK = 10, GIFT = { love: 80, like: 45, neutral: 20, dislike: -30 }, QUEST_PTS = 60, QUEST_DAYS = 3, QUEST_CHANCE = 0.35;

// Villagers by sprite sheet. Each has favourite gifts and a perk unlocked at PERK_AT hearts.
export const PERK_AT = 5;
export const PEOPLE = {
  villager_male: { name: 'Hank', loves: ['cabbage'], likes: ['turnip'], dislikes: [],
    perk: { id: 'bargain', text: 'Crops sell for 10% more' }, hello: ['Hi!'] },
  villager_female: { name: 'Rosa', loves: ['turnip'], likes: ['carrot'], dislikes: [],
    perk: { id: 'discount', text: 'Seeds cost 10% less' }, hello: ['What a beautiful day!'] },
  villager_child: { name: 'Pip', loves: ['carrot'], likes: [], dislikes: ['cabbage'],
    perk: { id: 'green_thumb', text: 'Watering takes no energy' }, hello: ['How is your farm?'] },
};
// Rewards for reaching each heart level, once each (the perk comes at PERK_AT).
export const REWARDS = { 2: { gold: 100 }, 4: { seeds: 5 }, 7: { gold: 300 }, 10: { gold: 1000 } };

export class Support {
  constructor(state) {
    // per person: pts, talked/gifted today, quest { item, n, gold, days }, rewarded (highest heart level paid out)
    this.people = {};
    for (const id of Object.keys(PEOPLE)) this.people[id] = { pts: 0, talked: false, gifted: false, quest: null, rewarded: 0, ...state?.[id] };
  }
  get state() { return this.people; }
  hearts(id) { return Math.floor(this.people[id].pts / PER_HEART); }
  has(perk) { return Object.entries(PEOPLE).some(([id, p]) => p.perk.id === perk && this.hearts(id) >= PERK_AT); }

  // Adds points; returns rewards for any heart levels newly reached: [{ hearts, gold?, seeds?: { crop: n }, perk? }].
  add(id, pts) {
    const p = this.people[id];
    p.pts = Math.max(0, Math.min(MAX_HEARTS * PER_HEART, p.pts + pts));
    const out = [];
    for (let h = p.rewarded + 1; h <= this.hearts(id); h++) {
      const r = { hearts: h, ...REWARDS[h] };
      if (r.seeds) r.seeds = { [PEOPLE[id].loves[0]]: r.seeds };
      if (h === PERK_AT) r.perk = PEOPLE[id].perk;
      out.push(r); p.rewarded = h;
    }
    return out;
  }

  // Once a day talking helps a little.
  talk(id) { const p = this.people[id]; if (p.talked) return []; p.talked = true; return this.add(id, TALK); }

  // One gift a day. Returns { taste, rewards } or null if already given today.
  gift(id, item) {
    const p = this.people[id], who = PEOPLE[id];
    if (p.gifted) return null;
    p.gifted = true;
    const taste = who.loves.includes(item) ? 'love' : who.likes.includes(item) ? 'like' : who.dislikes.includes(item) ? 'dislike' : 'neutral';
    return { taste, rewards: this.add(id, GIFT[taste]) };
  }

  // Hand in a quest if `count(item)` covers it; `take(item, n)` removes the items. Returns { gold, rewards } or null.
  turnIn(id, count, take) {
    const q = this.people[id].quest;
    if (!q || count(q.item) < q.n) return null;
    take(q.item, q.n); this.people[id].quest = null;
    return { gold: q.gold, rewards: this.add(id, QUEST_PTS) };
  }

  // Each night: new day's talk and gift, quests count down, and some villagers ask for something new.
  overnight(rand = Math.random) {
    for (const [id, p] of Object.entries(this.people)) {
      p.talked = p.gifted = false;
      if (p.quest && --p.quest.days <= 0) p.quest = null;
      if (!p.quest && rand() < QUEST_CHANCE) {
        const item = SEEDS[Math.floor(rand() * SEEDS.length)], n = 1 + Math.floor(rand() * 3);
        p.quest = { item, n, gold: Math.round(CROPS[item].price * n * 1.5), days: QUEST_DAYS };
      }
    }
  }
}

