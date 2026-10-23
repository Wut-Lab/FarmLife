// The area south of the road, behind the gate: blank for now, with a path in from the top. Build it in the map editor.
import { blankMap, retile } from './map-data.js';

const d = blankMap(40, 30, 4242), X = 38; // the path lines up with the one down the road's right side
for (let y = 0; y < 3; y++) d.ground[y * d.W + X] = 'path4';
retile(d, X, 1, 2);
export const SOUTH = { ...d, spawn: { x: X, y: 1 }, name: 'Beyond the Gate', exits: { up: 'road' }, npcs: [] };
