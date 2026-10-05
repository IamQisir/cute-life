const MAX_INFLATED_BYTES = 4 * 1024 * 1024;

/** Raw deflate encoded as unpadded base64url. */
export async function compressRle(rle: string): Promise<string> {
  const stream = new Blob([rle]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Read incrementally so hostile links cannot allocate unbounded inflated data. */
export async function decompressRle(data: string): Promise<string> {
  if (!/^[A-Za-z0-9_-]+$/.test(data) || data.length % 4 === 1) {
    throw new Error('Invalid base64url');
  }
  const binary = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const reader = new Blob([bytes]).stream()
    .pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const parts: string[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_INFLATED_BYTES) throw new Error('Inflated link is too large');
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join('');
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
