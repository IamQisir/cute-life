import { describe, expect, it } from 'vitest';
import {
  cleanName, fromStampHash, Library, LIMITS, patternFromRle, patternToRle,
  pointsFromRows, rowsFromPoints, toStampHash,
  type CustomPattern, type StampStorage,
} from '../src/life/library';
import { cellCount, PATTERNS } from '../src/life/patterns';

class MemoryStorage implements StampStorage {
  values = new Map<string, string>();
  reads = 0;
  writes = 0;
  get(key: string): string | null {
    this.reads++;
    return this.values.get(key) ?? null;
  }
  set(key: string, value: string): void {
    this.writes++;
    this.values.set(key, value);
  }
}

function added(library: Library, name: string, rows: string[]): CustomPattern {
  const result = library.add(name, rows);
  if ('error' in result) throw new Error(result.error);
  expect(result.duplicate).toBe(false);
  return result.pattern;
}

const gun = `#N Gosper glider gun
#C A period 30 gun.
#C Discovered by Bill Gosper in November 1970.
x = 36, y = 9, rule = B3/S23
24bo11b$22bobo11b$12b2o6b2o12b2o$
11bo3bo4b2o12b2o$2o8bo5bo3b2o14b$
2o8bo3bob2o4bobo11b$10bo5bo7bo11b$
11bo3bo20b$12b2o!`;

describe('stamp rows', () => {
  it('normalises negative coordinates and round-trips without mutating points', () => {
    const points: [number, number][] = [[-5, -4], [-3, -4], [-4, -2], [-5, -4]];
    const before = points.map((point) => [...point]);
    const rows = rowsFromPoints(points)!;
    expect(rows).toEqual(['O.O', '', '.O']);
    expect(pointsFromRows(rows)).toEqual([[0, 0], [2, 0], [1, 2]]);
    expect(rowsFromPoints(pointsFromRows(rows))).toEqual(rows);
    expect(points).toEqual(before);
  });

  it('trims empty edge rows, empty left columns and trailing dots', () => {
    expect(rowsFromPoints(pointsFromRows(['.....', '..O..', '...O.', '..OO.', '.....'])))
      .toEqual(['O', '.O', 'OO']);
    expect(pointsFromRows(['...', '', 'O.'])).toEqual([[0, 2]]);
    expect(rowsFromPoints([])).toBeNull();
  });

  it('enforces live-cell and both side limits inclusively', () => {
    const cells: [number, number][] = Array.from({ length: 401 }, (_, i) => [i % 21, Math.floor(i / 21)]);
    expect(rowsFromPoints(cells)).toBeNull();
    expect(rowsFromPoints(cells.slice(0, 400))).not.toBeNull();
    expect(rowsFromPoints([[0, 0], [64, 0]])).toBeNull();
    expect(rowsFromPoints([[0, 0], [0, 64]])).toBeNull();
    expect(rowsFromPoints([[0, 0], [63, 63]])).toHaveLength(64);
    expect(rowsFromPoints(Array.from({ length: 401 }, () => [1, 1]))).toEqual(['O']);
  });

  it('rejects coordinates that are not safe integers', () => {
    for (const x of [NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(rowsFromPoints([[x, 0]])).toBeNull();
    }
  });
});

describe('stamp names', () => {
  it('trims, removes controls and collapses whitespace', () => {
    expect(cleanName(' \u0000my   stamp\u007f\u0085 ')).toBe('my stamp');
    expect(cleanName('a\tb\nc')).toBe('abc');
    expect(cleanName(' \u0000\n ')).toBe('');
    expect(cleanName('a\u2003\u2003b')).toBe('a b');
  });

  it('caps Unicode code points and retains names as plain strings', () => {
    expect(cleanName('🦋'.repeat(25))).toBe('🦋'.repeat(24));
    expect(cleanName('<b>花</b>')).toBe('<b>花</b>');
  });
});

describe('stamp RLE files', () => {
  it.each(PATTERNS)('round-trips $name', ({ name, rows }) => {
    const text = patternToRle(rows, name);
    expect(text).toContain(`#N ${name}\n`);
    expect(text).toContain('rule = B3/S23\n');
    expect(patternFromRle(text)).toEqual({ name, rows: rowsFromPoints(pointsFromRows(rows)) });
  });

  it('writes tight dimensions and optional names with lines at most 70 columns', () => {
    expect(patternToRle(['...', '.OO.', '.O.', '...']))
      .toBe('x = 2, y = 2, rule = B3/S23\n2o$o!');
    expect(patternToRle([], '')).toBe('x = 0, y = 0, rule = B3/S23\n!');
    const rows = Array.from({ length: 12 }, () => 'O.'.repeat(32));
    const text = patternToRle(rows, ' 🦋 garden ');
    const bodyLines = text.split('\n').slice(2);
    expect(bodyLines.length).toBeGreaterThan(1);
    expect(bodyLines.every((line) => line.length <= 70)).toBe(true);
    expect(patternFromRle(text)).toEqual({ name: '🦋 garden', rows: rows.map((row) => row.slice(0, -1)) });
  });

  it('reads the name and 36 live cells from a wrapped LifeWiki-style file', () => {
    const parsed = patternFromRle(gun, 'fallback')!;
    expect(parsed.name).toBe('Gosper glider gun');
    expect(cellCount(parsed)).toBe(36);
    expect(Math.max(...parsed.rows.map((row) => row.length))).toBe(36);
    expect(parsed.rows).toHaveLength(9);
    expect(patternFromRle(gun.replace(/\n/g, '\r\n'))).toEqual(parsed);
  });

  it('uses a fallback name for bare bodies and gives #N priority, including empty names', () => {
    expect(patternFromRle('bo$2bo$3o!', '  glider  ')).toEqual({ name: 'glider', rows: ['.O', '..O', 'OOO'] });
    expect(patternFromRle('o!')).toEqual({ name: '', rows: ['O'] });
    expect(patternFromRle('#N\n#C comment\no!', 'fallback')).toEqual({ name: '', rows: ['O'] });
    expect(patternFromRle(' O $ . O ', 'test')).toEqual({ name: 'test', rows: ['O', '.O'] });
  });

  it.each([
    'x = 1, y = 1\n2o!', 'x = 1, y = 1\no$o!',
    'x = 1, y = 1\nbo!', 'x = 1, y = 1\n$o!',
    'x = nope, y = 2\no!', 'x = 2, y = 2\nx = 2, y = 2\no!',
  ])('rejects undersized or malformed headers: %j', (text) => {
    expect(patternFromRle(text)).toBeNull();
  });

  it.each(['', '!', '4b!', 'garbage', 'hello world', 'o?o!', 'o!o', '0o!', '2!', '999999999999999999999o!'])
    ('rejects empty or malformed input: %j', (text) => {
      expect(patternFromRle(text)).toBeNull();
    });

  it('rejects oversized patterns without expanding huge live runs', () => {
    for (const text of ['401o!', '1000000000o!', 'o64bo!', 'o64$o!']) {
      expect(patternFromRle(text)).toBeNull();
    }
    expect(patternFromRle('100b100$o!')).toEqual({ name: '', rows: ['O'] });
    expect(patternFromRle('x = 1000, y = 1000\no!')).toEqual({ name: '', rows: ['O'] });
  });
});

describe('stamp library', () => {
  it('loads lazily and persists add/list/rename/remove with stable IDs', () => {
    const storage = new MemoryStorage();
    let tick = 100;
    const library = new Library(storage, { now: () => tick++ });
    expect(storage.reads).toBe(0);
    const first = added(library, ' block ', ['OO', 'OO']);
    const second = added(library, 'line', ['OOO']);
    expect(first.created).toBe(100);
    expect(library.list()).toEqual([second, first]);
    expect(storage.reads).toBe(1);
    expect(storage.values.has('cute-life.stamps.v1')).toBe(true);
    expect(new Library(storage).list()).toEqual([second, first]);
    expect(library.rename(first.id, ' renamed ')).toBe(true);
    expect(library.remove(second.id)).toBe(true);
    expect(new Library(storage).list()).toEqual([{ ...first, name: 'renamed' }]);
    expect(library.rename('absent', 'x')).toBe(false);
    expect(library.remove('absent')).toBe(false);
  });

  it('detects translated duplicate shapes without persisting or renaming them', () => {
    const storage = new MemoryStorage();
    const library = new Library(storage);
    const first = added(library, 'shape', ['O', '.O']);
    const writes = storage.writes;
    expect(library.add('other name', ['.....', '..O..', '...O.', '.....']))
      .toEqual({ pattern: first, duplicate: true });
    expect(storage.writes).toBe(writes);
    expect(library.list()).toHaveLength(1);
    added(library, 'rotated', ['.O', 'O']);
    expect(library.list()).toHaveLength(2);
  });

  it('uses defaults and numbered names for add and rename', () => {
    const library = new Library(null);
    const first = added(library, '', ['O']);
    expect(first.name).toBe('my stamp');
    expect(added(library, '\u0000', ['OO']).name).toBe('my stamp 2');
    const third = added(library, 'my stamp', ['OOO']);
    expect(third.name).toBe('my stamp 3');
    expect(library.rename(third.id, 'my stamp')).toBe(true);
    expect(library.list()[0].name).toBe('my stamp 3');
    const base = '🦋'.repeat(24);
    expect(added(library, base, ['OOOO']).name).toBe(base);
    expect(added(library, base, ['OOOOO']).name).toBe('🦋'.repeat(22) + ' 2');
    expect(library.rename(first.id, '<b>plain</b>')).toBe(true);
    expect(library.list().find((p) => p.id === first.id)?.name).toBe('<b>plain</b>');
  });

  it('validates raw row dimensions, characters and population before adding', () => {
    const library = new Library(null);
    expect(library.add('empty', [])).toEqual({ error: 'empty' });
    expect(library.add('dead', ['...', ''])).toEqual({ error: 'empty' });
    for (const rows of [['X'], ['o'], ['O'.repeat(65)], Array(65).fill('O'), Array(21).fill('O'.repeat(20))]) {
      expect(library.add('bad', rows)).toEqual({ error: 'too-big' });
    }
    expect(added(library, 'trimmed', ['....', '..O.', '....']).rows).toEqual(['O']);
    expect(added(library, '400 cells', Array(20).fill('O'.repeat(20))).rows).toHaveLength(20);
  });

  it('is full at 48 but still returns duplicates and frees space on removal', () => {
    const library = new Library(null);
    for (let gap = 1; gap <= LIMITS.maxPatterns; gap++) added(library, 'stamp', ['O' + '.'.repeat(gap) + 'O']);
    expect(library.list()).toHaveLength(48);
    expect(library.add('extra', ['OOO'])).toEqual({ error: 'full' });
    expect(library.add('duplicate', ['O.O'])).toMatchObject({ duplicate: true });
    expect(library.remove(library.list()[0].id)).toBe(true);
    added(library, 'extra', ['OOO']);
  });

  it('keeps IDs unique across equal timestamps and reloads', () => {
    const storage = new MemoryStorage();
    const library = new Library(storage, { now: () => 42 });
    const first = added(library, 'one', ['O']);
    const second = added(library, 'two', ['OO']);
    const restored = new Library(storage, { now: () => 42 });
    expect(restored.list()).toEqual([second, first]);
    const third = added(restored, 'three', ['OOO']);
    expect(new Set([first.id, second.id, third.id]).size).toBe(3);
    expect(new Library(storage).list()).toEqual([third, second, first]);
  });

  it('returns defensive copies from add and list', () => {
    const library = new Library(null);
    const result = added(library, 'one', ['O']);
    result.rows[0] = 'OO';
    result.name = 'changed';
    const list = library.list();
    list[0].rows.push('O');
    list.pop();
    expect(library.list()[0]).toMatchObject({ name: 'one', rows: ['O'] });
    const duplicate = library.add('same', ['O']);
    if ('error' in duplicate) throw new Error(duplicate.error);
    duplicate.pattern.rows[0] = 'OOO';
    expect(library.list()[0].rows).toEqual(['O']);
  });

  it.each(['{broken', '{}', 'null', '123', '"wrong"'])('treats corrupt storage %j as empty', (value) => {
    const storage = new MemoryStorage();
    storage.values.set('cute-life.stamps.v1', value);
    const library = new Library(storage);
    expect(library.list()).toEqual([]);
    added(library, 'works', ['O']);
    expect(new Library(storage).list()).toHaveLength(1);
  });

  it('skips invalid stored entries while retaining and normalising valid ones', () => {
    const storage = new MemoryStorage();
    const valid = { id: 'saved', name: ' good ', rows: ['....', '.OO.', '....'], created: 3 };
    storage.values.set('custom-key', JSON.stringify([
      null, 5, {}, { ...valid, id: '' }, { ...valid, name: 5 },
      { ...valid, created: '3' }, { ...valid, created: -1 }, { ...valid, created: 1.5 },
      { ...valid, rows: ['X'] }, { ...valid, rows: ['...'] },
      { ...valid, rows: ['O'.repeat(65)] }, { ...valid, rows: [5] }, valid,
    ]));
    const library = new Library(storage, { key: 'custom-key' });
    expect(library.list()).toEqual([{ ...valid, name: 'good', rows: ['OO'] }]);
    added(library, 'next', ['O']);
    expect(new Library(storage, { key: 'custom-key' }).list()).toHaveLength(2);
  });

  it('continues in memory when get and set throw', () => {
    const library = new Library({
      get() { throw new Error('get unavailable'); },
      set() { throw new Error('set unavailable'); },
    });
    expect(library.list()).toEqual([]);
    const first = added(library, 'one', ['O']);
    expect(library.rename(first.id, 'two')).toBe(true);
    expect(library.list()[0].name).toBe('two');
    expect(library.remove(first.id)).toBe(true);
    expect(library.list()).toEqual([]);
  });

  it('retains loaded and new entries when only set throws', () => {
    const saved = { id: 'saved', name: 'saved', rows: ['O'], created: 1 };
    const library = new Library({
      get: () => JSON.stringify([saved]),
      set() { throw new Error('read only'); },
    });
    added(library, 'new', ['OO']);
    expect(library.list()[1]).toEqual(saved);
  });
});

describe('stamp links', () => {
  it('round-trips Unicode and URL punctuation using separate keys', () => {
    const name = '花 🦋 & + # / ?';
    const hash = toStampHash(name, ['..O.', '...O', '..OO']);
    expect(hash.startsWith('#stamp=1&')).toBe(true);
    expect(fromStampHash(hash)).toEqual({ name, rows: ['O', '.O', 'OO'] });
    expect(fromStampHash(hash.slice(1))).toEqual(fromStampHash(hash));
    expect([...new URLSearchParams(hash.slice(1)).keys()]).toEqual(['stamp', 'n', 'b']);
  });

  it.each([
    '#v=1&p=o!', '#c=1&p=o!', '#r=1&p=o!', '#stamp=2&b=o!',
    '#stamp=01&b=o!', '#stamp=1', '#b=o!', '#stamp=1&b=o!&unknown=x',
    '#stamp=1&b=o!&v=1', '#stamp=1&b=o!&c=1', '#stamp=1&b=o!&r=1',
    '#stamp=1&stamp=1&b=o!', '#stamp=1&b=o!&b=2o!', '#stamp=1&b=o!&n=a&n=b',
    '#stamp=1&b=garbage', '#stamp=1&b=%23N+name%0Ao!',
    '#stamp=1&b=401o!', '#stamp=1&b=1000000000o!', '#stamp=1&b=o64bo!', '#stamp=1&b=o64$o!',
  ])('rejects invalid or colliding hash %j', (hash) => {
    expect(fromStampHash(hash)).toBeNull();
  });

  it('allows an omitted name and rejects an empty pattern', () => {
    expect(fromStampHash('#stamp=1&b=o!')).toEqual({ name: '', rows: ['O'] });
    expect(fromStampHash(toStampHash('', []))).toBeNull();
  });

  it('never throws on random strings or malformed percent escapes', () => {
    let seed = 0x12345678;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    };
    for (let i = 0; i < 250; i++) {
      const input = Array.from({ length: random() % 100 }, () => String.fromCharCode(random() % 65536)).join('');
      expect(() => fromStampHash(input)).not.toThrow();
      expect(() => patternFromRle(input)).not.toThrow();
    }
    for (const input of ['%', '%E0%A4%A', '#stamp=1&b=%ZZ', '#stamp=1&n=%ED%A0%80&b=o!']) {
      expect(() => fromStampHash(input)).not.toThrow();
    }
  });
});
