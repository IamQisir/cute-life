import { describe, expect, it, vi } from 'vitest';
import { MusicBox } from '../src/audio/musicBox';
import { WelcomeSound, welcomeGunTicks, welcomeLayers } from '../src/audio/welcomeSound';
import { WELCOME_PRE_ADVANCE } from '../src/ui/welcomeScene';

// A routing/scheduling spy, with no real AudioContext or audio device.
function audioFixture(mode: 'all' | 'music' | 'off' = 'all') {
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
  const nodes: ReturnType<typeof makeOne>[] = [];
  function makeOne(source = false) {
    const node = { connect: vi.fn(), disconnect: vi.fn(), gain: param(), frequency: param(), detune: param(), Q: param(), start: vi.fn(), stop: vi.fn(), source };
    node.connect.mockReturnValue(node);
    return node;
  }
  function makeNode(source = false) {
    const node = makeOne(source);
    nodes.push(node);
    return node;
  }
  const context = {
    currentTime: 0, sampleRate: 100,
    createGain: () => makeNode(), createBiquadFilter: () => makeNode(),
    createOscillator: () => makeNode(true), createBufferSource: () => makeNode(true),
    createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
  };
  const release = vi.fn();
  const audio = { mode, beginWelcome: () => ({ context, output: {}, release }) } as unknown as MusicBox;
  return { audio, nodes, context, release };
}

describe('welcome sound decisions', () => {
  it('keeps music layers in music mode and removes all layers in off mode', () => {
    expect(welcomeLayers('all')).toEqual({ pad: true, notes: true, chime: true, sfx: true });
    expect(welcomeLayers('music')).toEqual({ pad: true, notes: true, chime: true, sfx: false });
    expect(welcomeLayers('off')).toEqual({ pad: false, notes: false, chime: false, sfx: false });
  });

  it('staggered period-30 ticks are independent of frame/generation batches', () => {
    const start = WELCOME_PRE_ADVANCE;
    const whole = welcomeGunTicks(start, start + 90);
    expect(whole.map(({ generation }) => generation - start)).toEqual([15, 30, 45, 60, 75, 90]);
    expect(whole.map(({ gun }) => gun)).toEqual([1, 0, 1, 0, 1, 0]);
    const pieces = [welcomeGunTicks(start, start + 17), welcomeGunTicks(start + 17, start + 60), welcomeGunTicks(start + 60, start + 90)].flat();
    expect(pieces).toEqual(whole);
    expect(welcomeGunTicks(150, 150)).toEqual([]);
    expect(welcomeGunTicks(150, 149)).toEqual([]);
  });

  it('supports arbitrary phases and simultaneous emitters without double counting', () => {
    const guns = [{ period: 30, phase: 7 }, { period: 30, phase: 7 }];
    expect(welcomeGunTicks(22, 23, guns)).toEqual([{ generation: 23, gun: 0 }, { generation: 23, gun: 1 }]);
    expect(welcomeGunTicks(23, 24, guns)).toEqual([]);
  });
});

describe('welcome sound lifetime', () => {
  it('stops and disconnects every intro node on skip/close, including a whoosh', () => {
    const fixture = audioFixture();
    const sound = new WelcomeSound(fixture.audio, false);
    sound.update(4.1, 153, []);
    sound.dispose();
    for (const node of fixture.nodes) {
      expect(node.disconnect).toHaveBeenCalled();
      if (node.source) expect(node.stop).toHaveBeenCalled();
    }
    expect(fixture.release).toHaveBeenCalledOnce();
    sound.dispose();
    expect(fixture.release).toHaveBeenCalledOnce();
  });

  it('reduced motion produces just one soft three-partial chime and cleans up its tail', () => {
    vi.stubGlobal('window', { setTimeout: vi.fn(() => 1) });
    const fixture = audioFixture();
    const sound = new WelcomeSound(fixture.audio, true);
    expect(fixture.nodes.filter((node) => node.source)).toHaveLength(0);
    sound.update(10, 200, [1]);
    sound.finish(); sound.finish();
    expect(fixture.nodes.filter((node) => node.source)).toHaveLength(3);
    sound.dispose();
    expect(fixture.nodes.every((node) => node.disconnect.mock.calls.length)).toBe(true);
    vi.unstubAllGlobals();
  });

  it('off mode has no chime and safely handles an unavailable AudioContext', () => {
    const fixture = audioFixture('off');
    const sound = new WelcomeSound(fixture.audio, true);
    sound.finish();
    expect(fixture.nodes.filter((node) => node.source)).toHaveLength(0);
    sound.dispose();
    const unavailable = new WelcomeSound({ mode: 'all', beginWelcome: () => null } as unknown as MusicBox, false);
    unavailable.update(5, 150, []); unavailable.finish(); unavailable.dispose();
  });
});

describe('shared sound preference', () => {
  it('persists the same cycle used by HUD and welcome across visits', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const audio = new MusicBox();
    expect(audio.mode).toBe('all');
    expect(audio.cycleMode()).toBe('music');
    expect(new MusicBox().mode).toBe('music');
    expect(audio.cycleMode()).toBe('off');
    expect(new MusicBox().enabled).toBe(false);
    expect(audio.cycleMode()).toBe('all');
    vi.unstubAllGlobals();
  });

  it('handles unavailable storage and invalid saved preferences', () => {
    vi.stubGlobal('localStorage', { getItem: () => 'loud', setItem: () => { throw new Error('denied'); } });
    const audio = new MusicBox();
    expect(audio.mode).toBe('all');
    expect(audio.cycleMode()).toBe('music');
    vi.unstubAllGlobals();
  });
});
