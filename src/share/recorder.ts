// Records the game into a short video for sharing. Each frame, the Pixi canvas
// is copied into a smaller 2D canvas with a handwritten watermark on top, and
// that canvas (plus the music box audio) is fed to MediaRecorder.

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm',
];

export function pickMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export interface RecorderOptions {
  maxSeconds: number;
  maxWidth: number;
  /** Draws overlay text/marks on top of each frame. */
  overlay: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  /** Read at start time: audio may only exist after the first user gesture. */
  audio?: () => MediaStream | null;
}

export interface Recording {
  blob: Blob;
  mime: string;
  ext: 'mp4' | 'webm';
  seconds: number;
}

export class Recorder {
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private done: ((r: Recording) => void) | null = null;
  private mime = '';

  constructor(private source: HTMLCanvasElement, private opts: RecorderOptions) {}

  get recording() {
    return this.rec !== null;
  }

  /** Change the length limit (e.g. a whole battle needs longer than a sandbox clip). */
  setLimit(seconds: number) {
    this.opts.maxSeconds = seconds;
  }

  get limit() {
    return this.opts.maxSeconds;
  }

  get elapsed() {
    return this.rec ? (performance.now() - this.startedAt) / 1000 : 0;
  }

  start(onDone: (r: Recording) => void): boolean {
    const mime = pickMime();
    if (!mime || this.rec) return false;
    this.mime = mime;
    // Even dimensions keep H.264 encoders happy.
    const scale = Math.min(1, this.opts.maxWidth / this.source.width);
    this.canvas.width = Math.floor((this.source.width * scale) / 2) * 2;
    this.canvas.height = Math.floor((this.source.height * scale) / 2) * 2;
    // Outside the render task the WebGL buffer may be blank, so start on plain paper.
    this.ctx.fillStyle = '#f2ece0';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const stream = this.canvas.captureStream(30);
    for (const t of this.opts.audio?.()?.getAudioTracks() ?? []) stream.addTrack(t);
    this.chunks = [];
    this.rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.onstop = () => this.finish();
    this.done = onDone;
    this.startedAt = performance.now();
    this.rec.start(250);
    return true;
  }

  /**
   * Call right after the renderer has drawn a frame (same task), so the WebGL
   * drawing buffer is still valid. Stops automatically at maxSeconds.
   */
  captureFrame() {
    const { width: w, height: h } = this.canvas;
    this.ctx.drawImage(this.source, 0, 0, w, h);
    this.opts.overlay(this.ctx, w, h);
    if (this.rec && this.elapsed >= this.opts.maxSeconds) this.stop();
  }

  stop() {
    if (this.rec && this.rec.state !== 'inactive') this.rec.stop();
  }

  private finish() {
    const seconds = this.elapsed;
    const blob = new Blob(this.chunks, { type: this.mime.split(';')[0] });
    this.rec = null;
    this.chunks = [];
    this.done?.({ blob, mime: this.mime, ext: this.mime.startsWith('video/mp4') ? 'mp4' : 'webm', seconds });
    this.done = null;
  }
}
