import type { Application } from 'pixi.js';
import type { WelcomeHost } from './welcomeSandbox';
import type { WelcomePresentation } from './welcomeShow';
import { WelcomeExportShow } from './welcomeExportShow';
import { WelcomeExportOverlays } from './welcomeExportOverlays';
import { INTRO_COMMANDS, INTRO_FORMATS, INTRO_FRAMES, introFrameName, introFrameSample } from './introExport';
import { WelcomeSound, type OfflineWelcomeClock } from '../audio/welcomeSound';
import { encodeWav } from '../audio/wav';

// File System Access is available in Chromium, and not in TypeScript's DOM lib yet.
interface ExportFile { createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void>; abort(): Promise<void> }> }
interface ExportDirectory {
  getDirectoryHandle(name: string, options: { create: true }): Promise<ExportDirectory>;
  getFileHandle(name: string, options: { create: true }): Promise<ExportFile>;
}
type PickerWindow = Window & { showDirectoryPicker?: (options: { mode: 'readwrite' }) => Promise<ExportDirectory> };
async function write(directory: ExportDirectory, name: string, data: Blob) {
  const file = await directory.getFileHandle(name, { create: true });
  const stream = await file.createWritable();
  try { await stream.write(data); await stream.close(); }
  catch (error) { await stream.abort().catch(() => {}); throw error; }
}
function png(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG encoding failed')), 'image/png'));
}

/** Imported only for ?render-intro. Rendering and readback happen in the same task. */
export function mountIntroExporter(app: Application, host: WelcomeHost, presentation: WelcomePresentation) {
  const panel = document.createElement('section');
  panel.style.cssText = 'position:fixed;top:12px;left:12px;right:12px;z-index:12000;max-width:850px;padding:16px;background:#fff6c9;color:#3b302a;border:2px solid #7a6a5c;border-radius:12px;font:18px Patrick Hand;max-height:90vh;overflow:auto';
  const heading = document.createElement('h2'); heading.textContent = 'export intro frames';
  const start = document.createElement('button'); start.className = 'btn'; start.textContent = 'choose folder & export both formats';
  const cancel = document.createElement('button'); cancel.className = 'btn'; cancel.textContent = 'cancel'; cancel.disabled = true;
  const progress = document.createElement('progress'); progress.max = INTRO_FRAMES * 2; progress.value = 0; progress.style.width = '100%';
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  const commands = document.createElement('pre'); commands.style.cssText = 'white-space:pre-wrap;font:12px monospace;overflow-wrap:anywhere';
  panel.append(heading, start, cancel, progress, status, commands); document.body.append(panel);
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) {
    start.disabled = true;
    status.textContent = 'Folder export requires Chrome or another browser with the File System Access API. Open this URL in Chrome on localhost.';
    return;
  }
  status.textContent = 'Exports 960 PNGs per format plus a 48 kHz stereo WAV. Choose an empty output folder; matching filenames will be overwritten.';
  let cancelled = false, running = false;
  cancel.addEventListener('click', () => { cancelled = true; cancel.disabled = true; status.textContent = 'Cancelling after the current write…'; });
  start.addEventListener('click', async () => {
    if (running) return;
    running = true; start.disabled = true; commands.textContent = ''; progress.value = 0;
    let directory: ExportDirectory;
    try { directory = await picker.call(window, { mode: 'readwrite' }); }
    catch (error) { status.textContent = `Folder selection cancelled or failed: ${String(error)}`; running = false; start.disabled = false; return; }
    cancelled = false; cancel.disabled = false;
    const old = { width: app.screen.width, height: app.screen.height, resolution: app.renderer.resolution, resizeTo: app.resizeTo, running: app.ticker.started };
    const visibility = app.stage.children.map((child) => ({ child, visible: child.visible }));
    const hud = document.getElementById('hud'); const inert = hud?.inert;
    let show: WelcomeExportShow | null = null;
    let context: OfflineAudioContext | null = null;
    let score: WelcomeSound | null = null;
    // Public resize() cancels any queued resize in Pixi v8. The installed
    // runtime has no cancelResize() despite advertising it in its declarations.
    app.stop(); app.resize();
    // Pixi accepts a falsy resize target at runtime; its declaration omits null.
    app.resizeTo = null as unknown as Window;
    if (hud) hud.inert = true;
    visibility.forEach(({ child }) => { child.visible = child === presentation.view.root; });
    const began = performance.now();
    try {
      // Explicitly request both fonts, including when an existing visitor skips the title.
      await Promise.all([document.fonts.load("700 46px Caveat"), document.fonts.load("17px 'Patrick Hand'")]);
      await document.fonts.ready;
      if (cancelled) return;
      context = new OfflineAudioContext(2, 48000 * 16, 48000);
      const clock: OfflineWelcomeClock = { lease: { context, output: context.destination, release() {} }, time: 0 };
      score = new WelcomeSound({ mode: 'all', beginWelcome: () => null }, false, clock);
      const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d')!;
      const overlays = new WelcomeExportOverlays();
      let total = 0;
      for (const format of INTRO_FORMATS) {
        if (cancelled) break;
        const folder = await directory.getDirectoryHandle(format.name, { create: true });
        app.renderer.resize(format.width, format.height, 1);
        Object.assign(host.cam, { w: format.width, h: format.height });
        presentation.view.resize(format.width, format.height);
        canvas.width = format.width; canvas.height = format.height;
        show = new WelcomeExportShow(host, presentation);
        for (let i = 0; i < INTRO_FRAMES && !cancelled; i++) {
          const sample = introFrameSample(i, format.width, format.height);
          const result = show.sample(sample.seconds);
          if (format.name === 'landscape') score.update(sample.seconds, result.generation, result.births);
          app.renderer.render(app.stage);
          // Copy synchronously before toBlob or any filesystem await can clear WebGL's buffer.
          ctx.drawImage(app.canvas, 0, 0, format.width, format.height);
          overlays.draw(ctx, sample.seconds, format.width, format.height);
          await write(folder, introFrameName(i), await png(canvas));
          progress.value = ++total;
          const elapsed = (performance.now() - began) / 1000;
          const eta = Math.ceil(elapsed / total * (INTRO_FRAMES * 2 - total));
          status.textContent = `${format.name}: frame ${i + 1}/${INTRO_FRAMES} · total ${total}/${INTRO_FRAMES * 2} · ETA ${Math.floor(eta / 60)}m ${eta % 60}s`;
        }
        show.dispose(); show = null;
      }
      if (!cancelled) {
        status.textContent = 'Rendering 48 kHz stereo audio…';
        const audio = await context.startRendering();
        if (!cancelled) {
          await write(directory, 'audio.wav', new Blob([encodeWav([audio.getChannelData(0), audio.getChannelData(1)], 48000)], { type: 'audio/wav' }));
          status.textContent = 'Export complete. Run these commands from the selected folder, then copy the four MP4/JPG files into public/intro/.';
          commands.textContent = INTRO_COMMANDS;
        }
      }
    } catch (error) { status.textContent = `Export failed: ${String(error)}`; }
    finally {
      show?.dispose(); score?.dispose();
      app.renderer.resize(old.width, old.height, old.resolution);
      visibility.forEach(({ child, visible }) => { child.visible = visible; });
      app.resizeTo = old.resizeTo;
      Object.assign(host.cam, { w: app.screen.width, h: app.screen.height });
      presentation.view.resize(app.screen.width, app.screen.height);
      if (hud) hud.inert = inert ?? false;
      if (old.running) app.start();
      if (cancelled) status.textContent = 'Export cancelled. Completed files remain in the selected folder; restart to overwrite them.';
      running = false; start.disabled = false; cancel.disabled = true;
    }
  });
}
