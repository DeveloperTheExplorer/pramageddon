import './style.css';
import { Game } from './game.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);

// A friendly pointer cursor over the whole scene while the shift is running.
window.addEventListener('pointerdown', () => {
  if (!game.audio.started) {
    game.audio.init();
    game.audio.startMusic();
  }
}, { once: true });

window.addEventListener('load', () => {
  document.body.classList.add('loaded');
});
