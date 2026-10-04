// Self-hosted handwriting fonts (bundled into /assets, no Google Fonts request).
import '@fontsource/caveat/500.css';
import '@fontsource/caveat/700.css';
import '@fontsource/patrick-hand/400.css';
import { Application, UPDATE_PRIORITY } from 'pixi.js';
import { MusicBox } from './audio/musicBox';
import { fromChallengeHash, fromReplayHash } from './battle/challenge';
import { BattleMode, type Opponent } from './battle/mode';
import { attachInput } from './input';
import { keyX, keyY, toList } from './life/engine';
import { PATTERNS, type Pattern, placePattern } from './life/patterns';
import { ArenaView } from './render/arenaView';
import { Camera } from './render/camera';
import { TerritoryView } from './render/territoryView';
import { WorldView } from './render/world';
import { fromHash, toHash } from './share/link';
import { Recorder, type Recording } from './share/recorder';
import { Sim } from './sim';
import { BattleHud } from './ui/battleHud';
import { Hud } from './ui/hud';

const POPULATION_CAP = 25000;
const MAX_RECORD_SECONDS = 15;
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
  let sandboxCam = { x: 0, y: 0, zoom: 40 };
  let recordingReplay = false;

  const syncAnim = () => {
    sim.animMs = Math.min(420, (1000 / genPerSec) * 0.9);
  };

  const hud = new Hud(document.getElementById('hud')!, {
    togglePlay,
    step: stepOnce,
    shuffle,
    clear() {
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
    share() {
      if (mode === 'battle') shareReplay();
      else copyLink();
    },
    toggleBattle() {
      if (mode === 'battle') exitBattle();
      else enterBattle();
    },
    pickPattern(p) {
      pattern = p;
      rotation = 0;
      hud.setPattern(p);
      if (p) hud.toast('click to place ~ R rotates ~ shift+click keeps stamping');
    },
  });

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
  }

  function toggleHand() {
    hand = !hand;
    hud.setHand(hand);
  }

  function advance() {
    const born = sim.advance(performance.now());
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
    forgetSharedLink();
    refreshStatus();
  }

  function stampPoints(x: number, y: number): [number, number][] {
    if (!pattern) return [];
    let pts = placePattern(pattern, 0, 0);
    for (let i = 0; i < rotation; i++) pts = pts.map(([px, py]) => [-py, px]);
    return pts.map(([px, py]) => [px + x, py + y]);
  }

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
        ? `territory red ${battle.sim.territory.red} · blue ${battle.sim.territory.blue} · generation ${battle.sim.generation}`
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
  function shareLink(): string {
    const hash = toHash({ points: toList(sim.cells), cam: { x: cam.x, y: cam.y, zoom: cam.zoom } });
    return location.origin + location.pathname + hash;
  }

  /**
   * The visitor changed a scene opened from a share link: drop the hash so a
   * reload doesn't snap back to it. Just playing keeps it as the starting point.
   */
  function forgetSharedLink() {
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }

  async function copyLink() {
    if (sim.population === 0) {
      hud.toast('draw some cells first, then share them!');
      return;
    }
    const link = shareLink();
    try {
      await navigator.clipboard.writeText(link);
      hud.toast(link.length > LONG_LINK ? 'link copied! (it is a big one)' : 'link copied ~ paste it anywhere!');
    } catch {
      window.prompt('copy this link:', link);
    }
  }

  function onRecorded(r: Recording) {
    hud.setRecording(null, MAX_RECORD_SECONDS);
    shownSecond = -1;
    if (recordingReplay) {
      recordingReplay = false;
      battle.genPerSec = 8;
    }
    if (clipUrl) URL.revokeObjectURL(clipUrl);
    clipUrl = URL.createObjectURL(r.blob);
    hud.showResult(clipUrl, r.ext, {
      download() {
        const a = document.createElement('a');
        a.href = clipUrl;
        a.download = `cute-life-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${r.ext}`;
        a.click();
      },
      copyLink,
      post() {
        const battleLink = mode === 'battle' ? battle.replayLink() : null;
        const url = battleLink ?? (sim.population ? shareLink() : location.origin + location.pathname);
        const text = battleLink ? resultText() : POST_TEXT;
        const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        window.open(intent, '_blank', 'noopener');
      },
    });
  }

  function toggleRecord() {
    if (recorder.recording) {
      recorder.stop();
      return;
    }
    audio.unlock();
    hud.closeResult();
    if (!recorder.start(onRecorded)) {
      hud.toast("sorry, this browser can't record video");
      return;
    }
    if (mode === 'sandbox' && !playing && sim.population > 0) setPlaying(true);
    hud.setRecording(0, MAX_RECORD_SECONDS);
  }

  async function copyText(text: string, ok: string) {
    try {
      await navigator.clipboard.writeText(text);
      hud.toast(ok);
    } catch {
      window.prompt('copy this link:', text);
    }
  }

  // ---- battle --------------------------------------------------------------

  const territoryView = new TerritoryView();
  const arenaView = new ArenaView();
  view.underlay.addChild(territoryView.root, arenaView.root);
  let framedPhase = '';
  const battle = new BattleMode({
    changed() {
      // Deployment needs room for more controls below the arena than the battle does.
      const deploying = battle.phase === 'deploy' || battle.phase === 'thinking';
      if (mode === 'battle' && String(deploying) !== framedPhase) fitArena();
      battleHud.render(battle);
    },
    births: (pts) => audio.births(pts),
    resized: () => fitArena(),
    finished(outcome) {
      battleHud.render(battle);
      audio.fanfare(outcome.youWon !== false);
      if (recordingReplay) {
        // Linger on the final board for a moment, then stop the clip.
        setTimeout(() => recorder.recording && recorder.stop(), 1500);
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
    setSize: (size) => battle.setSize(size, performance.now()),
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
  });
  battleHud.show(false);

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
  function fitArena() {
    const { width, height } = battle.cfg;
    // Room for title + scoreboard above; below, deployment has sizes, stars,
    // buttons and the challenge row, while the battle only has one row.
    const deploying = battle.phase === 'deploy' || battle.phase === 'thinking';
    framedPhase = String(deploying);
    const top = cam.w < 720 ? 170 : 150;
    const bottom = deploying ? 210 : 90;
    cam.zoom = Math.max(6, Math.min((cam.w - 32) / width, (cam.h - top - bottom) / height));
    cam.x = width / 2;
    cam.y = height / 2 - (top - bottom) / 2 / cam.zoom;
  }

  function enterBattle(opponent?: Opponent) {
    const t = performance.now();
    if (mode === 'sandbox') {
      sandboxCam = { x: cam.x, y: cam.y, zoom: cam.zoom };
      setPlaying(false);
      pattern = null;
      hud.setPattern(null);
    }
    mode = 'battle';
    hud.setMode('battle');
    battleHud.show(true);
    fitArena();
    const keepStars = battle.opponent.kind === 'ai' ? battle.opponent.stars : 3;
    battle.start(opponent ?? { kind: 'ai', stars: keepStars }, t);
  }

  function exitBattle() {
    mode = 'sandbox';
    hud.setMode('sandbox');
    battleHud.show(false);
    hud.closeResult();
    Object.assign(cam, sandboxCam);
    if (fromChallengeHash(location.hash) || fromReplayHash(location.hash)) forgetSharedLink();
  }

  function recordReplay() {
    if (recorder.recording) return;
    audio.unlock();
    if (!recorder.start(onRecorded)) {
      hud.toast("sorry, this browser can't record video");
      return;
    }
    // Fast enough that the whole battle fits in one clip.
    recordingReplay = true;
    battle.genPerSec = 14;
    hud.setRecording(0, MAX_RECORD_SECONDS);
    battle.replay(performance.now());
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
      sim.addMany(stampPoints(x, y), performance.now());
      forgetSharedLink();
      audio.pop(x, y);
      refreshStatus();
      if (!keep) {
        pattern = null;
        hud.setPattern(null);
      }
      return true;
    },
    hasStamp: () => mode === 'sandbox' && pattern !== null,
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
      pattern = null;
      hud.setPattern(null);
    },
    rotateStamp() {
      rotation = (rotation + 1) % 4;
    },
    setHover(c) {
      hover = c;
    },
  });

  // A shared link restores its pattern; otherwise start with a few friends
  // so the first screen already says hello.
  const now = performance.now();
  const byName = (n: string) => PATTERNS.find((p) => p.name === n)!;
  const shared = fromHash(location.hash);
  if (shared) sim.addMany(shared.points, now);
  else sim.addMany(
    [
      ...placePattern(byName('glider'), -6, -1),
      ...placePattern(byName('blinker'), 5, -2),
      ...placePattern(byName('beacon'), 1, 4),
      [8, 3], [9, 3], [8, 4], [9, 4], // a sleepy block
      [-9, 6],
    ],
    now,
  );
  refreshStatus();
  hud.setSound(audio.mode);
  syncAnim();

  const onResize = () => {
    cam.w = app.screen.width;
    cam.h = app.screen.height;
    cam.zoom = Math.max(28, Math.min(56, Math.min(cam.w, cam.h) / 14));
    view.resize(cam.w, cam.h);
  };
  onResize();
  if (shared?.cam) {
    cam.x = shared.cam.x;
    cam.y = shared.cam.y;
    cam.zoom = shared.cam.zoom;
  }
  window.addEventListener('resize', () => {
    cam.w = app.screen.width;
    cam.h = app.screen.height;
    view.resize(cam.w, cam.h);
    if (mode === 'battle') fitArena();
  });

  app.ticker.add(() => {
    const t = performance.now();
    if (playing && t - lastStep >= 1000 / genPerSec) {
      lastStep = t;
      advance();
    }
    if (mode === 'battle') {
      battle.update(t);
      territoryView.update(cam, battle.sim);
      arenaView.update(cam, battle.layout(), battle.arenaState());
      view.update(t, battle.sim, cam, null, battle.phase === 'deploy');
      return;
    }
    territoryView.update(cam, null);
    arenaView.update(cam, null, { showZones: [] });
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
      hud.setRecording(sec, MAX_RECORD_SECONDS);
    }
  }, undefined, UPDATE_PRIORITY.UTILITY);

  // Challenge and replay links open straight into a battle.
  const challenge = fromChallengeHash(location.hash);
  const replayLink = fromReplayHash(location.hash);
  if (challenge) {
    enterBattle({ kind: 'challenge', army: challenge.army, name: challenge.name, size: challenge.size ?? 'small' });
    hud.toast(`${challenge.name || 'someone'} challenged you! deploy your blue army ~`, 5000);
  } else if (replayLink) {
    enterBattle({ kind: 'replay', red: replayLink.red, blue: replayLink.blue, size: replayLink.size ?? 'small' });
  }

  // ?play starts running immediately, ?zoom=N sets pixels per cell; handy for demos and screenshots.
  const params = new URLSearchParams(location.search);
  if (params.has('zoom')) cam.zoom = Number(params.get('zoom')) || cam.zoom;
  if (params.has('sprinkle')) shuffle();
  if (params.has('play')) setPlaying(true);

  // Handy for debugging and for future screenshot tooling.
  Object.assign(window, { cuteLife: { sim, cam, togglePlay, stepOnce, battle, enterBattle } });
}

main();
