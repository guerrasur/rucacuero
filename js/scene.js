// Render canvas de la escena: rama xilográfica, nudos, escalador, hormigas,
// savia, luciérnagas y el elemento firma — el viento dibujado.
import { state } from './state.js';
import { climb, wind, knotHeight, knotHasSap, knotIndexAbove, hash, MAX_JUMP, PERFECT_W, ZONES } from './climb.js';
import { branchEvents } from './events.js';
import { skinHex } from './cosmetics.js';
import { run } from './carrera.js';

const C = {
  noche: '#131B12',
  verde: '#7FA636',
  musgo: '#43601F',
  savia: '#F0A32A',
  hueso: '#F2E8CE',
  tinta: '#2A1C14',
  ocre: '#C9825A',
  tierra: '#3B2A1B', // suelo: marrón entre tinta y ocre
  nocheDeep: '#0C120B',
  nocheSoft: '#1A2617',
};

const VISIBLE_M = 9; // metros de rama visibles en pantalla
const CHAR_Y = 0.7; // fracción de pantalla donde vive el personaje

// arrays de guiones constantes: evitan alocar en cada frame
const DASH_STRIA = [26, 21];
const DASH_RING = [6, 7];
const DASH_RECORD = [9, 8];
const DASH_NONE = [];

function hexLerp(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
}

// Verde de la rama según la zona, con transición suave en los 6 m
// anteriores a cada frontera.
function zoneVerde(h) {
  let cur = ZONES[0];
  let next = null;
  for (let i = 0; i < ZONES.length; i++) {
    if (h >= ZONES[i].at) {
      cur = ZONES[i];
      next = ZONES[i + 1] || null;
    }
  }
  if (next) {
    const t = (h - (next.at - 6)) / 6;
    if (t > 0) return hexLerp(cur.verde, next.verde, Math.min(1, t));
  }
  return cur.verde;
}

export class Scene {
  constructor(canvas) {
    this.canvas = canvas;
    // canvas opaco: el fondo se pinta entero cada frame, composición más barata
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.t = 0;
    this.cameraH = state.height;
    this.shake = 0;
    this.dpr = 1;
    this.particles = [];
    this.flashT = 0; // destello del perfecto: se dispara al soltar
    this.flashH = 0;
    this.climberPos = { x: 0, y: 0 };
    this.birdPos = null;
    this.swarmPos = null;
    this.strokes = this.makeWindStrokes();
    this.glowSprite = this.makeGlowSprite();
    this.fogSprite = this.makeFogSprite();
    this.leafDeep = [this.makeLeafSprite(C.nocheDeep, false), this.makeLeafSprite(C.nocheDeep, true)];
    this.leafSoft = [this.makeLeafSprite(C.nocheSoft, false), this.makeLeafSprite(C.nocheSoft, true)];
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // sprites pre-renderizados: crear gradientes/blobs por frame es lo más caro
  makeGlowSprite() {
    const c = document.createElement('canvas');
    c.width = c.height = 48;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(24, 24, 1, 24, 24, 22);
    rg.addColorStop(0, 'rgba(240,163,42,0.30)');
    rg.addColorStop(1, 'rgba(240,163,42,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 48, 48);
    return c;
  }

  // banco de niebla: blobs suaves pre-renderizados (jamás gradientes por frame)
  makeFogSprite() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const g = c.getContext('2d');
    const blobs = [
      [60, 70, 55], [130, 55, 65], [200, 72, 50], [95, 85, 40],
    ];
    for (const [x, y, r] of blobs) {
      const rg = g.createRadialGradient(x, y, 1, x, y, r);
      rg.addColorStop(0, 'rgba(242,232,206,0.10)');
      rg.addColorStop(1, 'rgba(242,232,206,0)');
      g.fillStyle = rg;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return c;
  }

  makeLeafSprite(color, mirror) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.translate(128, 128);
    if (mirror) g.scale(-1, 1);
    g.fillStyle = color;
    const R = 60;
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.arc(R * 0.55, R * 0.4, R * 0.7, 0, Math.PI * 2);
    g.arc(R * 0.2, -R * 0.55, R * 0.6, 0, Math.PI * 2);
    g.fill();
    return c;
  }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.ppm = this.H / VISIBLE_M;
    this.bw = Math.min(this.W * 0.34, 170);
  }

  addShake(amount) {
    this.shake = Math.min(1.4, this.shake + amount);
  }

  yOf(h) {
    return this.H * CHAR_Y - (h - this.cameraH) * this.ppm;
  }
  branchX(h) {
    return this.W * 0.5 + Math.sin(h * 0.35 + 1.7) * this.W * 0.055;
  }
  edgeWobble(h, seed) {
    return Math.sin(h * 6.1 + seed) * 2.5 + Math.sin(h * 13.7 + seed * 2) * 1.2;
  }

  makeWindStrokes() {
    // Trazos de xilografía: onda larga con un rulo en el medio.
    const p = new Path2D();
    p.moveTo(0, 0);
    p.bezierCurveTo(46, -15, 88, 14, 128, 3);
    p.bezierCurveTo(150, -4, 154, -27, 137, -28);
    p.bezierCurveTo(121, -29, 119, -8, 146, -1);
    p.bezierCurveTo(184, 8, 226, -12, 268, -5);
    return [
      { path: p, yf: 0.2, sc: 1.15, speed: 1.15, ph: 0.9 },
      { path: p, yf: 0.38, sc: 0.8, speed: 0.9, ph: 2.2 },
      { path: p, yf: 0.55, sc: 1.0, speed: 1.3, ph: 4.1 },
      { path: p, yf: 0.74, sc: 0.7, speed: 1.0, ph: 5.6 },
    ];
  }

  draw(dt, view) {
    const { ctx } = this;
    this.t += dt;
    const h = climb.visualHeight();
    this.cameraH += (h - this.cameraH) * Math.min(1, dt * 4.5);
    this.shake = Math.max(0, this.shake - dt * 2.4);

    // la escala es SIEMPRE fija (nada de zoom: estiraba el árbol y movía el
    // objetivo); en los vuelos gigantes la cámara persigue al escalador y,
    // si el viaje es más rápido que el lerp, se engancha para no perderlo
    if (h - this.cameraH > 2.5) this.cameraH = h - 2.5;
    else if (this.cameraH - h > 2.5) this.cameraH = h + 2.5;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = C.noche;
    ctx.fillRect(0, 0, this.W, this.H);

    ctx.save();
    if (this.shake > 0.01) {
      ctx.translate((Math.random() - 0.5) * 7 * this.shake, (Math.random() - 0.5) * 5 * this.shake);
    }

    this.drawLeafLayer(0.35, this.leafDeep, 0);
    this.drawLeafLayer(0.65, this.leafSoft, 40);
    this.drawFireflies();
    this.drawBranch();
    this.drawMilestones();
    this.drawRecordLine();
    this.drawAnts(view.antRate);
    this.drawGround();
    this.drawChargeOverlays();
    this.drawPerfectFlash(dt);
    this.drawClimber(h);
    this.drawBird();
    this.drawSwarm();
    this.drawParticles(dt);
    this.drawWind(view.unlocks);
    this.drawFog();
    this.drawRain();
    ctx.restore();

    this.drawVignette();
  }

  // ---------- fondo ----------
  drawLeafLayer(factor, sprites, seed) {
    const { ctx } = this;
    const hp = this.cameraH * factor;
    const band = 3.2;
    const jMin = Math.floor((hp - (this.H * 0.5) / this.ppm) / band) - 1;
    const jMax = Math.ceil((hp + (this.H * 0.7) / this.ppm) / band) + 1;
    for (let j = jMin; j <= jMax; j++) {
      const y = this.H * CHAR_Y - (j * band - hp) * this.ppm;
      for (let side = 0; side < 2; side++) {
        const hs = hash(j * 2.3 + side * 7.7 + seed);
        const x = side === 0 ? hs * this.W * 0.14 : this.W - hs * this.W * 0.14;
        const r = 45 + hash(j * 5.1 + side + seed) * 65;
        const s = r * 4;
        ctx.drawImage(sprites[side], x - s / 2, y - s / 2, s, s);
      }
    }
  }

  drawFireflies() {
    const { ctx } = this;
    for (let i = 0; i < 9; i++) {
      const fx = ((hash(i * 7.7) + Math.sin(this.t * 0.06 + i * 1.9) * 0.04) % 1) * this.W;
      let fy = (hash(i * 3.3) + this.t * 0.008 * (1 + (i % 3)) + this.cameraH * 0.015) % 1;
      if (fy < 0) fy += 1;
      const a = 0.22 + 0.22 * Math.sin(this.t * 1.4 + i * 2.6);
      if (a <= 0.03) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = C.savia;
      ctx.beginPath();
      ctx.arc(fx, (1 - fy) * this.H, 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- rama ----------
  branchSpan() {
    return {
      top: this.cameraH + (this.H * CHAR_Y) / this.ppm + 1.5,
      bot: this.cameraH - (this.H * (1 - CHAR_Y)) / this.ppm - 1.5,
    };
  }

  drawBranch() {
    const { ctx } = this;
    const { top, bot } = this.branchSpan();
    // con zoom el tramo visible crece: el paso escala para no explotar en puntos
    const step = Math.max(0.3, (top - bot) / 240);
    const L = [];
    const R = [];
    for (let hh = top; hh >= bot; hh -= step) {
      const bx = this.branchX(hh);
      const y = this.yOf(hh);
      L.push([bx - this.bw / 2 + this.edgeWobble(hh, 1.3), y]);
      R.push([bx + this.bw / 2 + this.edgeWobble(hh, 4.8), y]);
    }

    ctx.beginPath();
    ctx.moveTo(L[0][0], L[0][1]);
    for (const [x, y] of L) ctx.lineTo(x, y);
    for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.closePath();
    ctx.fillStyle = zoneVerde(this.cameraH);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = C.tinta;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // sombra del lado derecho: la luz viene de la savia, no del cielo
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(R[0][0] - 7, R[0][1]);
    for (const [x, y] of R) ctx.lineTo(x - 7, y);
    ctx.lineWidth = 15;
    ctx.strokeStyle = C.musgo;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // estrías de corteza talladas
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = C.musgo;
    ctx.setLineDash(DASH_STRIA);
    for (const f of [0.22, 0.5, 0.78]) {
      ctx.lineDashOffset = -((this.cameraH * this.ppm) % 47) + f * 31;
      ctx.beginPath();
      let first = true;
      for (let i = 0; i < L.length; i++) {
        const hh = top - i * step;
        const x = L[i][0] + (R[i][0] - L[i][0]) * f + Math.sin(hh * 3.3 + f * 13) * 3.5;
        if (first) {
          ctx.moveTo(x, L[i][1]);
          first = false;
        } else ctx.lineTo(x, L[i][1]);
      }
      ctx.stroke();
    }
    ctx.setLineDash(DASH_NONE);
    ctx.restore();

    // nudos visibles: arranca directo del primer nudo en pantalla
    for (let i = knotIndexAbove(bot); ; i++) {
      const kh = knotHeight(i);
      if (kh > top) break;
      this.drawKnot(i, kh);
    }
  }

  drawKnot(i, kh) {
    const { ctx } = this;
    const y = this.yOf(kh);
    const cx = this.branchX(kh) + (i % 2 ? -1 : 1) * this.bw * 0.16;
    const r = 12 + hash(i * 9.1) * 5;

    ctx.beginPath();
    ctx.arc(cx, y, r, 0, Math.PI * 2);
    ctx.fillStyle = C.musgo;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.tinta;
    ctx.stroke();

    // veta en espiral tallada
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, y, r * 0.58, 0.4, 4.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + r * 0.12, y - r * 0.08, r * 0.26, 2.6, 8.2);
    ctx.stroke();

    // refuerzos comprados: puntadas de resina alrededor del nudo
    if (state.upgrades.nudos > 0) {
      ctx.strokeStyle = C.savia;
      ctx.lineWidth = 2.4;
      const n = Math.min(6, 2 + state.upgrades.nudos);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + 0.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (r + 2), y + Math.sin(a) * (r + 2));
        ctx.lineTo(cx + Math.cos(a) * (r + 7), y + Math.sin(a) * (r + 7));
        ctx.stroke();
      }
    }

    // el próximo nudo objetivo lleva un anillo hueso girando
    if (i === climb.targetKnot && (climb.phase === 'idle' || climb.phase === 'charging')) {
      ctx.strokeStyle = C.hueso;
      ctx.lineWidth = 2.5;
      ctx.setLineDash(DASH_RING);
      ctx.lineDashOffset = -this.t * 16;
      ctx.beginPath();
      ctx.arc(cx, y, r + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash(DASH_NONE);
    }

    if (knotHasSap(i)) this.drawSap(cx + r * 0.55, y + r + 7, i);
  }

  drawSap(x, y, seed) {
    const { ctx } = this;
    const pulse = 0.75 + 0.25 * Math.sin(this.t * 1.8 + seed);
    ctx.globalAlpha = pulse;
    ctx.drawImage(this.glowSprite, x - 22, y - 22, 44, 44);
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.moveTo(x, y - 7);
    ctx.bezierCurveTo(x + 5.5, y - 1, x + 4.5, y + 5, x, y + 5.5);
    ctx.bezierCurveTo(x - 4.5, y + 5, x - 5.5, y - 1, x, y - 7);
    ctx.fillStyle = C.savia;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.tinta;
    ctx.stroke();
  }

  // ---------- marcas de altura pintadas en la corteza ----------
  drawMilestones() {
    const { ctx } = this;
    const { top, bot } = this.branchSpan();
    ctx.font = '13px Chango, Georgia, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let m = Math.max(10, Math.ceil(bot / 10) * 10); m <= top; m += 10) {
      const y = this.yOf(m);
      const x = this.branchX(m) - this.bw * 0.42;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = C.hueso;
      ctx.fillText(String(m), x + 12, y);
      ctx.strokeStyle = C.hueso;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 8, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // línea del récord: tu mejor altura pintada en la rama
  drawRecordLine() {
    const { ctx } = this;
    const b = state.bestHeight;
    if (b < 3) return;
    const y = this.yOf(b);
    if (y < -20 || y > this.H + 20) return;
    const bx = this.branchX(b);
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = C.hueso;
    ctx.lineWidth = 2;
    ctx.setLineDash(DASH_RECORD);
    ctx.beginPath();
    ctx.moveTo(bx - this.bw * 0.75, y);
    ctx.lineTo(bx + this.bw * 0.75, y);
    ctx.stroke();
    ctx.setLineDash(DASH_NONE);
    // banderín
    ctx.globalAlpha = 0.85;
    const fx = bx + this.bw * 0.75;
    ctx.beginPath();
    ctx.moveTo(fx, y);
    ctx.lineTo(fx, y - 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(fx, y - 14);
    ctx.lineTo(fx + 13, y - 10);
    ctx.lineTo(fx, y - 6);
    ctx.closePath();
    ctx.fillStyle = C.savia;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---------- la tierra: el piso curvo del que sale el tallo ----------
  drawGround() {
    const { ctx } = this;
    const sy = this.yOf(0) + 26; // la superficie pasa por los pies del escalador
    if (sy > this.H + 400) return; // quedó muy abajo: ni se dibuja
    const R = this.W * 1.1; // curva suave que se escapa por los bordes
    const cx = this.W / 2;
    const cy = sy + R;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = C.tierra;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = C.tinta;
    ctx.stroke();
    // pastitos y trazos de xilografía sobre la loma
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = C.musgo;
    for (let i = 0; i < 11; i++) {
      const d = (hash(i * 5.3) - 0.5) * 0.85;
      const px = cx + R * Math.sin(d);
      const py = cy - R * Math.cos(d);
      ctx.beginPath();
      ctx.moveTo(px, py + 1);
      ctx.lineTo(px + (hash(i * 1.7) - 0.5) * 6, py - 5 - hash(i * 2.7) * 5);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = C.hueso;
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const d = (hash(i * 9.1 + 3) - 0.5) * 0.8;
      const px = cx + (R - 18) * Math.sin(d);
      const py = cy - (R - 18) * Math.cos(d);
      ctx.beginPath();
      ctx.moveTo(px - 5, py);
      ctx.lineTo(px + 5, py + 1.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- partículas ----------
  burst(kind, px, py) {
    const x = px ?? this.climberPos.x;
    const y = py ?? this.climberPos.y;
    const defs = {
      bark: { n: 7, colors: [C.musgo, C.tinta], up: -70, spread: 130, size: 3.5 },
      spark: { n: 9, colors: [C.savia, C.hueso], up: -110, spread: 160, size: 2.6 },
      dust: { n: 8, colors: [C.hueso], up: -30, spread: 100, size: 2.8 },
    };
    const d = defs[kind];
    if (!d) return;
    for (let i = 0; i < d.n; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 24,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * d.spread,
        vy: d.up * (0.4 + Math.random()),
        life: 0.5 + Math.random() * 0.4,
        max: 0.9,
        color: d.colors[i % d.colors.length],
        size: d.size * (0.6 + Math.random() * 0.7),
        dust: kind === 'dust',
      });
    }
  }

  drawParticles(dt) {
    const { ctx } = this;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += 260 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = Math.min(1, p.life / p.max) * (p.dust ? 0.45 : 0.9);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- hormigas ----------
  drawAnts(antRate) {
    const { ctx } = this;
    const { top, bot } = this.branchSpan();
    const span = top - bot;
    const n = Math.max(3, Math.min(16, 3 + Math.floor(antRate * 0.8)));
    ctx.fillStyle = C.tinta;
    ctx.strokeStyle = C.tinta;
    for (let k = 0; k < n; k++) {
      let prog = (this.t * 0.022 * (1 + hash(k * 4.4) * 0.6) + k / n) % 1;
      const ah = bot + prog * span;
      const bx = this.branchX(ah);
      const x = bx - this.bw / 2 + this.edgeWobble(ah, 1.3) + 8 + Math.sin(ah * 9 + this.t * 3 + k) * 1.6;
      const y = this.yOf(ah);
      // silueta: cabeza, tórax, abdomen + antenas
      ctx.beginPath();
      ctx.ellipse(x, y + 2.6, 1.9, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y - 0.6, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y - 3, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(x - 1, y - 4.2);
      ctx.lineTo(x - 2.4, y - 6);
      ctx.moveTo(x + 1, y - 4.2);
      ctx.lineTo(x + 2.4, y - 6);
      ctx.stroke();
    }
  }

  // ---------- overlays de carga ----------
  drawChargeOverlays() {
    const { ctx } = this;
    const a = climb.chargeAlpha;
    if (a < 0.02) return;
    const kh = knotHeight(climb.targetKnot);
    const w = climb.sweetW();
    const bx = this.branchX(kh);

    // banda de zona dulce sobre la rama
    const y1 = this.yOf(kh + w);
    const y2 = this.yOf(kh - w);
    ctx.globalAlpha = 0.16 * a;
    ctx.fillStyle = C.savia;
    ctx.fillRect(bx - this.bw * 0.62, y1, this.bw * 1.24, y2 - y1);
    // micro-zona perfecta: siempre visible y distinta — soltar ahí nunca
    // falla y sostiene la racha. Late con un pulso y bordes de hueso.
    const pulse = 0.7 + 0.3 * Math.sin(this.t * 6);
    const py1 = this.yOf(kh + PERFECT_W);
    const py2 = this.yOf(kh - PERFECT_W);
    const gs = 54 + 10 * pulse;
    ctx.globalAlpha = 0.75 * a * pulse;
    ctx.drawImage(this.glowSprite, bx - gs / 2, this.yOf(kh) - gs / 2, gs, gs);
    ctx.globalAlpha = (0.26 + 0.14 * pulse) * a;
    ctx.fillStyle = C.savia;
    ctx.fillRect(bx - this.bw * 0.62, py1, this.bw * 1.24, py2 - py1);
    ctx.globalAlpha = (0.35 + 0.35 * pulse) * a;
    ctx.strokeStyle = C.hueso;
    ctx.lineWidth = 1.2;
    for (const yy of [py1, py2]) {
      ctx.beginPath();
      ctx.moveTo(bx - this.bw * 0.5, yy);
      ctx.lineTo(bx + this.bw * 0.5, yy);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.55 * a;
    ctx.strokeStyle = C.savia;
    ctx.lineWidth = 1.5;
    for (const yy of [y1, y2]) {
      ctx.beginPath();
      ctx.moveTo(bx - this.bw * 0.62, yy);
      ctx.lineTo(bx + this.bw * 0.62, yy);
      ctx.stroke();
    }

    // marcador de aterrizaje proyectado (chevron hueso)
    const ly = this.yOf(climb.landingH());
    const mx = this.branchX(climb.landingH()) + this.bw * 0.62 + 12;
    ctx.globalAlpha = (0.75 + 0.25 * Math.sin(this.t * 9)) * a;
    ctx.strokeStyle = C.hueso;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(mx + 10, ly - 7);
    ctx.lineTo(mx, ly);
    ctx.lineTo(mx + 10, ly + 7);
    ctx.stroke();

    // medidor de carga al costado
    const mtX = this.W - 26;
    const mtTop = this.H * 0.3;
    const mtH = this.H * 0.4;
    ctx.globalAlpha = 0.8 * a;
    ctx.fillStyle = 'rgba(42,28,20,0.75)';
    ctx.beginPath();
    ctx.roundRect(mtX - 6, mtTop - 4, 12, mtH + 8, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(242,232,206,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const gap = kh - state.height;
    const pLo = Math.max(0, Math.min(1, (gap - w) / MAX_JUMP));
    const pHi = Math.max(0, Math.min(1, (gap + w) / MAX_JUMP));
    ctx.fillStyle = 'rgba(242,232,206,0.32)';
    ctx.fillRect(mtX - 4, mtTop + mtH * (1 - pHi), 8, mtH * (pHi - pLo));

    ctx.fillStyle = C.savia;
    const fillH = mtH * climb.power;
    ctx.beginPath();
    ctx.roundRect(mtX - 4, mtTop + mtH - fillH, 8, fillH, 4);
    ctx.fill();

    // distintivo del perfecto en el medidor: la micro-zona en savia con
    // bordes hueso, encima del relleno — se ve dónde está sin mirar la rama
    const qLo = Math.max(0, Math.min(1, (gap - PERFECT_W) / MAX_JUMP));
    const qHi = Math.max(0, Math.min(1, (gap + PERFECT_W) / MAX_JUMP));
    if (qHi > qLo) {
      const yHi = mtTop + mtH * (1 - qHi);
      const yLo = mtTop + mtH * (1 - qLo);
      ctx.fillStyle = C.savia;
      ctx.fillRect(mtX - 5, yHi, 10, yLo - yHi);
      ctx.strokeStyle = C.hueso;
      ctx.lineWidth = 1.4;
      for (const yy of [yHi, yLo]) {
        ctx.beginPath();
        ctx.moveTo(mtX - 6, yy);
        ctx.lineTo(mtX + 6, yy);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- destello del perfecto (al soltar, no al aterrizar) ----------
  perfectFlash() {
    this.flashH = knotHeight(climb.targetKnot);
    this.flashT = 0.45;
    this.burst('spark', this.branchX(this.flashH), this.yOf(this.flashH));
  }

  drawPerfectFlash(dt) {
    if (this.flashT <= 0) return;
    this.flashT = Math.max(0, this.flashT - dt);
    const p = this.flashT / 0.45; // 1 → 0
    const { ctx } = this;
    const bx = this.branchX(this.flashH);
    const y = this.yOf(this.flashH);
    // la banda dorada se "presiona": llena y se apaga
    const py1 = this.yOf(this.flashH + PERFECT_W);
    const py2 = this.yOf(this.flashH - PERFECT_W);
    ctx.globalAlpha = 0.6 * p;
    ctx.fillStyle = C.savia;
    ctx.fillRect(bx - this.bw * 0.62, py1, this.bw * 1.24, py2 - py1);
    // glow + anillo hueso que se expande desde el nudo
    const gs = 60 + (1 - p) * 60;
    ctx.globalAlpha = 0.9 * p;
    ctx.drawImage(this.glowSprite, bx - gs / 2, y - gs / 2, gs, gs);
    ctx.strokeStyle = C.hueso;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bx, y, 14 + (1 - p) * 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---------- escalador ----------
  drawClimber(h) {
    const { ctx } = this;
    const x = this.branchX(h) - this.bw * 0.02;
    const y = this.yOf(h);
    this.climberPos.x = x;
    this.climberPos.y = y;
    ctx.save();
    ctx.translate(x, y);
    const g = state.mode === 'carrera' ? run.ground : null;
    if (g) {
      // tumbado contra la tierra tras la caída; al levantarse la rotación
      // vuelve suave a cero y el loop arranca de nuevo
      const p = g.phase === 'tumbado' ? 1 : Math.max(0, g.t / g.dur);
      ctx.translate(8 * p, 15 * p);
      ctx.rotate((Math.PI / 2) * p);
      drawFigure(ctx, this.t, { crouch: 0.35, reach: 0.08, flail: 0 }, state.cosmetics);
    } else {
      drawFigure(ctx, this.t, this.poseFor(), state.cosmetics);
    }
    ctx.restore();
  }

  poseFor() {
    switch (climb.phase) {
      case 'charging':
        return { crouch: 0.25 + climb.power * 0.65, reach: 0.15, flail: 0 };
      case 'leaping':
        return { crouch: 0.05, reach: 1, flail: 0 };
      case 'slipping':
        return { crouch: 0.2, reach: 0.8, flail: 1 };
      default:
        return idlePose(this.t);
    }
  }

  // ---------- chucao (evento pájaro) ----------
  drawBird() {
    const b = branchEvents.bird;
    if (!b) {
      this.birdPos = null;
      return;
    }
    const y0 = this.yOf(b.h);
    const bx = this.branchX(b.h) + b.side * (this.bw / 2 + 8);
    let x = bx;
    let y = y0;
    let flap = 0;
    if (b.phase === 'fly') {
      const t = b.flyT;
      x = bx + b.side * t * this.W * 0.6;
      y = y0 - t * this.H * 0.45 - Math.sin(t * Math.PI) * 40;
      flap = Math.sin(t * 26) * 0.9;
    } else {
      y += Math.sin(this.t * 2.6) * 1.5;
    }
    this.birdPos = { x, y, r: 36, active: b.phase === 'perch' };

    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(-b.side, 1); // siempre mira hacia la rama
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = C.tinta;
    ctx.lineJoin = 'round';

    // cola parada, estilo chucao
    ctx.save();
    ctx.rotate(-0.15 + Math.sin(this.t * 2.2) * 0.06);
    ctx.beginPath();
    ctx.moveTo(6, -2);
    ctx.lineTo(19, -15);
    ctx.lineTo(13, 1);
    ctx.closePath();
    ctx.fillStyle = C.ocre;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // ala (aletea al volar)
    if (flap) {
      ctx.save();
      ctx.translate(2, -3);
      ctx.rotate(flap);
      ctx.beginPath();
      ctx.ellipse(0, -4, 9, 4, -0.4, 0, Math.PI * 2);
      ctx.fillStyle = C.ocre;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // cuerpo + pecho savia + cabeza
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.ocre;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-3.5, 3, 5.5, 4.5, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = C.savia;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-8, -7, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = C.ocre;
    ctx.fill();
    ctx.stroke();

    // pico y ojo
    ctx.beginPath();
    ctx.moveTo(-12.5, -8);
    ctx.lineTo(-17.5, -6.5);
    ctx.lineTo(-12, -5.2);
    ctx.closePath();
    ctx.fillStyle = C.tinta;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-9, -8.2, 1.3, 0, Math.PI * 2);
    ctx.fillStyle = C.hueso;
    ctx.fill();

    // patitas sobre el borde
    if (b.phase === 'perch') {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-2, 7);
      ctx.lineTo(-3, 12);
      ctx.moveTo(3, 7);
      ctx.lineTo(3.5, 12);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- enjambre de luciérnagas (evento) ----------
  drawSwarm() {
    const s = branchEvents.swarm;
    if (!s) {
      this.swarmPos = null;
      return;
    }
    const { ctx } = this;
    // entrada/salida suave con la misma envolvente que lluvia/niebla
    const env = Math.max(0, Math.min(1, s.t / 1, (s.dur - s.t) / 1));
    const x = this.branchX(s.h) + s.side * (this.bw / 2 + 34) + Math.sin(this.t * 0.7) * 6;
    const y = this.yOf(s.h) + Math.sin(this.t * 1.1) * 5;
    this.swarmPos = { x, y, r: 46, active: true };

    ctx.globalAlpha = 0.8 * env;
    ctx.drawImage(this.glowSprite, x - 46, y - 46, 92, 92);
    ctx.fillStyle = C.savia;
    for (let i = 0; i < 12; i++) {
      const a1 = this.t * (0.9 + hash(i) * 0.8) + i * 2.4;
      const a2 = this.t * (0.5 + hash(i + 3) * 0.6) + i * 1.1;
      const px = x + Math.cos(a1) * (10 + hash(i * 2.1) * 22);
      const py = y + Math.sin(a2) * (8 + hash(i * 4.3) * 18);
      const tw = 0.35 + 0.6 * Math.sin(this.t * 2.2 + i * 2.9);
      if (tw <= 0.05) continue;
      ctx.globalAlpha = tw * env;
      ctx.beginPath();
      ctx.arc(px, py, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- niebla (evento) ----------
  drawFog() {
    const env = branchEvents.fogEnv();
    if (env <= 0) return;
    const { ctx } = this;
    // tres bandas del sprite derivando a velocidades distintas
    const sw = this.W * 1.5;
    const sh = sw * 0.5;
    for (let i = 0; i < 3; i++) {
      const speed = 8 + i * 5;
      // recorre de borde derecho a borde izquierdo, siempre fuera de vista al reciclar
      const x = this.W - ((this.t * speed + i * (this.W + sw) * 0.37) % (this.W + sw));
      const y = this.H * (0.18 + i * 0.28) - sh / 2;
      ctx.globalAlpha = 0.55 * env;
      ctx.drawImage(this.fogSprite, x, y, sw, sh);
    }
    // velo parejo: el monte se lechosa apenas
    ctx.globalAlpha = 0.12 * env;
    ctx.fillStyle = C.nocheSoft;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.globalAlpha = 1;
  }

  // ---------- lluvia (evento) ----------
  drawRain() {
    const env = branchEvents.rainEnv();
    if (env <= 0) return;
    const { ctx } = this;
    ctx.globalAlpha = 0.26 * env;
    ctx.strokeStyle = C.hueso;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 44; i++) {
      const spd = 420 + hash(i * 13) * 240;
      const x0 = hash(i * 7) * this.W * 1.08 - 12;
      const y0 = ((hash(i * 3) + (this.t * spd) / this.H) % 1) * this.H;
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 - 4, y0 + 15);
    }
    ctx.stroke();
    // el monte se oscurece apenas bajo la lluvia
    ctx.globalAlpha = 0.1 * env;
    ctx.fillStyle = '#0d1418';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.globalAlpha = 1;
  }

  // ---------- viento dibujado (elemento firma) ----------
  drawWind(unlocks) {
    const { ctx } = this;
    const g = wind.gustProgress();

    if (g > 0) {
      for (const s of this.strokes) {
        const p = Math.min(1, g * s.speed);
        const xoff = -340 + p * (this.W + 700);
        const y = s.yf * this.H + Math.sin(this.t * 2 + s.ph) * 7;
        ctx.save();
        ctx.translate(xoff, y);
        ctx.scale(s.sc, s.sc);
        ctx.globalAlpha = Math.sin(Math.PI * Math.min(1, g)) * 0.65;
        ctx.strokeStyle = C.hueso;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke(s.path);
        ctx.restore();
      }
    } else if (wind.phase === 'calm' && wind.timer > 3 && wind.timer < 4.6) {
      // brisa ambiental leve entre ráfagas
      const p = (4.6 - wind.timer) / 1.6;
      ctx.save();
      ctx.translate(-300 + p * (this.W + 600), this.H * 0.45);
      ctx.scale(0.6, 0.6);
      ctx.globalAlpha = Math.sin(Math.PI * p) * 0.16;
      ctx.strokeStyle = C.hueso;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke(this.strokes[0].path);
      ctx.restore();
    }

    // Lectura del viento: aviso previo en el borde derecho
    if (wind.warning() && unlocks.includes('viento')) {
      const pulse = 0.4 + 0.5 * Math.abs(Math.sin(this.t * 6));
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = C.hueso;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const y = this.H * (0.3 + k * 0.16);
        ctx.beginPath();
        ctx.moveTo(this.W - 8, y);
        ctx.quadraticCurveTo(this.W - 20, y - 5, this.W - 30, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 1;
  }

  drawVignette() {
    const { ctx } = this;
    if (!this.vignette || this.vigW !== this.W) {
      this.vigW = this.W;
      this.vignette = ctx.createRadialGradient(
        this.W / 2, this.H * 0.45, this.H * 0.3,
        this.W / 2, this.H * 0.45, this.H * 0.75
      );
      this.vignette.addColorStop(0, 'rgba(0,0,0,0)');
      this.vignette.addColorStop(1, 'rgba(0,0,0,0.38)');
    }
    ctx.fillStyle = this.vignette;
    ctx.fillRect(0, 0, this.W, this.H);
  }
}

// ---------- figura del escalador (módulo) ----------
// Compartida por la escena, el probador del ropero y los iconos de cosméticos.
// Coordenadas locales con la cadera en el origen; el caller traslada.

export function idlePose(t) {
  return { crouch: 0.18 + Math.sin(t * 1.1) * 0.04, reach: 0.55, flail: 0 };
}

export function drawFigure(ctx, t, pose, cos) {
  ctx.save();
  const sway = pose.flail ? Math.sin(t * 26) * 0.09 : Math.sin(t * 1.25) * 0.035;
  ctx.rotate(sway);

  const torso = 30;
  const shW = 11;
  const hipW = 8;
  const { crouch, reach, flail } = pose;
  const hipY = 0;
  const shY = hipY - torso * (1 - crouch * 0.3);
  const piel = skinHex(cos.piel);

  // piernas
  const footY = hipY + 26 * (1 - crouch * 0.55);
  const kneeX = 10 + crouch * 12;
  const kneeY = hipY + 12 * (1 - crouch * 0.3);
  limb(ctx, -hipW * 0.6, hipY + 2, -kneeX, kneeY, -6 - crouch * 8, footY, 9, piel);
  limb(ctx, hipW * 0.6, hipY + 2, kneeX, kneeY, 6 + crouch * 8, footY, 9, piel);

  // torso (vista de espaldas)
  const tp = new Path2D();
  tp.moveTo(-shW, shY);
  tp.quadraticCurveTo(-shW - 1.5, (shY + hipY) / 2, -hipW, hipY + 4);
  tp.lineTo(hipW, hipY + 4);
  tp.quadraticCurveTo(shW + 1.5, (shY + hipY) / 2, shW, shY);
  tp.quadraticCurveTo(0, shY - 5, -shW, shY);
  ctx.fillStyle = piel;
  ctx.fill(tp);
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.tinta;
  ctx.lineJoin = 'round';
  ctx.stroke(tp);

  if (cos.chiripa === 'creci') {
    drawCreci(ctx, hipW, hipY);
  } else {
    // taparrabos hueso
    ctx.beginPath();
    ctx.roundRect(-hipW - 3, hipY - 5, (hipW + 3) * 2, 12, 5);
    ctx.fillStyle = C.hueso;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.tinta;
    ctx.stroke();
  }

  // cabeza
  const headR = 8.5;
  const headY = shY - headR - 2;
  ctx.beginPath();
  ctx.arc(0, headY, headR, 0, Math.PI * 2);
  ctx.fillStyle = piel;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.tinta;
  ctx.stroke();

  // sombrero (antes de los brazos: las manos que agarran quedan encima)
  if (cos.sombrero) drawHat(ctx, cos.sombrero, headY, headR);

  // brazos por encima (agarrando la rama)
  const wob = flail ? Math.sin(t * 25) * 5 : 0;
  const handY = shY - 20 - reach * 13;
  const handX = 12 + reach * 3 + flail * 13;
  const elbX = 15 + flail * 5;
  const elbY = shY - 8 - reach * 6;
  limb(ctx, -shW, shY + 2, -elbX, elbY, -handX, handY + wob, 8, piel);
  limb(ctx, shW, shY + 2, elbX, elbY, handX, handY - wob, 8, piel);

  ctx.restore();
}

function limb(ctx, x1, y1, x2, y2, x3, y3, wd, color = C.ocre) {
  const p = new Path2D();
  p.moveTo(x1, y1);
  p.quadraticCurveTo(x2, y2, x3, y3);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = C.tinta;
  ctx.lineWidth = wd + 4.5;
  ctx.stroke(p);
  ctx.strokeStyle = color;
  ctx.lineWidth = wd;
  ctx.stroke(p);
}

// calzones Creci: rosa apagado con vivos hueso (también se usa para su icono)
function drawCreci(ctx, hipW, hipY) {
  ctx.beginPath();
  ctx.roundRect(-hipW - 3, hipY - 5, (hipW + 3) * 2, 13, 5);
  ctx.fillStyle = '#C77A93';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.tinta;
  ctx.stroke();
  ctx.strokeStyle = C.hueso;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-hipW - 1.5, hipY - 2.6);
  ctx.lineTo(hipW + 1.5, hipY - 2.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-hipW + 1, hipY + 10, 4, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(hipW - 1, hipY + 10, 4, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
}

// cosméticos de cabeza, en coordenadas locales del escalador (hy = centro
// de la cabeza, sigue la pose y el sway solos). Formas planas, sin gradientes.
function drawHat(ctx, id, hy, headR) {
  ctx.lineJoin = 'round';
  if (id === 'velece') {
    // cono de obra: base + trapecio naranja con bandas hueso clipeadas
    const y0 = hy - headR + 3;
    ctx.beginPath();
    ctx.roundRect(-10.5, y0 - 2, 21, 4.5, 2);
    ctx.fillStyle = '#C0622F';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.tinta;
    ctx.stroke();
    const cone = new Path2D();
    cone.moveTo(-8, y0);
    cone.lineTo(-1.5, y0 - 17);
    cone.lineTo(1.5, y0 - 17);
    cone.lineTo(8, y0);
    cone.closePath();
    ctx.fillStyle = '#C0622F';
    ctx.fill(cone);
    ctx.save();
    ctx.clip(cone);
    ctx.fillStyle = C.hueso;
    ctx.fillRect(-9, y0 - 8.5, 18, 3.2);
    ctx.fillRect(-9, y0 - 13.5, 18, 3);
    ctx.restore();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.tinta;
    ctx.stroke(cone);
  } else if (id === 'cassco') {
    // casco de bici: domo verde lima con ventilaciones tinta en abanico
    const y0 = hy - headR + 4;
    ctx.beginPath();
    ctx.ellipse(0, y0, headR + 3, headR * 0.95, 0, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = '#A8B843';
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = C.tinta;
    ctx.stroke();
    ctx.fillStyle = C.tinta;
    for (const [dx, rot] of [[-5.5, -0.45], [0, 0], [5.5, 0.45]]) {
      ctx.save();
      ctx.translate(dx, y0 - headR * 0.62 + Math.abs(dx) * 0.28);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.roundRect(-1.25, -3.2, 2.5, 6.4, 1.2);
      ctx.fill();
      ctx.restore();
    }
  } else if (id === 'pretencio') {
    // boina: elipse chata ladeada, filo de luz y rabito (más clara que la
    // tinta del contorno para que no se funda)
    const by = hy - headR + 1;
    ctx.beginPath();
    ctx.ellipse(0.8, by, headR + 3.5, 4.8, -0.12, 0, Math.PI * 2);
    ctx.fillStyle = '#3A3140';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.tinta;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0.8, by, headR + 1.6, 3, -0.12, Math.PI * 1.15, Math.PI * 1.85);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(242, 232, 206, .3)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0.8, by - 6.2, 1.7, 0, Math.PI * 2);
    ctx.fillStyle = C.tinta;
    ctx.fill();
  } else if (id === 'biuti') {
    // la cara nueva: una cara de papel pegada en la nuca (el escalador
    // sigue de espaldas, pero esta cara mira al jugador). El contorno de
    // la cabeza (lw 4) come hasta r≈6.5: los rasgos deben caber ahí.
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, hy, headR, 0, Math.PI * 2);
    ctx.clip();
    // base papel, más clara que cualquier piel
    ctx.fillStyle = '#EFDBB6';
    ctx.fillRect(-headR, hy - headR, headR * 2, headR * 2);
    // ojos grandes asimétricos
    ctx.strokeStyle = C.tinta;
    ctx.lineWidth = 1.1;
    ctx.fillStyle = C.hueso;
    ctx.beginPath();
    ctx.ellipse(-2.6, hy - 0.6, 2.1, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(2.7, hy - 0.8, 1.8, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // pupilas apenas bizcas
    ctx.fillStyle = C.tinta;
    ctx.beginPath();
    ctx.arc(-2, hy - 0.4, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(2.2, hy - 0.7, 0.9, 0, Math.PI * 2);
    ctx.fill();
    // cejas gruesas, ángulos dispares
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(-4.4, hy - 3.4);
    ctx.lineTo(-1, hy - 4.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(1.2, hy - 4);
    ctx.lineTo(4.2, hy - 3.7);
    ctx.stroke();
    // labios rojos desproporcionados
    ctx.fillStyle = '#B4453C';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.roundRect(-2.9, hy + 2.2, 5.8, 1.9, 1);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(-2.4, hy + 3.9, 4.8, 2.1, 1.1);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // re-contorno de la cabeza sobre el clip
    ctx.beginPath();
    ctx.arc(0, hy, headR, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.tinta;
    ctx.stroke();
  }
}

// probador del ropero: pedazo de rama de fondo + figura en reposo con lo elegido
export function drawProbador(ctx, w, h, t, cos) {
  ctx.clearRect(0, 0, w, h);
  const bw = w * 0.58;
  ctx.beginPath();
  ctx.roundRect((w - bw) / 2, -14, bw, h + 28, 26);
  ctx.fillStyle = C.verde;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = C.tinta;
  ctx.stroke();
  // estrías de corteza
  ctx.strokeStyle = C.musgo;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  for (const [ex, ey, el] of [[-0.15, 0.1, 14], [0.13, 0.26, 18], [-0.09, 0.52, 12], [0.16, 0.7, 15], [-0.04, 0.86, 16]]) {
    ctx.beginPath();
    ctx.moveTo(w / 2 + ex * w, h * ey);
    ctx.lineTo(w / 2 + ex * w + 3, h * ey + el);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(w / 2, h * 0.64);
  const s = h / 118;
  ctx.scale(s, s);
  drawFigure(ctx, t, idlePose(t), cos);
  ctx.restore();
}

// icono de cosmético para las cartas del ropero (se dibuja una sola vez)
export function drawCosmeticIcon(ctx, def, size) {
  ctx.save();
  const s = size / 44;
  if (def.slot === 'sombrero') {
    // cabeza de maniquí con el sombrero puesto
    ctx.translate(size / 2, size * 0.63);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
    ctx.fillStyle = C.ocre;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.tinta;
    ctx.stroke();
    drawHat(ctx, def.id, 0, 8.5);
  } else {
    ctx.translate(size / 2, size / 2);
    ctx.scale(s * 1.5, s * 1.5);
    ctx.translate(0, -1.5);
    drawCreci(ctx, 8, 0);
  }
  ctx.restore();
}
