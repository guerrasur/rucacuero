// Misiones cortas rotativas: una activa a la vez, dirige la sesión.
// Recompensa siempre en hormigas (nunca tocan altura ni savia).
// Los objetivos escalan a medida que se completan vueltas del pool.
import { state, save } from './state.js';

const POOL = [
  { id: 'streak', targets: [3, 4, 5, 6], text: t => `Encadená ${t} agarres limpios seguidos` },
  { id: 'perfect', targets: [1, 2, 3], text: t => (t === 1 ? 'Hacé un salto perfecto' : `Hacé ${t} saltos perfectos`) },
  { id: 'meters', targets: [12, 18, 25, 35], text: t => `Ganá ${t} m trepando` },
  { id: 'buy', targets: [1, 2, 3], text: t => (t === 1 ? 'Comprá una mejora del hormiguero' : `Comprá ${t} mejoras del hormiguero`) },
  { id: 'gust', targets: [1, 2, 3], text: t => (t === 1 ? 'Lográ un agarre limpio durante una ráfaga' : `${t} agarres limpios durante ráfagas`) },
  { id: 'bird', targets: [1], text: () => 'Espantá al chucao tocándolo' },
];

// "El cuento del monte": misiones encadenadas con una historia corta.
// Cada 3 misiones comunes aparece el siguiente paso del cuento (una sola
// vuelta, persiste en state.cuento). kind reusa los del note(); el relato
// se muestra al cumplirla. Pagan el doble que una misión común.
export const CUENTO = [
  { id: 'cuento1', kind: 'meters', target: 15, text: 'El cuento del monte I: subí 15 m buscando a la luciérnaga vieja',
    relato: 'La luciérnaga vieja te vio pasar y guiñó: «la rama guarda un secreto arriba».' },
  { id: 'cuento2', kind: 'perfect', target: 2, text: 'El cuento del monte II: mostrale 2 saltos perfectos a la luciérnaga',
    relato: '«Tenés manos de hormiga», dijo. «Ahora escuchá al chucao: él conoce el camino».' },
  { id: 'cuento3', kind: 'bird', target: 1, text: 'El cuento del monte III: encontrá al chucao y espantalo con cariño',
    relato: 'El chucao soltó una pluma y un rumbo: «donde el viento aprieta, la savia abunda».' },
  { id: 'cuento4', kind: 'gust', target: 2, text: 'El cuento del monte IV: lográ 2 agarres limpios en plena ráfaga',
    relato: 'El viento te tomó la medida y te dejó pasar. Arriba algo brillaba entre las hojas.' },
  { id: 'cuento5', kind: 'streak', target: 5, text: 'El cuento del monte V: encadená 5 agarres limpios hasta el brillo',
    relato: 'Era savia vieja, dura como ámbar. El monte te la regala: el cuento termina donde empieza la rama de cada noche.' },
];

function cuentoPendiente() {
  return state.cuento < CUENTO.length ? CUENTO[state.cuento] : null;
}

let antRateFn = () => 0.5;
const queue = [];

function tierFor(def) {
  const tier = Math.floor(state.questsDone / POOL.length);
  return def.targets[Math.min(def.targets.length - 1, tier)];
}

function pick(excludeId) {
  // cada 3 misiones comunes se intercala el próximo paso del cuento
  const paso = cuentoPendiente();
  if (paso && state.questsDone > 0 && state.questsDone % 3 === 0 && excludeId !== paso.id) {
    return { id: paso.id, target: paso.target, progress: 0 };
  }
  const opts = POOL.filter(d => d.id !== excludeId);
  const def = opts[Math.floor(Math.random() * opts.length)];
  return { id: def.id, target: tierFor(def), progress: 0 };
}

export function init(rateFn) {
  antRateFn = rateFn;
  const valida = state.quest && (POOL.some(d => d.id === state.quest.id) || CUENTO.some(d => d.id === state.quest.id));
  if (!valida) state.quest = pick(null);
  // un save con un paso del cuento ya cumplido no debe reactivarlo
  if (state.quest && state.quest.id.startsWith('cuento')) {
    const paso = cuentoPendiente();
    if (!paso || paso.id !== state.quest.id) state.quest = pick(null);
  }
}

export function text() {
  const def = POOL.find(d => d.id === state.quest.id) || CUENTO.find(d => d.id === state.quest.id);
  return def.text instanceof Function ? def.text(state.quest.target) : def.text;
}

export function progressText() {
  const q = state.quest;
  return `${Math.min(q.target, Math.floor(q.progress))}/${q.target}`;
}

export function takeEvents() {
  const q = queue.splice(0);
  return q;
}

// kind: 'grab' (agarre limpio, ctx.windy) | 'perfect' | 'meters' (amount) |
//       'buy' | 'bird' | 'slip' (corta rachas)
export function note(kind, amount = 1, ctx = {}) {
  const q = state.quest;
  if (!q) return;
  // los pasos del cuento reusan las mecánicas del pool: se resuelve su "tipo"
  const paso = CUENTO.find(d => d.id === q.id);
  const tipo = paso ? paso.kind : q.id;
  if (kind === 'slip') {
    if (tipo === 'streak' && q.progress > 0) q.progress = 0;
    return;
  }
  let inc = 0;
  switch (tipo) {
    case 'streak':
      if (kind === 'grab') inc = 1;
      break;
    case 'perfect':
      if (kind === 'perfect') inc = 1;
      break;
    case 'meters':
      if (kind === 'meters') inc = amount;
      break;
    case 'buy':
      if (kind === 'buy') inc = 1;
      break;
    case 'gust':
      if (kind === 'grab' && ctx.windy) inc = 1;
      break;
    case 'bird':
      if (kind === 'bird') inc = 1;
      break;
  }
  if (!inc) return;
  q.progress += inc;
  if (q.progress >= q.target) {
    // los pasos del cuento pagan el doble que una misión común
    const base = Math.max(15, Math.round(antRateFn() * 25 + 10 + state.questsDone * 5));
    const reward = paso ? base * 2 : base;
    state.ants += reward;
    state.questsDone += 1;
    if (paso) state.cuento += 1;
    const doneText = text();
    state.quest = pick(q.id);
    queue.push({ type: 'quest-done', text: doneText, reward, relato: paso ? paso.relato : null });
    save();
  }
}
