/** Interleaved little-endian signed 16-bit PCM, with a standard 44-byte RIFF header. */
export function encodeWav(channels: readonly Float32Array[], sampleRate: number): ArrayBuffer {
  const length = channels[0]?.length ?? 0;
  if (!channels.length || channels.some((channel) => channel.length !== length) || !Number.isInteger(sampleRate) || sampleRate <= 0) {
    throw new RangeError('Invalid PCM channels or sample rate');
  }
  const bytes = length * channels.length * 2;
  const buffer = new ArrayBuffer(44 + bytes), view = new DataView(buffer);
  const tag = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  tag(0, 'RIFF'); view.setUint32(4, 36 + bytes, true); tag(8, 'WAVE'); tag(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels.length * 2, true);
  view.setUint16(32, channels.length * 2, true); view.setUint16(34, 16, true);
  tag(36, 'data'); view.setUint32(40, bytes, true);
  for (let i = 0; i < length; i++) for (let channel = 0; channel < channels.length; channel++) {
    const value = Math.max(-1, Math.min(1, channels[channel][i] || 0));
    view.setInt16(44 + (i * channels.length + channel) * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return buffer;
}
