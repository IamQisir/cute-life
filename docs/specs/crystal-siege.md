# Crystal Siege — spec

Status: **draft, not started** · Mode: new battle mode next to the garden battle
Sources: player idea ("a MOBA where you destroy the enemy crystal, with guns or
a big army"), Codex design review (xhigh, with in-engine experiments), Claude review.

## 1. Summary

Both sides secretly deploy an army of famous Life structures, then watch.
Each side has a **crystal**. Enemy creatures inside your crystal crack it; the
first crystal to break loses. Attack from range with a **gun** that fires real
gliders, rush with **spaceships**, sabotage with **methuselahs**, and defend
with **eaters** that really eat incoming gliders.

### Goals
- A readable attack/defence story in a 30–90 s clip: *firing → blocked →
  breach → crystal cracked*.
- Famous structures behave exactly as on LifeWiki; skill is choosing routes
  and placements, not knowing glider phases.
- Deterministic, serverless: AI opponent, async challenge links, replays.

### Non-goals (v1)
Live control or reinforcements during the battle, an economy, heroes, unlimited
custom armies, reflectors / puffers / copperhead / Simkin gun, creature
identity tracking.

## 2. Relationship to Conway's Game of Life

The mode is three layers; only the first decides what lives and dies.

| Layer | What it is | Conway? |
|---|---|---|
| **Evolution** | Every generation is exactly B3/S23. Ignoring colour, the grid evolves like standard Life, so guns, eaters and ships behave as documented on LifeWiki. | **Yes, unchanged** |
| **Colour** | Immigration (Don Woods): survivors keep their colour; a newborn takes the majority colour of its 3 parents. Colour never affects who lives or dies. | Known two-colour variant |
| **Game rules** | Crystals, HP, damage, budgets, unit limits, deploy zones, time limit. They **observe** the grid; they never add, remove or move cells. | Outside Life (like garden scoring) |

The one real deviation from Conway's original is the **bounded arena** (cells
past a wall vanish); the original plane is infinite. The sandbox stays
unbounded.

Rejected for this reason: a crystal that **absorbs** cells (it changes the
evolution; in Codex's test the debris turned a p30 gun's damage into p60).
Rejected for readability: a crystal that is a **physical still life** (the same
hit may erase it, get absorbed, or explode).

The in-game rules text should say: *"Cells follow the standard Game of Life.
The crystal only keeps score of the damage."*

## 3. Rules (v1)

### 3.1 Arena

**Proposed (Claude): 128 wide × 96 tall**, walls on all four sides, no wrap,
no internal obstacles; red attacks from the left, blue from the right.
Landscape fits laptop screens (~9 px/cell at 1600×900 vs ~6 px for a portrait
board), keeping creatures readable.

Codex's original geometry (portrait, tested fixtures below were measured on
it), kept for reference until the landscape layout is validated:

| Element | Bounds (inclusive), 96×128 portrait |
|---|---|
| Red deployment | x 4…43, y 4…123 |
| Blue deployment | x 52…91, y 4…123 |
| Red crystal hitbox | x 6…17, y 58…69 |
| Blue crystal hitbox | x 78…89, y 58…69 |

- Crystal deployment exclusion: hitbox plus a 2-cell halo.
- Routes (upper diagonal, lower diagonal, central horizontal band) are
  **drawn guides on one open grid**, not corridors. Gliders stay diagonal,
  ships go straight, growth can cross the guides.
- Top/bottom do **not** wrap: wrapped trajectories hide the link between a
  shot and its impact.

### 3.2 Crystals and damage

- Two crystals, **64 HP** each, **12×12 hitbox**, transparent to Life.
- After each generation: `acc += min(enemyCellsInsideHitbox, 8)`; every
  **16** accumulated units remove **1 HP** (remainder kept). No healing.
- Enemy = the cell's **current** grid colour (not who deployed it). Friendly
  cells and paint never damage.
- Both crystals are damaged from the same generation **before** the result is
  decided.

### 3.3 End of the match
1. A crystal reaches 0 HP → that side loses; both at once → draw.
2. Otherwise at **640 generations**: more HP wins; equal → draw.
- Extinction does **not** end the match (an army can vanish after decisive
  damage).
- The garden mode's still-life/period-2 early exit is **not** used as-is:
  stationary enemy ash inside a crystal keeps damaging it. Any fast-forward
  must carry HP and accumulator state.

### 3.4 Budget and units

Budget **72 cells** (unused budget allowed). Units are **canonical prefabs**
in a fixed phase; no cell editing in this mode (otherwise a cheap gun
predecessor or overlapping stamps would dodge the price).

| Unit | Cost | Role | Limit per army |
|---|---:|---|---:|
| Gosper glider gun | 36 | sustained ranged attack (p30, diagonal) | 1 |
| Eater 1 (fishhook) | 7 | reusable defence vs. an aligned stream | 2 |
| LWSS | 9 | direct assault (c/2 orthogonal) | — |
| Glider | 5 | scout / flank / collision ingredient | — |
| Block | 4 | disposable obstacle (not a reliable wall) | — |
| R-pentomino | 5 | chaotic pressure / sabotage | 2 |

Example armies: gun + 2 eaters + 2 LWSS + block = 72; gun + eater + 3 LWSS =
70; 7 LWSS + eater = 70.

Custom stamps stay in the sandbox and garden battle. An unrestricted crystal
variant is deferred.

### 3.5 Deployment
- Hidden and simultaneous (AI picks without seeing the player's army).
- No overlapping units; nothing inside a crystal's exclusion zone.
- **Placement helpers** (phase 2): guns snap to certified firing mounts with a
  drawn trajectory ("clear path in isolation", not a promised hit); eaters
  snap to certified interception ports; ships get launch rails and spacing
  help; a warning when a placement intrudes into another unit's tested
  envelope; R-pentomino shows a short solo preview labelled unpredictable.

### 3.6 Playback
8 gen/s, 1.4 s reveal, slow final 24 generations, short result hold. A
640-generation match is ≈ 87 s including pauses; an unopposed gun kill lands
near 50 s.

## 4. Life facts the design relies on

Tested by Codex with our engine (`stepGrid`, `simulateBattle`):

| Fixture | Result |
|---|---|
| Red glider → blue eater 1 (standard approach) | Glider eaten; the eater recovers as 7 blue cells |
| Red glider → blue Snark | Outgoing glider stays red; the catalyst recovers but its block turns red (45 blue + 4 red) |
| Red glider → blue buckaroo (LifeWiki's reaction) | Outgoing glider stays red; oscillator back to its blue 23-cell phase at gen 150 |
| Red glider → blue block, varied offsets | Mutual annihilation, surviving blue block, miss, or big all-red reactions |
| Unopposed upper Gosper gun (portrait fixture) | First crystal contact gen 160; 64-HP crystal destroyed at gen 345 |
| 5-LWSS train (45 cells), unopposed | First contact gen 75; 45 HP over 720 gens (does **not** kill) |
| Blue eater at the certified upper-stream port | **Blocks the gun completely for 720 gens**, returns to 7 blue cells |

Consequences:
- An aligned eater is a reliable defence; a wrong-side hit has no guarantee.
- Reflectors divert shots without changing team, so a reflected red shot hitting
  the red crystal is harmless.
- Surviving cells never switch teams; collisions can leave hostile-coloured
  ash. A catalyst near your own crystal can leave enemy-coloured cells inside
  it after a reaction.

**The central risk:** a 7-cell eater nullifies a 36-cell gun. The mode only
works if equal-budget assault can contest that eater.

## 5. Counterplay (what actually holds)

| Interaction | Holds? | Placement skill |
|---|---|---|
| Gun → aligned eater | Yes, the stream is suppressed repeatedly | Which approach to cover |
| Assault → eater | Some approaches break it, others are eaten | Another lane, flank, catalytic surface |
| Assault → block wall | Collisions happen; blocking not guaranteed | Spacing and geometry |
| Methuselah → machinery | Nearby growth can break fragile machinery | Where expansion reaches; protect your own gun |
| Gun → incoming assault | Gliders can intercept ships | Timing-dependent |

There is **no universal rock-paper-scissors** in Life; counters are statements
about tested approaches, never "LWSS beats eater" in general. Intended
strategic tradeoff: *artillery rewards clear routes; defences cheaply close
selected routes; assault and growth contest those defences.*

## 6. Readability

Keep the team-coloured creature view, plus a **deployment-site overlay**:
- **Gun**: pencil flower cannon over the machinery; the mouth pulses when a
  real glider crosses a muzzle detector. Wilts if the core stops matching.
- **Projectile**: the small team glider creature with a short trail.
- **Eater**: fishhook silhouette; a bite ripple on a verified interception.
- **Crystal**: translucent faceted bud under the cells, 8 facets × 8 HP;
  cracks persist; saturation rises during an invasion.
- Paint stays faint decoration; flowers no longer imply a second score.
- Spectator vocabulary, shown once each: *Firing → Blocked → Breach → Crystal
  cracked*.

HP comes from grid occupancy only; never from creature identity.

## 7. AI

- Search over **units** (catalogue unit, certified mount/launch position,
  orientation), not cells; mutations move, replace or swap whole units.
- Templates: artillery + escorts, rush + light interception, growth pressure,
  defence + small counterattack.
- Score: win first, then HP difference, small bonus for surviving pressure and
  for the weakest matchup; population must not dominate.
- Public sample opponents covering both gun routes, staggered rushes, growth,
  defensive formations; held-out variants for measuring strength.

| Stars | Effort |
|---|---|
| 1★ | one valid attack-capable recipe |
| 2★ | 4 candidates vs 1 sample |
| 3★ | 8 vs 2 |
| 4★ | 16 screened, 4 finalists vs 4 |
| 5★ | 24 screened, 6 finalists vs 4, whole-unit mutations |

Screening stops at ~gen 320; finalists run 640. Runs in a **Web Worker** with
reused buffers. Codex measured ~9 ms per 96×128, 720-gen match in Node; p95 on
a mid-range phone must be measured.

## 8. Links

New versioned crystal challenge/replay payload containing the exact
deployment (units, positions, orientations). Existing garden (v2) and legacy
territory (v1) links keep working. Challenge links are only casually hidden
(reversible obfuscation; recipients can replay and counter-build): present
them as "beat my siege".

Later, timed reinforcement waves would be authored before the battle and
stored in the link, with one deterministic rule for obstructed spawns (the
prefab fails atomically) and a fixed event → step → damage order.

## 9. Validation (before building UI)

| Experiment | Measure |
|---|---|
| Gun catalogue | cost, startup, muzzle positions, period, colours, envelope, wall clearance |
| Eater matrix | orientations/ports, timing shifts, lane offsets; recovery, recolouring, leakage |
| Assault matrix | LWSS phases, stagger, lanes vs eaters and blocks; defender removal, onward damage |
| Composition interference | each recipe alone vs combined; friendly collisions, blocked launches |
| Crystal sweep | hitbox 10/12/14, HP 48/64/80, cap 4/8/12; kill time, rush damage, ash damage |
| Army tournament | gun, rush, growth, defence, hybrids; draws, side bias, dominant recipes |
| Replay parity | identical grids, HP, accumulators, end gen, winner headless vs visible |
| Performance | AI p50/p95, sim time, frame time on a mid-range phone |

Look for: an unbeatable cheap defence; an uncontestable gun alignment;
methuselah spam beating recognisable units; stationary enemy ash as the
dominant attack; wins from boundary debris; AI overfitting its samples.

**Playtest gates**
- ≥ 80% of matches damage a crystal; ≥ 60% end in destruction, not timeout.
- ≥ 3 distinct army styles win ~40–60% against the test pool.
- No stationary defence beats every equal-budget assault recipe tested.
- Most clips 30–90 s; first-time viewers can name the firing gun, the
  blocking eater and the damaged crystal.

**Release gate (milestone 1):** on a plain grid, *a gun damages a crystal, an
eater stops it, and an equal-budget assault can contest that eater.*

## 10. Plan

| Phase | Content | Size | Owner |
|---|---|---|---|
| 0. Experiments | §9 headless fixtures and sweeps; confirm or change numbers in §3; landscape geometry | M | Codex |
| 1. Minimal playable | siege sim state (HP, accumulators, endings) shared by headless and visible play; 6 prefabs; manual placement with limits/exclusions; crystal overlay; HUD; recording length | M–L | Codex (logic) + Claude (UI) |
| 2. Polish | snapping + trajectory previews; firing/bite/crack effects; unit-level AI in a Web Worker; versioned links | L | both |
| 3. Balance | tournament + first player playtests against the gates | L | both |

## 11. Open decisions

1. **Phasing**: experiments first, then the minimal playable mode. *Recommended.*
2. **Arena orientation**: landscape 128×96 (Claude) vs portrait 96×128
   (Codex's tested fixtures). *Recommended: landscape, re-validate fixtures in
   phase 0.*
3. **Garden battle**: keep it as a separate mode. *Recommended.*
4. Crystal numbers (64 HP, 12×12, cap 8, 16 units/HP) and the 72-cell budget
   are starting points pending phase 0.

## References
- LifeWiki: [Gosper glider gun](https://conwaylife.com/wiki/Gosper_glider_gun),
  [Eater 1](https://conwaylife.com/wiki/Eater_1),
  [Lightweight spaceship](https://conwaylife.com/wiki/Lightweight_spaceship),
  [Snark](https://conwaylife.com/wiki/Snark),
  [Buckaroo](https://conwaylife.com/wiki/Buckaroo),
  [Methuselah](https://conwaylife.com/wiki/Methuselah),
  [Colourised Life](https://conwaylife.com/wiki/Colourised_Life),
  [Glider colour](https://conwaylife.com/wiki/Glider#Colour_of_a_glider)
- Code: `src/battle/arena.ts`, `ai.ts`, `mode.ts`, `challenge.ts`,
  `src/life/clusters.ts`, `src/life/catalog.ts`
