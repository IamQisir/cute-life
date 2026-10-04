import { welcomeBeat, welcomeGeneration, welcomeLensTimeline, WELCOME_SECONDS, WELCOME_SHOTS } from './welcomeTimeline';
export const INTRO_FPS = 60;
export const INTRO_FRAMES = INTRO_FPS * WELCOME_SECONDS;
export const INTRO_FORMATS = [
  { name: 'landscape', width: 1920, height: 1080 },
  { name: 'portrait', width: 1080, height: 1920 },
] as const;
export function introFrameName(frame: number) {
  if (!Number.isInteger(frame) || frame < 0 || frame >= INTRO_FRAMES) throw new RangeError('Invalid intro frame');
  return `${String(frame + 1).padStart(5, '0')}.png`;
}
export function introFrameSample(frame: number, width: number, height: number) {
  introFrameName(frame);
  const seconds = frame / INTRO_FPS;
  return { seconds, generation: welcomeGeneration(seconds), shot: WELCOME_SHOTS[welcomeBeat(seconds)], frame: welcomeLensTimeline(seconds, width, height) };
}
export const INTRO_COMMANDS = INTRO_FORMATS.map(({ name }) =>
  `ffmpeg -y -framerate 60 -i ${name}/%05d.png -i audio.wav -c:v libx264 -pix_fmt yuv420p -crf 20 -preset slow -c:a aac -b:a 160k -movflags +faststart intro-${name}.mp4\n` +
  `ffmpeg -y -ss 15.9 -i intro-${name}.mp4 -frames:v 1 intro-${name}.jpg`).join('\n');
