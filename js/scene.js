// Render canvas de la escena: rama xilográfica, nudos, escalador, hormigas,
// savia, luciérnagas y el elemento firma — el viento dibujado.
import { state } from './state.js';
import { climb, wind, knotHeight, knotHasSap, hash, MAX_JUMP, PERFECT_W } from './climb.js';

const C = {
  noche: '#131B12',
  verde: '#7FA636',
  musgo: '#43601F',
  savia: '#F0A32A',
  hueso: '#F2E8CE',
  tinta: '#2A1C14',
  ocre: '#C9825A',
  nocheDeep: '#0C120B',
  nocheSoft: '#1A2617',
};

const VISIBLE_M = 9; // metros de rama visibles en pantalla
const CHAR_Y = 0.7; // fracción de pantalla donde vive el personaje

export class Scene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.t = 0;
    this.cameraH = state.height;
    this.shake = 0;
    this.dpr = 1;
    this.strokes = this.makeWindStrokes();
    this.resize();
    window.addEventListener('resize', () => this.resize());
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

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = C.noche;
    ctx.fillRect(0, 0, this.W, this.H);

    ctx.save();
    if (this.shake > 0.01) {
      ctx.translate((Math.random() - 0.5) * 7 * this.shake, (Math.random() - 0.5) * 5 * this.shake);
    }

    this.drawLeafLayer(0.35, C.nocheDeep, 0);
    this.drawLeafLayer(0.65, C.nocheSoft, 40);
    this.drawFireflies();
    this.drawBranch();
    this.drawAnts(view.antRate);
    this.drawChargeOverlays();
    this.drawClimber(h);
    this.drawWind(view.unlocks);
    ctx.restore();

    this.drawVignette();
  }

  // ---------- fondo ----------
  drawLeafLayer(factor, color, seed) {
    const { ctx } = this;
    const hp = this.cameraH * factor;
    const band = 3.2;
    const jMin = Math.floor((hp - (this.H * 0.5) / this.ppm) / band) - 1;
    const jMax = Math.ceil((hp + (this.H * 0.7) / this.ppm) / band) + 1;
    ctx.fillStyle = color;
    for (let j = jMin; j <= jMax; j++) {
      const y = this.H * CHAR_Y - (j * band - hp) * this.ppm;
      for (const side of [0, 1]) {
        const hs = hash(j * 2.3 + side * 7.7 + seed);
        const x = side === 0 ? hs * this.W * 0.14 : this.W - hs * this.W * 0.14;
        const r = 45 + hash(j * 5.1 + side + seed) * 65;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.arc(x + r * 0.55 * (side ? -1 : 1), y + r * 0.4, r * 0.7, 0, Math.PI * 2);
        ctx.arc(x + r * 0.2 * (side ? -1 : 1), y - r * 0.55, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
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
    const step = 0.3;
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
    ctx.fillStyle = C.verde;
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
    ctx.setLineDash([26, 21]);
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
    ctx.setLineDash([]);
    ctx.restore();

    // nudos visibles
    let i = 0;
    for (;;) {
      const kh = knotHeight(i);
      if (kh > top) break;
      if (kh > bot) this.drawKnot(i, kh);
      i++;
      if (i > 5000) break;
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
      ctx.setLineDash([6, 7]);
      ctx.lineDashOffset = -this.t * 16;
      ctx.beginPath();
      ctx.arc(cx, y, r + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (knotHasSap(i)) this.drawSap(cx + r * 0.55, y + r + 7, i);
  }

  drawSap(x, y, seed) {
    const { ctx } = this;
    const pulse = 0.75 + 0.25 * Math.sin(this.t * 1.8 + seed);
    const glow = ctx.createRadialGradient(x, y, 1, x, y, 22);
    glow.addColorStop(0, 'rgba(240,163,42,0.30)');
    glow.addColorStop(1, 'rgba(240,163,42,0)');
    ctx.globalAlpha = pulse;
    ctx.fillStyle = glow;
    ctx.fillRect(x - 22, y - 22, 44, 44);
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
    if (state.unlocks.includes('saltolargo')) {
      const py1 = this.yOf(kh + PERFECT_W);
      const py2 = this.yOf(kh - PERFECT_W);
      ctx.globalAlpha = 0.3 * a;
      ctx.fillRect(bx - this.bw * 0.62, py1, this.bw * 1.24, py2 - py1);
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
    ctx.globalAlpha = 1;
  }

  // ---------- escalador ----------
  drawClimber(h) {
    const { ctx } = this;
    const x = this.branchX(h) - this.bw * 0.02;
    const y = this.yOf(h);
    const pose = this.poseFor();
    ctx.save();
    ctx.translate(x, y);
    const sway = pose.flail ? Math.sin(this.t * 26) * 0.09 : Math.sin(this.t * 1.25) * 0.035;
    ctx.rotate(sway);

    const torso = 30;
    const shW = 11;
    const hipW = 8;
    const { crouch, reach, flail } = pose;
    const hipY = 0;
    const shY = hipY - torso * (1 - crouch * 0.3);

    // piernas
    const footY = hipY + 26 * (1 - crouch * 0.55);
    const kneeX = 10 + crouch * 12;
    const kneeY = hipY + 12 * (1 - crouch * 0.3);
    this.limb(-hipW * 0.6, hipY + 2, -kneeX, kneeY, -6 - crouch * 8, footY, 9);
    this.limb(hipW * 0.6, hipY + 2, kneeX, kneeY, 6 + crouch * 8, footY, 9);

    // torso (vista de espaldas)
    const tp = new Path2D();
    tp.moveTo(-shW, shY);
    tp.quadraticCurveTo(-shW - 1.5, (shY + hipY) / 2, -hipW, hipY + 4);
    tp.lineTo(hipW, hipY + 4);
    tp.quadraticCurveTo(shW + 1.5, (shY + hipY) / 2, shW, shY);
    tp.quadraticCurveTo(0, shY - 5, -shW, shY);
    ctx.fillStyle = C.ocre;
    ctx.fill(tp);
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.tinta;
    ctx.lineJoin = 'round';
    ctx.stroke(tp);

    // taparrabos hueso
    ctx.beginPath();
    ctx.roundRect(-hipW - 3, hipY - 5, (hipW + 3) * 2, 12, 5);
    ctx.fillStyle = C.hueso;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.tinta;
    ctx.stroke();

    // cabeza
    const headR = 8.5;
    ctx.beginPath();
    ctx.arc(0, shY - headR - 2, headR, 0, Math.PI * 2);
    ctx.fillStyle = C.ocre;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.tinta;
    ctx.stroke();

    // brazos por encima (agarrando la rama)
    const wob = flail ? Math.sin(this.t * 25) * 5 : 0;
    const handY = shY - 20 - reach * 13;
    const handX = 12 + reach * 3 + flail * 13;
    const elbX = 15 + flail * 5;
    const elbY = shY - 8 - reach * 6;
    this.limb(-shW, shY + 2, -elbX, elbY, -handX, handY + wob, 8);
    this.limb(shW, shY + 2, elbX, elbY, handX, handY - wob, 8);

    ctx.restore();
  }

  limb(x1, y1, x2, y2, x3, y3, wd) {
    const { ctx } = this;
    const p = new Path2D();
    p.moveTo(x1, y1);
    p.quadraticCurveTo(x2, y2, x3, y3);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = C.tinta;
    ctx.lineWidth = wd + 4.5;
    ctx.stroke(p);
    ctx.strokeStyle = C.ocre;
    ctx.lineWidth = wd;
    ctx.stroke(p);
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
        return { crouch: 0.18 + Math.sin(this.t * 1.1) * 0.04, reach: 0.55, flail: 0 };
    }
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
