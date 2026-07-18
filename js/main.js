// Ruca Cuero — loop principal y wiring de input.
import { state, load, initAutosave } from './state.js';
import * as economy from './economy.js';
import { climb, wind } from './climb.js';
import { Scene } from './scene.js';
import * as ui from './ui.js';
import * as audio from './audio.js';

load();
initAutosave();

const canvas = document.getElementById('scene');
const scene = new Scene(canvas);
ui.init();

// input: toda la pantalla de juego es el botón de carga
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  ui.hideHint();
  audio.ensure();
  climb.press();
});
window.addEventListener('pointerup', () => climb.release());
window.addEventListener('pointercancel', () => climb.release());
window.addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.repeat) {
    ui.hideHint();
    audio.ensure();
    climb.press();
  }
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space') climb.release();
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

let last = performance.now();
let prevWindPhase = wind.phase;

function frame(now) {
  // dt acotado: al volver de background no se acredita tiempo (sin progreso offline)
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  for (const u of economy.tick(dt)) ui.toast(u);
  wind.update(dt);
  if (wind.phase === 'gust' && prevWindPhase !== 'gust') audio.gust(wind.dur);
  prevWindPhase = wind.phase;
  climb.update(dt);
  if (climb.phase === 'charging') audio.chargeUpdate(climb.power);
  else audio.chargeEnd();

  for (const ev of climb.takeEvents()) {
    ui.onClimbEvent(ev);
    switch (ev.type) {
      case 'grab':
        audio.grab();
        scene.burst('bark');
        break;
      case 'perfect':
      case 'chain':
        audio.perfect();
        scene.burst('spark');
        break;
      case 'resin':
        audio.resin();
        scene.burst('spark');
        break;
      case 'short':
        audio.slip();
        scene.burst('dust');
        scene.addShake(0.5);
        break;
      case 'over':
      case 'badluck':
        audio.slip();
        scene.burst('dust');
        scene.addShake(1);
        break;
      case 'zone':
        ui.showZone(ev.zone);
        audio.zoneFanfare();
        break;
    }
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
