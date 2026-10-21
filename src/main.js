import { Game } from './engine.js';
import { Menu } from './scenes.js';

const game = new Game(document.getElementById('game'));
await Promise.all([
  game.load({
    town: 'assets/kenney/tiny-town/Tilemap/tilemap_packed.png',
    farm: 'assets/kenney/tiny-farm/Tilemap/tilemap_packed.png',
    male: 'assets/characters/farmer_male.png',
    female: 'assets/characters/farmer_female.png',
  }),
  document.fonts?.load('10px "Pixelify Sans"').catch(() => {}),
]);
game.start(new Menu());
