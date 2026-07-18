// Ruca Cuero — loop principal y wiring de input.
import { state, load, initAutosave } from './state.js';
import * as economy from './economy.js';
import { climb, wind } from './climb.js';
import { Scene } from './scene.js';
import * as ui from './ui.js';

load();
initAutosave();

const canvas = document.getElementById('scene');
const scene = new Scene(canvas);
ui.init();

// input: toda la pantalla de juego es el botón de carga
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  ui.hideHint();
  climb.press();
});
window.addEventListener('pointerup', () => climb.release());
window.addEventListener('pointercancel', () => climb.release());
window.addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.repeat) {
    ui.hideHint();
    climb.press();
  }
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space') climb.release();
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

let last = performance.now();

function frame(now) {
  // dt acotado: al volver de background no se acredita tiempo (sin progreso offline)
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  for (const u of economy.tick(dt)) ui.toast(u);
  wind.update(dt);
  climb.update(dt);

  for (const ev of climb.takeEvents()) {
    ui.onClimbEvent(ev);
    if (ev.type === 'short') scene.addShake(0.5);
    else if (ev.type === 'over' || ev.type === 'badluck') scene.addShake(1);
  }

  scene.draw(dt, { antRate: economy.antRate(), unlocks: state.unlocks });
  ui.update();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) last = performance.now();
});

// acceso para debug y pruebas automatizadas
window.__ruca = { state, climb, wind, economy };
