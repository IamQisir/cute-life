/** Which HUD area a tour step points at (the UI maps these to elements). */
export const WELCOME_LINES = [
  'welcome to cute life ~',
  'a tiny world where cells are born, live and dance',
  "every cell follows four simple rules — Conway's Game of Life",
] as const;

export const WELCOME_CARD = {
  title: 'your little world awaits ~',
  text: 'draw a few friends, press play, and see what grows.',
  tour: 'show me around',
  play: 'let me play',
  skip: 'skip',
} as const;

export type TourTarget = 'palette' | 'controls' | 'mode' | 'share' | 'canvas';

export interface TourStep {
  target: TourTarget;
  title: string;
  text: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: 'palette',
    title: 'stamps palette',
    text: 'click or drag a structure from the stamps palette on the left onto the canvas ~',
  },
  {
    target: 'controls',
    title: 'controls',
    text: 'play, step, speed, sprinkle, and clear at the bottom (space also plays) ~',
  },
  {
    target: 'mode',
    title: 'modes',
    text: 'the mode button top-right switches between sandbox, garden battle and crystal siege (siege is coming soon ~)',
  },
  {
    target: 'share',
    title: 'share and record',
    text: 'record a little video and share a link to your world with the buttons top-right ~',
  },
  {
    target: 'canvas',
    title: 'zoom in & out',
    text: 'zoom in to meet every cell ~ zoom out and they team up into creatures ~ scroll or pinch to zoom, right-drag to move',
  },
];

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

export const RULES_CARDS: Record<'sandbox' | 'battle' | 'siege', RulesCard> = {
  sandbox: {
    mode: 'sandbox',
    title: 'sandbox rules',
    lines: [
      { face: 'happy', text: 'a cell with 2 or 3 neighbours survives ~' },
      { face: 'teary', text: 'fewer than 2 neighbours, dies of loneliness' },
      { face: 'crowded', text: 'more than 3 neighbours, dies of crowding' },
      { face: 'born', text: 'an empty spot with exactly 3 neighbours gets a new cell ~' },
    ],
    footer: 'press play and watch ~',
  },
  battle: {
    mode: 'battle',
    title: 'garden battle',
    lines: [
      { face: 'none', text: 'red vs blue: deploy your army secretly within your zone with a cell budget ~' },
      { face: 'none', text: 'the opponent cannot see your army, then both armies come alive at once' },
      { face: 'born', text: 'immigration rule: newborn cells take the colour of the majority of parents' },
      { face: 'happy', text: 'your cells paint flowers in the garden as they pass ~ flowers score' },
      { face: 'teary', text: 'the battle ends when one side goes extinct or at the generation limit' },
    ],
    footer: 'bloom the most flowers in the garden to win ~',
  },
  siege: {
    mode: 'siege',
    title: 'crystal siege',
    lines: [
      { face: 'none', text: 'coming soon: two crystals stand on the field, ready for siege ~' },
      { face: 'none', text: 'deploy guns and eaters to defend your crystal and crack theirs' },
    ],
    footer: 'a new battle mode is coming soon ~',
  },
};
