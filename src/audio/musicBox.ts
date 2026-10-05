// Births play notes from a pentatonic scale chosen by position, so repeating
// patterns play repeating melodies. Notes are not played per generation: births
// go into a pool and a slow "conductor" plucks at most one note per beat, so the
// melody stays calm however fast the simulation runs. A quiet pad sits underneath.

const SCALE = [0, 2, 4, 7, 9]; // major pentatonic
const ROOT_HZ = 523.25; // C5
const BEAT_MS = 700;
const REST_CHANCE = 0.3;
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

/** 'all' = notes + pad, 'music' = pad only, 'off' = silent. */
export type SoundMode = 'all' | 'music' | 'off';
function savedSoundMode(): SoundMode {
  try {
    const mode = localStorage.getItem('cute-life:sound-mode');
    if (mode === 'all' || mode === 'music' || mode === 'off') return mode;
  } catch { /* Sound controls still work when storage is unavailable. */ }
  return 'all';
}

const NEXT_MODE: Record<SoundMode, SoundMode> = { all: 'music', music: 'off', off: 'all' };

export class MusicBox {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private output: GainNode | null = null;
  private welcomeHeld = false;
  private tap: MediaStreamAudioDestinationNode | null = null;
  private padGain: GainNode | null = null;
  private padTimer = 0;
  private beatTimer = 0;
  private pool: number[] = [];
  private lastNote = 0;
  mode: SoundMode = savedSoundMode();

  get enabled() {
    return this.mode !== 'off';
  }

  private get notesOn() {
    return this.mode === 'all';
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled && !this.welcomeHeld ? 1 : 0;
    // A touch of echo makes single notes feel like a music box in a room.
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.23;
    const fb = ctx.createGain();
    fb.gain.value = 0.25;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    // Everything ends in `out`, which feeds the speakers and the recording tap.
    const out = this.output = ctx.createGain();
    out.connect(ctx.destination);
    this.tap = ctx.createMediaStreamDestination();
    out.connect(this.tap);
    this.master.connect(out);
    this.master.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(out);
    if (!this.welcomeHeld) this.startPad();
    this.beatTimer = window.setInterval(() => this.beat(), BEAT_MS);
  }

  /** Intro owns a separate dry bus; the normal conductor/pad stay quiet. */
  beginWelcome() {
    this.welcomeHeld = true;
    this.pool = [];
    try { this.unlock(); }
    catch { this.welcomeHeld = false; return null; }
    this.master!.gain.cancelScheduledValues(this.ctx!.currentTime);
    this.master!.gain.setValueAtTime(0, this.ctx!.currentTime);
    return {
      context: this.ctx!, output: this.output!,
      release: () => {
        this.welcomeHeld = false;
        this.pool = [];
        this.master!.gain.setTargetAtTime(this.enabled ? 1 : 0, this.ctx!.currentTime, 0.1);
        if (!this.padGain) this.startPad();
      },
    };
  }

  /** The mixed output as a stream, for recording. Null until audio is unlocked. */
  get stream(): MediaStream | null {
    return this.tap?.stream ?? null;
  }

  /** Cycles all -> music only -> off. Returns the new mode. */
  cycleMode(): SoundMode {
    this.mode = NEXT_MODE[this.mode];
    try { localStorage.setItem('cute-life:sound-mode', this.mode); }
    catch { /* Preserve the choice in memory. */ }
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(this.enabled && !this.welcomeHeld ? 1 : 0, this.ctx.currentTime, 0.1);
    }
    this.pool = [];
    return this.mode;
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
    if (!this.ctx || !this.notesOn || points.length === 0) return;
    // Keep only a few recent candidates; the conductor picks from them.
    for (let i = 0; i < 3; i++) {
      const [x, y] = points[Math.floor(Math.random() * points.length)];
      this.pool.push(noteFor(x, y));
    }
    if (this.pool.length > 9) this.pool.splice(0, this.pool.length - 9);
  }

  private beat() {
    if (this.welcomeHeld || !this.ctx || !this.notesOn || this.pool.length === 0) return;
    const pool = this.pool;
    this.pool = [];
    if (Math.random() < REST_CHANCE) return;
    // Prefer a note different from the last one so it sounds like a tune.
    const fresh = pool.filter((f) => f !== this.lastNote);
    const f = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))];
    this.lastNote = f;
    this.bell(f, this.ctx.currentTime, 0.06);
  }

  /** A little arpeggio at the end of a battle: rising if you won, falling if not. */
  fanfare(happy: boolean) {
    if (!this.ctx || !this.notesOn) return;
    const t = this.ctx.currentTime;
    const notes = happy ? [0, 4, 7, 12] : [12, 9, 5, 0];
    notes.forEach((n, i) => this.bell(ROOT_HZ * Math.pow(2, n / 12), t + i * 0.14, 0.08));
  }

  /** Soft bubble pop for placing a cell by hand. */
  pop(x: number, y: number) {
    if (!this.ctx || !this.notesOn) return;
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
    if (!this.ctx || !this.notesOn) return;
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
    clearInterval(this.beatTimer);
    this.ctx?.close();
  }
}
