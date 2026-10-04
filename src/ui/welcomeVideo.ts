/** Pure runtime decisions, shared with tests. Square viewports use landscape. */
export function introSource(width: number, height: number, base = '/') {
  const format = width / height < 1 ? 'portrait' : 'landscape';
  return { video: `${base}intro/intro-${format}.mp4`, poster: `${base}intro/intro-${format}.jpg` };
}
export function introState(reduced: boolean, event: 'begin' | 'failure' | 'ended' | 'skip') {
  return event === 'begin' ? (reduced ? 'poster' : 'video') : 'choice';
}
