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

let antRateFn = () => 0.5;
const queue = [];

function tierFor(def) {
  const tier = Math.floor(state.questsDone / POOL.length);
  return def.targets[Math.min(def.targets.length - 1, tier)];
}

function pick(excludeId) {
  const opts = POOL.filter(d => d.id !== excludeId);
  const def = opts[Math.floor(Math.random() * opts.length)];
  return { id: def.id, target: tierFor(def), progress: 0 };
}

export function init(rateFn) {
  antRateFn = rateFn;
  if (!state.quest || !POOL.some(d => d.id === state.quest.id)) {
    state.quest = pick(null);
  }
}

export function text() {
  const def = POOL.find(d => d.id === state.quest.id);
  return def.text(state.quest.target);
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
  if (kind === 'slip') {
    if (q.id === 'streak' && q.progress > 0) q.progress = 0;
    return;
  }
  let inc = 0;
  switch (q.id) {
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
    const reward = Math.max(15, Math.round(antRateFn() * 25 + 10 + state.questsDone * 5));
    state.ants += reward;
    state.questsDone += 1;
    const doneText = text();
    state.quest = pick(q.id);
    queue.push({ type: 'quest-done', text: doneText, reward });
    save();
  }
}
