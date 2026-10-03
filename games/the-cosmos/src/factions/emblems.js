// ============================================================================
// factions/emblems.js - draws a faction's emblem and signs onto any 2D canvas context (client only: a texture painter, the gallery).
// Pure canvas calls, no THREE and no DOM lookups, so a sign texture for a world or a ship decal can reuse it:
//   drawEmblem(ctx, id, cx, cy, size)          the faction's mark, centred, `size` px across
//   drawSign(ctx, id, text, x, y, w, h, kind)  a plate/warning/banner sign lettered in the faction's own fonts
// ============================================================================
import { factionStyle, signStyle, signText } from './registry.js';
import { css } from './_kit/style.js';

const TAU = Math.PI * 2;

function path(ctx, pts, close = true) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); if (close) ctx.closePath(); }

/** Each shape is drawn in a [-1, 1] box with `fg` for the mark and `bg` for the cut-outs; (0,0) is the centre. */
const SHAPES = {
  'seawall'(ctx, fg, bg) {
    ctx.fillStyle = fg;
    path(ctx, [[-0.5, -0.1], [-0.5, -0.75], [-0.32, -0.75], [-0.32, -0.6], [-0.16, -0.6], [-0.16, -0.75], [0.0, -0.75], [0.0, -0.6], [0.16, -0.6], [0.16, -0.75], [0.32, -0.75], [0.32, -0.6], [0.5, -0.6], [0.5, -0.1]]); ctx.fill();
    ctx.fillStyle = bg; path(ctx, [[-0.12, -0.1], [-0.12, -0.38], [0, -0.48], [0.12, -0.38], [0.12, -0.1]]); ctx.fill();
    ctx.strokeStyle = fg; ctx.lineWidth = 0.1; ctx.lineCap = 'round';
    for (const y of [0.18, 0.4, 0.62]) { ctx.beginPath(); for (let i = 0; i <= 20; i++) { const x = -0.8 + 1.6 * i / 20; const yy = y + Math.sin(i * 0.9 + y * 9) * 0.07; i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.stroke(); }
  },
  'rising-chevron'(ctx, fg, bg) {
    ctx.strokeStyle = fg; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.arc(0, 0, 0.86, 0, TAU); ctx.stroke();
    ctx.fillStyle = fg;
    for (const dy of [0.12, -0.28]) path(ctx, [[-0.55, dy + 0.3], [0, dy - 0.25], [0.55, dy + 0.3], [0.55, dy + 0.55], [0, dy], [-0.55, dy + 0.55]]), ctx.fill();
    void bg;
  },
  'wedge'(ctx, fg, bg) {
    ctx.fillStyle = fg; path(ctx, [[-0.85, 0.75], [0, -0.85], [0.85, 0.75], [0.15, 0.75], [0, 0.35], [-0.15, 0.75]]); ctx.fill();
    ctx.fillStyle = bg; path(ctx, [[-0.12, 0.05], [0, -0.28], [0.12, 0.05]]); ctx.fill();
  },
  'dish'(ctx, fg, bg) {
    ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(-0.1, 0.05, 0.62, 0.62, 0.5, Math.PI * 0.2, Math.PI * 1.25, false); ctx.lineTo(-0.1, 0.05); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = fg; ctx.lineWidth = 0.09; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-0.1, 0.05); ctx.lineTo(0.45, 0.7); ctx.stroke();
    for (const r of [0.38, 0.62, 0.86]) { ctx.beginPath(); ctx.arc(0.28, -0.28, r, -1.15, -0.1); ctx.stroke(); }
    void bg;
  },
  'pit-gear'(ctx, fg, bg) {
    ctx.fillStyle = fg; const n = 10, pts = [];
    for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU, r = i % 2 ? 0.62 : 0.86; const b = (i % 2 ? 0.05 : -0.05); pts.push([Math.cos(a + b) * r, Math.sin(a + b) * r]); }
    path(ctx, pts); ctx.fill();
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, 0.38, 0, TAU); ctx.fill();
    ctx.strokeStyle = fg; ctx.lineWidth = 0.13; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-0.55, 0.55); ctx.lineTo(0.55, -0.55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.18, -0.62); ctx.lineTo(0.62, -0.18); ctx.stroke();
  },
  'sun-leaf'(ctx, fg, bg) {
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(0, 0.85); ctx.bezierCurveTo(-0.95, 0.35, -0.6, -0.7, 0.05, -0.85); ctx.bezierCurveTo(0.85, -0.5, 0.75, 0.45, 0, 0.85); ctx.fill();
    ctx.strokeStyle = bg; ctx.lineWidth = 0.07; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0.75); ctx.lineTo(0.05, -0.55); ctx.stroke();
    for (const [a, b] of [[0.2, -0.4], [0.0, -0.15], [-0.2, 0.1]]) { ctx.beginPath(); ctx.moveTo(0.02, a); ctx.lineTo(0.35, b); ctx.moveTo(0.02, a); ctx.lineTo(-0.3, b + 0.05); ctx.stroke(); }
  },
  'glyph-ring'(ctx, fg, bg) {
    ctx.strokeStyle = fg; ctx.lineWidth = 0.14;
    for (let i = 0; i < 3; i++) { const a0 = i / 3 * TAU + 0.18, a1 = (i + 1) / 3 * TAU - 0.18; ctx.beginPath(); ctx.arc(0, 0, 0.74, a0 - Math.PI / 2, a1 - Math.PI / 2); ctx.stroke(); }
    ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(0, 0, 0.34, 0.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, 0.11, 0, TAU); ctx.fill();
  },
  'lantern'(ctx, fg, bg) {
    ctx.strokeStyle = fg; ctx.lineWidth = 0.07; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -0.95); ctx.lineTo(0, -0.62); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -0.68, 0.1, 0, TAU); ctx.stroke();
    ctx.fillStyle = fg; path(ctx, [[-0.3, -0.5], [0.3, -0.5], [0.42, -0.35], [-0.42, -0.35]]); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-0.38, -0.3); ctx.bezierCurveTo(-0.62, 0.1, -0.5, 0.5, -0.3, 0.55); ctx.lineTo(0.3, 0.55); ctx.bezierCurveTo(0.5, 0.5, 0.62, 0.1, 0.38, -0.3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(0, 0.12, 0.16, 0.26, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = fg; path(ctx, [[-0.35, 0.6], [0.35, 0.6], [0.3, 0.72], [-0.3, 0.72]]); ctx.fill();
    ctx.strokeStyle = fg; ctx.beginPath(); ctx.moveTo(-0.9, 0.92); ctx.bezierCurveTo(-0.4, 0.8, 0.3, 1.0, 0.9, 0.86); ctx.stroke();
  },
  'jolly-wrench'(ctx, fg, bg) {
    ctx.strokeStyle = fg; ctx.lineWidth = 0.11; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-0.8, 0.8); ctx.lineTo(0.8, -0.1); ctx.moveTo(0.8, 0.8); ctx.lineTo(-0.8, -0.1); ctx.stroke();
    ctx.fillStyle = fg; // skull from three plates: cranium, cheek plates, jaw
    path(ctx, [[-0.5, -0.1], [-0.42, -0.62], [0, -0.82], [0.42, -0.62], [0.5, -0.1], [0.3, 0.12], [-0.3, 0.12]]); ctx.fill();
    path(ctx, [[-0.3, 0.16], [0.3, 0.16], [0.26, 0.46], [-0.26, 0.46]]); ctx.fill();
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(-0.2, -0.28, 0.12, 0, TAU); ctx.arc(0.2, -0.28, 0.12, 0, TAU); ctx.fill();
    path(ctx, [[-0.05, -0.05], [0.05, -0.05], [0, 0.04]]); ctx.fill();
    ctx.strokeStyle = bg; ctx.lineWidth = 0.04; for (const x of [-0.13, 0, 0.13]) { ctx.beginPath(); ctx.moveTo(x, 0.2); ctx.lineTo(x, 0.44); ctx.stroke(); }
    ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(-0.46, 0.0); ctx.lineTo(0.46, 0.0); ctx.stroke();
  },
  'broken-chain'(ctx, fg, bg) {
    ctx.strokeStyle = fg; ctx.lineWidth = 0.13; ctx.lineJoin = 'round';
    const link = (x, y, w, h, a) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w / 2, -h / 2, w, h, h / 2) : ctx.rect(-w / 2, -h / 2, w, h); ctx.stroke(); ctx.restore(); };
    link(-0.5, 0.35, 0.62, 0.34, -0.5); link(-0.12, 0.05, 0.62, 0.34, -0.5);
    // the open link: a bracket missing its far side, then two loose ends drifting apart
    ctx.beginPath(); ctx.moveTo(0.18, -0.28); ctx.lineTo(0.38, -0.5); ctx.lineTo(0.62, -0.5); ctx.stroke();
    link(0.6, -0.72, 0.4, 0.26, 0.3);
    ctx.fillStyle = bg; void bg;
  },
  'horizon-ring'(ctx, fg, bg) {
    ctx.strokeStyle = fg; ctx.lineWidth = 0.12; ctx.beginPath(); ctx.arc(0, 0, 0.8, 0, TAU); ctx.stroke();
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0, 0, 0.58, 0, Math.PI); ctx.fill();
    ctx.fillStyle = bg; ctx.fillRect(-0.7, -0.02, 1.4, 0.06);
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0.28, -0.3, 0.12, 0, TAU); ctx.fill();
  },
  'none'() {},
};

/** Draw the faction's emblem centred on (cx, cy), `size` pixels across. Missing shapes draw nothing. */
export function drawEmblem(ctx, id, cx, cy, size, o = {}) {
  const e = factionStyle(id).signs.emblem, f = SHAPES[e.shape];
  if (!f) return;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(size / 2, size / 2);
  f(ctx, css(o.fg ?? e.fg), css(o.bg ?? e.bg));
  ctx.restore();
}

/** A sign: a plate, warning or banner lettered the faction's way. (x, y, w, h) in pixels; `text` is cased for the faction; long text shrinks to fit. */
export function drawSign(ctx, id, text, x, y, w, h, kind = 'plate') {
  const s = signStyle(id, kind), t = signText(id, text);
  ctx.save();
  const r = Math.min(w, h) * s.radius;
  ctx.beginPath(); if (ctx.roundRect && r > 0) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  ctx.fillStyle = css(s.bg); ctx.fill();
  ctx.save(); ctx.clip();
  if (s.stripe) { const st = h * 0.2; ctx.fillStyle = css(s.stripe[0]); ctx.fillRect(x, y + h - st, w, st); ctx.fillStyle = css(s.stripe[1]); for (let i = -h; i < w + h; i += st * 2) { ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + st, y + h); ctx.lineTo(x + i + st * 2, y + h - st); ctx.lineTo(x + i + st, y + h - st); ctx.fill(); } }
  ctx.restore();
  if (kind === 'plate') { ctx.lineWidth = Math.max(2, h * 0.05); ctx.strokeStyle = css(s.edge); ctx.beginPath(); if (ctx.roundRect && r > 0) ctx.roundRect(x + 2, y + 2, w - 4, h - 4, r); else ctx.rect(x + 2, y + 2, w - 4, h - 4); ctx.stroke(); }
  if (s.rivets) { ctx.fillStyle = css(s.edge); for (const [rx, ry] of [[0.05, 0.14], [0.95, 0.14], [0.05, 0.86], [0.95, 0.86]]) { ctx.beginPath(); ctx.arc(x + w * rx, y + h * ry, Math.max(2, h * 0.04), 0, TAU); ctx.fill(); } }
  let px = h * 0.46;
  const weight = s.weight, family = s.fontStack;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = css(s.fg);
  const avail = w * 0.86;
  for (let i = 0; i < 8; i++) { ctx.font = `${weight} ${px}px ${family}`; if (ctx.measureText(t).width <= avail) break; px *= 0.86; }
  const hasStripe = !!s.stripe;
  ctx.fillText(t, x + w / 2, y + h * (hasStripe ? 0.4 : 0.5), avail);
  ctx.restore();
}
