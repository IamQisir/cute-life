import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Container, Renderer } from 'pixi.js';
import type { MusicBox } from '../src/audio/musicBox';
import { Camera } from '../src/render/camera';
import type { WorldView } from '../src/render/world';
import { Sim } from '../src/sim';
import { WelcomeShow } from '../src/ui/welcomeShow';

const spies = vi.hoisted(() => ({
  soundStart: vi.fn(), soundFinish: vi.fn(), soundStop: vi.fn(), syncMode: vi.fn(),
  lensStart: vi.fn(), lensStop: vi.fn(), creatureFail: false,
}));
vi.mock('../src/audio/welcomeSound', () => ({ WelcomeSound: class {
  constructor(...args: unknown[]) { spies.soundStart(...args); }
  update() {}
  finish() { spies.soundFinish(); }
  dispose() { spies.soundStop(); }
  syncMode() { spies.syncMode(); }
} }));
vi.mock('../src/ui/welcomeLens', () => ({ WelcomeLens: class {
  constructor() { spies.lensStart(); }
  update() {}
  destroy() { spies.lensStop(); }
} }));

vi.mock('../src/ui/welcomeCast', () => ({
  WELCOME_MOODS: [
    { label: 'lives on', rule: '2 or 3 ~ lives on' }, { label: 'lonely', rule: 'fewer than 2 ~ lonely' },
    { label: 'crowded', rule: 'more than 3 ~ crowded' }, { label: 'a new cell is born', rule: 'exactly 3 ~ a new cell' },
  ],
  welcomeFace: () => document.createElement('canvas'), welcomeCreature: () => {
    if (spies.creatureFail) throw new Error('No renderer extraction');
    return document.createElement('canvas');
  },
}));
vi.mock('../src/ui/welcomeParticles', () => ({ WelcomeParticles: class { update() {} destroy() {} } }));

// Minimal event/focus DOM for testing modal ownership without a browser dependency.
type TestEvent = { target: FakeElement; key?: string; code?: string; repeat?: boolean; shiftKey?: boolean; stopped?: boolean; preventDefault: ReturnType<typeof vi.fn>; stopPropagation(): void };
let activeElement: FakeElement | null;
class FakeElement {
  children: FakeElement[] = [];
  parent: FakeElement | null = null;
  className = '';
  textContent = '';
  id = '';
  hidden = false;
  inert = false;
  style: Record<string, string> = {};
  attrs = new Map<string, string>();
  listeners = new Map<string, ((event: TestEvent) => void)[]>();
  constructor(readonly tag: string) {}
  classList = {
    add: (...names: string[]) => { this.className = [...new Set([...this.className.split(' '), ...names])].join(' '); },
    remove: (...names: string[]) => { this.className = this.className.split(' ').filter((name) => !names.includes(name)).join(' '); },
    contains: (name: string) => this.className.split(' ').includes(name),
  };
  get isConnected(): boolean { return this.tag === 'body' || Boolean(this.parent?.isConnected); }
  setAttribute(key: string, value: string) { this.attrs.set(key, value); }
  append(...children: FakeElement[]) { for (const child of children) { child.remove(); child.parent = this; this.children.push(child); } }
  replaceChildren(...children: FakeElement[]) { for (const child of [...this.children]) child.remove(); this.append(...children); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this); this.parent = null; }
  focus() { activeElement = this; }
  querySelectorAll(selector: string): FakeElement[] {
    return this.children.flatMap((child) => [...(child.tag === selector ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector: string) { return this.querySelectorAll(selector)[0]; }
  closest(selector: string): FakeElement | null { return this.tag === selector ? this : this.parent?.closest(selector) ?? null; }
  addEventListener(type: string, listener: (event: TestEvent) => void) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
  dispatch(type: string, event: TestEvent) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    if (!event.stopped) this.parent?.dispatch(type, event);
  }
  click() { this.dispatch('click', event(this)); }
}
function event(target: FakeElement, key?: string): TestEvent {
  return { target, key, code: key === ' ' ? 'Space' : key, repeat: false,
    preventDefault: vi.fn(), stopPropagation() { this.stopped = true; } };
}
function fixture(reduced = false, coarse = false) {
  const body = new FakeElement('body'), hud = new FakeElement('div'), stage = new FakeElement('div');
  body.append(hud, stage); hud.focus();
  const listeners = new Map<string, ((event: TestEvent) => void)[]>();
  vi.stubGlobal('Element', FakeElement); vi.stubGlobal('HTMLElement', FakeElement);
  vi.stubGlobal('document', {
    body, hidden: false, get activeElement() { return activeElement; },
    createElement: (tag: string) => new FakeElement(tag), createElementNS: (_ns: string, tag: string) => new FakeElement(tag),
    querySelectorAll: () => [hud, stage],
    addEventListener: (type: string, listener: (event: TestEvent) => void) => listeners.set(type, [...(listeners.get(type) ?? []), listener]),
  });
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduced-motion') ? reduced : coarse }));
  vi.stubGlobal('window', { setTimeout });
  const sim = new Sim(), cam = new Camera();
  sim.addMany([[1, 1], [2, 1], [3, 1]], 0);
  Object.assign(cam, { w: 1280, h: 800, x: 3, y: 5, zoom: 28 });
  const cells = sim.cells;
  let playing = true, following = true;
  const done = vi.fn(), soundChanged = vi.fn();
  const audio = { mode: 'all', enabled: true, cycleMode: vi.fn(() => { audio.mode = 'music'; }) };
  const show = new WelcomeShow({ sim, cam, playing: () => playing, following: () => following,
    setPlaying: (on) => { playing = on; }, setFollowing: (on) => { following = on; }, refreshStatus: vi.fn(),
  }, { stage: {} as Container, renderer: {} as Renderer, view: {} as WorldView, audio: audio as unknown as MusicBox, soundChanged });
  show.start(done);
  const button = (text: string) => {
    const found = body.querySelectorAll('button').find((button) => button.textContent === text);
    if (!found) throw new Error(`Missing button: ${text}`);
    return found;
  };
  const key = (key: string, type = 'keydown') => {
    const e = event(activeElement!, key);
    listeners.get(type)?.forEach((listener) => listener(e));
    return e;
  };
  return { show, sim, cam, cells, body, hud, stage, done, button, key, audio, soundChanged,
    state: () => ({ playing, following }) };
}

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); spies.creatureFail = false; });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('welcome modal flow', () => {
  it('runs a silent live creature scene behind the descriptive gate', () => {
    const f = fixture();
    f.show.update(50000);
    expect(spies.soundStart).not.toHaveBeenCalled();
    expect(f.sim.generation).toBeGreaterThan(120);
    expect(f.state()).toEqual({ playing: false, following: false });
    expect(f.hud.inert && f.stage.inert).toBe(true);
    expect(activeElement).toBe(f.button('▶ tap to begin'));
    expect(f.body.querySelectorAll('canvas')).toHaveLength(7);
  });

  it('keeps the title usable when GPU portraits cannot be extracted', () => {
    spies.creatureFail = true;
    const f = fixture();
    expect(f.body.querySelectorAll('p').map((p) => p.textContent)).toContain('meet the creatures swimming behind the title ~');
    expect(f.body.querySelectorAll('canvas')).toHaveLength(4);
    expect(activeElement).toBe(f.button('▶ tap to begin'));
  });

  it('freezes the title canvas for reduced motion and resets genesis after a long gate visit', () => {
    const staticGate = fixture(true);
    const cells = staticGate.sim.cells;
    staticGate.show.update(50000);
    expect(staticGate.sim.cells).toBe(cells);
    expect(staticGate.show.renderTime(1000)).toBe(staticGate.show.renderTime(2000));
    staticGate.button('skip').click(); staticGate.button('let me play').click(); vi.runAllTimers();
    const live = fixture();
    live.show.update(30000);
    const gateCells = live.sim.cells;
    live.button('▶ tap to begin').click();
    expect(live.sim.cells).not.toBe(gateCells);
    expect(live.sim.generation).toBe(120);
    expect(live.cam.zoom).toBe(44);
  });

  it.each(['Escape', 'skip'])('gate %s offers choices without unlocking sound, then restores the untouched game', (action) => {
    const f = fixture();
    if (action === 'skip') f.button('skip').click(); else f.key(action);
    expect(f.show.active).toBe(true);
    f.button('let me play').click();
    vi.runAllTimers();
    expect(f.done).toHaveBeenCalledWith(false);
    expect(spies.soundStart).not.toHaveBeenCalled();
    expect(f.sim.cells).toBe(f.cells);
    expect(f.cam).toMatchObject({ x: 3, y: 5, zoom: 28 });
    expect(f.state()).toEqual({ playing: true, following: true });
    expect(f.show.active || f.hud.inert || f.stage.inert).toBe(false);
  });

  it.each(['Enter', ' '])('%s begins from the gesture and blocks the game keyup', (key) => {
    const f = fixture();
    expect(f.key(key).preventDefault).toHaveBeenCalled();
    expect(spies.soundStart).toHaveBeenCalledOnce();
    expect(f.key(key, 'keyup').stopped).toBe(true);
    f.show.update(8500);
    expect(spies.lensStart).toHaveBeenCalledOnce();
    f.button('skip').click();
    f.button('let me play').click();
    vi.runAllTimers();
    expect(spies.soundStop).toHaveBeenCalledOnce();
  });

  it.each([0.1, 2.6, 5.9, 6, 7.9, 8, 9.8, 10.5, 12, 13.5, 15.8])('skip at %s seconds lands on choices and cleans up before restoring the sandbox', (seconds) => {
    const f = fixture();
    f.button('▶ tap to begin').click();
    f.show.update(seconds * 1000);
    f.key('Escape');
    expect(spies.soundFinish).toHaveBeenCalledOnce();
    expect(f.show.active).toBe(true);
    expect(f.cam.zoom).toBeLessThan(4);
    expect(f.sim.cells).not.toBe(f.cells);
    f.button('let me play').click();
    expect(spies.soundStop).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(f.sim.cells).toBe(f.cells);
    expect(f.done).toHaveBeenCalledWith(false);
    expect(spies.lensStop.mock.calls.length).toBe(spies.lensStart.mock.calls.length);
  });

  it('reduced motion has a static scene, three lines, choices and just the chime', () => {
    const f = fixture(true);
    f.button('▶ tap to begin').click();
    expect(spies.soundStart.mock.calls[0][1]).toBe(true);
    expect(spies.soundFinish).toHaveBeenCalledOnce();
    expect(spies.lensStart).not.toHaveBeenCalled();
    const frozen = f.show.renderTime(1000);
    f.show.update(10000);
    expect(f.show.renderTime(10000)).toBe(frozen);
    expect(f.sim.generation).toBe(120);
    expect(f.body.querySelectorAll('p').map((p) => p.textContent)).toContain("every cell follows four simple rules — Conway's Game of Life");
    f.button('show me around').click();
    vi.runAllTimers();
    expect(f.done).toHaveBeenCalledWith(true);
  });

  it('uses the dive on coarse pointers and measured slow frames', () => {
    const touch = fixture(false, true);
    touch.button('▶ tap to begin').click(); touch.show.update(8500);
    expect(spies.lensStart).not.toHaveBeenCalled();
    touch.button('skip').click(); touch.button('let me play').click(); vi.runAllTimers();
    const slow = fixture();
    slow.button('▶ tap to begin').click();
    const start = performance.now();
    for (let ms = 50; ms <= 8500; ms += 50) slow.show.update(start + ms);
    slow.show.update(start + 8500);
    expect(spies.lensStart).not.toHaveBeenCalled();
  });

  it('the speaker shares the HUD mode and a finished show can replay through a fresh gate', () => {
    const f = fixture();
    const speaker = f.body.querySelectorAll('button').find((button) => button.classList.contains('welcome-speaker'))!;
    speaker.click();
    expect(f.audio.mode).toBe('music'); expect(f.soundChanged).toHaveBeenCalledOnce();
    f.button('▶ tap to begin').click(); f.show.update(16000);
    expect(spies.lensStart).not.toHaveBeenCalled();
    f.button('let me play').click(); vi.runAllTimers();
    f.show.start(f.done);
    expect(activeElement).toBe(f.button('▶ tap to begin'));
    expect(spies.soundStart).toHaveBeenCalledOnce();
    f.button('skip').click(); f.button('let me play').click(); vi.runAllTimers();
    expect(f.sim.cells).toBe(f.cells);
  });
});
