/** Short things a woken corner cell can say: app tips and true Game of Life facts. */
export interface CellTip {
  kind: 'tip' | 'fact';
  text: string;
}

export const CELL_TIPS: CellTip[] = [
  { kind: 'tip', text: 'psst ~ press space to play or pause your world anytime' },
  { kind: 'tip', text: 'psst ~ press R to rotate a stamp before you place it' },
  { kind: 'tip', text: 'tip ~ hold shift while clicking to keep stamping patterns' },
  { kind: 'tip', text: 'tip ~ right-drag or hold space to pan across the canvas' },
  { kind: 'tip', text: 'psst ~ use your scroll wheel or pinch to zoom in and out' },
  { kind: 'tip', text: 'tip ~ drag any card from the stamp palette onto the canvas' },
  { kind: 'tip', text: 'psst ~ use the select tool to box up cells and save stamps' },
  { kind: 'tip', text: 'tip ~ tap record to make a little video clip of your cells' },
  { kind: 'tip', text: 'psst ~ share links let your friends visit your living world' },
  { kind: 'tip', text: 'tip ~ follow camera keeps your growing colony right in view' },
  { kind: 'tip', text: 'psst ~ hop into battle! mode for secret deployment against AI' },
  { kind: 'tip', text: 'tip ~ challenge a friend link lets you duel on a shared arena' },
  { kind: 'tip', text: 'psst ~ tap sprinkle to scatter a burst of fresh living cells' },
  { kind: 'tip', text: 'tip ~ the sound button cycles sound on, music only, or off' },
  { kind: 'fact', text: 'fun fact ~ John Conway invented the Game of Life in 1970' },
  { kind: 'fact', text: 'did you know? ~ Martin Gardner introduced Life in October 1970' },
  { kind: 'fact', text: 'fun fact ~ dead cells with exactly 3 neighbours spring to life' },
  { kind: 'fact', text: 'did you know? ~ living cells survive only with 2 or 3 neighbours' },
  { kind: 'fact', text: 'fun fact ~ the 2x2 block is the most common still life' },
  { kind: 'fact', text: 'did you know? ~ the blinker is the smallest period 2 oscillator' },
  { kind: 'fact', text: 'fun fact ~ a glider moves one cell diagonally every 4 generations' },
  { kind: 'fact', text: 'did you know? ~ Gosper glider gun was the first infinite grower' },
  { kind: 'fact', text: 'fun fact ~ the R-pentomino takes 1103 generations to stabilise' },
  { kind: 'fact', text: 'did you know? ~ the acorn pattern stabilises after 5206 steps' },
  { kind: 'fact', text: 'fun fact ~ diehard vanishes completely after 130 generations' },
  { kind: 'fact', text: "did you know? ~ Conway's Game of Life is actually Turing complete" },
  { kind: 'fact', text: 'fun fact ~ spaceships are patterns that crawl across the grid' },
  { kind: 'fact', text: 'did you know? ~ oscillators repeat their dance again and again' },
];

/** Lines for repeated pokes, escalating: index 0 = first poke (sleepy), then yawning, then grumpy, ... */
export const POKE_LINES: string[][] = [
  // Level 0: sleepy (first poke)
  [
    'mm? five more minutes...',
    'zz... who woke me up? ~',
    'just a little more sleep...',
  ],
  // Level 1: yawning
  [
    '*yaaaawn* ...is it morning?',
    'stretching my tiny corners ~',
    'oh, hello there... *yawn*',
  ],
  // Level 2: grumpy puffed cheeks
  [
    'hmph! i was having a nice dream',
    'hey, stop poking my cheeks!',
    'pout ~ why poke a sleeping cell?',
  ],
  // Level 3: very grumpy
  [
    'grrr! i am not a button!',
    'poke again and i will decay ~',
    'seriously? again?! hmph.',
  ],
  // Level 4: gives up and giggles
  [
    'hehe, okay okay, that tickles! ~',
    'alright, i am awake! *giggle*',
    'hehe fine, you win ~ good morning!',
  ],
];

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
