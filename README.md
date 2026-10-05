# cute life

[![CI](https://github.com/IamQisir/cute-life/actions/workflows/ci.yml/badge.svg)](https://github.com/IamQisir/cute-life/actions/workflows/ci.yml)

A cosy, hand-drawn Game of Life on an infinite sheet of paper, where every cell
has feelings. **[Play it in your browser →](https://cute-life.iamqisir.workers.dev)**

https://github.com/user-attachments/assets/6cb9051a-d2a5-44ac-abd3-7289c2a99f0e

## Four little rules

Each cell's face tells you what happens next:

| face | neighbours | next generation |
|---|---|---|
| happy, breathing | 2–3 | survives |
| teary, glancing around | 0–1 | fades (lonely) |
| `> <`, squished, sweating | 4+ | fades (crowded) |
| dotted ring with a sparkle | empty cell with exactly 3 | a cell is born |

Zoom out and groups of interacting cells merge into organisms: sleepers
(still lifes), dancers (oscillators), travellers (gliders, spaceships) and
blobs whose face shows how the group feels. Births play music-box notes chosen
by position, so repeating patterns play repeating melodies over a quiet pad.

## Modes

Pick a mode from the menu at the top.

- **sandbox**: draw cells, drop famous structures and watch them grow.
- **garden battle**: red vs blue. Secretly deploy your army in your half of
  the field within a cell budget, then both armies come alive at once.
  Newborn cells take the colour of most of their parents, and your cells
  plant flowers in the central garden as they pass. Whoever has more flowers
  wins; the battle ends when one side dies out or at the generation limit.
  Play the AI (1–5 stars) on a big (80×56) or huge (120×72) arena, send a
  friend a **challenge link**, or share a **replay link** of any battle.
- **crystal siege**: coming soon; see [the spec](docs/specs/crystal-siege.md).

First-time visitors get the intro and an optional tour; **help** brings the
tour and the current mode's rules back. The two sleepy cells in the bottom
corners wake up when poked and have tips to share.

## Stamps, sharing and recording

- **Stamps**: the palette holds 46 famous structures from LifeWiki in
  collapsible categories (still lifes, oscillators, spaceships, methuselahs,
  guns, puffers & rakes, infinite growth, reflectors). Click one to hold it,
  or drag it onto the board. **R** rotates and **F** flips the held stamp.
- **My stamps**: turn on **select** (in settings) and drag a box over some
  cells to save them, or **+ import** RLE (e.g. from LifeWiki). Your stamps
  are saved in this browser, show up in the sandbox and battle palettes, and
  can be shared as a link.
- **Share** copies a link that reopens your exact scene.
- **Record** saves a short MP4 (up to 15 s, or 60 s in a battle) with sound
  and a watermark, ready to post.
- **Follow** lets the camera track the action on its own.
- URL params for demos: `?play`, `?sprinkle`, `?zoom=8`.

## Controls

- click / drag: draw or erase cells
- space: play / pause (hold space and drag to move)
- right- or middle-drag, the **move** tool (**H**), or arrow keys: pan
- scroll, pinch, or **+** / **−**: zoom
- enter or **N**: step · **S**: sprinkle
- **R** / **F**: rotate / flip the held stamp · **Esc**: drop it
- settings: sound (on → music only → off), select tool, move tool

Works with a mouse or a touchscreen.

## Run locally

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # vitest
npm run build    # type-check + production build into dist/
```

Every push to `main` deploys to Cloudflare Workers (static assets from
`dist/`), and every pull request gets a preview URL.

## Layout

- `src/life/` pure simulation (sparse set of live cells), the pattern
  catalog, `clusters.ts` (grouping + pattern recognition in all phases and
  symmetries), `library.ts` custom stamps (RLE import/export, storage, links)
- `src/sim.ts` simulation state + animation bookkeeping (births, fades)
- `src/render/` camera, follow camera, procedural pencil art, PixiJS world
  view, `organisms.ts` mid-zoom view, arena and territory views
- `src/audio/` music box, ambient pad and the trailer score (Web Audio, no
  audio files)
- `src/battle/` arena rules, AI, challenge/replay links, battle flow;
  `siege/` the Crystal Siege simulation and its headless experiments
- `src/share/` scene links (compressed) and the video recorder
- `src/ui/` HTML HUD, palette, onboarding, intro and corner cells;
  `src/input.ts` pointer, wheel, keyboard
- `docs/` design notes and specs; `scripts/` experiment runners; `tests/`
  unit tests

## Credits

Fonts: [Caveat](https://fonts.google.com/specimen/Caveat) and
[Patrick Hand](https://fonts.google.com/specimen/Patrick+Hand), SIL Open Font
License 1.1, self-hosted via [Fontsource](https://fontsource.org).

Patterns: the famous structures in `src/life/catalog/` are RLE files from the
[LifeWiki](https://conwaylife.com/wiki/) pattern collection (author and source
kept in each file's `#O` / `#C` lines), mirrored by
[copy.sh/life](https://copy.sh/life/). Each one's behaviour (period, speed,
emitted gliders) is verified against this engine in `tests/catalog.test.ts`.
