// HUD, tienda (hormiguero), toasts de savia y feedback flotante.
import { state } from './state.js';
import {
  UPGRADES,
  SAP_UNLOCKS,
  upgradeCost,
  upgradeAvailable,
  canBuy,
  buy,
  nextLockedUnlock,
} from './economy.js';
import { climb } from './climb.js';

const $ = id => document.getElementById(id);
const ANT_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><ellipse cx="12" cy="17" rx="3.2" ry="2.5" fill="currentColor"/><circle cx="12" cy="11.8" r="1.9" fill="currentColor"/><circle cx="12" cy="7.6" r="2.5" fill="currentColor"/><path d="M10.7 5.9 9.2 3.8M13.3 5.9 14.8 3.8M9.9 12l-3-1M14.1 12l3-1M9.7 16l-2.9 1.5M14.3 16l2.9 1.5M10.2 18.8 8.4 21.2M13.8 18.8 15.6 21.2"/></g></svg>';

let els = {};
let shopOpen = false;
let lastShopRefresh = 0;

const fmtInt = n => Math.floor(n).toLocaleString('es-AR');
const fmtH = h =>
  h.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function init() {
  els = {
    height: $('height'),
    record: $('record'),
    ants: $('ants-n'),
    sap: $('sap-n'),
    sapBar: document.querySelector('#sap-bar i'),
    hint: $('hint'),
    feedback: $('feedback'),
    shop: $('shop'),
    scrim: $('scrim'),
    shopBtn: $('shop-btn'),
    upgradeList: $('upgrade-list'),
    unlockList: $('unlock-list'),
    toasts: $('toasts'),
  };

  els.shopBtn.addEventListener('click', () => toggleShop(!shopOpen));
  els.scrim.addEventListener('click', () => toggleShop(false));
  buildShop();
}

function toggleShop(open) {
  shopOpen = open;
  els.shop.hidden = false;
  els.scrim.hidden = false;
  requestAnimationFrame(() => {
    els.shop.classList.toggle('open', open);
    els.scrim.classList.toggle('open', open);
  });
  if (!open) {
    setTimeout(() => {
      if (!shopOpen) {
        els.shop.hidden = true;
        els.scrim.hidden = true;
      }
    }, 320);
  }
}

function buildShop() {
  els.upgradeList.innerHTML = '';
  for (const def of UPGRADES) {
    if (!upgradeAvailable(def)) continue;
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = def.id;
    card.innerHTML =
      `<div class="card-info"><h3>${def.name}<span class="lvl"></span></h3><p>${def.desc}</p></div>` +
      `<button class="buy">${ANT_SVG}<span class="cost"></span></button>`;
    card.querySelector('.buy').addEventListener('click', () => {
      if (buy(def)) refreshShop(true);
    });
    els.upgradeList.appendChild(card);
  }

  els.unlockList.innerHTML = '';
  for (const u of SAP_UNLOCKS) {
    const row = document.createElement('div');
    row.className = 'unlock';
    row.dataset.id = u.id;
    row.innerHTML =
      `<div class="at">${u.at}</div>` +
      `<div><h3>${u.name}</h3><p>${u.desc}</p></div>` +
      `<div class="check"></div>`;
    els.unlockList.appendChild(row);
  }
  refreshShop(true);
}

function refreshShop(force) {
  const now = performance.now();
  if (!force && now - lastShopRefresh < 250) return;
  lastShopRefresh = now;

  // si "mielada" se desbloqueó después de construir la tienda, reconstruir
  const visible = els.upgradeList.children.length;
  const shouldBe = UPGRADES.filter(upgradeAvailable).length;
  if (visible !== shouldBe) {
    buildShop();
    return;
  }

  for (const card of els.upgradeList.children) {
    const def = UPGRADES.find(d => d.id === card.dataset.id);
    const lvl = state.upgrades[def.id];
    card.querySelector('.lvl').textContent = lvl > 0 ? `nv ${lvl}` : '';
    const btn = card.querySelector('.buy');
    const costEl = card.querySelector('.cost');
    if (lvl >= def.max) {
      costEl.textContent = 'MÁX';
      btn.disabled = true;
    } else {
      costEl.textContent = fmtInt(upgradeCost(def));
      btn.disabled = !canBuy(def);
    }
  }

  for (const row of els.unlockList.children) {
    const done = state.unlocks.includes(row.dataset.id);
    row.classList.toggle('locked', !done);
    row.querySelector('.check').textContent = done ? '✓' : '';
  }
}

export function hideHint() {
  els.hint.classList.add('hidden');
}

export function toast(unlockDef) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<b>Savia · ${unlockDef.name}</b><span>${unlockDef.desc}</span>`;
  els.toasts.appendChild(el);
  setTimeout(() => el.remove(), 3700);
  refreshShop(true);
}

const FEEDBACK = {
  perfect: { text: '¡Perfecto!', cls: 'good' },
  chain: { text: '¡Salto largo!', cls: 'good' },
  resin: { text: 'La resina te salvó', cls: 'good' },
  short: { text: 'Muy corto…', cls: 'shake' },
  over: { text: 'Te pasaste', cls: 'shake' },
  badluck: { text: '¡Resbalón!', cls: 'shake' },
};

export function onClimbEvent(ev) {
  let text, cls;
  if (ev.type === 'grab') {
    text = `+${fmtH(ev.gain)} m`;
    cls = 'good';
  } else if (FEEDBACK[ev.type]) {
    ({ text, cls } = FEEDBACK[ev.type]);
  } else return;
  const el = els.feedback;
  el.textContent = text;
  el.className = '';
  void el.offsetWidth; // reinicia la animación
  el.className = `show ${cls}`;
}

export function update() {
  const h = climb.visualHeight();
  els.height.innerHTML = `${fmtH(h)}<span class="unit">m</span>`;
  els.record.textContent = `récord ${fmtH(state.bestHeight)} m`;
  els.ants.textContent = fmtInt(state.ants);
  els.sap.textContent = fmtInt(state.sap);

  const next = nextLockedUnlock();
  els.sapBar.style.width = next ? `${Math.min(100, (state.sap / next.at) * 100)}%` : '100%';

  if (shopOpen) refreshShop(false);
}
