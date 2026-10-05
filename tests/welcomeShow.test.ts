import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Container, Renderer } from 'pixi.js';
import type { MusicBox } from '../src/audio/musicBox';
import { Camera } from '../src/render/camera';
import type { WorldView } from '../src/render/world';
import { Sim } from '../src/sim';
import { WelcomeShow } from '../src/ui/welcomeShow';

const spies = vi.hoisted(() => ({ soundStart: vi.fn(), soundStop: vi.fn(), creatureFail: false }));
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
  src = '';
  poster = '';
  preload = '';
  muted = false;
  error: unknown = null;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  load = vi.fn();
  constructor(readonly tag: string) {}
  classList = {
    add: (...names: string[]) => { this.className = [...new Set([...this.className.split(' '), ...names])].join(' '); },
    remove: (...names: string[]) => { this.className = this.className.split(' ').filter((name) => !names.includes(name)).join(' '); },
    contains: (name: string) => this.className.split(' ').includes(name),
  };
  get isConnected(): boolean { return this.tag === 'body' || Boolean(this.parent?.isConnected); }
  setAttribute(key: string, value: string) { this.attrs.set(key, value); }
  append(...children: FakeElement[]) { for (const child of children) { child.remove(); child.parent = this; this.children.push(child); } }
  prepend(...children: FakeElement[]) { for (const child of [...children].reverse()) { child.remove(); child.parent = this; this.children.unshift(child); } }
  removeAttribute(key: string) { this.attrs.delete(key); }
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
  const audio = { mode: 'all', enabled: true, beginWelcome: () => { spies.soundStart(); return { release: spies.soundStop }; }, cycleMode: vi.fn(() => { audio.mode = 'music'; }) };
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
  return { show, sim, cam, cells, body, hud, stage, done, button, key, audio, soundChanged, video: body.querySelector('video')!,
    state: () => ({ playing, following }) };
}

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); spies.creatureFail = false; });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('welcome video modal flow', () => {
  it('keeps the live title and seven cast portraits, preloads metadata then buffers after 1s', () => {
    const f = fixture();
    expect(f.video.preload).toBe('metadata');
    f.show.update(50000);
    expect(spies.soundStart).not.toHaveBeenCalled();
    expect(f.sim.generation).toBeGreaterThan(120);
    expect(f.state()).toEqual({ playing: false, following: false });
    expect(f.hud.inert && f.stage.inert).toBe(true);
    expect(activeElement).toBe(f.button('▶ tap to begin'));
    expect(f.body.querySelectorAll('canvas')).toHaveLength(7);
    vi.advanceTimersByTime(1000);
    expect(f.video.preload).toBe('auto');
  });

  it.each(['pointerenter', 'focus'])('buffers on begin button %s', (type) => {
    const f = fixture(), begin = f.button('▶ tap to begin');
    begin.dispatch(type, event(begin));
    expect(f.video.preload).toBe('auto');
  });

  it('keeps the title usable when GPU portraits cannot be extracted', () => {
    spies.creatureFail = true;
    const f = fixture();
    expect(f.body.querySelectorAll('p').map((p) => p.textContent)).toContain('meet the creatures swimming behind the title ~');
    expect(f.body.querySelectorAll('canvas')).toHaveLength(4);
  });

  it.each(['Escape', 'skip'])('gate %s offers choices and restores the untouched game', (action) => {
    const f = fixture();
    if (action === 'skip') f.button('skip').click(); else f.key(action);
    expect(f.show.active).toBe(true);
    expect(f.sim.cells).toBe(f.cells);
    expect(f.cam).toMatchObject({ x: 3, y: 5, zoom: 28 });
    f.button('let me play').click(); vi.runAllTimers();
    expect(f.done).toHaveBeenCalledWith(false);
    expect(spies.soundStart).not.toHaveBeenCalled();
    expect(f.state()).toEqual({ playing: true, following: true });
    expect(f.show.active || f.hud.inert || f.stage.inert).toBe(false);
  });

  it.each(['Enter', ' '])('%s begins from the gesture and blocks game keyup', (key) => {
    const f = fixture();
    expect(f.key(key).preventDefault).toHaveBeenCalled();
    expect(f.video.play).toHaveBeenCalledOnce();
    expect(spies.soundStart).toHaveBeenCalledOnce();
    expect(f.key(key, 'keyup').stopped).toBe(true);
    f.button('skip').click(); f.button('let me play').click(); vi.runAllTimers();
    expect(spies.soundStop).toHaveBeenCalledOnce();
  });

  it.each(['skip', 'Escape', 'click', 'ended'])('%s during video lands on choices and releases the audio lease', (action) => {
    const f = fixture();
    f.button('▶ tap to begin').click();
    if (action === 'skip') f.button('skip').click();
    else if (action === 'Escape') f.key('Escape');
    else f.video.dispatch(action, event(f.video));
    expect(f.video.pause).toHaveBeenCalledOnce();
    expect(spies.soundStop).toHaveBeenCalledOnce();
    expect(f.sim.cells).toBe(f.cells);
    expect(f.show.active).toBe(true);
    f.button('let me play').click(); vi.runAllTimers();
    expect(f.done).toHaveBeenCalledWith(false);
  });

  it('missing/decode error goes straight to choices, including an error during preload', () => {
    const f = fixture();
    f.video.error = new Error('404');
    f.button('▶ tap to begin').click();
    expect(f.video.play).not.toHaveBeenCalled();
    expect(f.button('let me play')).toBeDefined();
    expect(f.sim.cells).toBe(f.cells);
  });

  it('reports covering only while the video plays, so the stage under it can rest', () => {
    const f = fixture();
    expect(f.show.covering).toBe(false);
    f.button('▶ tap to begin').click();
    expect(f.show.covering).toBe(true);
    f.video.dispatch('ended', event(f.video));
    expect(f.show.covering).toBe(false);
    expect(fixture(true).show.covering).toBe(false);
  });

  it('timed out playback goes to choices; playing clears the timeout and a stall starts a new one', () => {
    const f = fixture();
    f.button('▶ tap to begin').click();
    vi.advanceTimersByTime(2999);
    expect(f.body.querySelectorAll('button').some((b) => b.textContent === 'let me play')).toBe(false);
    f.video.dispatch('playing', event(f.video));
    vi.advanceTimersByTime(5000);
    expect(f.body.querySelectorAll('button').some((b) => b.textContent === 'let me play')).toBe(false);
    f.video.dispatch('waiting', event(f.video));
    vi.advanceTimersByTime(3000);
    expect(f.button('let me play')).toBeDefined();
  });

  it('autoplay rejection goes to choices', async () => {
    const f = fixture();
    f.video.play.mockRejectedValue(new Error('not allowed'));
    f.button('▶ tap to begin').click();
    await Promise.resolve();
    expect(f.button('let me play')).toBeDefined();
  });

  it('reduced motion freezes the title, then shows a poster, welcome caption and choices without a video', () => {
    const f = fixture(true), cells = f.sim.cells;
    f.show.update(50000);
    expect(f.sim.cells).toBe(cells);
    expect(f.show.renderTime(1000)).toBe(f.show.renderTime(2000));
    expect(f.body.querySelectorAll('video')).toHaveLength(0);
    f.button('▶ tap to begin').click();
    expect(f.body.querySelector('img')!.src).toBe('/intro/intro-landscape.jpg');
    expect(spies.soundStart).not.toHaveBeenCalled();
    expect(f.body.querySelectorAll('h2').map((p) => p.textContent)).toContain('welcome to cute life ~');
    f.button('show me around').click(); vi.runAllTimers();
    expect(f.done).toHaveBeenCalledWith(true);
  });

  it('speaker mode mutes the single track, and help replay starts playback directly', () => {
    const f = fixture();
    f.audio.mode = 'off';
    f.button('▶ tap to begin').click();
    expect(f.video.muted).toBe(true);
    f.body.querySelectorAll('button').find((b) => b.classList.contains('welcome-speaker'))!.click();
    expect(f.video.muted).toBe(false);
    expect(f.soundChanged).toHaveBeenCalledOnce();
    f.video.dispatch('ended', event(f.video)); f.button('let me play').click(); vi.runAllTimers();
    f.show.start(f.done, true);
    expect(f.body.querySelector('video')!.play).toHaveBeenCalledOnce();
    f.button('skip').click(); f.button('let me play').click(); vi.runAllTimers();
    expect(f.sim.cells).toBe(f.cells);
  });
});
