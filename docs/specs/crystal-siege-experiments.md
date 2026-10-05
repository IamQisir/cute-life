# Crystal Siege Phase 0 experiments

**Release gate: YES**, for the landscape geometry below and the original
64 HP / 12×12 / cap 8 / 16 units per HP / 72-cell rules. An isolated 36-cell
Gosper gun first contacts at generation **108**, kills at **388**. A 7-cell
eater at `(69,35)/o0` stops it for all **640** generations, first disturbed at
52 and recovered at 54, ending with seven blue cells and no recolouring.

A legal **36-cell escort of four LWSS**, added to the gun, first damages at
**128**, kills at **268**, and leaves no blue cells. Its last original blue
eater cell disappears after generation 53. This is a collision/debris win:
the gun also breaks. The escort alone, or escort plus gun without that eater,
causes **zero crystal damage**. Composition is essential, not additive.
A **32-cell mixed escort** (two LWSS, two R-pentomino, block) also removes
all blue cells and kills at **429**, first contact294. Its gun core matches
solo at every generation321…640, but the downstream window matches only
32/320 generations: machinery survival does not certify a clean reset of the
stream. That escort alone already kills at429. A four-LWSS **flank** kills
at554 while leaving the eater and gun intact. Both satisfy the “otherwise
damage the crystal enough” alternative; do not interpret them as universal
stream-restoration recipes. No gun-preserving, fully blue-extinguishing
four-LWSS breach was found in this searched set.

The best whole-budget **eight-LWSS** attack against a functioning lower
blue gun + upper eater contacts at105 and wins at235 with **36 red HP**
remaining. This search damages in128/408 cases (31.4%), achieves a crystal
kill by640 in45/408 (11.0%), and wins the actual match in62/408 (15.2%,
including HP wins at timeout). Full recipes are listed below.

Keep the scoring numbers and prefab prices for Phase 1. **No scoring or
budget change is required to pass this release gate.** Adopt the measured
landscape geometry rather than placing crystals near the outer walls.
The small tournament does **not** pass the broader §9 playtest/balance gates;
Phase 0 establishes mechanical counterplay, not a balanced release.

## Method and reproducibility

Run from the repository root:

```sh
npx tsx scripts/siege-experiments.ts
npx tsx scripts/siege-experiments.ts --write-tables
npx vitest run tests/siege.test.ts
```

The second command refreshes only the generated tables between the markers
in this document. There are no UI imports, package changes, installs, network
inputs, random seeds, reinforcements, or changed challenge/replay encodings.
The runner reads the same eight trusted `.rle` files as `src/life/catalog.ts`
through its shared `decodeRle` parser. Six become the deployable prefabs;
Snark and buckaroo are laboratory fixtures only. Source text is injected into
pure TypeScript functions, so headless execution does not depend on Vite's
`import.meta.glob` transformation.

Every Life generation calls the existing `stepGrid` with both wrapping flags
false. Legal armies use `placeArmies` after stricter siege checks: 72-cell
budget, 1 gun / 2 eaters / 2 R-pentomino limits, zone bounds, exclusion halos,
and duplicate live-cell rejection. `emptyGrid` supplies observer fixtures.
Crystals never mutate cells. Only current enemy-coloured live cells count;
paint and deployer identity are absent. Damage applies **after** generation
1 onward, both crystals together, before death/timeout is decided. Integer
HP decides a timeout; accumulator remainders do not break an HP tie.

Matches normally stop on first lethal generation. Tables marked “at 640”
continue Life and exposure accounting to a fixed horizon for comparison;
those post-death units are diagnostic, not extra playable time. The first
terminal winner remains fixed. A timeout win can occur without destruction. “Kills by 640” can include a posthumous kill;
“match wins” accounts for the earlier death. Null contact/kill is shown as
`—`. HP lost is clamped at the initial HP; capped units retain the underlying
exposure even past death.

Searches exhaust the listed finite Cartesian products. Rates are **coverage
of these legal candidate sets**, not probabilities against arbitrary armies.
Invalid placements are excluded from denominators. Best means earliest kill,
then most capped exposure at 640; a nonkiller ranks by exposure. “No original
blue eater cells” describes the original seven sites, not universal removal
of all descendants. The chosen fastest breach additionally has **zero blue
population**, so its removal is unambiguous. “Intact gun core” in search tables
means its original footprint matches the isolated gun at generation 640;
the follow-up late-core comparison below checks an entire time interval.

## Geometry and notation

Coordinates are zero-based, inclusive, with y increasing downward.

| Element | Bounds / coordinates |
| --- | --- |
| Arena | x0…127, y0…95; walls, no wrap |
| Red deployment | x4…59, y4…91 |
| Blue deployment | x68…123, y4…91 |
| Red crystal centre / hitbox | (40,48); x34…45, y42…53 |
| Blue crystal centre / hitbox | (88,48); x82…93, y42…53 |
| Crystal exclusion | hitbox plus 2 cells, both crystals, live cells checked |
| Upper red guide | muzzle (61,28) → crystal edge (83,50), southeast |
| Lower red guide | muzzle (61,67) → crystal edge (83,45), northeast |
| Blue guides | horizontal mirrors: (66,28) → (44,50), (66,67) → (44,45) |
| Central guide | horizontal band y42…53; ships can cross their own transparent crystal |

The inset crystals make both diagonal gun routes fit the landscape height.
The guides are drawn paths on one open board. They impose no movement rules
or corridors. Guns on opposite sides can intercept each other's gliders;
the gun/gun tournament draw is one such example.

```text
                 upper red mount     upper blue mount
                          ↘             ↙
                           ↘           ↙
     red zone        [RED ◇]           [BLUE ◇]        blue zone
     ─────────────────── central band ────────────────────────
                           ↗           ↖
                          ↗             ↖
                 lower red mount     lower blue mount
```

A recipe `id@x,y/oN` anchors the **normalized live-cell bounding box**.
Orientations 0…3 rotate the catalogue seed clockwise 0/90/180/270°;
4…7 first reflect horizontally, then perform the same rotations. Every
release-gate candidate uses the exact catalogue phase, with cost equal to
its initial live population. Glider headings for o0…o7 are
SE, SW, NW, NE, SW, NW, NE, SE. LWSS headings are
W, N, E, S, E, S, W, N; the main search uses rightward o2 and o4.
Gun headings match the glider heading list. Rotated gun footprints are
9×36 instead of 36×9. Eater footprints are 4×4 in all orientations.

The first detached shot has five cells outside the seed footprint; the muzzle
table records its bbox at generation 30. This is a reproducible **shot
observation**, not a physical crystal or a modification to the gun. The
seed footprint's p30 core check and emitted colour are measured separately.

## Search space and interpretation

- Four-LWSS escorts: orientations {2,4}, x spacing {7,10,14}, x origin
  `4 + {0,2,4,6,8}`, top lane 22…62, alternating lane stagger
  {-6,-3,0,3,6}. Spatial x shifts vary arrival by 2 generations per cell;
  intership spacing varies intervals by 14/20/28 generations. All launch at
  generation zero. The friendly gun is included during every search run.
- Mixed escorts: orientations {2,4}, ship spacing {10,14}, x origins {4,8,12},
  lanes 26…54, ingredient lane deltas {-8,-4,0,4,8}. Three LWSS + glider +
  block costs 36; two LWSS + two R-pentomino + block costs 32; two LWSS +
  four blocks costs 34. Underuse of budget is allowed.
- Seven-glider escorts: orientations {0,3,6,7}, y spacing {4,6,8}, y origin
  4…78 in steps of 2, x origin {20,28,36}; alternate x offsets of 6. Cost 35.
- Whole-budget assault: eight LWSS, two rails of four; orientations {2,4},
  x spacing {7,10,14}, x origins {4,8,12}, rail separation {6,10,14}, first
  lane 20…58 in steps of 2. Defender costs 43 (gun + eater), with unused
  budget allowed. Test both gun mounts: the upper mount interferes with the
  eater, while the lower one independently kills at 388. Use the clean lower
  mount when interpreting counterplay against a functioning defence.
- Eater port matrix: x69…75 × y31…39 × all eight orientations. Recovery
  means exactly the original seven blue sites and no other blue cells **at
  generation 640**; a zero-leak broken eater is not counted as recovered.
- Timing diagnostics advance the isolated gun by {0,1,2,3,4,5,10,15,20,25,29}
  generations before adding the eater. LWSS diagnostics check all four
  temporal phases at x48, lanes29…41. These laboratory seeds can violate
  canonical phase, zone, or cost restrictions and do not contribute to gate
  success rates. LWSS phases 1 and 3 have **12**, not 9, live cells.
- Crystal sweep: all 27 hitbox/HP/cap combinations, same centre coordinates,
  same 16 units per HP. Gun fixture is unchanged. Rush is five canonical
  LWSS on two separated rear launch rails: (4,42), (14,42), (24,42), (4,49),
  (14,49), all o4, cost45. Each is legal even under the 14-cell hitbox halo.
  Ash is a single red block at (86,46), deliberately seeded inside the blue
  crystal to isolate stationary damage; this is **not legal deployment**.
- Tournament: one deterministic template per style, all unordered pairs
  including self matches, plus reversed red/blue roles (30 games). Self
  matches are intentionally counted twice. Per-style rates count both army
  appearances (12 each) and score draws as half a win. Template budgets are intentionally unequal
  (gun36, rush45, growth10, defence18, hybrid68); these are interaction probes,
  not equal-spend balance evidence. Templates and costs are listed below;
  no claim of optimal AI strength or a held-out evaluation.

A block held inside the crystal kills 64 HP in **256 generations**, faster
than the isolated gun. The fastest escort is a particularly strong debris
synergy: deleting the defender prevents its attack entirely. This is evidence
that recognisable-ship counterplay exists, and also that stationary ash and
friendly interference deserve Phase 1 playback inspection.

The portrait facts revalidate qualitatively for the eater, buckaroo, block
collisions, and gun scoring. Five-LWSS landscape rush loses 33 HP at default
rules and does not kill (the historical portrait train lost45). The supplied
Snark fixture gives a red outgoing glider and red four-cell block, with
**48 blue** recovered cells rather than the historical45. Its supplied
catalyst begins with52 cells; this does not certify the older 49-cell fixture.
Snark is excluded from v1 prefabs, so this discrepancy does not affect the gate.

## Decisions and remaining validation

Retain 64 HP / 12×12 / cap8 / 16 units per HP / budget72 and the two-cell
exclusion halo for the minimal playable mode. Do not increase eater cost or
impose a minimum crystal distance on the evidence here: an equal-budget
assault already contests the certified port. The 27-way sweep is evidence
for tuning later, not a reason to silently change the release-gate rules.

The tournament's damage/destruction/style-rate results below are insufficient
for the broader §9 targets. Expand templates and held-out placements before
claiming balance; ensure defence recipes have independent firing envelopes.
The chosen gate port is not every possible eater port, and no finite search
proves all defences contestable. Other ports, two eaters, mixed defenders,
viewer readability, UI/headless replay parity, worker p50/p95, and mid-range
phone frame timing remain Phase 1/3 checks. No siege UI exists yet, so visible
parity cannot honestly be measured in Phase 0. Headless determinism and
transparency to the existing engine are covered by tests.

The new fixture suite runs in about one second. The full runner
(`npx tsx scripts/siege-experiments.ts`) takes about two minutes and was
re-run independently with the same gate result and breach numbers.

<!-- BEGIN GENERATED TABLES -->

### Canonical prefab catalogue

| Unit | Cost | Footprint | Phase populations 0/1/2/3 |
| --- | --- | --- | --- |
| gosperglidergun | 36 | 36×9 | seed only |
| eater1 | 7 | 4×4 | seed only |
| lwss | 9 | 5×4 | 9/12/9/12 |
| glider | 5 | 3×3 | 5/5/5/5 |
| block | 4 | 2×2 | seed only |
| rpentomino | 5 | 3×3 | seed only |

### Gun mounts

| Mount | Recipe | First contact | Kill | HP lost | Capped units at 640 | Red HP |
| --- | --- | --- | --- | --- | --- | --- |
| upper vertical | gosperglidergun@51,4/o7 | 108 | 388 | 64 | 1967 | 64 |
| lower vertical | gosperglidergun@51,56/o3 | 108 | 388 | 64 | 1967 | 64 |
| upper horizontal | gosperglidergun@24,4/o0 | 162 | 442 | 64 | 1759 | 64 |
| lower horizontal | gosperglidergun@24,83/o6 | 162 | 442 | 64 | 1759 | 64 |
| upper + eater | eater1@69,35/o0 | — | — | 0 | 0 | 64 |

### Gun muzzle / core certification

| Mount | Footprint | Heading | First five cells outside footprint | Shot bbox at gen30 | Core period | Shot colour |
| --- | --- | --- | --- | --- | --- | --- |
| gosperglidergun@51,4/o7 | 9×36 | SE | 28 | x60…62, y27…29 | 30 | red |
| gosperglidergun@51,56/o3 | 9×36 | NE | 28 | x60…62, y66…68 | 30 | red |
| gosperglidergun@24,4/o0 | 36×9 | SE | 28 | x47…49, y13…15 | 30 | red |
| gosperglidergun@24,83/o6 | 36×9 | NE | 28 | x47…49, y80…82 | 30 | red |
| gosperglidergun@68,4/o1 | 9×36 | SW | 28 | x65…67, y27…29 | 30 | red |
| gosperglidergun@68,56/o5 | 9×36 | NW | 28 | x65…67, y66…68 | 30 | red |
| gosperglidergun@68,4/o4 | 36×9 | SW | 28 | x78…80, y13…15 | 30 | red |
| gosperglidergun@68,83/o2 | 36×9 | NW | 28 | x78…80, y80…82 | 30 | red |

### Eater recovery

| First disturbance | First exact recovery | Blue at original sites at 640 | Red at original sites | Total blue | Leakage units |
| --- | --- | --- | --- | --- | --- |
| 52 | 54 | 7 | 0 | 7 | 0 |

### Eater ports: x69…75, y31…39

| Orientation | Legal cases | Zero leakage | Exact blue recovery at 640 | Red original sites | Leaks | Max units |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 63 | 12 | 20 | 14 | 51 | 1967 |
| 1 | 63 | 16 | 6 | 11 | 47 | 3198 |
| 2 | 63 | 10 | 17 | 10 | 53 | 3726 |
| 3 | 63 | 9 | 6 | 16 | 54 | 3423 |
| 4 | 63 | 11 | 6 | 15 | 52 | 2882 |
| 5 | 63 | 24 | 22 | 8 | 39 | 1967 |
| 6 | 63 | 26 | 13 | 13 | 37 | 1967 |
| 7 | 63 | 13 | 19 | 14 | 50 | 3423 |

### Arrival timing diagnostics (pre-advanced gun)

| Gun advance | Leakage units | Eater state at horizon | Blue population |
| --- | --- | --- | --- |
| 0 | 0 | 7 blue | 7 |
| 1 | 0 | 7 blue | 7 |
| 2 | 0 | 7 blue | 7 |
| 3 | 0 | 7 blue | 7 |
| 4 | 0 | 7 blue | 7 |
| 5 | 0 | 7 blue | 7 |
| 10 | 0 | 7 blue | 7 |
| 15 | 0 | 7 blue | 7 |
| 20 | 0 | 7 blue | 7 |
| 25 | 0 | 7 blue | 7 |
| 29 | 0 | 7 blue | 7 |

### Assault search (canonical seeds, 640 generations)

| Family | Legal cases | Damage | Kills by 640 | Match wins | No original blue eater cells at 640 | Kills with intact gun core (includes flanks) | Best contact | Best kill | Best HP lost | Best recipe |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4 LWSS + gun | 3269 | 792/3269 (24.2%) | 114/3269 (3.5%) | 762/3269 (23.3%) | 866 | 39 | 128 | 268 | 64 | lwss@12,33/o2; lwss@26,30/o2; lwss@40,33/o2; lwss@54,30/o2 |
| glider escort + gun | 501 | 186/501 (37.1%) | 25/501 (5.0%) | 178/501 (35.5%) | 219 | 0 | 185 | 316 | 64 | lwss@4,44/o4; lwss@14,44/o4; lwss@24,44/o4; glider@54,40/o0; block@50,34/o0 |
| growth escort + gun | 552 | 123/552 (22.3%) | 60/552 (10.9%) | 117/552 (21.2%) | 205 | 8 | 156 | 297 | 64 | lwss@4,50/o2; lwss@14,50/o2; rpentomino@54,54/o0; rpentomino@48,46/o0; block@44,60/o0 |
| blocks escort + gun | 828 | 187/828 (22.6%) | 22/828 (2.7%) | 178/828 (21.5%) | 257 | 0 | 241 | 408 | 64 | lwss@12,29/o2; lwss@22,29/o2; block@50,37/o0; block@44,37/o0; block@38,37/o0; block@32,37/o0 |
| 7 gliders + gun | 828 | 90/828 (10.9%) | 20/828 (2.4%) | 84/828 (10.1%) | 156 | 10 | 206 | 394 | 64 | glider@28,58/o3; glider@34,58/o3; glider@28,66/o3; glider@34,66/o3; glider@28,74/o3; glider@34,74/o3; glider@28,82/o3 |
| 8 LWSS vs upper gun+eater (interference) | 408 | 134/408 (32.8%) | 32/408 (7.8%) | 126/408 (30.9%) | 381 | 0 | 105 | 233 | 64 | lwss@4,42/o4; lwss@11,42/o4; lwss@18,42/o4; lwss@25,42/o4; lwss@4,48/o4; lwss@11,48/o4; lwss@18,48/o4; lwss@25,48/o4 |
| 8 LWSS vs lower gun+eater | 408 | 128/408 (31.4%) | 45/408 (11.0%) | 62/408 (15.2%) | 252 | 0 | 105 | 235 | 64 | lwss@4,34/o4; lwss@11,34/o4; lwss@18,34/o4; lwss@25,34/o4; lwss@4,44/o4; lwss@11,44/o4; lwss@18,44/o4; lwss@25,44/o4 |
| 4 LWSS vs block | 3540 | 850/3540 (24.0%) | 190/3540 (5.4%) | 832/3540 (23.5%) | 0 | 0 | 53 | 245 | 64 | lwss@12,36/o2; lwss@26,39/o2; lwss@40,36/o2; lwss@54,39/o2 |

### Selected breaches

| Recipe | Contact | Kill | Units | Last blue original-site generation | Blue original sites at 640 | Gun core matches solo at 640 | Total blue at 640 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| fastest equal-budget | 128 | 268 | 4001 | 53 | 0 | no | 0 |
| fastest with intact gun | 294 | 429 | 2687 | 295 | 0 | yes | 0 |

### LWSS flank: gun intact, eater still blocking

| Recipe | First contact | Kill | Units | Last original blue generation | Original blue at640 |
| --- | --- | --- | --- | --- | --- |
| lwss@6,50/o4; lwss@13,50/o4; lwss@20,50/o4; lwss@27,50/o4 | 101 | 554 | 1230 | 640 | 7 |

### Defence composition baseline (no attacker)

| Blue recipe | Red contact | Red kill | Red exposure units |
| --- | --- | --- | --- |
| upper gun alone | 108 | 388 | 1967 |
| upper gun + eater | — | — | 0 |
| lower gun + eater | 108 | 388 | 1967 |

### Late gun / stream comparison: generations321…640

| Escort | Core matches out of320 | Post-port window matches out of320 | Total blue at640 |
| --- | --- | --- | --- |
| fastest | 0 | 0 | 0 |
| gun-preserving breach | 320 | 32 | 0 |
| LWSS flank | 320 | 83 | 7 |

### Composition interference

| Escort | Gun | Eater | Contact | Kill | HP lost | Units | Red HP | Gun core matches solo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fastest | no | no | — | — | 0 | 0 | 64 | no |
| fastest | no | yes | — | — | 0 | 0 | 64 | no |
| fastest | yes | no | — | — | 0 | 0 | 64 | no |
| fastest | yes | yes | 128 | 268 | 64 | 4001 | 64 | no |
| intact gun | no | no | 294 | 451 | 64 | 2538 | 64 | no |
| intact gun | no | yes | 294 | 429 | 64 | 2282 | 64 | no |
| intact gun | yes | no | 108 | — | 41 | 660 | 64 | no |
| intact gun | yes | yes | 294 | 429 | 64 | 2687 | 64 | yes |
| LWSS flank | no | no | 101 | 554 | 64 | 1230 | 64 | no |
| LWSS flank | no | yes | 101 | 554 | 64 | 1230 | 64 | no |
| LWSS flank | yes | no | 101 | 335 | 64 | 2151 | 64 | yes |
| LWSS flank | yes | yes | 101 | 554 | 64 | 1230 | 64 | yes |

### Crystal sweep

| Hitbox | HP | Cap | Gun contact | Gun kill | 5-LWSS rush HP lost | Rush units | 4-cell ash kill | Ash HP lost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 48 | 4 | 112 | 463 | 16 | 267 | 192 | 48 |
| 10 | 48 | 8 | 112 | 431 | 31 | 503 | 192 | 48 |
| 10 | 48 | 12 | 112 | 431 | 43 | 695 | 192 | 48 |
| 10 | 64 | 4 | 112 | 583 | 16 | 267 | 256 | 64 |
| 10 | 64 | 8 | 112 | 544 | 31 | 503 | 256 | 64 |
| 10 | 64 | 12 | 112 | 544 | 43 | 695 | 256 | 64 |
| 10 | 80 | 4 | 112 | — | 16 | 267 | 320 | 80 |
| 10 | 80 | 8 | 112 | — | 31 | 503 | 320 | 80 |
| 10 | 80 | 12 | 112 | — | 43 | 695 | 320 | 80 |
| 12 | 48 | 4 | 108 | 347 | 17 | 284 | 192 | 48 |
| 12 | 48 | 8 | 108 | 315 | 33 | 543 | 192 | 48 |
| 12 | 48 | 12 | 108 | 315 | 47 | 765 | 192 | 48 |
| 12 | 64 | 4 | 108 | 426 | 17 | 284 | 256 | 64 |
| 12 | 64 | 8 | 108 | 388 | 33 | 543 | 256 | 64 |
| 12 | 64 | 12 | 108 | 388 | 47 | 765 | 256 | 64 |
| 12 | 80 | 4 | 108 | 508 | 17 | 284 | 320 | 80 |
| 12 | 80 | 8 | 108 | 455 | 33 | 543 | 320 | 80 |
| 12 | 80 | 12 | 108 | 455 | 47 | 765 | 320 | 80 |
| 14 | 48 | 4 | 104 | 298 | 18 | 300 | 192 | 48 |
| 14 | 48 | 8 | 104 | 260 | 35 | 575 | 192 | 48 |
| 14 | 48 | 12 | 104 | 260 | 48 | 813 | 192 | 48 |
| 14 | 64 | 4 | 104 | 362 | 18 | 300 | 256 | 64 |
| 14 | 64 | 8 | 104 | 312 | 35 | 575 | 256 | 64 |
| 14 | 64 | 12 | 104 | 312 | 50 | 813 | 256 | 64 |
| 14 | 80 | 4 | 104 | 426 | 18 | 300 | 320 | 80 |
| 14 | 80 | 8 | 104 | 363 | 35 | 575 | 320 | 80 |
| 14 | 80 | 12 | 104 | 363 | 50 | 813 | 320 | 80 |

### Landscape revalidation of local Life facts

| Fixture | Generation | Red population | Blue population | Setup / caveat |
| --- | --- | --- | --- | --- |
| Snark supplied incoming glider | 150 | 9 | 48 | red outgoing glider5 + red block4; supplied RLE recovers 48 blue (historical45 not reproduced) |
| Buckaroo found reflection | 150 | 5 | 23 | [[52,22],[53,23],[51,24],[52,24],[53,24]] |
| Single glider → certified eater | 160 | 0 | 7 | red approach x60,y27/o7 |

### Glider / block lane offsets

| Block dy | Red at 160 | Blue at 160 |
| --- | --- | --- |
| -8 | 5 | 4 |
| -7 | 5 | 4 |
| -6 | 5 | 4 |
| -5 | 0 | 4 |
| -4 | 24 | 0 |
| -3 | 167 | 0 |
| -2 | 0 | 0 |
| -1 | 0 | 0 |
| 0 | 0 | 0 |
| 1 | 0 | 0 |
| 2 | 0 | 0 |
| 3 | 0 | 0 |
| 4 | 131 | 0 |
| 5 | 24 | 0 |
| 6 | 0 | 4 |
| 7 | 5 | 4 |
| 8 | 5 | 4 |

### Single-LWSS phase diagnostics vs eater (lanes29…41, x48)

| Phase | Seed live cells | Cases | Damage cases | Original blue sites absent | Max units |
| --- | --- | --- | --- | --- | --- |
| 0 | 9 | 13 | 1 | 8 | 604 |
| 1 | 12 | 13 | 2 | 7 | 2618 |
| 2 | 9 | 13 | 2 | 7 | 2618 |
| 3 | 12 | 13 | 1 | 7 | 604 |

### Tournament template costs

| Style | Live-cell cost | Recipe |
| --- | --- | --- |
| gun | 36 | gosperglidergun@51,4/o7 |
| rush | 45 | lwss@4,42/o4; lwss@14,42/o4; lwss@24,42/o4; lwss@4,49/o4; lwss@14,49/o4 |
| growth | 10 | rpentomino@54,25/o0; rpentomino@54,64/o0 |
| defence | 18 | eater1@52,35/o4; eater1@52,57/o6; block@51,46/o0 |
| hybrid | 68 | gosperglidergun@51,4/o7; lwss@8,49/o2; lwss@18,49/o2; rpentomino@54,57/o0; rpentomino@48,49/o0; block@44,63/o0 |

### Small tournament: 30 games including mirrored self matches

| Red style | Blue style | Winner | Red HP | Blue HP | End gen | Swapped winner | Swapped red HP | Swapped blue HP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gun | gun | draw | 64 | 64 | 640 | draw | 64 | 64 |
| gun | rush | red | 31 | 0 | 418 | blue | 0 | 31 |
| gun | growth | red | 64 | 51 | 640 | blue | 51 | 64 |
| gun | defence | draw | 64 | 64 | 640 | draw | 64 | 64 |
| gun | hybrid | blue | 0 | 64 | 499 | red | 64 | 0 |
| rush | rush | draw | 64 | 64 | 640 | draw | 64 | 64 |
| rush | growth | blue | 0 | 41 | 412 | red | 41 | 0 |
| rush | defence | red | 64 | 40 | 640 | blue | 40 | 64 |
| rush | hybrid | blue | 0 | 64 | 418 | red | 64 | 0 |
| growth | growth | draw | 64 | 64 | 640 | draw | 64 | 64 |
| growth | defence | draw | 64 | 64 | 640 | draw | 64 | 64 |
| growth | hybrid | blue | 51 | 64 | 640 | red | 64 | 51 |
| defence | defence | draw | 64 | 64 | 640 | draw | 64 | 64 |
| defence | hybrid | blue | 54 | 64 | 640 | red | 64 | 54 |
| hybrid | hybrid | draw | 64 | 64 | 640 | draw | 64 | 64 |

### Tournament rates

| Style | Wins | Draws | Losses | Win rate (draw=0.5) |
| --- | --- | --- | --- | --- |
| gun | 4 | 6 | 2 | 58.3% |
| rush | 2 | 4 | 6 | 33.3% |
| growth | 2 | 6 | 4 | 41.7% |
| defence | 0 | 8 | 4 | 33.3% |
| hybrid | 8 | 4 | 0 | 83.3% |

### Tournament gates / side bias

| Games | Crystal damaged | Destruction | Red wins | Blue wins | Draws | Mirror HP/end mismatches |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 16/30 (53.3%) | 8/30 (26.7%) | 8 | 8 | 14 | 0 |

### Headless determinism

| Identical grid | Identical HP/accumulators | Generation |
| --- | --- | --- |
| yes | yes | 640 |

### Simultaneous lethal observation

| Red HP | Blue HP | Winner |
| --- | --- | --- |
| 0 | 0 | draw |

### Recipes

- **gun** (36 cells): gosperglidergun@51,4/o7
- **eater** (7 cells): eater1@69,35/o0
- **initialBest** (36 cells): lwss@12,33/o2; lwss@26,30/o2; lwss@40,33/o2; lwss@54,30/o2
- **4 LWSS + gun** (36 cells): lwss@12,33/o2; lwss@26,30/o2; lwss@40,33/o2; lwss@54,30/o2
- **4 LWSS + gun intact gun** (36 cells): lwss@6,50/o4; lwss@13,50/o4; lwss@20,50/o4; lwss@27,50/o4
- **glider escort + gun** (36 cells): lwss@4,44/o4; lwss@14,44/o4; lwss@24,44/o4; glider@54,40/o0; block@50,34/o0
- **growth escort + gun** (32 cells): lwss@4,50/o2; lwss@14,50/o2; rpentomino@54,54/o0; rpentomino@48,46/o0; block@44,60/o0
- **growth escort + gun intact gun** (32 cells): lwss@8,49/o2; lwss@18,49/o2; rpentomino@54,57/o0; rpentomino@48,49/o0; block@44,63/o0
- **blocks escort + gun** (34 cells): lwss@12,29/o2; lwss@22,29/o2; block@50,37/o0; block@44,37/o0; block@38,37/o0; block@32,37/o0
- **7 gliders + gun** (35 cells): glider@28,58/o3; glider@34,58/o3; glider@28,66/o3; glider@34,66/o3; glider@28,74/o3; glider@34,74/o3; glider@28,82/o3
- **7 gliders + gun intact gun** (35 cells): glider@36,62/o3; glider@42,62/o3; glider@36,70/o3; glider@42,70/o3; glider@36,78/o3; glider@42,78/o3; glider@36,86/o3
- **8 LWSS vs upper gun+eater (interference)** (72 cells): lwss@4,42/o4; lwss@11,42/o4; lwss@18,42/o4; lwss@25,42/o4; lwss@4,48/o4; lwss@11,48/o4; lwss@18,48/o4; lwss@25,48/o4
- **8 LWSS vs lower gun+eater** (72 cells): lwss@4,34/o4; lwss@11,34/o4; lwss@18,34/o4; lwss@25,34/o4; lwss@4,44/o4; lwss@11,44/o4; lwss@18,44/o4; lwss@25,44/o4
- **4 LWSS vs block** (36 cells): lwss@12,36/o2; lwss@26,39/o2; lwss@40,36/o2; lwss@54,39/o2
- **best** (36 cells): lwss@12,33/o2; lwss@26,30/o2; lwss@40,33/o2; lwss@54,30/o2
- **preserved** (32 cells): lwss@8,49/o2; lwss@18,49/o2; rpentomino@54,57/o0; rpentomino@48,49/o0; block@44,63/o0
- **lwssFlank** (36 cells): lwss@6,50/o4; lwss@13,50/o4; lwss@20,50/o4; lwss@27,50/o4
- **tournament gun** (36 cells): gosperglidergun@51,4/o7
- **tournament rush** (45 cells): lwss@4,42/o4; lwss@14,42/o4; lwss@24,42/o4; lwss@4,49/o4; lwss@14,49/o4
- **tournament growth** (10 cells): rpentomino@54,25/o0; rpentomino@54,64/o0
- **tournament defence** (18 cells): eater1@52,35/o4; eater1@52,57/o6; block@51,46/o0
- **tournament hybrid** (68 cells): gosperglidergun@51,4/o7; lwss@8,49/o2; lwss@18,49/o2; rpentomino@54,57/o0; rpentomino@48,49/o0; block@44,63/o0

<!-- END GENERATED TABLES -->

## Capture rule (owner proposal)

This is an additional headless scoring experiment, not a change to the decided
HP rules above. Select `scoring: 'capture'`; `DEFAULT_RULES.scoring` remains
`'hp'`. Life remains B3/S23 + Immigration with the same catalogue seeds, walls,
budget 72, deployment zones, exclusion halo, unit limits, and 640-generation
horizon. After each evolution, the garden battle's `paintCells` repaints live
sites in their current colour. Base tiles start owner-painted at generation 0;
empty sites retain paint. Enemy-painted tiles / hitbox area is the capture
fraction. H=0 captures on the first qualifying observation; H>0 requires H
consecutive qualifying observations, including that first one. A decrease
below T resets the hold. Both bases are observed before deciding simultaneous
capture; the first terminal result is retained during diagnostic continuation.
At timeout, smaller own-base enemy paint wins, with exact equality drawing.

Reproduce the generated tables with
`npx tsx scripts/siege-experiments.ts --capture --write-tables`.
The HP command and generated HP tables remain unchanged. The capture sweep
reuses the exact Phase 0 candidate generators, then replays 48 scorers over
each full Life/paint trajectory: T={.4,.5,.6,.75}, H={0,8,16,32},
hitbox={10,12,14}. Legality is checked separately for each hitbox. Capture
rates count games where either base is captured; medians include only those
games and use the first terminal generation, with seconds = generations/8.
Draws and timeouts overlap: a timeout can produce a win or a draw.

Unopposed coverage maximizes the enemy-base fraction over the full horizon,
not just at a terminal result. LWSS and seven-glider candidates use the
existing search families. The additional single-glider search uses
orientations {0,3,6,7}, x={20,36,52}, y=4…84 by4. The one/two-R searches use
all eight orientations, x={20,36,52}, y=12…76 by8, with the second R offset
(-8,+8). Eighteen stationary blocks are spaced seven cells apart on a 6×3
rear deployment lattice. These finite maxima do not prove global maxima.

All four certified red gun mounts paint **22/144 = 15.28%** at 12×12;
the four certified blue counterparts have the same enemy-base coverage by
reflection and recolouring. The streams clip a corner. A searched single
glider paints **44/144 = 30.56%**, confirming the roughly three-wide diagonal
stripe expectation for a centred traversal. Repeating a stream over the same
lane cannot expand its already-painted footprint. Four LWSS, gun+four LWSS,
and one or two R-pentominoes each have a searched **100%** coverage case;
eight LWSS reach **87.50%**, seven gliders **43.75%**, legal stationary blocks
**0%**. The nonmonotonic four/eight-ship result reflects the different finite
families and collisions; these are not independently additive unit strengths.

The old fastest HP breach does not capture at the proposed thresholds. Its
two settled in-base red blocks occupy **8/144 = 5.56%** (the third block is
outside the hitbox, correcting the initial three-in-base description); isolated with fresh
owner paint they paint exactly that fraction forever. The complete collision
leaves **45/144 = 31.25%** painted, including earlier transient live sites, and
that paint stops growing at generation 170. A single diagnostic in-base block paints
**4/144 = 2.78%** forever. In-base seeds are illegal deployments and only
isolate observer behaviour. Persistent ash no longer accumulates damage, but
**the proposed timeout still awards a win for any surviving paint advantage**:
the old legal breach and both illegal ash probes win at generation 640.
Thus “ash-only wins do not exist” is false if timeout wins are included.
The tables distinguish legal stationary block-only deployments, which never
reach a base, from legal assaults ending with stationary enemy residents.
A stationary-resident timeout win means a non-draw timeout with enemy live
cells in the losing base and no change to that base's coloured live grid
in the last 64 generations; it is not proof that only ash caused earlier paint.

The aligned certified eater prevents **all enemy paint for 640 generations**.
Owner cells can reclaim paint: the isolated repaint probes begin with 100%
enemy paint and measure the area restored by owner LWSS/gliders. The legal
late owner glider at `glider@120,81/o2` gives an actual paint decrease during
a gun attack, from **25/144 to 24/144**. Tug-of-war tables also count decreases
in simultaneous opposing deployments. Painting never restores HP or affects
cell births, survival, or allegiance.

The fixed HP tournament archetypes are reused, including its original
68-cell gun-preserving hybrid, rather than retuned to capture. Their costs
remain unequal and these are interaction probes under a common72-cell
ceiling, not equal-spend balance evidence. The hybrid overlaps the larger
14×14 exclusion halo, so its ten appearances are excluded there: tournament
samples are 30 games at hitbox 10/12 and 20 at 14. No illegal seed contributes
a gate. The stationary challenge uses five fixed defences (certified eater,
port block, two lane eaters, tournament defence, and72 rear blocks) against
a portfolio of discovered assaults. A counterexample only refutes that
particular template, not every possible stationary defence placement.

Assault tables keep red as attacker and blue as defender; their red−blue
outcome difference measures asymmetric roles. **Paired geographic side bias
is 0 percentage points for every family and parameter set**, derived by
reflecting/recolouring each trajectory and exchanging the two histories.
The even-sized base boxes, zones, walls, and Immigration majority rule are
invariant under that operation. Tests independently verify full fraction
histories for all three hitboxes and all 48 replay scorers. Tournament side
counts are measured with actual reversed deployments; those results and
mirror fraction/end mismatches are reported below.

Recommend **T=.4, H=16, hitbox12×12, budget 72** for the next capture
experiment. T=.4 exceeds both the centred single-glider stripe (30.56%) and
the old breach's retained collision paint (31.25%), while allowing a broad
ship sweep to capture. H=16 is about two seconds of qualifying observations
at 8 gen/s. Keep the existing base geometry and budget: all requested parameter
sets have legal combined-attack witnesses, with no evidence here requiring a
larger budget. This recommendation is for evaluating the mode; it does not
resolve the role of guns or remove residual-paint timeout wins.

At these parameters the pooled assaults capture in **1249/10334 = 12.1%** of
games, median **gen 158 / 19.75s**. There are **7596 draws**, **9085 timeouts**,
and 2456 red/282 blue wins with roles fixed. The 30-game tournament captures
in **8/30 = 26.7%**, median **gen 150 / 18.75s**, with 14 draws, 22 timeouts,
and 8 wins per side. Mirrored fraction/end mismatches are 0. The hybrid's
83.3% style win rate remains high in this small, unequal-cost tournament.

The release gate is **YES for all 48 sets if “gun-led” means a combined
army containing a gun**: such an attack captures an empty base, the certified
eater stops the gun alone, and a legal combined attack captures its defended
base. The separate **gun-alone capture gate is NO for all 48 sets**; it
paints only 14/100,22/144,30/196 at hitbox 10/12/14 respectively, all below .4.
The recommended fastest 72-cell recipe is:
`gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2`.
It contacts at gen 47 and captures both empty and eater-defended bases at
**gen 86 / 10.75s**. Importantly, its 36-cell LWSS component also captures both
at gen 86 without the gun, before the certified gun's isolated contact at 108.
The gun-preserving 68-cell `UPPER_GUN + BREACH_ESCORT` fixture captures the
eater-defended base at gen 330 / 41.25s. Gun presence is therefore not evidence
of a necessary or dominant gun attack; a stricter functional gun-led gate
remains unestablished. All96 reported empty/defended sweep witness generations
were independently checked against the actual capture simulator.

None of the **five tested stationary defence templates** is undefeated by
the challenge portfolio at any parameter set. That finite result does not
prove every legal stationary defence contestable. The legal 72-cell stationary
block army has **0 wins and 0 captures across48 scoring sets**, but stationary
residents accompany **107/10334 = 1.04%** of all recommended-set assault games
ending in a timeout win (**107/2738 = 3.91% of decisive outcomes**). For the
five gun-led families this is **34/5978 = 0.57%** of games, or **34/1408 = 2.41%**
of decisive outcomes. Pure illegal in-base blocks also win at timeout.
Capture eliminates accumulating HP drain, not the incentive to retain a
small paint advantage. A claim of ash-free wins would require changing the
owner's timeout rule and is not made here.

The scoring mechanism is deliberately the same painting rule as garden
battle. The strategic topology differs: garden contests one shared central
garden; siege protects an owner-painted base while attacking the opponent's
separate base, with local repainting and a threshold/hold finish. These
headless probes do not establish that the mode feels sufficiently distinct
in play, or that gun/eater warfare dominates rather than territorial chaos.

<!-- BEGIN GENERATED CAPTURE TABLES -->

### Unopposed coverage (12×12, full 640 generations)

| Unit family | Legal cases | Max enemy paint | First max gen | Cost | Best full recipe |
| --- | --- | --- | --- | --- | --- |
| one gun gosperglidergun@51,4/o7 | 1 | 15.28% | 132 | 36 | gosperglidergun@51,4/o7 |
| one gun gosperglidergun@51,56/o3 | 1 | 15.28% | 132 | 36 | gosperglidergun@51,56/o3 |
| one gun gosperglidergun@24,4/o0 | 1 | 15.28% | 186 | 36 | gosperglidergun@24,4/o0 |
| one gun gosperglidergun@24,83/o6 | 1 | 15.28% | 186 | 36 | gosperglidergun@24,83/o6 |
| 4 LWSS | 3540 | 100.00% | 549 | 36 | lwss@4,31/o2; lwss@11,31/o2; lwss@18,31/o2; lwss@25,31/o2 |
| 8 LWSS | 408 | 87.50% | 640 | 72 | lwss@12,26/o2; lwss@19,26/o2; lwss@26,26/o2; lwss@33,26/o2; lwss@12,36/o2; lwss@19,36/o2; lwss@26,36/o2; lwss@33,36/o2 |
| gun + 4 LWSS | 3269 | 100.00% | 250 | 72 | gosperglidergun@51,4/o7; lwss@4,45/o2; lwss@11,39/o2; lwss@18,45/o2; lwss@25,39/o2 |
| one glider | 236 | 30.56% | 156 | 5 | glider@52,12/o0 |
| 7 gliders | 828 | 43.75% | 193 | 35 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| one R-pentomino | 200 | 100.00% | 154 | 5 | rpentomino@52,52/o2 |
| two R-pentomino | 184 | 100.00% | 154 | 10 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| 18 blocks (72 cells) | 1 | 0.00% | 0 | 72 | block@4,4/o0; block@11,4/o0; block@18,4/o0; block@25,4/o0; block@32,4/o0; block@39,4/o0; block@4,11/o0; block@11,11/o0; block@18,11/o0; block@25,11/o0; block@32,11/o0; block@39,11/o0; block@4,18/o0; block@11,18/o0; block@18,18/o0; block@25,18/o0; block@32,18/o0; block@39,18/o0 |

### Capture assault families (T=.4, H=16, 12×12)

| Family | Games | Capture rate (either base) | Median capture gen | Seconds @8 gen/s | Draws | Timeouts | Red wins | Blue wins | Red−blue outcomes (fixed roles) | Stationary-resident timeout wins | Fastest red capture | Best full attack recipe |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4 LWSS + gun | 3269 | 378/3269 (11.6%) | 146 | 18.25 | 2468 | 2891 | 787 | 14 | 23.6 pp | 15 | 86 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| glider escort + gun | 501 | 83/501 (16.6%) | 166 | 20.75 | 308 | 418 | 186 | 7 | 35.7 pp | 7 | 146 | gosperglidergun@51,4/o7; lwss@4,43/o2; lwss@14,43/o2; lwss@24,43/o2; glider@54,35/o0; block@50,29/o0 |
| growth escort + gun | 552 | 68/552 (12.3%) | 324.5 | 40.56 | 428 | 484 | 123 | 1 | 22.1 pp | 5 | 176 | gosperglidergun@51,4/o7; lwss@4,39/o4; lwss@14,39/o4; rpentomino@54,31/o0; rpentomino@48,23/o0; block@44,37/o0 |
| blocks escort + gun | 828 | 94/828 (11.4%) | 158 | 19.75 | 630 | 734 | 187 | 11 | 21.3 pp | 4 | 142 | gosperglidergun@51,4/o7; lwss@12,43/o2; lwss@26,43/o2; block@50,35/o0; block@44,35/o0; block@38,35/o0; block@32,35/o0 |
| 7 gliders + gun | 828 | 17/828 (2.1%) | 436 | 54.50 | 736 | 811 | 90 | 2 | 10.6 pp | 3 | 302 | gosperglidergun@51,4/o7; glider@28,58/o3; glider@34,58/o3; glider@28,66/o3; glider@34,66/o3; glider@28,74/o3; glider@34,74/o3; glider@28,82/o3 |
| 8 LWSS vs upper gun+eater (interference) | 408 | 94/408 (23.0%) | 152 | 19.00 | 244 | 314 | 130 | 34 | 23.5 pp | 6 | 132 | lwss@4,44/o2; lwss@11,44/o2; lwss@18,44/o2; lwss@25,44/o2; lwss@4,50/o2; lwss@11,50/o2; lwss@18,50/o2; lwss@25,50/o2 |
| 8 LWSS vs lower gun+eater | 408 | 89/408 (21.8%) | 214 | 26.75 | 92 | 319 | 103 | 213 | -27.0 pp | 2 | 132 | lwss@4,44/o2; lwss@11,44/o2; lwss@18,44/o2; lwss@25,44/o2; lwss@4,50/o2; lwss@11,50/o2; lwss@18,50/o2; lwss@25,50/o2 |
| 4 LWSS vs block | 3540 | 426/3540 (12.0%) | 149 | 18.63 | 2690 | 3114 | 850 | 0 | 24.0 pp | 65 | 86 | lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |

### Assault sweep (all families pooled)

| Hitbox | T | H | Games | Capture rate (either base) | Median capture gen | Seconds @8 gen/s | Draws | Timeouts | Red wins | Blue wins | Red−blue outcomes (fixed roles) | Stationary-resident timeout wins |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 0.4 | 0 | 11341 | 1480/11341 (13.0%) | 138 | 17.25 | 8496 | 9861 | 2562 | 283 | 20.1 pp | 94 |
| 10 | 0.4 | 8 | 11341 | 1472/11341 (13.0%) | 145 | 18.13 | 8496 | 9869 | 2562 | 283 | 20.1 pp | 94 |
| 10 | 0.4 | 16 | 11341 | 1462/11341 (12.9%) | 153 | 19.13 | 8496 | 9879 | 2562 | 283 | 20.1 pp | 94 |
| 10 | 0.4 | 32 | 11341 | 1450/11341 (12.8%) | 169 | 21.13 | 8496 | 9891 | 2562 | 283 | 20.1 pp | 94 |
| 10 | 0.5 | 0 | 11341 | 1216/11341 (10.7%) | 151 | 18.88 | 8497 | 10125 | 2560 | 284 | 20.1 pp | 109 |
| 10 | 0.5 | 8 | 11341 | 1213/11341 (10.7%) | 158 | 19.75 | 8497 | 10128 | 2560 | 284 | 20.1 pp | 109 |
| 10 | 0.5 | 16 | 11341 | 1209/11341 (10.7%) | 166 | 20.75 | 8497 | 10132 | 2560 | 284 | 20.1 pp | 109 |
| 10 | 0.5 | 32 | 11341 | 1200/11341 (10.6%) | 182 | 22.75 | 8497 | 10141 | 2561 | 283 | 20.1 pp | 109 |
| 10 | 0.6 | 0 | 11341 | 835/11341 (7.4%) | 369 | 46.13 | 8501 | 10506 | 2555 | 285 | 20.0 pp | 117 |
| 10 | 0.6 | 8 | 11341 | 833/11341 (7.3%) | 374 | 46.75 | 8501 | 10508 | 2555 | 285 | 20.0 pp | 117 |
| 10 | 0.6 | 16 | 11341 | 828/11341 (7.3%) | 380.5 | 47.56 | 8501 | 10513 | 2555 | 285 | 20.0 pp | 117 |
| 10 | 0.6 | 32 | 11341 | 821/11341 (7.2%) | 392 | 49.00 | 8501 | 10520 | 2556 | 284 | 20.0 pp | 117 |
| 10 | 0.75 | 0 | 11341 | 621/11341 (5.5%) | 440 | 55.00 | 8501 | 10720 | 2556 | 284 | 20.0 pp | 157 |
| 10 | 0.75 | 8 | 11341 | 618/11341 (5.4%) | 447 | 55.88 | 8501 | 10723 | 2556 | 284 | 20.0 pp | 157 |
| 10 | 0.75 | 16 | 11341 | 612/11341 (5.4%) | 454 | 56.75 | 8501 | 10729 | 2556 | 284 | 20.0 pp | 157 |
| 10 | 0.75 | 32 | 11341 | 603/11341 (5.3%) | 465 | 58.13 | 8501 | 10738 | 2556 | 284 | 20.0 pp | 157 |
| 12 | 0.4 | 0 | 10334 | 1260/10334 (12.2%) | 143 | 17.88 | 7596 | 9074 | 2456 | 282 | 21.0 pp | 107 |
| 12 | 0.4 | 8 | 10334 | 1254/10334 (12.1%) | 150 | 18.75 | 7596 | 9080 | 2456 | 282 | 21.0 pp | 107 |
| 12 | 0.4 | 16 | 10334 | 1249/10334 (12.1%) | 158 | 19.75 | 7596 | 9085 | 2456 | 282 | 21.0 pp | 107 |
| 12 | 0.4 | 32 | 10334 | 1239/10334 (12.0%) | 174 | 21.75 | 7596 | 9095 | 2456 | 282 | 21.0 pp | 107 |
| 12 | 0.5 | 0 | 10334 | 857/10334 (8.3%) | 342 | 42.75 | 7598 | 9477 | 2448 | 288 | 20.9 pp | 127 |
| 12 | 0.5 | 8 | 10334 | 852/10334 (8.2%) | 347.5 | 43.44 | 7598 | 9482 | 2448 | 288 | 20.9 pp | 127 |
| 12 | 0.5 | 16 | 10334 | 844/10334 (8.2%) | 350 | 43.75 | 7598 | 9490 | 2448 | 288 | 20.9 pp | 127 |
| 12 | 0.5 | 32 | 10334 | 840/10334 (8.1%) | 365 | 45.63 | 7598 | 9494 | 2449 | 287 | 20.9 pp | 127 |
| 12 | 0.6 | 0 | 10334 | 686/10334 (6.6%) | 403 | 50.38 | 7598 | 9648 | 2450 | 286 | 20.9 pp | 148 |
| 12 | 0.6 | 8 | 10334 | 682/10334 (6.6%) | 407 | 50.88 | 7598 | 9652 | 2450 | 286 | 20.9 pp | 148 |
| 12 | 0.6 | 16 | 10334 | 679/10334 (6.6%) | 415 | 51.88 | 7598 | 9655 | 2450 | 286 | 20.9 pp | 148 |
| 12 | 0.6 | 32 | 10334 | 669/10334 (6.5%) | 429 | 53.63 | 7598 | 9665 | 2450 | 286 | 20.9 pp | 148 |
| 12 | 0.75 | 0 | 10334 | 467/10334 (4.5%) | 497 | 62.13 | 7598 | 9867 | 2449 | 287 | 20.9 pp | 175 |
| 12 | 0.75 | 8 | 10334 | 463/10334 (4.5%) | 491 | 61.38 | 7598 | 9871 | 2449 | 287 | 20.9 pp | 175 |
| 12 | 0.75 | 16 | 10334 | 458/10334 (4.4%) | 496.5 | 62.06 | 7598 | 9876 | 2449 | 287 | 20.9 pp | 175 |
| 12 | 0.75 | 32 | 10334 | 447/10334 (4.3%) | 507 | 63.38 | 7598 | 9887 | 2449 | 287 | 20.9 pp | 175 |
| 14 | 0.4 | 0 | 8624 | 700/8624 (8.1%) | 370.5 | 46.31 | 6403 | 7924 | 1988 | 233 | 20.4 pp | 113 |
| 14 | 0.4 | 8 | 8624 | 695/8624 (8.1%) | 376 | 47.00 | 6403 | 7929 | 1988 | 233 | 20.4 pp | 113 |
| 14 | 0.4 | 16 | 8624 | 691/8624 (8.0%) | 383 | 47.88 | 6403 | 7933 | 1988 | 233 | 20.4 pp | 113 |
| 14 | 0.4 | 32 | 8624 | 676/8624 (7.8%) | 385.5 | 48.19 | 6403 | 7948 | 1988 | 233 | 20.4 pp | 113 |
| 14 | 0.5 | 0 | 8624 | 584/8624 (6.8%) | 400.5 | 50.06 | 6403 | 8040 | 1988 | 233 | 20.4 pp | 137 |
| 14 | 0.5 | 8 | 8624 | 581/8624 (6.7%) | 406 | 50.75 | 6403 | 8043 | 1988 | 233 | 20.4 pp | 137 |
| 14 | 0.5 | 16 | 8624 | 575/8624 (6.7%) | 409 | 51.13 | 6403 | 8049 | 1988 | 233 | 20.4 pp | 137 |
| 14 | 0.5 | 32 | 8624 | 569/8624 (6.6%) | 415 | 51.88 | 6403 | 8055 | 1988 | 233 | 20.4 pp | 137 |
| 14 | 0.6 | 0 | 8624 | 438/8624 (5.1%) | 467 | 58.38 | 6403 | 8186 | 1988 | 233 | 20.4 pp | 150 |
| 14 | 0.6 | 8 | 8624 | 435/8624 (5.0%) | 472 | 59.00 | 6403 | 8189 | 1988 | 233 | 20.4 pp | 150 |
| 14 | 0.6 | 16 | 8624 | 427/8624 (5.0%) | 468 | 58.50 | 6403 | 8197 | 1988 | 233 | 20.4 pp | 150 |
| 14 | 0.6 | 32 | 8624 | 419/8624 (4.9%) | 475 | 59.38 | 6403 | 8205 | 1988 | 233 | 20.4 pp | 150 |
| 14 | 0.75 | 0 | 8624 | 289/8624 (3.4%) | 523 | 65.38 | 6403 | 8335 | 1988 | 233 | 20.4 pp | 173 |
| 14 | 0.75 | 8 | 8624 | 288/8624 (3.3%) | 530 | 66.25 | 6403 | 8336 | 1988 | 233 | 20.4 pp | 173 |
| 14 | 0.75 | 16 | 8624 | 286/8624 (3.3%) | 538 | 67.25 | 6403 | 8338 | 1988 | 233 | 20.4 pp | 173 |
| 14 | 0.75 | 32 | 8624 | 279/8624 (3.2%) | 553 | 69.13 | 6403 | 8345 | 1988 | 233 | 20.4 pp | 173 |

### Assault sweep by family

| Family | Hitbox | T | H | Games | Capture rate (either base) | Median capture gen | Seconds @8 gen/s | Draws | Timeouts | Red wins | Blue wins | Red−blue outcomes (fixed roles) | Stationary-resident timeout wins |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4 LWSS + gun | 10 | 0.4 | 0 | 3571 | 437/3571 (12.2%) | 130 | 16.25 | 2766 | 3134 | 792 | 13 | 21.8 pp | 12 |
| 4 LWSS + gun | 10 | 0.4 | 8 | 3571 | 436/3571 (12.2%) | 137 | 17.13 | 2766 | 3135 | 792 | 13 | 21.8 pp | 12 |
| 4 LWSS + gun | 10 | 0.4 | 16 | 3571 | 434/3571 (12.2%) | 145 | 18.13 | 2766 | 3137 | 792 | 13 | 21.8 pp | 12 |
| 4 LWSS + gun | 10 | 0.4 | 32 | 3571 | 431/3571 (12.1%) | 161 | 20.13 | 2766 | 3140 | 792 | 13 | 21.8 pp | 12 |
| 4 LWSS + gun | 10 | 0.5 | 0 | 3571 | 355/3571 (9.9%) | 139 | 17.38 | 2767 | 3216 | 791 | 13 | 21.8 pp | 16 |
| 4 LWSS + gun | 10 | 0.5 | 8 | 3571 | 354/3571 (9.9%) | 146 | 18.25 | 2767 | 3217 | 791 | 13 | 21.8 pp | 16 |
| 4 LWSS + gun | 10 | 0.5 | 16 | 3571 | 353/3571 (9.9%) | 154 | 19.25 | 2767 | 3218 | 791 | 13 | 21.8 pp | 16 |
| 4 LWSS + gun | 10 | 0.5 | 32 | 3571 | 350/3571 (9.8%) | 170 | 21.25 | 2767 | 3221 | 791 | 13 | 21.8 pp | 16 |
| 4 LWSS + gun | 10 | 0.6 | 0 | 3571 | 250/3571 (7.0%) | 352.5 | 44.06 | 2768 | 3321 | 790 | 13 | 21.8 pp | 18 |
| 4 LWSS + gun | 10 | 0.6 | 8 | 3571 | 250/3571 (7.0%) | 359.5 | 44.94 | 2768 | 3321 | 790 | 13 | 21.8 pp | 18 |
| 4 LWSS + gun | 10 | 0.6 | 16 | 3571 | 249/3571 (7.0%) | 362 | 45.25 | 2768 | 3322 | 790 | 13 | 21.8 pp | 18 |
| 4 LWSS + gun | 10 | 0.6 | 32 | 3571 | 246/3571 (6.9%) | 363.5 | 45.44 | 2768 | 3325 | 790 | 13 | 21.8 pp | 18 |
| 4 LWSS + gun | 10 | 0.75 | 0 | 3571 | 180/3571 (5.0%) | 468 | 58.50 | 2768 | 3391 | 791 | 12 | 21.8 pp | 23 |
| 4 LWSS + gun | 10 | 0.75 | 8 | 3571 | 180/3571 (5.0%) | 475 | 59.38 | 2768 | 3391 | 791 | 12 | 21.8 pp | 23 |
| 4 LWSS + gun | 10 | 0.75 | 16 | 3571 | 179/3571 (5.0%) | 479 | 59.88 | 2768 | 3392 | 791 | 12 | 21.8 pp | 23 |
| 4 LWSS + gun | 10 | 0.75 | 32 | 3571 | 177/3571 (5.0%) | 494 | 61.75 | 2768 | 3394 | 791 | 12 | 21.8 pp | 23 |
| 4 LWSS + gun | 12 | 0.4 | 0 | 3269 | 379/3269 (11.6%) | 131 | 16.38 | 2468 | 2890 | 787 | 14 | 23.6 pp | 15 |
| 4 LWSS + gun | 12 | 0.4 | 8 | 3269 | 378/3269 (11.6%) | 138 | 17.25 | 2468 | 2891 | 787 | 14 | 23.6 pp | 15 |
| 4 LWSS + gun | 12 | 0.4 | 16 | 3269 | 378/3269 (11.6%) | 146 | 18.25 | 2468 | 2891 | 787 | 14 | 23.6 pp | 15 |
| 4 LWSS + gun | 12 | 0.4 | 32 | 3269 | 374/3269 (11.4%) | 161 | 20.13 | 2468 | 2895 | 787 | 14 | 23.6 pp | 15 |
| 4 LWSS + gun | 12 | 0.5 | 0 | 3269 | 263/3269 (8.0%) | 317 | 39.63 | 2468 | 3006 | 787 | 14 | 23.6 pp | 17 |
| 4 LWSS + gun | 12 | 0.5 | 8 | 3269 | 261/3269 (8.0%) | 323 | 40.38 | 2468 | 3008 | 787 | 14 | 23.6 pp | 17 |
| 4 LWSS + gun | 12 | 0.5 | 16 | 3269 | 260/3269 (8.0%) | 330.5 | 41.31 | 2468 | 3009 | 787 | 14 | 23.6 pp | 17 |
| 4 LWSS + gun | 12 | 0.5 | 32 | 3269 | 258/3269 (7.9%) | 344 | 43.00 | 2468 | 3011 | 787 | 14 | 23.6 pp | 17 |
| 4 LWSS + gun | 12 | 0.6 | 0 | 3269 | 209/3269 (6.4%) | 398 | 49.75 | 2468 | 3060 | 787 | 14 | 23.6 pp | 22 |
| 4 LWSS + gun | 12 | 0.6 | 8 | 3269 | 208/3269 (6.4%) | 405 | 50.63 | 2468 | 3061 | 787 | 14 | 23.6 pp | 22 |
| 4 LWSS + gun | 12 | 0.6 | 16 | 3269 | 207/3269 (6.3%) | 413 | 51.63 | 2468 | 3062 | 787 | 14 | 23.6 pp | 22 |
| 4 LWSS + gun | 12 | 0.6 | 32 | 3269 | 203/3269 (6.2%) | 416 | 52.00 | 2468 | 3066 | 787 | 14 | 23.6 pp | 22 |
| 4 LWSS + gun | 12 | 0.75 | 0 | 3269 | 132/3269 (4.0%) | 517 | 64.63 | 2468 | 3137 | 787 | 14 | 23.6 pp | 25 |
| 4 LWSS + gun | 12 | 0.75 | 8 | 3269 | 131/3269 (4.0%) | 524 | 65.50 | 2468 | 3138 | 787 | 14 | 23.6 pp | 25 |
| 4 LWSS + gun | 12 | 0.75 | 16 | 3269 | 131/3269 (4.0%) | 532 | 66.50 | 2468 | 3138 | 787 | 14 | 23.6 pp | 25 |
| 4 LWSS + gun | 12 | 0.75 | 32 | 3269 | 129/3269 (3.9%) | 548 | 68.50 | 2468 | 3140 | 787 | 14 | 23.6 pp | 25 |
| 4 LWSS + gun | 14 | 0.4 | 0 | 2782 | 207/2782 (7.4%) | 391 | 48.88 | 2131 | 2575 | 634 | 17 | 22.2 pp | 17 |
| 4 LWSS + gun | 14 | 0.4 | 8 | 2782 | 206/2782 (7.4%) | 397 | 49.63 | 2131 | 2576 | 634 | 17 | 22.2 pp | 17 |
| 4 LWSS + gun | 14 | 0.4 | 16 | 2782 | 206/2782 (7.4%) | 405 | 50.63 | 2131 | 2576 | 634 | 17 | 22.2 pp | 17 |
| 4 LWSS + gun | 14 | 0.4 | 32 | 2782 | 202/2782 (7.3%) | 406 | 50.75 | 2131 | 2580 | 634 | 17 | 22.2 pp | 17 |
| 4 LWSS + gun | 14 | 0.5 | 0 | 2782 | 179/2782 (6.4%) | 420 | 52.50 | 2131 | 2603 | 634 | 17 | 22.2 pp | 20 |
| 4 LWSS + gun | 14 | 0.5 | 8 | 2782 | 178/2782 (6.4%) | 425.5 | 53.19 | 2131 | 2604 | 634 | 17 | 22.2 pp | 20 |
| 4 LWSS + gun | 14 | 0.5 | 16 | 2782 | 176/2782 (6.3%) | 430.5 | 53.81 | 2131 | 2606 | 634 | 17 | 22.2 pp | 20 |
| 4 LWSS + gun | 14 | 0.5 | 32 | 2782 | 176/2782 (6.3%) | 446.5 | 55.81 | 2131 | 2606 | 634 | 17 | 22.2 pp | 20 |
| 4 LWSS + gun | 14 | 0.6 | 0 | 2782 | 120/2782 (4.3%) | 501 | 62.63 | 2131 | 2662 | 634 | 17 | 22.2 pp | 26 |
| 4 LWSS + gun | 14 | 0.6 | 8 | 2782 | 120/2782 (4.3%) | 508 | 63.50 | 2131 | 2662 | 634 | 17 | 22.2 pp | 26 |
| 4 LWSS + gun | 14 | 0.6 | 16 | 2782 | 119/2782 (4.3%) | 516 | 64.50 | 2131 | 2663 | 634 | 17 | 22.2 pp | 26 |
| 4 LWSS + gun | 14 | 0.6 | 32 | 2782 | 115/2782 (4.1%) | 526 | 65.75 | 2131 | 2667 | 634 | 17 | 22.2 pp | 26 |
| 4 LWSS + gun | 14 | 0.75 | 0 | 2782 | 81/2782 (2.9%) | 523 | 65.38 | 2131 | 2701 | 634 | 17 | 22.2 pp | 31 |
| 4 LWSS + gun | 14 | 0.75 | 8 | 2782 | 81/2782 (2.9%) | 530 | 66.25 | 2131 | 2701 | 634 | 17 | 22.2 pp | 31 |
| 4 LWSS + gun | 14 | 0.75 | 16 | 2782 | 80/2782 (2.9%) | 538 | 67.25 | 2131 | 2702 | 634 | 17 | 22.2 pp | 31 |
| 4 LWSS + gun | 14 | 0.75 | 32 | 2782 | 79/2782 (2.8%) | 554 | 69.25 | 2131 | 2703 | 634 | 17 | 22.2 pp | 31 |
| glider escort + gun | 10 | 0.4 | 0 | 684 | 140/684 (20.5%) | 138 | 17.25 | 410 | 544 | 267 | 7 | 38.0 pp | 6 |
| glider escort + gun | 10 | 0.4 | 8 | 684 | 139/684 (20.3%) | 145 | 18.13 | 410 | 545 | 267 | 7 | 38.0 pp | 6 |
| glider escort + gun | 10 | 0.4 | 16 | 684 | 139/684 (20.3%) | 153 | 19.13 | 410 | 545 | 267 | 7 | 38.0 pp | 6 |
| glider escort + gun | 10 | 0.4 | 32 | 684 | 137/684 (20.0%) | 169 | 21.13 | 410 | 547 | 267 | 7 | 38.0 pp | 6 |
| glider escort + gun | 10 | 0.5 | 0 | 684 | 111/684 (16.2%) | 151 | 18.88 | 410 | 573 | 267 | 7 | 38.0 pp | 7 |
| glider escort + gun | 10 | 0.5 | 8 | 684 | 111/684 (16.2%) | 158 | 19.75 | 410 | 573 | 267 | 7 | 38.0 pp | 7 |
| glider escort + gun | 10 | 0.5 | 16 | 684 | 111/684 (16.2%) | 166 | 20.75 | 410 | 573 | 267 | 7 | 38.0 pp | 7 |
| glider escort + gun | 10 | 0.5 | 32 | 684 | 109/684 (15.9%) | 182 | 22.75 | 410 | 575 | 267 | 7 | 38.0 pp | 7 |
| glider escort + gun | 10 | 0.6 | 0 | 684 | 46/684 (6.7%) | 429.5 | 53.69 | 410 | 638 | 267 | 7 | 38.0 pp | 9 |
| glider escort + gun | 10 | 0.6 | 8 | 684 | 45/684 (6.6%) | 436 | 54.50 | 410 | 639 | 267 | 7 | 38.0 pp | 9 |
| glider escort + gun | 10 | 0.6 | 16 | 684 | 45/684 (6.6%) | 444 | 55.50 | 410 | 639 | 267 | 7 | 38.0 pp | 9 |
| glider escort + gun | 10 | 0.6 | 32 | 684 | 44/684 (6.4%) | 451 | 56.38 | 410 | 640 | 267 | 7 | 38.0 pp | 9 |
| glider escort + gun | 10 | 0.75 | 0 | 684 | 34/684 (5.0%) | 392 | 49.00 | 410 | 650 | 267 | 7 | 38.0 pp | 11 |
| glider escort + gun | 10 | 0.75 | 8 | 684 | 34/684 (5.0%) | 399 | 49.88 | 410 | 650 | 267 | 7 | 38.0 pp | 11 |
| glider escort + gun | 10 | 0.75 | 16 | 684 | 33/684 (4.8%) | 406 | 50.75 | 410 | 651 | 267 | 7 | 38.0 pp | 11 |
| glider escort + gun | 10 | 0.75 | 32 | 684 | 32/684 (4.7%) | 422 | 52.75 | 410 | 652 | 267 | 7 | 38.0 pp | 11 |
| glider escort + gun | 12 | 0.4 | 0 | 501 | 83/501 (16.6%) | 151 | 18.88 | 308 | 418 | 186 | 7 | 35.7 pp | 7 |
| glider escort + gun | 12 | 0.4 | 8 | 501 | 83/501 (16.6%) | 158 | 19.75 | 308 | 418 | 186 | 7 | 35.7 pp | 7 |
| glider escort + gun | 12 | 0.4 | 16 | 501 | 83/501 (16.6%) | 166 | 20.75 | 308 | 418 | 186 | 7 | 35.7 pp | 7 |
| glider escort + gun | 12 | 0.4 | 32 | 501 | 81/501 (16.2%) | 182 | 22.75 | 308 | 420 | 186 | 7 | 35.7 pp | 7 |
| glider escort + gun | 12 | 0.5 | 0 | 501 | 35/501 (7.0%) | 453 | 56.63 | 308 | 466 | 186 | 7 | 35.7 pp | 11 |
| glider escort + gun | 12 | 0.5 | 8 | 501 | 35/501 (7.0%) | 460 | 57.50 | 308 | 466 | 186 | 7 | 35.7 pp | 11 |
| glider escort + gun | 12 | 0.5 | 16 | 501 | 31/501 (6.2%) | 445 | 55.63 | 308 | 470 | 186 | 7 | 35.7 pp | 11 |
| glider escort + gun | 12 | 0.5 | 32 | 501 | 31/501 (6.2%) | 461 | 57.63 | 308 | 470 | 186 | 7 | 35.7 pp | 11 |
| glider escort + gun | 12 | 0.6 | 0 | 501 | 29/501 (5.8%) | 445 | 55.63 | 308 | 472 | 186 | 7 | 35.7 pp | 11 |
| glider escort + gun | 12 | 0.6 | 8 | 501 | 29/501 (5.8%) | 452 | 56.50 | 308 | 472 | 186 | 7 | 35.7 pp | 11 |
| glider escort + gun | 12 | 0.6 | 16 | 501 | 29/501 (5.8%) | 460 | 57.50 | 308 | 472 | 186 | 7 | 35.7 pp | 11 |
| glider escort + gun | 12 | 0.6 | 32 | 501 | 29/501 (5.8%) | 476 | 59.50 | 308 | 472 | 186 | 7 | 35.7 pp | 11 |
| glider escort + gun | 12 | 0.75 | 0 | 501 | 17/501 (3.4%) | 447 | 55.88 | 308 | 484 | 186 | 7 | 35.7 pp | 13 |
| glider escort + gun | 12 | 0.75 | 8 | 501 | 17/501 (3.4%) | 454 | 56.75 | 308 | 484 | 186 | 7 | 35.7 pp | 13 |
| glider escort + gun | 12 | 0.75 | 16 | 501 | 17/501 (3.4%) | 462 | 57.75 | 308 | 484 | 186 | 7 | 35.7 pp | 13 |
| glider escort + gun | 12 | 0.75 | 32 | 501 | 15/501 (3.0%) | 444 | 55.50 | 308 | 486 | 186 | 7 | 35.7 pp | 13 |
| glider escort + gun | 14 | 0.4 | 0 | 458 | 38/458 (8.3%) | 441.5 | 55.19 | 264 | 420 | 189 | 5 | 40.2 pp | 8 |
| glider escort + gun | 14 | 0.4 | 8 | 458 | 38/458 (8.3%) | 448.5 | 56.06 | 264 | 420 | 189 | 5 | 40.2 pp | 8 |
| glider escort + gun | 14 | 0.4 | 16 | 458 | 38/458 (8.3%) | 456.5 | 57.06 | 264 | 420 | 189 | 5 | 40.2 pp | 8 |
| glider escort + gun | 14 | 0.4 | 32 | 458 | 37/458 (8.1%) | 471 | 58.88 | 264 | 421 | 189 | 5 | 40.2 pp | 8 |
| glider escort + gun | 14 | 0.5 | 0 | 458 | 33/458 (7.2%) | 460 | 57.50 | 264 | 425 | 189 | 5 | 40.2 pp | 9 |
| glider escort + gun | 14 | 0.5 | 8 | 458 | 33/458 (7.2%) | 467 | 58.38 | 264 | 425 | 189 | 5 | 40.2 pp | 9 |
| glider escort + gun | 14 | 0.5 | 16 | 458 | 32/458 (7.0%) | 472.5 | 59.06 | 264 | 426 | 189 | 5 | 40.2 pp | 9 |
| glider escort + gun | 14 | 0.5 | 32 | 458 | 32/458 (7.0%) | 488.5 | 61.06 | 264 | 426 | 189 | 5 | 40.2 pp | 9 |
| glider escort + gun | 14 | 0.6 | 0 | 458 | 26/458 (5.7%) | 460 | 57.50 | 264 | 432 | 189 | 5 | 40.2 pp | 11 |
| glider escort + gun | 14 | 0.6 | 8 | 458 | 24/458 (5.2%) | 450.5 | 56.31 | 264 | 434 | 189 | 5 | 40.2 pp | 11 |
| glider escort + gun | 14 | 0.6 | 16 | 458 | 22/458 (4.8%) | 430.5 | 53.81 | 264 | 436 | 189 | 5 | 40.2 pp | 11 |
| glider escort + gun | 14 | 0.6 | 32 | 458 | 22/458 (4.8%) | 446.5 | 55.81 | 264 | 436 | 189 | 5 | 40.2 pp | 11 |
| glider escort + gun | 14 | 0.75 | 0 | 458 | 11/458 (2.4%) | 554 | 69.25 | 264 | 447 | 189 | 5 | 40.2 pp | 15 |
| glider escort + gun | 14 | 0.75 | 8 | 458 | 11/458 (2.4%) | 561 | 70.13 | 264 | 447 | 189 | 5 | 40.2 pp | 15 |
| glider escort + gun | 14 | 0.75 | 16 | 458 | 11/458 (2.4%) | 569 | 71.13 | 264 | 447 | 189 | 5 | 40.2 pp | 15 |
| glider escort + gun | 14 | 0.75 | 32 | 458 | 9/458 (2.0%) | 485 | 60.63 | 264 | 449 | 189 | 5 | 40.2 pp | 15 |
| growth escort + gun | 10 | 0.4 | 0 | 648 | 92/648 (14.2%) | 304 | 38.00 | 500 | 556 | 148 | 0 | 22.8 pp | 4 |
| growth escort + gun | 10 | 0.4 | 8 | 648 | 91/648 (14.0%) | 310 | 38.75 | 500 | 557 | 148 | 0 | 22.8 pp | 4 |
| growth escort + gun | 10 | 0.4 | 16 | 648 | 90/648 (13.9%) | 316.5 | 39.56 | 500 | 558 | 148 | 0 | 22.8 pp | 4 |
| growth escort + gun | 10 | 0.4 | 32 | 648 | 90/648 (13.9%) | 332.5 | 41.56 | 500 | 558 | 148 | 0 | 22.8 pp | 4 |
| growth escort + gun | 10 | 0.5 | 0 | 648 | 87/648 (13.4%) | 318 | 39.75 | 500 | 561 | 148 | 0 | 22.8 pp | 5 |
| growth escort + gun | 10 | 0.5 | 8 | 648 | 86/648 (13.3%) | 323 | 40.38 | 500 | 562 | 148 | 0 | 22.8 pp | 5 |
| growth escort + gun | 10 | 0.5 | 16 | 648 | 86/648 (13.3%) | 331 | 41.38 | 500 | 562 | 148 | 0 | 22.8 pp | 5 |
| growth escort + gun | 10 | 0.5 | 32 | 648 | 86/648 (13.3%) | 347 | 43.38 | 500 | 562 | 148 | 0 | 22.8 pp | 5 |
| growth escort + gun | 10 | 0.6 | 0 | 648 | 81/648 (12.5%) | 332 | 41.50 | 500 | 567 | 148 | 0 | 22.8 pp | 7 |
| growth escort + gun | 10 | 0.6 | 8 | 648 | 81/648 (12.5%) | 339 | 42.38 | 500 | 567 | 148 | 0 | 22.8 pp | 7 |
| growth escort + gun | 10 | 0.6 | 16 | 648 | 80/648 (12.3%) | 346 | 43.25 | 500 | 568 | 148 | 0 | 22.8 pp | 7 |
| growth escort + gun | 10 | 0.6 | 32 | 648 | 80/648 (12.3%) | 362 | 45.25 | 500 | 568 | 148 | 0 | 22.8 pp | 7 |
| growth escort + gun | 10 | 0.75 | 0 | 648 | 63/648 (9.7%) | 359 | 44.88 | 500 | 585 | 148 | 0 | 22.8 pp | 19 |
| growth escort + gun | 10 | 0.75 | 8 | 648 | 62/648 (9.6%) | 356.5 | 44.56 | 500 | 586 | 148 | 0 | 22.8 pp | 19 |
| growth escort + gun | 10 | 0.75 | 16 | 648 | 62/648 (9.6%) | 364.5 | 45.56 | 500 | 586 | 148 | 0 | 22.8 pp | 19 |
| growth escort + gun | 10 | 0.75 | 32 | 648 | 60/648 (9.3%) | 368.5 | 46.06 | 500 | 588 | 148 | 0 | 22.8 pp | 19 |
| growth escort + gun | 12 | 0.4 | 0 | 552 | 70/552 (12.7%) | 312.5 | 39.06 | 428 | 482 | 123 | 1 | 22.1 pp | 5 |
| growth escort + gun | 12 | 0.4 | 8 | 552 | 69/552 (12.5%) | 317 | 39.63 | 428 | 483 | 123 | 1 | 22.1 pp | 5 |
| growth escort + gun | 12 | 0.4 | 16 | 552 | 68/552 (12.3%) | 324.5 | 40.56 | 428 | 484 | 123 | 1 | 22.1 pp | 5 |
| growth escort + gun | 12 | 0.4 | 32 | 552 | 68/552 (12.3%) | 340.5 | 42.56 | 428 | 484 | 123 | 1 | 22.1 pp | 5 |
| growth escort + gun | 12 | 0.5 | 0 | 552 | 66/552 (12.0%) | 318.5 | 39.81 | 428 | 486 | 123 | 1 | 22.1 pp | 6 |
| growth escort + gun | 12 | 0.5 | 8 | 552 | 66/552 (12.0%) | 325.5 | 40.69 | 428 | 486 | 123 | 1 | 22.1 pp | 6 |
| growth escort + gun | 12 | 0.5 | 16 | 552 | 66/552 (12.0%) | 333.5 | 41.69 | 428 | 486 | 123 | 1 | 22.1 pp | 6 |
| growth escort + gun | 12 | 0.5 | 32 | 552 | 66/552 (12.0%) | 349.5 | 43.69 | 428 | 486 | 123 | 1 | 22.1 pp | 6 |
| growth escort + gun | 12 | 0.6 | 0 | 552 | 59/552 (10.7%) | 347 | 43.38 | 428 | 493 | 123 | 1 | 22.1 pp | 8 |
| growth escort + gun | 12 | 0.6 | 8 | 552 | 59/552 (10.7%) | 354 | 44.25 | 428 | 493 | 123 | 1 | 22.1 pp | 8 |
| growth escort + gun | 12 | 0.6 | 16 | 552 | 59/552 (10.7%) | 362 | 45.25 | 428 | 493 | 123 | 1 | 22.1 pp | 8 |
| growth escort + gun | 12 | 0.6 | 32 | 552 | 59/552 (10.7%) | 378 | 47.25 | 428 | 493 | 123 | 1 | 22.1 pp | 8 |
| growth escort + gun | 12 | 0.75 | 0 | 552 | 40/552 (7.2%) | 373.5 | 46.69 | 428 | 512 | 123 | 1 | 22.1 pp | 14 |
| growth escort + gun | 12 | 0.75 | 8 | 552 | 40/552 (7.2%) | 380.5 | 47.56 | 428 | 512 | 123 | 1 | 22.1 pp | 14 |
| growth escort + gun | 12 | 0.75 | 16 | 552 | 40/552 (7.2%) | 388.5 | 48.56 | 428 | 512 | 123 | 1 | 22.1 pp | 14 |
| growth escort + gun | 12 | 0.75 | 32 | 552 | 39/552 (7.1%) | 387 | 48.38 | 428 | 513 | 123 | 1 | 22.1 pp | 14 |
| growth escort + gun | 14 | 0.4 | 0 | 168 | 20/168 (11.9%) | 236 | 29.50 | 135 | 148 | 33 | 0 | 19.6 pp | 0 |
| growth escort + gun | 14 | 0.4 | 8 | 168 | 20/168 (11.9%) | 243 | 30.38 | 135 | 148 | 33 | 0 | 19.6 pp | 0 |
| growth escort + gun | 14 | 0.4 | 16 | 168 | 20/168 (11.9%) | 251 | 31.38 | 135 | 148 | 33 | 0 | 19.6 pp | 0 |
| growth escort + gun | 14 | 0.4 | 32 | 168 | 20/168 (11.9%) | 267 | 33.38 | 135 | 148 | 33 | 0 | 19.6 pp | 0 |
| growth escort + gun | 14 | 0.5 | 0 | 168 | 20/168 (11.9%) | 289 | 36.13 | 135 | 148 | 33 | 0 | 19.6 pp | 0 |
| growth escort + gun | 14 | 0.5 | 8 | 168 | 20/168 (11.9%) | 296 | 37.00 | 135 | 148 | 33 | 0 | 19.6 pp | 0 |
| growth escort + gun | 14 | 0.5 | 16 | 168 | 20/168 (11.9%) | 304 | 38.00 | 135 | 148 | 33 | 0 | 19.6 pp | 0 |
| growth escort + gun | 14 | 0.5 | 32 | 168 | 20/168 (11.9%) | 320 | 40.00 | 135 | 148 | 33 | 0 | 19.6 pp | 0 |
| growth escort + gun | 14 | 0.6 | 0 | 168 | 20/168 (11.9%) | 316 | 39.50 | 135 | 148 | 33 | 0 | 19.6 pp | 0 |
| growth escort + gun | 14 | 0.6 | 8 | 168 | 20/168 (11.9%) | 323 | 40.38 | 135 | 148 | 33 | 0 | 19.6 pp | 0 |
| growth escort + gun | 14 | 0.6 | 16 | 168 | 20/168 (11.9%) | 331 | 41.38 | 135 | 148 | 33 | 0 | 19.6 pp | 0 |
| growth escort + gun | 14 | 0.6 | 32 | 168 | 20/168 (11.9%) | 347 | 43.38 | 135 | 148 | 33 | 0 | 19.6 pp | 0 |
| growth escort + gun | 14 | 0.75 | 0 | 168 | 8/168 (4.8%) | 333 | 41.63 | 135 | 160 | 33 | 0 | 19.6 pp | 3 |
| growth escort + gun | 14 | 0.75 | 8 | 168 | 8/168 (4.8%) | 340 | 42.50 | 135 | 160 | 33 | 0 | 19.6 pp | 3 |
| growth escort + gun | 14 | 0.75 | 16 | 168 | 8/168 (4.8%) | 348 | 43.50 | 135 | 160 | 33 | 0 | 19.6 pp | 3 |
| growth escort + gun | 14 | 0.75 | 32 | 168 | 8/168 (4.8%) | 364 | 45.50 | 135 | 160 | 33 | 0 | 19.6 pp | 3 |
| blocks escort + gun | 10 | 0.4 | 0 | 912 | 112/912 (12.3%) | 138 | 17.25 | 715 | 800 | 182 | 15 | 18.3 pp | 0 |
| blocks escort + gun | 10 | 0.4 | 8 | 912 | 112/912 (12.3%) | 145 | 18.13 | 715 | 800 | 182 | 15 | 18.3 pp | 0 |
| blocks escort + gun | 10 | 0.4 | 16 | 912 | 112/912 (12.3%) | 153 | 19.13 | 715 | 800 | 182 | 15 | 18.3 pp | 0 |
| blocks escort + gun | 10 | 0.4 | 32 | 912 | 111/912 (12.2%) | 169 | 21.13 | 715 | 801 | 182 | 15 | 18.3 pp | 0 |
| blocks escort + gun | 10 | 0.5 | 0 | 912 | 87/912 (9.5%) | 143 | 17.88 | 715 | 825 | 182 | 15 | 18.3 pp | 1 |
| blocks escort + gun | 10 | 0.5 | 8 | 912 | 87/912 (9.5%) | 150 | 18.75 | 715 | 825 | 182 | 15 | 18.3 pp | 1 |
| blocks escort + gun | 10 | 0.5 | 16 | 912 | 87/912 (9.5%) | 158 | 19.75 | 715 | 825 | 182 | 15 | 18.3 pp | 1 |
| blocks escort + gun | 10 | 0.5 | 32 | 912 | 86/912 (9.4%) | 174 | 21.75 | 715 | 826 | 182 | 15 | 18.3 pp | 1 |
| blocks escort + gun | 10 | 0.6 | 0 | 912 | 26/912 (2.9%) | 431 | 53.88 | 715 | 886 | 182 | 15 | 18.3 pp | 1 |
| blocks escort + gun | 10 | 0.6 | 8 | 912 | 26/912 (2.9%) | 438 | 54.75 | 715 | 886 | 182 | 15 | 18.3 pp | 1 |
| blocks escort + gun | 10 | 0.6 | 16 | 912 | 26/912 (2.9%) | 446 | 55.75 | 715 | 886 | 182 | 15 | 18.3 pp | 1 |
| blocks escort + gun | 10 | 0.6 | 32 | 912 | 26/912 (2.9%) | 462 | 57.75 | 715 | 886 | 182 | 15 | 18.3 pp | 1 |
| blocks escort + gun | 10 | 0.75 | 0 | 912 | 24/912 (2.6%) | 440 | 55.00 | 715 | 888 | 182 | 15 | 18.3 pp | 1 |
| blocks escort + gun | 10 | 0.75 | 8 | 912 | 24/912 (2.6%) | 447 | 55.88 | 715 | 888 | 182 | 15 | 18.3 pp | 1 |
| blocks escort + gun | 10 | 0.75 | 16 | 912 | 24/912 (2.6%) | 455 | 56.88 | 715 | 888 | 182 | 15 | 18.3 pp | 1 |
| blocks escort + gun | 10 | 0.75 | 32 | 912 | 23/912 (2.5%) | 471 | 58.88 | 715 | 889 | 182 | 15 | 18.3 pp | 1 |
| blocks escort + gun | 12 | 0.4 | 0 | 828 | 94/828 (11.4%) | 143 | 17.88 | 630 | 734 | 187 | 11 | 21.3 pp | 4 |
| blocks escort + gun | 12 | 0.4 | 8 | 828 | 94/828 (11.4%) | 150 | 18.75 | 630 | 734 | 187 | 11 | 21.3 pp | 4 |
| blocks escort + gun | 12 | 0.4 | 16 | 828 | 94/828 (11.4%) | 158 | 19.75 | 630 | 734 | 187 | 11 | 21.3 pp | 4 |
| blocks escort + gun | 12 | 0.4 | 32 | 828 | 93/828 (11.2%) | 174 | 21.75 | 630 | 735 | 187 | 11 | 21.3 pp | 4 |
| blocks escort + gun | 12 | 0.5 | 0 | 828 | 24/828 (2.9%) | 427 | 53.38 | 630 | 804 | 187 | 11 | 21.3 pp | 5 |
| blocks escort + gun | 12 | 0.5 | 8 | 828 | 24/828 (2.9%) | 434 | 54.25 | 630 | 804 | 187 | 11 | 21.3 pp | 5 |
| blocks escort + gun | 12 | 0.5 | 16 | 828 | 24/828 (2.9%) | 442 | 55.25 | 630 | 804 | 187 | 11 | 21.3 pp | 5 |
| blocks escort + gun | 12 | 0.5 | 32 | 828 | 23/828 (2.8%) | 458 | 57.25 | 630 | 805 | 187 | 11 | 21.3 pp | 5 |
| blocks escort + gun | 12 | 0.6 | 0 | 828 | 21/828 (2.5%) | 434 | 54.25 | 630 | 807 | 187 | 11 | 21.3 pp | 5 |
| blocks escort + gun | 12 | 0.6 | 8 | 828 | 21/828 (2.5%) | 441 | 55.13 | 630 | 807 | 187 | 11 | 21.3 pp | 5 |
| blocks escort + gun | 12 | 0.6 | 16 | 828 | 21/828 (2.5%) | 449 | 56.13 | 630 | 807 | 187 | 11 | 21.3 pp | 5 |
| blocks escort + gun | 12 | 0.6 | 32 | 828 | 21/828 (2.5%) | 465 | 58.13 | 630 | 807 | 187 | 11 | 21.3 pp | 5 |
| blocks escort + gun | 12 | 0.75 | 0 | 828 | 20/828 (2.4%) | 442 | 55.25 | 630 | 808 | 187 | 11 | 21.3 pp | 5 |
| blocks escort + gun | 12 | 0.75 | 8 | 828 | 20/828 (2.4%) | 449 | 56.13 | 630 | 808 | 187 | 11 | 21.3 pp | 5 |
| blocks escort + gun | 12 | 0.75 | 16 | 828 | 20/828 (2.4%) | 457 | 57.13 | 630 | 808 | 187 | 11 | 21.3 pp | 5 |
| blocks escort + gun | 12 | 0.75 | 32 | 828 | 19/828 (2.3%) | 473 | 59.13 | 630 | 809 | 187 | 11 | 21.3 pp | 5 |
| blocks escort + gun | 14 | 0.4 | 0 | 744 | 28/744 (3.8%) | 393 | 49.13 | 560 | 716 | 172 | 12 | 21.5 pp | 9 |
| blocks escort + gun | 14 | 0.4 | 8 | 744 | 28/744 (3.8%) | 400 | 50.00 | 560 | 716 | 172 | 12 | 21.5 pp | 9 |
| blocks escort + gun | 14 | 0.4 | 16 | 744 | 28/744 (3.8%) | 408 | 51.00 | 560 | 716 | 172 | 12 | 21.5 pp | 9 |
| blocks escort + gun | 14 | 0.4 | 32 | 744 | 25/744 (3.4%) | 424 | 53.00 | 560 | 719 | 172 | 12 | 21.5 pp | 9 |
| blocks escort + gun | 14 | 0.5 | 0 | 744 | 24/744 (3.2%) | 425 | 53.13 | 560 | 720 | 172 | 12 | 21.5 pp | 10 |
| blocks escort + gun | 14 | 0.5 | 8 | 744 | 24/744 (3.2%) | 432 | 54.00 | 560 | 720 | 172 | 12 | 21.5 pp | 10 |
| blocks escort + gun | 14 | 0.5 | 16 | 744 | 24/744 (3.2%) | 440 | 55.00 | 560 | 720 | 172 | 12 | 21.5 pp | 10 |
| blocks escort + gun | 14 | 0.5 | 32 | 744 | 23/744 (3.1%) | 456 | 57.00 | 560 | 721 | 172 | 12 | 21.5 pp | 10 |
| blocks escort + gun | 14 | 0.6 | 0 | 744 | 21/744 (2.8%) | 436 | 54.50 | 560 | 723 | 172 | 12 | 21.5 pp | 10 |
| blocks escort + gun | 14 | 0.6 | 8 | 744 | 21/744 (2.8%) | 443 | 55.38 | 560 | 723 | 172 | 12 | 21.5 pp | 10 |
| blocks escort + gun | 14 | 0.6 | 16 | 744 | 20/744 (2.7%) | 451 | 56.38 | 560 | 724 | 172 | 12 | 21.5 pp | 10 |
| blocks escort + gun | 14 | 0.6 | 32 | 744 | 20/744 (2.7%) | 467 | 58.38 | 560 | 724 | 172 | 12 | 21.5 pp | 10 |
| blocks escort + gun | 14 | 0.75 | 0 | 744 | 20/744 (2.7%) | 452 | 56.50 | 560 | 724 | 172 | 12 | 21.5 pp | 10 |
| blocks escort + gun | 14 | 0.75 | 8 | 744 | 20/744 (2.7%) | 459 | 57.38 | 560 | 724 | 172 | 12 | 21.5 pp | 10 |
| blocks escort + gun | 14 | 0.75 | 16 | 744 | 20/744 (2.7%) | 467 | 58.38 | 560 | 724 | 172 | 12 | 21.5 pp | 10 |
| blocks escort + gun | 14 | 0.75 | 32 | 744 | 19/744 (2.6%) | 483 | 60.38 | 560 | 725 | 172 | 12 | 21.5 pp | 10 |
| 7 gliders + gun | 10 | 0.4 | 0 | 852 | 18/852 (2.1%) | 411.5 | 51.44 | 763 | 834 | 87 | 2 | 10.0 pp | 1 |
| 7 gliders + gun | 10 | 0.4 | 8 | 852 | 18/852 (2.1%) | 418.5 | 52.31 | 763 | 834 | 87 | 2 | 10.0 pp | 1 |
| 7 gliders + gun | 10 | 0.4 | 16 | 852 | 18/852 (2.1%) | 426.5 | 53.31 | 763 | 834 | 87 | 2 | 10.0 pp | 1 |
| 7 gliders + gun | 10 | 0.4 | 32 | 852 | 18/852 (2.1%) | 442.5 | 55.31 | 763 | 834 | 87 | 2 | 10.0 pp | 1 |
| 7 gliders + gun | 10 | 0.5 | 0 | 852 | 14/852 (1.6%) | 419 | 52.38 | 763 | 838 | 87 | 2 | 10.0 pp | 2 |
| 7 gliders + gun | 10 | 0.5 | 8 | 852 | 14/852 (1.6%) | 426 | 53.25 | 763 | 838 | 87 | 2 | 10.0 pp | 2 |
| 7 gliders + gun | 10 | 0.5 | 16 | 852 | 14/852 (1.6%) | 434 | 54.25 | 763 | 838 | 87 | 2 | 10.0 pp | 2 |
| 7 gliders + gun | 10 | 0.5 | 32 | 852 | 14/852 (1.6%) | 450 | 56.25 | 763 | 838 | 87 | 2 | 10.0 pp | 2 |
| 7 gliders + gun | 10 | 0.6 | 0 | 852 | 12/852 (1.4%) | 497.5 | 62.19 | 763 | 840 | 87 | 2 | 10.0 pp | 2 |
| 7 gliders + gun | 10 | 0.6 | 8 | 852 | 12/852 (1.4%) | 504.5 | 63.06 | 763 | 840 | 87 | 2 | 10.0 pp | 2 |
| 7 gliders + gun | 10 | 0.6 | 16 | 852 | 12/852 (1.4%) | 512.5 | 64.06 | 763 | 840 | 87 | 2 | 10.0 pp | 2 |
| 7 gliders + gun | 10 | 0.6 | 32 | 852 | 12/852 (1.4%) | 528.5 | 66.06 | 763 | 840 | 87 | 2 | 10.0 pp | 2 |
| 7 gliders + gun | 10 | 0.75 | 0 | 852 | 8/852 (0.9%) | 522.5 | 65.31 | 763 | 844 | 87 | 2 | 10.0 pp | 3 |
| 7 gliders + gun | 10 | 0.75 | 8 | 852 | 8/852 (0.9%) | 529.5 | 66.19 | 763 | 844 | 87 | 2 | 10.0 pp | 3 |
| 7 gliders + gun | 10 | 0.75 | 16 | 852 | 8/852 (0.9%) | 537.5 | 67.19 | 763 | 844 | 87 | 2 | 10.0 pp | 3 |
| 7 gliders + gun | 10 | 0.75 | 32 | 852 | 8/852 (0.9%) | 553.5 | 69.19 | 763 | 844 | 87 | 2 | 10.0 pp | 3 |
| 7 gliders + gun | 12 | 0.4 | 0 | 828 | 17/828 (2.1%) | 421 | 52.63 | 736 | 811 | 90 | 2 | 10.6 pp | 3 |
| 7 gliders + gun | 12 | 0.4 | 8 | 828 | 17/828 (2.1%) | 428 | 53.50 | 736 | 811 | 90 | 2 | 10.6 pp | 3 |
| 7 gliders + gun | 12 | 0.4 | 16 | 828 | 17/828 (2.1%) | 436 | 54.50 | 736 | 811 | 90 | 2 | 10.6 pp | 3 |
| 7 gliders + gun | 12 | 0.4 | 32 | 828 | 17/828 (2.1%) | 452 | 56.50 | 736 | 811 | 90 | 2 | 10.6 pp | 3 |
| 7 gliders + gun | 12 | 0.5 | 0 | 828 | 12/828 (1.4%) | 451 | 56.38 | 736 | 816 | 90 | 2 | 10.6 pp | 4 |
| 7 gliders + gun | 12 | 0.5 | 8 | 828 | 12/828 (1.4%) | 458 | 57.25 | 736 | 816 | 90 | 2 | 10.6 pp | 4 |
| 7 gliders + gun | 12 | 0.5 | 16 | 828 | 12/828 (1.4%) | 466 | 58.25 | 736 | 816 | 90 | 2 | 10.6 pp | 4 |
| 7 gliders + gun | 12 | 0.5 | 32 | 828 | 12/828 (1.4%) | 482 | 60.25 | 736 | 816 | 90 | 2 | 10.6 pp | 4 |
| 7 gliders + gun | 12 | 0.6 | 0 | 828 | 11/828 (1.3%) | 504 | 63.00 | 736 | 817 | 90 | 2 | 10.6 pp | 4 |
| 7 gliders + gun | 12 | 0.6 | 8 | 828 | 11/828 (1.3%) | 511 | 63.88 | 736 | 817 | 90 | 2 | 10.6 pp | 4 |
| 7 gliders + gun | 12 | 0.6 | 16 | 828 | 11/828 (1.3%) | 519 | 64.88 | 736 | 817 | 90 | 2 | 10.6 pp | 4 |
| 7 gliders + gun | 12 | 0.6 | 32 | 828 | 11/828 (1.3%) | 535 | 66.88 | 736 | 817 | 90 | 2 | 10.6 pp | 4 |
| 7 gliders + gun | 12 | 0.75 | 0 | 828 | 8/828 (1.0%) | 525.5 | 65.69 | 736 | 820 | 90 | 2 | 10.6 pp | 5 |
| 7 gliders + gun | 12 | 0.75 | 8 | 828 | 8/828 (1.0%) | 532.5 | 66.56 | 736 | 820 | 90 | 2 | 10.6 pp | 5 |
| 7 gliders + gun | 12 | 0.75 | 16 | 828 | 8/828 (1.0%) | 540.5 | 67.56 | 736 | 820 | 90 | 2 | 10.6 pp | 5 |
| 7 gliders + gun | 12 | 0.75 | 32 | 828 | 7/828 (0.8%) | 541 | 67.63 | 736 | 821 | 90 | 2 | 10.6 pp | 5 |
| 7 gliders + gun | 14 | 0.4 | 0 | 804 | 15/804 (1.9%) | 470 | 58.75 | 701 | 789 | 101 | 2 | 12.3 pp | 4 |
| 7 gliders + gun | 14 | 0.4 | 8 | 804 | 15/804 (1.9%) | 477 | 59.63 | 701 | 789 | 101 | 2 | 12.3 pp | 4 |
| 7 gliders + gun | 14 | 0.4 | 16 | 804 | 15/804 (1.9%) | 485 | 60.63 | 701 | 789 | 101 | 2 | 12.3 pp | 4 |
| 7 gliders + gun | 14 | 0.4 | 32 | 804 | 15/804 (1.9%) | 501 | 62.63 | 701 | 789 | 101 | 2 | 12.3 pp | 4 |
| 7 gliders + gun | 14 | 0.5 | 0 | 804 | 11/804 (1.4%) | 496 | 62.00 | 701 | 793 | 101 | 2 | 12.3 pp | 6 |
| 7 gliders + gun | 14 | 0.5 | 8 | 804 | 11/804 (1.4%) | 503 | 62.88 | 701 | 793 | 101 | 2 | 12.3 pp | 6 |
| 7 gliders + gun | 14 | 0.5 | 16 | 804 | 11/804 (1.4%) | 511 | 63.88 | 701 | 793 | 101 | 2 | 12.3 pp | 6 |
| 7 gliders + gun | 14 | 0.5 | 32 | 804 | 11/804 (1.4%) | 527 | 65.88 | 701 | 793 | 101 | 2 | 12.3 pp | 6 |
| 7 gliders + gun | 14 | 0.6 | 0 | 804 | 9/804 (1.1%) | 510 | 63.75 | 701 | 795 | 101 | 2 | 12.3 pp | 6 |
| 7 gliders + gun | 14 | 0.6 | 8 | 804 | 9/804 (1.1%) | 517 | 64.63 | 701 | 795 | 101 | 2 | 12.3 pp | 6 |
| 7 gliders + gun | 14 | 0.6 | 16 | 804 | 9/804 (1.1%) | 525 | 65.63 | 701 | 795 | 101 | 2 | 12.3 pp | 6 |
| 7 gliders + gun | 14 | 0.6 | 32 | 804 | 9/804 (1.1%) | 541 | 67.63 | 701 | 795 | 101 | 2 | 12.3 pp | 6 |
| 7 gliders + gun | 14 | 0.75 | 0 | 804 | 8/804 (1.0%) | 532 | 66.50 | 701 | 796 | 101 | 2 | 12.3 pp | 6 |
| 7 gliders + gun | 14 | 0.75 | 8 | 804 | 8/804 (1.0%) | 539 | 67.38 | 701 | 796 | 101 | 2 | 12.3 pp | 6 |
| 7 gliders + gun | 14 | 0.75 | 16 | 804 | 8/804 (1.0%) | 547 | 68.38 | 701 | 796 | 101 | 2 | 12.3 pp | 6 |
| 7 gliders + gun | 14 | 0.75 | 32 | 804 | 7/804 (0.9%) | 552 | 69.00 | 701 | 797 | 101 | 2 | 12.3 pp | 6 |
| 8 LWSS vs upper gun+eater (interference) | 10 | 0.4 | 0 | 414 | 98/414 (23.7%) | 178 | 22.25 | 260 | 316 | 122 | 32 | 21.7 pp | 4 |
| 8 LWSS vs upper gun+eater (interference) | 10 | 0.4 | 8 | 414 | 98/414 (23.7%) | 185 | 23.13 | 260 | 316 | 122 | 32 | 21.7 pp | 4 |
| 8 LWSS vs upper gun+eater (interference) | 10 | 0.4 | 16 | 414 | 96/414 (23.2%) | 188.5 | 23.56 | 260 | 318 | 122 | 32 | 21.7 pp | 4 |
| 8 LWSS vs upper gun+eater (interference) | 10 | 0.4 | 32 | 414 | 93/414 (22.5%) | 167 | 20.88 | 260 | 321 | 122 | 32 | 21.7 pp | 4 |
| 8 LWSS vs upper gun+eater (interference) | 10 | 0.5 | 0 | 414 | 86/414 (20.8%) | 201 | 25.13 | 260 | 328 | 122 | 32 | 21.7 pp | 4 |
| 8 LWSS vs upper gun+eater (interference) | 10 | 0.5 | 8 | 414 | 86/414 (20.8%) | 208 | 26.00 | 260 | 328 | 122 | 32 | 21.7 pp | 4 |
| 8 LWSS vs upper gun+eater (interference) | 10 | 0.5 | 16 | 414 | 85/414 (20.5%) | 208 | 26.00 | 260 | 329 | 122 | 32 | 21.7 pp | 4 |
| 8 LWSS vs upper gun+eater (interference) | 10 | 0.5 | 32 | 414 | 83/414 (20.0%) | 221 | 27.63 | 260 | 331 | 122 | 32 | 21.7 pp | 4 |
| 8 LWSS vs upper gun+eater (interference) | 10 | 0.6 | 0 | 414 | 53/414 (12.8%) | 396 | 49.50 | 262 | 361 | 119 | 33 | 20.8 pp | 5 |
| 8 LWSS vs upper gun+eater (interference) | 10 | 0.6 | 8 | 414 | 53/414 (12.8%) | 403 | 50.38 | 262 | 361 | 119 | 33 | 20.8 pp | 5 |
| 8 LWSS vs upper gun+eater (interference) | 10 | 0.6 | 16 | 414 | 52/414 (12.6%) | 397.5 | 49.69 | 262 | 362 | 119 | 33 | 20.8 pp | 5 |
| 8 LWSS vs upper gun+eater (interference) | 10 | 0.6 | 32 | 414 | 50/414 (12.1%) | 393.5 | 49.19 | 262 | 364 | 119 | 33 | 20.8 pp | 5 |
| 8 LWSS vs upper gun+eater (interference) | 10 | 0.75 | 0 | 414 | 42/414 (10.1%) | 419.5 | 52.44 | 262 | 372 | 118 | 34 | 20.3 pp | 6 |
| 8 LWSS vs upper gun+eater (interference) | 10 | 0.75 | 8 | 414 | 40/414 (9.7%) | 423 | 52.88 | 262 | 374 | 118 | 34 | 20.3 pp | 6 |
| 8 LWSS vs upper gun+eater (interference) | 10 | 0.75 | 16 | 414 | 36/414 (8.7%) | 422 | 52.75 | 262 | 378 | 118 | 34 | 20.3 pp | 6 |
| 8 LWSS vs upper gun+eater (interference) | 10 | 0.75 | 32 | 414 | 33/414 (8.0%) | 359 | 44.88 | 262 | 381 | 118 | 34 | 20.3 pp | 6 |
| 8 LWSS vs upper gun+eater (interference) | 12 | 0.4 | 0 | 408 | 96/408 (23.5%) | 145.5 | 18.19 | 244 | 312 | 130 | 34 | 23.5 pp | 6 |
| 8 LWSS vs upper gun+eater (interference) | 12 | 0.4 | 8 | 408 | 95/408 (23.3%) | 147 | 18.38 | 244 | 313 | 130 | 34 | 23.5 pp | 6 |
| 8 LWSS vs upper gun+eater (interference) | 12 | 0.4 | 16 | 408 | 94/408 (23.0%) | 152 | 19.00 | 244 | 314 | 130 | 34 | 23.5 pp | 6 |
| 8 LWSS vs upper gun+eater (interference) | 12 | 0.4 | 32 | 408 | 92/408 (22.5%) | 162.5 | 20.31 | 244 | 316 | 130 | 34 | 23.5 pp | 6 |
| 8 LWSS vs upper gun+eater (interference) | 12 | 0.5 | 0 | 408 | 67/408 (16.4%) | 355 | 44.38 | 246 | 341 | 127 | 35 | 22.5 pp | 6 |
| 8 LWSS vs upper gun+eater (interference) | 12 | 0.5 | 8 | 408 | 66/408 (16.2%) | 359.5 | 44.94 | 246 | 342 | 127 | 35 | 22.5 pp | 6 |
| 8 LWSS vs upper gun+eater (interference) | 12 | 0.5 | 16 | 408 | 65/408 (15.9%) | 365 | 45.63 | 246 | 343 | 127 | 35 | 22.5 pp | 6 |
| 8 LWSS vs upper gun+eater (interference) | 12 | 0.5 | 32 | 408 | 64/408 (15.7%) | 370.5 | 46.31 | 246 | 344 | 127 | 35 | 22.5 pp | 6 |
| 8 LWSS vs upper gun+eater (interference) | 12 | 0.6 | 0 | 408 | 53/408 (13.0%) | 400 | 50.00 | 246 | 355 | 127 | 35 | 22.5 pp | 7 |
| 8 LWSS vs upper gun+eater (interference) | 12 | 0.6 | 8 | 408 | 52/408 (12.7%) | 394.5 | 49.31 | 246 | 356 | 127 | 35 | 22.5 pp | 7 |
| 8 LWSS vs upper gun+eater (interference) | 12 | 0.6 | 16 | 408 | 50/408 (12.3%) | 382.5 | 47.81 | 246 | 358 | 127 | 35 | 22.5 pp | 7 |
| 8 LWSS vs upper gun+eater (interference) | 12 | 0.6 | 32 | 408 | 44/408 (10.8%) | 358.5 | 44.81 | 246 | 364 | 127 | 35 | 22.5 pp | 7 |
| 8 LWSS vs upper gun+eater (interference) | 12 | 0.75 | 0 | 408 | 37/408 (9.1%) | 421 | 52.63 | 246 | 371 | 126 | 36 | 22.1 pp | 9 |
| 8 LWSS vs upper gun+eater (interference) | 12 | 0.75 | 8 | 408 | 35/408 (8.6%) | 424 | 53.00 | 246 | 373 | 126 | 36 | 22.1 pp | 9 |
| 8 LWSS vs upper gun+eater (interference) | 12 | 0.75 | 16 | 408 | 32/408 (7.8%) | 384 | 48.00 | 246 | 376 | 126 | 36 | 22.1 pp | 9 |
| 8 LWSS vs upper gun+eater (interference) | 12 | 0.75 | 32 | 408 | 30/408 (7.4%) | 359.5 | 44.94 | 246 | 378 | 126 | 36 | 22.1 pp | 9 |
| 8 LWSS vs upper gun+eater (interference) | 14 | 0.4 | 0 | 312 | 65/312 (20.8%) | 306 | 38.25 | 165 | 247 | 115 | 32 | 26.6 pp | 4 |
| 8 LWSS vs upper gun+eater (interference) | 14 | 0.4 | 8 | 312 | 65/312 (20.8%) | 313 | 39.13 | 165 | 247 | 115 | 32 | 26.6 pp | 4 |
| 8 LWSS vs upper gun+eater (interference) | 14 | 0.4 | 16 | 312 | 64/312 (20.5%) | 315 | 39.38 | 165 | 248 | 115 | 32 | 26.6 pp | 4 |
| 8 LWSS vs upper gun+eater (interference) | 14 | 0.4 | 32 | 312 | 62/312 (19.9%) | 322.5 | 40.31 | 165 | 250 | 115 | 32 | 26.6 pp | 4 |
| 8 LWSS vs upper gun+eater (interference) | 14 | 0.5 | 0 | 312 | 56/312 (17.9%) | 298 | 37.25 | 165 | 256 | 115 | 32 | 26.6 pp | 4 |
| 8 LWSS vs upper gun+eater (interference) | 14 | 0.5 | 8 | 312 | 56/312 (17.9%) | 305 | 38.13 | 165 | 256 | 115 | 32 | 26.6 pp | 4 |
| 8 LWSS vs upper gun+eater (interference) | 14 | 0.5 | 16 | 312 | 55/312 (17.6%) | 312 | 39.00 | 165 | 257 | 115 | 32 | 26.6 pp | 4 |
| 8 LWSS vs upper gun+eater (interference) | 14 | 0.5 | 32 | 312 | 50/312 (16.0%) | 309.5 | 38.69 | 165 | 262 | 115 | 32 | 26.6 pp | 4 |
| 8 LWSS vs upper gun+eater (interference) | 14 | 0.6 | 0 | 312 | 47/312 (15.1%) | 332 | 41.50 | 165 | 265 | 115 | 32 | 26.6 pp | 4 |
| 8 LWSS vs upper gun+eater (interference) | 14 | 0.6 | 8 | 312 | 46/312 (14.7%) | 337.5 | 42.19 | 165 | 266 | 115 | 32 | 26.6 pp | 4 |
| 8 LWSS vs upper gun+eater (interference) | 14 | 0.6 | 16 | 312 | 42/312 (13.5%) | 316 | 39.50 | 165 | 270 | 115 | 32 | 26.6 pp | 4 |
| 8 LWSS vs upper gun+eater (interference) | 14 | 0.6 | 32 | 312 | 39/312 (12.5%) | 319 | 39.88 | 165 | 273 | 115 | 32 | 26.6 pp | 4 |
| 8 LWSS vs upper gun+eater (interference) | 14 | 0.75 | 0 | 312 | 26/312 (8.3%) | 397.5 | 49.69 | 165 | 286 | 115 | 32 | 26.6 pp | 8 |
| 8 LWSS vs upper gun+eater (interference) | 14 | 0.75 | 8 | 312 | 25/312 (8.0%) | 388 | 48.50 | 165 | 287 | 115 | 32 | 26.6 pp | 8 |
| 8 LWSS vs upper gun+eater (interference) | 14 | 0.75 | 16 | 312 | 24/312 (7.7%) | 374 | 46.75 | 165 | 288 | 115 | 32 | 26.6 pp | 8 |
| 8 LWSS vs upper gun+eater (interference) | 14 | 0.75 | 32 | 312 | 22/312 (7.1%) | 366.5 | 45.81 | 165 | 290 | 115 | 32 | 26.6 pp | 8 |
| 8 LWSS vs lower gun+eater | 10 | 0.4 | 0 | 414 | 94/414 (22.7%) | 204 | 25.50 | 101 | 320 | 99 | 214 | -27.8 pp | 2 |
| 8 LWSS vs lower gun+eater | 10 | 0.4 | 8 | 414 | 92/414 (22.2%) | 209.5 | 26.19 | 101 | 322 | 99 | 214 | -27.8 pp | 2 |
| 8 LWSS vs lower gun+eater | 10 | 0.4 | 16 | 414 | 91/414 (22.0%) | 216 | 27.00 | 101 | 323 | 99 | 214 | -27.8 pp | 2 |
| 8 LWSS vs lower gun+eater | 10 | 0.4 | 32 | 414 | 91/414 (22.0%) | 232 | 29.00 | 101 | 323 | 99 | 214 | -27.8 pp | 2 |
| 8 LWSS vs lower gun+eater | 10 | 0.5 | 0 | 414 | 80/414 (19.3%) | 212.5 | 26.56 | 101 | 334 | 98 | 215 | -28.3 pp | 4 |
| 8 LWSS vs lower gun+eater | 10 | 0.5 | 8 | 414 | 80/414 (19.3%) | 219.5 | 27.44 | 101 | 334 | 98 | 215 | -28.3 pp | 4 |
| 8 LWSS vs lower gun+eater | 10 | 0.5 | 16 | 414 | 80/414 (19.3%) | 227.5 | 28.44 | 101 | 334 | 98 | 215 | -28.3 pp | 4 |
| 8 LWSS vs lower gun+eater | 10 | 0.5 | 32 | 414 | 80/414 (19.3%) | 243.5 | 30.44 | 101 | 334 | 99 | 214 | -27.8 pp | 4 |
| 8 LWSS vs lower gun+eater | 10 | 0.6 | 0 | 414 | 62/414 (15.0%) | 368 | 46.00 | 102 | 352 | 97 | 215 | -28.5 pp | 5 |
| 8 LWSS vs lower gun+eater | 10 | 0.6 | 8 | 414 | 62/414 (15.0%) | 375 | 46.88 | 102 | 352 | 97 | 215 | -28.5 pp | 5 |
| 8 LWSS vs lower gun+eater | 10 | 0.6 | 16 | 414 | 62/414 (15.0%) | 383 | 47.88 | 102 | 352 | 97 | 215 | -28.5 pp | 5 |
| 8 LWSS vs lower gun+eater | 10 | 0.6 | 32 | 414 | 61/414 (14.7%) | 400 | 50.00 | 102 | 353 | 98 | 214 | -28.0 pp | 5 |
| 8 LWSS vs lower gun+eater | 10 | 0.75 | 0 | 414 | 47/414 (11.4%) | 428 | 53.50 | 102 | 367 | 98 | 214 | -28.0 pp | 13 |
| 8 LWSS vs lower gun+eater | 10 | 0.75 | 8 | 414 | 47/414 (11.4%) | 435 | 54.38 | 102 | 367 | 98 | 214 | -28.0 pp | 13 |
| 8 LWSS vs lower gun+eater | 10 | 0.75 | 16 | 414 | 47/414 (11.4%) | 443 | 55.38 | 102 | 367 | 98 | 214 | -28.0 pp | 13 |
| 8 LWSS vs lower gun+eater | 10 | 0.75 | 32 | 414 | 47/414 (11.4%) | 459 | 57.38 | 102 | 367 | 98 | 214 | -28.0 pp | 13 |
| 8 LWSS vs lower gun+eater | 12 | 0.4 | 0 | 408 | 91/408 (22.3%) | 200 | 25.00 | 92 | 317 | 103 | 213 | -27.0 pp | 2 |
| 8 LWSS vs lower gun+eater | 12 | 0.4 | 8 | 408 | 90/408 (22.1%) | 206.5 | 25.81 | 92 | 318 | 103 | 213 | -27.0 pp | 2 |
| 8 LWSS vs lower gun+eater | 12 | 0.4 | 16 | 408 | 89/408 (21.8%) | 214 | 26.75 | 92 | 319 | 103 | 213 | -27.0 pp | 2 |
| 8 LWSS vs lower gun+eater | 12 | 0.4 | 32 | 408 | 89/408 (21.8%) | 230 | 28.75 | 92 | 319 | 103 | 213 | -27.0 pp | 2 |
| 8 LWSS vs lower gun+eater | 12 | 0.5 | 0 | 408 | 66/408 (16.2%) | 338.5 | 42.31 | 92 | 342 | 98 | 218 | -29.4 pp | 3 |
| 8 LWSS vs lower gun+eater | 12 | 0.5 | 8 | 408 | 66/408 (16.2%) | 345.5 | 43.19 | 92 | 342 | 98 | 218 | -29.4 pp | 3 |
| 8 LWSS vs lower gun+eater | 12 | 0.5 | 16 | 408 | 66/408 (16.2%) | 353.5 | 44.19 | 92 | 342 | 98 | 218 | -29.4 pp | 3 |
| 8 LWSS vs lower gun+eater | 12 | 0.5 | 32 | 408 | 66/408 (16.2%) | 381 | 47.63 | 92 | 342 | 99 | 217 | -28.9 pp | 3 |
| 8 LWSS vs lower gun+eater | 12 | 0.6 | 0 | 408 | 56/408 (13.7%) | 376 | 47.00 | 92 | 352 | 100 | 216 | -28.4 pp | 7 |
| 8 LWSS vs lower gun+eater | 12 | 0.6 | 8 | 408 | 56/408 (13.7%) | 383 | 47.88 | 92 | 352 | 100 | 216 | -28.4 pp | 7 |
| 8 LWSS vs lower gun+eater | 12 | 0.6 | 16 | 408 | 56/408 (13.7%) | 391 | 48.88 | 92 | 352 | 100 | 216 | -28.4 pp | 7 |
| 8 LWSS vs lower gun+eater | 12 | 0.6 | 32 | 408 | 56/408 (13.7%) | 407 | 50.88 | 92 | 352 | 100 | 216 | -28.4 pp | 7 |
| 8 LWSS vs lower gun+eater | 12 | 0.75 | 0 | 408 | 40/408 (9.8%) | 434.5 | 54.31 | 92 | 368 | 100 | 216 | -28.4 pp | 16 |
| 8 LWSS vs lower gun+eater | 12 | 0.75 | 8 | 408 | 40/408 (9.8%) | 441.5 | 55.19 | 92 | 368 | 100 | 216 | -28.4 pp | 16 |
| 8 LWSS vs lower gun+eater | 12 | 0.75 | 16 | 408 | 40/408 (9.8%) | 449.5 | 56.19 | 92 | 368 | 100 | 216 | -28.4 pp | 16 |
| 8 LWSS vs lower gun+eater | 12 | 0.75 | 32 | 408 | 40/408 (9.8%) | 465.5 | 58.19 | 92 | 368 | 100 | 216 | -28.4 pp | 16 |
| 8 LWSS vs lower gun+eater | 14 | 0.4 | 0 | 312 | 67/312 (21.5%) | 321 | 40.13 | 58 | 245 | 89 | 165 | -24.4 pp | 1 |
| 8 LWSS vs lower gun+eater | 14 | 0.4 | 8 | 312 | 65/312 (20.8%) | 328 | 41.00 | 58 | 247 | 89 | 165 | -24.4 pp | 1 |
| 8 LWSS vs lower gun+eater | 14 | 0.4 | 16 | 312 | 65/312 (20.8%) | 336 | 42.00 | 58 | 247 | 89 | 165 | -24.4 pp | 1 |
| 8 LWSS vs lower gun+eater | 14 | 0.4 | 32 | 312 | 65/312 (20.8%) | 352 | 44.00 | 58 | 247 | 89 | 165 | -24.4 pp | 1 |
| 8 LWSS vs lower gun+eater | 14 | 0.5 | 0 | 312 | 53/312 (17.0%) | 333 | 41.63 | 58 | 259 | 89 | 165 | -24.4 pp | 3 |
| 8 LWSS vs lower gun+eater | 14 | 0.5 | 8 | 312 | 53/312 (17.0%) | 340 | 42.50 | 58 | 259 | 89 | 165 | -24.4 pp | 3 |
| 8 LWSS vs lower gun+eater | 14 | 0.5 | 16 | 312 | 53/312 (17.0%) | 348 | 43.50 | 58 | 259 | 89 | 165 | -24.4 pp | 3 |
| 8 LWSS vs lower gun+eater | 14 | 0.5 | 32 | 312 | 53/312 (17.0%) | 364 | 45.50 | 58 | 259 | 89 | 165 | -24.4 pp | 3 |
| 8 LWSS vs lower gun+eater | 14 | 0.6 | 0 | 312 | 44/312 (14.1%) | 369 | 46.13 | 58 | 268 | 89 | 165 | -24.4 pp | 7 |
| 8 LWSS vs lower gun+eater | 14 | 0.6 | 8 | 312 | 44/312 (14.1%) | 376 | 47.00 | 58 | 268 | 89 | 165 | -24.4 pp | 7 |
| 8 LWSS vs lower gun+eater | 14 | 0.6 | 16 | 312 | 44/312 (14.1%) | 384 | 48.00 | 58 | 268 | 89 | 165 | -24.4 pp | 7 |
| 8 LWSS vs lower gun+eater | 14 | 0.6 | 32 | 312 | 43/312 (13.8%) | 398 | 49.75 | 58 | 269 | 89 | 165 | -24.4 pp | 7 |
| 8 LWSS vs lower gun+eater | 14 | 0.75 | 0 | 312 | 24/312 (7.7%) | 436.5 | 54.56 | 58 | 288 | 89 | 165 | -24.4 pp | 12 |
| 8 LWSS vs lower gun+eater | 14 | 0.75 | 8 | 312 | 24/312 (7.7%) | 443.5 | 55.44 | 58 | 288 | 89 | 165 | -24.4 pp | 12 |
| 8 LWSS vs lower gun+eater | 14 | 0.75 | 16 | 312 | 24/312 (7.7%) | 451.5 | 56.44 | 58 | 288 | 89 | 165 | -24.4 pp | 12 |
| 8 LWSS vs lower gun+eater | 14 | 0.75 | 32 | 312 | 24/312 (7.7%) | 467.5 | 58.44 | 58 | 288 | 89 | 165 | -24.4 pp | 12 |
| 4 LWSS vs block | 10 | 0.4 | 0 | 3846 | 489/3846 (12.7%) | 131 | 16.38 | 2981 | 3357 | 865 | 0 | 22.5 pp | 65 |
| 4 LWSS vs block | 10 | 0.4 | 8 | 3846 | 486/3846 (12.6%) | 138 | 17.25 | 2981 | 3360 | 865 | 0 | 22.5 pp | 65 |
| 4 LWSS vs block | 10 | 0.4 | 16 | 3846 | 482/3846 (12.5%) | 146 | 18.25 | 2981 | 3364 | 865 | 0 | 22.5 pp | 65 |
| 4 LWSS vs block | 10 | 0.4 | 32 | 3846 | 479/3846 (12.5%) | 161 | 20.13 | 2981 | 3367 | 865 | 0 | 22.5 pp | 65 |
| 4 LWSS vs block | 10 | 0.5 | 0 | 3846 | 396/3846 (10.3%) | 139 | 17.38 | 2981 | 3450 | 865 | 0 | 22.5 pp | 70 |
| 4 LWSS vs block | 10 | 0.5 | 8 | 3846 | 395/3846 (10.3%) | 146 | 18.25 | 2981 | 3451 | 865 | 0 | 22.5 pp | 70 |
| 4 LWSS vs block | 10 | 0.5 | 16 | 3846 | 393/3846 (10.2%) | 154 | 19.25 | 2981 | 3453 | 865 | 0 | 22.5 pp | 70 |
| 4 LWSS vs block | 10 | 0.5 | 32 | 3846 | 392/3846 (10.2%) | 170 | 21.25 | 2981 | 3454 | 865 | 0 | 22.5 pp | 70 |
| 4 LWSS vs block | 10 | 0.6 | 0 | 3846 | 305/3846 (7.9%) | 335 | 41.88 | 2981 | 3541 | 865 | 0 | 22.5 pp | 70 |
| 4 LWSS vs block | 10 | 0.6 | 8 | 3846 | 304/3846 (7.9%) | 340 | 42.50 | 2981 | 3542 | 865 | 0 | 22.5 pp | 70 |
| 4 LWSS vs block | 10 | 0.6 | 16 | 3846 | 302/3846 (7.9%) | 346 | 43.25 | 2981 | 3544 | 865 | 0 | 22.5 pp | 70 |
| 4 LWSS vs block | 10 | 0.6 | 32 | 3846 | 302/3846 (7.9%) | 362 | 45.25 | 2981 | 3544 | 865 | 0 | 22.5 pp | 70 |
| 4 LWSS vs block | 10 | 0.75 | 0 | 3846 | 223/3846 (5.8%) | 509 | 63.63 | 2981 | 3623 | 865 | 0 | 22.5 pp | 81 |
| 4 LWSS vs block | 10 | 0.75 | 8 | 3846 | 223/3846 (5.8%) | 516 | 64.50 | 2981 | 3623 | 865 | 0 | 22.5 pp | 81 |
| 4 LWSS vs block | 10 | 0.75 | 16 | 3846 | 223/3846 (5.8%) | 524 | 65.50 | 2981 | 3623 | 865 | 0 | 22.5 pp | 81 |
| 4 LWSS vs block | 10 | 0.75 | 32 | 3846 | 223/3846 (5.8%) | 540 | 67.50 | 2981 | 3623 | 865 | 0 | 22.5 pp | 81 |
| 4 LWSS vs block | 12 | 0.4 | 0 | 3540 | 430/3540 (12.1%) | 134 | 16.75 | 2690 | 3110 | 850 | 0 | 24.0 pp | 65 |
| 4 LWSS vs block | 12 | 0.4 | 8 | 3540 | 428/3540 (12.1%) | 141 | 17.63 | 2690 | 3112 | 850 | 0 | 24.0 pp | 65 |
| 4 LWSS vs block | 12 | 0.4 | 16 | 3540 | 426/3540 (12.0%) | 149 | 18.63 | 2690 | 3114 | 850 | 0 | 24.0 pp | 65 |
| 4 LWSS vs block | 12 | 0.4 | 32 | 3540 | 425/3540 (12.0%) | 165 | 20.63 | 2690 | 3115 | 850 | 0 | 24.0 pp | 65 |
| 4 LWSS vs block | 12 | 0.5 | 0 | 3540 | 324/3540 (9.2%) | 256.5 | 32.06 | 2690 | 3216 | 850 | 0 | 24.0 pp | 75 |
| 4 LWSS vs block | 12 | 0.5 | 8 | 3540 | 322/3540 (9.1%) | 259 | 32.38 | 2690 | 3218 | 850 | 0 | 24.0 pp | 75 |
| 4 LWSS vs block | 12 | 0.5 | 16 | 3540 | 320/3540 (9.0%) | 260.5 | 32.56 | 2690 | 3220 | 850 | 0 | 24.0 pp | 75 |
| 4 LWSS vs block | 12 | 0.5 | 32 | 3540 | 320/3540 (9.0%) | 276.5 | 34.56 | 2690 | 3220 | 850 | 0 | 24.0 pp | 75 |
| 4 LWSS vs block | 12 | 0.6 | 0 | 3540 | 248/3540 (7.0%) | 404 | 50.50 | 2690 | 3292 | 850 | 0 | 24.0 pp | 84 |
| 4 LWSS vs block | 12 | 0.6 | 8 | 3540 | 246/3540 (6.9%) | 408 | 51.00 | 2690 | 3294 | 850 | 0 | 24.0 pp | 84 |
| 4 LWSS vs block | 12 | 0.6 | 16 | 3540 | 246/3540 (6.9%) | 416 | 52.00 | 2690 | 3294 | 850 | 0 | 24.0 pp | 84 |
| 4 LWSS vs block | 12 | 0.6 | 32 | 3540 | 246/3540 (6.9%) | 432 | 54.00 | 2690 | 3294 | 850 | 0 | 24.0 pp | 84 |
| 4 LWSS vs block | 12 | 0.75 | 0 | 3540 | 173/3540 (4.9%) | 523 | 65.38 | 2690 | 3367 | 850 | 0 | 24.0 pp | 88 |
| 4 LWSS vs block | 12 | 0.75 | 8 | 3540 | 172/3540 (4.9%) | 530 | 66.25 | 2690 | 3368 | 850 | 0 | 24.0 pp | 88 |
| 4 LWSS vs block | 12 | 0.75 | 16 | 3540 | 170/3540 (4.8%) | 538 | 67.25 | 2690 | 3370 | 850 | 0 | 24.0 pp | 88 |
| 4 LWSS vs block | 12 | 0.75 | 32 | 3540 | 168/3540 (4.7%) | 553.5 | 69.19 | 2690 | 3372 | 850 | 0 | 24.0 pp | 88 |
| 4 LWSS vs block | 14 | 0.4 | 0 | 3044 | 260/3044 (8.5%) | 342 | 42.75 | 2389 | 2784 | 655 | 0 | 21.5 pp | 70 |
| 4 LWSS vs block | 14 | 0.4 | 8 | 3044 | 258/3044 (8.5%) | 347 | 43.38 | 2389 | 2786 | 655 | 0 | 21.5 pp | 70 |
| 4 LWSS vs block | 14 | 0.4 | 16 | 3044 | 255/3044 (8.4%) | 352 | 44.00 | 2389 | 2789 | 655 | 0 | 21.5 pp | 70 |
| 4 LWSS vs block | 14 | 0.4 | 32 | 3044 | 250/3044 (8.2%) | 365 | 45.63 | 2389 | 2794 | 655 | 0 | 21.5 pp | 70 |
| 4 LWSS vs block | 14 | 0.5 | 0 | 3044 | 208/3044 (6.8%) | 403 | 50.38 | 2389 | 2836 | 655 | 0 | 21.5 pp | 85 |
| 4 LWSS vs block | 14 | 0.5 | 8 | 3044 | 206/3044 (6.8%) | 405.5 | 50.69 | 2389 | 2838 | 655 | 0 | 21.5 pp | 85 |
| 4 LWSS vs block | 14 | 0.5 | 16 | 3044 | 204/3044 (6.7%) | 409 | 51.13 | 2389 | 2840 | 655 | 0 | 21.5 pp | 85 |
| 4 LWSS vs block | 14 | 0.5 | 32 | 3044 | 204/3044 (6.7%) | 425 | 53.13 | 2389 | 2840 | 655 | 0 | 21.5 pp | 85 |
| 4 LWSS vs block | 14 | 0.6 | 0 | 3044 | 151/3044 (5.0%) | 507 | 63.38 | 2389 | 2893 | 655 | 0 | 21.5 pp | 86 |
| 4 LWSS vs block | 14 | 0.6 | 8 | 3044 | 151/3044 (5.0%) | 514 | 64.25 | 2389 | 2893 | 655 | 0 | 21.5 pp | 86 |
| 4 LWSS vs block | 14 | 0.6 | 16 | 3044 | 151/3044 (5.0%) | 522 | 65.25 | 2389 | 2893 | 655 | 0 | 21.5 pp | 86 |
| 4 LWSS vs block | 14 | 0.6 | 32 | 3044 | 151/3044 (5.0%) | 538 | 67.25 | 2389 | 2893 | 655 | 0 | 21.5 pp | 86 |
| 4 LWSS vs block | 14 | 0.75 | 0 | 3044 | 111/3044 (3.6%) | 531 | 66.38 | 2389 | 2933 | 655 | 0 | 21.5 pp | 88 |
| 4 LWSS vs block | 14 | 0.75 | 8 | 3044 | 111/3044 (3.6%) | 538 | 67.25 | 2389 | 2933 | 655 | 0 | 21.5 pp | 88 |
| 4 LWSS vs block | 14 | 0.75 | 16 | 3044 | 111/3044 (3.6%) | 546 | 68.25 | 2389 | 2933 | 655 | 0 | 21.5 pp | 88 |
| 4 LWSS vs block | 14 | 0.75 | 32 | 3044 | 111/3044 (3.6%) | 562 | 70.25 | 2389 | 2933 | 655 | 0 | 21.5 pp | 88 |

### Capture tournament recipes

| Style | Cost | Full recipe |
| --- | --- | --- |
| gun | 36 | gosperglidergun@51,4/o7 |
| rush | 45 | lwss@4,42/o4; lwss@14,42/o4; lwss@24,42/o4; lwss@4,49/o4; lwss@14,49/o4 |
| growth | 10 | rpentomino@54,25/o0; rpentomino@54,64/o0 |
| defence | 18 | eater1@52,35/o4; eater1@52,57/o6; block@51,46/o0 |
| hybrid | 68 | gosperglidergun@51,4/o7; lwss@8,49/o2; lwss@18,49/o2; rpentomino@54,57/o0; rpentomino@48,49/o0; block@44,63/o0 |

### Capture tournament (T=.4, H=16, 12×12)

| Red | Blue | Winner | Red base enemy paint | Blue base enemy paint | End gen | Red captured | Blue captured |
| --- | --- | --- | --- | --- | --- | --- | --- |
| gun | gun | draw | 0.00% | 0.00% | 640 | — | — |
| gun | gun | draw | 0.00% | 0.00% | 640 | — | — |
| gun | rush | blue | 70.83% | 4.17% | 144 | 144 | — |
| rush | gun | red | 4.17% | 70.83% | 144 | — | 144 |
| gun | growth | red | 0.00% | 15.97% | 640 | — | — |
| growth | gun | blue | 15.97% | 0.00% | 640 | — | — |
| gun | defence | draw | 0.00% | 0.00% | 640 | — | — |
| defence | gun | draw | 0.00% | 0.00% | 640 | — | — |
| gun | hybrid | blue | 54.17% | 0.00% | 454 | 454 | — |
| hybrid | gun | red | 0.00% | 54.17% | 454 | — | 454 |
| rush | rush | draw | 0.00% | 0.00% | 640 | — | — |
| rush | rush | draw | 0.00% | 0.00% | 640 | — | — |
| rush | growth | red | 0.00% | 41.67% | 146 | — | 146 |
| growth | rush | blue | 41.67% | 0.00% | 146 | 146 | — |
| rush | defence | red | 0.00% | 83.33% | 154 | — | 154 |
| defence | rush | blue | 83.33% | 0.00% | 154 | 154 | — |
| rush | hybrid | blue | 15.28% | 0.00% | 640 | — | — |
| hybrid | rush | red | 0.00% | 15.28% | 640 | — | — |
| growth | growth | draw | 0.00% | 0.00% | 640 | — | — |
| growth | growth | draw | 0.00% | 0.00% | 640 | — | — |
| growth | defence | draw | 0.00% | 0.00% | 640 | — | — |
| defence | growth | draw | 0.00% | 0.00% | 640 | — | — |
| growth | hybrid | blue | 15.97% | 0.00% | 640 | — | — |
| hybrid | growth | red | 0.00% | 15.97% | 640 | — | — |
| defence | defence | draw | 0.00% | 0.00% | 640 | — | — |
| defence | defence | draw | 0.00% | 0.00% | 640 | — | — |
| defence | hybrid | blue | 11.11% | 0.00% | 640 | — | — |
| hybrid | defence | red | 0.00% | 11.11% | 640 | — | — |
| hybrid | hybrid | draw | 0.00% | 0.00% | 640 | — | — |
| hybrid | hybrid | draw | 0.00% | 0.00% | 640 | — | — |

### Capture tournament style rates

| Style | Wins | Draws | Losses | Win rate (draw=.5) |
| --- | --- | --- | --- | --- |
| gun | 2 | 6 | 4 | 41.7% |
| rush | 6 | 4 | 2 | 66.7% |
| growth | 0 | 6 | 6 | 25.0% |
| defence | 0 | 8 | 4 | 33.3% |
| hybrid | 8 | 4 | 0 | 83.3% |

### Capture tournament sweep

| Hitbox | T | H | Games | Capture rate (either base) | Median capture gen | Seconds @8 gen/s | Draws | Timeouts | Red wins | Blue wins | Red−blue outcomes (fixed roles) | Stationary-resident timeout wins |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 0.4 | 0 | 30 | 8/30 (26.7%) | 134.5 | 16.81 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 10 | 0.4 | 8 | 30 | 8/30 (26.7%) | 141.5 | 17.69 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 10 | 0.4 | 16 | 30 | 8/30 (26.7%) | 149.5 | 18.69 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 10 | 0.4 | 32 | 30 | 8/30 (26.7%) | 165.5 | 20.69 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 10 | 0.5 | 0 | 30 | 8/30 (26.7%) | 248.5 | 31.06 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 10 | 0.5 | 8 | 30 | 8/30 (26.7%) | 255.5 | 31.94 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 10 | 0.5 | 16 | 30 | 8/30 (26.7%) | 263.5 | 32.94 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 10 | 0.5 | 32 | 30 | 8/30 (26.7%) | 279.5 | 34.94 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 10 | 0.6 | 0 | 30 | 8/30 (26.7%) | 252 | 31.50 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 10 | 0.6 | 8 | 30 | 8/30 (26.7%) | 259 | 32.38 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 10 | 0.6 | 16 | 30 | 8/30 (26.7%) | 267 | 33.38 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 10 | 0.6 | 32 | 30 | 8/30 (26.7%) | 283 | 35.38 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 10 | 0.75 | 0 | 30 | 6/30 (20.0%) | 148 | 18.50 | 14 | 24 | 8 | 8 | 0.0 pp | 2 |
| 10 | 0.75 | 8 | 30 | 6/30 (20.0%) | 155 | 19.38 | 14 | 24 | 8 | 8 | 0.0 pp | 2 |
| 10 | 0.75 | 16 | 30 | 6/30 (20.0%) | 163 | 20.38 | 14 | 24 | 8 | 8 | 0.0 pp | 2 |
| 10 | 0.75 | 32 | 30 | 6/30 (20.0%) | 179 | 22.38 | 14 | 24 | 8 | 8 | 0.0 pp | 2 |
| 12 | 0.4 | 0 | 30 | 8/30 (26.7%) | 135 | 16.88 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 12 | 0.4 | 8 | 30 | 8/30 (26.7%) | 142 | 17.75 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 12 | 0.4 | 16 | 30 | 8/30 (26.7%) | 150 | 18.75 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 12 | 0.4 | 32 | 30 | 8/30 (26.7%) | 166 | 20.75 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 12 | 0.5 | 0 | 30 | 8/30 (26.7%) | 248.5 | 31.06 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 12 | 0.5 | 8 | 30 | 8/30 (26.7%) | 255.5 | 31.94 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 12 | 0.5 | 16 | 30 | 8/30 (26.7%) | 263.5 | 32.94 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 12 | 0.5 | 32 | 30 | 8/30 (26.7%) | 279.5 | 34.94 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 12 | 0.6 | 0 | 30 | 8/30 (26.7%) | 253.5 | 31.69 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 12 | 0.6 | 8 | 30 | 8/30 (26.7%) | 260.5 | 32.56 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 12 | 0.6 | 16 | 30 | 8/30 (26.7%) | 268.5 | 33.56 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 12 | 0.6 | 32 | 30 | 8/30 (26.7%) | 284.5 | 35.56 | 14 | 22 | 8 | 8 | 0.0 pp | 0 |
| 12 | 0.75 | 0 | 30 | 6/30 (20.0%) | 149 | 18.63 | 14 | 24 | 8 | 8 | 0.0 pp | 0 |
| 12 | 0.75 | 8 | 30 | 6/30 (20.0%) | 156 | 19.50 | 14 | 24 | 8 | 8 | 0.0 pp | 0 |
| 12 | 0.75 | 16 | 30 | 6/30 (20.0%) | 164 | 20.50 | 14 | 24 | 8 | 8 | 0.0 pp | 0 |
| 12 | 0.75 | 32 | 30 | 6/30 (20.0%) | 180 | 22.50 | 14 | 24 | 8 | 8 | 0.0 pp | 0 |
| 14 | 0.4 | 0 | 20 | 6/20 (30.0%) | 142 | 17.75 | 12 | 14 | 4 | 4 | 0.0 pp | 0 |
| 14 | 0.4 | 8 | 20 | 6/20 (30.0%) | 149 | 18.63 | 12 | 14 | 4 | 4 | 0.0 pp | 0 |
| 14 | 0.4 | 16 | 20 | 6/20 (30.0%) | 157 | 19.63 | 12 | 14 | 4 | 4 | 0.0 pp | 0 |
| 14 | 0.4 | 32 | 20 | 6/20 (30.0%) | 173 | 21.63 | 12 | 14 | 4 | 4 | 0.0 pp | 0 |
| 14 | 0.5 | 0 | 20 | 6/20 (30.0%) | 145 | 18.13 | 12 | 14 | 4 | 4 | 0.0 pp | 0 |
| 14 | 0.5 | 8 | 20 | 6/20 (30.0%) | 152 | 19.00 | 12 | 14 | 4 | 4 | 0.0 pp | 0 |
| 14 | 0.5 | 16 | 20 | 6/20 (30.0%) | 160 | 20.00 | 12 | 14 | 4 | 4 | 0.0 pp | 0 |
| 14 | 0.5 | 32 | 20 | 6/20 (30.0%) | 176 | 22.00 | 12 | 14 | 4 | 4 | 0.0 pp | 0 |
| 14 | 0.6 | 0 | 20 | 6/20 (30.0%) | 149 | 18.63 | 12 | 14 | 4 | 4 | 0.0 pp | 0 |
| 14 | 0.6 | 8 | 20 | 6/20 (30.0%) | 156 | 19.50 | 12 | 14 | 4 | 4 | 0.0 pp | 0 |
| 14 | 0.6 | 16 | 20 | 6/20 (30.0%) | 164 | 20.50 | 12 | 14 | 4 | 4 | 0.0 pp | 0 |
| 14 | 0.6 | 32 | 20 | 6/20 (30.0%) | 180 | 22.50 | 12 | 14 | 4 | 4 | 0.0 pp | 0 |
| 14 | 0.75 | 0 | 20 | 4/20 (20.0%) | 442 | 55.25 | 12 | 16 | 4 | 4 | 0.0 pp | 0 |
| 14 | 0.75 | 8 | 20 | 4/20 (20.0%) | 449 | 56.13 | 12 | 16 | 4 | 4 | 0.0 pp | 0 |
| 14 | 0.75 | 16 | 20 | 4/20 (20.0%) | 457 | 57.13 | 12 | 16 | 4 | 4 | 0.0 pp | 0 |
| 14 | 0.75 | 32 | 20 | 4/20 (20.0%) | 473 | 59.13 | 12 | 16 | 4 | 4 | 0.0 pp | 0 |

### Capture mirror parity

| Recommended tournament mirror fraction/end mismatches |
| --- |
| 0 |

### Stationary defence challenge portfolio

| Defence | Hitbox | T | H | Defence cost | Legal attacks | Attacker wins | Captures | Best red capture gen | Best full attack |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| certified eater | 10 | 0.4 | 0 | 7 | 11 | 9 | 8 | 66 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| certified eater | 10 | 0.4 | 8 | 7 | 11 | 9 | 8 | 73 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| certified eater | 10 | 0.4 | 16 | 7 | 11 | 9 | 8 | 81 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| certified eater | 10 | 0.4 | 32 | 7 | 11 | 9 | 8 | 97 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| certified eater | 10 | 0.5 | 0 | 7 | 11 | 9 | 7 | 71 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| certified eater | 10 | 0.5 | 8 | 7 | 11 | 9 | 7 | 78 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| certified eater | 10 | 0.5 | 16 | 7 | 11 | 9 | 7 | 86 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| certified eater | 10 | 0.5 | 32 | 7 | 11 | 9 | 7 | 102 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| certified eater | 10 | 0.6 | 0 | 7 | 11 | 9 | 6 | 101 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 10 | 0.6 | 8 | 7 | 11 | 9 | 6 | 108 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 10 | 0.6 | 16 | 7 | 11 | 9 | 6 | 116 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 10 | 0.6 | 32 | 7 | 11 | 9 | 6 | 132 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 10 | 0.75 | 0 | 7 | 11 | 9 | 6 | 130 | gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2 |
| certified eater | 10 | 0.75 | 8 | 7 | 11 | 9 | 6 | 137 | gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2 |
| certified eater | 10 | 0.75 | 16 | 7 | 11 | 9 | 6 | 145 | gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2 |
| certified eater | 10 | 0.75 | 32 | 7 | 11 | 9 | 6 | 161 | gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2 |
| certified eater | 12 | 0.4 | 0 | 7 | 9 | 7 | 6 | 71 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| certified eater | 12 | 0.4 | 8 | 7 | 9 | 7 | 6 | 78 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| certified eater | 12 | 0.4 | 16 | 7 | 9 | 7 | 6 | 86 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| certified eater | 12 | 0.4 | 32 | 7 | 9 | 7 | 6 | 102 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| certified eater | 12 | 0.5 | 0 | 7 | 9 | 7 | 5 | 100 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 12 | 0.5 | 8 | 7 | 9 | 7 | 5 | 107 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 12 | 0.5 | 16 | 7 | 9 | 7 | 5 | 115 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 12 | 0.5 | 32 | 7 | 9 | 7 | 5 | 131 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 12 | 0.6 | 0 | 7 | 9 | 7 | 5 | 107 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 12 | 0.6 | 8 | 7 | 9 | 7 | 5 | 114 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 12 | 0.6 | 16 | 7 | 9 | 7 | 5 | 122 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 12 | 0.6 | 32 | 7 | 9 | 7 | 5 | 138 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 12 | 0.75 | 0 | 7 | 9 | 7 | 5 | 135 | gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2 |
| certified eater | 12 | 0.75 | 8 | 7 | 9 | 7 | 4 | 142 | gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2 |
| certified eater | 12 | 0.75 | 16 | 7 | 9 | 7 | 4 | 150 | gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2 |
| certified eater | 12 | 0.75 | 32 | 7 | 9 | 7 | 4 | 166 | gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2 |
| certified eater | 14 | 0.4 | 0 | 7 | 5 | 3 | 3 | 98 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 14 | 0.4 | 8 | 7 | 5 | 3 | 3 | 105 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 14 | 0.4 | 16 | 7 | 5 | 3 | 3 | 113 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 14 | 0.4 | 32 | 7 | 5 | 3 | 3 | 129 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 14 | 0.5 | 0 | 7 | 5 | 3 | 3 | 102 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 14 | 0.5 | 8 | 7 | 5 | 3 | 3 | 109 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 14 | 0.5 | 16 | 7 | 5 | 3 | 3 | 117 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 14 | 0.5 | 32 | 7 | 5 | 3 | 3 | 133 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 14 | 0.6 | 0 | 7 | 5 | 3 | 3 | 122 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 14 | 0.6 | 8 | 7 | 5 | 3 | 3 | 129 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 14 | 0.6 | 16 | 7 | 5 | 3 | 3 | 137 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 14 | 0.6 | 32 | 7 | 5 | 3 | 3 | 153 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| certified eater | 14 | 0.75 | 0 | 7 | 5 | 3 | 2 | 140 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| certified eater | 14 | 0.75 | 8 | 7 | 5 | 3 | 2 | 147 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| certified eater | 14 | 0.75 | 16 | 7 | 5 | 3 | 2 | 155 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| certified eater | 14 | 0.75 | 32 | 7 | 5 | 3 | 2 | 171 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| port block | 10 | 0.4 | 0 | 4 | 11 | 10 | 9 | 66 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| port block | 10 | 0.4 | 8 | 4 | 11 | 10 | 9 | 73 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| port block | 10 | 0.4 | 16 | 4 | 11 | 10 | 9 | 81 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| port block | 10 | 0.4 | 32 | 4 | 11 | 10 | 9 | 97 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| port block | 10 | 0.5 | 0 | 4 | 11 | 10 | 8 | 71 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| port block | 10 | 0.5 | 8 | 4 | 11 | 10 | 8 | 78 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| port block | 10 | 0.5 | 16 | 4 | 11 | 10 | 8 | 86 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| port block | 10 | 0.5 | 32 | 4 | 11 | 10 | 8 | 102 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| port block | 10 | 0.6 | 0 | 4 | 11 | 10 | 7 | 101 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| port block | 10 | 0.6 | 8 | 4 | 11 | 10 | 7 | 108 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| port block | 10 | 0.6 | 16 | 4 | 11 | 10 | 7 | 116 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| port block | 10 | 0.6 | 32 | 4 | 11 | 10 | 7 | 132 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| port block | 10 | 0.75 | 0 | 4 | 11 | 10 | 7 | 123 | gosperglidergun@51,4/o7; lwss@12,37/o2; lwss@26,40/o2; lwss@40,37/o2; lwss@54,40/o2 |
| port block | 10 | 0.75 | 8 | 4 | 11 | 10 | 7 | 130 | gosperglidergun@51,4/o7; lwss@12,37/o2; lwss@26,40/o2; lwss@40,37/o2; lwss@54,40/o2 |
| port block | 10 | 0.75 | 16 | 4 | 11 | 10 | 7 | 138 | gosperglidergun@51,4/o7; lwss@12,37/o2; lwss@26,40/o2; lwss@40,37/o2; lwss@54,40/o2 |
| port block | 10 | 0.75 | 32 | 4 | 11 | 10 | 7 | 154 | gosperglidergun@51,4/o7; lwss@12,37/o2; lwss@26,40/o2; lwss@40,37/o2; lwss@54,40/o2 |
| port block | 12 | 0.4 | 0 | 4 | 9 | 8 | 7 | 71 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| port block | 12 | 0.4 | 8 | 4 | 9 | 8 | 7 | 78 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| port block | 12 | 0.4 | 16 | 4 | 9 | 8 | 7 | 86 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| port block | 12 | 0.4 | 32 | 4 | 9 | 8 | 7 | 102 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| port block | 12 | 0.5 | 0 | 4 | 9 | 8 | 6 | 89 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| port block | 12 | 0.5 | 8 | 4 | 9 | 8 | 6 | 96 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| port block | 12 | 0.5 | 16 | 4 | 9 | 8 | 6 | 104 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| port block | 12 | 0.5 | 32 | 4 | 9 | 8 | 6 | 120 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| port block | 12 | 0.6 | 0 | 4 | 9 | 8 | 6 | 107 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| port block | 12 | 0.6 | 8 | 4 | 9 | 8 | 6 | 114 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| port block | 12 | 0.6 | 16 | 4 | 9 | 8 | 6 | 122 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| port block | 12 | 0.6 | 32 | 4 | 9 | 8 | 6 | 138 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| port block | 12 | 0.75 | 0 | 4 | 9 | 8 | 6 | 128 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| port block | 12 | 0.75 | 8 | 4 | 9 | 8 | 5 | 135 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| port block | 12 | 0.75 | 16 | 4 | 9 | 8 | 5 | 143 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| port block | 12 | 0.75 | 32 | 4 | 9 | 8 | 5 | 159 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| port block | 14 | 0.4 | 0 | 4 | 5 | 5 | 4 | 85 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| port block | 14 | 0.4 | 8 | 4 | 5 | 5 | 4 | 92 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| port block | 14 | 0.4 | 16 | 4 | 5 | 5 | 4 | 100 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| port block | 14 | 0.4 | 32 | 4 | 5 | 5 | 4 | 116 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| port block | 14 | 0.5 | 0 | 4 | 5 | 5 | 4 | 92 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| port block | 14 | 0.5 | 8 | 4 | 5 | 5 | 4 | 99 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| port block | 14 | 0.5 | 16 | 4 | 5 | 5 | 4 | 107 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| port block | 14 | 0.5 | 32 | 4 | 5 | 5 | 4 | 123 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| port block | 14 | 0.6 | 0 | 4 | 5 | 5 | 4 | 118 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| port block | 14 | 0.6 | 8 | 4 | 5 | 5 | 4 | 125 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| port block | 14 | 0.6 | 16 | 4 | 5 | 5 | 4 | 133 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| port block | 14 | 0.6 | 32 | 4 | 5 | 5 | 4 | 149 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| port block | 14 | 0.75 | 0 | 4 | 5 | 5 | 3 | 132 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| port block | 14 | 0.75 | 8 | 4 | 5 | 5 | 3 | 139 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| port block | 14 | 0.75 | 16 | 4 | 5 | 5 | 3 | 147 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| port block | 14 | 0.75 | 32 | 4 | 5 | 5 | 3 | 163 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| two lane eaters | 10 | 0.4 | 0 | 14 | 11 | 7 | 6 | 66 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| two lane eaters | 10 | 0.4 | 8 | 14 | 11 | 7 | 6 | 73 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| two lane eaters | 10 | 0.4 | 16 | 14 | 11 | 7 | 6 | 81 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| two lane eaters | 10 | 0.4 | 32 | 14 | 11 | 7 | 6 | 97 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| two lane eaters | 10 | 0.5 | 0 | 14 | 11 | 7 | 5 | 71 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| two lane eaters | 10 | 0.5 | 8 | 14 | 11 | 7 | 5 | 78 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| two lane eaters | 10 | 0.5 | 16 | 14 | 11 | 7 | 5 | 86 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| two lane eaters | 10 | 0.5 | 32 | 14 | 11 | 7 | 5 | 102 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| two lane eaters | 10 | 0.6 | 0 | 14 | 11 | 7 | 4 | 119 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 10 | 0.6 | 8 | 14 | 11 | 7 | 4 | 126 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 10 | 0.6 | 16 | 14 | 11 | 7 | 4 | 134 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 10 | 0.6 | 32 | 14 | 11 | 7 | 4 | 150 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 10 | 0.75 | 0 | 14 | 11 | 7 | 3 | 143 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 10 | 0.75 | 8 | 14 | 11 | 7 | 3 | 150 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 10 | 0.75 | 16 | 14 | 11 | 7 | 3 | 158 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 10 | 0.75 | 32 | 14 | 11 | 7 | 3 | 174 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 12 | 0.4 | 0 | 14 | 9 | 6 | 5 | 71 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| two lane eaters | 12 | 0.4 | 8 | 14 | 9 | 6 | 5 | 78 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| two lane eaters | 12 | 0.4 | 16 | 14 | 9 | 6 | 5 | 86 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| two lane eaters | 12 | 0.4 | 32 | 14 | 9 | 6 | 5 | 102 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| two lane eaters | 12 | 0.5 | 0 | 14 | 9 | 6 | 4 | 120 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 12 | 0.5 | 8 | 14 | 9 | 6 | 4 | 127 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 12 | 0.5 | 16 | 14 | 9 | 6 | 4 | 135 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 12 | 0.5 | 32 | 14 | 9 | 6 | 4 | 151 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 12 | 0.6 | 0 | 14 | 9 | 6 | 4 | 132 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 12 | 0.6 | 8 | 14 | 9 | 6 | 4 | 139 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 12 | 0.6 | 16 | 14 | 9 | 6 | 4 | 147 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 12 | 0.6 | 32 | 14 | 9 | 6 | 4 | 163 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 12 | 0.75 | 0 | 14 | 9 | 6 | 1 | 212 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| two lane eaters | 12 | 0.75 | 8 | 14 | 9 | 6 | 1 | 219 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| two lane eaters | 12 | 0.75 | 16 | 14 | 9 | 6 | 1 | 227 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| two lane eaters | 12 | 0.75 | 32 | 14 | 9 | 6 | 1 | 243 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| two lane eaters | 14 | 0.4 | 0 | 14 | 5 | 3 | 3 | 120 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 14 | 0.4 | 8 | 14 | 5 | 3 | 3 | 127 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 14 | 0.4 | 16 | 14 | 5 | 3 | 3 | 135 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 14 | 0.4 | 32 | 14 | 5 | 3 | 3 | 151 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 14 | 0.5 | 0 | 14 | 5 | 3 | 3 | 132 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 14 | 0.5 | 8 | 14 | 5 | 3 | 3 | 139 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 14 | 0.5 | 16 | 14 | 5 | 3 | 3 | 147 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 14 | 0.5 | 32 | 14 | 5 | 3 | 3 | 163 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 14 | 0.6 | 0 | 14 | 5 | 3 | 2 | 150 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 14 | 0.6 | 8 | 14 | 5 | 3 | 2 | 157 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 14 | 0.6 | 16 | 14 | 5 | 3 | 2 | 165 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 14 | 0.6 | 32 | 14 | 5 | 3 | 2 | 181 | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 |
| two lane eaters | 14 | 0.75 | 0 | 14 | 5 | 3 | 1 | 226 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| two lane eaters | 14 | 0.75 | 8 | 14 | 5 | 3 | 1 | 233 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| two lane eaters | 14 | 0.75 | 16 | 14 | 5 | 3 | 1 | 241 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| two lane eaters | 14 | 0.75 | 32 | 14 | 5 | 3 | 1 | 257 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 10 | 0.4 | 0 | 18 | 11 | 5 | 4 | 200 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 10 | 0.4 | 8 | 18 | 11 | 5 | 4 | 207 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 10 | 0.4 | 16 | 18 | 11 | 5 | 4 | 215 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 10 | 0.4 | 32 | 18 | 11 | 5 | 4 | 231 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 10 | 0.5 | 0 | 18 | 11 | 5 | 3 | 204 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 10 | 0.5 | 8 | 18 | 11 | 5 | 3 | 211 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 10 | 0.5 | 16 | 18 | 11 | 5 | 3 | 219 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 10 | 0.5 | 32 | 18 | 11 | 5 | 3 | 235 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 10 | 0.6 | 0 | 18 | 11 | 5 | 3 | 249 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 10 | 0.6 | 8 | 18 | 11 | 5 | 2 | 256 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 10 | 0.6 | 16 | 18 | 11 | 5 | 2 | 264 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 10 | 0.6 | 32 | 18 | 11 | 5 | 2 | 280 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 10 | 0.75 | 0 | 18 | 11 | 5 | 1 | 276 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| tournament defence | 10 | 0.75 | 8 | 18 | 11 | 5 | 1 | 283 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| tournament defence | 10 | 0.75 | 16 | 18 | 11 | 5 | 1 | 291 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| tournament defence | 10 | 0.75 | 32 | 18 | 11 | 5 | 1 | 307 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| tournament defence | 12 | 0.4 | 0 | 18 | 9 | 4 | 3 | 204 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 12 | 0.4 | 8 | 18 | 9 | 4 | 3 | 211 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 12 | 0.4 | 16 | 18 | 9 | 4 | 3 | 219 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 12 | 0.4 | 32 | 18 | 9 | 4 | 3 | 235 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 12 | 0.5 | 0 | 18 | 9 | 4 | 2 | 244 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 12 | 0.5 | 8 | 18 | 9 | 4 | 2 | 251 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 12 | 0.5 | 16 | 18 | 9 | 4 | 2 | 259 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 12 | 0.5 | 32 | 18 | 9 | 4 | 2 | 275 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 12 | 0.6 | 0 | 18 | 9 | 4 | 1 | 268 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| tournament defence | 12 | 0.6 | 8 | 18 | 9 | 4 | 1 | 275 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| tournament defence | 12 | 0.6 | 16 | 18 | 9 | 4 | 1 | 283 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| tournament defence | 12 | 0.6 | 32 | 18 | 9 | 4 | 1 | 299 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| tournament defence | 12 | 0.75 | 0 | 18 | 9 | 4 | 1 | 338 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| tournament defence | 12 | 0.75 | 8 | 18 | 9 | 4 | 1 | 345 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| tournament defence | 12 | 0.75 | 16 | 18 | 9 | 4 | 1 | 353 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| tournament defence | 12 | 0.75 | 32 | 18 | 9 | 4 | 1 | 369 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| tournament defence | 14 | 0.4 | 0 | 18 | 5 | 3 | 2 | 206 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 14 | 0.4 | 8 | 18 | 5 | 3 | 2 | 213 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 14 | 0.4 | 16 | 18 | 5 | 3 | 2 | 221 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 14 | 0.4 | 32 | 18 | 5 | 3 | 2 | 269 | glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7 |
| tournament defence | 14 | 0.5 | 0 | 18 | 5 | 3 | 1 | 477 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| tournament defence | 14 | 0.5 | 8 | 18 | 5 | 3 | 1 | 484 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| tournament defence | 14 | 0.5 | 16 | 18 | 5 | 3 | 1 | 492 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| tournament defence | 14 | 0.5 | 32 | 18 | 5 | 3 | 1 | 508 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| tournament defence | 14 | 0.6 | 0 | 18 | 5 | 3 | 0 | — | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| tournament defence | 14 | 0.6 | 8 | 18 | 5 | 3 | 0 | — | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| tournament defence | 14 | 0.6 | 16 | 18 | 5 | 3 | 0 | — | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| tournament defence | 14 | 0.6 | 32 | 18 | 5 | 3 | 0 | — | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| tournament defence | 14 | 0.75 | 0 | 18 | 5 | 3 | 0 | — | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| tournament defence | 14 | 0.75 | 8 | 18 | 5 | 3 | 0 | — | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| tournament defence | 14 | 0.75 | 16 | 18 | 5 | 3 | 0 | — | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| tournament defence | 14 | 0.75 | 32 | 18 | 5 | 3 | 0 | — | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| 72-cell blocks | 10 | 0.4 | 0 | 72 | 11 | 11 | 11 | 66 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| 72-cell blocks | 10 | 0.4 | 8 | 72 | 11 | 11 | 11 | 73 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| 72-cell blocks | 10 | 0.4 | 16 | 72 | 11 | 11 | 11 | 81 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| 72-cell blocks | 10 | 0.4 | 32 | 72 | 11 | 11 | 11 | 97 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| 72-cell blocks | 10 | 0.5 | 0 | 72 | 11 | 11 | 9 | 71 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| 72-cell blocks | 10 | 0.5 | 8 | 72 | 11 | 11 | 9 | 78 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| 72-cell blocks | 10 | 0.5 | 16 | 72 | 11 | 11 | 9 | 86 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| 72-cell blocks | 10 | 0.5 | 32 | 72 | 11 | 11 | 9 | 102 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| 72-cell blocks | 10 | 0.6 | 0 | 72 | 11 | 11 | 9 | 101 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| 72-cell blocks | 10 | 0.6 | 8 | 72 | 11 | 11 | 9 | 108 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| 72-cell blocks | 10 | 0.6 | 16 | 72 | 11 | 11 | 9 | 116 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| 72-cell blocks | 10 | 0.6 | 32 | 72 | 11 | 11 | 9 | 132 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| 72-cell blocks | 10 | 0.75 | 0 | 72 | 11 | 11 | 8 | 123 | gosperglidergun@51,4/o7; lwss@12,37/o2; lwss@26,40/o2; lwss@40,37/o2; lwss@54,40/o2 |
| 72-cell blocks | 10 | 0.75 | 8 | 72 | 11 | 11 | 8 | 130 | gosperglidergun@51,4/o7; lwss@12,37/o2; lwss@26,40/o2; lwss@40,37/o2; lwss@54,40/o2 |
| 72-cell blocks | 10 | 0.75 | 16 | 72 | 11 | 11 | 8 | 138 | gosperglidergun@51,4/o7; lwss@12,37/o2; lwss@26,40/o2; lwss@40,37/o2; lwss@54,40/o2 |
| 72-cell blocks | 10 | 0.75 | 32 | 72 | 11 | 11 | 7 | 154 | gosperglidergun@51,4/o7; lwss@12,37/o2; lwss@26,40/o2; lwss@40,37/o2; lwss@54,40/o2 |
| 72-cell blocks | 12 | 0.4 | 0 | 72 | 9 | 9 | 9 | 71 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| 72-cell blocks | 12 | 0.4 | 8 | 72 | 9 | 9 | 9 | 78 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| 72-cell blocks | 12 | 0.4 | 16 | 72 | 9 | 9 | 9 | 86 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| 72-cell blocks | 12 | 0.4 | 32 | 72 | 9 | 9 | 9 | 102 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| 72-cell blocks | 12 | 0.5 | 0 | 72 | 9 | 9 | 7 | 89 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 72-cell blocks | 12 | 0.5 | 8 | 72 | 9 | 9 | 7 | 96 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 72-cell blocks | 12 | 0.5 | 16 | 72 | 9 | 9 | 7 | 104 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 72-cell blocks | 12 | 0.5 | 32 | 72 | 9 | 9 | 7 | 120 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 72-cell blocks | 12 | 0.6 | 0 | 72 | 9 | 9 | 7 | 107 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| 72-cell blocks | 12 | 0.6 | 8 | 72 | 9 | 9 | 7 | 114 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| 72-cell blocks | 12 | 0.6 | 16 | 72 | 9 | 9 | 7 | 122 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| 72-cell blocks | 12 | 0.6 | 32 | 72 | 9 | 9 | 6 | 138 | rpentomino@52,52/o2; rpentomino@44,60/o2 |
| 72-cell blocks | 12 | 0.75 | 0 | 72 | 9 | 9 | 6 | 134 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 72-cell blocks | 12 | 0.75 | 8 | 72 | 9 | 9 | 6 | 141 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 72-cell blocks | 12 | 0.75 | 16 | 72 | 9 | 9 | 5 | 149 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 72-cell blocks | 12 | 0.75 | 32 | 72 | 9 | 9 | 5 | 165 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 72-cell blocks | 14 | 0.4 | 0 | 72 | 5 | 5 | 5 | 85 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 72-cell blocks | 14 | 0.4 | 8 | 72 | 5 | 5 | 5 | 92 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 72-cell blocks | 14 | 0.4 | 16 | 72 | 5 | 5 | 5 | 100 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 72-cell blocks | 14 | 0.4 | 32 | 72 | 5 | 5 | 5 | 116 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 72-cell blocks | 14 | 0.5 | 0 | 72 | 5 | 5 | 4 | 92 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 72-cell blocks | 14 | 0.5 | 8 | 72 | 5 | 5 | 4 | 99 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 72-cell blocks | 14 | 0.5 | 16 | 72 | 5 | 5 | 4 | 107 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 72-cell blocks | 14 | 0.5 | 32 | 72 | 5 | 5 | 4 | 123 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 72-cell blocks | 14 | 0.6 | 0 | 72 | 5 | 5 | 4 | 118 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 72-cell blocks | 14 | 0.6 | 8 | 72 | 5 | 5 | 4 | 125 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 72-cell blocks | 14 | 0.6 | 16 | 72 | 5 | 5 | 4 | 133 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 72-cell blocks | 14 | 0.6 | 32 | 72 | 5 | 5 | 4 | 149 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 72-cell blocks | 14 | 0.75 | 0 | 72 | 5 | 5 | 3 | 137 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 72-cell blocks | 14 | 0.75 | 8 | 72 | 5 | 5 | 3 | 144 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 72-cell blocks | 14 | 0.75 | 16 | 72 | 5 | 5 | 3 | 152 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 72-cell blocks | 14 | 0.75 | 32 | 72 | 5 | 5 | 3 | 168 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |

### Capture release gate

| Hitbox | T | H | Single gun captures | Gun-led combined captures empty base | Eater fully stops gun | Combined captures eater base | Restated gate | Empty-base capture gen | Defended capture gen | Stationary template undefeated by the tested portfolio? | Best full defended recipe | Best full undefended recipe |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 0.4 | 0 | NO | YES | YES | YES | YES | 66 | 66 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| 10 | 0.4 | 8 | NO | YES | YES | YES | YES | 73 | 73 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| 10 | 0.4 | 16 | NO | YES | YES | YES | YES | 81 | 81 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| 10 | 0.4 | 32 | NO | YES | YES | YES | YES | 97 | 97 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| 10 | 0.5 | 0 | NO | YES | YES | YES | YES | 71 | 71 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| 10 | 0.5 | 8 | NO | YES | YES | YES | YES | 78 | 78 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| 10 | 0.5 | 16 | NO | YES | YES | YES | YES | 86 | 86 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| 10 | 0.5 | 32 | NO | YES | YES | YES | YES | 102 | 102 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 | gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2 |
| 10 | 0.6 | 0 | NO | YES | YES | YES | YES | 109 | 123 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2 | gosperglidergun@51,4/o7; lwss@12,37/o2; lwss@26,40/o2; lwss@40,37/o2; lwss@54,40/o2 |
| 10 | 0.6 | 8 | NO | YES | YES | YES | YES | 116 | 130 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2 | gosperglidergun@51,4/o7; lwss@12,37/o2; lwss@26,40/o2; lwss@40,37/o2; lwss@54,40/o2 |
| 10 | 0.6 | 16 | NO | YES | YES | YES | YES | 124 | 138 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2 | gosperglidergun@51,4/o7; lwss@12,37/o2; lwss@26,40/o2; lwss@40,37/o2; lwss@54,40/o2 |
| 10 | 0.6 | 32 | NO | YES | YES | YES | YES | 140 | 154 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2 | gosperglidergun@51,4/o7; lwss@12,37/o2; lwss@26,40/o2; lwss@40,37/o2; lwss@54,40/o2 |
| 10 | 0.75 | 0 | NO | YES | YES | YES | YES | 123 | 130 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2 | gosperglidergun@51,4/o7; lwss@12,37/o2; lwss@26,40/o2; lwss@40,37/o2; lwss@54,40/o2 |
| 10 | 0.75 | 8 | NO | YES | YES | YES | YES | 130 | 137 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2 | gosperglidergun@51,4/o7; lwss@12,37/o2; lwss@26,40/o2; lwss@40,37/o2; lwss@54,40/o2 |
| 10 | 0.75 | 16 | NO | YES | YES | YES | YES | 138 | 145 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2 | gosperglidergun@51,4/o7; lwss@12,37/o2; lwss@26,40/o2; lwss@40,37/o2; lwss@54,40/o2 |
| 10 | 0.75 | 32 | NO | YES | YES | YES | YES | 154 | 161 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2 | gosperglidergun@51,4/o7; lwss@12,37/o2; lwss@26,40/o2; lwss@40,37/o2; lwss@54,40/o2 |
| 12 | 0.4 | 0 | NO | YES | YES | YES | YES | 71 | 71 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| 12 | 0.4 | 8 | NO | YES | YES | YES | YES | 78 | 78 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| 12 | 0.4 | 16 | NO | YES | YES | YES | YES | 86 | 86 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| 12 | 0.4 | 32 | NO | YES | YES | YES | YES | 102 | 102 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 | gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2 |
| 12 | 0.5 | 0 | NO | YES | YES | YES | YES | 89 | 123 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 12 | 0.5 | 8 | NO | YES | YES | YES | YES | 96 | 130 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 12 | 0.5 | 16 | NO | YES | YES | YES | YES | 104 | 138 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 12 | 0.5 | 32 | NO | YES | YES | YES | YES | 120 | 154 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 12 | 0.6 | 0 | NO | YES | YES | YES | YES | 115 | 127 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 12 | 0.6 | 8 | NO | YES | YES | YES | YES | 122 | 134 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 12 | 0.6 | 16 | NO | YES | YES | YES | YES | 130 | 142 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 12 | 0.6 | 32 | NO | YES | YES | YES | YES | 146 | 158 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 12 | 0.75 | 0 | NO | YES | YES | YES | YES | 134 | 135 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 12 | 0.75 | 8 | NO | YES | YES | YES | YES | 141 | 142 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 12 | 0.75 | 16 | NO | YES | YES | YES | YES | 149 | 150 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 12 | 0.75 | 32 | NO | YES | YES | YES | YES | 165 | 166 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 14 | 0.4 | 0 | NO | YES | YES | YES | YES | 85 | 121 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 14 | 0.4 | 8 | NO | YES | YES | YES | YES | 92 | 128 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 14 | 0.4 | 16 | NO | YES | YES | YES | YES | 100 | 136 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 14 | 0.4 | 32 | NO | YES | YES | YES | YES | 116 | 152 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 14 | 0.5 | 0 | NO | YES | YES | YES | YES | 92 | 126 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 14 | 0.5 | 8 | NO | YES | YES | YES | YES | 99 | 133 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 14 | 0.5 | 16 | NO | YES | YES | YES | YES | 107 | 141 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 14 | 0.5 | 32 | NO | YES | YES | YES | YES | 123 | 157 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 14 | 0.6 | 0 | NO | YES | YES | YES | YES | 118 | 132 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 14 | 0.6 | 8 | NO | YES | YES | YES | YES | 125 | 139 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 14 | 0.6 | 16 | NO | YES | YES | YES | YES | 133 | 147 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 14 | 0.6 | 32 | NO | YES | YES | YES | YES | 149 | 163 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 14 | 0.75 | 0 | NO | YES | YES | YES | YES | 137 | 140 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 14 | 0.75 | 8 | NO | YES | YES | YES | YES | 144 | 147 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 14 | 0.75 | 16 | NO | YES | YES | YES | YES | 152 | 155 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |
| 14 | 0.75 | 32 | NO | YES | YES | YES | YES | 168 | 171 | NO (0/5 templates) | gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4 | gosperglidergun@51,4/o7; lwss@12,34/o2; lwss@26,40/o2; lwss@40,34/o2; lwss@54,40/o2 |

### Static ash diagnostics (illegal in-base seeds are observer probes)

| Fixture | Live enemy sites in base at640 | Paint @gen1 | Paint @gen268 | Paint @640 | Capture gen | Timeout winner | Paint constant from gen |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Old fastest legal breach (includes collision paint) | 8 | 0.00% | 31.25% | 31.25% | — | red | 170 |
| Only its settled in-base blocks, fresh owner paint | 8 | 5.56% | 5.56% | 5.56% | — | red | 1 |
| Single in-base block, fresh owner paint | 4 | 2.78% | 2.78% | 2.78% | — | red | 1 |

### Repaint and tug-of-war (blue base)

| Fixture | Initial enemy paint | Min for repaint / max for tug | Final enemy paint | Generations with paint decrease | Owner recipe |
| --- | --- | --- | --- | --- | --- |
| owner LWSS | 100% | 58.33% | 58.33% | — | lwss@100,46/o0 |
| owner glider | 100% | 69.44% | 69.44% | — | glider@98,58/o2 |
| rush vs mirrored rush | 0% | 0.00% | 0.00% | 0 | lwss@119,42/o0; lwss@109,42/o0; lwss@99,42/o0; lwss@119,49/o0; lwss@109,49/o0 |
| hybrid vs mirrored hybrid | 0% | 0.00% | 0.00% | 0 | gosperglidergun@68,4/o1; lwss@115,49/o6; lwss@105,49/o6; rpentomino@71,57/o4; rpentomino@77,49/o4; block@82,63/o0 |
| gun vs owner crossing ships | 0% | 15.28% | 15.28% | 0 | lwss@100,42/o0; lwss@100,49/o0 |
| gun vs late owner glider | 0% | 17.36% | 16.67% | 1 | glider@120,81/o2 |
| mixed gun-led attack vs late owner glider | 0% | 17.36% | 16.67% | 1 | glider@120,81/o2 |

### Ash-only and stationary tail checks

| Hitbox | T | H | Legal 72-cell blocks vs empty winner | Block capture | Gun-led search stationary-resident timeout wins |
| --- | --- | --- | --- | --- | --- |
| 10 | 0.4 | 0 | draw | — | 23 |
| 10 | 0.4 | 8 | draw | — | 23 |
| 10 | 0.4 | 16 | draw | — | 23 |
| 10 | 0.4 | 32 | draw | — | 23 |
| 10 | 0.5 | 0 | draw | — | 31 |
| 10 | 0.5 | 8 | draw | — | 31 |
| 10 | 0.5 | 16 | draw | — | 31 |
| 10 | 0.5 | 32 | draw | — | 31 |
| 10 | 0.6 | 0 | draw | — | 37 |
| 10 | 0.6 | 8 | draw | — | 37 |
| 10 | 0.6 | 16 | draw | — | 37 |
| 10 | 0.6 | 32 | draw | — | 37 |
| 10 | 0.75 | 0 | draw | — | 57 |
| 10 | 0.75 | 8 | draw | — | 57 |
| 10 | 0.75 | 16 | draw | — | 57 |
| 10 | 0.75 | 32 | draw | — | 57 |
| 12 | 0.4 | 0 | draw | — | 34 |
| 12 | 0.4 | 8 | draw | — | 34 |
| 12 | 0.4 | 16 | draw | — | 34 |
| 12 | 0.4 | 32 | draw | — | 34 |
| 12 | 0.5 | 0 | draw | — | 43 |
| 12 | 0.5 | 8 | draw | — | 43 |
| 12 | 0.5 | 16 | draw | — | 43 |
| 12 | 0.5 | 32 | draw | — | 43 |
| 12 | 0.6 | 0 | draw | — | 50 |
| 12 | 0.6 | 8 | draw | — | 50 |
| 12 | 0.6 | 16 | draw | — | 50 |
| 12 | 0.6 | 32 | draw | — | 50 |
| 12 | 0.75 | 0 | draw | — | 62 |
| 12 | 0.75 | 8 | draw | — | 62 |
| 12 | 0.75 | 16 | draw | — | 62 |
| 12 | 0.75 | 32 | draw | — | 62 |
| 14 | 0.4 | 0 | draw | — | 38 |
| 14 | 0.4 | 8 | draw | — | 38 |
| 14 | 0.4 | 16 | draw | — | 38 |
| 14 | 0.4 | 32 | draw | — | 38 |
| 14 | 0.5 | 0 | draw | — | 45 |
| 14 | 0.5 | 8 | draw | — | 45 |
| 14 | 0.5 | 16 | draw | — | 45 |
| 14 | 0.5 | 32 | draw | — | 45 |
| 14 | 0.6 | 0 | draw | — | 53 |
| 14 | 0.6 | 8 | draw | — | 53 |
| 14 | 0.6 | 16 | draw | — | 53 |
| 14 | 0.6 | 32 | draw | — | 53 |
| 14 | 0.75 | 0 | draw | — | 65 |
| 14 | 0.75 | 8 | draw | — | 65 |
| 14 | 0.75 | 16 | draw | — | 65 |
| 14 | 0.75 | 32 | draw | — | 65 |

### Recipes

- **coverage one gun gosperglidergun@51,4/o7** (36 cells): gosperglidergun@51,4/o7
- **coverage one gun gosperglidergun@51,56/o3** (36 cells): gosperglidergun@51,56/o3
- **coverage one gun gosperglidergun@24,4/o0** (36 cells): gosperglidergun@24,4/o0
- **coverage one gun gosperglidergun@24,83/o6** (36 cells): gosperglidergun@24,83/o6
- **coverage 4 LWSS** (36 cells): lwss@4,31/o2; lwss@11,31/o2; lwss@18,31/o2; lwss@25,31/o2
- **coverage 8 LWSS** (72 cells): lwss@12,26/o2; lwss@19,26/o2; lwss@26,26/o2; lwss@33,26/o2; lwss@12,36/o2; lwss@19,36/o2; lwss@26,36/o2; lwss@33,36/o2
- **coverage gun + 4 LWSS** (72 cells): gosperglidergun@51,4/o7; lwss@4,45/o2; lwss@11,39/o2; lwss@18,45/o2; lwss@25,39/o2
- **coverage one glider** (5 cells): glider@52,12/o0
- **coverage 7 gliders** (35 cells): glider@36,4/o7; glider@42,4/o7; glider@36,12/o7; glider@42,12/o7; glider@36,20/o7; glider@42,20/o7; glider@36,28/o7
- **coverage one R-pentomino** (5 cells): rpentomino@52,52/o2
- **coverage two R-pentomino** (10 cells): rpentomino@52,52/o2; rpentomino@44,60/o2
- **coverage 18 blocks (72 cells)** (72 cells): block@4,4/o0; block@11,4/o0; block@18,4/o0; block@25,4/o0; block@32,4/o0; block@39,4/o0; block@4,11/o0; block@11,11/o0; block@18,11/o0; block@25,11/o0; block@32,11/o0; block@39,11/o0; block@4,18/o0; block@11,18/o0; block@18,18/o0; block@25,18/o0; block@32,18/o0; block@39,18/o0
- **4 LWSS + gun** (72 cells): gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2
- **glider escort + gun** (72 cells): gosperglidergun@51,4/o7; lwss@4,43/o2; lwss@14,43/o2; lwss@24,43/o2; glider@54,35/o0; block@50,29/o0
- **growth escort + gun** (68 cells): gosperglidergun@51,4/o7; lwss@4,39/o4; lwss@14,39/o4; rpentomino@54,31/o0; rpentomino@48,23/o0; block@44,37/o0
- **blocks escort + gun** (70 cells): gosperglidergun@51,4/o7; lwss@12,43/o2; lwss@26,43/o2; block@50,35/o0; block@44,35/o0; block@38,35/o0; block@32,35/o0
- **7 gliders + gun** (71 cells): gosperglidergun@51,4/o7; glider@28,58/o3; glider@34,58/o3; glider@28,66/o3; glider@34,66/o3; glider@28,74/o3; glider@34,74/o3; glider@28,82/o3
- **8 LWSS vs upper gun+eater (interference)** (72 cells): lwss@4,44/o2; lwss@11,44/o2; lwss@18,44/o2; lwss@25,44/o2; lwss@4,50/o2; lwss@11,50/o2; lwss@18,50/o2; lwss@25,50/o2
- **8 LWSS vs lower gun+eater** (72 cells): lwss@4,44/o2; lwss@11,44/o2; lwss@18,44/o2; lwss@25,44/o2; lwss@4,50/o2; lwss@11,50/o2; lwss@18,50/o2; lwss@25,50/o2
- **4 LWSS vs block** (36 cells): lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2
- **best 10/0.4/0** (72 cells): gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2
- **best 10/0.4/8** (72 cells): gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2
- **best 10/0.4/16** (72 cells): gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2
- **best 10/0.4/32** (72 cells): gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2
- **best 10/0.5/0** (72 cells): gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2
- **best 10/0.5/8** (72 cells): gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2
- **best 10/0.5/16** (72 cells): gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2
- **best 10/0.5/32** (72 cells): gosperglidergun@51,4/o7; lwss@12,55/o2; lwss@26,49/o2; lwss@40,55/o2; lwss@54,49/o2
- **best 10/0.6/0** (72 cells): gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2
- **best 10/0.6/8** (72 cells): gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2
- **best 10/0.6/16** (72 cells): gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2
- **best 10/0.6/32** (72 cells): gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2
- **best 10/0.75/0** (72 cells): gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2
- **best 10/0.75/8** (72 cells): gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2
- **best 10/0.75/16** (72 cells): gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2
- **best 10/0.75/32** (72 cells): gosperglidergun@51,4/o7; lwss@6,50/o2; lwss@13,44/o2; lwss@20,50/o2; lwss@27,44/o2
- **best 12/0.4/0** (72 cells): gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2
- **best 12/0.4/8** (72 cells): gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2
- **best 12/0.4/16** (72 cells): gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2
- **best 12/0.4/32** (72 cells): gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2
- **best 12/0.5/0** (72 cells): gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2
- **best 12/0.5/8** (72 cells): gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2
- **best 12/0.5/16** (72 cells): gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2
- **best 12/0.5/32** (72 cells): gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2
- **best 12/0.6/0** (72 cells): gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2
- **best 12/0.6/8** (72 cells): gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2
- **best 12/0.6/16** (72 cells): gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2
- **best 12/0.6/32** (72 cells): gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2
- **best 12/0.75/0** (72 cells): gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2
- **best 12/0.75/8** (72 cells): gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2
- **best 12/0.75/16** (72 cells): gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2
- **best 12/0.75/32** (72 cells): gosperglidergun@51,4/o7; lwss@6,49/o2; lwss@13,43/o2; lwss@20,49/o2; lwss@27,43/o2
- **best 14/0.4/0** (72 cells): gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4
- **best 14/0.4/8** (72 cells): gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4
- **best 14/0.4/16** (72 cells): gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4
- **best 14/0.4/32** (72 cells): gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4
- **best 14/0.5/0** (72 cells): gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4
- **best 14/0.5/8** (72 cells): gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4
- **best 14/0.5/16** (72 cells): gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4
- **best 14/0.5/32** (72 cells): gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4
- **best 14/0.6/0** (72 cells): gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4
- **best 14/0.6/8** (72 cells): gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4
- **best 14/0.6/16** (72 cells): gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4
- **best 14/0.6/32** (72 cells): gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4
- **best 14/0.75/0** (72 cells): gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4
- **best 14/0.75/8** (72 cells): gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4
- **best 14/0.75/16** (72 cells): gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4
- **best 14/0.75/32** (72 cells): gosperglidergun@51,4/o7; lwss@10,35/o4; lwss@24,41/o4; lwss@38,35/o4; lwss@52,41/o4
- **recommended defended attack** (72 cells): gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2
- **recommended undefended attack** (72 cells): gosperglidergun@51,4/o7; lwss@12,56/o2; lwss@26,50/o2; lwss@40,56/o2; lwss@54,50/o2

<!-- END GENERATED CAPTURE TABLES -->
