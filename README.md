# FarmLife
A farming and life sim.

## Play
Online: https://wut-lab.github.io/FarmLife/

## Run it locally
The game uses JavaScript modules, so it needs a local web server:

```
npx serve .        # or: python3 -m http.server
```

Then open the printed address. Works on PC (keyboard), phone and tablet (touch).

## Controls
- Move: arrow keys / WASD, or drag anywhere on the screen (virtual joystick)
- Menus: Enter / tap
- Use the held tool (or pick a ripe crop, or sleep at your front door): Space / E, or tap **Use**
- Hotbar (top left): 1–8 or tap a slot. Slots 1–3 are the hoe, watering can and seed bag; 4–8 are free
- Change seeds: Q, or tap the seed bag slot again
- Bag: I, or tap **Bag**. Tap two slots (bag or hotbar 4–8) to swap them
- Seed shop: face the shop door (next to the house) and press Use. 1–3 buy seeds, S sells all crops
- Shipping bin (next to the shop): press Use to open it, then tap an item and a bin slot to move it in. The 5 slots sell overnight
- Villagers: press Use facing one to talk (once a day raises support). Hold a crop to give it as a gift (one a day; each has favourites). They sometimes ask for crops: bring them and talk to hand in for gold. Hearts unlock gifts and a perk at 5 hearts; see Pause → Friends
- Saving: 4 save files. The game saves automatically each morning after you sleep. Delete a file from the file screen (press twice)
- Pause: Esc / P, or tap **II** (Resume, Controls, Settings, Quit to title). Help: ? key, or tap **?**
- Settings: music and sound volume, day speed (Relaxed / Normal / Fast). Saved per device

## Map editor
Online: https://wut-lab.github.io/FarmLife/editor.html (or `editor.html` locally)

- Paint ground (Path, Field soil, bordered Cobble and Brick, and Shallow / Deep water pick their edge and corner pieces automatically; paths and paving join without a border, deep water gets a ring of shallows and blocks walking), place trees, buildings and props, mark tiles as blocked or walkable (Collide), and set the player start (Spawn)
- **Box** fills an area with ground, or a grid of objects; with **Fence (auto)** it draws a fenced pen
- The map autosaves in the browser. **Export** downloads it as a `.json` file, **Import** opens one
- **Play test** opens the game on your map (`index.html?map=editor`). A house gives you a door to sleep at, a shop a counter, a bin a shipping bin, and soil becomes farmable plots
- Keys: B paint, R box, F fill, E erase, I pick (or Alt+click), C collide, S spawn, H pan, G grid, V collision view, Ctrl+Z / Ctrl+Y undo/redo, right-drag or Space+drag to pan
- Zoom: the zoom bar (bottom right) has −/+, a slider, Fit and 1:1. Mouse wheel or pinch zooms toward the cursor; + / - keys, 0 fits the map, 1 is actual size

## Tests
`npm test`
