// Capa económica: hormigas (gastables), savia (permanente) y sus definiciones.
import { state, save } from './state.js';

export const UPGRADES = [
  {
    id: 'feromonas',
    name: 'Senderos de feromonas',
    desc: 'Las obreras encuentran el camino más rápido. +0,35 hormigas/s por nivel.',
    baseCost: 15,
    growth: 1.6,
    max: 25,
  },
  {
    id: 'reina',
    name: 'Nueva reina',
    desc: 'Otra colonia se suma a la rama. ×1,5 a toda la generación por nivel.',
    baseCost: 200,
    growth: 2.2,
    max: 8,
  },
  {
    id: 'nudos',
    name: 'Nudos reforzados',
    desc: 'Resina y seda en cada agarre: menos resbalones por mala suerte.',
    baseCost: 25,
    growth: 1.75,
    max: 12,
  },
  {
    id: 'mielada',
    name: 'Cosecha de mielada',
    desc: 'Pulgones aliados en las hojas altas. +2,5 hormigas/s por nivel.',
    baseCost: 400,
    growth: 1.9,
    max: 15,
    requiresUnlock: 'mielada',
  },
  {
    id: 'ofrenda',
    name: 'Ofrenda de mielada',
    desc: 'Un tributo al monte que siempre acepta más. +5% de hormigas por nivel, sin tope.',
    baseCost: 20000,
    growth: 3,
    max: Infinity,
    requiresAllMaxed: true, // recién aparece con todo lo demás al máximo
  },
];

export const SAP_UNLOCKS = [
  {
    id: 'resina',
    at: 50,
    name: 'Agarre de resina',
    desc: 'Cada tantos saltos, la savia te salva sola de un resbalón de mala suerte.',
  },
  {
    id: 'mielada',
    at: 150,
    name: 'Cosecha de mielada',
    desc: 'Nueva mejora de hormigas disponible en el hormiguero.',
  },
  {
    id: 'viento',
    at: 400,
    name: 'Lectura del viento',
    desc: 'Sentís la ráfaga antes de que llegue: aviso en el borde de la pantalla.',
  },
  {
    id: 'saltolargo',
    at: 900,
    name: 'Salto largo',
    desc: 'Una soltada perfecta encadena dos nudos de un tirón.',
  },
  {
    id: 'brisa',
    at: 2000,
    name: 'Abrigo de brisa',
    desc: 'Conocés cada remolino: la ráfaga te angosta menos la zona dulce.',
  },
];

export const SAP_RATE = 0.2; // savia por segundo, constante, solo con el juego abierto

export function antRate() {
  const u = state.upgrades;
  return (0.5 + 0.35 * u.feromonas + 2.5 * u.mielada) * Math.pow(1.5, u.reina) * (1 + 0.05 * u.ofrenda);
}

// Probabilidad de resbalón por mala suerte tras un agarre limpio.
export function slipChance(windy) {
  const base = Math.max(0.01, 0.08 * Math.pow(0.82, state.upgrades.nudos));
  return windy ? Math.min(0.5, base + 0.03) : base;
}

export function upgradeCost(def) {
  return Math.ceil(def.baseCost * Math.pow(def.growth, state.upgrades[def.id]));
}

export function upgradeAvailable(def) {
  if (def.requiresUnlock && !state.unlocks.includes(def.requiresUnlock)) return false;
  if (def.requiresAllMaxed) {
    return UPGRADES.every(d => d === def || !Number.isFinite(d.max) || state.upgrades[d.id] >= d.max);
  }
  return true;
}

export function canBuy(def) {
  return (
    upgradeAvailable(def) &&
    state.upgrades[def.id] < def.max &&
    Math.floor(state.ants) >= upgradeCost(def)
  );
}

export function buy(def) {
  if (!canBuy(def)) return false;
  state.ants -= upgradeCost(def);
  state.upgrades[def.id] += 1;
  save();
  return true;
}

export function nextLockedUnlock() {
  return SAP_UNLOCKS.find(u => !state.unlocks.includes(u.id)) || null;
}

// Avanza la economía un frame. Devuelve los desbloqueos de savia recién alcanzados.
// sapMul: multiplicador de eventos (lluvia); la savia solo sube, nunca baja.
// genAnts: las hormigas negras solo se generan en modo zen; la savia es
// pasiva y constante en los dos modos (regla inviolable: nunca baja).
const SIN_UNLOCKS = []; // array compartido: el caso normal (nada nuevo) no aloca
export function tick(dt, sapMul = 1, genAnts = true) {
  if (genAnts) state.ants += antRate() * dt;
  state.sap += SAP_RATE * dt * sapMul;
  let fresh = null;
  for (const u of SAP_UNLOCKS) {
    if (state.sap >= u.at && !state.unlocks.includes(u.id)) {
      state.unlocks.push(u.id);
      (fresh || (fresh = [])).push(u);
    }
  }
  if (fresh) {
    save();
    return fresh;
  }
  return SIN_UNLOCKS;
}
