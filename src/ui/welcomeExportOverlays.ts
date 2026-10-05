import { captionAt, frameScale, TAGLINE, type TrailerFrame } from './trailer';

const PAPER = '#f2ece0';
const INK = '#3b302a';
const RED = '#c4483a';

/**
 * The trailer's 2D layers over the Pixi frame: vignette, speed lines, flash,
 * slammed captions, the end-card tagline and the final fade to paper.
 * Drawn in logical pixels; the caller may pre-scale the context for HiDPI.
 */
export class WelcomeExportOverlays {
  draw(ctx: CanvasRenderingContext2D, seconds: number, width: number, height: number, frame: TrailerFrame) {
    const s = frameScale(width, height);
    // Vignette: a soft paper-shadow ellipse.
    ctx.save(); ctx.translate(width / 2, height / 2); ctx.scale(width / 2, height / 2);
    const shade = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.SQRT2);
    shade.addColorStop(0.42, '#65574700'); shade.addColorStop(1, '#6557472e');
    ctx.fillStyle = shade; ctx.fillRect(-1, -1, 2, 2); ctx.restore();

    if (frame.speedLines > 0) {
      // Hand-drawn rays from the centre; a little jitter per beat keeps them alive.
      ctx.save(); ctx.globalAlpha = frame.speedLines; ctx.translate(width / 2, height / 2);
      ctx.strokeStyle = '#8a7d6c'; ctx.lineCap = 'round';
      const reach = Math.hypot(width, height) / 2, jitter = Math.floor(seconds * 16);
      for (let i = 0; i < 36; i++) {
        const angle = (i + ((i * 7 + jitter) % 5) * 0.12) / 36 * Math.PI * 2;
        const inner = reach * (0.52 + ((i * 13 + jitter) % 7) * 0.035);
        ctx.lineWidth = (1.5 + (i % 3)) * s;
        ctx.beginPath(); ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
        ctx.lineTo(Math.cos(angle) * reach * 1.05, Math.sin(angle) * reach * 1.05); ctx.stroke();
      }
      ctx.restore();
    }

    const caption = captionAt(seconds);
    if (caption) {
      const size = Math.round((caption.text.length > 14 ? 92 : 118) * s);
      ctx.save();
      ctx.globalAlpha = caption.alpha;
      ctx.translate(width / 2, caption.place === 'centre' ? height * 0.5 : height * 0.8);
      ctx.rotate(caption.rotate - 1.2 * Math.PI / 180);
      ctx.scale(caption.scale, caption.scale);
      ctx.font = `700 ${size}px Caveat`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      // Offset ink shadow, a thick paper outline, then the red letters.
      ctx.fillStyle = '#3b302a33'; ctx.fillText(caption.text, 5 * s, 7 * s);
      ctx.strokeStyle = PAPER; ctx.lineWidth = 18 * s; ctx.strokeText(caption.text, 0, 0);
      ctx.strokeStyle = INK; ctx.lineWidth = 3 * s; ctx.strokeText(caption.text, 0, 0);
      ctx.fillStyle = RED; ctx.fillText(caption.text, 0, 0);
      ctx.restore();
    }

    if (frame.tagline > 0) {
      ctx.save();
      ctx.globalAlpha = frame.tagline;
      const size = Math.round(Math.min(46 * s, width / 26));
      ctx.font = `${size}px 'Patrick Hand'`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // Below the title: the letters span y −15…16 in world cells.
      const y = height / 2 + (24 - frame.camera.y) * frame.camera.zoom + (1 - frame.tagline) * 10 * s;
      ctx.lineJoin = 'round'; ctx.strokeStyle = PAPER; ctx.lineWidth = 10 * s;
      ctx.strokeText(TAGLINE.text, width / 2, y);
      ctx.fillStyle = INK; ctx.fillText(TAGLINE.text, width / 2, y);
      ctx.restore();
    }

    if (frame.flash > 0) {
      ctx.save(); ctx.globalAlpha = frame.flash; ctx.fillStyle = '#fffdf6'; ctx.fillRect(0, 0, width, height); ctx.restore();
    }
    if (frame.paperFade > 0) {
      ctx.save(); ctx.globalAlpha = frame.paperFade; ctx.fillStyle = PAPER; ctx.fillRect(0, 0, width, height); ctx.restore();
    }
  }
}
