import { trailerGeneration, TRAILER_SECONDS } from './trailer';

export const INTRO_FPS = 60;
export const INTRO_FRAMES = Math.round(INTRO_FPS * TRAILER_SECONDS);
/** Logical sizes (what the timeline is written for) and the pixel scale of the PNGs. */
export const INTRO_SCALE = 4 / 3;
export const INTRO_FORMATS = [
  { name: 'landscape', width: 1920, height: 1080 },
  { name: 'portrait', width: 1080, height: 1920 },
] as const;
export function introPixels(format: { width: number; height: number }) {
  return { width: Math.round(format.width * INTRO_SCALE), height: Math.round(format.height * INTRO_SCALE) };
}
export function introFrameName(frame: number) {
  if (!Number.isInteger(frame) || frame < 0 || frame >= INTRO_FRAMES) throw new RangeError('Invalid intro frame');
  return `${String(frame + 1).padStart(5, '0')}.png`;
}
export function introFrameSample(frame: number) {
  introFrameName(frame);
  const seconds = frame / INTRO_FPS;
  return { seconds, generation: trailerGeneration(seconds) };
}

export { INTRO_CODECS } from './welcomeVideo';

// The end card, settled, before the fade to paper.
const posterFrame = String(Math.round((TRAILER_SECONDS - 1.2) * INTRO_FPS) + 1).padStart(5, '0');
export const INTRO_COMMANDS = INTRO_FORMATS.map(({ name }) => [
  `ffmpeg -y -framerate 60 -i ${name}/%05d.png -i audio.wav -c:v libsvtav1 -crf 40 -preset 5 -svtav1-params tune=0 -pix_fmt yuv420p -c:a libopus -b:a 128k intro-${name}-av1.webm`,
  `ffmpeg -y -framerate 60 -i ${name}/%05d.png -i audio.wav -c:v libx265 -crf 28 -preset slow -tag:v hvc1 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart intro-${name}-hevc.mp4`,
  `ffmpeg -y -framerate 60 -i ${name}/%05d.png -i audio.wav -c:v libx264 -crf 26 -preset slow -tune animation -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart intro-${name}-h264.mp4`,
  `ffmpeg -y -i ${name}/${posterFrame}.png -vf scale=iw/2:-1 -q:v 3 intro-${name}.jpg`,
].join('\n')).join('\n');
