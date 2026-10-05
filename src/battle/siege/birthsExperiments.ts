import { BLUE, RED, emptyGrid, placeArmies, stepGrid, type Grid, type Winner } from '../arena';
import { army, type Orientation, type Prefabs, type Stamp } from './prefabs';
import { DEFAULT_RULES, arenaConfig, crystalRect, simulate, simulateGrid, type SiegeRules } from './siegeSim';
import { BEST_ESCORT, BREACH_ESCORT, LOWER_GUN, UPPER_EATER, UPPER_GUN, gliders, legal, mirrorArmy, mixed,
  percent, textRecipe, trains, whole, type ExperimentReport, type Table } from './experiments';

/** Frozen recommendation: independent of DEFAULT_RULES so historical runners remain reproducible. */
export const BIRTHS_RULES: SiegeRules = { ...DEFAULT_RULES, scoring: 'births', hitbox: 12, hp: 48, cap: 8, unitsPerHP: 8 };
/** Gun-dependent searched breach, with an extra distant block to spend exactly 72. */
export const BIRTHS_BREACH: Stamp[] = [UPPER_GUN,
  { id: 'lwss', x: 4, y: 46, orientation: 4 }, { id: 'lwss', x: 14, y: 46, orientation: 4 },
  { id: 'rpentomino', x: 54, y: 54 }, { id: 'rpentomino', x: 48, y: 46 },
  { id: 'block', x: 44, y: 60 }, { id: 'block', x: 4, y: 4 },
];
/** Exact-spend check: clean gun+eater core plus six rear blocks and an outward scout. */
export function birthsEqualSpendDefence(p: Prefabs): Stamp[] {
  return [...mirrorArmy(p, [LOWER_GUN]), UPPER_EATER, { id: 'glider', x: 110, y: 4, orientation: 2 },
    ...Array.from({ length: 6 }, (_, i) => ({ id: 'block' as const, x: 90 + i % 3 * 8, y: 72 + Math.floor(i / 3) * 8 }))];
}
export const BIRTHS_PARAMETERS = [10, 12, 14].flatMap(hitbox => [32, 48, 64].flatMap(hp =>
  [4, 8, 12].flatMap(cap => [4, 8, 16].map(unitsPerHP => ({ ...BIRTHS_RULES, hitbox, hp, cap, unitsPerHP })))));
export interface BirthHistory { red: number[]; blue: number[] }
export interface BirthOutcome {
  redHP: number; blueHP: number; redUnits: number; blueUnits: number;
  redGen: number | null; blueGen: number | null; end: number; winner: Winner;
}
/** Replay observations only. Histories start at gen 0 with zero; the initial seed never scores. */
export function birthsOutcome(r: SiegeRules, h: BirthHistory): BirthOutcome {
  let redUnits = 0, blueUnits = 0;
  for (let g = 1; g <= r.generations; g++) {
    redUnits += Math.min(h.red[g], r.cap); blueUnits += Math.min(h.blue[g], r.cap);
    const redHP = Math.max(0, r.hp - Math.floor(redUnits / r.unitsPerHP));
    const blueHP = Math.max(0, r.hp - Math.floor(blueUnits / r.unitsPerHP));
    if (!redHP || !blueHP || g === r.generations) return { redHP, blueHP, redUnits, blueUnits,
      redGen: redHP === 0 ? g : null, blueGen: blueHP === 0 ? g : null, end: g,
      winner: redHP === blueHP ? 'draw' : redHP > blueHP ? 'red' : 'blue' };
  }
  return { redHP: r.hp, blueHP: r.hp, redUnits: 0, blueUnits: 0, redGen: null, blueGen: null, end: 0, winner: 'draw' };
}
/** One trusted trajectory covers all three hitboxes; no scoring parameter feeds back into Life. */
export function birthsTrajectory(p: Prefabs, red: Stamp[], blue: Stamp[], seed?: Grid): Map<number, BirthHistory> {
  const r = BIRTHS_RULES;
  let grid = seed ?? placeArmies(arenaConfig(r), army(p, red), army(p, blue));
  const result = new Map<number, BirthHistory>();
  const boxes = [10, 12, 14].map(hitbox => {
    const history = { red: [0], blue: [0] };
    result.set(hitbox, history);
    return { history, red: crystalRect({ ...r, hitbox }, RED), blue: crystalRect({ ...r, hitbox }, BLUE) };
  });
  for (let g = 1; g <= r.generations; g++) {
    const previous = grid;
    grid = stepGrid(previous, r.width, r.height, false, false);
    for (const b of boxes) for (const team of [RED, BLUE] as const) {
      const box = team === RED ? b.red : b.blue;
      let births = 0;
      for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) {
        const i = y * r.width + x;
        if (previous[i] === 0 && grid[i] === (team === RED ? BLUE : RED)) births++;
      }
      b.history[team === RED ? 'red' : 'blue'].push(births);
    }
  }
  return result;
}
interface Summary { n: number; damaged: number; destroyed: number; redWins: number; blueWins: number; draws: number;
  gens: number[]; best: Stamp[]; bestGen: number; bestUnits: number }
const summary = (): Summary => ({ n: 0, damaged: 0, destroyed: 0, redWins: 0, blueWins: 0, draws: 0,
  gens: [], best: [], bestGen: Infinity, bestUnits: -1 });
function tally(s: Summary, o: BirthOutcome, red: Stamp[]) {
  s.n++;
  if (o.redUnits || o.blueUnits) s.damaged++;
  if (o.redGen !== null || o.blueGen !== null) { s.destroyed++; s.gens.push(o.end); }
  if (o.winner === 'draw') s.draws++; else if (o.winner === 'red') s.redWins++; else s.blueWins++;
  const gen = o.winner === 'red' ? o.blueGen ?? Infinity : Infinity;
  if (gen < s.bestGen || gen === s.bestGen && o.blueUnits > s.bestUnits) {
    s.best = red; s.bestGen = gen; s.bestUnits = o.blueUnits;
  }
}
const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const a = [...values].sort((a, b) => a - b), i = Math.floor(a.length / 2);
  return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
};
const stats = (s: Summary): Table['rows'][number] => [s.n, percent(s.damaged, s.n), percent(s.destroyed, s.n),
  s.redWins, s.blueWins, s.draws, median(s.gens), s.bestGen === Infinity ? null : s.bestGen];
const mounts: Stamp[] = [UPPER_GUN, LOWER_GUN,
  { id: 'gosperglidergun', x: 24, y: 4, orientation: 0 }, { id: 'gosperglidergun', x: 24, y: 83, orientation: 6 }];
function* growth(count: number): Generator<Stamp[]> {
  for (const orientation of [0, 1, 2, 3, 4, 5, 6, 7] as Orientation[]) for (const x of [20, 36, 52]) for (let y = 12; y <= 76; y += 8)
    yield Array.from({ length: count }, (_, i) => ({ id: 'rpentomino', x: x - i * 8, y: y + i * 8, orientation }));
}
function* oneGlider(): Generator<Stamp[]> {
  for (const orientation of [0, 3, 6, 7] as Orientation[]) for (const x of [20, 36, 52]) for (let y = 4; y <= 84; y += 4)
    yield [{ id: 'glider', x, y, orientation }];
}

export function runBirthsExperiments(p: Prefabs, progress: (s: string) => void = () => {}): ExperimentReport {
  const r = BIRTHS_RULES, tables: Table[] = [], recipes: Record<string, Stamp[]> = {};
  const table = (title: string, headers: string[], rows: Table['rows']) => tables.push({ title, headers, rows });
  const selected = BIRTHS_PARAMETERS.findIndex(q => q.hitbox === r.hitbox && q.hp === r.hp && q.cap === r.cap && q.unitsPerHP === r.unitsPerHP);
  const headers = ['Cases', 'Any contact', 'Either crystal destroyed', 'Red wins', 'Blue wins', 'Draws', 'Median lethal gen', 'Fastest red kill'];
  const gunHistories = mounts.map(gun => birthsTrajectory(p, [gun], []));
  const stopped = birthsTrajectory(p, [UPPER_GUN], [UPPER_EATER]);
  const gunRows = mounts.map((gun, i) => {
    const s = simulate(r, p, [gun], []);
    return [textRecipe([gun]), s.blue.firstContact, s.blue.killGen, s.blue.killGen === null ? null : s.blue.killGen / 8,
      r.hp - s.blue.hp, s.blue.units, gunHistories[i].get(12)!.blue.reduce((n, x) => n + Math.min(x, r.cap), 0)];
  });
  table('Births unopposed certified gun mounts', ['Mount', 'Contact', 'Kill gen', 'Kill seconds @8 gen/s', 'HP lost at end', 'Units at end', 'Units at640'], gunRows);

  const unopposedRows: Table['rows'] = [];
  const unopposed = (name: string, candidates: Iterable<Stamp[]>) => {
    const s = summary(); let bestContact: number | null = null;
    for (const red of candidates) {
      if (!legal(r, p, RED, red)) continue;
      const h = birthsTrajectory(p, red, []).get(r.hitbox)!;
      const o = birthsOutcome(r, h), previousBest = s.best;
      tally(s, o, red);
      if (s.best !== previousBest) bestContact = h.blue.findIndex(x => x > 0) || null;
    }
    recipes[`unopposed ${name}`] = s.best;
    unopposedRows.push([name, ...stats(s), bestContact !== -1 ? bestContact : null, s.bestUnits,
      Math.min(r.hp, Math.floor(s.bestUnits / r.unitsPerHP)), textRecipe(s.best)]);
    progress(`Births unopposed ${name}: ${s.n} cases, best kill ${s.bestGen}, units ${s.bestUnits}`);
  };
  unopposed('4 LWSS', trains(4)); unopposed('8 LWSS', whole());
  unopposed('one glider', oneGlider()); unopposed('7 gliders', gliders());
  unopposed('one R-pentomino', growth(1)); unopposed('two R-pentomino', growth(2));
  const blocks: Stamp[] = Array.from({ length: 18 }, (_, i) => ({ id: 'block', x: 4 + i % 6 * 7, y: 4 + Math.floor(i / 6) * 7 }));
  unopposed('18 stationary blocks (72 cells)', [blocks]);
  table('Births unopposed families (full legal search, outcomes stop on death)', ['Family', ...headers, 'Best contact', 'Best capped units at end', 'Best HP lost', 'Best full recipe'], unopposedRows);

  // Illegal in-base seeds isolate observation from deployment; oscillators are not free legal base placements.
  const observerRows: Table['rows'] = [];
  const probes: [string, [number, number][]][] = [
    ['block', [[86, 46], [87, 46], [86, 47], [87, 47]]],
    ['blinker', [[86, 46], [87, 46], [88, 46]]],
    ['toad', [[86, 46], [87, 46], [88, 46], [85, 47], [86, 47], [87, 47]]],
    ['beacon', [[85, 45], [86, 45], [85, 46], [86, 46], [87, 47], [88, 47], [87, 48], [88, 48]]],
  ];
  for (const [name, cells] of probes) {
    const seed = emptyGrid(arenaConfig(r)); for (const [x, y] of cells) seed[y * r.width + x] = RED;
    const h = birthsTrajectory(p, [], [], seed).get(r.hitbox)!;
    const s = simulateGrid(r, seed), full = simulateGrid(r, seed, true);
    observerRows.push([name, cells.length, h.blue[1], h.blue[2], full.blue.units / 640, s.blue.killGen,
      s.blue.killGen === null ? null : s.blue.killGen / 8, r.hp - full.blue.hp, full.blue.units, 0]);
  }
  table('Births stationary and oscillator probes (illegal in-base seeds)', ['Fixture', 'Seed cells', 'Births gen1', 'Births gen2', 'Mean capped births/gen', 'Kill gen', 'Kill seconds', 'HP lost by640', 'Units at640', 'Units from surviving/static cells'], observerRows);

  const assaultTotals = BIRTHS_PARAMETERS.map(summary), familyRows: Table['rows'] = [];
  const combinedEater = BIRTHS_PARAMETERS.map(summary), combinedDefence = BIRTHS_PARAMETERS.map(summary);
  const cleanDefence = [...mirrorArmy(p, [LOWER_GUN]), UPPER_EATER];
  const assess = (name: string, candidates: Iterable<Stamp[]>, withGun: boolean, blue: Stamp[], gateTotals?: Summary[]) => {
    const sums = BIRTHS_PARAMETERS.map(summary);
    for (const escort of candidates) {
      const red = withGun ? [UPPER_GUN, ...escort] : escort;
      const valid = [10, 12, 14].filter(hitbox => legal({ ...r, hitbox }, p, RED, red) && legal({ ...r, hitbox }, p, BLUE, blue));
      if (!valid.length) continue;
      const histories = birthsTrajectory(p, red, blue);
      BIRTHS_PARAMETERS.forEach((q, i) => {
        if (!valid.includes(q.hitbox)) return;
        const o = birthsOutcome(q, histories.get(q.hitbox)!);
        tally(sums[i], o, red); tally(assaultTotals[i], o, red); if (gateTotals) tally(gateTotals[i], o, red);
      });
    }
    const s = sums[selected]; recipes[name] = s.best;
    familyRows.push([name, ...stats(s), textRecipe(s.best)]);
    progress(`Births assault ${name}: ${s.n} cases, fastest winning kill ${s.bestGen}`);
  };
  assess('4 LWSS + gun vs eater', trains(4), true, [UPPER_EATER], combinedEater);
  for (const kind of ['glider', 'growth', 'blocks'] as const) assess(`${kind} escort + gun vs eater`, mixed(kind), true, [UPPER_EATER], combinedEater);
  assess('7 gliders + gun vs eater', gliders(), true, [UPPER_EATER], combinedEater);
  // Same equal-ceiling 72 budget. Lower defender gun functions independently of its upper eater.
  assess('4 LWSS + gun vs lower gun+eater', trains(4), true, cleanDefence, combinedDefence);
  assess('growth escort + gun vs lower gun+eater', mixed('growth'), true, cleanDefence, combinedDefence);
  assess('8 LWSS vs upper gun+eater (interference)', whole(), false, [...mirrorArmy(p, [UPPER_GUN]), UPPER_EATER]);
  assess('8 LWSS vs lower gun+eater', whole(), false, cleanDefence);
  assess('4 LWSS vs block', trains(4), false, [{ id: 'block', x: 69, y: 35 }]);
  table('Births assault families (recommended parameters)', ['Family', ...headers, 'Best full attack'], familyRows);

  const comparisonRows: Table['rows'] = [];
  for (const [name, attack, blue] of [
    ['fastest vs eater', combinedEater[selected].best, [UPPER_EATER]],
    ['fastest vs functioning gun+eater', combinedDefence[selected].best, cleanDefence],
    ['old mixed gun-preserving breach', [UPPER_GUN, ...BREACH_ESCORT], [UPPER_EATER]],
  ] as [string, Stamp[], Stamp[]][]) {
    recipes[name] = attack;
    for (const gun of [true, false]) {
      const red = gun ? attack : attack.filter(u => u.id !== 'gosperglidergun');
      const s = simulate(r, p, red, blue);
      comparisonRows.push([name, gun ? 'yes' : 'no', army(p, red).length, s.blue.firstContact, s.blue.killGen,
        s.generation, s.winner, r.hp - s.blue.hp, s.blue.units, s.red.hp, 0]);
    }
  }
  table('Births matched gun ablation (same escorts, no budget refill)', ['Recipe', 'Attacker gun', 'Cost', 'Contact', 'Blue kill', 'End', 'Winner', 'Blue HP lost', 'Blue units', 'Red HP', 'Static-resident scored units'], comparisonRows);

  progress('Births tournament and all 81 release gates');
  const rush: Stamp[] = [4, 14, 24].map(x => ({ id: 'lwss', x, y: 42, orientation: 4 }));
  rush.push({ id: 'lwss', x: 4, y: 49, orientation: 4 }, { id: 'lwss', x: 14, y: 49, orientation: 4 });
  const archetypes: Record<string, Stamp[]> = { gun: [UPPER_GUN], rush,
    growth: [{ id: 'rpentomino', x: 54, y: 25 }, { id: 'rpentomino', x: 54, y: 64 }],
    defence: [{ id: 'eater1', x: 52, y: 35, orientation: 4 }, { id: 'eater1', x: 52, y: 57, orientation: 6 }, { id: 'block', x: 51, y: 46 }],
    hybrid: [UPPER_GUN, ...BREACH_ESCORT] };
  const tourTotals = BIRTHS_PARAMETERS.map(summary), tourRows: Table['rows'] = [];
  const style = Object.fromEntries(Object.keys(archetypes).map(n => [n, { wins: 0, draws: 0, losses: 0 }]));
  const names = Object.keys(archetypes); let mismatches = 0;
  for (let a = 0; a < names.length; a++) for (let b = a; b < names.length; b++) {
    const outcomes: BirthOutcome[] = [];
    for (const [left, right] of [[names[a], names[b]], [names[b], names[a]]]) {
      const red = archetypes[left], blue = mirrorArmy(p, archetypes[right]);
      const histories = birthsTrajectory(p, red, blue);
      BIRTHS_PARAMETERS.forEach((q, i) => {
        if (!legal(q, p, RED, red) || !legal(q, p, BLUE, blue)) return;
        const o = birthsOutcome(q, histories.get(q.hitbox)!); tally(tourTotals[i], o, red);
        if (i === selected) {
          outcomes.push(o); tourRows.push([left, right, o.winner, o.redHP, o.blueHP, o.end]);
          if (o.winner === 'draw') { style[left].draws++; style[right].draws++; }
          else { style[o.winner === 'red' ? left : right].wins++; style[o.winner === 'red' ? right : left].losses++; }
        }
      });
    }
    if (outcomes[0].redHP !== outcomes[1].blueHP || outcomes[0].blueHP !== outcomes[1].redHP || outcomes[0].end !== outcomes[1].end) mismatches++;
  }
  table('Births tournament templates (frozen HP/capture recipes; unequal spend)', ['Style', 'Cost', 'Recipe'], Object.entries(archetypes).map(([name, units]) => {
    recipes[`tournament ${name}`] = units; return [name, army(p, units).length, textRecipe(units)];
  }));
  table('Births tournament (30 games, including twice-counted self matches)', ['Red', 'Blue', 'Winner', 'Red HP', 'Blue HP', 'End gen'], tourRows);
  const styleRows = Object.entries(style).map(([name, s]) => [name, s.wins, s.draws, s.losses, `${(100 * (s.wins + s.draws / 2) / 12).toFixed(1)}%`]);
  table('Births tournament style rates', ['Style', 'Wins', 'Draws', 'Losses', 'Win rate (draw=.5)'], styleRows);
  const near = Object.values(style).filter(s => (s.wins + s.draws / 2) / 12 >= 0.4 && (s.wins + s.draws / 2) / 12 <= 0.6).length;
  const tour = tourTotals[selected];
  table('Births tournament targets and side bias', ['Games', 'Any contact', 'Damage ≥1 HP (target ≥80%)', 'Destruction (target ≥60%)', 'Styles at40–60% (target ≥3)', 'Red wins', 'Blue wins', 'Draws', 'Red−blue pp', 'Mirror HP/end mismatches'],
    [[tour.n, percent(tour.damaged, tour.n), percent(tourRows.filter(row => Number(row[3]) < r.hp || Number(row[4]) < r.hp).length, tour.n), percent(tour.destroyed, tour.n), near,
      tour.redWins, tour.blueWins, tour.draws, (100 * (tour.redWins - tour.blueWins) / tour.n).toFixed(1), mismatches]]);

  const sweepRows: Table['rows'] = [], gateRows: Table['rows'] = [];
  BIRTHS_PARAMETERS.forEach((q, i) => {
    const gun = birthsOutcome(q, gunHistories[0].get(q.hitbox)!);
    const holds = stopped.get(q.hitbox)!.blue.every(x => x === 0);
    const eater = combinedEater[i], defence = combinedDefence[i];
    const gate = gun.blueGen !== null && holds && eater.bestGen < Infinity && defence.bestGen < Infinity;
    gateRows.push([q.hitbox, q.hp, q.cap, q.unitsPerHP, gun.blueGen, gun.blueGen === null ? null : gun.blueGen / 8,
      holds ? 'YES' : 'NO', eater.bestGen < Infinity ? eater.bestGen : null, defence.bestGen < Infinity ? defence.bestGen : null, gate ? 'YES' : 'NO']);
    sweepRows.push([q.hitbox, q.hp, q.cap, q.unitsPerHP, ...stats(assaultTotals[i]), ...stats(tourTotals[i])]);
  });
  table('Births complete 81-set release gate / gun tuning', ['Hitbox', 'HP', 'Cap', 'Units/HP', 'Solo gun kill', 'Seconds @8', 'Eater stops gun', 'Combined winning kill vs eater', 'Combined winning kill vs functioning gun+eater', 'Release gate'], gateRows);
  table('Births complete 81-set assault and tournament sweep', ['Hitbox', 'HP', 'Cap', 'Units/HP', ...headers.map(h => `Assault ${h}`), ...headers.map(h => `Tournament ${h}`)], sweepRows);

  const old = [UPPER_GUN, ...BEST_ESCORT], h = birthsTrajectory(p, old, [UPPER_EATER]).get(r.hitbox)!;
  const full = simulate(r, p, old, [UPPER_EATER], true), terminal = simulate(r, p, old, [UPPER_EATER]);
  let lastBirth = 0; h.blue.forEach((n, g) => { if (n) lastBirth = g; });
  const seed = emptyGrid(arenaConfig(r)), box = crystalRect(r, BLUE);
  for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) if (full.grid[y * r.width + x] === RED) seed[y * r.width + x] = RED;
  const isolated = simulateGrid(r, seed, true);
  table('Old fastest HP breach re-scored under births', ['Fixture', 'Contact', 'Kill', 'HP lost', 'Units at640', 'Last newborn gen', 'Winner', 'Static scored units'], [
    ['old 72-cell gun+4LWSS vs eater (HP kill268)', full.blue.firstContact, full.blue.killGen, r.hp - full.blue.hp, full.blue.units, lastBirth, terminal.winner, 0],
    ['only its settled in-base residents (illegal probe)', isolated.blue.firstContact, isolated.blue.killGen, r.hp - isolated.blue.hp, isolated.blue.units, null, isolated.winner, 0],
  ]);
  tables.push(...birthsFollowups(p, recipes));
  const chosen = gateRows[selected];
  const exact = simulate(r, p, BIRTHS_BREACH, birthsEqualSpendDefence(p));
  progress(`Births recommendation: hitbox ${r.hitbox}, HP ${r.hp}, cap ${r.cap}, units/HP ${r.unitsPerHP}; gate ${chosen[9]}; gun ${chosen[4]}gen (${chosen[5]}s)`);
  return { tables, recipes, gate: chosen[9] === 'YES' && exact.winner === 'red' && exact.blue.killGen !== null };
}

/** Follow up the searched champions, rather than treating the original weak growth template as optimal. */
export function birthsFollowups(p: Prefabs, recipes: Record<string, Stamp[]>): Table[] {
  const r = BIRTHS_RULES, tables: Table[] = [];
  const growthRows: Table['rows'] = [], stressRows: Table['rows'] = [], stressRates: Table['rows'] = [];
  for (const name of ['one R-pentomino', 'two R-pentomino']) {
    const red = recipes[`unopposed ${name}`], h = birthsTrajectory(p, red, []).get(r.hitbox)!;
    const full = simulate(r, p, red, [], true);
    let lastBirth = 0; h.blue.forEach((n, g) => { if (n) lastBirth = g; });
    growthRows.push([name, army(p, red).length, full.blue.firstContact, full.blue.killGen,
      full.blue.units, lastBirth, h.blue.slice(577).reduce((n, x) => n + Math.min(x, r.cap), 0) / 64, 0, textRecipe(red)]);
    let wins = 0, losses = 0, draws = 0, damaged = 0, destroyed = 0;
    for (const style of ['gun', 'rush', 'growth', 'defence', 'hybrid']) {
      const other = recipes[`tournament ${style}`];
      for (const left of [true, false]) {
        const s = simulate(r, p, left ? red : other, mirrorArmy(p, left ? other : red));
        const winner = s.winner === 'draw' ? 'draw' : s.winner === (left ? 'red' : 'blue') ? 'growth' : 'opponent';
        if (winner === 'draw') draws++; else if (winner === 'growth') wins++; else losses++;
        if (s.red.hp < r.hp || s.blue.hp < r.hp) damaged++;
        if (!s.red.hp || !s.blue.hp) destroyed++;
        stressRows.push([name, style, left ? 'red' : 'blue', winner, left ? s.red.hp : s.blue.hp, left ? s.blue.hp : s.red.hp, s.generation]);
      }
    }
    stressRates.push([name, 10, wins, draws, losses, `${(100 * (wins + draws / 2) / 10).toFixed(1)}%`, percent(damaged, 10), percent(destroyed, 10)]);
  }
  tables.push({ title: 'Births strongest growth tails (full640; no static score)', headers: ['Seed family', 'Cost', 'Contact', 'Kill', 'Units at640', 'Last birth', 'Mean capped births/gen577–640', 'Static scored units', 'Recipe'], rows: growthRows });
  tables.push({ title: 'Births optimized methuselah stress matches (both sides)', headers: ['Growth seed', 'Opponent', 'Growth side', 'Winner', 'Growth HP', 'Opponent HP', 'End'], rows: stressRows });
  tables.push({ title: 'Births optimized methuselah stress rates (training champions, not held-out)', headers: ['Growth seed', 'Games', 'Wins', 'Draws', 'Losses', 'Win rate (draw=.5)', 'Damage ≥1 HP', 'Destruction'], rows: stressRates });
  const exactRows: Table['rows'] = [];
  const exactBlue = birthsEqualSpendDefence(p);
  recipes['exact72 gun-dependent breach'] = BIRTHS_BREACH;
  recipes['exact72 functioning gun+eater defence'] = exactBlue;
  for (const withGun of [true, false]) {
    const attack = withGun ? BIRTHS_BREACH : BIRTHS_BREACH.filter(u => u.id !== 'gosperglidergun');
    const s = simulate(r, p, attack, exactBlue);
    exactRows.push([withGun ? 'yes' : 'no', army(p, attack).length, army(p, exactBlue).length,
      s.blue.firstContact, s.blue.killGen, s.blue.killGen === null ? null : s.blue.killGen / 8,
      s.winner, s.red.hp, s.blue.hp, s.blue.units, 0]);
  }
  const baseline = simulate(r, p, [], exactBlue);
  exactRows.push(['defence alone', 0, army(p, exactBlue).length, baseline.red.firstContact, baseline.red.killGen,
    baseline.red.killGen === null ? null : baseline.red.killGen / 8, baseline.winner, baseline.red.hp, baseline.blue.hp, baseline.red.units, 0]);
  tables.push({ title: 'Births exact72-vs72 release check (gun required; defence baseline)', headers: ['Attacker gun', 'Attack cost', 'Defence cost', 'Enemy contact', 'Enemy kill', 'Kill seconds', 'Winner', 'Red HP', 'Blue HP', 'Scored units against enemy', 'Static scored units'], rows: exactRows });
  const ablations: Table['rows'] = [];
  for (const [name, attack] of Object.entries(recipes).filter(([name]) => name.includes(' + gun vs '))) {
    const blue = name.endsWith('lower gun+eater') ? [...mirrorArmy(p, [LOWER_GUN]), UPPER_EATER] : [UPPER_EATER];
    const combined = simulate(r, p, attack, blue), escort = simulate(r, p, attack.filter(u => u.id !== 'gosperglidergun'), blue);
    const advantage = combined.winner === 'red' && (escort.winner !== 'red'
      || combined.blue.killGen !== null && (escort.blue.killGen === null || combined.blue.killGen < escort.blue.killGen));
    ablations.push([name, army(p, attack).length, combined.winner, combined.blue.killGen, r.hp - combined.blue.hp,
      escort.winner, escort.blue.killGen, r.hp - escort.blue.hp, advantage ? 'YES' : 'NO', 0]);
  }
  tables.push({ title: 'Births family-champion gun relevance (matched escorts, no refill)', headers: ['Champion', 'Combined cost', 'Combined winner', 'Combined kill', 'Combined HP lost', 'Escort winner', 'Escort kill', 'Escort HP lost', 'Gun improves win or lethal time', 'Static scored units'], rows: ablations });
  return tables;
}
