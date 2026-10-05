// Self-hosted handwriting fonts (bundled into /assets, no Google Fonts request).
import '@fontsource/caveat/500.css';
import '@fontsource/caveat/700.css';
import '@fontsource/patrick-hand/400.css';
import { Application, Graphics, UPDATE_PRIORITY } from 'pixi.js';
import { MusicBox } from './audio/musicBox';
import { fromChallengeHash, fromReplayHash } from './battle/challenge';
import { BattleMode, type Opponent } from './battle/mode';
import { attachInput } from './input';
import { key, keyX, keyY, toList } from './life/engine';
import { introPoints, pickIntroPicture } from './life/introArt';
import {
  Library,
  type StampStorage,
  cleanName,
  fromStampHash,
  patternFromRle,
  patternToRle,
  rowsFromPoints,
  toStampHash,
} from './life/library';
import { type Pattern, placePattern } from './life/patterns';
import { ArenaView } from './render/arenaView';
import { Camera } from './render/camera';
import { type FollowTarget, followTarget } from './render/follow';
import { createFollowState, updateFollow } from './render/followController';
import { pointBounds, shouldFrameStamp } from './render/framing';
import { TerritoryView } from './render/territoryView';
import { WorldView } from './render/world';
import { perf } from './render/perf';
import { fromHash, toHash } from './share/link';
import { Recorder, type Recording } from './share/recorder';
import { Sim } from './sim';
import { BattleHud } from './ui/battleHud';
import type { CardHandlers } from './ui/patternCard';
import { SelectionMenu, type StampEntry, openImportDialog, openStampOffer } from './ui/stamps';
import { Hud } from './ui/hud';
import { Onboarding } from './ui/onboarding';
import { WelcomeShow } from './ui/welcomeShow';

const POPULATION_CAP = 25000;
const MAX_RECORD_SECONDS = 15;
/** A recorded battle replay: long enough for a large arena at 8 gen/s plus the slow finale. */
const MAX_BATTLE_RECORD_SECONDS = 60;
const RECORD_GEN_PER_SEC = 8;
const RESULT_HOLD_MS = 2000;
const MANUAL_CAMERA_GRACE_MS = 400;
/** Links longer than this still work, but some apps truncate them. */
const LONG_LINK = 8000;
const POST_TEXT = 'my little cells are growing 🌱 #cutelife #GameOfLife';

async function main() {
  const stage = document.getElementById('stage')!;
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: '#f2ece0',
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  stage.appendChild(app.canvas);
  perf.init();
  // Measure the actual synchronous Pixi render call (CPU submission, not GPU completion).
  if (perf.enabled) {
    const render = app.renderer.render.bind(app.renderer);
    app.renderer.render = ((...args: unknown[]) => {
      const timing = perf.start();
      const result = Reflect.apply(render, app.renderer, args);
      perf.end('Pixi render', timing);
      perf.finish(performance.now());
      return result;
    }) as typeof app.renderer.render;
  }

  const sim = new Sim();
  const cam = new Camera();
  const view = new WorldView();
  const audio = new MusicBox();
  app.stage.addChild(view.root);

  let playing = false;
  let genPerSec = 4;
  let lastStep = 0;
  let hand = false;
  let pattern: Pattern | null = null;
  let rotation = 0;
  let hover: [number, number] | null = null;
  let started = false;
  let lastPopAt = 0;
  let mode: 'sandbox' | 'battle' = 'sandbox';
  let battleStarted = false;
  let sandboxCam = { x: 0, y: 0, zoom: 40 };
  let recordingReplay = false;
  let selecting = false;
  /** The camera keeps the body of the population in view until the player takes over. */
  let following = true;
  let followState = createFollowState();
  let followHinted = false;
  let introShown = false;
  /** A one-off stamp glide, independent of the player's follow setting. */
  let stampAim: FollowTarget | null = null;
  let lastManualCamera = -Infinity;
  /** null outside sandbox recording; otherwise the setting to restore. */
  let recordedFollowing: boolean | null = null;
  /** Selection box in cells (inclusive), while the select tool is in use. */
  let selection: { x0: number; y0: number; x1: number; y1: number } | null = null;

  const syncAnim = () => {
    sim.animMs = Math.min(420, (1000 / genPerSec) * 0.9);
  };

  const hud = new Hud(document.getElementById('hud')!, {
    wakeCell(index) {
      if (audio.mode !== 'all') return;
      audio.unlock();
      audio.pop(index + 1, 0);
    },
    togglePlay,
    step: stepOnce,
    shuffle,
    clear() {
      introShown = false;
      stampAim = null;
      followState = createFollowState();
      sim.clear(performance.now());
      forgetSharedLink();
      setPlaying(false);
      refreshStatus();
    },
    setSpeed(v) {
      genPerSec = v;
      syncAnim();
    },
    toggleSound() {
      audio.unlock();
      hud.setSound(audio.cycleMode());
    },
    toggleHand,
    toggleRecord,
    openHelp,
    share() {
      if (mode === 'battle') shareReplay();
      else copyLink();
    },
    setMode(nextMode) {
      if (nextMode === mode) return;
      if (nextMode === 'sandbox') exitBattle();
      else enterBattle();
    },
    cardDrag: {
      pick: () => {},
      drag: (p, x, y) => cardDrag.drag(p, x, y),
      drop: (p, x, y) => cardDrag.drop(p, x, y),
    },
    toggleFollow() {
      if (recordedFollowing === null) setFollowing(!following);
    },
    toggleSelect() {
      setSelecting(!selecting);
      if (selecting) hud.toast('drag a box to save a stamp ~ settings → select turns it off');
    },
    pickPattern(p) {
      selectPattern(p);
      if (p) hud.toast('click to place ~ R rotates ~ shift+click keeps stamping');
    },
  });

  const welcome = new WelcomeShow({
    sim, cam, playing: () => playing, following: () => following,
    setPlaying, setFollowing, refreshStatus,
  }, { stage: app.stage, renderer: app.renderer, view, audio, soundChanged: () => hud.setSound(audio.mode) });
  const onboarding = new Onboarding(() => mode, welcome);

  /** Shared entry point for the help button and the future title-cell action. */
  function openHelp() {
    onboarding.openHelp();
  }

  import.meta.hot?.dispose(() => hud.dispose());

  function refreshStatus() {
    hud.setStatus(sim.generation, sim.population);
  }

  function setPlaying(on: boolean) {
    playing = on;
    hud.setPlaying(on);
    lastStep = performance.now();
  }

  function togglePlay() {
    audio.unlock();
    setPlaying(!playing);
    if (playing) onboarding.played();
  }

  function toggleHand() {
    hand = !hand;
    hud.setHand(hand);
  }

  function advance() {
    observeFollow();
    const born = sim.advance(performance.now());
    observeFollow();
    audio.births(born.map((k) => [keyX(k), keyY(k)]));
    refreshStatus();
    if (sim.population > POPULATION_CAP) {
      setPlaying(false);
      hud.toast("whew, it's getting crowded in here! (paused)", 4000);
    } else if (sim.population === 0 && playing) {
      setPlaying(false);
      hud.toast('everyone drifted off... draw some new friends?', 4000);
    }
  }

  function stepOnce() {
    audio.unlock();
    setPlaying(false);
    advance();
  }

  function shuffle() {
    audio.unlock();
    clearIntro(performance.now());
    // Sprinkle a random soup over the middle of the view.
    const w = Math.min(60, Math.floor(cam.w / cam.zoom * 0.6));
    const h = Math.min(40, Math.floor(cam.h / cam.zoom * 0.6));
    const cx = Math.floor(cam.x);
    const cy = Math.floor(cam.y);
    const pts: [number, number][] = [];
    for (let x = cx - (w >> 1); x < cx + (w >> 1); x++) {
      for (let y = cy - (h >> 1); y < cy + (h >> 1); y++) {
        if (Math.random() < 0.3) pts.push([x, y]);
      }
    }
    sim.addMany(pts, performance.now());
    followState = createFollowState();
    forgetSharedLink();
    refreshStatus();
  }

  function clearIntro(now: number) {
    if (!introShown) return;
    introShown = false;
    // Sim.clear reuses the renderer's drifting/dissolving death animation.
    sim.clear(now);
    followState = createFollowState();
  }

  function stampPoints(x: number, y: number): [number, number][] {
    if (!pattern) return [];
    let pts = placePattern(pattern, 0, 0);
    for (let i = 0; i < rotation; i++) pts = pts.map(([px, py]) => [-py, px]);
    return pts.map(([px, py]) => [px + x, py + y]);
  }

  /** The current stamp, shown highlighted in whichever palette is visible. */
  function selectPattern(p: Pattern | null) {
    if (p !== pattern) rotation = 0;
    pattern = p;
    hud.setPattern(p);
  }

  /** Drop the current stamp at a cell, in whichever mode is active. */
  function placeStampAt(x: number, y: number, keep: boolean) {
    if (!pattern) return;
    const pts = stampPoints(x, y);
    if (mode === 'battle') {
      const problem = battle.placeStamp(pts, performance.now());
      if (problem === 'zone') hud.toast('keep it inside your zone ~');
      else if (problem === 'budget') hud.toast('not enough cells left for that one');
      else audio.pop(x, y);
    } else {
      const now = performance.now();
      clearIntro(now);
      sim.addMany(pts, now);
      stampAim = null;
      followState = createFollowState();
      const bounds = pointBounds(pts);
      const [left, top] = cam.toWorld(0, 0);
      const [right, bottom] = cam.toWorld(cam.w, cam.h);
      // Shift+click keeps stamping: hold the camera still for a run of stamps.
      if (bounds && !keep && now - lastManualCamera >= MANUAL_CAMERA_GRACE_MS && recordedFollowing === null
        && shouldFrameStamp(bounds, { left, top, right, bottom })) {
        stampAim = cameraTarget(pts.map(([px, py]) => key(px, py)), false);
      }
      forgetSharedLink();
      audio.pop(x, y);
      refreshStatus();
    }
    if (!keep) selectPattern(null);
  }

  // Dragging a palette card onto the canvas (the canvas fills the window, so
  // client coordinates are canvas coordinates).
  const cardDrag: CardHandlers = {
    pick(p) {
      selectPattern(pattern === p ? null : p);
    },
    drag(p, cx, cy) {
      audio.unlock();
      if (pattern !== p) selectPattern(p);
      hover = cam.cellAt(cx, cy);
    },
    drop(p, cx, cy) {
      if (pattern !== p) selectPattern(p);
      if (document.elementFromPoint(cx, cy) === app.canvas) {
        const [x, y] = cam.cellAt(cx, cy);
        placeStampAt(x, y, false);
      } else {
        selectPattern(null);
      }
      hover = null;
    },
  };

  // ---- sharing -------------------------------------------------------------

  const icon = WorldView.portrait('happy', 0);
  const favicon = document.createElement('link');
  favicon.rel = 'icon';
  favicon.href = icon.toDataURL();
  document.head.append(favicon);
  function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const size = Math.max(18, Math.round(h * 0.045));
    ctx.save();
    ctx.font = `700 ${size}px Caveat, cursive`;
    ctx.textBaseline = 'alphabetic';
    const pad = size * 0.6;
    const label = 'cute life';
    const tw = ctx.measureText(label).width;
    const iconSize = size * 1.5;
    ctx.globalAlpha = 0.92;
    ctx.drawImage(icon, w - pad - tw - iconSize * 0.95, h - pad - iconSize * 0.8, iconSize, iconSize);
    ctx.fillStyle = '#c4483a';
    ctx.fillText(label, w - pad - tw, h - pad);
    ctx.font = `500 ${Math.round(size * 0.8)}px Caveat, cursive`;
    ctx.fillStyle = '#7a6a5c';
    const status =
      mode === 'battle'
        ? `${battle.cfg.garden ? 'flowers' : 'territory'} red ${battle.sim.points.red} · blue ${battle.sim.points.blue} · generation ${battle.sim.generation}`
        : `generation ${sim.generation} · ${sim.population} cells`;
    ctx.fillText(status, pad, h - pad);
    ctx.restore();
  }

  const recorder = new Recorder(app.canvas, {
    maxSeconds: MAX_RECORD_SECONDS,
    maxWidth: 1280,
    overlay: drawWatermark,
    audio: () => audio.stream,
  });
  let clipUrl = '';
  let shownSecond = -1;

  /** Builds a link to the current scene. Leaves the address bar alone. */
  async function shareLink(): Promise<string> {
    const hash = await toHash({ points: toList(sim.cells), cam: { x: cam.x, y: cam.y, zoom: cam.zoom } });
    return location.origin + location.pathname + hash;
  }

  /**
   * The visitor changed a scene opened from a share link: drop the hash so a
   * reload doesn't snap back to it. Just playing keeps it as the starting point.
   */
  function forgetSharedLink() {
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }

  function copyLink() {
    if (sim.population === 0) {
      hud.toast('draw some cells first, then share them!');
      return;
    }
    return copyText(shareLink(), (link) =>
      link.length > LONG_LINK ? 'link copied! (it is a big one)' : 'link copied ~ paste it anywhere!');
  }

  async function onRecorded(r: Recording) {
    restoreRecordedFollow();
    hud.setRecording(null, MAX_RECORD_SECONDS);
    shownSecond = -1;
    if (recordingReplay) {
      recordingReplay = false;
      battle.slowFinale = false;
      recorder.setLimit(MAX_RECORD_SECONDS);
    }
    if (clipUrl) URL.revokeObjectURL(clipUrl);
    clipUrl = URL.createObjectURL(r.blob);
    // Prepare the URL before showing the result so its post button opens synchronously.
    const battleLink = mode === 'battle' ? battle.replayLink() : null;
    const text = battleLink ? resultText() : POST_TEXT;
    const url = battleLink ?? (sim.population ? await shareLink() : location.origin + location.pathname);
    hud.showResult(clipUrl, r.ext, {
      download() {
        const a = document.createElement('a');
        a.href = clipUrl;
        a.download = `cute-life-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${r.ext}`;
        a.click();
      },
      copyLink,
      post() {
        const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        window.open(intent, '_blank', 'noopener');
      },
    });
  }

  function toggleRecord() {
    if (recorder.recording) {
      recorder.stop();
      restoreRecordedFollow();
      return;
    }
    audio.unlock();
    hud.closeResult();
    if (!recorder.start(onRecorded)) {
      hud.toast("sorry, this browser can't record video");
      return;
    }
    if (mode === 'sandbox') {
      recordedFollowing = following;
      setFollowing(true);
      stampAim = null;
      lastManualCamera = -Infinity;
      observeFollow();
      if (followState.aim) Object.assign(cam, offsetAim(followState.aim));
    }
    if (mode === 'sandbox' && !playing && sim.population > 0) setPlaying(true);
    hud.setRecording(0, MAX_RECORD_SECONDS);
  }

  function restoreRecordedFollow() {
    if (recordedFollowing === null) return;
    const previous = recordedFollowing;
    recordedFollowing = null;
    setFollowing(previous);
  }

  async function copyText(text: string | Promise<string>, ok: string | ((text: string) => string)) {
    const pendingText = Promise.resolve(text);
    const done = async () => hud.toast(typeof ok === 'string' ? ok : ok(await pendingText));
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        // Safari needs write() during the gesture, before awaiting compression.
        const blob = pendingText.then((value) => new Blob([value], { type: 'text/plain' }));
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
          return await done();
        } catch {
          // Some browsers reject promised ClipboardItems; plain text may still work.
        }
      }
      await navigator.clipboard.writeText(await pendingText);
      await done();
    } catch {
      window.prompt('copy this link:', await pendingText);
    }
  }

  // ---- battle --------------------------------------------------------------

  const territoryView = new TerritoryView();
  const arenaView = new ArenaView();
  view.underlay.addChild(territoryView.root, arenaView.root);
  let framedPhase = '';
  const battle = new BattleMode({
    changed() {
      battleHud.render(battle);
      syncPalette();
      // Panels change with the phase, so the free space for the arena does too.
      if (battle.phase !== 'deploy' && pattern) selectPattern(null);
      if (mode === 'battle' && battle.phase !== framedPhase) fitArena();
    },
    births: (pts) => audio.births(pts),
    resized: () => fitArena(),
    finished(outcome) {
      battleHud.render(battle);
      audio.fanfare(outcome.youWon !== false);
      if (recordingReplay) {
        // Linger on the final board for a moment, then stop the clip.
        setTimeout(() => recorder.recording && recorder.stop(), RESULT_HOLD_MS);
      }
    },
  });
  const battleHud = new BattleHud(document.getElementById('hud')!, {
    ready: () => {
      audio.unlock();
      battle.ready(performance.now());
    },
    random: () => battle.randomArmy(performance.now()),
    clear: () => battle.clearArmy(performance.now()),
    setStars: (s) => battle.setStars(s),
    challenge(name) {
      const link = battle.challengeLink(name.trim() || undefined);
      if (link) copyText(link, 'challenge link copied! send it to a friend ~');
    },
    editArmy: () => battle.editArmy(performance.now()),
    replay: () => battle.replay(performance.now()),
    vsAi: () => {
      forgetSharedLink();
      battle.start({ kind: 'ai', stars: 3 }, performance.now());
    },
    shareReplay,
    postResult() {
      const link = battle.replayLink();
      if (!link) return;
      const intent = `https://x.com/intent/post?text=${encodeURIComponent(resultText())}&url=${encodeURIComponent(link)}`;
      window.open(intent, '_blank', 'noopener');
    },
    recordReplay,
    togglePause: () => battle.togglePause(),
    finishNow: () => battle.finishNow(performance.now()),
    setSpeed: (v) => (battle.genPerSec = v),
  }, hud.palette);
  battleHud.show(false);

  /** The shared palette: budget-greyed and only active while deploying in a battle. */
  function syncPalette() {
    const deploying = mode === 'battle' && battle.phase === 'deploy';
    hud.setBudget(deploying ? battle.budgetLeft : null);
    hud.setPaletteActive(mode === 'sandbox' || deploying);
  }

  function resultText(): string {
    const o = battle.outcome;
    const opp = battle.opponent;
    const score = o ? ` ${o.red} : ${o.blue}` : '';
    if (o?.youWon && opp.kind === 'ai') return `my cell army beat the ${'★'.repeat(opp.stars)} AI${score} 🦠 #cutelife`;
    if (o?.youWon && opp.kind === 'challenge') return `I beat ${opp.name || 'a friend'}'s cell army${score} 🦠 #cutelife`;
    return `watch these cell armies fight${score} 🦠 #cutelife`;
  }

  function shareReplay() {
    const link = battle.replayLink();
    if (link) copyText(link, 'replay link copied ~ anyone can watch this battle!');
    else hud.toast('finish a battle first, then share the replay!');
  }

  /** Frame the arena between the battle title and the bottom controls. */
  /** Frame the arena in the space the HUD panels leave free. */
  function fitArena() {
    const { width, height } = battle.cfg;
    framedPhase = battle.phase;
    const a = battleHud.freeArea(cam.w, cam.h);
    cam.zoom = Math.max(4, Math.min((a.right - a.left) / width, (a.bottom - a.top) / height));
    battle.sim.fitZoom = cam.zoom;
    const cx = (a.left + a.right) / 2;
    const cy = (a.top + a.bottom) / 2;
    cam.x = width / 2 - (cx - cam.w / 2) / cam.zoom;
    cam.y = height / 2 - (cy - cam.h / 2) / cam.zoom;
  }

  function enterBattle(opponent?: Opponent) {
    const t = performance.now();
    stampAim = null;
    if (mode === 'sandbox') {
      sandboxCam = { x: cam.x, y: cam.y, zoom: cam.zoom };
      setPlaying(false);
    }
    selectPattern(null);
    setSelecting(false);
    mode = 'battle';
    hud.setMode('battle');
    battleHud.show(true);
    framedPhase = '';
    const keepStars = battle.opponent.kind === 'ai' ? battle.opponent.stars : 3;
    // Coming back from the sandbox resumes an unfinished battle; a finished one starts afresh.
    if (opponent || !battleStarted || battle.phase === 'result') {
      battleStarted = true;
      battle.start(opponent ?? { kind: 'ai', stars: keepStars }, t);
    } else {
      syncPalette();
      fitArena();
    }
    onboarding.modeChanged();
  }

  function exitBattle() {
    selectPattern(null);
    mode = 'sandbox';
    syncPalette();
    hud.setMode('sandbox');
    battleHud.show(false);
    hud.closeResult();
    Object.assign(cam, sandboxCam);
    if (fromChallengeHash(location.hash) || fromReplayHash(location.hash)) forgetSharedLink();
    onboarding.modeChanged();
  }

  function recordReplay() {
    if (recorder.recording) return;
    audio.unlock();
    if (!recorder.start(onRecorded)) {
      hud.toast("sorry, this browser can't record video");
      return;
    }
    // The whole battle in one clip, slowing down for the last generations.
    recordingReplay = true;
    recorder.setLimit(MAX_BATTLE_RECORD_SECONDS);
    battle.genPerSec = RECORD_GEN_PER_SEC;
    battle.slowFinale = true;
    hud.setRecording(0, recorder.limit);
    battle.replay(performance.now());
  }

  // ---- custom stamps -------------------------------------------------------

  // localStorage can be missing or throw (private mode, blocked site data):
  // the library then just works in memory.
  const storage: StampStorage = {
    get(k) {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* keep working in memory */
      }
    },
  };
  const library = new Library(storage);
  /** Stable Pattern objects per stamp id, so "is this the selected stamp" works by identity. */
  const stampPatterns = new Map<string, Pattern>();
  const stampCell = WorldView.portrait('happy', 0);

  function stampEntries(): StampEntry[] {
    return library.list().map((c) => {
      let p = stampPatterns.get(c.id);
      if (!p || p.name !== c.name) {
        p = { name: c.name, rows: c.rows };
        stampPatterns.set(c.id, p);
      }
      return { id: c.id, pattern: p };
    });
  }

  function refreshStamps() {
    const entries = stampEntries();
    hud.setStamps(entries, {
      cards: cardDrag,
      share(id) {
        const s = library.list().find((c) => c.id === id);
        if (s) copyText(location.origin + location.pathname + toStampHash(s.name, s.rows), `link to "${s.name}" copied ~`);
      },
      remove(id) {
        const s = library.list().find((c) => c.id === id);
        if (!s || !window.confirm(`delete the stamp "${s.name}"?`)) return;
        if (pattern === stampPatterns.get(id)) selectPattern(null);
        library.remove(id);
        stampPatterns.delete(id);
        refreshStamps();
      },
      importStamp: () => openImportDialog(importStamp),
    });
    syncPalette();
  }

  /** Add a stamp and report what happened. Returns an error message, or null. */
  function addStamp(name: string, rows: string[]): string | null {
    const res = library.add(name, rows);
    if ('error' in res) {
      return res.error === 'full'
        ? 'your stamp book is full (48): delete one first'
        : res.error === 'too-big'
          ? 'too big for a stamp (max 400 cells, 64×64)'
          : 'there are no cells in it';
    }
    refreshStamps();
    hud.toast(res.duplicate ? `you already have that one: "${res.pattern.name}"` : `added "${res.pattern.name}" to my stamps`);
    return null;
  }

  function importStamp(text: string, name: string): string | null {
    const t = text.trim();
    const parsed = t.includes('stamp=') ? fromStampHash(t.slice(t.indexOf('#'))) : patternFromRle(t, name);
    if (!parsed) return "couldn't read that: paste RLE or a stamp link";
    return addStamp(name.trim() || parsed.name, parsed.rows);
  }

  // ---- canvas selection (sandbox) ------------------------------------------

  const selectionGfx = new Graphics();
  app.stage.addChild(selectionGfx);
  const selectionMenu = new SelectionMenu(document.getElementById('hud')!, {
    save(name) {
      const rows = rowsFromPoints(selectedPoints());
      if (!rows) {
        hud.toast(selectedPoints().length ? 'too big for a stamp (max 400 cells, 64×64)' : 'there are no cells in the box');
        return;
      }
      if (addStamp(name, rows) === null) setSelecting(false);
    },
    copyRle(name) {
      const rows = rowsFromPoints(selectedPoints());
      if (rows) copyText(patternToRle(rows, cleanName(name) || undefined), 'RLE copied ~');
      else hud.toast('there are no cells in the box');
    },
    close: () => clearSelection(),
  });

  function selectedPoints(): [number, number][] {
    if (!selection) return [];
    const pts: [number, number][] = [];
    for (let y = selection.y0; y <= selection.y1; y++) {
      for (let x = selection.x0; x <= selection.x1; x++) if (sim.cells.has(key(x, y))) pts.push([x, y]);
    }
    return pts;
  }

  /** Just below-right of the selection box, in screen pixels. */
  function menuSpot(): [number, number] {
    if (!selection) return [0, 0];
    const [sx, sy] = cam.toScreen(selection.x1 + 1, selection.y1 + 1);
    return [sx + 8, sy + 8];
  }

  function clearSelection() {
    selection = null;
    selectionMenu.hide();
  }

  function setSelecting(on: boolean) {
    selecting = on;
    hud.setSelect(on);
    if (on) {
      selectPattern(null);
      if (hand) toggleHand();
    } else {
      clearSelection();
    }
  }

  function setFollowing(on: boolean) {
    if (following !== on) followState = createFollowState();
    following = on;
    hud.setFollow(on);
  }

  function followViewport() {
    // The mobile palette is a bottom strip; desktop leaves space on the left.
    const narrow = cam.w <= 720;
    return { width: Math.max(1, cam.w - (narrow ? 40 : 260)),
      height: Math.max(1, cam.h - (narrow ? 300 : 200)),
      offsetX: narrow ? 0 : 110, offsetY: narrow ? 70 : 30 };
  }

  function offsetAim(aim: FollowTarget): FollowTarget {
    const { offsetX, offsetY } = followViewport();
    return { x: aim.x - offsetX / aim.zoom, y: aim.y + offsetY / aim.zoom, zoom: aim.zoom };
  }

  function cameraTarget(cells: Iterable<number>, bodyOnly = true): FollowTarget | null {
    const { width, height } = followViewport();
    const aim = followTarget(cells, width, height, 6, bodyOnly);
    return aim ? offsetAim(aim) : null;
  }

  function observeFollow() {
    if (!following || mode !== 'sandbox') return;
    const { width, height } = followViewport();
    followState = updateFollow(followState, sim.cells, sim.generation, width, height);
  }

  /** Continue following from an already framed stamp or restored camera. */
  function holdCameraAim() {
    const { offsetX, offsetY } = followViewport();
    followState = createFollowState({ x: cam.x + offsetX / cam.zoom,
      y: cam.y - offsetY / cam.zoom, zoom: cam.zoom });
  }

  function glideCamera(aim: FollowTarget, k: number) {
    cam.x += (aim.x - cam.x) * k;
    cam.y += (aim.y - cam.y) * k;
    cam.zoom += (aim.zoom - cam.zoom) * k;
    if (Math.hypot(aim.x - cam.x, aim.y - cam.y) * cam.zoom < 0.1
      && Math.abs(aim.zoom - cam.zoom) < aim.zoom * 0.0001) Object.assign(cam, aim);
  }

  /** Stamp glides also run while paused; population follow runs while playing/recording. */
  function followStep() {
    if (mode !== 'sandbox' || performance.now() - lastManualCamera < MANUAL_CAMERA_GRACE_MS) return;
    if (stampAim) {
      glideCamera(stampAim, 0.06);
      if (Math.hypot(stampAim.x - cam.x, stampAim.y - cam.y) * cam.zoom < 0.5
        && Math.abs(stampAim.zoom - cam.zoom) < 0.05) {
        Object.assign(cam, stampAim);
        stampAim = null;
        holdCameraAim();
      }
      return;
    }
    if (!following || (!playing && recordedFollowing === null) || sim.population === 0) return;
    const recording = recordedFollowing !== null;
    observeFollow();
    if (!followState.aim) return;
    glideCamera(offsetAim(followState.aim), recording ? 0.025 : 0.06);
  }

  function drawSelection() {
    const g = selectionGfx;
    g.clear();
    if (!selection || mode !== 'sandbox') return;
    const [x0, y0] = cam.toScreen(selection.x0, selection.y0);
    const [x1, y1] = cam.toScreen(selection.x1 + 1, selection.y1 + 1);
    g.rect(x0, y0, x1 - x0, y1 - y0).fill({ color: 0xe0a640, alpha: 0.12 });
    const corners: [number, number][] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    for (let e = 0; e < 4; e++) {
      const [ax, ay] = corners[e];
      const [bx, by] = corners[(e + 1) % 4];
      const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 8));
      for (let i = 0; i < n; i += 2) {
        g.moveTo(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n).lineTo(
          ax + ((bx - ax) * Math.min(n, i + 1)) / n,
          ay + ((by - ay) * Math.min(n, i + 1)) / n,
        );
      }
    }
    g.stroke({ width: 2, color: 0xb07a1e, alpha: 0.9 });
    selectionMenu.move(...menuSpot());
  }

  attachInput(app.canvas, {
    cam,
    paint(x, y, value) {
      const now = performance.now();
      if (mode === 'battle') {
        const painted = battle.paint(x, y, now, value);
        if (painted !== null && now - lastPopAt > 90) {
          if (painted) audio.pop(x, y);
          else audio.poof();
          lastPopAt = now;
        }
        return painted ?? false;
      }
      const v = value ?? !sim.has(x, y);
      if (sim.set(x, y, v, now)) {
        // Drawing consumes the intro without clearing it, so later stamps
        // cannot wipe out the player's own cells.
        introShown = false;
        stampAim = null;
        followState = createFollowState();
        forgetSharedLink();
        if (now - lastPopAt > 90) {
          if (v) audio.pop(x, y);
          else audio.poof();
          lastPopAt = now;
        }
        refreshStatus();
      }
      return v;
    },
    stamp(x, y, keep) {
      if (!pattern) return false;
      placeStampAt(x, y, keep);
      return true;
    },
    hasStamp: () => pattern !== null && (mode === 'sandbox' || battle.phase === 'deploy'),
    isSelect: () => mode === 'sandbox' && selecting,
    select(from, to, done) {
      selection = {
        x0: Math.min(from[0], to[0]),
        y0: Math.min(from[1], to[1]),
        x1: Math.max(from[0], to[0]),
        y1: Math.max(from[1], to[1]),
      };
      if (done) selectionMenu.show(...menuSpot(), selectedPoints().length);
      else selectionMenu.hide();
    },
    isHand: () => hand,
    onFirstGesture() {
      audio.unlock();
      if (!started) {
        started = true;
        hud.dismissHint();
      }
    },
    togglePlay() {
      if (mode === 'sandbox') return togglePlay();
      audio.unlock();
      if (battle.phase === 'deploy') battle.ready(performance.now());
      else battle.togglePause();
    },
    step() {
      if (mode === 'sandbox') stepOnce();
      else battle.ready(performance.now());
    },
    shuffle() {
      if (mode === 'sandbox') shuffle();
      else battle.randomArmy(performance.now());
    },
    toggleHand,
    cancelStamp() {
      selectPattern(null);
      clearSelection();
    },
    rotateStamp() {
      rotation = (rotation + 1) % 4;
    },
    setHover(c) {
      hover = c;
    },
    manualCamera() {
      if (mode !== 'sandbox') return;
      stampAim = null;
      followState = createFollowState();
      lastManualCamera = performance.now();
      if (!following || recordedFollowing !== null) return;
      setFollowing(false);
      if (!followHinted) {
        followHinted = true;
        hud.toast('camera is yours now ~ press follow to let it track the cells again');
      }
    },
  });

  // Parse every link before seeding: stamp/challenge/replay are handled later.
  const now = performance.now();
  const shared = await fromHash(location.hash);
  const offered = fromStampHash(location.hash);
  const challenge = fromChallengeHash(location.hash);
  const replayLink = fromReplayHash(location.hash);
  introShown = !shared && !offered && !challenge && !replayLink;
  if (shared) sim.addMany(shared.points, now);
  else if (introShown) sim.addMany(introPoints(pickIntroPicture()), now);
  refreshStatus();
  hud.setSound(audio.mode);
  hud.setFollow(following);
  syncAnim();

  const onResize = () => {
    cam.w = app.screen.width;
    cam.h = app.screen.height;
    cam.zoom = Math.max(28, Math.min(56, Math.min(cam.w, cam.h) / 14));
    view.resize(cam.w, cam.h);
  };
  onResize();
  if (introShown) {
    observeFollow();
    if (followState.aim) Object.assign(cam, offsetAim(followState.aim));
  }
  if (shared?.cam) {
    cam.x = shared.cam.x;
    cam.y = shared.cam.y;
    cam.zoom = shared.cam.zoom;
    holdCameraAim();
  }
  window.addEventListener('resize', () => {
    cam.w = app.screen.width;
    cam.h = app.screen.height;
    view.resize(cam.w, cam.h);
    if (mode === 'battle') fitArena();
  });

  app.ticker.add(() => {
    const t = performance.now();
    perf.begin(t);
    if (perf.enabled) {
      perf.cells = (mode === 'battle' && !welcome.active ? battle.sim : sim).cells.size;
      if (!welcome.active) perf.quality = mode;
    }
    if (welcome.active) {
      welcome.update(t);
      selectionGfx.clear();
      territoryView.update(cam, null);
      arenaView.update(cam, null, { showZones: [] });
      view.update(welcome.renderTime(t), sim, cam, null, true);
      return;
    }
    if (playing && t - lastStep >= 1000 / genPerSec) {
      lastStep = t;
      const timing = perf.start();
      advance();
      perf.end('sim/bake playback', timing);
    }
    if (mode === 'battle') {
      const timing = perf.start();
      battle.update(t);
      perf.end('sim/bake playback', timing);
      selectionGfx.clear();
      territoryView.update(cam, battle.sim);
      arenaView.update(cam, battle.layout(), battle.arenaState());
      let ghost = null;
      if (pattern && hover && battle.phase === 'deploy') {
        const points = stampPoints(hover[0], hover[1]);
        ghost = { points, team: battle.myTeam, invalid: battle.stampProblem(points) !== null };
      }
      view.update(t, battle.sim, cam, ghost, battle.phase === 'deploy');
      return;
    }
    territoryView.update(cam, null);
    arenaView.update(cam, null, { showZones: [] });
    followStep();
    drawSelection();
    sim.prune(t);
    const stamp = pattern && hover ? { points: stampPoints(hover[0], hover[1]) } : null;
    view.update(t, sim, cam, stamp, true);
  });

  // Runs after Pixi renders (LOW priority), while the WebGL frame is still readable.
  app.ticker.add(() => {
    if (!recorder.recording) return;
    recorder.captureFrame();
    const sec = Math.floor(recorder.elapsed);
    if (sec !== shownSecond && recorder.recording) {
      shownSecond = sec;
      hud.setRecording(sec, recorder.limit);
    }
  }, undefined, UPDATE_PRIORITY.UTILITY);

  refreshStamps();
  // A stamp link offers to add the stamp to "my stamps".
  if (offered) {
    const p: Pattern = { name: offered.name || 'shared stamp', rows: offered.rows };
    openStampOffer(p, stampCell, () => addStamp(p.name, p.rows), () => {});
    forgetSharedLink();
  }

  // Challenge and replay links open straight into a battle.
  if (challenge) {
    enterBattle({ kind: 'challenge', army: challenge.army, name: challenge.name, size: challenge.size ?? 'small', rules: challenge.rules ?? 'garden' });
    hud.toast(`${challenge.name || 'someone'} challenged you! deploy your blue army ~`, 5000);
  } else if (replayLink) {
    enterBattle({ kind: 'replay', red: replayLink.red, blue: replayLink.blue, size: replayLink.size ?? 'small', rules: replayLink.rules ?? 'garden' });
  }

  // ?play starts running immediately, ?zoom=N sets pixels per cell; handy for demos and screenshots.
  const params = new URLSearchParams(location.search);
  if (params.has('zoom')) cam.zoom = Number(params.get('zoom')) || cam.zoom;
  if (params.has('sprinkle')) shuffle();
  if (params.has('play')) setPlaying(true);

  // Developer-only trailer tools, loaded on demand.
  const introHost = {
    sim, cam, playing: () => playing, following: () => following,
    setPlaying, setFollowing, refreshStatus,
  };
  const introPresentation = { stage: app.stage, renderer: app.renderer, view, audio, soundChanged: () => hud.setSound(audio.mode) };
  if (params.has('render-intro')) {
    const { mountIntroExporter } = await import('./ui/welcomeExporter');
    mountIntroExporter(app, introHost, introPresentation);
  } else if (params.has('intro-preview')) {
    const { mountTrailerPreview } = await import('./ui/trailerPreview');
    mountTrailerPreview(app, introHost, introPresentation);
  } else onboarding.start(Boolean(shared || offered || challenge || replayLink));

  // Handy for debugging and for future screenshot tooling.
  Object.assign(window, { cuteLife: { sim, cam, togglePlay, stepOnce, battle, enterBattle } });
}

main();
