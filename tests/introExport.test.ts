import { describe, expect, it } from 'vitest';
import { encodeWav } from '../src/audio/wav';
import { INTRO_COMMANDS, INTRO_FRAMES, INTRO_SCALE, introFrameName, introFrameSample, introPixels } from '../src/ui/introExport';
import { introSource, introState } from '../src/ui/welcomeVideo';
import { trailerGeneration, TRAILER_SECONDS } from '../src/ui/trailer';

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
  it('covers the whole trailer at 60 fps, named from 00001', () => {
    expect(INTRO_FRAMES).toBe(Math.round(60 * TRAILER_SECONDS));
    expect([0, 8, 9, 98].map(introFrameName)).toEqual(['00001.png', '00009.png', '00010.png', '00099.png']);
    expect(introFrameName(INTRO_FRAMES - 1)).toBe(`${String(INTRO_FRAMES).padStart(5, '0')}.png`);
    for (const frame of [-1, 0.5, INTRO_FRAMES]) expect(() => introFrameName(frame)).toThrow();
  });
  it('samples the virtual clock and generation per frame', () => {
    expect(introFrameSample(0)).toEqual({ seconds: 0, generation: 0 });
    const last = introFrameSample(INTRO_FRAMES - 1);
    expect(last.seconds).toBeCloseTo((INTRO_FRAMES - 1) / 60);
    expect(last.generation).toBe(trailerGeneration(last.seconds));
  });
  it('renders 2560 × 1440 and 1440 × 2560 pixels from 1920 × 1080 logical frames', () => {
    expect(INTRO_SCALE).toBeCloseTo(4 / 3);
    expect(introPixels({ width: 1920, height: 1080 })).toEqual({ width: 2560, height: 1440 });
    expect(introPixels({ width: 1080, height: 1920 })).toEqual({ width: 1440, height: 2560 });
  });
  it('prints AV1, HEVC and H.264 encodes plus a poster for both formats', () => {
    for (const name of ['landscape', 'portrait']) {
      for (const file of ['av1.webm', 'hevc.mp4', 'h264.mp4']) expect(INTRO_COMMANDS).toContain(`intro-${name}-${file}`);
      expect(INTRO_COMMANDS).toContain(`intro-${name}.jpg`);
    }
  });
});

describe('intro playback decisions', () => {
  const only = (id: string) => (type: string) => type.includes(id) ? 'probably' : '';
  it('picks the first playable codec: HEVC, then AV1, then H.264', () => {
    expect(introSource(1920, 1080, '/', (t) => t.includes('avc1') ? '' : 'maybe').video).toBe('/intro/intro-landscape-hevc.mp4');
    expect(introSource(1920, 1080, '/', only('av01')).video).toBe('/intro/intro-landscape-av1.webm');
    expect(introSource(1920, 1080, '/', only('hvc1')).video).toBe('/intro/intro-landscape-hevc.mp4');
    expect(introSource(1920, 1080, '/', only('avc1')).video).toBe('/intro/intro-landscape-h264.mp4');
    // Nothing answers: fall back to H.264 rather than giving up.
    expect(introSource(1920, 1080, '/', () => '').video).toBe('/intro/intro-landscape-h264.mp4');
  });
  it('uses portrait below aspect 1 and preserves deployment base URLs', () => {
    expect(introSource(1080, 1920, '/cute/', only('av01'))).toEqual({ video: '/cute/intro/intro-portrait-av1.webm', poster: '/cute/intro/intro-portrait.jpg' });
    expect(introSource(600, 600, '/', only('avc1')).poster).toBe('/intro/intro-landscape.jpg');
  });
  it('failure, ending and skip lead to choices; reduced motion begins on the poster path', () => {
    expect(introState(false, 'begin')).toBe('video');
    expect(introState(true, 'begin')).toBe('poster');
    for (const event of ['failure', 'ended', 'skip'] as const) expect(introState(false, event)).toBe('choice');
  });
});
