// Capa de altura: escalada manual con carga de salto (hold-to-charge),
// nudos de la rama, viento y resbalones. Aislada de la economía: la altura
// solo baja por fallo de habilidad o mala suerte, nunca por gastar hormigas.
import { state } from './state.js';
import { slipChance } from './economy.js';

export const MAX_JUMP = 6; // metros de salto a carga máxima
export const CHARGE_SPEED = 0.55; // potencia por segundo (carga completa ~1,8 s)
export const PERFECT_W = 0.14; // metros: micro-zona de soltada perfecta

// Racha de perfectos: cada soltada perfecta seguida sube el multiplicador de
// metros ganados. Cualquier soltada no perfecta (aunque agarre) la corta.
export const STREAK_MULTS = [1, 1.1, 1.2, 1.3, 1.5, 1.7, 2];

const SWEET_BASE = 0.55; // semiancho de la zona dulce en metros
const SWEET_WIND = 0.3; // semiancho durante ráfaga
const LOSS_SHORT = 1.2;
const LOSS_OVER = 3.0;
const LOSS_LUCK = 2.2;
const LEAP_TIME = 0.5;
const SLIP_TIME = 0.7;
// carrera: base exponencial de la racha (cada perfecto multiplica el salto)
const RUN_STREAK_BASE = 1.25;
const RUN_STREAK_ECO = 0.03; // extra por nivel de "eco del perfecto"
const RUN_RESORTE = 0.08; // +salto base por nivel de "piernas de resorte"
const RESIN_EVERY = 5; // saltos entre salvadas de resina

function frac(x) {
  return x - Math.floor(x);
}
export function hash(i) {
  return frac(Math.sin(i * 127.1 + 311.7) * 43758.5453);
}

// Zonas de la rama: a medida que subís cambia la corteza, la distancia entre
// nudos, cuánta savia rezuma y qué tan seguido sopla el viento.
export const ZONES = [
  { at: 0,   name: 'Corteza baja',   verde: '#7FA636', gapMul: 1.0,  sap: 0.45, sweetMul: 1,    calm: [6, 11],   gust: [2.0, 2.8] },
  { at: 30,  name: 'Corteza pelada', verde: '#95A03C', gapMul: 1.12, sap: 0.18, sweetMul: 1,    calm: [5, 9],    gust: [2.0, 2.8] },
  { at: 70,  name: 'Copa ventosa',   verde: '#699F55', gapMul: 1.04, sap: 0.35, sweetMul: 0.95, calm: [3.5, 6.5], gust: [2.4, 3.4] },
  { at: 120, name: 'Rama joven',     verde: '#8AB33D', gapMul: 0.94, sap: 0.55, sweetMul: 0.95, calm: [4.5, 8],  gust: [2.0, 2.8] },
  { at: 180, name: 'Cielo de hojas', verde: '#7BAA69', gapMul: 1.15, sap: 0.3,  sweetMul: 0.9,  calm: [3, 5.5],  gust: [2.6, 3.6] },
  { at: 260, name: 'Enramada del alerce', verde: '#5E8F5C', gapMul: 1.24, sap: 0.4,  sweetMul: 0.85, calm: [2.5, 4.5], gust: [2.8, 3.8] },
  { at: 360, name: 'Filo de la luna',     verde: '#93A98B', gapMul: 1.32, sap: 0.55, sweetMul: 0.8,  calm: [2, 4],     gust: [3, 4.2] },
];

export function zoneAt(h) {
  let z = ZONES[0];
  for (const zz of ZONES) if (h >= zz.at) z = zz;
  return z;
}

// Los nudos son deterministas: la rama es la misma en cada sesión.
const knots = [0];
export function knotHeight(i) {
  while (knots.length <= i) {
    const k = knots.length;
    const z = zoneAt(knots[k - 1]);
    knots.push(knots[k - 1] + (2.2 + hash(k) * 2.3) * z.gapMul);
  }
  return knots[i];
}
// Primer nudo estrictamente por encima de h (búsqueda binaria sobre el memo,
// construyendo bajo demanda: O(log n) por frame en vez de recorrer desde 0).
export function knotIndexAbove(h) {
  while (knots[knots.length - 1] <= h) knotHeight(knots.length);
  let lo = 0;
  let hi = knots.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (knots[mid] <= h) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
export function nextKnotIndex(h) {
  return knotIndexAbove(h + 0.01);
}
export function knotHasSap(i) {
  if (i === 0) return false;
  return hash(i * 3.7 + 11) < zoneAt(knotHeight(i)).sap;
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
        const z = zoneAt(state.height);
        this.phase = 'gust';
        this.dur = z.gust[0] + Math.random() * (z.gust[1] - z.gust[0]);
        this.timer = this.dur;
      }
    } else if (this.phase === 'gust') {
      if (this.timer <= 0) {
        const z = zoneAt(state.height);
        this.phase = 'calm';
        this.timer = z.calm[0] + Math.random() * (z.calm[1] - z.calm[0]);
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
  minKnot: 1,
  jumpStart: 0,
  leapTo: 0,
  slipFrom: 0,
  slipTo: 0,
  result: null, // 'grab' | 'short' | 'over'
  chainSafe: false,
  perfectStreak: 0,
  streakMult: 1,
  jumpsSinceResin: RESIN_EVERY,
  chargeAlpha: 0, // para desvanecer overlays de carga en el render
  lastZone: null,
  // modificadores externos (lluvia, etc.) inyectados por main
  mods: { slipBonus: () => 0, sweetMul: () => 1 },
  events: [],

  emit(type, data) {
    this.events.push(Object.assign({ type }, data));
  },
  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  },

  // En carrera el salto crece: mejora "resorte" × racha de perfectos
  // exponencial y SIN tope (1.25^racha, más fuerte con "eco"). En zen es 1:
  // el modo de siempre queda idéntico.
  jumpMul() {
    if (state.mode !== 'carrera') return 1;
    const u = state.carrera.upgrades;
    return (
      (1 + RUN_RESORTE * u.resorte) *
      Math.pow(RUN_STREAK_BASE + RUN_STREAK_ECO * u.eco, this.perfectStreak)
    );
  },
  jumpMeters() {
    return MAX_JUMP * this.jumpMul();
  },
  sweetW() {
    // "abrigo de brisa": la ráfaga angosta menos la zona dulce.
    // En carrera escala con el salto: el timing (en segundos) no se endurece
    // aunque el salto sea gigante — la racha premia sin volverse imposible.
    const windW = state.unlocks.includes('brisa') ? 0.38 : SWEET_WIND;
    return (
      (wind.windy() ? windW : SWEET_BASE) *
      zoneAt(state.height).sweetMul *
      this.mods.sweetMul() *
      this.jumpMul()
    );
  },
  perfectW() {
    return PERFECT_W * this.jumpMul();
  },
  landingH() {
    return state.height + this.power * this.jumpMeters();
  },

  press() {
    if (this.phase !== 'idle') return;
    this.phase = 'charging';
    this.power = 0;
    this.minKnot = nextKnotIndex(state.height);
    this.targetKnot = this.minKnot;
  },

  // carrera: con saltos grandes se apunta al nudo más cercano al aterrizaje
  // proyectado (nunca menos que el próximo) — un salto puede comerse varios
  retarget() {
    const land = this.landingH();
    const iA = Math.max(this.minKnot, knotIndexAbove(land));
    let t = iA;
    if (iA - 1 >= this.minKnot && land - knotHeight(iA - 1) < knotHeight(iA) - land) t = iA - 1;
    this.targetKnot = t;
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
      this.perfect = Math.abs(land - kH) <= this.perfectW();
      // racha de perfectos. El perfecto es infalible, así que se resuelve acá
      // y el vuelo anima suave hasta la altura final.
      if (this.perfect) {
        this.perfectStreak += 1;
        if (state.mode === 'carrera') {
          // carrera: el premio es el PRÓXIMO salto, exponencialmente más
          // alto y sin tope; el badge ×mult muestra ese multiplicador
          this.streakMult = Math.pow(
            RUN_STREAK_BASE + RUN_STREAK_ECO * state.carrera.upgrades.eco,
            this.perfectStreak
          );
        } else {
          // zen: multiplicador acotado + impulso extra al aterrizar
          // (solo metros de más — jamás resta)
          this.streakMult = STREAK_MULTS[Math.min(this.perfectStreak, STREAK_MULTS.length - 1)];
          this.leapTo += (kH - this.jumpStart) * (this.streakMult - 1);
        }
      } else {
        this.breakStreak();
      }
    }
    this.phase = 'leaping';
  },

  breakStreak() {
    this.perfectStreak = 0;
    this.streakMult = 1;
  },

  arrive() {
    if (this.result === 'short') {
      this.breakStreak();
      this.startSlip(this.leapTo, Math.max(0, this.jumpStart - LOSS_SHORT));
      this.emit('short');
      return;
    }
    if (this.result === 'over') {
      this.breakStreak();
      this.startSlip(this.leapTo, Math.max(0, this.jumpStart - LOSS_OVER));
      this.emit('over');
      return;
    }
    // agarre limpio: tirada de mala suerte (salvo encadenado de salto largo
    // o soltada perfecta — la micro-zona premia la precisión: ahí no se falla)
    this.jumpsSinceResin += 1;
    const slipP = Math.min(0.6, slipChance(wind.windy()) + this.mods.slipBonus());
    if (!this.chainSafe && !this.perfect && Math.random() < slipP) {
      if (state.unlocks.includes('resina') && this.jumpsSinceResin >= RESIN_EVERY) {
        this.jumpsSinceResin = 0;
        this.emit('resin');
      } else {
        this.breakStreak();
        this.startSlip(this.leapTo, Math.max(0, this.jumpStart - LOSS_LUCK));
        this.emit('badluck');
        return;
      }
    }
    const gained = this.leapTo - state.height;
    state.height = this.leapTo;
    if (state.height > state.bestHeight) state.bestHeight = state.height;
    const z = zoneAt(state.height);
    if (this.lastZone && z !== this.lastZone) this.emit('zone', { zone: z });
    this.lastZone = z;
    if (this.chainSafe) {
      this.emit('chain', { gain: gained });
      this.phase = 'idle';
      return;
    }
    if (this.perfect && state.unlocks.includes('saltolargo')) {
      // salto largo: encadena el siguiente nudo sin tirada de mala suerte
      this.emit('perfect', { mult: this.streakMult, streak: this.perfectStreak });
      this.jumpStart = state.height;
      this.targetKnot = nextKnotIndex(state.height);
      this.leapTo = knotHeight(this.targetKnot);
      this.t = 0;
      this.result = 'grab';
      this.chainSafe = true;
      return; // sigue en 'leaping'
    }
    if (this.perfect) {
      this.emit('perfect', { gain: gained, mult: this.streakMult, streak: this.perfectStreak });
    } else {
      this.emit('grab', { gain: gained });
    }
    this.phase = 'idle';
  },

  startSlip(from, to, dur = SLIP_TIME) {
    this.slipFrom = from;
    this.slipTo = to;
    this.slipDur = dur;
    this.t = 0;
    this.phase = 'slipping';
  },

  // al cambiar de modo la máquina vuelve a cero (sin racha heredada)
  resetForMode() {
    this.phase = 'idle';
    this.power = 0;
    this.t = 0;
    this.breakStreak();
    this.lastZone = null;
    this.chargeAlpha = 0;
    this.minKnot = nextKnotIndex(state.height);
    this.targetKnot = this.minKnot;
  },

  update(dt) {
    if (!this.lastZone) this.lastZone = zoneAt(state.height);
    if (this.phase === 'charging') {
      this.power = Math.min(1, this.power + CHARGE_SPEED * dt);
      if (state.mode === 'carrera') this.retarget();
    } else if (this.phase === 'leaping') {
      this.t += dt / LEAP_TIME;
      if (this.t >= 1) this.arrive();
    } else if (this.phase === 'slipping') {
      this.t += dt / (this.slipDur || SLIP_TIME);
      if (this.t >= 1) {
        state.height = this.slipTo;
        // si el resbalón te bajó de zona, el cartel vuelve a salir al re-entrar
        this.lastZone = zoneAt(state.height);
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
