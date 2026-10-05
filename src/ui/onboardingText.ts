import { t } from '../i18n';

/** Which HUD area a tour step points at (the UI maps these to elements). */
export const WELCOME_LINES = t.welcome.lines;

export const WELCOME_CARD = t.welcome.card;

export type TourTarget = 'palette' | 'controls' | 'mode' | 'share' | 'canvas';

export interface TourStep {
  target: TourTarget;
  title: string;
  text: string;
}

const TOUR_TARGETS: TourTarget[] = ['palette', 'controls', 'mode', 'share', 'canvas'];

export const TOUR_STEPS: TourStep[] = TOUR_TARGETS.map((target, i) => ({ target, ...t.tour[i] }));

export interface RulesLine {
  face: 'happy' | 'teary' | 'crowded' | 'born' | 'none';
  text: string;
}

export interface RulesCard {
  mode: 'sandbox' | 'battle' | 'siege';
  title: string;
  lines: RulesLine[];
  footer?: string;
}

const FACES: Record<'sandbox' | 'battle' | 'siege', RulesLine['face'][]> = {
  sandbox: ['happy', 'teary', 'crowded', 'born'],
  battle: ['none', 'none', 'born', 'happy', 'teary'],
  siege: ['none', 'none'],
};

function rulesCard(mode: 'sandbox' | 'battle' | 'siege'): RulesCard {
  const { title, lines, footer } = t.rules[mode];
  return { mode, title, lines: lines.map((text, i) => ({ face: FACES[mode][i], text })), footer };
}

export const RULES_CARDS: Record<'sandbox' | 'battle' | 'siege', RulesCard> = {
  sandbox: rulesCard('sandbox'),
  battle: rulesCard('battle'),
  siege: rulesCard('siege'),
};
