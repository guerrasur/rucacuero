// Compartir el récord como estampa xilográfica: una tarjeta canvas con el
// lenguaje visual del juego (noche de monte, rama, escalador, savia).
// Usa Web Share API si hay (celular) y si no descarga el PNG.
import { state, fmtAltura } from './state.js';
import { drawFigure, idlePose } from './scene.js';

const C = {
  noche: '#131B12',
  verde: '#7FA636',
  musgo: '#43601F',
  savia: '#F0A32A',
  hueso: '#F2E8CE',
  tinta: '#2A1C14',
  nocheDeep: '#0C120B',
};

function frac(x) {
  return x - Math.floor(x);
}
function hash(i) {
  return frac(Math.sin(i * 127.1 + 311.7) * 43758.5453);
}

// dibuja la estampa completa en un canvas offscreen de 1080×1350 (4:5)
function drawEstampa() {
  const W = 1080;
  const H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');

  // fondo noche + follaje de esquinas
  ctx.fillStyle = C.noche;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.nocheDeep;
  for (const [x, y, r] of [[0, 120, 260], [W, 320, 300], [0, 900, 280], [W, 1120, 320]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // luciérnagas
  ctx.fillStyle = C.savia;
  for (let i = 0; i < 14; i++) {
    ctx.globalAlpha = 0.25 + hash(i * 3.1) * 0.4;
    ctx.beginPath();
    ctx.arc(60 + hash(i * 7.7) * (W - 120), 80 + hash(i * 4.3) * (H - 400), 4 + hash(i) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // la rama cruza en diagonal suave
  ctx.save();
  const bw = 230;
  ctx.beginPath();
  for (let y = -40; y <= H + 40; y += 20) {
    const x = W * 0.5 + Math.sin(y * 0.0035 + 1.7) * 60 - bw / 2 + Math.sin(y * 0.06) * 5;
    if (y === -40) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let y = H + 40; y >= -40; y -= 20) {
    const x = W * 0.5 + Math.sin(y * 0.0035 + 1.7) * 60 + bw / 2 + Math.sin(y * 0.06 + 4.8) * 5;
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = C.verde;
  ctx.fill();
  ctx.lineWidth = 14;
  ctx.strokeStyle = C.tinta;
  ctx.stroke();
  // estrías
  ctx.clip();
  ctx.strokeStyle = C.musgo;
  ctx.lineWidth = 6;
  ctx.setLineDash([60, 48]);
  for (const f of [0.28, 0.55, 0.8]) {
    ctx.beginPath();
    for (let y = -40; y <= H + 40; y += 24) {
      const x = W * 0.5 + Math.sin(y * 0.0035 + 1.7) * 60 - bw / 2 + bw * f + Math.sin(y * 0.02 + f * 9) * 9;
      if (y === -40) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // nudos
  for (const [fy, side] of [[0.2, -1], [0.42, 1], [0.66, -1], [0.86, 1]]) {
    const y = H * fy;
    const x = W * 0.5 + Math.sin(y * 0.0035 + 1.7) * 60 + side * bw * 0.16;
    ctx.beginPath();
    ctx.arc(x, y, 34, 0, Math.PI * 2);
    ctx.fillStyle = C.musgo;
    ctx.fill();
    ctx.lineWidth = 9;
    ctx.strokeStyle = C.tinta;
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, 20, 0.4, 4.6);
    ctx.stroke();
  }
  ctx.restore();

  // gota de savia grande junto al escalador
  const sx = W * 0.5 + 150;
  const sy = H * 0.34;
  ctx.beginPath();
  ctx.moveTo(sx, sy - 26);
  ctx.bezierCurveTo(sx + 21, sy - 4, sx + 17, sy + 19, sx, sy + 21);
  ctx.bezierCurveTo(sx - 17, sy + 19, sx - 21, sy - 4, sx, sy - 26);
  ctx.fillStyle = C.savia;
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = C.tinta;
  ctx.stroke();

  // el escalador con lo puesto, grandote sobre la rama
  ctx.save();
  ctx.translate(W * 0.5 - 10, H * 0.45);
  ctx.scale(3.4, 3.4);
  drawFigure(ctx, 1.2, idlePose(1.2), state.cosmetics);
  ctx.restore();

  // marco doble de estampa
  ctx.strokeStyle = C.hueso;
  ctx.lineWidth = 8;
  ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.lineWidth = 3;
  ctx.strokeRect(58, 58, W - 116, H - 116);

  // panel de tinta abajo con el récord
  const py = H - 420;
  ctx.fillStyle = 'rgba(42,28,20,0.88)';
  ctx.beginPath();
  ctx.roundRect(90, py, W - 180, 300, 26);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = C.hueso;
  ctx.stroke();

  const best = Math.max(state.zen.best, state.carrera.best, state.bestHeight);
  const rec = fmtAltura(best, 1);
  ctx.textAlign = 'center';
  ctx.fillStyle = C.hueso;
  ctx.font = '52px Chango, Georgia, serif';
  ctx.fillText('RUCA CUERO', W / 2, py + 80);
  ctx.fillStyle = C.savia;
  ctx.font = '110px Chango, Georgia, serif';
  ctx.fillText(rec, W / 2, py + 200);
  ctx.fillStyle = C.hueso;
  ctx.globalAlpha = 0.8;
  ctx.font = '34px Bricolage Grotesque, system-ui, sans-serif';
  ctx.fillText('mi récord trepando la rama del monte', W / 2, py + 258);
  ctx.globalAlpha = 1;

  // trazos de viento como firma
  ctx.strokeStyle = C.hueso;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (const [y0, s] of [[150, 1], [210, 0.7]]) {
    ctx.beginPath();
    ctx.moveTo(110, y0);
    ctx.bezierCurveTo(110 + 90 * s, y0 - 26 * s, 110 + 180 * s, y0 + 22 * s, 110 + 280 * s, y0);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return cv;
}

// comparte (o descarga) la estampa; devuelve una promesa por si la UI espera
export async function compartirRecord() {
  const cv = drawEstampa();
  const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
  if (!blob) return false;
  const file = new File([blob], 'ruca-cuero-record.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Ruca Cuero' });
      return true;
    } catch {
      /* cancelado por el usuario: no descargamos encima */
      return false;
    }
  }
  // sin Web Share (desktop): descarga directa
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ruca-cuero-record.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
