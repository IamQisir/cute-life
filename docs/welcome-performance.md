# Welcome rendering and bake performance

The six shots, 16-second clock, cameras, captions, artwork, music and generation schedule are unchanged. The main view and magnifier consume the same simulation; the lens needs no second bake. Both optimizations on `WorldView` are off by default and enabled/restored by `WelcomeShow`, preserving sandbox and battle visuals (including paused sandbox camera pans).

## Changes by file

| File | Change |
| --- | --- |
| `src/render/dotBitmap.ts` | Pure RGBA rasterizer at three pixels per cell, using the existing outline/nucleus palette and round coverage; palette stamps are computed once per raster. |
| `src/render/world.ts` | Optional single-Sprite dot texture, nearest sampling, source update only on changed state; camera transforms stay per frame, dynamic bounds update correctly and GPU storage only grows. Counts cell sprites and times the main world update. |
| `src/render/visibleClusters.ts` | Select cells inside the camera bounds plus eight cells, cache clusters by state identity/version. |
| `src/render/organisms.ts` | Optional visible selection, cluster timing and sprite count. WorldView continues to call it only while organism alpha is positive. |
| `src/render/util.ts` | SpritePool counts used sprites and hides only previously visible excess sprites. |
| `src/render/perf.ts` | URL-gated panel, rolling fps/median/p95, CPU costs, population, cell-sprite count and decision history. Disabled instrumentation never reads a clock. |
| `src/main.ts` | Initialize `?perf`; measure sandbox/battle simulation and the actual Pixi render call. |
| `src/ui/welcomeBake.ts` | Deterministic frame generator, signed-coordinate/count encoding, decode and Sim-compatible birth/death playback. |
| `src/ui/welcomeBake.worker.ts` | Module worker interleaves both variants at equal generation ages, transferring buffers and reporting compute time/size. |
| `src/ui/welcomeBakeClient.ts` | Partial-frame cache, preferred frame zero first, worker failure handling, cleanup. |
| `src/ui/welcomeQuality.ts` | One-second rolling median; one-way sparkle/small-world/lens decisions with one second of fresh evidence between levels. |
| `src/ui/welcomeShow.ts` | Bake while title is visible, play ready frames or live fallback, keep birth/death records, switch variants only at cuts without resetting their age, terminate worker on skip/completion. |
| `tests/welcomePerformance.test.ts` | Counts for all 154 frames per variant, sampled exact cells/maps/animations, encoding bound, fleet geometry, cluster cache, pixels and quality rules; logs timings. |
| `tests/welcomeBakeClient.test.ts` | Worker-unavailable fallback, partial transferred frames, failure, termination and late-message handling. |
| `tests/worldBitmap.test.ts` | Real Pixi Sprite/Texture invalidation, generation-only uploads, camera transforms, semantic zoom and memory cleanup without a GPU. |
| `tests/welcomeShow.test.ts` | Sustained slow frames exercise the three-level sequence through both cuts. |

## Measurements

Local Node/Vitest measurements; browser CPU/GPU results still need a human pass:

| Piece | Before | After |
| --- | ---: | ---: |
| Full `Sim.advance` / baked playback | 5.85 ms/generation | 2.40 ms/generation |
| Small `Sim.advance` / baked playback | 2.29 ms/generation | 0.94 ms/generation |
| Full-world / visible fleet clustering | 5.31 ms/generation | 0.53 ms/generation |
| Dot positions | up to ~9,000 sprite positions/scales every frame | one Sprite transform every frame; ~3.02 ms rasterization per generation |

At 12 generations/sec and 60 fps, simulation plus clustering in the fleet averages roughly **2.23 → 0.59 ms/frame**, excluding membrane building, animation and rendering. Wide-shot simulation plus bitmap rasterization averages about **1.08 ms/frame**, plus canvas copy/upload/grid/render; the old simulation alone averaged ~1.17 ms/frame plus thousands of per-frame sprite transforms. Generation frames carry the work; these averages are not p95 guarantees. On phones the measured CPU pieces may cost 3–5× more. Creature membrane construction, grids, face animations and GPU submission still need browser measurement.

The emitted worker was exercised in a Node worker-thread harness that supplies the browser worker message interface:

| Variant | Frames | Encoded bytes | MiB | Worker compute time |
| --- | ---: | ---: | ---: | ---: |
| Full | 154 | 23,974,708 | 22.86 | 1,440 ms |
| Small | 154 | 9,913,536 | 9.45 | 570 ms |
| Both | 308 | 33,888,244 | 32.32 | ~2.01 s |

Tests bound the full arrays below 23 MiB and the small arrays below 10 MiB (combined below 33 MiB). Devices that start on the small world (coarse pointer or a short side under 600 px) bake only the small variant (~9.5 MiB), since quality never steps back up. These are exact retained typed-array sizes, not total process/GPU memory. Add transient worker Sets/Maps, one decoded simulation's Sets/Maps and one padded 3px/cell RGBA bitmap/texture. Frames transfer ownership, so they are not copied and retained in both worker and main heaps. All baked arrays are released on skip/completion; bitmap CPU/GPU storage is released when returning to the sandbox. The worker chunk is emitted separately in `dist/assets/welcomeBake.worker-*.js` (~23.92 kB).

## Fallback and quality rules

- Begin does not wait for a worker. If frame zero is missing, build the existing live scene synchronously, then start the 16-second clock and sound in the same gesture stack. This rare early-begin path can still pause briefly during warmup.
- Missing next frames use `Sim.advance`; playback resumes as soon as that variant's next baked frame is available. Both paths keep identical cells, counts, buds, newborn timestamps, deaths and generations. Catch-up is bounded to four generations/frame and retains generation debt rather than skipping identities.
- Worker absent, test/Node context, construction failure or runtime error: live fallback for missing frames. Already received frames remain usable after an error. Terminate and release everything when the show finishes or is skipped.
- Existing touch/small-screen selection starts with the small world and dive. Adaptive levels otherwise begin at Q0. Above a 22 ms rolling median: Q1 removes sparkles; Q2 switches to the small world at the next hard cut (6s or 8s); Q3 disables the lens and uses the dive at a later hard cut. Levels never increase quality. Hidden tabs, zero intervals and gaps ≥250ms do not contribute samples. Scene cuts also invalidate the visible cluster selection if no generation changed.
- Wide dots are deliberately generation-sampled: steady dot colour, round shape and 4.5px texture-size floor match the old drawDot. The min-size stamp is sampled at that generation's zoom and scales with the camera until the next generation. Far dots do not individually pop or leave drifting fade sprites; close-up birth/death animations remain exact. Nearest sampling at 3px/cell is an approximation of the old antialiased dot textures.

## Human check with `?perf`

1. Open `/?perf`, replay the welcome, and wait ~2s on the title before beginning. Confirm both bake-size reports, wide shots with one cell Sprite, zero cluster cost when dots/faces fully replace organisms, and lens cost only during 8–10.5s. `world update` includes clusters; `lens` includes its close-up WorldView. Pixi render measures CPU submission, not GPU completion. Particle/lens costs are zero in normal play.
2. Check fleet membranes, faces, headings and timing at 6–8s; the lens/iris landing, genesis births, close-up fades, and dot palette/minimum size during the reveal. Compare visually with the previous renderer, especially nearest-neighbour dots while zooming. Check median and p95, not only fps.
3. Use CPU throttling or a phone. Confirm sparkle removal after sustained slow frames, population reduction only on a 6s/8s cut, then dive at a later cut, with Q decisions in the panel and no recovery upward. Replay to reset quality.
4. Begin immediately, disable Workers, skip at the gate/mid-show, and replay. Confirm live fallback, stable sound, cleanup and restored sandbox camera/state. Check `?perf` in sandbox/battle too; default dot/cluster options stay off there. Without `?perf`, no panel or profiler timing reads should occur.

Browser visual/perf verification could not run here because this sandbox rejects listening on localhost (`listen EPERM`). TypeScript, all Vitest tests, production build and emitted-worker transfers were verified.
