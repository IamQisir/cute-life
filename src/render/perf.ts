/** URL-only instrumentation. Disabled calls do not read a clock or allocate samples. */
export type PerfPart = 'sim/bake playback' | 'clusters' | 'world update' | 'lens' | 'particles' | 'Pixi render';
const PARTS: PerfPart[] = ['sim/bake playback', 'clusters', 'world update', 'lens', 'particles', 'Pixi render'];
export function percentile(values: readonly number[], fraction: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}
class Perf {
  enabled = false;
  private panel: HTMLPreElement | null = null;
  private frames: number[] = [];
  private last = 0;
  private shown = 0;
  private costs = new Map<PerfPart, number>();
  private decisions: string[] = [];
  cells = 0;
  sprites = 0;
  quality = 'sandbox';
  init() {
    this.enabled = new URLSearchParams(location.search).has('perf');
    if (!this.enabled) return;
    this.panel = document.createElement('pre');
    this.panel.style.cssText = 'position:fixed;right:8px;top:8px;z-index:10000;pointer-events:none;margin:0;padding:8px;background:#302a24df;color:#fff;font:11px/1.4 monospace;border-radius:6px';
    document.body.append(this.panel);
  }
  begin(now: number) {
    if (!this.enabled) return;
    const dt = now - this.last;
    if (this.last && dt > 0 && dt < 250 && !document.hidden) {
      this.frames.push(dt);
      if (this.frames.length > 120) this.frames.shift();
    }
    this.last = now;
    this.costs.clear();
    this.sprites = 0;
  }
  start() { return this.enabled ? performance.now() : 0; }
  end(part: PerfPart, start: number) {
    if (this.enabled) this.costs.set(part, (this.costs.get(part) ?? 0) + performance.now() - start);
  }
  log(message: string) {
    if (!this.enabled) return;
    this.decisions.push(message);
    this.decisions = this.decisions.slice(-5);
  }
  finish(now: number) {
    if (!this.enabled || !this.panel || now - this.shown < 250) return;
    this.shown = now;
    const median = percentile(this.frames, 0.5), p95 = percentile(this.frames, 0.95);
    this.panel.textContent = `${median ? (1000 / median).toFixed(0) : '~'} fps  median ${median.toFixed(1)} / p95 ${p95.toFixed(1)} ms\n`
      + PARTS.map((part) => `${part}: ${(this.costs.get(part) ?? 0).toFixed(2)} ms`).join('\n')
      + `\ncells ${this.cells}  sprites ${this.sprites}\nquality ${this.quality}\nCPU timings; world includes clusters\n${this.decisions.join('\n')}`;
  }
}
export const perf = new Perf();
