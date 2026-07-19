// Eventos raros de la rama. Ninguno le quita nada al jugador:
// - Chucao: un pájaro se posa en el borde; tocarlo lo espanta y suelta
//   semillas que dan un bono de hormigas. Si no lo tocás, se va solo.
// - Lluvia: mientras dura, la savia corre al doble pero la corteza se pone
//   resbalosa (más mala suerte y zona dulce apenas más angosta).
// - Niebla: la savia corre ×1,5 y la zona dulce se angosta; nada de mala
//   suerte extra (la niebla no hace resbalar, solo tapa la vista).
// - Enjambre de luciérnagas: nube que orbita junto a la rama; tocarla
//   suelta un bono de hormigas. Se disipa sola si no la tocás.
import { state } from './state.js';

export const branchEvents = {
  cooldown: 30, // primer evento a los ~30 s de sesión
  rain: null, // { t, dur }
  bird: null, // { h, side, t, dur, phase: 'perch' | 'fly', flyT }
  fog: null, // { t, dur }
  swarm: null, // { h, side, t, dur }
  queue: [],

  update(dt) {
    if (this.rain) {
      this.rain.t += dt;
      if (this.rain.t >= this.rain.dur) {
        this.rain = null;
        this.queue.push({ type: 'rain-end' });
        this.cooldown = 40 + Math.random() * 40;
      }
    }
    if (this.bird) {
      const b = this.bird;
      b.t += dt;
      if (b.phase === 'perch' && b.t >= b.dur) {
        b.phase = 'fly';
        b.flyT = 0;
      }
      if (b.phase === 'fly') {
        b.flyT += dt;
        if (b.flyT > 1) {
          this.bird = null;
          this.cooldown = 40 + Math.random() * 40;
        }
      }
    }
    if (this.fog) {
      this.fog.t += dt;
      if (this.fog.t >= this.fog.dur) {
        this.fog = null;
        this.queue.push({ type: 'fog-end' });
        this.cooldown = 40 + Math.random() * 40;
      }
    }
    if (this.swarm) {
      this.swarm.t += dt;
      if (this.swarm.t >= this.swarm.dur) {
        this.swarm = null;
        this.queue.push({ type: 'swarm-end' });
        this.cooldown = 40 + Math.random() * 40;
      }
    }
    if (!this.rain && !this.bird && !this.fog && !this.swarm) {
      this.cooldown -= dt;
      if (this.cooldown <= 0 && state.height > 4) this.spawn();
    }
  },

  spawn() {
    // si la misión activa pide espantar al pájaro, garantizamos que venga
    const wantBird = state.quest && state.quest.id === 'bird';
    let pick = 'bird';
    if (!wantBird) {
      // tabla de pesos; la niebla recién aparece con algo de altura
      const tabla = [['rain', 0.3], ['bird', 0.25], ['swarm', 0.2]];
      if (state.height > 12) tabla.push(['fog', 0.25]);
      const total = tabla.reduce((s, [, w]) => s + w, 0);
      let r = Math.random() * total;
      for (const [id, w] of tabla) {
        r -= w;
        if (r <= 0) {
          pick = id;
          break;
        }
      }
    }
    if (pick === 'rain') {
      this.rain = { t: 0, dur: 18 + Math.random() * 6 };
      this.queue.push({ type: 'rain-start' });
    } else if (pick === 'fog') {
      this.fog = { t: 0, dur: 16 + Math.random() * 8 };
      this.queue.push({ type: 'fog-start' });
    } else if (pick === 'swarm') {
      this.swarm = {
        h: state.height + 2 + Math.random() * 2,
        side: Math.random() < 0.5 ? -1 : 1,
        t: 0,
        dur: 10,
      };
      this.queue.push({ type: 'swarm-spawn' });
    } else {
      this.bird = {
        h: state.height + 2.5 + Math.random() * 2,
        side: Math.random() < 0.5 ? -1 : 1,
        t: 0,
        dur: 12,
        phase: 'perch',
        flyT: 0,
      };
      this.queue.push({ type: 'bird-spawn' });
    }
  },

  tapSwarm() {
    if (this.swarm) {
      this.swarm = null;
      this.cooldown = 40 + Math.random() * 40;
      this.queue.push({ type: 'swarm-tapped' });
    }
  },

  scareBird() {
    if (this.bird && this.bird.phase === 'perch') {
      this.bird.phase = 'fly';
      this.bird.flyT = 0;
      this.queue.push({ type: 'bird-scared' });
    }
  },

  raining() {
    return !!this.rain;
  },
  // envolvente 0→1→0 para que la lluvia entre y salga suave en el render
  rainEnv() {
    if (!this.rain) return 0;
    const { t, dur } = this.rain;
    return Math.max(0, Math.min(1, t / 1.5, (dur - t) / 1.5));
  },
  // envolvente análoga para la niebla
  fogEnv() {
    if (!this.fog) return 0;
    const { t, dur } = this.fog;
    return Math.max(0, Math.min(1, t / 1.5, (dur - t) / 1.5));
  },
  sapMul() {
    return this.rain ? 2 : this.fog ? 1.5 : 1;
  },
  slipBonus() {
    return this.rain ? 0.04 : 0;
  },
  sweetMul() {
    return (this.rain ? 0.92 : 1) * (this.fog ? 0.88 : 1);
  },

  takeEvents() {
    const q = this.queue;
    this.queue = [];
    return q;
  },
};
