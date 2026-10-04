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
