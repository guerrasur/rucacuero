// Ruca Cuero — loop principal y wiring de input.
import { state, load, initAutosave } from './state.js';
import * as economy from './economy.js';
import { climb, wind } from './climb.js';
import { Scene } from './scene.js';
import * as ui from './ui.js';
import * as audio from './audio.js';
import { branchEvents } from './events.js';
import * as quests from './quests.js';
import * as logros from './logros.js';
import * as cosmetics from './cosmetics.js';
import * as carrera from './carrera.js';

load();
cosmetics.sanitize();
initAutosave();
quests.init(economy.antRate);

// la lluvia hace la corteza más resbalosa y angosta apenas la zona dulce
climb.mods = {
  slipBonus: () => branchEvents.slipBonus(),
  sweetMul: () => branchEvents.sweetMul(),
};

const canvas = document.getElementById('scene');
const scene = new Scene(canvas);
ui.init();

// input: toda la pantalla de juego es el botón de carga
// (salvo que toques al chucao: eso lo espanta y suelta su bono)
function pressJump() {
  if (carrera.run.blocked()) return; // cayendo al final de la carrera
  carrera.run.onPress(); // en carrera, el primer salto arranca el reloj
  climb.press();
}

canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  ui.hideHint();
  audio.ensure();
  const bp = scene.birdPos;
  if (bp && bp.active && Math.hypot(e.clientX - bp.x, e.clientY - bp.y) < bp.r) {
    branchEvents.scareBird();
    return;
  }
  const sp = scene.swarmPos;
  if (sp && sp.active && Math.hypot(e.clientX - sp.x, e.clientY - sp.y) < sp.r) {
    branchEvents.tapSwarm();
    return;
  }
  pressJump();
});
window.addEventListener('pointerup', () => climb.release());
window.addEventListener('pointercancel', () => climb.release());
window.addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.repeat) {
    if (ui.menuAbierto()) return; // dentro de un menú (tienda/ropero) no se salta
    // sin esto, Espacio "clickea" el último botón enfocado (mute/tienda)
    e.preventDefault();
    ui.hideHint();
    audio.ensure();
    pressJump();
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

  // hormigas negras, eventos de rama y misiones son del zen; la savia y el
  // viento corren siempre
  const zen = state.mode === 'zen';
  for (const u of economy.tick(dt, zen ? branchEvents.sapMul() : 1, zen)) ui.toast(u);
  wind.update(dt);
  if (wind.phase === 'gust' && prevWindPhase !== 'gust') audio.gust(wind.dur);
  prevWindPhase = wind.phase;
  if (zen) branchEvents.update(dt);
  climb.update(dt);
  carrera.run.update(dt);
  if (climb.phase === 'charging') audio.chargeUpdate(climb.power);
  else audio.chargeEnd();
  audio.ambientUpdate(dt, {
    raining: branchEvents.raining(),
    foggy: !!branchEvents.fog,
    gusting: wind.windy(),
  });
  // el granizo suena a piedritas sueltas contra la corteza
  if (branchEvents.hail && Math.random() < dt * 6) audio.hailTick();

  const climbEvents = climb.takeEvents();
  for (const ev of climbEvents) {
    ui.onClimbEvent(ev);
    switch (ev.type) {
      case 'grab':
        carrera.run.onGrab(); // el reloj recién corre con la primera rama
        audio.grab();
        scene.burst('bark');
        if (zen) {
          quests.note('grab', 1, { windy: wind.windy() });
          quests.note('meters', ev.gain);
        }
        logros.bump('metros', ev.gain);
        break;
      case 'perfect-release':
        // feedback inmediato: el destello sale al soltar, no al aterrizar
        scene.perfectFlash();
        break;
      case 'perfect':
      case 'chain':
        carrera.run.onGrab(); // el reloj recién corre con la primera rama
        // la racha se escucha: cada perfecto encadenado sube un escalón
        audio.perfect(ev.streak || climb.perfectStreak || 1);
        scene.burst('spark');
        if (zen) quests.note('grab', 1, { windy: wind.windy() });
        if (ev.type === 'perfect') {
          if (zen) quests.note('perfect');
          logros.bump('perfectos');
        }
        if (ev.gain) {
          if (zen) quests.note('meters', ev.gain);
          logros.bump('metros', ev.gain);
        }
        break;
      case 'resin':
        audio.resin();
        scene.burst('spark');
        break;
      case 'short':
        audio.slip();
        scene.burst('dust');
        scene.addShake(0.5);
        if (zen) quests.note('slip');
        break;
      case 'over':
      case 'badluck':
        audio.slip();
        scene.burst('dust');
        scene.addShake(1);
        if (zen) quests.note('slip');
        break;
      case 'zone':
        ui.showBanner(ev.zone.name, `${ev.zone.at} m`);
        audio.zoneFanfare();
        break;
    }
  }
  // récord y misiones son métricas derivadas: se chequean solo cuando hubo eventos
  if (climbEvents.length) logros.checkDerived();

  for (const ev of branchEvents.takeEvents()) {
    switch (ev.type) {
      case 'rain-start':
        ui.showBanner('Lluvia', 'savia doble · corteza resbalosa');
        audio.rainStart();
        break;
      case 'rain-end':
        audio.rainStop();
        logros.bump('lluvias');
        break;
      case 'bird-spawn':
        audio.chirp();
        break;
      case 'fog-start':
        ui.showBanner('Niebla', 'savia ×1,5 · zona dulce angosta');
        break;
      case 'dew-start':
        ui.showBanner('Rocío', 'savia ×1,5 · zona dulce más ancha');
        audio.dewChime();
        break;
      case 'dew-end':
        logros.bump('lluvias'); // el rocío también curte de agua
        break;
      case 'hail-start':
        ui.showBanner('Granizo', 'aguantá: las hormigas juntan el granizo dulce');
        break;
      case 'hail-end': {
        // el bono del granizo: siempre suma, jamás resta
        const bonus = Math.max(20, Math.round(economy.antRate() * 35));
        state.ants += bonus;
        ui.flash(`+${bonus.toLocaleString('es-AR')} hormigas`, 'good');
        audio.shimmer();
        break;
      }
      case 'swarm-spawn':
        audio.shimmer();
        break;
      case 'swarm-tapped': {
        const bonus = Math.max(15, Math.round(economy.antRate() * 30));
        state.ants += bonus;
        ui.flash(`+${bonus.toLocaleString('es-AR')} hormigas`, 'good');
        if (scene.swarmPos) scene.burst('spark', scene.swarmPos.x, scene.swarmPos.y);
        audio.shimmer();
        logros.bump('enjambres');
        break;
      }
      case 'bird-scared': {
        const bonus = Math.max(12, Math.round(economy.antRate() * 25));
        state.ants += bonus;
        ui.flash(`+${bonus.toLocaleString('es-AR')} hormigas`, 'good');
        if (scene.birdPos) scene.burst('spark', scene.birdPos.x, scene.birdPos.y);
        audio.chirp();
        quests.note('bird');
        logros.bump('chucaos');
        break;
      }
    }
  }

  for (const ev of carrera.run.takeEvents()) {
    switch (ev.type) {
      case 'run-start':
        ui.showBanner('¡A trepar!', `${ev.total.toLocaleString('es-AR', { maximumFractionDigits: 1 })} s para subir lo más alto posible`);
        break;
      case 'run-fall':
        ui.showBanner('¡Se acabó el tiempo!', 'de vuelta a la tierra');
        audio.slip();
        scene.burst('dust');
        scene.addShake(1.2);
        break;
      case 'run-end': {
        const m = ev.peak.toLocaleString('es-AR', { maximumFractionDigits: 1 });
        ui.showBanner('Fin de la carrera', `${m} m · +${ev.reward.toLocaleString('es-AR')} coloradas`);
        ui.flash(`+${ev.reward.toLocaleString('es-AR')} hormigas coloradas`, 'good');
        audio.questDone();
        break;
      }
    }
  }

  for (const ev of quests.takeEvents()) {
    if (ev.type === 'quest-done') {
      ui.questToast(ev.text, ev.reward);
      // paso del cuento: el relato se muestra en el banner central
      if (ev.relato) ui.showBanner('El cuento del monte', ev.relato);
      logros.checkDerived();
    }
  }

  for (const ev of logros.takeEvents()) {
    ui.logroToast(ev.def);
    audio.unlockChime();
  }

  scene.draw(dt, { antRate: economy.antRate(), unlocks: state.unlocks });
  ui.update();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) last = performance.now();
});

// PWA: instalable en el celular. En localhost no se registra (salvo ?sw=1)
// para que el desarrollo y los tests nunca vean caché rancio.
const esLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && (!esLocal || new URLSearchParams(location.search).has('sw'))) {
  navigator.serviceWorker.register('sw.js');
}

// acceso para debug y pruebas automatizadas
window.__ruca = { state, climb, wind, economy, events: branchEvents, quests, logros, cosmetics, carrera, scene };
