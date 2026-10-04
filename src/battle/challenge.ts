import { decodeRle, encodeRle } from '../share/rle';
import { ARENA_PRESETS, LEGACY_PRESETS, ARENA_SIZES, type ArenaSize, BLUE, RED, validateDeployment } from './arena';
import type { ArenaConfig, Pt, Team } from './arena';

export type BattleRules = 'garden' | 'legacy';
export interface Challenge { army: Pt[]; name?: string; size?: ArenaSize; rules?: BattleRules }
export interface Replay { red: Pt[]; blue: Pt[]; size?: ArenaSize; rules?: BattleRules }
export interface DecodedChallenge extends Challenge { rules: BattleRules }
export interface DecodedReplay extends Replay { rules: BattleRules }

function cleanName(name: string): string {
  return Array.from(name.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim()).slice(0, 24).join('').trim();
}

function checksum(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// XOR/base64url are obfuscation, not security: this only discourages casual
// peeking. The unkeyed checksum detects accidental corruption, not forgery.
function obfuscate(text: string): string {
  let bytes = '';
  for (let i = 0; i < text.length; i++) bytes += String.fromCharCode(text.charCodeAt(i) ^ (0x5a + i % 31));
  return btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeArmy(points: Pt[]): string {
  const { rle, x, y } = encodeRle(points);
  const text = JSON.stringify([x, y, rle]);
  return obfuscate(`${text}:${checksum(text)}`);
}

function decodeArmy(payload: string | null, cfg: ArenaConfig, team: Team): Pt[] | null {
  if (payload === null || !/^[A-Za-z0-9_-]+$/.test(payload)
    || payload.length > 128 + cfg.budget * 32) return null;
  const bytes = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  let decoded = '';
  for (let i = 0; i < bytes.length; i++) decoded += String.fromCharCode(bytes.charCodeAt(i) ^ (0x5a + i % 31));
  if (obfuscate(decoded) !== payload) return null;
  const text = decoded.slice(0, -9);
  if (decoded.slice(-9) !== `:${checksum(text)}`) return null;
  const record: unknown = JSON.parse(text);
  if (!Array.isArray(record) || record.length !== 3) return null;
  const [x, y, rle] = record;
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || typeof rle !== 'string'
    || x < 0 || x >= cfg.width || y < 0 || y >= cfg.height
    || !/^(?:(?:[1-9][0-9]*)?[bo$])*!$/.test(rle)) return null;
  // Bound expansion before passing untrusted RLE to the shared eager decoder.
  let live = 0;
  let column = x;
  let row = y;
  for (const token of rle.matchAll(/([1-9][0-9]*)?([bo$])/g)) {
    const count = token[1] === undefined ? 1 : Number(token[1]);
    if (!Number.isSafeInteger(count)) return null;
    if (token[2] === '$') {
      row += count;
      column = x;
      if (row >= cfg.height) return null;
    } else {
      column += count;
      if (column > cfg.width) return null;
      if (token[2] === 'o') {
        live += count;
        if (live > cfg.budget) return null;
      }
    }
  }
  const points = decodeRle(rle, x, y);
  if (!validateDeployment(cfg, team, points).ok) return null;
  const canonical = encodeRle(points);
  if (canonical.x !== x || canonical.y !== y || canonical.rle !== rle) return null;
  return points;
}

/** `s` names the arena preset; absent means 'small' (links made before sizes existed). */
function sizeParam(params: URLSearchParams): ArenaSize | null {
  const s = params.get('s');
  if (s === null) return 'small';
  return (ARENA_SIZES as string[]).includes(s) ? (s as ArenaSize) : null;
}

function parameters(hash: string, kind: 'c' | 'r'): URLSearchParams | null {
  if (typeof hash !== 'string' || hash.length > 1_000_000) return null;
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const allowed = kind === 'c' ? ['c', 'a', 'n', 's'] : ['r', 'a', 'b', 's'];
  for (const key of params.keys()) {
    if (!allowed.includes(key) || params.getAll(key).length !== 1) return null;
  }
  return params.get(kind) === '1' || params.get(kind) === '2' ? params : null;
}

export function toChallengeHash(challenge: Challenge): string {
  const params = new URLSearchParams({ c: challenge.rules === 'legacy' ? '1' : '2', a: encodeArmy(challenge.army) });
  if (challenge.size && challenge.size !== 'small') params.set('s', challenge.size);
  const name = challenge.name === undefined ? '' : cleanName(challenge.name);
  if (name) params.set('n', name);
  return `#${params.toString()}`;
}

export function fromChallengeHash(hash: string, cfgOverride?: ArenaConfig): DecodedChallenge | null {
  try {
    const params = parameters(hash, 'c');
    if (!params) return null;
    const size = sizeParam(params);
    if (!size) return null;
    const rules: BattleRules = params.get('c') === '1' ? 'legacy' : 'garden';
    const cfg = cfgOverride ?? (rules === 'legacy' ? LEGACY_PRESETS : ARENA_PRESETS)[size];
    if (!validateDeployment(cfg, RED, []).ok) return null;
    const army = decodeArmy(params.get('a'), cfg, RED);
    if (!army) return null;
    const name = cleanName(params.get('n') ?? '');
    return name ? { army, name, size, rules } : { army, size, rules };
  } catch {
    return null;
  }
}

export function toReplayHash(replay: Replay): string {
  const params = new URLSearchParams({ r: replay.rules === 'legacy' ? '1' : '2', a: encodeArmy(replay.red), b: encodeArmy(replay.blue) });
  if (replay.size && replay.size !== 'small') params.set('s', replay.size);
  return `#${params}`;
}

export function fromReplayHash(hash: string, cfgOverride?: ArenaConfig): DecodedReplay | null {
  try {
    const params = parameters(hash, 'r');
    if (!params) return null;
    const size = sizeParam(params);
    if (!size) return null;
    const rules: BattleRules = params.get('r') === '1' ? 'legacy' : 'garden';
    const cfg = cfgOverride ?? (rules === 'legacy' ? LEGACY_PRESETS : ARENA_PRESETS)[size];
    if (!validateDeployment(cfg, RED, []).ok) return null;
    const red = decodeArmy(params.get('a'), cfg, RED);
    const blue = decodeArmy(params.get('b'), cfg, BLUE);
    return red && blue ? { red, blue, size, rules } : null;
  } catch {
    return null;
  }
}
