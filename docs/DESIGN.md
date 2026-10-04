# Design notes

## Pillars
1. **The face is the rule.** Players should predict the next generation from
   expressions alone, without reading B3/S23.
2. **Hand-made on paper.** Coloured pencil, wobbly lines, handwritten UI.
3. **Shareable.** Every interesting moment should be easy to turn into a GIF or link.

## Milestones
- [x] **M1 Sandbox**: infinite canvas, pan/zoom, mood faces, birth/fade animation,
  buds, stamps, music box + pad
- [x] **M2 Semantic zoom**: cells within Chebyshev distance 2 (i.e. that can
  influence a shared cell) form one organism with a shared hatched membrane.
  Families: still lifes sleep (lavender, "z"), oscillators dance (yellow, notes),
  spaceships travel (mint, speed lines, face leads), blobs (blue) show the
  majority mood; big colonies grow several small faces. Zoom bands:
  >=17 cells, 13-17 crossfade, 4-13 organisms, <4 dots.
  Per-pattern creature art (block = loaf etc.) is deferred to M5
- [x] **M3 Share**: `share` copies a link with the pattern as standard Life RLE
  plus camera in the hash (`#v=1&p=...`); opening it restores the scene.
  `record` captures up to 15 s of MP4 (H.264, WebM fallback) at <=1280 px with
  the music box audio and a handwritten watermark; the result popup offers
  save / copy link / post on X. No GIF on purpose: X converts GIFs to video,
  GIF's 256 colours ruin the pencil texture, and it has no sound
- [x] **M4 Red vs blue**: simultaneous hidden deployment, then watch. 32x24
  toroidal arena, 20 cells each, Immigration rule (newborns take the majority
  colour of their 3 parents), 150 generations, more cells wins. Opponents: AI
  (1-5 stars = how many candidate deployments it simulates) and challenge links
  (async PvP with no server). Battles are deterministic, so replay links
  reproduce any battle exactly. Organisms are off in battles (their colours
  mean "kind of pattern", which would clash with team colours)
  - v3 (after playtesting): one 56x40 arena (smaller ones felt pointless; kept
    only to replay old links). Central 10x10 garden is the only score; the
    battle ends at the first extinction. While watching, same-team cells form
    team-coloured creatures; zooming in crossfades to cells (thresholds are
    relative to the framed zoom, 1.25x-1.6x). Links carry a rules version.
- [ ] **M5 Art swap**: AI-generated body sprites (faceless) replace procedural bodies;
  faces stay procedural so expressions compose freely
- [ ] **M6 Identity tracking**: match components across generations so creatures
  animate continuously

## Technical decisions
- Live cells are stored in a `Set<number>` of packed coordinates; cost scales with
  population, not world size. Population cap 25k pauses the sim with a note.
- Art is drawn once into 128px canvases (4 palettes x 2 body variants x 5 moods)
  and used as mipmapped textures. Body and face are drawn separately so bodies
  can be replaced by generated art later.
- Below 14 px/cell faces are unreadable, so cells render as dots (LOD).
- Cell colour comes from a hash of position: decorative only in the sandbox;
  in M4 colour will mean team.
