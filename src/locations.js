// The places you can walk between. Each location is a map plus exits on its edges where a road meets the edge.
import { mapFromData } from './map-data.js';
import { FARM } from './farm-map.js';
import { ROAD_MAP } from './road-map.js';
import { TOWN } from './town-map.js';
import { wildsData } from './wilds.js';
import { SOUTH } from './south-map.js';

// Every location, by id: its name and how to build its default map (each was built in the editor). The editor can replace any of them.
export const LOCATIONS = {
  farm: { name: 'Farm', build: () => mapFromData(FARM) },
  road: { name: 'Road to Town', build: () => mapFromData(ROAD_MAP) },
  town: { name: 'Town', build: () => ({ ...mapFromData(TOWN), door: null }) }, // only your farmhouse door is for sleeping
  south: { name: 'Beyond the Gate', build: () => ({ ...mapFromData(SOUTH), door: null }) }, // behind the road's gate (unlocks.js); blank for now
  // Generated, not built: a new one each time you walk in (seed and season pick its look).
  wilds: { name: 'The Wilds', fresh: true, build: (seed = Date.now(), season) => ({ ...mapFromData(wildsData(seed, season)), door: null }) },
};
