// El Ropero: pieles y cosméticos del escalador.
// Las pieles son gratis y están siempre; los cosméticos se compran una sola
// vez con hormigas y quedan para siempre (solo las compras propias gastan).
import { state, save } from './state.js';

export const SKINS = [
  { id: 'arena', name: 'Arena', hex: '#E3BE94' },
  { id: 'trigo', name: 'Trigo', hex: '#D6A26E' },
  { id: 'ocre', name: 'Ocre', hex: '#C9825A' },
  { id: 'canela', name: 'Canela', hex: '#A05F3D' },
  { id: 'algarrobo', name: 'Algarrobo', hex: '#6F4A32' },
  { id: 'violeta', name: 'Violeta', hex: '#7E6390' },
  { id: 'celeste', name: 'Celeste', hex: '#6E93A6' },
  { id: 'verde', name: 'Verde', hex: '#6F8A5E' },
  { id: 'rojo', name: 'Rojo', hex: '#A6524A' },
  { id: 'amarillo', name: 'Amarillo', hex: '#C9A94E' },
  { id: 'gris', name: 'Gris', hex: '#8A8578' },
];

// slots: 'sombrero' (sobre la cabeza; biuti en cambio reemplaza la cara) y
// 'chiripa' (la prenda de cadera; null = el taparrabos hueso de siempre)
export const COSMETICS = [
  { id: 'cassco', name: 'Cassco', slot: 'sombrero', cost: 400, desc: 'Casco de bici verde lima con ventilaciones. Seguridad ante todo.' },
  { id: 'creci', name: 'Creci', slot: 'chiripa', cost: 600, desc: 'Calzones rosas con vivos. Comodidad de otra época.' },
  { id: 'pretencio', name: 'Pretencio', slot: 'sombrero', cost: 900, desc: 'Boina negra. Ahora opinás de cine.' },
  { id: 'velece', name: 'Velece', slot: 'sombrero', cost: 2000, desc: 'Un cono de obra naranja con bandas. Nadie sabe de qué obra.' },
  { id: 'biuti', name: 'Biuti', slot: 'sombrero', cost: 5000, desc: 'Una cara nueva, bellísima. Mira para el otro lado, pero bellísima.' },
];

export function skinHex(id) {
  const s = SKINS.find(s => s.id === id);
  return s ? s.hex : '#C9825A';
}

export function owned(id) {
  return state.cosmetics.owned.includes(id);
}

export function canBuyCosmetic(def) {
  return !owned(def.id) && Math.floor(state.ants) >= def.cost;
}

export function buyCosmetic(def) {
  if (!canBuyCosmetic(def)) return false;
  state.ants -= def.cost;
  state.cosmetics.owned.push(def.id);
  state.cosmetics[def.slot] = def.id; // recién comprado, puesto
  save();
  return true;
}

export function setEquipped(slot, id) {
  if (id !== null && !owned(id)) return;
  state.cosmetics[slot] = id;
  save();
}

// valida el save contra los ids conocidos (main la llama tras load())
export function sanitize() {
  const c = state.cosmetics;
  c.owned = c.owned.filter(id => COSMETICS.some(d => d.id === id));
  if (!SKINS.some(s => s.id === c.piel)) c.piel = 'ocre';
  for (const slot of ['sombrero', 'chiripa']) {
    const id = c[slot];
    if (id !== null && !COSMETICS.some(d => d.id === id && d.slot === slot && c.owned.includes(id))) {
      c[slot] = null;
    }
  }
}
