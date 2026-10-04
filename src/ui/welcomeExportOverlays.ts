import { WELCOME_MOODS, welcomeFace } from './welcomeCast';
import { welcomeBeat, welcomeLensTimeline, WELCOME_SHOTS } from './welcomeTimeline';

// CSS ease (.25,.1,.25,1), sampled rather than driven by the browser's wall clock.
export function captionEntrance(seconds: number) {
  const x = Math.max(0, Math.min(1, seconds / 0.45));
  const curve = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;
  let low = 0, high = 1;
  for (let i = 0; i < 24; i++) { const mid = (low + high) / 2; if (curve(mid, 0.25, 0.25) < x) low = mid; else high = mid; }
  return x === 0 || x === 1 ? x : curve((low + high) / 2, 0.1, 1);
}
function lines(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const result: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) { result.push(line); line = word; }
    else line = next;
  }
  if (line) result.push(line);
  return result;
}
/** The DOM/CSS show layers, minus controls/HUD. Lens ink and sparkles are already in Pixi. */
export class WelcomeExportOverlays {
  private faces = WELCOME_MOODS.map((_, i) => welcomeFace(i));
  draw(ctx: CanvasRenderingContext2D, seconds: number, width: number, height: number) {
    const frame = welcomeLensTimeline(seconds, width, height);
    // Same ellipse and stops as .welcome-overlay's radial-gradient.
    ctx.save(); ctx.translate(width / 2, height / 2); ctx.scale(width / 2, height / 2);
    const shade = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.SQRT2);
    shade.addColorStop(0.38, '#65574700'); shade.addColorStop(1, '#65574724');
    ctx.fillStyle = shade; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
    ctx.save(); ctx.globalAlpha = frame.speedAlpha; ctx.scale(width / 1000, height / 1000);
    ctx.strokeStyle = '#8a7d6c'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < 24; i++) {
      const angle = i / 24 * Math.PI * 2, inner = 260 + (i % 4) * 35;
      ctx.beginPath(); ctx.moveTo(500 + Math.cos(angle) * inner, 500 + Math.sin(angle) * inner);
      ctx.quadraticCurveTo(500 + Math.cos(angle + 0.006) * 550, 500 + Math.sin(angle + 0.006) * 550, 500 + Math.cos(angle) * 850, 500 + Math.sin(angle) * 850); ctx.stroke();
    }
    ctx.restore();
    ctx.save(); ctx.globalAlpha = frame.flashAlpha; ctx.fillStyle = '#fffdf6'; ctx.fillRect(0, 0, width, height); ctx.restore();
    const beat = welcomeBeat(seconds), shot = WELCOME_SHOTS[beat];
    const paperWidth = Math.min(700, width - 32), innerWidth = paperWidth - 44;
    ctx.save(); ctx.translate(width / 2, 16); ctx.rotate(-Math.PI / 180); ctx.translate(-paperWidth / 2, 0);
    ctx.font = "700 46px 'Caveat'";
    const caption = lines(ctx, shot.caption, innerWidth);
    const titleHeight = caption.length * 50.6;
    const columns = width < height ? 2 : 4, rowHeight = 48;
    const ruleHeight = beat === 4 ? Math.ceil(4 / columns) * rowHeight : 0;
    const paperHeight = 36 + titleHeight + 8 + ruleHeight;
    ctx.fillStyle = '#00000017'; ctx.beginPath(); ctx.roundRect(4, 6, paperWidth, paperHeight, [12, 4, 14, 5]); ctx.fill();
    ctx.fillStyle = '#fff6c9ed'; ctx.strokeStyle = '#7a6a5c'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.roundRect(0, 0, paperWidth, paperHeight, [12, 4, 14, 5]); ctx.fill(); ctx.stroke();
    ctx.save(); const u = captionEntrance(seconds - shot.start);
    ctx.globalAlpha = u; ctx.translate(22, 18 + 10 * (1 - u)); ctx.rotate(-2 * (1 - u) * Math.PI / 180);
    ctx.fillStyle = '#c4483a'; ctx.textBaseline = 'top';
    caption.forEach((line, i) => ctx.fillText(line, 0, i * 50.6)); ctx.restore();
    if (beat === 4) {
      ctx.font = "17px 'Patrick Hand'"; ctx.fillStyle = '#3b302a'; ctx.textBaseline = 'top';
      WELCOME_MOODS.forEach(({ rule }, i) => {
        const x = 22 + (i % columns) * ((innerWidth + 8) / columns), y = 18 + titleHeight + 8 + Math.floor(i / columns) * rowHeight;
        ctx.drawImage(this.faces[i], x, y, 40, 40);
        const wrapped = lines(ctx, rule, innerWidth / columns - 48);
        wrapped.forEach((line, j) => ctx.fillText(line, x + 43, y + 2 + j * 17.85));
      });
    }
    ctx.restore();
  }
}
