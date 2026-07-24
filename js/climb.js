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
const PERFECT_WIND = 0.08; // metros: la micro-zona perfecta se angosta más todavía con ráfaga
const WIND_TRANS = 0.28; // segundos: transición suave del ancho de zona al cambiar el viento
const LOSS_SHORT = 1.2;
const LOSS_OVER = 3.0;
const LOSS_LUCK = 2.2;
const LEAP_TIME = 0.5;
const SLIP_TIME = 0.7;
// Racha de perfectos (ambos modos): cada perfecto encadenado multiplica los
// metros ganados, exponencial y sin tope. Cualquier soltada no perfecta la corta.
const STREAK_BASE = 1.25;
const RUN_STREAK_ECO = 0.03; // carrera: extra por nivel de "eco del perfecto"
const RUN_RESORTE = 0.08; // carrera: +salto base por nivel de "piernas de resorte"
// carrera "Racha Divina": al fallar, en vez de reset total, se conserva esta
// fracción de la racha de perfectos (por nivel; nv0 = reset total de siempre).
const RACHA_DIVINA_KEEP = [0, 0.3, 0.5, 0.7, 0.8];
const RUN_ZANCADA = 0.6; // carrera "Zancada de Roble": +metros de piso por nivel en un agarre común
const RUN_VENTIL = 0.05; // carrera "Ventil Forte": ensancha la zona dulce en ráfaga por nivel (nunca más que la base)
// El próximo salto nunca exige menos del 50% de la carga: un nudo más cerca
// que esto se saltea (nada de perder la racha por un tronco mal posicionado).
const MIN_TARGET_GAP = MAX_JUMP * 0.5;
// Ni tan lejos que a carga máxima no quede aire para pasarse: si la zona dulce
// del próximo nudo llegara al tope del salto, mantener presionado sin soltar lo
// resolvería SIEMPRE como perfecto (no hay borde para excederse). Dejamos al
// menos un semiancho de zona dulce de margen por encima del agarre — así el
// nudo nunca queda pegado al límite alcanzable de la pantalla.
const MAX_KNOT_GAP = MAX_JUMP - 2 * SWEET_BASE; // 4.9 m
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
    // el hueco entre nudos se topea para que siempre haya margen a los dos lados
    // de la zona de agarre (ver MAX_KNOT_GAP): nunca un nudo pegado al borde
    const gap = Math.min(MAX_KNOT_GAP, (2.2 + hash(k) * 2.3) * z.gapMul);
    knots.push(knots[k - 1] + gap);
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
  jumpStart: 0,
  leapDur: LEAP_TIME,
  leapTo: 0,
  slipFrom: 0,
  slipTo: 0,
  bonusLeap: false, // true mientras anima el envión de Primosalto (sin arrive())
  result: null, // 'grab' | 'short' | 'over'
  chainSafe: false,
  perfectStreak: 0,
  streakMult: 1,
  jumpsSinceResin: RESIN_EVERY,
  chargeAlpha: 0, // para desvanecer overlays de carga en el render
  // anchos "mostrados" de las zonas: siguen a sweetW()/perfectW() con un
  // lerp corto en vez de saltar de golpe cuando cambia el viento
  sweetWShown: SWEET_BASE,
  perfectWShown: PERFECT_W,
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

  // Los metros GANADOS al agarrar se multiplican por la racha de perfectos,
  // exponencial y SIN tope (1.25^racha); en carrera además suman las mejoras
  // "resorte" (salto base) y "eco" (base de la racha). La puntería queda
  // siempre a escala base (el árbol no se mueve al apuntar): el salto
  // simplemente te eleva más, pasando ramas enteras si la racha da.
  streakBase() {
    return STREAK_BASE + (state.mode === 'carrera' ? RUN_STREAK_ECO * state.carrera.upgrades.eco : 0);
  },
  gainMul() {
    const base = state.mode === 'carrera' ? 1 + RUN_RESORTE * state.carrera.upgrades.resorte : 1;
    return base * Math.pow(this.streakBase(), this.perfectStreak);
  },
  sweetW() {
    // "abrigo de brisa": la ráfaga angosta menos la zona dulce
    let windW = state.unlocks.includes('brisa') ? 0.38 : SWEET_WIND;
    // carrera "Ventil Forte": reduce la reducción del viento, sin pasar la base
    if (state.mode === 'carrera') {
      windW = Math.min(SWEET_BASE, windW + RUN_VENTIL * state.carrera.upgrades.ventil);
    }
    return (wind.windy() ? windW : SWEET_BASE) * zoneAt(state.height).sweetMul * this.mods.sweetMul();
  },
  // la micro-zona perfecta se angosta todavía más con ráfaga (el "abrigo de
  // brisa" solo protege la zona dulce general, no la de precisión)
  perfectW() {
    return wind.windy() ? PERFECT_WIND : PERFECT_W;
  },
  landingH() {
    return state.height + this.power * MAX_JUMP;
  },

  press() {
    if (this.phase !== 'idle') return;
    this.phase = 'charging';
    this.power = 0;
    // si el próximo nudo quedó pegado (p. ej. tras un resbalón) no hay tiempo
    // de reaccionar: se apunta directo al siguiente, siempre que sea alcanzable
    let t = nextKnotIndex(state.height);
    if (
      knotHeight(t) - state.height < MIN_TARGET_GAP &&
      knotHeight(t + 1) - state.height <= MAX_JUMP + 0.1
    ) {
      t += 1;
    }
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
        // el badge ×mult muestra el multiplicador de la racha
        this.streakMult = Math.pow(this.streakBase(), this.perfectStreak);
        this.emit('perfect-release');
      } else {
        this.breakStreak();
      }
      // Los metros ganados se multiplican — el salto te eleva de largo
      // pasando ramas enteras. El aterrizaje se ancla SIEMPRE al nudo más
      // cercano: caer flotando entre ramas dejaba al próximo nudo a
      // centímetros y regalaba rachas perdidas (el salteo no alcanzaba).
      const raw = this.jumpStart + (kH - this.jumpStart) * this.gainMul();
      const above = knotIndexAbove(raw);
      const belowH = knotHeight(above - 1);
      this.leapTo = knotHeight(above) - raw < raw - belowH ? knotHeight(above) : belowH;
    }
    // los vuelos gigantes de la racha se toman un poco más de tiempo en el aire
    this.leapDur = LEAP_TIME * (1 + Math.min(2, Math.abs(this.leapTo - this.jumpStart) / 25));
    this.phase = 'leaping';
  },

  // Corta la racha de perfectos. Con "Racha Divina" (carrera) un fallo de
  // habilidad/mala suerte solo la RECORTA (conserva una fracción); `hard` fuerza
  // el reset total (cambio de modo, fin de carrera, arranque de una run nueva).
  breakStreak(hard = false) {
    const keep =
      !hard && state.mode === 'carrera' ? RACHA_DIVINA_KEEP[state.carrera.upgrades.rachadivina] || 0 : 0;
    this.perfectStreak = keep > 0 ? Math.floor(this.perfectStreak * keep) : 0;
    this.streakMult = Math.pow(this.streakBase(), this.perfectStreak);
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
    // "Zancada de Roble" (carrera): un agarre común (no perfecto ni encadenado)
    // suma un piso extra de metros sobre el nudo — hasta un salto mediocre rinde.
    const zancada =
      !this.perfect && !this.chainSafe && state.mode === 'carrera'
        ? RUN_ZANCADA * state.carrera.upgrades.zancada
        : 0;
    const gained = this.leapTo + zancada - state.height;
    state.height = this.leapTo + zancada;
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
      this.leapDur = LEAP_TIME; // el encadenado es nudo a nudo, vuelo corto
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

  // Envión gratis de "Primosalto": anima el vuelo con la misma interpolación
  // de un salto normal, pero sin pasar por arrive() (no hay tirada de mala
  // suerte, racha ni eventos — es un regalo, no una jugada).
  startBonusLeap(from, to) {
    this.jumpStart = from;
    this.leapTo = to;
    this.t = 0;
    this.leapDur = LEAP_TIME * (1 + Math.min(2, Math.abs(to - from) / 25));
    this.phase = 'leaping';
    this.bonusLeap = true;
  },

  // al cambiar de modo la máquina vuelve a cero (sin racha heredada)
  resetForMode() {
    this.phase = 'idle';
    this.power = 0;
    this.t = 0;
    this.chainSafe = false;
    // si esto se llama a mitad del envión de Primosalto (cambio de modo,
    // rebirth) la bandera quedaba pegada: el siguiente salto normal saltaba
    // arrive() entero (sin tirada de mala suerte/zancada) y aterrizaba de
    // golpe unos metros más arriba de lo que tocaba.
    this.bonusLeap = false;
    this.breakStreak(true);
    this.lastZone = null;
    this.chargeAlpha = 0;
    this.sweetWShown = this.sweetW();
    this.perfectWShown = this.perfectW();
    this.targetKnot = nextKnotIndex(state.height);
  },

  update(dt) {
    if (!this.lastZone) this.lastZone = zoneAt(state.height);
    if (this.phase === 'charging') {
      this.power = Math.min(1, this.power + CHARGE_SPEED * dt);
    } else if (this.phase === 'leaping') {
      this.t += dt / (this.leapDur || LEAP_TIME);
      if (this.t >= 1) {
        if (this.bonusLeap) {
          this.bonusLeap = false;
          state.height = this.leapTo;
          if (state.height > state.bestHeight) state.bestHeight = state.height;
          this.lastZone = zoneAt(state.height);
          this.targetKnot = nextKnotIndex(state.height);
          this.phase = 'idle';
        } else {
          this.arrive();
        }
      }
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
    // los anchos de zona interpolan suave hacia su valor real (no saltan de
    // golpe cuando entra o sale la ráfaga)
    const wLerp = Math.min(1, dt / WIND_TRANS);
    this.sweetWShown += (this.sweetW() - this.sweetWShown) * wLerp;
    this.perfectWShown += (this.perfectW() - this.perfectWShown) * wLerp;
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
