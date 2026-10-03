// ============================================================================
// factions/_kit/style.js - the shape of a faction style, and the small colour helpers every style uses.
// Pure data and arithmetic: no three.js, no DOM (the validator, the server and the gallery all import it).
//
// A style is `src/factions/<id>/style.js`, default export. Colours are 0xRRGGBB integers everywhere (the same form the ships,
// the ports and personRig's looks already use), so nothing has to be parsed.
// ============================================================================

/** Roles a uniform can be asked for. A style names the ones it has; every style has at least `worker`, `civilian`, `leader`. */
export const ROLES = ['worker', 'civilian', 'guard', 'officer', 'pilot', 'trader', 'leader'];

/** Emblem shapes the gallery (and any sign painter) can draw: see emblems.js. */
export const EMBLEM_SHAPES = ['seawall', 'rising-chevron', 'wedge', 'dish', 'pit-gear', 'sun-leaf', 'glyph-ring', 'lantern', 'jolly-wrench', 'broken-chain', 'horizon-ring', 'none'];

/** What kind of thing a style describes. `faction` has people, buildings and ships; `neutral` is Mars; `alien` is a ship look only. */
export const KINDS = ['faction', 'neutral', 'alien'];

export const hexToRgb = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
export const rgbToHex = (r, g, b) => (Math.max(0, Math.min(255, Math.round(r))) << 16) | (Math.max(0, Math.min(255, Math.round(g))) << 8) | Math.max(0, Math.min(255, Math.round(b)));
export const css = (h) => '#' + (h >>> 0).toString(16).padStart(6, '0');
/** Linear blend of two colours, t = 0 gives a, t = 1 gives b. */
export const mixHex = (a, b, t) => { const x = hexToRgb(a), y = hexToRgb(b); return rgbToHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); };
export const shadeHex = (h, k) => { const c = hexToRgb(h); return rgbToHex(c[0] * k, c[1] * k, c[2] * k); };
/** WCAG relative luminance and contrast ratio (1 to 21). A sign's text must clear 3.0 against its plate (large lettering). */
export const luminance = (h) => { const [r, g, b] = hexToRgb(h).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const la = luminance(a), lb = luminance(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };

const isHex = (v) => Number.isInteger(v) && v >= 0 && v <= 0xffffff;
const isStr = (v, n = 1) => typeof v === 'string' && v.trim().length >= n;
const isArr = (v, n = 1) => Array.isArray(v) && v.length >= n;

/**
 * Everything wrong with a style, in words (an empty list is a good style). The registry throws on a bad one at load, so a style that
 * is missing a field never reaches the gallery or a builder.
 */
export function validateStyle(s) {
  const bad = [];
  if (!s || typeof s !== 'object') return ['the style is not an object'];
  const need = (cond, msg) => { if (!cond) bad.push(msg); };
  need(isStr(s.id) && /^[a-z0-9-]+$/.test(s.id), 'id: lower case, digits and dashes');
  need(isStr(s.name), 'name');
  need(KINDS.includes(s.kind), `kind: one of ${KINDS.join(', ')}`);
  need(isStr(s.tagline, 12), 'tagline: one plain line (12+ characters)');
  need(isStr(s.ethos, 40), 'ethos: what the look says about the people (40+ characters)');
  const P = s.palette || {};
  for (const k of ['primary', 'secondary', 'accent', 'trim', 'dark', 'light']) need(isHex(P[k]), `palette.${k}: a 0xRRGGBB colour`);
  need(isArr(P.extra, 0) || P.extra === undefined, 'palette.extra: a list of colours');
  for (const c of P.extra || []) need(isHex(c), 'palette.extra: every entry a 0xRRGGBB colour');
  const L = s.lights || {};
  for (const k of ['ambient', 'work', 'signal']) need(isHex(L[k]), `lights.${k}: a colour`);
  need(isArr(s.materials, 3), 'materials: at least three presets');
  for (const m of s.materials || []) {
    need(isStr(m.id) && isStr(m.name) && isHex(m.color) && m.roughness >= 0 && m.roughness <= 1 && m.metalness >= 0 && m.metalness <= 1, `material ${m && m.id}: id, name, color, roughness 0..1, metalness 0..1`);
    need(isStr(m.use, 6), `material ${m && m.id}: say what it is used for`);
  }
  const G = s.signs || {};
  need(isStr(G.font) && isStr(G.fontStack), 'signs.font and signs.fontStack');
  need(G.plate && isHex(G.plate.bg) && isHex(G.plate.fg) && isHex(G.plate.edge), 'signs.plate: bg, fg, edge');
  if (G.plate && isHex(G.plate.bg) && isHex(G.plate.fg)) need(contrast(G.plate.bg, G.plate.fg) >= 3, `signs.plate: lettering must have contrast 3 or more (is ${contrast(G.plate.bg, G.plate.fg).toFixed(2)})`);
  need(G.warning && isHex(G.warning.bg) && isHex(G.warning.fg), 'signs.warning: bg, fg');
  if (G.warning && isHex(G.warning.bg) && isHex(G.warning.fg)) need(contrast(G.warning.bg, G.warning.fg) >= 3, 'signs.warning: lettering must have contrast 3 or more');
  need(G.emblem && EMBLEM_SHAPES.includes(G.emblem.shape) && isHex(G.emblem.fg) && isHex(G.emblem.bg) && isStr(G.emblem.meaning, 12), `signs.emblem: shape (${EMBLEM_SHAPES.join(', ')}), fg, bg, meaning`);
  need(G.numbering && isStr(G.numbering.pattern) && isStr(G.numbering.example), 'signs.numbering: pattern and example');
  need(isArr(G.places, 3) && isArr(G.slogans, 3), 'signs.places and signs.slogans: at least three of each (the comedy lives here)');
  need(isArr(G.graffiti, 2), 'signs.graffiti: at least two');
  if (s.kind !== 'alien') {
    const U = s.uniforms || {};
    for (const r of ['worker', 'civilian', 'leader']) need(U[r] && isHex(U[r].cloth) && isHex(U[r].trim) && isStr(U[r].note, 12), `uniforms.${r}: cloth, trim, note`);
    for (const [r, u] of Object.entries(U)) {
      need(ROLES.includes(r), `uniforms.${r}: unknown role`);
      if (u && u.helmet) need(isHex(u.helmet.shell) && isHex(u.helmet.trim) && isHex(u.helmet.visorTint), `uniforms.${r}.helmet: shell, trim, visorTint`);
    }
    need(isArr(s.hair, 3) && s.hair.every(isHex), 'hair: at least three colours');
    const A = s.architecture || {};
    need(isStr(A.massing, 20) && isStr(A.roofs, 8) && isStr(A.windows, 8) && isStr(A.lighting, 8) && isStr(A.ground, 8), 'architecture: massing, roofs, windows, lighting, ground');
    need(isArr(A.motifs, 3) && isArr(A.props, 3) && isArr(A.avoid, 1), 'architecture: motifs (3+), props (3+), avoid (1+)');
  }
  const V = s.livery || {};
  for (const k of ['hull', 'hullAlt', 'belly', 'trim', 'accent', 'engineGlow']) need(isHex(V[k]), `livery.${k}: a colour`);
  need(isStr(V.stripe && V.stripe.kind), 'livery.stripe.kind');
  need(isStr(V.shape, 20), 'livery.shape: the shape language in words');
  need(typeof V.registryPrefix === 'string' && (s.kind === 'alien' || V.registryPrefix.length >= 2), 'livery.registryPrefix (2+ characters; empty only for the alien ship)');
  need(V.weathering && V.weathering.grime >= 0 && V.weathering.grime <= 1, 'livery.weathering.grime 0..1');
  return bad;
}
