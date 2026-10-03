# Design notes

## Pillars
1. **The face is the rule.** Players should predict the next generation from
   expressions alone, without reading B3/S23.
2. **Hand-made on paper.** Coloured pencil, wobbly lines, handwritten UI.
3. **Shareable.** Every interesting moment should be easy to turn into a GIF or link.

## Milestones
- [x] **M1 Sandbox**: infinite canvas, pan/zoom, mood faces, birth/fade animation,
  buds, stamps, music box + pad
- [ ] **M2 Semantic zoom**: connected components; known patterns become creatures
  (glider = crawling bug, block = sleeping loaf, blinker = blinking eye);
  unknown clusters render as one amoeba; far zoom shows colonies
- [ ] **M3 Share**: pattern encoded in URL, GIF/video export
- [ ] **M4 Red vs blue**: bounded toroidal arena, Immigration rule, turn-based vs AI
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
