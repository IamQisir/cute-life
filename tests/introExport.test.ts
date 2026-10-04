import { describe, expect, it } from 'vitest';
import { encodeWav } from '../src/audio/wav';
import { INTRO_FRAMES, introFrameName, introFrameSample } from '../src/ui/introExport';
import { introSource, introState } from '../src/ui/welcomeVideo';
import { welcomeCamera, welcomeGeneration } from '../src/ui/welcomeTimeline';
import { keyX, keyY } from '../src/life/engine';
import { welcomeLettering } from '../src/ui/welcomeScene';

describe('PCM WAV', () => {
  it('writes stereo RIFF header and clipped/interleaved signed little-endian PCM', () => {
    const buffer = encodeWav([new Float32Array([-1, 0, 0.5, 2]), new Float32Array([1, -0.5, -2, NaN])], 48000);
    const view = new DataView(buffer);
    const tag = (offset: number) => String.fromCharCode(...new Uint8Array(buffer, offset, 4));
    expect([tag(0), tag(8), tag(12), tag(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
    expect(buffer.byteLength).toBe(60);
    expect(view.getUint32(4, true)).toBe(52);
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint32(28, true)).toBe(192000);
    expect(view.getUint16(32, true)).toBe(4);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(16);
    expect(Array.from({ length: 8 }, (_, i) => view.getInt16(44 + i * 2, true))).toEqual([-32768, 32767, 0, -16384, 16384, -32768, 32767, 0]);
  });
  it('rejects inconsistent channels and invalid sample rates', () => {
    expect(() => encodeWav([], 48000)).toThrow();
    expect(() => encodeWav([new Float32Array(1), new Float32Array(2)], 48000)).toThrow();
    expect(() => encodeWav([new Float32Array(1)], 0)).toThrow();
  });
});
describe('virtual intro frames', () => {
  it('names exactly 960 frames, starting at 00001', () => {
    expect(INTRO_FRAMES).toBe(960);
    expect([0, 8, 9, 98, 959].map(introFrameName)).toEqual(['00001.png', '00009.png', '00010.png', '00099.png', '00960.png']);
    for (const frame of [-1, 0.5, 960]) expect(() => introFrameName(frame)).toThrow();
  });
  it.each([[1920, 1080], [1080, 1920]])('samples clock/timeline at 60fps for %s × %s', (width, height) => {
    expect(introFrameSample(0, width, height).seconds).toBe(0);
    const last = introFrameSample(959, width, height);
    expect(last.seconds).toBeCloseTo(15.983333333);
    expect(last.frame.main).toEqual(welcomeCamera(959 / 60, width, height));
    expect(last.generation).toBe(welcomeGeneration(959 / 60));
    expect(introFrameSample(630, width, height).shot.name).toBe('faces');
    for (const key of welcomeLettering()) {
      expect(Math.abs((keyX(key) - last.frame.main.x) * last.frame.main.zoom)).toBeLessThan(width / 2 - 8);
      expect(Math.abs((keyY(key) - last.frame.main.y) * last.frame.main.zoom)).toBeLessThan(height / 2 - 8);
    }
  });
});
describe('intro playback decisions', () => {
  it('uses portrait below aspect 1 and preserves deployment base URLs', () => {
    expect(introSource(1080, 1920, '/cute/')).toEqual({ video: '/cute/intro/intro-portrait.mp4', poster: '/cute/intro/intro-portrait.jpg' });
    expect(introSource(1920, 1080).video).toBe('/intro/intro-landscape.mp4');
    expect(introSource(600, 600).poster).toBe('/intro/intro-landscape.jpg');
  });
  it('failure, ending and skip lead to choices; reduced motion begins on the poster path', () => {
    expect(introState(false, 'begin')).toBe('video');
    expect(introState(true, 'begin')).toBe('poster');
    for (const event of ['failure', 'ended', 'skip'] as const) expect(introState(false, event)).toBe('choice');
  });
});
