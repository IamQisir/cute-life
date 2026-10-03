// Births play notes from a pentatonic scale chosen by position, so repeating
// patterns play repeating melodies. A quiet pad underneath keeps it cosy.

const SCALE = [0, 2, 4, 7, 9]; // major pentatonic
const ROOT_HZ = 523.25; // C5
const MAX_NOTES_PER_STEP = 4;
const PAD_CHORDS = [
  [48, 55, 59, 64], // Cmaj7
  [45, 52, 55, 60], // Am7
  [41, 48, 52, 57], // Fmaj7
  [43, 50, 55, 59], // G
];

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export function noteFor(x: number, y: number): number {
  const i = (((x * 3 + y * 5) % 10) + 10) % 10;
  const octave = Math.floor(i / SCALE.length);
  return ROOT_HZ * Math.pow(2, (SCALE[i % SCALE.length] + 12 * octave) / 12);
}

export class MusicBox {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private padGain: GainNode | null = null;
  private padTimer = 0;
  enabled = true;

  /** Must be called from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 1 : 0;
    // A touch of echo makes single notes feel like a music box in a room.
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.23;
    const fb = ctx.createGain();
    fb.gain.value = 0.25;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    this.master.connect(ctx.destination);
    this.master.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(ctx.destination);
    this.startPad();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.1);
    }
  }

  private bell(freq: number, when: number, gain: number) {
    const ctx = this.ctx!;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(gain, when + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 1.4);
    env.connect(this.master!);
    for (const [mult, amp, type] of [[1, 1, 'sine'], [2, 0.25, 'sine'], [3.01, 0.08, 'triangle']] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq * mult;
      const g = ctx.createGain();
      g.gain.value = amp;
      o.connect(g).connect(env);
      o.start(when);
      o.stop(when + 1.5);
    }
  }

  /** Called once per generation with the newborn cell positions. */
  births(points: [number, number][]) {
    if (!this.ctx || !this.enabled || points.length === 0) return;
    const picked = new Map<number, number>();
    for (const [x, y] of points) {
      const f = noteFor(x, y);
      picked.set(f, (picked.get(f) ?? 0) + 1);
    }
    const freqs = [...picked.keys()].sort((a, b) => a - b).slice(0, MAX_NOTES_PER_STEP);
    const t = this.ctx.currentTime;
    const gain = 0.09 / Math.sqrt(freqs.length);
    freqs.forEach((f, i) => this.bell(f, t + i * 0.045, gain));
  }

  /** Soft bubble pop for placing a cell by hand. */
  pop(x: number, y: number) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.07);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + 0.15);
    this.bell(noteFor(x, y), t + 0.03, 0.05);
  }

  /** Soft descending blip for erasing. */
  poof() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(600, t);
    o.frequency.exponentialRampToValueAtTime(200, t + 0.12);
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + 0.2);
  }

  private startPad() {
    const ctx = this.ctx!;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.035;
    this.padGain.connect(filter).connect(this.master!);
    let i = 0;
    const play = () => {
      const t = ctx.currentTime;
      const dur = 8;
      for (const m of PAD_CHORDS[i++ % PAD_CHORDS.length]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = midiHz(m);
        o.detune.value = (Math.random() - 0.5) * 8;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.25, t + 2.5);
        g.gain.linearRampToValueAtTime(0.25, t + dur - 1);
        g.gain.linearRampToValueAtTime(0, t + dur + 1.5);
        o.connect(g).connect(this.padGain!);
        o.start(t);
        o.stop(t + dur + 2);
      }
    };
    play();
    this.padTimer = window.setInterval(play, 8000);
  }

  dispose() {
    clearInterval(this.padTimer);
    this.ctx?.close();
  }
}
