# cute life

[![CI](https://github.com/IamQisir/cute-life/actions/workflows/ci.yml/badge.svg)](https://github.com/IamQisir/cute-life/actions/workflows/ci.yml)

A cosy, hand-drawn Game of Life on an infinite sheet of paper. Every cell has
feelings, and its face tells you what happens next:

| face | neighbours | next generation |
|---|---|---|
| happy, breathing | 2–3 | survives |
| teary, glancing around | 0–1 | fades (lonely) |
| `> <`, squished, sweating | 4+ | fades (crowded) |
| dotted ring with a sparkle | empty cell with exactly 3 | a cell is born |

Zoom out and groups of interacting cells merge into organisms: sleepers
(still lifes), dancers (oscillators), travellers (gliders, spaceships) and
blobs whose face shows how the group feels.

Births play music-box notes chosen by position, so repeating patterns play
repeating melodies.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm test
npm run build
```

Battle: press **battle!**, secretly deploy 50 red cells (drag structures from
the palette), then watch your creatures fight a blue army on a 56×40 arena.
Grow into the central garden: whoever colours more flowers wins, and the battle
ends as soon as one side wilts. Zoom in to see the individual cells. Play the
AI (1-5 stars), send a **challenge link** to a friend, or share a **replay
link** of any battle.

Share: **share** copies a link that reopens your exact scene; **record**
saves a short MP4 (with sound and a watermark) ready to post.

URL params for demos: `?play`, `?sprinkle`, `?zoom=8`.

## Controls

- click / drag: draw or erase cells
- space: play / pause (hold space + drag to move)
- right- or middle-drag, or the **move** tool: pan
- scroll / pinch: zoom
- enter or N: step · S: sprinkle · R: rotate stamp · Esc: drop stamp

## Layout

- `src/life/` pure simulation (sparse set of live cells), patterns, and
  `clusters.ts` (grouping + pattern recognition in all phases/symmetries), unit-tested
- `src/sim.ts` simulation state + animation bookkeeping (births, fades)
- `src/render/` camera, procedural pencil art, PixiJS world view, `organisms.ts` mid-zoom view
- `src/audio/` music box and ambient pad (Web Audio, no assets)
- `src/battle/` arena rules, AI, challenge/replay links, battle flow
- `src/ui/` HTML HUD; `src/input.ts` pointer, wheel, keyboard

## Credits

Fonts: [Caveat](https://fonts.google.com/specimen/Caveat) and
[Patrick Hand](https://fonts.google.com/specimen/Patrick+Hand), SIL Open Font
License 1.1, self-hosted via [Fontsource](https://fontsource.org).
