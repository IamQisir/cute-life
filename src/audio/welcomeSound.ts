import { keyX, keyY } from '../life/engine';
import { SHOWCASE_GUNS, WELCOME_PRE_ADVANCE } from '../ui/welcomeScene';
import { WELCOME_FINALE, WELCOME_ZOOM_END } from '../ui/welcomeTimeline';
import { MusicBox, noteFor, type SoundMode } from './musicBox';

export function welcomeLayers(mode: SoundMode) {
  return { pad: mode !== 'off', notes: mode !== 'off', chime: mode !== 'off', sfx: mode === 'all' };
}

/** (previous, current] avoids duplicate ticks and supports dropped generations. */
export function welcomeGunTicks(previous: number, current: number, guns: readonly { period: number; phase: number }[] = SHOWCASE_GUNS) {
  const ticks: { generation: number; gun: number }[] = [];
  guns.forEach(({ period, phase }, gun) => {
    const first = previous + 1 + ((-(previous + 1 + phase) % period) + period) % period;
    for (let generation = first; generation <= current; generation += period) ticks.push({ generation, gun });
  });
  return ticks.sort((a, b) => a.generation - b.generation || a.gun - b.gun);
}

// C → G → Am → F, resolving to C with the final pull-back.
export const SCORE_CHORDS = [
  [130.81, 164.81, 196], [98, 123.47, 146.83], [110, 130.81, 164.81],
  [87.31, 110, 130.81], [130.81, 164.81, 196, 261.63],
] as const;
export function welcomeScore(seconds: number) {
  return {
    chord: seconds < 6 ? 0 : seconds < 8 ? 1 : seconds < 10.5 ? 2 : seconds < 13.5 ? 3 : 4,
    beat: seconds >= 2.5 && seconds < 13.5 ? Math.floor((seconds - 2.5) / 0.6) : -1,
    births: seconds >= 10.5 && seconds < 13.5,
  };
}

type Source = OscillatorNode | AudioBufferSourceNode;
type Voice = { sources: Source[]; nodes: AudioNode[]; end: number };

/** All intro sources and routing nodes belong to this bus, including bell tails. */
export class WelcomeSound {
  private lease: ReturnType<MusicBox['beginWelcome']>;
  private bus: GainNode | null = null;
  private music: GainNode | null = null;
  private effects: GainNode | null = null;
  private voices: Voice[] = [];
  private pad: GainNode | null = null;
  private previousTime = 0;
  private previousGeneration = WELCOME_PRE_ADVANCE;
  private nextNote = 10.5;
  private previousBeat = -1;
  private finished = false;
  private tailTimer = 0;

  constructor(private audio: MusicBox, private reduced: boolean) {
    this.lease = audio.beginWelcome();
    if (!this.lease) return;
    const ctx = this.lease.context;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.48;
    this.bus.connect(this.lease.output);
    this.music = ctx.createGain();
    this.effects = ctx.createGain();
    this.music.connect(this.bus);
    this.effects.connect(this.bus);
    this.syncMode();
    if (!reduced) this.drone([130.81, 164.81, 196], 2.5);
  }

  syncMode() {
    if (!this.lease) return;
    const t = this.lease.context.currentTime;
    const layers = welcomeLayers(this.audio.mode);
    this.music?.gain.setTargetAtTime(layers.notes ? 1 : 0, t, 0.025);
    this.effects?.gain.setTargetAtTime(layers.sfx ? 1 : 0, t, 0.025);
  }

  private retain(sources: Source[], nodes: AudioNode[], duration: number) {
    this.voices.push({ sources, nodes, end: this.lease!.context.currentTime + duration });
  }

  private clearVoices(all = false) {
    const now = this.lease?.context.currentTime ?? 0;
    this.voices = this.voices.filter((voice) => {
      if (!all && voice.end > now) return true;
      for (const source of voice.sources) { try { source.stop(); } catch { /* Already stopped. */ } }
      for (const node of [...voice.sources, ...voice.nodes]) node.disconnect();
      return false;
    });
  }

  private drone(chord: readonly number[], duration: number, swell = false) {
    const ctx = this.lease!.context, t = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 580;
    if (this.pad) {
      this.pad.gain.cancelScheduledValues(t);
      this.pad.gain.setTargetAtTime(0, t, 0.18);
    }
    const env = this.pad = ctx.createGain();
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(swell ? 0.09 : 0.045, t + (swell ? 1.5 : 0.45));
    env.gain.linearRampToValueAtTime(0, t + duration);
    env.connect(filter).connect(this.music!);
    const sources = chord.flatMap((frequency) => [-5, 5].map((detune) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = 'triangle'; oscillator.frequency.value = frequency; oscillator.detune.value = detune;
      oscillator.connect(env); oscillator.start(t); oscillator.stop(t + duration);
      return oscillator;
    }));
    this.retain(sources, [env, filter], duration + 0.03);
  }

  private bell(frequency: number, gain: number, output = this.music!, duration = 1.6) {
    const ctx = this.lease!.context, t = ctx.currentTime;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(gain, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    env.connect(output);
    const partials: GainNode[] = [];
    const sources = [1, 2, 3.01].map((multiple, i) => {
      const oscillator = ctx.createOscillator(), partial = ctx.createGain();
      oscillator.frequency.value = frequency * multiple; partial.gain.value = [1, 0.24, 0.075][i];
      oscillator.connect(partial).connect(env); partials.push(partial);
      oscillator.start(t); oscillator.stop(t + duration + 0.02);
      return oscillator;
    });
    this.retain(sources, [env, ...partials], duration + 0.03);
  }

  private whoosh(duration: number) {
    const ctx = this.lease!.context, t = ctx.currentTime;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(), pitch = ctx.createOscillator();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter(), env = ctx.createGain(), pitchGain = ctx.createGain();
    filter.type = 'bandpass'; filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(280, t); filter.frequency.exponentialRampToValueAtTime(2400, t + duration);
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.13, t + duration * 0.8);
    env.gain.linearRampToValueAtTime(0, t + duration);
    pitch.frequency.setValueAtTime(160, t); pitch.frequency.exponentialRampToValueAtTime(740, t + duration);
    pitchGain.gain.value = 0.12;
    noise.connect(filter); pitch.connect(pitchGain).connect(filter); filter.connect(env).connect(this.effects!);
    noise.start(t); pitch.start(t); noise.stop(t + duration); pitch.stop(t + duration);
    this.retain([noise, pitch], [filter, env, pitchGain], duration + 0.03);
  }

  private pulse() {
    const ctx = this.lease!.context, t = ctx.currentTime;
    const oscillator = ctx.createOscillator(), env = ctx.createGain();
    oscillator.frequency.setValueAtTime(92, t);
    oscillator.frequency.exponentialRampToValueAtTime(38, t + 0.16);
    env.gain.setValueAtTime(0.1, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    oscillator.connect(env).connect(this.music!);
    oscillator.start(t); oscillator.stop(t + 0.24);
    this.retain([oscillator], [env], 0.25);
  }

  update(seconds: number, generation: number, births: number[], gunCount: number = SHOWCASE_GUNS.length) {
    if (!this.lease || this.finished || this.reduced) return;
    this.clearVoices();
    this.syncMode();
    const layers = welcomeLayers(this.audio.mode);
    const score = welcomeScore(seconds);
    if (seconds >= 2.5 && seconds < WELCOME_FINALE && layers.sfx) {
      for (const tick of welcomeGunTicks(this.previousGeneration, generation, SHOWCASE_GUNS.slice(0, gunCount)).slice(-2)) {
        this.bell(220 + tick.gun * 55, 0.035, this.effects!, 0.085);
      }
    }
    for (const cue of [1.25, 6, 8, WELCOME_FINALE]) {
      if (this.previousTime < cue && seconds >= cue && seconds - cue < 0.5) this.whoosh(cue === WELCOME_FINALE ? 1.5 : 0.35);
    }
    const previous = welcomeScore(this.previousTime);
    if ((this.previousTime < 2.5 && seconds >= 2.5) || score.chord !== previous.chord) this.drone(SCORE_CHORDS[score.chord], score.chord === 4 ? 2.5 : 3.5, score.chord === 4);
    if (score.beat >= 0 && score.beat !== this.previousBeat && seconds < WELCOME_FINALE) this.pulse();
    this.previousBeat = score.beat;
    if (this.previousTime < 15.4 && seconds >= 15.4) {
      [523.25, 659.25, 783.99].forEach((frequency) => this.bell(frequency, 0.04));
    }
    if (seconds >= WELCOME_ZOOM_END && seconds < WELCOME_FINALE && seconds >= this.nextNote && births.length && layers.notes) {
      const key = births[generation % births.length];
      this.bell(noteFor(keyX(key), keyY(key)), 0.075);
      this.nextNote = seconds + 0.3;
    }
    this.previousGeneration = generation;
    this.previousTime = seconds;
  }

  /** Remove the pad/whoosh immediately; only the final chime may ring on the card. */
  finish() {
    if (this.finished) return;
    this.finished = true;
    this.clearVoices(true);
    if (this.lease && welcomeLayers(this.audio.mode).chime) {
      this.bell(this.reduced ? 659.25 : 783.99, this.reduced ? 0.055 : 0.1);
      this.tailTimer = window.setTimeout(() => {
        this.clearVoices(true);
        this.disconnectBus();
      }, 1800);
    } else this.disconnectBus();
  }

  private disconnectBus() {
    this.music?.disconnect(); this.effects?.disconnect(); this.bus?.disconnect();
  }

  dispose() {
    clearTimeout(this.tailTimer);
    this.clearVoices(true);
    this.disconnectBus();
    this.lease?.release(); this.lease = null;
  }
}
