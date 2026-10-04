import { percentile } from '../render/perf';
import { WELCOME_SHOTS } from './welcomeTimeline';

/** One-way degradation, with at least one second of new evidence between decisions. */
export class WelcomeQuality {
  level = 0;
  private frames: { seconds: number; ms: number }[] = [];
  private lastDecision = 0;
  private pending = false;
  private lastSeconds = 0;
  constructor(private log: (message: string) => void = () => {}) {}
  update(seconds: number, frameMs: number, hidden = false) {
    if (!hidden && frameMs > 0 && frameMs < 250) this.frames.push({ seconds, ms: frameMs });
    this.frames = this.frames.filter((frame) => frame.seconds >= seconds - 1);
    if (seconds >= 1 && seconds - this.lastDecision >= 1 && this.frames.length >= 8) {
      this.pending = percentile(this.frames.map((frame) => frame.ms), 0.5) > 22;
    }
    const cut = WELCOME_SHOTS.some((shot) => shot.cut && this.lastSeconds < shot.start && seconds >= shot.start);
    if (this.pending && this.level < 3 && (this.level === 0 || cut)) {
      this.level++;
      this.lastDecision = seconds;
      this.pending = false;
      this.frames = [];
      this.log(`Q${this.level} @ ${seconds.toFixed(2)}s: ${['', 'sparkles off', 'small world at cut', 'lens off / dive at cut'][this.level]}`);
    }
    this.lastSeconds = seconds;
    return this.level;
  }
}
