// Eventos raros de la rama. Ninguno le quita nada al jugador:
// - Chucao: un pájaro se posa en el borde; tocarlo lo espanta y suelta
//   semillas que dan un bono de hormigas. Si no lo tocás, se va solo.
// - Lluvia: mientras dura, la savia corre al doble pero la corteza se pone
//   resbalosa (más mala suerte y zona dulce apenas más angosta).
import { state } from './state.js';

export const branchEvents = {
  cooldown: 30, // primer evento a los ~30 s de sesión
  rain: null, // { t, dur }
  bird: null, // { h, side, t, dur, phase: 'perch' | 'fly', flyT }
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
    if (!this.rain && !this.bird) {
      this.cooldown -= dt;
      if (this.cooldown <= 0 && state.height > 4) this.spawn();
    }
  },

  spawn() {
    // si la misión activa pide espantar al pájaro, garantizamos que venga
    const wantBird = state.quest && state.quest.id === 'bird';
    if (!wantBird && Math.random() < 0.45) {
      this.rain = { t: 0, dur: 18 + Math.random() * 6 };
      this.queue.push({ type: 'rain-start' });
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
  sapMul() {
    return this.rain ? 2 : 1;
  },
  slipBonus() {
    return this.rain ? 0.04 : 0;
  },
  sweetMul() {
    return this.rain ? 0.92 : 1;
  },

  takeEvents() {
    const q = this.queue;
    this.queue = [];
    return q;
  },
};
