// ============================================================================
// ships/raider/looks.js — a raider crew does not wear the hall's faces.
//
// The seven Loft people (homes/people) are still the bodies. Each hull rotates which four it uses, and every
// person gets a duty look: cloth, hair and skin tints, and a helmet with a visor. The look lives on the crew
// record (and on the pool record if they sign on) so both clients draw the same person. Hire-pool posts are
// not touched: Ada, Zuri, Jorge and the rest stay as they are in the hall.
//
// Tints are multiplied over the real textures (see personRig.applyPersonLook), never a flat replacement,
// and they stay in ordinary duty colours. A helmet is what keeps a raider from reading as the hall's person
// even when the body underneath is the same sculpt.
// ============================================================================

/** The Loft roster, in the order people.json lists them. */
export const LOFT_PEOPLE = ['isaiah', 'ada', 'jorge', 'sunita', 'zuri', 'walter', 'aoi'];

/** Warm skin. Red stays at or above blue; nothing here is blue or green. */
export const SKIN = [0xfff5ee, 0xf3d2b5, 0xe0b08a, 0xc9845c, 0xb06a45];

/** Duty cloth: charcoal, navy, dust, oxide, olive, slate, bark. */
export const CLOTH = [0x8a939c, 0x6e7c90, 0x9a7b62, 0x8a534c, 0x7d8668, 0x6a7078, 0x8d7264];

/** Hair. Dark, grey, or brown. */
export const HAIR = [0x1c140f, 0x3b2416, 0x6b3a22, 0x7a736c, 0x4a2418];

/** Visor glass. Smoke, amber, gold. Opacity is the one number the helmet uses. */
export const VISOR = [
  { id: 'smoke', tint: 0x1c2128 },
  { id: 'amber', tint: 0x7a5a32 },
  { id: 'gold', tint: 0x6a6248 },
];

export const VISOR_OPACITY = 0.72;

/**
 * The look for one station of the nth raider.
 * personId steps by 2, so the four posts of one hull are four different bodies.
 * Cloth, hair and visor step on their own cycles, so two people who somehow shared a body would still not match.
 */
export function raiderLook(seq, postIndex) {
  const personId = LOFT_PEOPLE[(seq * 3 + postIndex * 2) % LOFT_PEOPLE.length];
  const cloth = CLOTH[(seq + postIndex * 3) % CLOTH.length];
  const hair = HAIR[(seq * 2 + postIndex) % HAIR.length];
  const skin = SKIN[(seq + postIndex * 2) % SKIN.length];
  const visor = VISOR[(seq + postIndex) % VISOR.length];
  return {
    personId, helmet: true, cloth, hair, skin,
    visor: visor.id, visorTint: visor.tint, visorOpacity: VISOR_OPACITY,
  };
}

/** True when two looks can be told apart at a glance. */
export function looksDistinct(a, b) {
  if (!a || !b) return false;
  return a.personId !== b.personId || a.cloth !== b.cloth || a.hair !== b.hair || a.visorTint !== b.visorTint;
}

/**
 * True only for an unmodified hire-pool face: the hall's personId, no helmet, no visor.
 * A raider look fails this for every hire post, which is the point.
 */
export function stockHireMatch(look, hirePersonId) {
  if (!look || look.personId !== hirePersonId) return false;
  return !look.helmet && !look.visor;
}
