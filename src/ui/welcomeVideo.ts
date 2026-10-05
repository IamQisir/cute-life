/** The runtime picks the first source the browser can play. Kept here so the trailer code stays out of the main bundle. */
export const INTRO_CODECS = [
  { id: 'av1', file: 'webm', type: 'video/webm; codecs="av01.0.08M.08, opus"' },
  { id: 'hevc', file: 'mp4', type: 'video/mp4; codecs="hvc1.1.6.L150.B0, mp4a.40.2"' },
  { id: 'h264', file: 'mp4', type: 'video/mp4; codecs="avc1.640032, mp4a.40.2"' },
] as const;

type CanPlay = (type: string) => string;
const browserCanPlay: CanPlay = (type) => {
  if (typeof document === 'undefined') return '';
  const video = document.createElement('video');
  return typeof video.canPlayType === 'function' ? video.canPlayType(type) : '';
};

/**
 * Pure runtime decisions, shared with tests. Square viewports use landscape.
 * The first codec the browser can play wins (AV1, then HEVC, then H.264);
 * H.264 is the fallback when nothing answers.
 */
export function introSource(width: number, height: number, base = '/', canPlay: CanPlay = browserCanPlay) {
  const format = width / height < 1 ? 'portrait' : 'landscape';
  const codec = INTRO_CODECS.find((c) => canPlay(c.type) !== '') ?? INTRO_CODECS[INTRO_CODECS.length - 1];
  return { video: `${base}intro/intro-${format}-${codec.id}.${codec.file}`, poster: `${base}intro/intro-${format}.jpg` };
}
export function introState(reduced: boolean, event: 'begin' | 'failure' | 'ended' | 'skip') {
  return event === 'begin' ? (reduced ? 'poster' : 'video') : 'choice';
}
