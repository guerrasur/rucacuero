// Logros permanentes: hitos de toda la vida, aparte de las misiones rotativas.
// Se cumplen una sola vez y la recompensa siempre SUMA hormigas (jamás quita).
// Métricas: contadores acumulativos en state.life + derivadas (récord, misiones).
import { state, save } from './state.js';

export const LOGROS = [
  { id: 'metros100',    metric: 'metros',    at: 100,  name: 'Primeros cien',           desc: 'Ganá 100 m trepando en total.',              reward: 150 },
  { id: 'metros1000',   metric: 'metros',    at: 1000, name: 'Un kilómetro de corteza', desc: 'Ganá 1.000 m trepando en total.',            reward: 1200 },
  { id: 'metros5000',   metric: 'metros',    at: 5000, name: 'Andinista de rama',       desc: 'Ganá 5.000 m trepando en total.',            reward: 8000 },
  { id: 'perfectos25',  metric: 'perfectos', at: 25,   name: 'Mano firme',              desc: 'Hacé 25 saltos perfectos.',                  reward: 400 },
  { id: 'perfectos150', metric: 'perfectos', at: 150,  name: 'Pulso de relojero',       desc: 'Hacé 150 saltos perfectos.',                 reward: 3000 },
  { id: 'chucaos10',    metric: 'chucaos',   at: 10,   name: 'Amigo del chucao',        desc: 'Espantá al chucao 10 veces.',                reward: 600 },
  { id: 'enjambres5',   metric: 'enjambres', at: 5,    name: 'Farolero',                desc: 'Tocá 5 enjambres de luciérnagas.',           reward: 500 },
  { id: 'lluvias5',     metric: 'lluvias',   at: 5,    name: 'Curtido de agua',         desc: 'Aguantá 5 lluvias enteras.',                 reward: 500 },
  { id: 'gastadas5000', metric: 'gastadas',  at: 5000, name: 'Economía de guerra',      desc: 'Gastá 5.000 hormigas en mejoras.',           reward: 1000 },
  { id: 'record180',    metric: 'best',      at: 180,  name: 'Cielo de hojas',          desc: 'Llegá a 180 m de altura.',                   reward: 800 },
  { id: 'record260',    metric: 'best',      at: 260,  name: 'Sobre el monte',          desc: 'Llegá a 260 m de altura.',                   reward: 2500 },
  { id: 'misiones25',   metric: 'quests',    at: 25,   name: 'Mandadero incansable',    desc: 'Completá 25 misiones.',                      reward: 1500 },
];

const queue = [];

function metricValue(metric) {
  if (metric === 'best') return state.bestHeight;
  if (metric === 'quests') return state.questsDone;
  return state.life[metric] || 0;
}

function check(metric) {
  let hubo = false;
  for (const def of LOGROS) {
    if (def.metric !== metric) continue;
    if (state.logros.includes(def.id)) continue;
    if (metricValue(metric) < def.at) continue;
    state.logros.push(def.id);
    state.ants += def.reward; // solo suma: regla inviolable
    queue.push({ type: 'logro', def });
    hubo = true;
  }
  if (hubo) save();
}

// Único punto de entrada para las métricas acumulativas.
export function bump(metric, amount = 1) {
  if (metric in state.life) state.life[metric] += amount;
  check(metric);
}

// Las derivadas (récord, misiones) no se acumulan acá: se chequean a demanda.
export function checkDerived() {
  check('best');
  check('quests');
}

export function progressFor(def) {
  return Math.min(def.at, Math.floor(metricValue(def.metric)));
}

export function doneCount() {
  return state.logros.length;
}

export function takeEvents() {
  return queue.splice(0);
}
