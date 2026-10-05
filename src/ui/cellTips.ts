import { t } from '../i18n';

/** Short things a woken corner cell can say: app tips and true Game of Life facts. */
export interface CellTip {
  kind: 'tip' | 'fact';
  text: string;
}

export const CELL_TIPS: CellTip[] = [
  ...t.tips.map((text) => ({ kind: 'tip' as const, text })),
  ...t.facts.map((text) => ({ kind: 'fact' as const, text })),
];

/** Lines for repeated pokes, escalating: index 0 = first poke (sleepy), then yawning, then grumpy, ... */
export const POKE_LINES: string[][] = t.pokes;

/** A random tip, never the same text as `avoid` (when there is more than one tip). rand defaults to Math.random. */
export function randomTip(rand?: () => number, avoid?: string): CellTip {
  const r = (rand ?? Math.random)();
  const pool =
    avoid !== undefined && CELL_TIPS.length > 1
      ? CELL_TIPS.filter((t) => t.text !== avoid)
      : CELL_TIPS;
  const list = pool.length > 0 ? pool : CELL_TIPS;
  const idx = Math.min(list.length - 1, Math.max(0, Math.floor(r * list.length)));
  return list[idx];
}

/** A line for the n-th poke in a row (n >= 1); clamps to the last level. */
export function pokeLine(n: number, rand?: () => number): string {
  const levelIdx = Math.min(POKE_LINES.length - 1, Math.max(0, Math.floor(n) - 1));
  const lines = POKE_LINES[levelIdx];
  const r = (rand ?? Math.random)();
  const idx = Math.min(lines.length - 1, Math.max(0, Math.floor(r * lines.length)));
  return lines[idx];
}
