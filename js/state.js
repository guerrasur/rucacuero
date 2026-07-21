// Persistencia en localStorage. Una sola clave, JSON versionado.
// No se simula tiempo offline: se guarda el valor exacto y se continúa desde ahí.

const KEY = 'rucacuero_save_v1';

export const state = {
  v: 1,
  // modo activo: 'carrera' (principal, contrarreloj) o 'zen' (escalada libre)
  mode: 'carrera',
  ants: 0, // hormigas negras: moneda del modo zen
  sap: 0,
  // altura y récord DEL MODO ACTIVO (climb/scene/HUD trabajan siempre acá)
  height: 0,
  bestHeight: 0,
  // hogar persistente del progreso zen mientras jugás carrera
  zen: { height: 0, best: 0 },
  // modo carrera: hormigas coloradas, récord y mejoras propias.
  // La altura de una run arranca en `checkpoint`: 0 hasta atravesar la primera
  // nube-barrera (frontera de zona, ver NUBES en climb.js), después el piso de
  // la última nube cruzada — para siempre, entre runs y entre sesiones. El
  // "rebirth" (carrera.volverAZona0) lo devuelve a 0.
  carrera: { ants: 0, best: 0, checkpoint: 0, upgrades: { resorte: 0, reloj: 0, eco: 0, botin: 0 } },
  upgrades: { feromonas: 0, reina: 0, nudos: 0, mielada: 0, ofrenda: 0 },
  unlocks: [],
  quest: null, // misión activa: { id, target, progress }
  questsDone: 0,
  // contadores de toda la vida (solo suben): alimentan los logros permanentes
  life: { metros: 0, perfectos: 0, chucaos: 0, lluvias: 0, gastadas: 0, enjambres: 0, nubes: 0 },
  logros: [], // ids de logros ya cumplidos
  cuento: 0, // pasos completados de "El cuento del monte" (misiones con historia)
  // opciones de accesibilidad: null = seguir la preferencia del sistema
  opts: { menosMov: null },
  // ropero: cosméticos comprados y qué lleva puesto (null = default)
  cosmetics: { owned: [], sombrero: null, chiripa: null, piel: 'ocre' },
};

// Reducción de movimiento: vive acá (y no en ui) porque scene también la
// necesita y ui ya importa a scene — ponerla en ui armaría un ciclo.
const mediaCalma = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
export function menosMovimiento() {
  return state.opts.menosMov ?? (mediaCalma ? mediaCalma.matches : false);
}

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function load() {
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return;
  }
  if (!raw) return;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return;
  }
  if (!data || data.v !== 1) return;
  state.mode = data.mode === 'zen' ? 'zen' : 'carrera';
  state.ants = num(data.ants);
  state.sap = num(data.sap);
  // migración: un save previo a los modos guardaba height/bestHeight sueltos —
  // ese progreso es del zen (el juego de siempre), no se pierde nada
  const zen = data.zen || {};
  state.zen.height = num(zen.height ?? data.height);
  state.zen.best = Math.max(num(zen.best ?? data.bestHeight), state.zen.height);
  const ca = data.carrera || {};
  state.carrera.ants = num(ca.ants);
  state.carrera.best = num(ca.best);
  state.carrera.checkpoint = num(ca.checkpoint);
  const cup = ca.upgrades || {};
  for (const k of Object.keys(state.carrera.upgrades)) {
    state.carrera.upgrades[k] = Math.floor(num(cup[k]));
  }
  // la altura activa según el modo: la run de carrera arranca en su checkpoint
  if (state.mode === 'zen') {
    state.height = state.zen.height;
    state.bestHeight = state.zen.best;
  } else {
    state.height = state.carrera.checkpoint;
    state.bestHeight = state.carrera.best;
  }
  const up = data.upgrades || {};
  for (const k of Object.keys(state.upgrades)) {
    state.upgrades[k] = Math.floor(num(up[k]));
  }
  state.unlocks = Array.isArray(data.unlocks) ? data.unlocks.filter(u => typeof u === 'string') : [];
  state.quest =
    data.quest && typeof data.quest === 'object' && typeof data.quest.id === 'string'
      ? { id: data.quest.id, target: Math.max(1, Math.floor(num(data.quest.target))), progress: num(data.quest.progress) }
      : null;
  state.questsDone = Math.floor(num(data.questsDone));
  // campos agregados en iteraciones posteriores: un save viejo migra a defaults
  const lf = data.life || {};
  for (const k of Object.keys(state.life)) {
    state.life[k] = num(lf[k]);
  }
  state.logros = Array.isArray(data.logros) ? data.logros.filter(s => typeof s === 'string') : [];
  const cos = data.cosmetics || {};
  state.cosmetics.owned = Array.isArray(cos.owned) ? cos.owned.filter(s => typeof s === 'string') : [];
  state.cosmetics.sombrero = typeof cos.sombrero === 'string' ? cos.sombrero : null;
  state.cosmetics.chiripa = typeof cos.chiripa === 'string' ? cos.chiripa : null;
  state.cosmetics.piel = typeof cos.piel === 'string' ? cos.piel : 'ocre';
  state.cuento = Math.floor(num(data.cuento));
  const op = data.opts || {};
  state.opts.menosMov = typeof op.menosMov === 'boolean' ? op.menosMov : null;
}

export function save() {
  // height/bestHeight son del modo activo: volcarlos a su hogar persistente
  if (state.mode === 'zen') {
    state.zen.height = state.height;
    state.zen.best = state.bestHeight;
  } else {
    state.carrera.best = Math.max(state.carrera.best, state.bestHeight);
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* almacenamiento lleno o bloqueado: el juego sigue sin persistir */
  }
}

export function initAutosave() {
  setInterval(save, 5000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
  });
  window.addEventListener('pagehide', save);
}
