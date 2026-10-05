// ?intro-preview: play the trailer live with a scrubber, for judging pacing
// without exporting. Same timeline, overlays and score as the export; the
// cheaper dot bitmap is used for wide shots.
import type { Application } from 'pixi.js';
import type { WelcomeHost } from './welcomeSandbox';
import type { WelcomePresentation } from './welcomeShow';
import { WelcomeExportShow } from './welcomeExportShow';
import { WelcomeExportOverlays } from './welcomeExportOverlays';
import { BAR, BEAT, CUTS, SECTIONS, TRAILER_SECONDS } from './trailer';
import { scheduleTrailerScore, type ScoreHandle } from '../audio/trailerScore';

export function barBeat(seconds: number) {
  const beats = seconds / BEAT;
  return `${Math.floor(beats / 4)}.${(Math.floor(beats) % 4) + 1}`;
}

export function mountTrailerPreview(app: Application, host: WelcomeHost, presentation: WelcomePresentation) {
  const width = app.screen.width, height = app.screen.height;
  app.stop();
  const hud = document.getElementById('hud');
  if (hud) { hud.inert = true; hud.style.visibility = 'hidden'; }
  app.stage.children.forEach((child) => { child.visible = child === presentation.view.root; });
  Object.assign(host.cam, { w: width, h: height });

  const dpr = window.devicePixelRatio || 1;
  const layer = document.createElement('canvas');
  layer.width = Math.round(width * dpr); layer.height = Math.round(height * dpr);
  layer.style.cssText = `position:fixed;inset:0;width:${width}px;height:${height}px;pointer-events:none;z-index:11000`;
  const ctx = layer.getContext('2d')!;
  const overlays = new WelcomeExportOverlays();

  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:12000;display:flex;gap:10px;align-items:center;padding:8px 12px;background:#fff6c9ee;border:2px solid #7a6a5c;border-radius:12px;font:18px Patrick Hand;color:#3b302a';
  const play = document.createElement('button'); play.className = 'btn'; play.textContent = '▶ play';
  const loop = document.createElement('label'); const loopBox = document.createElement('input');
  loopBox.type = 'checkbox'; loop.append(loopBox, ' loop section');
  const track = document.createElement('div'); track.style.cssText = 'position:relative;flex:1;height:34px';
  const range = document.createElement('input');
  range.type = 'range'; range.min = '0'; range.max = String(TRAILER_SECONDS); range.step = String(1 / 60); range.value = '0';
  range.style.cssText = 'position:absolute;inset:8px 0 auto 0;width:100%';
  const marks = document.createElement('div'); marks.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  for (const s of SECTIONS) {
    const m = document.createElement('span');
    m.textContent = s.name;
    m.style.cssText = `position:absolute;left:${s.start / TRAILER_SECONDS * 100}%;top:-6px;font-size:12px;border-left:2px solid #c4483a;padding-left:2px;height:40px`;
    marks.append(m);
  }
  for (const c of CUTS) {
    const m = document.createElement('span');
    m.style.cssText = `position:absolute;left:${c / TRAILER_SECONDS * 100}%;bottom:0;height:10px;border-left:1px dashed #3b302a`;
    marks.append(m);
  }
  track.append(range, marks);
  const readout = document.createElement('span'); readout.style.cssText = 'min-width:150px;font-variant-numeric:tabular-nums';
  bar.append(play, track, readout, loop);
  document.body.append(layer, bar);

  let show = new WelcomeExportShow(host, presentation, { dotBitmap: true });
  let shown = -1;
  let audio: AudioContext | null = null;
  let score: ScoreHandle | null = null;
  let playing = false, from = 0, startAt = 0;

  const draw = (t: number) => {
    if (t < shown - 1e-6) { show.dispose(); show = new WelcomeExportShow(host, presentation, { dotBitmap: true }); }
    const { frame } = show.sample(t);
    shown = t;
    app.renderer.render(app.stage);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    overlays.draw(ctx, t, width, height, frame);
    range.value = String(t);
    readout.textContent = `${t.toFixed(2)}s · bar ${barBeat(t)} · ${frame.section}`;
  };
  const now = () => audio ? from + (audio.currentTime - startAt) : shown;
  const stop = () => { score?.stop(); score = null; playing = false; play.textContent = '▶ play'; };
  const start = (t: number) => {
    audio ??= new AudioContext();
    void audio.resume();
    score?.stop();
    from = t; startAt = audio.currentTime + 0.05;
    score = scheduleTrailerScore(audio, audio.destination, { from, startAt });
    playing = true; play.textContent = '❚❚ pause';
  };
  play.addEventListener('click', () => {
    if (playing) { stop(); return; }
    start(shown >= TRAILER_SECONDS - 1 / 60 ? 0 : Math.max(0, shown));
  });
  range.addEventListener('input', () => { const wasPlaying = playing; stop(); draw(Number(range.value)); if (wasPlaying) start(Number(range.value)); });
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ') { e.preventDefault(); play.click(); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      stop(); draw(Math.max(0, Math.min(TRAILER_SECONDS, shown + (e.key === 'ArrowRight' ? BEAT : -BEAT))));
    }
  }, { capture: true });

  const tick = () => {
    if (playing) {
      let t = Math.max(0, now());
      const section = SECTIONS.find((s) => shown >= s.start && shown < s.end);
      if (loopBox.checked && section && t >= section.end) { stop(); start(section.start); t = section.start; }
      else if (t >= TRAILER_SECONDS) { stop(); t = TRAILER_SECONDS; }
      draw(t);
    }
    requestAnimationFrame(tick);
  };
  draw(0);
  requestAnimationFrame(tick);
  readout.title = `${(TRAILER_SECONDS / BAR).toFixed(1)} bars at ${Math.round(60 / BEAT)} bpm · space = play/pause · ←/→ = one beat`;
}
