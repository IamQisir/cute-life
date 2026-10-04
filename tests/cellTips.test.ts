import { describe, expect, it } from 'vitest';
import { CELL_TIPS, POKE_LINES, pokeLine, randomTip } from '../src/ui/cellTips';

describe('CELL_TIPS', () => {
  it('every tip is non-empty', () => {
    for (const tip of CELL_TIPS) {
      expect(tip.text.trim().length).toBeGreaterThan(0);
    }
  });

  it('every tip is <= 90 characters', () => {
    for (const tip of CELL_TIPS) {
      expect(tip.text.length).toBeLessThanOrEqual(90);
    }
  });

  it('contains no "<" or ">" characters', () => {
    for (const tip of CELL_TIPS) {
      expect(tip.text).not.toContain('<');
      expect(tip.text).not.toContain('>');
    }
  });

  it('texts are unique', () => {
    const texts = CELL_TIPS.map((t) => t.text);
    const unique = new Set(texts);
    expect(unique.size).toBe(texts.length);
  });

  it('has at least 20 tips with both kinds present (24-32 total)', () => {
    expect(CELL_TIPS.length).toBeGreaterThanOrEqual(20);
    expect(CELL_TIPS.length).toBeGreaterThanOrEqual(24);
    expect(CELL_TIPS.length).toBeLessThanOrEqual(32);

    const tips = CELL_TIPS.filter((t) => t.kind === 'tip');
    const facts = CELL_TIPS.filter((t) => t.kind === 'fact');

    expect(tips.length).toBeGreaterThan(0);
    expect(facts.length).toBeGreaterThan(0);
    expect(tips.length + facts.length).toBe(CELL_TIPS.length);
  });
});

describe('randomTip', () => {
  it('randomTip(() => 0) is CELL_TIPS[0]', () => {
    expect(randomTip(() => 0)).toBe(CELL_TIPS[0]);
  });

  it('randomTip never returns avoid across many rand values', () => {
    for (const avoidTip of CELL_TIPS) {
      for (let i = 0; i <= 100; i++) {
        const randVal = i / 100;
        const tip = randomTip(() => randVal, avoidTip.text);
        expect(tip.text).not.toBe(avoidTip.text);
      }
    }
  });

  it('defaults to Math.random when no rand function is provided', () => {
    const tip = randomTip();
    expect(CELL_TIPS).toContain(tip);
  });
});

describe('POKE_LINES and pokeLine', () => {
  it('POKE_LINES has 4-5 levels, each with 2-4 lines <= 40 chars', () => {
    expect(POKE_LINES.length).toBeGreaterThanOrEqual(4);
    expect(POKE_LINES.length).toBeLessThanOrEqual(5);

    for (const level of POKE_LINES) {
      expect(level.length).toBeGreaterThanOrEqual(2);
      expect(level.length).toBeLessThanOrEqual(4);
      for (const line of level) {
        expect(line.trim().length).toBeGreaterThan(0);
        expect(line.length).toBeLessThanOrEqual(40);
        expect(line).not.toContain('<');
        expect(line).not.toContain('>');
      }
    }
  });

  it('pokeLine(1) is from POKE_LINES[0]', () => {
    expect(POKE_LINES[0]).toContain(pokeLine(1));
    for (let i = 0; i <= 10; i++) {
      expect(POKE_LINES[0]).toContain(pokeLine(1, () => i / 10));
    }
  });

  it('pokeLine(999) is from the last level', () => {
    const lastLevel = POKE_LINES[POKE_LINES.length - 1];
    expect(lastLevel).toContain(pokeLine(999));
    for (let i = 0; i <= 10; i++) {
      expect(lastLevel).toContain(pokeLine(999, () => i / 10));
    }
  });

  it('pokeLine clamps for n <= 0 to level 0', () => {
    expect(POKE_LINES[0]).toContain(pokeLine(0));
    expect(POKE_LINES[0]).toContain(pokeLine(-1));
  });
});
