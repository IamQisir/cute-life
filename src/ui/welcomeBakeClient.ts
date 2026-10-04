import type { BakedFrame, BakeMessage } from './welcomeBake';

/** Immediate start: missing frames use live stepping; later snapshots can resume playback. */
export class WelcomeBake {
  private worker: Worker | null = null;
  private frames = [new Map<number, BakedFrame>(), new Map<number, BakedFrame>()];
  constructor(preferSmall: boolean, private log: (message: string) => void = () => {}) {
    if (typeof Worker === 'undefined' || import.meta.env?.MODE === 'test') return;
    try {
      this.worker = new Worker(new URL('./welcomeBake.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (event: MessageEvent<BakeMessage>) => {
        if (!this.worker) return;
        const message = event.data;
        if ('frame' in message) this.frames[Number(message.small)].set(message.frame.generation, message.frame);
        else this.log(`bake ${message.small ? 'small' : 'full'}: ${(message.bytes / 1048576).toFixed(2)} MiB, ${message.ms.toFixed(0)} ms`);
      };
      this.worker.onerror = (event) => {
        event.preventDefault();
        this.log('worker failed: live fallback for missing frames');
        this.worker?.terminate(); this.worker = null;
      };
      this.worker.postMessage({ preferSmall });
    } catch {
      this.worker?.terminate(); this.worker = null;
      this.log('worker unavailable: live fallback');
    }
  }
  get(small: boolean, generation: number) { return this.frames[Number(small)].get(generation); }
  get available() { return this.worker !== null; }
  destroy() {
    this.worker?.terminate(); this.worker = null;
    this.frames.forEach((frames) => frames.clear());
  }
}
