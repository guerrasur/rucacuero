// Persistencia en localStorage. Una sola clave, JSON versionado.
// No se simula tiempo offline: se guarda el valor exacto y se continúa desde ahí.

const KEY = 'rucacuero_save_v1';

export const state = {
  v: 1,
  ants: 0,
  sap: 0,
  height: 0,
  bestHeight: 0,
  upgrades: { feromonas: 0, reina: 0, nudos: 0, mielada: 0, ofrenda: 0 },
  unlocks: [],
  quest: null, // misión activa: { id, target, progress }
  questsDone: 0,
  // contadores de toda la vida (solo suben): alimentan los logros permanentes
  life: { metros: 0, perfectos: 0, chucaos: 0, lluvias: 0, gastadas: 0, enjambres: 0 },
  logros: [], // ids de logros ya cumplidos
  // ropero: cosméticos comprados y qué lleva puesto (null = default)
  cosmetics: { owned: [], sombrero: null, chiripa: null, piel: 'ocre' },
};

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
  state.ants = num(data.ants);
  state.sap = num(data.sap);
  state.height = num(data.height);
  state.bestHeight = Math.max(num(data.bestHeight), state.height);
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
}

export function save() {
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
