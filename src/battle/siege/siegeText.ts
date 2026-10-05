import type { UnitId } from './prefabs';

/** Short name and one-line hover blurb per unit, for the siege palette cards. */
export const UNIT_TEXT: Record<UnitId, { name: string; blurb: string }> = {
  gosperglidergun: { name: 'gosper gun', blurb: 'shoots a steady stream of gliders across the field ~' },
  eater1: { name: 'eater', blurb: 'swallows gliders that arrive at the right angle ~' },
  lwss: { name: 'lwss', blurb: 'a swift spaceship sailing straight across the field ~' },
  glider: { name: 'glider', blurb: 'a tiny scout gliding diagonally across the field ~' },
  block: { name: 'block', blurb: 'a sturdy little still life that holds its ground ~' },
  rpentomino: { name: 'r-pentomino', blurb: 'a tiny spark that erupts into chaotic life ~' },
};

/** Why a unit can't be placed (toast text). */
export const PROBLEM_TEXT: Record<'zone' | 'crystal' | 'overlap' | 'limit' | 'budget', string> = {
  zone: 'keep it inside your zone ~',
  crystal: 'stay at least 2 cells away from the crystal ~',
  overlap: 'units cannot overlap ~',
  limit: 'you reached the limit for this unit ~',
  budget: 'not enough cells left in your budget ~',
};

/** Names for the sample armies the opponent picks from (shown when revealed, e.g. "vs the cannoneer"). */
export const SAMPLE_NAMES: Record<'artillery' | 'fortress' | 'rush' | 'hybrid' | 'breach' | 'wave', string> = {
  artillery: 'the cannoneer',
  fortress: 'the fortress',
  rush: 'the spaceship rush',
  hybrid: 'the hybrid',
  breach: 'the breach',
  wave: 'the spaceship wave',
};

/** Header and result texts. */
export const SIEGE_TEXT = {
  deployTitle: 'deploy your red army',
  deploySub: '{left} of {budget} cells left · crack the blue crystal',
  revealTitle: 'armies awaken ~',
  battleTitle: 'siege underway ~',
  pausedTitle: 'paused ~',
  opponentHidden: 'vs a secret sample army',
  youWin: 'you win ~',
  youLose: 'you lose ~',
  draw: "it's a draw ~",
  crystalBroken: 'the {team} crystal broke at generation {gen} ~',
  timeUp: 'time ran out · red {red} hp : blue {blue} hp ~',
  hpLabel: 'crystal hp',
  emptyArmy: 'place a few units first ~',
  removeHint: 'click a unit to pick it up ~ r rotates ~ f flips ~',
} as const;
