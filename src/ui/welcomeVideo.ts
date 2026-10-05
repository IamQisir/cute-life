/**
 * The runtime picks the first source the browser can play. HEVC first: at
 * ~10 MB it is the sharpest per byte and hardware-decoded by Safari, Chrome
 * and Edge on macOS and Windows; AV1 mostly serves Firefox; H.264 is the
 * fallback. Kept here so the trailer code stays out of the main bundle.
 */
export const INTRO_CODECS = [
  { id: 'hevc', file: 'mp4', type: 'video/mp4; codecs="hvc1.1.6.L150.B0, mp4a.40.2"' },
  { id: 'av1', file: 'webm', type: 'video/webm; codecs="av01.0.08M.08, opus"' },
  { id: 'h264', file: 'mp4', type: 'video/mp4; codecs="avc1.640032, mp4a.40.2"' },
] as const;

/**
 * Phones and small tablets get 1080p at 30 fps (HEVC, else H.264): the full
 * 1440p/60 encode is ~3.6× the pixels per second and froze, then jumped
 * ahead, on phones. No AV1 here: Firefox falls back to H.264.
 */
export const SMALL_INTRO_CODECS = [
  { id: 'small-hevc', file: 'mp4', type: 'video/mp4; codecs="hvc1.1.6.L120.B0, mp4a.40.2"' },
  { id: 'small-h264', file: 'mp4', type: 'video/mp4; codecs="avc1.640028, mp4a.40.2"' },
] as const;
/** Viewports whose long side is at most this many CSS pixels count as small. */
export const SMALL_INTRO_MAX_SIDE = 1024;

type CanPlay = (type: string) => string;
const browserCanPlay: CanPlay = (type) => {
  if (typeof document === 'undefined') return '';
  const video = document.createElement('video');
  return typeof video.canPlayType === 'function' ? video.canPlayType(type) : '';
};

/**
 * Pure runtime decisions, shared with tests. Square viewports use landscape;
 * small viewports use the 1080p/30 set. The first codec the browser can play
 * wins; the set's H.264 is the fallback when nothing answers.
 */
export function introSource(width: number, height: number, base = '/', canPlay: CanPlay = browserCanPlay) {
  const format = width / height < 1 ? 'portrait' : 'landscape';
  const codecs = Math.max(width, height) <= SMALL_INTRO_MAX_SIDE ? SMALL_INTRO_CODECS : INTRO_CODECS;
  const codec = codecs.find((c) => canPlay(c.type) !== '') ?? codecs[codecs.length - 1];
  return { video: `${base}intro/intro-${format}-${codec.id}.${codec.file}`, poster: `${base}intro/intro-${format}.jpg` };
}
export function introState(reduced: boolean, event: 'begin' | 'failure' | 'ended' | 'skip') {
  return event === 'begin' ? (reduced ? 'poster' : 'video') : 'choice';
}
