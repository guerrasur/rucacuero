// HUD, tienda (hormiguero), ropero, toasts de savia y feedback flotante.
import { state, save } from './state.js';
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
import * as cosmetics from './cosmetics.js';
import * as carrera from './carrera.js';
import { drawProbador, drawCosmeticIcon } from './scene.js';
import { ICONOS, ANT_SVG, SAP_SVG, TROFEO_SVG } from './iconos.js';

const $ = id => document.getElementById(id);

// solapas de la tienda: se accede a cada sección tocando su icono
const SOLAPAS = [
  { id: 'hormigas', label: 'Hormigas', icon: ANT_SVG },
  { id: 'savia', label: 'Savia', icon: SAP_SVG },
  { id: 'trofeos', label: 'Trofeos', icon: TROFEO_SVG },
];

let els = {};
let shopOpen = false;
let roperoAbierto = false;
// lo que el jugador se está probando en el maniquí (puede no estar comprado)
const probador = { sombrero: null, chiripa: null };
let lastShopRefresh = 0;
let lastRoperoRefresh = 0;
const logroCache = {}; // último texto escrito por fila de logro (disciplina DOM)
const roperoCache = {}; // último estado escrito por carta de cosmético
const shopCache = {}; // chips de moneda de la tienda

const fmtInt = n => Math.floor(n).toLocaleString('es-AR');
const fmtH = h =>
  h.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function init() {
  els = {
    heightN: $('height-n'),
    mult: $('mult'),
    record: $('record'),
    timer: $('timer'),
    modoBtn: $('modo-btn'),
    shopSub: $('shop-sub'),
    upgradeListCarrera: $('upgrade-list-carrera'),
    questText: $('quest-text'),
    ants: $('ants-n'),
    sap: $('sap-n'),
    sapBar: document.querySelector('#sap-bar i'),
    hint: $('hint'),
    feedback: $('feedback'),
    shop: $('shop'),
    shopBtn: $('shop-btn'),
    shopCerrar: $('shop-cerrar'),
    shopTabs: $('shop-tabs'),
    shopScroll: $('shop-scroll'),
    shopAnts: $('shop-ants'),
    shopSap: $('shop-sap'),
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
    ropero: $('ropero'),
    roperoBtn: $('ropero-btn'),
    roperoCerrar: $('ropero-cerrar'),
    roperoAnts: $('ropero-ants'),
    probadorCanvas: $('probador-canvas'),
    skinGrid: $('skin-grid'),
    hatList: $('hat-list'),
    panalList: $('panal-list'),
  };

  // blur tras cada click: un botón enfocado se re-activa con Espacio (salto)
  els.shopBtn.addEventListener('click', () => {
    openShop();
    els.shopBtn.blur();
  });
  els.shopCerrar.addEventListener('click', () => closeShop());
  els.roperoBtn.addEventListener('click', () => {
    openRopero();
    els.roperoBtn.blur();
  });
  els.roperoCerrar.addEventListener('click', () => closeRopero());
  els.muteBtn.addEventListener('click', () => {
    audio.ensure();
    audio.setMuted(!audio.isMuted());
    syncMuteIcon();
    els.muteBtn.blur();
  });
  els.modoBtn.addEventListener('click', () => {
    audio.ensure();
    const next = state.mode === 'carrera' ? 'zen' : 'carrera';
    carrera.setMode(next);
    syncModeUI();
    if (next === 'zen') showBanner('Modo Zen', 'la rama de siempre, sin apuro');
    else showBanner('Modo Carrera', `${carrera.timeTotal().toLocaleString('es-AR', { maximumFractionDigits: 1 })} s para subir lo más alto posible`);
    els.modoBtn.blur();
  });
  syncMuteIcon();
  buildTabs();
  buildShop();
  buildRopero();
  syncModeUI();
}

// refleja el modo activo en HUD, botón y tienda
function syncModeUI() {
  const enCarrera = state.mode === 'carrera';
  document.body.classList.toggle('mode-carrera', enCarrera);
  // el yin-yang: activo en carrera (te lleva al zen), apagado en zen (te vuelve)
  els.modoBtn.setAttribute('aria-label', enCarrera ? 'Pasar al modo Zen' : 'Volver al modo Carrera');
  els.timer.hidden = !enCarrera;
  els.upgradeList.hidden = enCarrera;
  els.upgradeListCarrera.hidden = !enCarrera;
  els.shopSub.textContent = enCarrera
    ? 'Las hormigas coloradas se ganan llegando alto en cada carrera.'
    : 'Las hormigas trabajan mientras el juego está abierto.';
  hud.ants = ''; // fuerza reescritura del contador con la moneda del modo
  hud.rec = '';
  refreshShop(true);
}

function syncMuteIcon() {
  const m = audio.isMuted();
  // los SVG no tienen la propiedad .hidden: se maneja el atributo
  els.iconSound.toggleAttribute('hidden', m);
  els.iconMuted.toggleAttribute('hidden', !m);
  els.muteBtn.setAttribute('aria-label', m ? 'Activar sonido' : 'Silenciar sonido');
}

// la tienda es un menú de pantalla completa (como el ropero) dividida en
// solapas: Hormigas (mejoras del modo activo), Savia (avances) y Trofeos.
let solapaActiva = 'hormigas';

function buildTabs() {
  els.shopTabs.innerHTML = '';
  for (const s of SOLAPAS) {
    const b = document.createElement('button');
    b.className = 'tab';
    b.dataset.id = s.id;
    b.setAttribute('aria-label', s.label);
    b.innerHTML = `${s.icon}<span>${s.label}</span>`;
    b.addEventListener('click', () => {
      setSolapa(s.id);
      b.blur();
    });
    els.shopTabs.appendChild(b);
  }
  setSolapa(solapaActiva);
}

function setSolapa(id) {
  solapaActiva = id;
  for (const b of els.shopTabs.children) b.classList.toggle('sel', b.dataset.id === id);
  for (const s of SOLAPAS) $(`solapa-${s.id}`).hidden = s.id !== id;
  els.shopScroll.scrollTop = 0;
}

function openShop() {
  if (roperoAbierto) closeRopero();
  shopOpen = true;
  els.shop.hidden = false;
  requestAnimationFrame(() => els.shop.classList.add('open'));
  refreshShop(true);
}

function closeShop() {
  shopOpen = false;
  els.shop.classList.remove('open');
  setTimeout(() => {
    if (!shopOpen) els.shop.hidden = true;
  }, 300);
}

// el ropero es un menú de pantalla completa: tapa el juego hasta volver.
// El probador arranca con lo puesto de verdad.
function openRopero() {
  if (shopOpen) closeShop();
  roperoAbierto = true;
  probador.sombrero = state.cosmetics.sombrero;
  probador.chiripa = state.cosmetics.chiripa;
  els.ropero.hidden = false;
  requestAnimationFrame(() => els.ropero.classList.add('open'));
  refreshRopero(true);
}

function closeRopero() {
  roperoAbierto = false;
  els.ropero.classList.remove('open');
  setTimeout(() => {
    if (!roperoAbierto) els.ropero.hidden = true;
  }, 300);
}

// main la usa para no disparar saltos con Espacio dentro de un menú
export function menuAbierto() {
  return roperoAbierto || shopOpen;
}

function buildShop() {
  els.upgradeList.innerHTML = '';
  for (const def of UPGRADES) {
    if (!upgradeAvailable(def)) continue;
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = def.id;
    card.innerHTML =
      `<div class="icono-svg">${ICONOS[def.id] || ''}</div>` +
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

  // mejoras del modo carrera: mismas cartas, moneda colorada
  els.upgradeListCarrera.innerHTML = '';
  for (const def of carrera.R_UPGRADES) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = def.id;
    card.innerHTML =
      `<div class="icono-svg">${ICONOS[def.id] || ''}</div>` +
      `<div class="card-info"><h3>${def.name}<span class="lvl"></span></h3><p>${def.desc}</p></div>` +
      `<button class="buy">${ANT_SVG}<span class="cost"></span></button>`;
    card.querySelector('.buy').addEventListener('click', () => {
      const costo = carrera.upgradeCost(def);
      if (carrera.buy(def)) {
        audio.ensure();
        audio.buy();
        logros.bump('gastadas', costo);
        refreshShop(true);
      }
    });
    els.upgradeListCarrera.appendChild(card);
  }

  els.unlockList.innerHTML = '';
  for (const u of SAP_UNLOCKS) {
    const row = document.createElement('div');
    row.className = 'unlock';
    row.dataset.id = u.id;
    row.innerHTML =
      `<div class="icono-svg savia">${ICONOS[u.id] || ''}</div>` +
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
      `<div class="icono-svg">${ICONOS[def.id] || ''}</div>` +
      `<div class="at prog"></div>` +
      `<div><h3>${def.name}</h3><p>${def.desc} +${fmtInt(def.reward)} hormigas.</p></div>` +
      `<div class="check"></div>`;
    els.logrosList.appendChild(row);
  }
  refreshShop(true);
}

function buildRopero() {
  els.skinGrid.innerHTML = '';
  for (const s of cosmetics.SKINS) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.dataset.id = s.id;
    b.style.setProperty('--sw', s.hex);
    b.setAttribute('aria-label', `Piel ${s.name}`);
    b.addEventListener('click', () => {
      state.cosmetics.piel = s.id;
      save();
      refreshRopero(true);
    });
    els.skinGrid.appendChild(b);
  }
  buildCosmeticList(els.hatList, 'sombrero');
  buildCosmeticList(els.panalList, 'chiripa');
  refreshRopero(true);
}

function buildCosmeticList(listEl, slot) {
  listEl.innerHTML = '';
  for (const def of cosmetics.COSMETICS) {
    if (def.slot !== slot) continue;
    const card = document.createElement('div');
    card.className = 'card cos';
    card.dataset.id = def.id;
    card.innerHTML =
      `<canvas class="icono" aria-hidden="true"></canvas>` +
      `<div class="card-info"><h3>${def.name}</h3><p>${def.desc}</p></div>` +
      `<button class="buy"></button>`;
    // icono de previsualización: se dibuja una sola vez al construir
    const cv = card.querySelector('.icono');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = 46 * dpr;
    cv.height = 46 * dpr;
    const ictx = cv.getContext('2d');
    ictx.scale(dpr, dpr);
    drawCosmeticIcon(ictx, def, 46);
    // tocar la carta = probárselo en el maniquí (aunque no esté comprado)
    card.addEventListener('click', () => {
      probador[slot] = probador[slot] === def.id ? null : def.id;
      refreshRopero(true);
    });
    card.querySelector('button').addEventListener('click', e => {
      e.stopPropagation();
      if (!cosmetics.owned(def.id)) {
        if (cosmetics.buyCosmetic(def)) {
          audio.ensure();
          audio.buy();
          quests.note('buy');
          logros.bump('gastadas', def.cost);
          probador[slot] = def.id; // recién comprado, puesto
          refreshRopero(true);
        }
      } else {
        const puesto = state.cosmetics[slot] === def.id;
        cosmetics.setEquipped(slot, puesto ? null : def.id);
        probador[slot] = state.cosmetics[slot];
        refreshRopero(true);
      }
    });
    listEl.appendChild(card);
  }
}

function refreshRopero(force) {
  const now = performance.now();
  if (!force && now - lastRoperoRefresh < 250) return;
  lastRoperoRefresh = now;

  for (const b of els.skinGrid.children) {
    b.classList.toggle('sel', b.dataset.id === state.cosmetics.piel);
  }

  for (const listEl of [els.hatList, els.panalList]) {
    for (const card of listEl.children) {
      const def = cosmetics.COSMETICS.find(d => d.id === card.dataset.id);
      const puesto = state.cosmetics[def.slot] === def.id;
      const probando = probador[def.slot] === def.id;
      // estado del botón: comprar (con/sin fondos) / equipar / sacarse
      let mode;
      if (!cosmetics.owned(def.id)) mode = cosmetics.canBuyCosmetic(def) ? 'comprar' : 'sin-fondos';
      else mode = puesto ? 'puesto' : 'guardado';
      const key = `${mode}|${probando}`;
      if (roperoCache[def.id] === key) continue;
      roperoCache[def.id] = key;
      card.classList.toggle('probando', probando && !puesto);
      card.classList.toggle('puesta', puesto);
      const btn = card.querySelector('button');
      if (mode === 'comprar' || mode === 'sin-fondos') {
        btn.className = 'buy';
        btn.innerHTML = `${ANT_SVG}<span class="cost">${fmtInt(def.cost)}</span>`;
        btn.disabled = mode === 'sin-fondos';
      } else {
        btn.className = mode === 'puesto' ? 'equip on' : 'equip';
        btn.textContent = mode === 'puesto' ? 'Sacarse' : 'Equipar';
        btn.disabled = false;
      }
    }
  }
  const ants = fmtInt(state.ants);
  if (roperoCache._ants !== ants) {
    roperoCache._ants = ants;
    els.roperoAnts.textContent = ants;
  }
}

// el maniquí del probador: se redibuja por frame solo con el ropero abierto
function drawProbadorFrame() {
  const cv = els.probadorCanvas;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || 150;
  const h = cv.clientHeight || 190;
  if (cv.width !== Math.round(w * dpr)) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawProbador(ctx, w, h, performance.now() / 1000, {
    piel: state.cosmetics.piel,
    sombrero: probador.sombrero,
    chiripa: probador.chiripa,
  });
}

function refreshShop(force) {
  const now = performance.now();
  if (!force && now - lastShopRefresh < 250) return;
  lastShopRefresh = now;

  // chips del header: moneda del modo activo + savia
  const chipAnts = fmtInt(state.mode === 'carrera' ? state.carrera.ants : state.ants);
  if (shopCache.ants !== chipAnts) {
    shopCache.ants = chipAnts;
    els.shopAnts.textContent = chipAnts;
  }
  const chipSap = fmtInt(state.sap);
  if (shopCache.sap !== chipSap) {
    shopCache.sap = chipSap;
    els.shopSap.textContent = chipSap;
  }

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

  for (const card of els.upgradeListCarrera.children) {
    const def = carrera.R_UPGRADES.find(d => d.id === card.dataset.id);
    const lvl = state.carrera.upgrades[def.id];
    card.querySelector('.lvl').textContent = lvl > 0 ? `nv ${lvl}` : '';
    const btn = card.querySelector('.buy');
    const costEl = card.querySelector('.cost');
    if (lvl >= def.max) {
      costEl.textContent = 'MÁX';
      btn.disabled = true;
    } else {
      costEl.textContent = fmtInt(carrera.upgradeCost(def));
      btn.disabled = !carrera.canBuy(def);
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

  const sapRate = SAP_RATE.toLocaleString('es-AR', { minimumFractionDigits: 1 });
  if (state.mode === 'carrera') {
    const u = state.carrera.upgrades;
    const salto = (1 + 0.08 * u.resorte).toLocaleString('es-AR', { maximumFractionDigits: 2 });
    els.shopStats.textContent = `salto ×${salto} · carrera ${carrera.timeTotal().toLocaleString('es-AR', { maximumFractionDigits: 1 })} s · ${sapRate} savia/s`;
  } else {
    const rate = antRateFn().toLocaleString('es-AR', { maximumFractionDigits: 2 });
    const slipPct = (slipChance(false) * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 });
    els.shopStats.textContent = `${rate} hormigas/s · ${sapRate} savia/s · resbalón ${slipPct}%`;
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
const hud = { h: '', rec: '', ants: '', sap: '', bar: -1, quest: '', charging: false, timer: '' };

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
  // el contador muestra la moneda del modo activo (coloradas en carrera)
  const enCarrera = state.mode === 'carrera';
  const ants = fmtInt(enCarrera ? state.carrera.ants : state.ants);
  if (ants !== hud.ants) {
    hud.ants = ants;
    els.ants.textContent = ants;
  }
  if (enCarrera) {
    const r = carrera.run;
    const left = r.active ? r.left : carrera.timeTotal();
    const timer = `${left.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;
    if (timer !== hud.timer) {
      hud.timer = timer;
      els.timer.textContent = timer;
      els.timer.classList.toggle('acaba', r.active && left < 10);
    }
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
  if (roperoAbierto) {
    refreshRopero(false);
    drawProbadorFrame();
  }
}
