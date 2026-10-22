// Villager schedules: where each person is through the day. Planned in the Villager Schedule artifact, which exports this shape.
// A rule starts at `hour` (6 = 6 AM ... 25 = 1 AM) and lasts until the next rule. `day` (Mon..Sun) and `season` are optional;
// a rule with them only counts on that day/season, and beats a plain rule at the same hour.
//   move:   go to map x, y and walk a square of `size` tiles there (0: stand still)
//   wander: go somewhere random in `map`, a new spot each hour
//   sleep:  go home for the night (not seen anywhere)
// Someone with no rules isn't scheduled: they stay where the map places them.
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const ACTS = ['move', 'wander', 'sleep'];

export const SCHEDULES = {
  shopkeeper: [ // Fredrick
    { hour: 6, act: 'move', map: 'town', x: 15, y: 9, size: 0 }, // in front of the counter
    { hour: 13, act: 'move', map: 'town', x: 13, y: 8, size: 0 }, // next to his stall
    { hour: 21, act: 'sleep' },
  ],
  storekeeper: [], // Bella: no rules yet, so they stay wherever the map places them
  villager_male: [ // Hank
    { hour: 6, act: 'move', map: 'town', x: 20, y: 9, size: 2 },
    { hour: 12, act: 'move', map: 'road', x: 18, y: 12, size: 2 },
    { hour: 17, act: 'wander', map: 'town' },
    { hour: 21, act: 'sleep' },
  ],
  villager_female: [ // Rosa
    { hour: 6, act: 'move', map: 'town', x: 22, y: 9, size: 2 },
    { hour: 11, act: 'move', map: 'farm', x: 29, y: 15, size: 2 },
    { hour: 15, act: 'move', map: 'town', x: 30, y: 18, size: 2 },
    { hour: 21, act: 'sleep' },
  ],
  villager_child: [ // Pip
    { hour: 6, act: 'move', map: 'farm', x: 12, y: 15, size: 2 },
    { hour: 10, act: 'wander', map: 'farm' },
    { hour: 10, day: 'Sat', act: 'wander', map: 'town' },
    { hour: 14, act: 'move', map: 'town', x: 4, y: 24, size: 2 },
    { hour: 21, act: 'sleep' },
  ],
};

// The rule someone follows at `hour` on `day` (Mon..Sun) of `season`; asleep before their first rule.
export function activity(rules, hour, day, season) {
  const spec = r => !!r.day + !!r.season;
  const fits = rules.filter(r => r.hour <= hour && (!r.day || r.day === day) && (!r.season || r.season === season));
  fits.sort((a, b) => a.hour - b.hour || spec(a) - spec(b));
  return fits.at(-1) ?? { act: 'sleep' };
}

// Day of the week for day 1..28 of a season (day 1 is a Monday).
export const weekday = day => DAYS[(day - 1) % 7];
