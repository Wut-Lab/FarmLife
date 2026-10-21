import { Game } from './engine.js';
import { Menu } from './scenes.js';

const game = new Game(document.getElementById('game'));
await Promise.all([
  game.load({
    art: 'assets/art/world.png',
    male: 'assets/characters/farmer_male.png',
    female: 'assets/characters/farmer_female.png',
  }),
  document.fonts?.load('10px "Pixelify Sans"').catch(() => {}),
]);
window.game = game; // handy for debugging in the console
game.start(new Menu());
