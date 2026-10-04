import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromList } from '../src/life/engine';
import { encodeFrame, type BakeMessage } from '../src/ui/welcomeBake';
import { WelcomeBake } from '../src/ui/welcomeBakeClient';

class FakeWorker {
  static latest: FakeWorker;
  onmessage: ((event: { data: BakeMessage }) => void) | null = null;
  onerror: ((event: { preventDefault(): void }) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { FakeWorker.latest = this; }
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('streaming welcome bake client', () => {
  it('uses live fallback in vitest and when Workers are unavailable', () => {
    vi.stubGlobal('Worker', undefined);
    const bake = new WelcomeBake(false);
    expect(bake.available).toBe(false);
    expect(bake.get(false, 0)).toBeUndefined();
    bake.destroy();
    vi.stubGlobal('Worker', vi.fn());
    new WelcomeBake(false).destroy();
    expect(Worker).not.toHaveBeenCalled();
  });
  it('accepts partial transfers immediately, reports size, and releases all frames on termination', () => {
    vi.stubEnv('MODE', 'development'); vi.stubGlobal('Worker', FakeWorker);
    const log = vi.fn(), bake = new WelcomeBake(true, log), worker = FakeWorker.latest;
    expect(worker.postMessage).toHaveBeenCalledWith({ preferSmall: true });
    const original = encodeFrame(fromList([[-10, 20], [0, 0]]), 0);
    const transferred = structuredClone(original, { transfer: [original.cells.buffer, original.counts.buffer] });
    expect(original.cells.byteLength).toBe(0);
    worker.onmessage!({ data: { small: true, frame: transferred } });
    expect(bake.get(true, 0)).toBe(transferred);
    expect(bake.get(true, 1)).toBeUndefined();
    worker.onmessage!({ data: { small: true, bytes: 1048576, ms: 123 } });
    expect(log).toHaveBeenCalledWith('bake small: 1.00 MiB, 123 ms');
    bake.destroy(); bake.destroy();
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(bake.get(true, 0)).toBeUndefined();
    worker.onmessage!({ data: { small: true, frame: transferred } });
    expect(bake.get(true, 0)).toBeUndefined();
  });
  it('keeps received frames usable when the worker fails and falls back for missing frames', () => {
    vi.stubEnv('MODE', 'development'); vi.stubGlobal('Worker', FakeWorker);
    const bake = new WelcomeBake(false), worker = FakeWorker.latest;
    const frame = encodeFrame(fromList([[0, 0]]), 0);
    worker.onmessage!({ data: { small: false, frame } });
    const event = { preventDefault: vi.fn() };
    worker.onerror!(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(bake.available).toBe(false);
    expect(bake.get(false, 0)).toBe(frame);
    expect(bake.get(false, 1)).toBeUndefined();
    bake.destroy();
  });
});
