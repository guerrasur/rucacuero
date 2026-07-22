// Modo Carrera: contrarreloj desde la tierra. El jugador tiene un tiempo
// límite para subir lo más alto posible; al agotarse cae al piso y la altura
// alcanzada paga hormigas coloradas (moneda propia del modo, aparte de las
// negras del zen). Los perfectos encadenados agrandan el salto
// exponencialmente y sin tope — eso vive en climb.js (jumpMul).
import { state, save } from './state.js';
import { climb } from './climb.js';
import { prestigeMul } from './economy.js';

export const RUN_TIME = 5; // segundos base de cada carrera (el reloj la estira hasta 90)

// Tiempo total por nivel de "reloj de savia": arranca suave (5→7 s) y los
// escalones crecen para que cada compra se sienta más grande, hasta 90 s MÁX.
const RELOJ_TIEMPOS = [RUN_TIME, 7, 9.5, 12.5, 16, 20, 25, 31, 38, 46, 56, 70, 90];

// Mejoras del modo carrera, se pagan con hormigas coloradas.
export const R_UPGRADES = [
  {
    id: 'resorte',
    name: 'Piernas de resorte',
    desc: 'Tendones curtidos en la corteza. +8% de salto base por nivel.',
    baseCost: 30,
    growth: 1.7,
    max: 15,
  },
  {
    id: 'reloj',
    name: 'Reloj de savia',
    desc: 'La gota tarda más en caer. Cada nivel estira la carrera, hasta 90 s.',
    baseCost: 40,
    growth: 1.8,
    max: 12,
  },
  {
    id: 'eco',
    name: 'Eco del perfecto',
    desc: 'Cada perfecto encadenado impulsa más fuerte el salto siguiente.',
    baseCost: 120,
    growth: 2.1,
    max: 8,
  },
  {
    id: 'botin',
    name: 'Botín de altura',
    desc: 'Cosecha en las copas: +25% de hormigas coloradas por carrera.',
    baseCost: 80,
    growth: 1.9,
    max: 12,
  },
];

export function timeTotal() {
  return RELOJ_TIEMPOS[Math.min(state.carrera.upgrades.reloj, RELOJ_TIEMPOS.length - 1)];
}

export function upgradeCost(def) {
  return Math.ceil(def.baseCost * Math.pow(def.growth, state.carrera.upgrades[def.id]));
}

export function canBuy(def) {
  return (
    state.carrera.upgrades[def.id] < def.max &&
    Math.floor(state.carrera.ants) >= upgradeCost(def)
  );
}

export function buy(def) {
  if (!canBuy(def)) return false;
  state.carrera.ants -= upgradeCost(def);
  state.carrera.upgrades[def.id] += 1;
  save();
  return true;
}

// La run en curso. No persiste: cerrar el juego a mitad de carrera la termina.
export const run = {
  active: false,
  // el reloj arranca recién con el PRIMER agarre: el salto inicial (y sus
  // reintentos si te quedás corto) no descuenta tiempo
  started: false,
  left: 0,
  peak: 0,
  falling: false,
  // animación de suelo tras la caída: tumbado contra la tierra y levantarse
  ground: null, // { phase: 'tumbado' | 'levanta', t, dur }
  queue: [],

  emit(type, data) {
    this.queue.push(Object.assign({ type }, data));
  },
  takeEvents() {
    return this.queue.splice(0);
  },

  // el primer salto arma la carrera; el reloj queda en pausa hasta el agarre
  onPress() {
    if (state.mode !== 'carrera' || this.active) return;
    this.active = true;
    this.started = false;
    this.left = timeTotal();
    this.peak = 0;
    this.falling = false;
    this.emit('run-start', { total: this.left });
  },

  // main lo llama al primer agarre/perfecto: recién ahí corre el tiempo
  onGrab() {
    if (this.active && !this.started) this.started = true;
  },

  // durante la caída y el tumbado no se puede saltar (main bloquea el input)
  blocked() {
    return this.falling || !!this.ground;
  },

  reward() {
    return Math.round(this.peak * 2 * (1 + 0.25 * state.carrera.upgrades.botin) * prestigeMul());
  },

  update(dt) {
    if (state.mode !== 'carrera') return;
    // el tumbado y el levantarse corren aunque la run ya haya pagado
    if (this.ground) {
      this.ground.t -= dt;
      if (this.ground.t <= 0) {
        this.ground =
          this.ground.phase === 'tumbado' ? { phase: 'levanta', t: 0.45, dur: 0.45 } : null;
      }
    }
    if (!this.active) return;
    this.peak = Math.max(this.peak, state.height);
    if (!this.falling) {
      // el reloj recién corre una vez agarrada la primera rama
      if (this.started) this.left = Math.max(0, this.left - dt);
      if (this.started && this.left <= 0) {
        // se acabó el aire: si venía cargando, la carga se pierde;
        // un salto o resbalón en vuelo termina primero (el pico cuenta)
        if (climb.phase === 'charging') {
          climb.phase = 'idle';
          climb.power = 0;
        }
        if (climb.phase === 'idle') {
          this.falling = true;
          climb.breakStreak();
          const dur = Math.max(1, Math.min(2.5, 0.8 + state.height * 0.01));
          climb.startSlip(state.height, 0, dur); // cae a la tierra
          this.emit('run-fall');
        }
      }
    } else if (climb.phase === 'idle') {
      // tocó la tierra: se acredita el botín y queda tumbado un momento
      this.finish();
      this.ground = { phase: 'tumbado', t: 1.1, dur: 1.1 };
    }
  },

  // Cierra la run pagando SIEMPRE lo ganado (jamás se le quita al jugador).
  finish() {
    if (!this.active) return null;
    const r = this.reward();
    state.carrera.ants += r;
    state.carrera.best = Math.max(state.carrera.best, this.peak);
    this.emit('run-end', { peak: this.peak, reward: r });
    this.active = false;
    this.started = false;
    this.falling = false;
    this.left = 0;
    save();
    return r;
  },
};

// Anillos del monte que paga bajar desde una altura H. Cambiás la altura que
// igual iba a cero por un bono permanente. Curva con retornos decrecientes;
// por debajo del piso no da nada (el rebirth igual funciona). Tunable.
const ALTURA_MIN_ANILLO = 20;
export function anillosPorAltura(h) {
  if (h < ALTURA_MIN_ANILLO) return 0;
  return Math.floor(Math.sqrt(h / 8));
}

// "Rebirth" suave: bajar a la tierra y volver a empezar desde la zona 0, sin
// perder hormigas, savia, mejoras ni récord. Resetea la altura del modo activo
// y, a cambio de esa altura sacrificada, paga anillos del monte (prestige
// permanente, solo suma). Devuelve cuántos anillos ganó para la UI.
export function volverAZona0() {
  const ganados = anillosPorAltura(state.height);
  if (state.mode === 'carrera') {
    run.finish(); // si había una run, paga lo ganado (nada se pierde)
    run.ground = null;
  } else {
    state.zen.height = 0;
  }
  state.prestige.anillos += ganados; // capa aditiva: jamás baja
  state.height = 0;
  climb.resetForMode();
  save();
  return ganados;
}

// Cambio de modo: guarda la altura del modo saliente y carga la del entrante.
export function setMode(m) {
  if (m === state.mode) return;
  if (state.mode === 'carrera') {
    run.finish(); // si había run en curso, paga igual: nada se pierde
    run.ground = null; // el tumbado no viaja al zen
    state.carrera.best = Math.max(state.carrera.best, state.bestHeight);
  } else {
    state.zen.height = state.height;
    state.zen.best = state.bestHeight;
  }
  state.mode = m;
  if (m === 'zen') {
    state.height = state.zen.height;
    state.bestHeight = state.zen.best;
  } else {
    state.height = 0; // la carrera siempre arranca desde la tierra
    state.bestHeight = state.carrera.best;
  }
  climb.resetForMode();
  save();
}
