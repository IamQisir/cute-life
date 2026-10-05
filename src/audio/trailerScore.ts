// The trailer's score: a list of events on the beat grid (pure, testable),
// and a scheduler that synthesises them with Web Audio. Everything is
// scheduled up front, so offline export and live preview sound the same.
import { at, BEAT, GENESIS_POPS, LETTER_POPS, MONTAGE, TRAILER_SECONDS } from '../ui/trailer';

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);
const C = 60;
export type ScoreLayer = 'music' | 'sfx';
export type ScoreEvent =
  | { t: number; kind: 'kick' | 'clap' | 'hat' | 'boom' | 'impact' | 'heartbeat' | 'braam' | 'crash'; layer: ScoreLayer; gain: number }
  | { t: number; kind: 'pluck' | 'bass'; layer: ScoreLayer; note: number; gain: number }
  | { t: number; kind: 'pad'; layer: ScoreLayer; notes: readonly number[]; end: number; gain: number; bright: number }
  | { t: number; kind: 'whoosh' | 'riser' | 'subdrop'; layer: ScoreLayer; end: number; gain: number };

const ARPS: Record<string, number[]> = {
  C: [C, C + 4, C + 7, C + 12, C + 7, C + 4, C + 7, C + 12],
  G: [C - 1, C + 2, C + 7, C + 11, C + 7, C + 2, C + 7, C + 11],
  Am: [C - 3, C, C + 4, C + 9, C + 5, C + 9, C + 12, C + 9],
};
const CHORDS: Record<string, number[]> = {
  F: [41, 53, 57, 60], G: [43, 55, 59, 62], Am: [45, 57, 60, 64], C: [36, 48, 52, 55, 60],
};

/** Every sound in the trailer, in time order. */
export function trailerScoreEvents(): ScoreEvent[] {
  const e: ScoreEvent[] = [];
  // HOOK: a rising pluck per genesis cell, a held breath, then the boom.
  GENESIS_POPS.forEach((t, i) => e.push({ t, kind: 'pluck', layer: 'sfx', note: [72, 76, 79, 84, 88][i], gain: 0.22 }));
  e.push({ t: at(1), kind: 'boom', layer: 'sfx', gain: 1 });
  // BUILD: pads climb F → G → Am with an opening filter; four on the floor; hats join.
  (['F', 'G', 'Am'] as const).forEach((name, i) => e.push({ t: at(1 + i), kind: 'pad', layer: 'music', notes: CHORDS[name], end: at(2 + i), gain: 0.16, bright: 0.35 + i * 0.25 }));
  for (let beat = 4; beat < 16; beat++) {
    e.push({ t: beat * BEAT, kind: 'kick', layer: 'music', gain: 0.7 + (beat >= 12 ? 0.15 : 0) });
    if (beat >= 8) e.push({ t: (beat + 0.5) * BEAT, kind: 'hat', layer: 'music', gain: 0.18 });
    e.push({ t: beat * BEAT, kind: 'pluck', layer: 'music', note: [72, 76, 79, 84][beat % 4] + (beat >= 12 ? 2 : 0), gain: 0.1 });
  }
  // DROP: the beat falls away under a riser, an eighth of silence, then the impact.
  e.push({ t: at(4), kind: 'riser', layer: 'sfx', end: at(4, 3.5), gain: 0.32 });
  e.push({ t: at(4), kind: 'pad', layer: 'music', notes: CHORDS.G, end: at(4, 3.5), gain: 0.12, bright: 1 });
  e.push({ t: at(5), kind: 'impact', layer: 'sfx', gain: 1 });
  e.push({ t: at(5), kind: 'subdrop', layer: 'sfx', end: at(5) + 1.6, gain: 0.8 });
  e.push({ t: at(5), kind: 'crash', layer: 'sfx', gain: 0.5 });
  // MONTAGE: C → G → Am with kick, backbeat clap, hats, bass and a music-box arpeggio.
  (['C', 'G', 'Am'] as const).forEach((name, i) => {
    const bar = 5 + i;
    e.push({ t: at(bar), kind: 'pad', layer: 'music', notes: CHORDS[name === 'C' ? 'C' : name], end: at(bar + 1), gain: 0.13, bright: 0.8 });
    for (let b = 0; b < 4; b++) {
      e.push({ t: at(bar, b), kind: 'kick', layer: 'music', gain: 0.85 });
      if (b % 2 === 1) e.push({ t: at(bar, b), kind: 'clap', layer: 'music', gain: 0.35 });
    }
    for (let q = 0; q < 8; q++) {
      e.push({ t: at(bar, q / 2), kind: 'hat', layer: 'music', gain: q % 2 ? 0.2 : 0.12 });
      e.push({ t: at(bar, q / 2), kind: 'bass', layer: 'music', note: (CHORDS[name === 'C' ? 'C' : name][0] % 12) + 36, gain: 0.32 });
      e.push({ t: at(bar, q / 2), kind: 'pluck', layer: 'music', note: ARPS[name][q] + 12, gain: 0.12 });
    }
  });
  // Every montage cut (and the cut into the hush) gets a whoosh that lands on it.
  for (const cut of [...MONTAGE.slice(1).map((m) => m.start), at(8)]) e.push({ t: cut - BEAT * 0.75, kind: 'whoosh', layer: 'sfx', end: cut, gain: 0.22 });
  // HUSH: only a heartbeat, then a long reverse swell into the slam.
  e.push({ t: at(8), kind: 'heartbeat', layer: 'sfx', gain: 0.6 });
  e.push({ t: at(8, 1), kind: 'heartbeat', layer: 'sfx', gain: 0.45 });
  e.push({ t: at(8, 1), kind: 'whoosh', layer: 'sfx', end: at(8, 2), gain: 0.3 });
  // SLAM: braam and boom; each letter pops with a rising note.
  e.push({ t: at(8, 2), kind: 'braam', layer: 'music', gain: 0.55 });
  e.push({ t: at(8, 2), kind: 'boom', layer: 'sfx', gain: 0.9 });
  LETTER_POPS.forEach((t, i) => e.push({ t, kind: 'pluck', layer: 'sfx', note: [72, 74, 76, 79, 81, 84, 86, 88][i], gain: 0.2 }));
  // END: the final hit, a big C chord, a chime, then everything decays.
  e.push({ t: at(9), kind: 'impact', layer: 'sfx', gain: 0.85 });
  e.push({ t: at(9), kind: 'crash', layer: 'sfx', gain: 0.4 });
  e.push({ t: at(9), kind: 'pad', layer: 'music', notes: CHORDS.C, end: TRAILER_SECONDS - 0.2, gain: 0.18, bright: 0.7 });
  [84, 88, 91, 96].forEach((note, i) => e.push({ t: at(9, 1 + i * 0.5), kind: 'pluck', layer: 'music', note, gain: 0.16 }));
  return e.sort((a, b) => a.t - b.t);
}

type Layers = Record<ScoreLayer, boolean>;
export interface ScoreHandle { stop(): void }

/**
 * Schedule the score from trailer time `from` onwards, with trailer time
 * `from` landing at context time `startAt`. Returns a handle that silences it.
 */
export function scheduleTrailerScore(ctx: BaseAudioContext, destination: AudioNode,
  { from = 0, startAt = ctx.currentTime, layers = { music: true, sfx: true } as Layers } = {}): ScoreHandle {
  const sources: AudioScheduledSourceNode[] = [];
  const when = (t: number) => startAt + Math.max(0, t - from);
  // Glue and a limiter so the hits are loud but never clip.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 6; comp.ratio.value = 10; comp.attack.value = 0.003; comp.release.value = 0.2;
  const master = ctx.createGain();
  master.gain.value = 0.82;
  // The last 1.4 s fade to silence with the picture.
  const fadeStart = TRAILER_SECONDS - 1.4;
  if (from < TRAILER_SECONDS) {
    master.gain.setValueAtTime(0.82, when(Math.max(from, fadeStart)));
    master.gain.linearRampToValueAtTime(0.0001, when(TRAILER_SECONDS));
  }
  comp.connect(master).connect(destination);
  // A short room so plucks and hits have a tail.
  const room = ctx.createConvolver();
  room.buffer = impulse(ctx, 1.6);
  const wet = ctx.createGain(); wet.gain.value = 0.22;
  room.connect(wet).connect(comp);
  const bus = (dry = 1, send = 0.4) => {
    const g = ctx.createGain(); g.gain.value = dry; g.connect(comp);
    if (send) { const s = ctx.createGain(); s.gain.value = send; g.connect(s).connect(room); }
    return g;
  };
  const noise = noiseBuffer(ctx, 2.5);
  const play = <T extends AudioScheduledSourceNode>(node: T, t: number, stop: number) => {
    node.start(t); node.stop(stop); sources.push(node); return node;
  };
  const env = (t: number, attack: number, peak: number, decay: number, out: AudioNode) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(out); return g;
  };
  const osc = (type: OscillatorType, f0: number, f1: number, t: number, glide: number, out: AudioNode, length: number, detune = 0) => {
    const o = ctx.createOscillator(); o.type = type; o.detune.value = detune;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + glide);
    o.connect(out); return play(o, t, t + length);
  };
  const noiseHit = (t: number, filter: BiquadFilterType, freq: number, q: number, out: AudioNode, length: number) => {
    const n = ctx.createBufferSource(); n.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = filter; f.frequency.value = freq; f.Q.value = q;
    n.connect(f).connect(out); return play(n, t, t + length);
  };

  for (const ev of trailerScoreEvents()) {
    if (!layers[ev.layer]) continue;
    const end = 'end' in ev ? ev.end : ev.t + 2;
    if (end <= from && ev.t < from) continue;
    if (ev.kind !== 'pad' && ev.t < from - 0.01) continue;
    const t = when(ev.t);
    switch (ev.kind) {
      case 'kick': {
        osc('sine', 150, 42, t, 0.11, env(t, 0.002, ev.gain, 0.32, bus(1, 0)), 0.4);
        noiseHit(t, 'highpass', 3000, 0.7, env(t, 0.001, ev.gain * 0.15, 0.02, bus(1, 0)), 0.05);
        break;
      }
      case 'heartbeat': osc('sine', 80, 40, t, 0.12, env(t, 0.004, ev.gain, 0.28, bus(1, 0.2)), 0.35); break;
      case 'clap': {
        const out = env(t, 0.002, ev.gain, 0.16, bus(1, 0.5));
        for (let i = 0; i < 3; i++) noiseHit(t + i * 0.011, 'bandpass', 1500, 1.4, out, 0.03);
        noiseHit(t + 0.033, 'bandpass', 1300, 1, out, 0.18);
        break;
      }
      case 'hat': noiseHit(t, 'highpass', 7500, 0.8, env(t, 0.001, ev.gain, 0.045, bus(1, 0.1)), 0.06); break;
      case 'boom': case 'impact': {
        osc('sine', 120, 34, t, 0.25, env(t, 0.003, ev.gain, 1.4, bus(1, 0.3)), 1.6);
        noiseHit(t, 'lowpass', ev.kind === 'boom' ? 500 : 1400, 0.8, env(t, 0.002, ev.gain * 0.7, ev.kind === 'boom' ? 0.9 : 0.5, bus(1, 0.6)), 1.2);
        break;
      }
      case 'crash': noiseHit(t, 'highpass', 4500, 0.5, env(t, 0.003, ev.gain, 1.6, bus(0.8, 0.8)), 1.8); break;
      case 'subdrop': osc('sine', 72, 26, t, ev.end - ev.t, env(t, 0.01, ev.gain, ev.end - ev.t, bus(1, 0)), ev.end - ev.t + 0.05); break;
      case 'pluck': {
        // Music-box bell: three partials.
        const out = env(t, 0.004, ev.gain, 0.9, bus(1, 0.6));
        [1, 2, 3.01].forEach((m, i) => {
          const g = ctx.createGain(); g.gain.value = [1, 0.3, 0.1][i]; g.connect(out);
          osc('sine', midi(ev.note) * m, midi(ev.note) * m, t, 0, g, 1);
        });
        break;
      }
      case 'bass': {
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 2;
        f.connect(env(t, 0.004, ev.gain, BEAT * 0.45, bus(1, 0)));
        osc('sawtooth', midi(ev.note), midi(ev.note), t, 0, f, BEAT * 0.5);
        break;
      }
      case 'pad': {
        const start = when(Math.max(ev.t, from)), stop = when(ev.end);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(ev.gain, start + 0.12);
        g.gain.setValueAtTime(ev.gain, Math.max(start + 0.12, stop - 0.25));
        g.gain.exponentialRampToValueAtTime(0.0001, stop + 0.4);
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1;
        f.frequency.setValueAtTime(400 + ev.bright * 600, start);
        f.frequency.exponentialRampToValueAtTime(600 + ev.bright * 2600, stop);
        f.connect(g).connect(bus(0.9, 0.5));
        for (const n of ev.notes) for (const d of [-9, 9]) osc('sawtooth', midi(n), midi(n), start, 0, f, stop - start + 0.45, d);
        break;
      }
      case 'whoosh': case 'riser': {
        const length = ev.end - ev.t;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = ev.kind === 'riser' ? 3 : 1.2;
        f.frequency.setValueAtTime(ev.kind === 'riser' ? 400 : 300, t);
        f.frequency.exponentialRampToValueAtTime(ev.kind === 'riser' ? 6000 : 3200, t + length);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(ev.gain, t + length * 0.95);
        g.gain.linearRampToValueAtTime(0.0001, t + length + 0.02);
        f.connect(g).connect(bus(1, 0.3));
        const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true;
        n.connect(f); play(n, t, t + length + 0.03);
        if (ev.kind === 'riser') osc('sawtooth', 180, 1500, t, length, (() => { const pg = ctx.createGain(); pg.gain.value = 0.18; pg.connect(f); return pg; })(), length + 0.03);
        break;
      }
      case 'braam': {
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3;
        f.frequency.setValueAtTime(140, t);
        f.frequency.exponentialRampToValueAtTime(2600, t + 0.3);
        f.frequency.exponentialRampToValueAtTime(500, t + 2.2);
        f.connect(env(t, 0.03, ev.gain, 2.2, bus(1, 0.5)));
        for (const n of [36, 43, 48]) for (const d of [-14, 0, 14]) osc('sawtooth', midi(n), midi(n), t, 0, f, 2.4, d);
        break;
      }
    }
  }
  return {
    stop() {
      for (const s of sources) { try { s.stop(); } catch { /* Not started or already stopped. */ } }
      master.disconnect();
    },
  };
}

/** Deterministic noise, so export and preview are identical. */
function noiseBuffer(ctx: BaseAudioContext, seconds: number) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 0x2545f491;
  for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; }
  return buffer;
}
function impulse(ctx: BaseAudioContext, seconds: number) {
  const length = Math.ceil(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    let seed = 0x9e3779b9 + c;
    for (let i = 0; i < length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] = (seed / 2147483648 - 1) * (1 - i / length) ** 3;
    }
  }
  return buffer;
}
