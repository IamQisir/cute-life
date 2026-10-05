import { describe, expect, it } from 'vitest';
import { trailerScoreEvents } from '../src/audio/trailerScore';
import { toList } from '../src/life/engine';
import {
  at, BAR, BEAT, BPM, CAPTIONS, captionAt, CUTS, GENESIS_POPS, IMPACTS, KICKS, LETTER_POPS, MONTAGE, SECTIONS,
  TAGLINE, trailerFrame, trailerGeneration, TRAILER_SECONDS, wideZoom,
} from '../src/ui/trailer';
import { welcomeLettering } from '../src/ui/welcomeScene';

/** On the sixteenth-note grid of the one tempo. */
const onGrid = (t: number) => Math.abs(t / (BEAT / 4) - Math.round(t / (BEAT / 4))) < 1e-9;
const SIZES = [[1920, 1080], [1080, 1920], [1280, 800], [360, 780]] as const;

describe('trailer timing', () => {
  it('runs one 128 bpm grid, about 18–20 s, sections back to back', () => {
    expect(BPM).toBe(128);
    expect(BAR).toBeCloseTo(1.875);
    expect(TRAILER_SECONDS).toBeGreaterThan(18);
    expect(TRAILER_SECONDS).toBeLessThan(20);
    expect(SECTIONS[0].start).toBe(0);
    SECTIONS.slice(1).forEach((s, i) => expect(s.start).toBe(SECTIONS[i].end));
    expect(SECTIONS.at(-1)!.end).toBe(TRAILER_SECONDS);
  });

  it('puts every cue on the beat grid', () => {
    for (const t of [...SECTIONS.map((s) => s.start), ...CUTS, ...IMPACTS, ...KICKS, ...GENESIS_POPS, ...LETTER_POPS,
      ...MONTAGE.map((m) => m.start), ...CAPTIONS.flatMap((c) => [c.start, c.end]), TAGLINE.start]) {
      expect(onGrid(t), `${t}s`).toBe(true);
    }
    for (const e of trailerScoreEvents()) expect(onGrid(e.t), `${e.kind} at ${e.t}s`).toBe(true);
  });

  it('cuts the montage every two beats and keeps captions to one per bar at most', () => {
    MONTAGE.slice(1).forEach((m, i) => expect(m.start - MONTAGE[i].start).toBeCloseTo(BEAT * 2));
    for (const c of CAPTIONS) expect(c.end - c.start).toBeLessThanOrEqual(BAR + 1e-9);
    CAPTIONS.slice(1).forEach((c, i) => expect(c.start).toBeGreaterThanOrEqual(CAPTIONS[i].end));
  });

  it('holds the end card for at least 2.5 s, then fades to paper', () => {
    const end = SECTIONS.find((s) => s.name === 'end')!;
    expect(end.end - end.start).toBeGreaterThanOrEqual(2.5);
    expect(trailerFrame(end.start + 0.5, 1920, 1080).paperFade).toBe(0);
    expect(trailerFrame(TRAILER_SECONDS, 1920, 1080).paperFade).toBe(1);
    expect(trailerFrame(TRAILER_SECONDS - 1, 1920, 1080).tagline).toBe(1);
  });

  it('steps the simulation monotonically: still in the hook, fast in the build, slow for faces', () => {
    let previous = 0;
    for (let t = 0; t <= TRAILER_SECONDS; t += 1 / 60) {
      const g = trailerGeneration(t);
      expect(g).toBeGreaterThanOrEqual(previous);
      previous = g;
    }
    expect(trailerGeneration(at(1) - 0.01)).toBe(0);
    const rate = (a: number, b: number) => (trailerGeneration(b) - trailerGeneration(a)) / (b - a);
    expect(rate(at(3), at(4))).toBeGreaterThan(rate(at(1), at(2)));
    expect(rate(at(5), at(8))).toBeLessThan(rate(at(3), at(4)));
    expect(rate(at(8), at(8, 2))).toBeLessThan(rate(at(5), at(8)));
  });
});

describe('trailer camera', () => {
  it.each(SIZES)('only jumps at declared cuts, kicks and impacts (%s × %s)', (w, h) => {
    const eps = 1e-5;
    const allowed = [...CUTS, ...KICKS, ...IMPACTS];
    const marks = [...SECTIONS.map((s) => s.start), ...allowed, ...MONTAGE.map((m) => m.start)];
    const times = [...Array.from({ length: Math.floor(TRAILER_SECONDS * 120) }, (_, i) => i / 120 + 0.003), ...marks];
    for (const t of times) {
      if (t < eps * 2 || allowed.some((m) => Math.abs(m - t) < 1e-9)) continue;
      const a = trailerFrame(t - eps, w, h).camera, b = trailerFrame(t + eps, w, h).camera;
      expect(Math.hypot(a.x - b.x, a.y - b.y) * a.zoom, `${t.toFixed(4)}s`).toBeLessThan(2);
      expect(Math.abs(Math.log(a.zoom / b.zoom)), `${t.toFixed(4)}s`).toBeLessThan(0.02);
    }
  });

  it.each(SIZES)('hands the magnifier over to an identical camera on the drop (%s × %s)', (w, h) => {
    const before = trailerFrame(at(5) - 1e-6, w, h), after = trailerFrame(at(5), w, h);
    expect(before.lens.radius).toBeGreaterThanOrEqual(Math.hypot(w, h) / 2);
    // The landing is an impact: a full flash frame, and only the shake separates the cameras.
    expect(after.flash).toBe(1);
    const slack = after.shake / after.camera.zoom + 0.01;
    expect(Math.abs(before.lens.camera.x - after.camera.x)).toBeLessThanOrEqual(slack);
    expect(Math.abs(before.lens.camera.y - after.camera.y)).toBeLessThanOrEqual(slack);
    expect(before.lens.camera.zoom).toBeCloseTo(after.camera.zoom, 0);
    let radius = 0;
    for (let t = at(4, 3.5); t < at(5); t += 0.004) {
      const r = trailerFrame(t, w, h).lens.radius;
      expect(r).toBeGreaterThanOrEqual(radius);
      radius = r;
    }
    expect(trailerFrame(at(5), w, h).lens.visible).toBe(false);
  });

  it.each(SIZES)('frames the whole title on the end card (%s × %s)', (w, h) => {
    const pose = trailerFrame(TRAILER_SECONDS - 0.8, w, h).camera;
    for (const [x, y] of toList(welcomeLettering())) {
      expect(Math.abs((x - pose.x) * pose.zoom)).toBeLessThan(w / 2 - 8);
      expect(Math.abs((y - pose.y) * pose.zoom)).toBeLessThan(h / 2 - 8);
    }
    expect(pose.zoom).toBeCloseTo(wideZoom(w, h), 0);
  });

  it('keeps the title secret until the slam, then pops it letter by letter', () => {
    expect(trailerFrame(at(8, 2) - 0.001, 1920, 1080).letters).toBe(0);
    expect(trailerFrame(at(8, 2), 1920, 1080).letters).toBe(1);
    expect(trailerFrame(at(9), 1920, 1080).letters).toBe(8);
  });

  it('slams captions in, holds them, and clears them before the next one', () => {
    const c = CAPTIONS[0];
    expect(captionAt(c.start)!.scale).toBeGreaterThan(1.5);
    expect(captionAt(c.start + 0.5)!.scale).toBeCloseTo(1.015, 2);
    expect(captionAt(c.start + 0.5)!.alpha).toBe(1);
    expect(captionAt(c.end - 1e-6)!.alpha).toBeLessThan(0.01);
    expect(captionAt(at(0, 2))).toBeNull();
  });
});

describe('trailer score', () => {
  const events = trailerScoreEvents();
  it('is sorted, inside the trailer, and nothing new starts in the final fade', () => {
    events.slice(1).forEach((e, i) => expect(e.t).toBeGreaterThanOrEqual(events[i].t));
    for (const e of events) {
      expect(e.t).toBeGreaterThanOrEqual(0);
      expect(e.t).toBeLessThan(TRAILER_SECONDS - 1.4);
      if ('end' in e) expect(e.end).toBeLessThanOrEqual(TRAILER_SECONDS);
    }
  });
  it('hits every impact, whooshes into every cut and goes quiet in the hush', () => {
    for (const t of IMPACTS) expect(events.some((e) => (e.kind === 'boom' || e.kind === 'impact') && Math.abs(e.t - t) < 1e-9)).toBe(true);
    for (const cut of CUTS.slice(1)) expect(events.some((e) => e.kind === 'whoosh' && 'end' in e && Math.abs(e.end - cut) < 1e-9)).toBe(true);
    const hush = events.filter((e) => e.t >= at(8) && e.t < at(8, 2));
    expect(hush.every((e) => e.kind === 'heartbeat' || e.kind === 'whoosh')).toBe(true);
    // Each genesis cell and each title letter pops with its own note.
    for (const t of [...GENESIS_POPS, ...LETTER_POPS]) expect(events.some((e) => e.kind === 'pluck' && e.t === t)).toBe(true);
  });
  it('drops the beat under the riser and leaves an eighth of silence before the drop', () => {
    const kicks = events.filter((e) => e.kind === 'kick' && e.t >= at(4) && e.t < at(5));
    expect(kicks).toEqual([]);
    expect(events.filter((e) => e.t > at(4, 3.5) && e.t < at(5))).toEqual([]);
  });
});
