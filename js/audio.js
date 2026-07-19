// Sonido procedural con WebAudio, sin assets: golpes secos de agarre,
// resbalones, viento de ruido filtrado y campanitas de savia.
let ac = null;
let master = null;
let noiseBuf = null;
let chargeOsc = null;
let chargeGain = null;
let muted = false;

try {
  muted = localStorage.getItem('rucacuero_muted') === '1';
} catch {
  /* sin storage: arranca con sonido */
}

export function isMuted() {
  return muted;
}

export function setMuted(m) {
  muted = m;
  try {
    localStorage.setItem('rucacuero_muted', m ? '1' : '0');
  } catch {
    /* no persiste, pero silencia igual */
  }
  if (master) master.gain.value = m ? 0 : 0.5;
  if (m) {
    chargeEnd();
    rainStop();
  }
}

// Debe llamarse desde un gesto del usuario (política de autoplay).
export function ensure() {
  if (ac) {
    if (ac.state === 'suspended') ac.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ac.destination);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  ambientEnsure();
}

// ---------- ambiente del monte de noche ----------
// Pad de viento grave siempre presente (muy sutil) + trenes de grillos.
// Cuelga de master, así el mute existente lo silencia sin código extra.
const AMB_BASE = 0.018;
let ambGain = null;
let cricketTimer = 2;

function ambientEnsure() {
  if (!ac || ambGain) return;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 180;
  ambGain = ac.createGain();
  ambGain.gain.value = 0;
  src.connect(f).connect(ambGain).connect(master);
  src.start();
}

// Llamada una vez por frame desde el loop principal.
export function ambientUpdate(dt, ctxInfo = {}) {
  if (!ac || !ambGain) return;
  let target = AMB_BASE;
  if (ctxInfo.raining) target = 0; // la lluvia ocupa ese espacio sonoro
  else if (ctxInfo.foggy) target *= 1.4; // con niebla el viento "se siente" más
  else if (ctxInfo.gusting) target *= 0.6; // la ráfaga ya tiene su propio sonido
  const cur = ambGain.gain.value;
  ambGain.gain.value = cur + (target - cur) * Math.min(1, dt * 2);

  cricketTimer -= dt;
  if (cricketTimer <= 0) {
    cricketTimer = 1.5 + Math.random() * 2.5;
    if (!muted && !ctxInfo.raining) {
      const n = 3 + Math.floor(Math.random() * 3);
      const base = 4200 + Math.random() * 600;
      for (let i = 0; i < n; i++) {
        setTimeout(() => blip(base, 'sine', 0.015, 0.03), i * 70);
      }
    }
  }
}

function env(g, t0, attack, peak, decay) {
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
}

function blip(freq, type, peak, decay, glideTo) {
  if (!ac || muted) return;
  const t = ac.currentTime;
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + decay);
  const g = ac.createGain();
  env(g, t, 0.005, peak, decay);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + decay + 0.05);
}

function noise(peak, decay, fc, q = 1, glideFc) {
  if (!ac || muted) return;
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(fc, t);
  if (glideFc) f.frequency.exponentialRampToValueAtTime(glideFc, t + decay);
  f.Q.value = q;
  const g = ac.createGain();
  env(g, t, 0.01, peak, decay);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + decay + 0.1);
}

export function grab() {
  noise(0.4, 0.1, 900, 1.2);
  blip(95, 'sine', 0.5, 0.16, 55);
}

export function perfect() {
  blip(660, 'triangle', 0.28, 0.22);
  setTimeout(() => blip(880, 'triangle', 0.28, 0.3), 90);
}

export function resin() {
  blip(500, 'sine', 0.24, 0.35, 640);
}

export function slip() {
  blip(280, 'sawtooth', 0.2, 0.4, 85);
  noise(0.28, 0.35, 520, 0.8, 180);
}

export function buy() {
  blip(760, 'square', 0.1, 0.07);
  blip(1140, 'square', 0.06, 0.05);
}

export function unlockChime() {
  [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 'triangle', 0.22, 0.4), i * 110));
}

export function zoneFanfare() {
  blip(392, 'triangle', 0.22, 0.3);
  setTimeout(() => blip(523, 'triangle', 0.22, 0.45), 140);
}

export function gust(dur = 2.2) {
  if (!ac || muted) return;
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(320, t);
  f.frequency.linearRampToValueAtTime(520, t + dur * 0.4);
  f.frequency.linearRampToValueAtTime(300, t + dur);
  f.Q.value = 0.6;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.2, t + dur * 0.35);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.1);
}

// Destello del enjambre de luciérnagas: arpegio corto y brillante.
export function shimmer() {
  [880, 1175, 1568].forEach((f, i) => setTimeout(() => blip(f, 'triangle', 0.12, 0.18), i * 70));
}

// Chirrido corto del chucao.
export function chirp() {
  blip(1300, 'sine', 0.14, 0.08, 1750);
  setTimeout(() => blip(1550, 'sine', 0.11, 0.09, 1100), 110);
}

export function questDone() {
  blip(587, 'triangle', 0.22, 0.25);
  setTimeout(() => blip(880, 'triangle', 0.22, 0.35), 120);
}

// Lluvia: ruido en loop con entrada y salida suaves.
let rainSrc = null;
let rainGain = null;

export function rainStart() {
  if (!ac || muted || rainSrc) return;
  const t = ac.currentTime;
  rainSrc = ac.createBufferSource();
  rainSrc.buffer = noiseBuf;
  rainSrc.loop = true;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 850;
  rainGain = ac.createGain();
  rainGain.gain.setValueAtTime(0, t);
  rainGain.gain.linearRampToValueAtTime(0.05, t + 1.5);
  rainSrc.connect(f).connect(rainGain).connect(master);
  rainSrc.start(t);
}

export function rainStop() {
  if (!rainSrc) return;
  const t = ac.currentTime;
  rainGain.gain.cancelScheduledValues(t);
  rainGain.gain.setValueAtTime(rainGain.gain.value, t);
  rainGain.gain.linearRampToValueAtTime(0.0001, t + 1);
  rainSrc.stop(t + 1.1);
  rainSrc = null;
  rainGain = null;
}

// Zumbido sutil que sube de tono con la carga del salto.
export function chargeUpdate(power) {
  if (!ac || muted) return;
  if (!chargeOsc) {
    chargeOsc = ac.createOscillator();
    chargeOsc.type = 'sine';
    chargeGain = ac.createGain();
    chargeGain.gain.value = 0.045;
    chargeOsc.connect(chargeGain).connect(master);
    chargeOsc.start();
  }
  chargeOsc.frequency.value = 150 + power * 230;
}

export function chargeEnd() {
  if (chargeOsc) {
    try {
      chargeOsc.stop();
    } catch {
      /* ya detenido */
    }
    chargeOsc.disconnect();
    chargeOsc = null;
    chargeGain = null;
  }
}
