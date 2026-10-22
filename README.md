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
- Saving: 4 save files. The game saves automatically each morning after you sleep. Delete a file from the file screen (press twice)
- Back to the file screen: Escape (progress since this morning is not saved)

## Tests
`npm test`
