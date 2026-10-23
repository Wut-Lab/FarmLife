import { Game } from './engine.js';
import { Menu } from './scenes.js';
import { STYLES } from './traveller.js';

const game = new Game(document.getElementById('game'));
await Promise.all([
  game.load({
    art: 'assets/art/world.png',
    male: 'assets/characters/farmer_male.png',
    female: 'assets/characters/farmer_female.png',
    villager_male: 'assets/characters/villager_male.png',
    villager_female: 'assets/characters/villager_female.png',
    villager_child: 'assets/characters/villager_child.png',
    shopkeeper: 'assets/characters/shopkeeper.png',
    storekeeper: 'assets/characters/storekeeper.png',
    wanderer: 'assets/characters/wanderer.png',
    minstrel: 'assets/characters/minstrel.png',
    salesman: 'assets/characters/salesman.png',
    ...Object.fromEntries(STYLES.map(k => [`traveller_${k}`, `assets/characters/traveller_${k}.png`])),
  }),
  document.fonts?.load('10px "Pixelify Sans"').catch(() => {}),
  document.fonts?.load('bold 10px "Pixelify Sans"').catch(() => {}),
]);
window.game = game; // handy for debugging in the console
game.start(new Menu());
