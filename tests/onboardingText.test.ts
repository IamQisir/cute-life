import { describe, expect, it } from 'vitest';
import {
  RULES_CARDS,
  TOUR_STEPS,
  WELCOME_LINES,
  WELCOME_CARD,
  type TourTarget,
} from '../src/ui/onboardingText';

describe('onboardingText', () => {
  it('keeps welcome copy brief, plain text and ready for three beats', () => {
    expect(WELCOME_LINES).toHaveLength(3);
    for (const text of [...WELCOME_LINES, ...Object.values(WELCOME_CARD)]) {
      expect(text.trim().length).toBeGreaterThan(0);
      expect(text.length).toBeLessThanOrEqual(90);
      expect(text).not.toMatch(/[<>]/);
    }
    expect(WELCOME_LINES[2]).toContain("Conway's Game of Life");
    expect(WELCOME_CARD.tour).toBe('show me around');
    expect(WELCOME_CARD.play).toBe('let me play');
  });
  describe('TOUR_STEPS', () => {
    it('has exactly 5 tour steps in the expected target order', () => {
      const expectedOrder: TourTarget[] = ['palette', 'controls', 'mode', 'share', 'canvas'];
      expect(TOUR_STEPS).toHaveLength(5);
      expect(TOUR_STEPS.map((s) => s.target)).toEqual(expectedOrder);
    });

    it('has non-empty titles with length <= 28 characters', () => {
      for (const step of TOUR_STEPS) {
        expect(step.title.trim().length).toBeGreaterThan(0);
        expect(step.title.length).toBeLessThanOrEqual(28);
      }
    });

    it('has non-empty texts with length <= 120 characters and no angle brackets', () => {
      for (const step of TOUR_STEPS) {
        expect(step.text.trim().length).toBeGreaterThan(0);
        expect(step.text.length).toBeLessThanOrEqual(120);
        expect(step.text).not.toMatch(/[<>]/);
      }
    });

    it('uses friendly lowercase voice throughout all steps', () => {
      for (const step of TOUR_STEPS) {
        expect(step.title).toBe(step.title.toLowerCase());
        expect(step.text).toBe(step.text.toLowerCase());
      }
    });
  });

  describe('RULES_CARDS', () => {
    it('has cards for sandbox, battle, and siege with matching mode property', () => {
      const modes: Array<'sandbox' | 'battle' | 'siege'> = ['sandbox', 'battle', 'siege'];
      for (const mode of modes) {
        expect(RULES_CARDS[mode]).toBeDefined();
        expect(RULES_CARDS[mode].mode).toBe(mode);
      }
    });

    it('has card titles with length <= 28 characters and lowercase voice', () => {
      for (const card of Object.values(RULES_CARDS)) {
        expect(card.title.trim().length).toBeGreaterThan(0);
        expect(card.title.length).toBeLessThanOrEqual(28);
        expect(card.title).toBe(card.title.toLowerCase());
      }
    });

    it('has all lines non-empty, <= 110 chars, no angle brackets, and lowercase', () => {
      for (const card of Object.values(RULES_CARDS)) {
        expect(card.lines.length).toBeGreaterThan(0);
        for (const line of card.lines) {
          expect(line.text.trim().length).toBeGreaterThan(0);
          expect(line.text.length).toBeLessThanOrEqual(110);
          expect(line.text).not.toMatch(/[<>]/);
          expect(line.text).toBe(line.text.toLowerCase());
        }
        if (card.footer) {
          expect(card.footer.trim().length).toBeGreaterThan(0);
          expect(card.footer.length).toBeLessThanOrEqual(110);
          expect(card.footer).not.toMatch(/[<>]/);
          expect(card.footer).toBe(card.footer.toLowerCase());
        }
      }
    });

    it('has sandbox card with lines for happy, teary, crowded, and born faces', () => {
      const faces = RULES_CARDS.sandbox.lines.map((l) => l.face);
      expect(faces).toContain('happy');
      expect(faces).toContain('teary');
      expect(faces).toContain('crowded');
      expect(faces).toContain('born');
    });

    it('has battle card covering rules with none or fitting faces', () => {
      const faces = RULES_CARDS.battle.lines.map((l) => l.face);
      expect(faces).toContain('none');
      const allText = RULES_CARDS.battle.lines.map((l) => l.text).join(' ');
      expect(allText).toContain('red vs blue');
      expect(allText).toContain('secretly');
      expect(allText).toContain('alive at once');
      expect(allText).toContain('immigration rule');
      expect(allText).toContain('garden');
      expect(allText).toContain('extinct');
    });

    it('has siege card covering rules and crystal damage', () => {
      const faces = RULES_CARDS.siege.lines.map((l) => l.face);
      expect(faces).toContain('born');
      const allText = RULES_CARDS.siege.lines.map((l) => l.text).join(' ');
      expect(allText).toContain('red vs blue');
      expect(allText).toContain('crystal');
      expect(allText).toContain('cells follow the standard game of life. the crystal only keeps score of the damage.');
      expect(allText).toContain('born');
    });
  });
});
