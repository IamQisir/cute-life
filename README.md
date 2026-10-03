# cute life

A cosy, hand-drawn Game of Life on an infinite sheet of paper. Every cell has
feelings, and its face tells you what happens next:

| face | neighbours | next generation |
|---|---|---|
| happy, breathing | 2–3 | survives |
| teary, glancing around | 0–1 | fades (lonely) |
| `> <`, squished, sweating | 4+ | fades (crowded) |
| dotted ring with a sparkle | empty cell with exactly 3 | a cell is born |

Births play music-box notes chosen by position, so repeating patterns play
repeating melodies.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm test
npm run build
```

URL params for demos: `?play`, `?sprinkle`, `?zoom=8`.

## Controls

- click / drag: draw or erase cells
- space: play / pause (hold space + drag to move)
- right- or middle-drag, or the **move** tool: pan
- scroll / pinch: zoom
- enter or N: step · S: sprinkle · R: rotate stamp · Esc: drop stamp

## Layout

- `src/life/` pure simulation (sparse set of live cells) and patterns, unit-tested
- `src/sim.ts` simulation state + animation bookkeeping (births, fades)
- `src/render/` camera, procedural pencil art, PixiJS world view
- `src/audio/` music box and ambient pad (Web Audio, no assets)
- `src/ui/` HTML HUD; `src/input.ts` pointer, wheel, keyboard
