import { encodeRle, iterateRlePoints } from '../share/rle';

export interface CustomPattern {
  id: string;
  name: string;
  rows: string[];
  created: number;
}

export const LIMITS = { maxCells: 400, maxSide: 64, maxPatterns: 48, maxName: 24 } as const;

/** Tight, translation-independent rows, with duplicate points counted once. */
export function rowsFromPoints(points: [number, number][]): string[] | null {
  const unique = new Map<string, [number, number]>();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return null;
    unique.set(`${x},${y}`, [x, y]);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    if (unique.size > LIMITS.maxCells || maxX - minX >= LIMITS.maxSide ||
        maxY - minY >= LIMITS.maxSide) return null;
  }
  if (!unique.size) return null;
  const rows: string[][] = Array.from({ length: maxY - minY + 1 }, () => []);
  for (const [x, y] of unique.values()) {
    const row = rows[y - minY];
    while (row.length <= x - minX) row.push('.');
    row[x - minX] = 'O';
  }
  return rows.map((row) => row.join(''));
}

export function pointsFromRows(rows: string[]): [number, number][] {
  const points: [number, number][] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === 'O') points.push([x, y]);
    }
  });
  return points;
}

export function cleanName(name: string): string {
  return Array.from(name.replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/\s+/gu, ' ').trim()).slice(0, LIMITS.maxName).join('');
}

/** Emits a standard RLE file using the live cells' tight bounding box. */
export function patternToRle(rows: string[], name?: string): string {
  const points = pointsFromRows(rows);
  const { rle, x, y } = encodeRle(points);
  const width = points.length ? Math.max(...points.map(([px]) => px)) - x + 1 : 0;
  const height = points.length ? Math.max(...points.map(([, py]) => py)) - y + 1 : 0;
  const title = name === undefined ? '' : cleanName(name);
  const body = rle.match(/.{1,70}/g)!.join('\n');
  return `${title ? `#N ${title}\n` : ''}x = ${width}, y = ${height}, rule = B3/S23\n${body}`;
}

/** Validates syntax before using the shared decoder, which is deliberately tolerant. */
export function patternFromRle(text: string, name?: string): { name: string; rows: string[] } | null {
  try {
    let title = name ?? '';
    let foundName = false;
    let dimensions: [number, number] | undefined;
    const bodyLines: string[] = [];
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) {
        const named = /^#N(?:\s+(.*))?$/i.exec(trimmed);
        if (named && !foundName) {
          title = named[1] ?? '';
          foundName = true;
        }
        continue;
      }
      if (/^x\s*=/i.test(trimmed)) {
        const header = /^x\s*=\s*(\d+)\s*,\s*y\s*=\s*(\d+)(?:\s*,\s*rule\s*=\s*[^,]+)?\s*$/i.exec(trimmed);
        if (!header || dimensions) return null;
        dimensions = [Number(header[1]), Number(header[2])];
        if (!dimensions.every((side) => Number.isSafeInteger(side) && side >= 0)) return null;
      } else {
        bodyLines.push(trimmed);
      }
    }
    const body = bodyLines.join('').replace(/\s/g, '').toLowerCase();
    if (!/^(?:\d*[bo.$])*!?$/.test(body)) return null;
    for (const token of body.matchAll(/(\d+)[bo.$]/g)) {
      const count = Number(token[1]);
      if (!Number.isSafeInteger(count) || count < 1) return null;
    }
    const points: [number, number][] = [];
    for (const point of iterateRlePoints(body)) {
      if (points.length === LIMITS.maxCells) return null;
      if (dimensions && (point[0] >= dimensions[0] || point[1] >= dimensions[1])) return null;
      points.push(point);
    }
    const rows = rowsFromPoints(points);
    return rows ? { name: cleanName(title), rows } : null;
  } catch {
    return null;
  }
}

export interface StampStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

type RowValidation = { rows: string[] } | { error: 'empty' | 'too-big' };

function validateRows(value: unknown): RowValidation {
  if (!Array.isArray(value) || value.length > LIMITS.maxSide ||
      value.some((row) => typeof row !== 'string' || row.length > LIMITS.maxSide || !/^[O.]*$/.test(row))) {
    return { error: 'too-big' };
  }
  const points = pointsFromRows(value);
  if (!points.length) return { error: 'empty' };
  const rows = rowsFromPoints(points);
  return rows ? { rows } : { error: 'too-big' };
}

function copy(pattern: CustomPattern): CustomPattern {
  return { ...pattern, rows: [...pattern.rows] };
}

export class Library {
  private readonly key: string;
  private readonly now: () => number;
  private patterns: CustomPattern[] = [];
  private loaded = false;
  private counter = 0;

  constructor(private readonly storage: StampStorage | null, opts?: { key?: string; now?: () => number }) {
    this.key = opts?.key ?? 'cute-life.stamps.v1';
    this.now = opts?.now ?? Date.now;
  }

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const stored: unknown = JSON.parse(this.storage?.get(this.key) ?? '[]');
      if (!Array.isArray(stored)) return;
      for (const entry of stored) {
        if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !entry.id ||
            typeof entry.name !== 'string' || !Number.isSafeInteger(entry.created) || entry.created < 0) continue;
        const validated = validateRows(entry.rows);
        if ('error' in validated || this.patterns.some((p) => p.id === entry.id ||
            JSON.stringify(p.rows) === JSON.stringify(validated.rows))) continue;
        this.patterns.push({ id: entry.id, name: this.uniqueName(entry.name), rows: validated.rows, created: entry.created });
      }
      this.patterns.sort((a, b) => b.created - a.created);
      this.patterns = this.patterns.slice(0, LIMITS.maxPatterns);
    } catch {
      // Storage may be unavailable or corrupt; the in-memory library still works.
    }
  }

  private persist(): void {
    try {
      this.storage?.set(this.key, JSON.stringify(this.patterns));
    } catch {
      // Keep the successful in-memory mutation even if persistence fails.
    }
  }

  private uniqueName(name: string, exceptId?: string): string {
    const base = cleanName(name) || 'my stamp';
    let candidate = base;
    let suffix = 2;
    while (this.patterns.some((p) => p.id !== exceptId && p.name === candidate)) {
      const tail = ` ${suffix++}`;
      candidate = Array.from(base).slice(0, LIMITS.maxName - tail.length).join('') + tail;
    }
    return candidate;
  }

  list(): CustomPattern[] {
    this.load();
    return this.patterns.map(copy);
  }

  add(name: string, rows: string[]): { pattern: CustomPattern; duplicate: boolean } | { error: 'empty' | 'too-big' | 'full' } {
    this.load();
    const validated = validateRows(rows);
    if ('error' in validated) return validated;
    const duplicate = this.patterns.find((p) => JSON.stringify(p.rows) === JSON.stringify(validated.rows));
    if (duplicate) return { pattern: copy(duplicate), duplicate: true };
    if (this.patterns.length >= LIMITS.maxPatterns) return { error: 'full' };
    const timestamp = this.now();
    const created = Number.isSafeInteger(timestamp) && timestamp >= 0 ? timestamp : Date.now();
    let id: string;
    do { id = `s${created.toString(36)}-${(this.counter++).toString(36)}`; }
    while (this.patterns.some((p) => p.id === id));
    const pattern = { id, name: this.uniqueName(name), rows: validated.rows, created };
    this.patterns.unshift(pattern);
    this.persist();
    return { pattern: copy(pattern), duplicate: false };
  }

  rename(id: string, name: string): boolean {
    this.load();
    const pattern = this.patterns.find((p) => p.id === id);
    if (!pattern) return false;
    pattern.name = this.uniqueName(name, id);
    this.persist();
    return true;
  }

  remove(id: string): boolean {
    this.load();
    const index = this.patterns.findIndex((p) => p.id === id);
    if (index < 0) return false;
    this.patterns.splice(index, 1);
    this.persist();
    return true;
  }
}

export function toStampHash(name: string, rows: string[]): string {
  const { rle } = encodeRle(pointsFromRows(rows));
  return `#${new URLSearchParams({ stamp: '1', n: cleanName(name), b: rle }).toString()}`;
}

export function fromStampHash(hash: string): { name: string; rows: string[] } | null {
  try {
    const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
    const keys = [...params.keys()];
    if (keys.some((key) => !['stamp', 'n', 'b'].includes(key)) || new Set(keys).size !== keys.length ||
        params.get('stamp') !== '1' || !params.has('b')) return null;
    const body = params.get('b')!;
    // A stamp link contains a bare body; file metadata belongs in RLE imports.
    if (/[#=]/.test(body)) return null;
    return patternFromRle(body, params.get('n') ?? '');
  } catch {
    return null;
  }
}
