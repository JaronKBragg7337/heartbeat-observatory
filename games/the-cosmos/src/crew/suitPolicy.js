// ============================================================================
// suitPolicy.js - who wears a pressure suit, and how they move in it (2026-11-19).
//
// One rule, read from the world's own record: outside on a world whose air cannot be breathed, a person is in a suit and helmet.
// Earth (101 kPa) is the only built world where they are not. Mars (0.6 kPa) is not air; the moons, Ceres and Callisto have none.
// Inside a ship, or a spot a builder marks `indoor: true`, nobody wears one.
//
// The gait follows gravity: under about 2 m/s2 (the Moon 1.62, Callisto 1.24, Ceres 0.28, Phobos 0.006) a walk is a slow bound.
// ============================================================================

/** Sea-level-ish pressure, Pa, below which a person outside needs a suit. (Armstrong limit is 6.3 kPa; breathing needs far more.) */
export const SUIT_BELOW_PA = 50_000;
/** Surface gravity, m/s2, under which the walk becomes the low-gravity bound. */
export const LOPE_BELOW_G = 2.0;

export function needsSuit(body) {
  const p = body && body.atmosphere ? (body.atmosphere.surfacePressure ?? 0) : 0;
  return p < SUIT_BELOW_PA;
}

export function gaitFor(body) {
  const g = body && Number.isFinite(body.surfaceGravity) ? body.surfaceGravity : 9.81;
  return g < LOPE_BELOW_G ? 'lope' : null;
}

/** Put the right kit on a person for the world they stand on. `look` gives the stripe colour (look.cloth). */
export function dressForWorld(person, body, look, indoor = false) {
  if (!person || !person.setSuit) return;
  const on = !indoor && needsSuit(body);
  person.setSuit(on, look || null, { gait: on ? gaitFor(body) : null });
}
