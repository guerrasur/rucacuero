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
import { climb, wind } from './climb.js';
import { SAP_RATE, antRate as antRateFn, slipChance } from './economy.js';
import * as audio from './audio.js';
import * as quests from './quests.js';
import * as logros from './logros.js';

const $ = id => document.getElementById(id);
const ANT_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><ellipse cx="12" cy="17" rx="3.2" ry="2.5" fill="currentColor"/><circle cx="12" cy="11.8" r="1.9" fill="currentColor"/><circle cx="12" cy="7.6" r="2.5" fill="currentColor"/><path d="M10.7 5.9 9.2 3.8M13.3 5.9 14.8 3.8M9.9 12l-3-1M14.1 12l3-1M9.7 16l-2.9 1.5M14.3 16l2.9 1.5M10.2 18.8 8.4 21.2M13.8 18.8 15.6 21.2"/></g></svg>';

let els = {};
let shopOpen = false;
let lastShopRefresh = 0;
const logroCache = {}; // último texto escrito por fila de logro (disciplina DOM)

const fmtInt = n => Math.floor(n).toLocaleString('es-AR');
const fmtH = h =>
  h.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function init() {
  els = {
    heightN: $('height-n'),
    mult: $('mult'),
    record: $('record'),
    questText: $('quest-text'),
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
    logrosList: $('logros-list'),
    logrosCount: $('logros-count'),
    toasts: $('toasts'),
    shopStats: $('shop-stats'),
    zoneBanner: $('zone-banner'),
    muteBtn: $('mute-btn'),
    iconSound: $('icon-sound'),
    iconMuted: $('icon-muted'),
  };

  // blur tras cada click: un botón enfocado se re-activa con Espacio (salto)
  els.shopBtn.addEventListener('click', () => {
    toggleShop(!shopOpen);
    els.shopBtn.blur();
  });
  els.scrim.addEventListener('click', () => toggleShop(false));
  els.muteBtn.addEventListener('click', () => {
    audio.ensure();
    audio.setMuted(!audio.isMuted());
    syncMuteIcon();
    els.muteBtn.blur();
  });
  syncMuteIcon();
  buildShop();
}

function syncMuteIcon() {
  const m = audio.isMuted();
  // los SVG no tienen la propiedad .hidden: se maneja el atributo
  els.iconSound.toggleAttribute('hidden', m);
  els.iconMuted.toggleAttribute('hidden', !m);
  els.muteBtn.setAttribute('aria-label', m ? 'Activar sonido' : 'Silenciar sonido');
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
      const costo = upgradeCost(def); // capturar antes: la compra sube el nivel
      if (buy(def)) {
        audio.ensure();
        audio.buy();
        quests.note('buy');
        logros.bump('gastadas', costo);
        refreshShop(true);
      }
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

  els.logrosList.innerHTML = '';
  for (const def of logros.LOGROS) {
    const row = document.createElement('div');
    row.className = 'unlock logro';
    row.dataset.id = def.id;
    row.innerHTML =
      `<div class="at prog"></div>` +
      `<div><h3>${def.name}</h3><p>${def.desc} +${fmtInt(def.reward)} hormigas.</p></div>` +
      `<div class="check"></div>`;
    els.logrosList.appendChild(row);
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

  for (const row of els.logrosList.children) {
    const def = logros.LOGROS.find(d => d.id === row.dataset.id);
    const done = state.logros.includes(def.id);
    const prog = done ? `${fmtInt(def.at)}` : `${fmtInt(logros.progressFor(def))}/${fmtInt(def.at)}`;
    if (logroCache[def.id] !== prog) {
      logroCache[def.id] = prog;
      row.classList.toggle('locked', !done);
      row.querySelector('.prog').textContent = prog;
      row.querySelector('.check').textContent = done ? '✓' : '';
    }
  }
  const count = `${logros.doneCount()}/${logros.LOGROS.length}`;
  if (logroCache._count !== count) {
    logroCache._count = count;
    els.logrosCount.textContent = count;
  }

  const rate = antRateFn().toLocaleString('es-AR', { maximumFractionDigits: 2 });
  const slipPct = (slipChance(false) * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 });
  const sapRate = SAP_RATE.toLocaleString('es-AR', { minimumFractionDigits: 1 });
  els.shopStats.textContent = `${rate} hormigas/s · ${sapRate} savia/s · resbalón ${slipPct}%`;
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
  audio.unlockChime();
  refreshShop(true);
}

// banner central display: cambios de zona, lluvia, etc.
export function showBanner(title, sub) {
  els.zoneBanner.querySelector('b').textContent = title;
  els.zoneBanner.querySelector('span').textContent = sub;
  els.zoneBanner.className = '';
  void els.zoneBanner.offsetWidth;
  els.zoneBanner.className = 'show';
}

export function logroToast(def) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<b>Logro · ${def.name}</b><span>${def.desc} +${fmtInt(def.reward)} hormigas</span>`;
  els.toasts.appendChild(el);
  setTimeout(() => el.remove(), 3700);
  refreshShop(true);
}

export function questToast(text, reward) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<b>Misión cumplida</b><span>${text} · +${fmtInt(reward)} hormigas</span>`;
  els.toasts.appendChild(el);
  setTimeout(() => el.remove(), 3700);
  audio.questDone();
}

const FEEDBACK = {
  perfect: { text: '¡Perfecto!', cls: 'good' },
  chain: { text: '¡Salto largo!', cls: 'good' },
  resin: { text: 'La resina te salvó', cls: 'good' },
  short: { text: 'Muy corto…', cls: 'shake' },
  over: { text: 'Te pasaste', cls: 'shake' },
  badluck: { text: '¡Mala suerte!', cls: 'shake' },
};

export function flash(text, cls) {
  const el = els.feedback;
  el.textContent = text;
  el.className = '';
  void el.offsetWidth; // reinicia la animación
  el.className = `show ${cls}`;
}

// badge de racha de perfectos: se agranda y retrae en cada perfecto seguido
function showMult(mult) {
  els.mult.textContent = `×${mult.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  els.mult.hidden = false;
  els.mult.classList.remove('pop');
  void els.mult.offsetWidth; // reinicia la animación aunque el texto no cambie
  els.mult.classList.add('pop');
}

function hideMult() {
  els.mult.hidden = true;
}

export function onClimbEvent(ev) {
  if (ev.type === 'grab') {
    flash(`+${fmtH(ev.gain)} m`, 'good');
    hideMult(); // agarre limpio pero no perfecto: la racha se corta
  } else if (ev.type === 'perfect') {
    flash(ev.mult > 1 ? `¡Perfecto! ×${ev.mult.toLocaleString('es-AR', { minimumFractionDigits: 1 })}` : '¡Perfecto!', 'good');
    if (ev.mult > 1) showMult(ev.mult);
  } else if (FEEDBACK[ev.type]) {
    const f = FEEDBACK[ev.type];
    flash(f.text, f.cls);
    if (ev.type === 'short' || ev.type === 'over' || ev.type === 'badluck') hideMult();
  }
}

// cache de lo último escrito: tocar el DOM solo cuando el texto cambia
const hud = { h: '', rec: '', ants: '', sap: '', bar: -1, quest: '', charging: false };

export function update() {
  // durante la carga, la UI se atenúa (clase en body, solo cuando cambia)
  const charging = climb.phase === 'charging';
  if (charging !== hud.charging) {
    hud.charging = charging;
    document.body.classList.toggle('charging', charging);
  }
  const h = fmtH(climb.visualHeight());
  if (h !== hud.h) {
    hud.h = h;
    els.heightN.textContent = h;
  }
  const rec = `récord ${fmtH(state.bestHeight)} m`;
  if (rec !== hud.rec) {
    hud.rec = rec;
    els.record.textContent = rec;
  }
  const ants = fmtInt(state.ants);
  if (ants !== hud.ants) {
    hud.ants = ants;
    els.ants.textContent = ants;
  }
  const sap = fmtInt(state.sap);
  if (sap !== hud.sap) {
    hud.sap = sap;
    els.sap.textContent = sap;
  }
  const next = nextLockedUnlock();
  const bar = next ? Math.min(100, Math.round((state.sap / next.at) * 1000) / 10) : 100;
  if (bar !== hud.bar) {
    hud.bar = bar;
    els.sapBar.style.width = `${bar}%`;
  }
  if (state.quest) {
    const quest = `${quests.text()} · ${quests.progressText()}`;
    if (quest !== hud.quest) {
      hud.quest = quest;
      els.questText.textContent = quest;
    }
  }

  if (shopOpen) refreshShop(false);
}
