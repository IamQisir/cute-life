import { BLUE, RED, paintCells, placeArmies, population, stepGrid, type Grid } from '../arena';
import { army, type Orientation, type Prefabs, type Stamp } from './prefabs';
import { DEFAULT_RULES, arenaConfig, crystalRect, initialState, simulate, stepSiege as stepCapture, type SiegeRules } from './siegeSim';
import { BEST_ESCORT, BREACH_ESCORT, LOWER_GUN, UPPER_EATER, UPPER_GUN, gliders, legal, mirrorArmy, mixed,
  percent, textRecipe, trains, whole, type ExperimentReport, type Table } from './experiments';

export const CAPTURE_RULES: SiegeRules = { ...DEFAULT_RULES, scoring: 'capture', hitbox: 12, hp: 64, cap: 8, unitsPerHP: 16, threshold: 0.4, hold: 16 };
/** Fastest searched attack at CAPTURE_RULES; the gun is present, but four LWSS also capture without it. */
export const CAPTURE_ATTACK: Stamp[] = [
  { id: 'gosperglidergun', x: 51, y: 4, orientation: 7 },
  { id: 'lwss', x: 12, y: 56, orientation: 2 },
  { id: 'lwss', x: 26, y: 50, orientation: 2 },
  { id: 'lwss', x: 40, y: 56, orientation: 2 },
  { id: 'lwss', x: 54, y: 50, orientation: 2 },
];
export const CAPTURE_PARAMETERS = [10, 12, 14].flatMap(hitbox => [0.4, 0.5, 0.6, 0.75].flatMap(threshold =>
  [0, 8, 16, 32].map(hold => ({ ...CAPTURE_RULES, hitbox, threshold, hold }))));
const mounts: Stamp[] = [UPPER_GUN, LOWER_GUN,
  { id: 'gosperglidergun', x: 24, y: 4, orientation: 0 }, { id: 'gosperglidergun', x: 24, y: 83, orientation: 6 }];
interface History { red: number[]; blue: number[]; liveRed: number; liveBlue: number; staticRed: boolean; staticBlue: boolean }
export interface CaptureOutcome { redGen: number | null; blueGen: number | null; end: number; winner: 'red' | 'blue' | 'draw'; red: number; blue: number }
/** Replay the same per-generation fractions for tuning. H=0 captures immediately; H>0 counts qualifying observations. */
export function captureOutcome(r: SiegeRules, history: Pick<History, 'red' | 'blue'>): CaptureOutcome {
  let redHold = 0, blueHold = 0;
  for (let g = 1; g <= r.generations; g++) {
    redHold = history.red[g] >= r.threshold ? redHold + 1 : 0;
    blueHold = history.blue[g] >= r.threshold ? blueHold + 1 : 0;
    const red = redHold >= Math.max(1, r.hold), blue = blueHold >= Math.max(1, r.hold);
    if (red || blue) return { redGen: red ? g : null, blueGen: blue ? g : null, end: g,
      winner: red && blue ? 'draw' : red ? 'blue' : 'red', red: history.red[g], blue: history.blue[g] };
  }
  const red = history.red[r.generations], blue = history.blue[r.generations];
  return { redGen: null, blueGen: null, end: r.generations, winner: red === blue ? 'draw' : red < blue ? 'red' : 'blue', red, blue };
}
/** A single trusted Life trajectory, three observer boxes. No threshold or paint feeds back into evolution. */
function trajectory(p: Prefabs, red: Stamp[], blue: Stamp[], seed?: Grid): Map<number, History> {
  const r = { ...CAPTURE_RULES, hitbox: 14 };
  let grid = seed ?? placeArmies(arenaConfig(r), army(p, red), army(p, blue));
  const paint = initialState(r, grid).paint!;
  const result = new Map<number, History>();
  const boxes = [10, 12, 14].map(hitbox => {
    const history: History = { red: [0], blue: [0], liveRed: 0, liveBlue: 0, staticRed: false, staticBlue: false };
    result.set(hitbox, history);
    return { hitbox, history, red: crystalRect({ ...r, hitbox }, RED), blue: crystalRect({ ...r, hitbox }, BLUE),
      lastRed: new Uint8Array(hitbox ** 2), lastBlue: new Uint8Array(hitbox ** 2), changeRed: 0, changeBlue: 0 };
  });
  for (let g = 1; g <= r.generations; g++) {
    grid = stepGrid(grid, r.width, r.height, false, false);
    paintCells(paint, grid);
    for (const b of boxes) for (const team of [RED, BLUE] as const) {
      const box = team === RED ? b.red : b.blue;
      let enemies = 0, live = 0, changed = false, site = 0;
      const previous = team === RED ? b.lastRed : b.lastBlue;
      for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) {
        const i = y * r.width + x, enemy = team === RED ? BLUE : RED;
        if (paint[i] === enemy) enemies++;
        if (grid[i] === enemy) live++;
        if (previous[site] !== grid[i]) changed = true;
        previous[site++] = grid[i];
      }
      b.history[team === RED ? 'red' : 'blue'].push(enemies / b.hitbox ** 2);
      if (team === RED) {
        if (changed) b.changeRed = g;
        b.history.liveRed = live / b.hitbox ** 2;
      } else {
        if (changed) b.changeBlue = g;
        b.history.liveBlue = live / b.hitbox ** 2;
      }
    }
  }
  for (const b of boxes) {
    b.history.staticRed = b.changeRed <= r.generations - 64;
    b.history.staticBlue = b.changeBlue <= r.generations - 64;
  }
  return result;
}
interface Summary {
  n: number; captures: number; gens: number[]; draws: number; timeouts: number; redWins: number; blueWins: number;
  staticWins: number; best: Stamp[]; bestGen: number; bestFraction: number;
}
const summary = (): Summary => ({ n: 0, captures: 0, gens: [], draws: 0, timeouts: 0, redWins: 0, blueWins: 0,
  staticWins: 0, best: [], bestGen: Infinity, bestFraction: 0 });
function tally(s: Summary, o: CaptureOutcome, h: History, red: Stamp[]) {
  s.n++;
  if (o.redGen !== null || o.blueGen !== null) { s.captures++; s.gens.push(o.end); } else s.timeouts++;
  if (o.winner === 'draw') s.draws++;
  if (o.winner === 'red') s.redWins++;
  if (o.winner === 'blue') s.blueWins++;
  // Timeout victories with a stationary enemy population in the losing crystal (64-generation window).
  if (o.end === 640 && o.redGen === null && o.blueGen === null &&
    (o.winner === 'red' && h.staticBlue && h.liveBlue > 0 || o.winner === 'blue' && h.staticRed && h.liveRed > 0)) s.staticWins++;
  if (o.blueGen !== null && o.winner === 'red' && o.blueGen < s.bestGen ||
    s.bestGen === Infinity && o.blueGen === null && o.blue > s.bestFraction) {
    s.best = red; s.bestGen = o.blueGen ?? Infinity; s.bestFraction = o.blue;
  }
}
const median = (s: Summary): number | null => {
  if (!s.gens.length) return null;
  const a = [...s.gens].sort((a, b) => a - b), i = Math.floor(a.length / 2);
  return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
};
const stats = (s: Summary): Table['rows'][number] => {
  const m = median(s);
  return [s.n, percent(s.captures, s.n), m, m === null ? null : (m / 8).toFixed(2), s.draws, s.timeouts, s.redWins, s.blueWins,
    `${s.n ? (100 * (s.redWins - s.blueWins) / s.n).toFixed(1) : '0.0'} pp`, s.staticWins];
};
const pct = (f: number) => `${(100 * f).toFixed(2)}%`;
function* growth(count: number): Generator<Stamp[]> {
  for (const o of [0, 1, 2, 3, 4, 5, 6, 7] as Orientation[]) for (const x of [20, 36, 52]) for (let y = 12; y <= 76; y += 8) {
    yield Array.from({ length: count }, (_, i) => ({ id: 'rpentomino', x: x - i * 8, y: y + i * 8, orientation: o }));
  }
}
function* oneGlider(): Generator<Stamp[]> {
  for (const o of [0, 3, 6, 7] as Orientation[]) for (const x of [20, 36, 52]) for (let y = 4; y <= 84; y += 4)
    yield [{ id: 'glider', x, y, orientation: o }];
}
export function runCaptureExperiments(p: Prefabs, progress: (s: string) => void = () => {}): ExperimentReport {
  const tables: Table[] = [], recipes: Record<string, Stamp[]> = {};
  const table = (title: string, headers: string[], rows: Table['rows']) => tables.push({ title, headers, rows });
  const statsHeaders = ['Games', 'Capture rate (either base)', 'Median capture gen', 'Seconds @8 gen/s', 'Draws', 'Timeouts', 'Red wins', 'Blue wins', 'Red−blue outcomes (fixed roles)', 'Stationary-resident timeout wins'];
  const selected = (r: SiegeRules) => r.hitbox === CAPTURE_RULES.hitbox && r.threshold === CAPTURE_RULES.threshold && r.hold === CAPTURE_RULES.hold;
  const coverageRows: Table['rows'] = [];
  const undefendedTotals = CAPTURE_PARAMETERS.map(summary);
  const coverage = (label: string, candidates: Iterable<Stamp[]>) => {
    let n = 0, best = -1, chosen: Stamp[] = [], gen = 0;
    for (const red of candidates) {
      const valid = [10, 12, 14].filter(hitbox => legal({ ...CAPTURE_RULES, hitbox }, p, RED, red));
      if (!valid.length) continue;
      const histories = trajectory(p, red, []);
      if (label === 'gun + 4 LWSS') CAPTURE_PARAMETERS.forEach((r, i) => {
        if (!valid.includes(r.hitbox)) return;
        const h = histories.get(r.hitbox)!;
        tally(undefendedTotals[i], captureOutcome(r, h), h, red);
      });
      if (!valid.includes(12)) continue;
      const h = histories.get(12)!; n++;
      const max = Math.max(...h.blue);
      if (max > best) { best = max; chosen = red; gen = h.blue.indexOf(max); }
    }
    progress(`Capture: coverage ${label}: ${n} cases, max ${pct(best)}`);
    recipes[`coverage ${label}`] = chosen;
    coverageRows.push([label, n, pct(best), gen, army(p, chosen).length, textRecipe(chosen)]);
    return chosen;
  };
  progress('Capture: unopposed coverage searches');
  for (const mount of mounts) coverage(`one gun ${textRecipe([mount])}`, [[mount]]);
  coverage('4 LWSS', trains(4));
  coverage('8 LWSS', whole());
  coverage('gun + 4 LWSS', (function* () { for (const ships of trains(4)) yield [UPPER_GUN, ...ships]; })());
  coverage('one glider', oneGlider());
  coverage('7 gliders', gliders());
  coverage('one R-pentomino', growth(1));
  coverage('two R-pentomino', growth(2));
  coverage('18 blocks (72 cells)', [Array.from({ length: 18 }, (_, i) => ({ id: 'block', x: 4 + (i % 6) * 7, y: 4 + Math.floor(i / 6) * 7 }))]);
  table('Unopposed coverage (12×12, full 640 generations)', ['Unit family', 'Legal cases', 'Max enemy paint', 'First max gen', 'Cost', 'Best full recipe'], coverageRows);

  progress('Capture: same assault families, all 48 parameter sets');
  const assaultTotals = CAPTURE_PARAMETERS.map(summary), familyRows: Table['rows'] = [], familySweepRows: Table['rows'] = [];
  const combinedTotals = CAPTURE_PARAMETERS.map(summary);
  const assess = (label: string, candidates: Iterable<Stamp[]>, withGun: boolean, defender: Stamp[]) => {
    const sums = CAPTURE_PARAMETERS.map(summary);
    for (const escort of candidates) {
      const red = withGun ? [UPPER_GUN, ...escort] : escort;
      const valid = [10, 12, 14].filter(hitbox => legal({ ...CAPTURE_RULES, hitbox }, p, RED, red) && legal({ ...CAPTURE_RULES, hitbox }, p, BLUE, defender));
      if (!valid.length) continue;
      const histories = trajectory(p, red, defender);
      CAPTURE_PARAMETERS.forEach((r, i) => {
        if (!valid.includes(r.hitbox)) return;
        const h = histories.get(r.hitbox)!, o = captureOutcome(r, h);
        tally(sums[i], o, h, red); tally(assaultTotals[i], o, h, red);
        if (withGun) tally(combinedTotals[i], o, h, red);
      });
    }
    CAPTURE_PARAMETERS.forEach((r, i) => {
      familySweepRows.push([label, r.hitbox, r.threshold, r.hold, ...stats(sums[i])]);
      if (selected(r)) {
        const s = sums[i]; recipes[label] = s.best;
        familyRows.push([label, ...stats(s), s.bestGen === Infinity ? null : s.bestGen, textRecipe(s.best)]);
      }
    });
    progress(`Capture: finished ${label}`);
  };
  assess('4 LWSS + gun', trains(4), true, [UPPER_EATER]);
  for (const kind of ['glider', 'growth', 'blocks'] as const) assess(`${kind} escort + gun`, mixed(kind), true, [UPPER_EATER]);
  assess('7 gliders + gun', gliders(), true, [UPPER_EATER]);
  assess('8 LWSS vs upper gun+eater (interference)', whole(), false, [...mirrorArmy(p, [UPPER_GUN]), UPPER_EATER]);
  assess('8 LWSS vs lower gun+eater', whole(), false, [...mirrorArmy(p, [LOWER_GUN]), UPPER_EATER]);
  assess('4 LWSS vs block', trains(4), false, [{ id: 'block', x: 69, y: 35 }]);
  table('Capture assault families (T=.4, H=16, 12×12)', ['Family', ...statsHeaders, 'Fastest red capture', 'Best full attack recipe'], familyRows);
  table('Assault sweep (all families pooled)', ['Hitbox', 'T', 'H', ...statsHeaders], CAPTURE_PARAMETERS.map((r, i) => [r.hitbox, r.threshold, r.hold, ...stats(assaultTotals[i])]));
  table('Assault sweep by family', ['Family', 'Hitbox', 'T', 'H', ...statsHeaders], familySweepRows);

  progress('Capture: tournament, gate, static ash, and repaint diagnostics');
  const rush: Stamp[] = [4, 14, 24].map(x => ({ id: 'lwss', x, y: 42, orientation: 4 }));
  rush.push({ id: 'lwss', x: 4, y: 49, orientation: 4 }, { id: 'lwss', x: 14, y: 49, orientation: 4 });
  // Freeze the HP tournament recipes, including its gun-preserving hybrid, for comparable archetypes.
  const archetypes: Record<string, Stamp[]> = { gun: [UPPER_GUN], rush,
    growth: [{ id: 'rpentomino', x: 54, y: 25 }, { id: 'rpentomino', x: 54, y: 64 }],
    defence: [{ id: 'eater1', x: 52, y: 35, orientation: 4 }, { id: 'eater1', x: 52, y: 57, orientation: 6 }, { id: 'block', x: 51, y: 46 }],
    hybrid: [UPPER_GUN, ...BREACH_ESCORT] };
  const tourTotals = CAPTURE_PARAMETERS.map(summary), tourRows: Table['rows'] = [];
  const style = Object.fromEntries(Object.keys(archetypes).map(n => [n, { wins: 0, draws: 0, losses: 0 }]));
  const names = Object.keys(archetypes);
  let mismatches = 0;
  for (let a = 0; a < names.length; a++) for (let b = a; b < names.length; b++) {
    const results: CaptureOutcome[] = [];
    for (const [left, right] of [[names[a], names[b]], [names[b], names[a]]]) {
      const red = archetypes[left], blue = mirrorArmy(p, archetypes[right]);
      const histories = trajectory(p, red, blue);
      CAPTURE_PARAMETERS.forEach((r, i) => {
        if (!legal(r, p, RED, red) || !legal(r, p, BLUE, blue)) return;
        const h = histories.get(r.hitbox)!, o = captureOutcome(r, h);
        tally(tourTotals[i], o, h, red);
        if (selected(r)) {
          results.push(o);
          tourRows.push([left, right, o.winner, pct(o.red), pct(o.blue), o.end, o.redGen, o.blueGen]);
          if (o.winner === 'draw') { style[left].draws++; style[right].draws++; }
          else { style[o.winner === 'red' ? left : right].wins++; style[o.winner === 'red' ? right : left].losses++; }
        }
      });
    }
    if (results[0].red !== results[1].blue || results[0].blue !== results[1].red || results[0].end !== results[1].end) mismatches++;
  }
  table('Capture tournament recipes', ['Style', 'Cost', 'Full recipe'], Object.entries(archetypes).map(([name, units]) => [name, army(p, units).length, textRecipe(units)]));
  table('Capture tournament (T=.4, H=16, 12×12)', ['Red', 'Blue', 'Winner', 'Red base enemy paint', 'Blue base enemy paint', 'End gen', 'Red captured', 'Blue captured'], tourRows);
  table('Capture tournament style rates', ['Style', 'Wins', 'Draws', 'Losses', 'Win rate (draw=.5)'], Object.entries(style).map(([name, s]) => [name, s.wins, s.draws, s.losses, `${(100 * (s.wins + s.draws / 2) / 12).toFixed(1)}%`]));
  table('Capture tournament sweep', ['Hitbox', 'T', 'H', ...statsHeaders], CAPTURE_PARAMETERS.map((r, i) => [r.hitbox, r.threshold, r.hold, ...stats(tourTotals[i])]));
  table('Capture mirror parity', ['Recommended tournament mirror fraction/end mismatches'], [[mismatches]]);

  // A finite defence challenge portfolio: strongest discovered assaults, tested against fixed stationary templates.
  // This supplies counterexamples, not a proof over every possible legal defence placement.
  const stationary: Record<string, Stamp[]> = {
    'certified eater': [UPPER_EATER], 'port block': [{ id: 'block', x: 69, y: 35 }],
    'two lane eaters': mirrorArmy(p, archetypes.defence.filter(u => u.id === 'eater1')),
    'tournament defence': mirrorArmy(p, archetypes.defence),
    '72-cell blocks': mirrorArmy(p, recipes['coverage 18 blocks (72 cells)']),
  };
  const portfolio = [...new Map([...combinedTotals, ...undefendedTotals].map(s => [textRecipe(s.best), s.best])).values()];
  portfolio.push(...['coverage 8 LWSS', 'coverage 4 LWSS', 'coverage 7 gliders', 'coverage two R-pentomino'].map(n => recipes[n]));
  const defenceChallengeRows: Table['rows'] = [], undefeated = CAPTURE_PARAMETERS.map(() => 0);
  for (const [name, blue] of Object.entries(stationary)) {
    const sums = CAPTURE_PARAMETERS.map(summary);
    for (const red of portfolio) {
      const valid = [10, 12, 14].filter(hitbox => legal({ ...CAPTURE_RULES, hitbox }, p, RED, red) && legal({ ...CAPTURE_RULES, hitbox }, p, BLUE, blue));
      if (!valid.length) continue;
      const histories = trajectory(p, red, blue);
      CAPTURE_PARAMETERS.forEach((r, i) => {
        if (valid.includes(r.hitbox)) {
          const h = histories.get(r.hitbox)!;
          tally(sums[i], captureOutcome(r, h), h, red);
        }
      });
    }
    CAPTURE_PARAMETERS.forEach((r, i) => {
      const s = sums[i];
      if (!s.redWins) undefeated[i]++;
      defenceChallengeRows.push([name, r.hitbox, r.threshold, r.hold, army(p, blue).length, s.n, s.redWins, s.captures,
        s.bestGen < Infinity ? s.bestGen : null, textRecipe(s.best)]);
    });
  }
  table('Stationary defence challenge portfolio', ['Defence', 'Hitbox', 'T', 'H', 'Defence cost', 'Legal attacks', 'Attacker wins', 'Captures', 'Best red capture gen', 'Best full attack'], defenceChallengeRows);
  const gunHistory = trajectory(p, [UPPER_GUN], []), stopped = trajectory(p, [UPPER_GUN], [UPPER_EATER]);
  const gateRows: Table['rows'] = [];
  CAPTURE_PARAMETERS.forEach((r, i) => {
    const gun = captureOutcome(r, gunHistory.get(r.hitbox)!), defence = stopped.get(r.hitbox)!;
    const attack = undefendedTotals[i];
    const assault = combinedTotals[i];
    const gunLed = attack.bestGen < Infinity, holds = Math.max(...defence.blue) === 0, breach = assault.bestGen < Infinity;
    recipes[`best ${r.hitbox}/${r.threshold}/${r.hold}`] = assault.best;
    gateRows.push([r.hitbox, r.threshold, r.hold, gun.blueGen !== null ? 'YES' : 'NO', gunLed ? 'YES' : 'NO', holds ? 'YES' : 'NO', breach ? 'YES' : 'NO',
      gunLed && holds && breach ? 'YES' : 'NO', gunLed ? attack.bestGen : null, breach ? assault.bestGen : null,
      undefeated[i] === 0 ? 'NO (0/5 templates)' : `YES (${undefeated[i]}/5 templates)`, textRecipe(assault.best), textRecipe(attack.best)]);
  });
  table('Capture release gate', ['Hitbox', 'T', 'H', 'Single gun captures', 'Gun-led combined captures empty base', 'Eater fully stops gun', 'Combined captures eater base', 'Restated gate', 'Empty-base capture gen', 'Defended capture gen', 'Stationary template undefeated by the tested portfolio?', 'Best full defended recipe', 'Best full undefended recipe'], gateRows);

  const old = simulate(CAPTURE_RULES, p, [UPPER_GUN, ...BEST_ESCORT], [UPPER_EATER], true);
  const oldH = old.blue.captureHistory!;
  let plateau = 640;
  while (plateau > 0 && oldH[plateau - 1] === oldH[640]) plateau--;
  const ashSeed = new Uint8Array(128 * 96);
  const box = crystalRect(CAPTURE_RULES, BLUE);
  for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) if (old.grid[y * 128 + x] === RED) ashSeed[y * 128 + x] = RED;
  const isolatedAsh = trajectory(p, [], [], ashSeed).get(12)!;
  const singleBlock = new Uint8Array(128 * 96);
  for (let y = 46; y <= 47; y++) for (let x = 86; x <= 87; x++) singleBlock[y * 128 + x] = RED;
  const singleH = trajectory(p, [], [], singleBlock).get(12)!;
  table('Static ash diagnostics (illegal in-base seeds are observer probes)', ['Fixture', 'Live enemy sites in base at640', 'Paint @gen1', 'Paint @gen268', 'Paint @640', 'Capture gen', 'Timeout winner', 'Paint constant from gen'], [
    ['Old fastest legal breach (includes collision paint)', population(ashSeed).red, pct(oldH[1]), pct(oldH[268]), pct(oldH[640]), old.blue.captureGen!, old.winner, plateau],
    ['Only its settled in-base blocks, fresh owner paint', population(ashSeed).red, pct(isolatedAsh.blue[1]), pct(isolatedAsh.blue[268]), pct(isolatedAsh.blue[640]), captureOutcome(CAPTURE_RULES, isolatedAsh).blueGen, captureOutcome(CAPTURE_RULES, isolatedAsh).winner, 1],
    ['Single in-base block, fresh owner paint', 4, pct(singleH.blue[1]), pct(singleH.blue[268]), pct(singleH.blue[640]), captureOutcome(CAPTURE_RULES, singleH).blueGen, captureOutcome(CAPTURE_RULES, singleH).winner, 1],
  ]);
  // Laboratory repaint: owner ships cross a fully enemy-painted base, then a mixed legal tug-of-war.
  const repaintRows: Table['rows'] = [];
  for (const [name, units] of [
    ['owner LWSS', [{ id: 'lwss', x: 100, y: 46, orientation: 0 }]],
    ['owner glider', [{ id: 'glider', x: 98, y: 58, orientation: 2 }]],
  ] as [string, Stamp[]][]) {
    const seed = placeArmies(arenaConfig(CAPTURE_RULES), [], army(p, units));
    let s = initialState({ ...CAPTURE_RULES, threshold: 1, hold: 640 }, seed);
    for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) s.paint![y * 128 + x] = RED;
    let lowest = 1;
    // Use the scoring observer to exercise actual owner-colour repainting.
    for (let g = 1; g <= 160; g++) {
      s = stepCapture({ ...CAPTURE_RULES, threshold: 1, hold: 640 }, s);
      lowest = Math.min(lowest, s.blue.captureFraction!);
    }
    repaintRows.push([name, '100%', pct(lowest), pct(s.blue.captureFraction!), null, textRecipe(units)]);
  }
  for (const [name, red, blue] of [
    ['rush vs mirrored rush', rush, mirrorArmy(p, rush)],
    ['hybrid vs mirrored hybrid', archetypes.hybrid, mirrorArmy(p, archetypes.hybrid)],
    ['gun vs owner crossing ships', [UPPER_GUN], [{ id: 'lwss', x: 100, y: 42, orientation: 0 }, { id: 'lwss', x: 100, y: 49, orientation: 0 }]],
    ['gun vs late owner glider', [UPPER_GUN], [{ id: 'glider', x: 120, y: 81, orientation: 2 }]],
    ['mixed gun-led attack vs late owner glider', [UPPER_GUN, ...BREACH_ESCORT], [{ id: 'glider', x: 120, y: 81, orientation: 2 }]],
  ] as [string, Stamp[], Stamp[]][]) {
    const h = trajectory(p, red, blue).get(12)!;
    const drops = h.blue.slice(1).filter((f, i) => f < h.blue[i]).length;
    repaintRows.push([name, '0%', pct(Math.max(...h.blue)), pct(h.blue[640]), drops, textRecipe(blue)]);
  }
  table('Repaint and tug-of-war (blue base)', ['Fixture', 'Initial enemy paint', 'Min for repaint / max for tug', 'Final enemy paint', 'Generations with paint decrease', 'Owner recipe'], repaintRows);
  const recommended = CAPTURE_PARAMETERS.findIndex(selected);
  recipes['recommended defended attack'] = combinedTotals[recommended].best;
  recipes['recommended undefended attack'] = undefendedTotals[recommended].best;
  const ashOnlyRows: Table['rows'] = [];
  const legalBlockHistories = trajectory(p, recipes['coverage 18 blocks (72 cells)'], []);
  for (const r of CAPTURE_PARAMETERS) {
    // Legal stationary block armies never move into excluded bases. The diagnostic block is intentionally illegal.
    const h = legalBlockHistories.get(r.hitbox)!;
    const o = captureOutcome(r, h);
    ashOnlyRows.push([r.hitbox, r.threshold, r.hold, o.winner, o.blueGen, combinedTotals[CAPTURE_PARAMETERS.indexOf(r)].staticWins]);
  }
  table('Ash-only and stationary tail checks', ['Hitbox', 'T', 'H', 'Legal 72-cell blocks vs empty winner', 'Block capture', 'Gun-led search stationary-resident timeout wins'], ashOnlyRows);
  return { tables, recipes, gate: gateRows[recommended][7] === 'YES' };
}
