const run = (count: number, symbol: string): string =>
  `${count === 1 ? '' : count}${symbol}`;

/** Encodes a sparse pattern relative to its minimum coordinates. */
export function encodeRle(points: [number, number][]): { rle: string; x: number; y: number } {
  const sorted = points
    .filter(([x, y]) => Number.isSafeInteger(x) && Number.isSafeInteger(y))
    .slice()
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  if (!sorted.length) return { rle: '!', x: 0, y: 0 };

  let x = sorted[0][0];
  const y = sorted[0][1];
  for (const point of sorted) x = Math.min(x, point[0]);

  const body: string[] = [];
  let previousY = y;
  let index = 0;
  while (index < sorted.length) {
    const rowY = sorted[index][1];
    if (rowY !== previousY) body.push(run(rowY - previousY, '$'));
    previousY = rowY;
    let column = x;
    while (index < sorted.length && sorted[index][1] === rowY) {
      const start = sorted[index][0];
      if (start > column) body.push(run(start - column, 'b'));
      let end = start;
      index++;
      while (index < sorted.length && sorted[index][1] === rowY && sorted[index][0] <= end + 1) {
        end = sorted[index][0];
        index++;
      }
      body.push(run(end - start + 1, 'o'));
      column = end + 1;
    }
  }
  return { rle: `${body.join('')}!`, x, y };
}

/** @internal Lazy parsing lets URL imports stop before expanding oversized runs. */
export function* iterateRlePoints(text: string, x = 0, y = 0): Generator<[number, number]> {
  const body = text
    .replace(/^\s*#[^\r\n]*/gm, '')
    .replace(/^\s*x\s*=[^\r\n]*/gim, '');
  const originX = Number.isFinite(x) ? x : 0;
  let row = Number.isFinite(y) ? y : 0;
  let column = originX;
  let count = 0;
  let hasCount = false;
  for (const symbol of body) {
    if (symbol === '!') break;
    if (symbol >= '0' && symbol <= '9') {
      count = count * 10 + Number(symbol);
      hasCount = true;
      continue;
    }
    if (symbol !== '$' && symbol !== '.' && !/^[a-z]$/i.test(symbol)) continue;

    const length = hasCount ? count : 1;
    count = 0;
    hasCount = false;
    // Ignore malformed numeric runs instead of overflowing coordinates.
    if (!Number.isSafeInteger(length)) continue;
    if (symbol === '$') {
      row += length;
      column = originX;
    } else if (symbol === 'b' || symbol === '.') {
      column += length;
    } else {
      for (let i = 0; i < length; i++) {
        if (Number.isFinite(column) && Number.isFinite(row)) yield [column, row];
        column++;
      }
    }
  }
}

/** Reads body-only RLE or a commented, header-bearing RLE file. */
export function decodeRle(text: string, x = 0, y = 0): [number, number][] {
  return Array.from(iterateRlePoints(text, x, y));
}
