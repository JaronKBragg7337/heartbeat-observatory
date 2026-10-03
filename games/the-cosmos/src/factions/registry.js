// ============================================================================
// factions/registry.js - the faction style sheet (package F0): what every faction, Mars and the alien ship LOOK like.
//
// OWNS: the table of styles (src/factions/<id>/style.js, listed by the generated _manifest.js), lookups, and the helpers a builder
// uses so no one types a colour twice: a person's look (uniform), a ship's livery, a sign's plate, a building's palette.
// DOES NOT OWN: any mesh. A style is data. Meshes, textures and buildings are made by the world and ship builders from it; the in-game
// gallery (`?dev=1&styles=1`, gallery.js) draws every style so it can be reviewed on a phone.
//
// To add a faction: drop src/factions/<id>/style.js (default export), run `node tools/gen-registry.mjs`. See docs/FACTION-STYLES.md.
// ============================================================================

import { FACTION_STYLES } from './_manifest.js';
import { validateStyle, ROLES, css, mixHex, shadeHex, contrast } from './_kit/style.js';

for (const s of FACTION_STYLES) { const bad = validateStyle(s); if (bad.length) throw new Error(`faction style '${s && s.id}' is not valid: ${bad.join('; ')}`); }
{ const seen = new Set(); for (const s of FACTION_STYLES) { if (seen.has(s.id)) throw new Error(`faction style '${s.id}' is registered twice`); seen.add(s.id); } }

/** Display order: the nine named factions by home (Earth, Moon, Ceres, Callisto, stations), then the Unbound, Mars, the alien ship. */
const ORDER = ['homeguard', 'skyward', 'fortis', 'technos', 'ironclad', 'greenhaven', 'mystara', 'unbound', 'wanderhome', 'corsairs', 'mars', 'alien'];
const rank = (id) => { const i = ORDER.indexOf(id); return i < 0 ? 1000 : i; };
const STYLES = new Map([...FACTION_STYLES].sort((a, b) => rank(a.id) - rank(b.id) || (a.id < b.id ? -1 : 1)).map((s) => [s.id, s]));

export const hasFaction = (id) => STYLES.has(id);
/** A style by id. An unknown id throws: a record naming a faction the build lacks is a bug. */
export function factionStyle(id) {
  const s = STYLES.get(id);
  if (!s) throw new Error(`Unknown faction style: ${id}`);
  return s;
}
export const allFactionStyles = () => [...STYLES.values()];
export const factionIds = () => [...STYLES.keys()];
/** The ten factions players can join (the nine named ones plus the Unbound), not Mars and not the alien ship. */
export const playableFactionIds = () => allFactionStyles().filter((s) => s.kind === 'faction').map((s) => s.id);
/** The factions that live on a world ('earth', 'moon', 'ceres', 'callisto', 'station'); Mars returns its neutral style. */
export const factionsOn = (home) => allFactionStyles().filter((s) => s.home === home).map((s) => s.id);

// ---------------------------------------------------------------------------
// PEOPLE: uniforms in the form personRig.applyPersonLook already takes (cloth, hair, skin tints; optional duty helmet).
// ---------------------------------------------------------------------------
/** The Loft roster (homes/people/people.json), the same seven bodies the raider crews use. */
export const LOFT_PEOPLE = ['isaiah', 'ada', 'jorge', 'sunita', 'zuri', 'walter', 'aoi'];
/** Skin tints, light to deep (the raider look's own list: warm, red never under blue). A faction does not pick skin: everyone lives everywhere. */
export const SKIN = [0xfff5ee, 0xf3d2b5, 0xe0b08a, 0xc9845c, 0xb06a45];

/** A deterministic 0..1 from two integers (so a person's look is the same on the server and on every phone). */
const hash01 = (a, b) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** Roles a style has uniforms for. */
export const uniformRoles = (id) => Object.keys(factionStyle(id).uniforms || {});

/**
 * The look of the nth person of a faction in a role. `seq` is any integer (a person's number), `role` one of ROLES (an unknown or missing
 * role falls back to `worker`; a faction without that role uses `civilian`). The result is a look record: { personId, cloth, hair, skin,
 * helmet?, visor?, visorTint?, visorOpacity?, shell?, trim, faction, role }. Cloth is varied a few percent per person so a crowd is not a
 * single colour; the tint is MULTIPLIED over the Loft's own textures (see personRig.applyPersonLook), so it dyes the clothes without
 * flattening the weave.
 */
export function factionLook(id, seq = 0, role = 'worker') {
  const s = factionStyle(id);
  if (!s.uniforms) throw new Error(`faction style '${id}' has no people`);
  const r = s.uniforms[role] ? role : s.uniforms.worker ? 'worker' : 'civilian';
  const u = s.uniforms[r];
  const n = seq | 0, rid = ROLES.indexOf(r);
  const personId = LOFT_PEOPLE[Math.floor(hash01(n, 11 + rid) * LOFT_PEOPLE.length)];
  const hair = s.hair[Math.floor(hash01(n, 23 + rid) * s.hair.length)];
  const skin = SKIN[Math.floor(hash01(n, 37) * SKIN.length)];
  const k = 0.92 + hash01(n, 53 + rid) * 0.16;                // 0.92 .. 1.08 of the style's cloth
  const cloth = shadeHex(u.cloth, k);
  const look = { personId, cloth, hair, skin, trim: u.trim, faction: id, role: r };
  if (u.helmet) Object.assign(look, { helmet: true, shell: u.helmet.shell, helmetTrim: u.helmet.trim, visor: 'faction', visorTint: u.helmet.visorTint, visorOpacity: u.helmet.visorOpacity ?? 0.72 });
  return look;
}

// ---------------------------------------------------------------------------
// SHIPS: livery
// ---------------------------------------------------------------------------
/** The livery of a faction's ships (colours, stripe, markings, weathering). Every colour is a 0xRRGGBB integer. */
export const shipLivery = (id) => factionStyle(id).livery;

/**
 * The name and registry mark a ship of this faction carries. `n` is the ship's number; `name` its own name if it has one. Example:
 * shipMark('fortis', 7, 'Warden') -> { registry: 'FT-0007', name: 'WARDEN' }. The alien ship has no mark.
 */
export function shipMark(id, n = 1, name = '') {
  const s = factionStyle(id), v = s.livery;
  const lower = s.signs.upper === false;
  return { registry: v.registryPrefix ? `${v.registryPrefix}${String(Math.max(0, n | 0)).padStart(4, '0')}` : '', name: name ? (lower ? name.toLowerCase() : name.toUpperCase()) : '' };
}

/**
 * Dress a built ship exterior in a faction's livery. The ships share a few hull materials (`matsExt.hull`, `hullDark`, `hullAccent`,
 * `hullStripe`); this clones the ones the exterior uses and recolours the clones (hull = the style's hull colour over the panel texture,
 * hullDark = belly, hullAccent = accent, hullStripe = the stripe's first colour), so the panel shading, rivets and wear stay and only the
 * colour moves. It is a LIVERY, not a repaint: the shared materials are never touched, so the player's own ship does not change.
 * `root` is the exterior's THREE.Object3D, `mats` the ship's material table (`ship.matsExt`), `THREE` is passed in so this file imports no
 * renderer. Pass `{ alt: true }` for the second hull colour. Returns the clones.
 */
export function applyLiveryTint(THREE, root, mats, id, o = {}) {
  const v = shipLivery(id), map = { hull: o.alt ? v.hullAlt : v.hull, hullDark: v.belly, hullAccent: v.accent, hullStripe: v.stripe.colors[0] };
  const clones = new Map(), out = [];
  for (const [key, hex] of Object.entries(map)) {
    const src = mats && mats[key];
    if (!src) continue;
    const c = src.clone(); c.color.set(hex); c.userData = { ...src.userData, liveryOf: id };
    clones.set(src, c); out.push(c);
  }
  root.traverse((m) => {
    if (!m.isMesh || !m.material) return;
    const swap = (mt) => clones.get(mt) || mt;
    m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material);
  });
  return out;
}

// ---------------------------------------------------------------------------
// SIGNS AND BUILDINGS: small answers a builder asks often
// ---------------------------------------------------------------------------
/** What a sign of `kind` ('plate' | 'warning' | 'banner') looks like for this faction: { bg, fg, edge?, stripe?, font, upper, weight }. */
export function signStyle(id, kind = 'plate') {
  const g = factionStyle(id).signs, k = g[kind] || g.plate;
  return { bg: k.bg, fg: k.fg, edge: k.edge ?? g.plate.edge, stripe: k.stripe || null, radius: k.radius ?? g.plate.radius, rivets: !!(k.rivets ?? (kind === 'plate' && g.plate.rivets)), fontStack: g.fontStack, weight: g.weight, upper: g.upper, tracking: g.tracking };
}
/** The text of a sign as the faction would letter it (upper or lower case). */
export const signText = (id, text) => (factionStyle(id).signs.upper === false ? String(text).toLowerCase() : String(text).toUpperCase());
/** A deterministic pick from a faction's place names, slogans or graffiti: pick('fortis', 'slogans', 3). */
export const pickLine = (id, list, n = 0) => { const a = factionStyle(id).signs[list] || []; return a.length ? a[Math.abs(n | 0) % a.length] : ''; };
/** Material preset by id for a faction (undefined if it has none by that id). */
export const factionMaterial = (id, matId) => factionStyle(id).materials.find((m) => m.id === matId);
/** The colour ramp a building uses, in the proportions the style names: [primary, secondary, accent, trim, dark, light]. */
export const buildingRamp = (id) => { const p = factionStyle(id).palette; return [p.primary, p.secondary, p.accent, p.trim, p.dark, p.light]; };

export { css, mixHex, shadeHex, contrast, ROLES };
