// Capa de altura: escalada manual con carga de salto (hold-to-charge),
// nudos de la rama, viento y resbalones. Aislada de la economía: la altura
// solo baja por fallo de habilidad o mala suerte, nunca por gastar hormigas.
import { state } from './state.js';
import { slipChance } from './economy.js';

export const MAX_JUMP = 6; // metros de salto a carga máxima
export const CHARGE_SPEED = 0.55; // potencia por segundo (carga completa ~1,8 s)
export const PERFECT_W = 0.14; // metros: micro-zona de soltada perfecta

const SWEET_BASE = 0.55; // semiancho de la zona dulce en metros
const SWEET_WIND = 0.3; // semiancho durante ráfaga
const LOSS_SHORT = 1.2;
const LOSS_OVER = 3.0;
const LOSS_LUCK = 2.2;
const LEAP_TIME = 0.5;
const SLIP_TIME = 0.7;
const RESIN_EVERY = 5; // saltos entre salvadas de resina

function frac(x) {
  return x - Math.floor(x);
}
export function hash(i) {
  return frac(Math.sin(i * 127.1 + 311.7) * 43758.5453);
}

// Los nudos son deterministas: la rama es la misma en cada sesión.
const knots = [0];
export function knotHeight(i) {
  while (knots.length <= i) {
    const k = knots.length;
    knots.push(knots[k - 1] + 2.2 + hash(k) * 2.3);
  }
  return knots[i];
}
export function nextKnotIndex(h) {
  let i = 0;
  while (knotHeight(i) <= h + 0.01) i++;
  return i;
}
export function knotHasSap(i) {
  return hash(i * 3.7 + 11) > 0.55;
}

// ---------- viento ----------
export const wind = {
  phase: 'calm', // calm | warn | gust
  timer: 5 + Math.random() * 6,
  dur: 2.2,
  update(dt) {
    this.timer -= dt;
    if (this.phase === 'calm') {
      if (this.timer <= 1.5) this.phase = 'warn';
    } else if (this.phase === 'warn') {
      if (this.timer <= 0) {
        this.phase = 'gust';
        this.dur = 2.0 + Math.random() * 0.8;
        this.timer = this.dur;
      }
    } else if (this.phase === 'gust') {
      if (this.timer <= 0) {
        this.phase = 'calm';
        this.timer = 6 + Math.random() * 5;
      }
    }
  },
  windy() {
    return this.phase === 'gust';
  },
  warning() {
    return this.phase === 'warn';
  },
  gustProgress() {
    return this.phase === 'gust' ? 1 - this.timer / this.dur : 0;
  },
};

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
function easeInOut(t) {
  return t * t * (3 - 2 * t);
}

// ---------- máquina de estados del salto ----------
export const climb = {
  phase: 'idle', // idle | charging | leaping | slipping
  power: 0,
  t: 0,
  targetKnot: 1,
  jumpStart: 0,
  leapTo: 0,
  slipFrom: 0,
  slipTo: 0,
  result: null, // 'grab' | 'short' | 'over'
  chainSafe: false,
  jumpsSinceResin: RESIN_EVERY,
  chargeAlpha: 0, // para desvanecer overlays de carga en el render
  events: [],

  emit(type, data) {
    this.events.push(Object.assign({ type }, data));
  },
  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  },

  sweetW() {
    return wind.windy() ? SWEET_WIND : SWEET_BASE;
  },
  landingH() {
    return state.height + this.power * MAX_JUMP;
  },

  press() {
    if (this.phase !== 'idle') return;
    this.phase = 'charging';
    this.power = 0;
    this.targetKnot = nextKnotIndex(state.height);
  },

  release() {
    if (this.phase !== 'charging') return;
    const land = this.landingH();
    const kH = knotHeight(this.targetKnot);
    const w = this.sweetW();
    this.jumpStart = state.height;
    this.t = 0;
    this.chainSafe = false;
    if (land < kH - w) {
      this.result = 'short';
      this.leapTo = land;
    } else if (land > kH + w) {
      this.result = 'over';
      this.leapTo = Math.min(land, kH + 1.3);
    } else {
      this.result = 'grab';
      this.leapTo = kH;
      this.perfect = Math.abs(land - kH) <= PERFECT_W;
    }
    this.phase = 'leaping';
  },

  arrive() {
    if (this.result === 'short') {
      this.startSlip(this.leapTo, Math.max(0, this.jumpStart - LOSS_SHORT));
      this.emit('short');
      return;
    }
    if (this.result === 'over') {
      this.startSlip(this.leapTo, Math.max(0, this.jumpStart - LOSS_OVER));
      this.emit('over');
      return;
    }
    // agarre limpio: tirada de mala suerte (salvo encadenado de salto largo)
    this.jumpsSinceResin += 1;
    if (!this.chainSafe && Math.random() < slipChance(wind.windy())) {
      if (state.unlocks.includes('resina') && this.jumpsSinceResin >= RESIN_EVERY) {
        this.jumpsSinceResin = 0;
        this.emit('resin');
      } else {
        this.startSlip(this.leapTo, Math.max(0, this.jumpStart - LOSS_LUCK));
        this.emit('badluck');
        return;
      }
    }
    const gained = this.leapTo - state.height;
    state.height = this.leapTo;
    if (state.height > state.bestHeight) state.bestHeight = state.height;
    if (this.chainSafe) {
      this.emit('chain', { gain: gained });
      this.phase = 'idle';
      return;
    }
    if (this.perfect && state.unlocks.includes('saltolargo')) {
      // salto largo: encadena el siguiente nudo sin tirada de mala suerte
      this.emit('perfect');
      this.jumpStart = state.height;
      this.targetKnot = nextKnotIndex(state.height);
      this.leapTo = knotHeight(this.targetKnot);
      this.t = 0;
      this.result = 'grab';
      this.chainSafe = true;
      return; // sigue en 'leaping'
    }
    this.emit(this.perfect ? 'perfect' : 'grab', { gain: gained });
    this.phase = 'idle';
  },

  startSlip(from, to) {
    this.slipFrom = from;
    this.slipTo = to;
    this.t = 0;
    this.phase = 'slipping';
  },

  update(dt) {
    if (this.phase === 'charging') {
      this.power = Math.min(1, this.power + CHARGE_SPEED * dt);
    } else if (this.phase === 'leaping') {
      this.t += dt / LEAP_TIME;
      if (this.t >= 1) this.arrive();
    } else if (this.phase === 'slipping') {
      this.t += dt / SLIP_TIME;
      if (this.t >= 1) {
        state.height = this.slipTo;
        this.phase = 'idle';
      }
    }
    const target = this.phase === 'charging' ? 1 : 0;
    this.chargeAlpha += (target - this.chargeAlpha) * Math.min(1, dt * 8);
  },

  // Altura para el render (interpola durante salto y resbalón).
  visualHeight() {
    if (this.phase === 'leaping') {
      const t = Math.min(1, this.t);
      return this.jumpStart + (this.leapTo - this.jumpStart) * easeOutCubic(t);
    }
    if (this.phase === 'slipping') {
      const t = Math.min(1, this.t);
      return this.slipFrom + (this.slipTo - this.slipFrom) * easeInOut(t);
    }
    return state.height;
  },
};
