// ============================================================================
// worlds/callisto/def.js - PLACEHOLDER (F3). Callisto, the outermost big moon of Jupiter and the home of Mystara (bible v3 4.4: the Valhalla basin) and
// the Unbound. It is placed on its real orbit round Jupiter (a 1,882,700 km, e 0.0074, period 16.689 days: NASA/JPL satellite fact sheet) and LISTED
// in the nav as a long-range destination (the ship holds off it); nothing here can be landed on yet. To build it: replace this file with a full
// def (docs/ADD-A-WORLD.md) and keep the `orbit`. The orbital PHASE (`M0`) and the plane are invented placeholders: the real ones are for the
// WD-MYSTARA builder (JPL Horizons has no CORS: pre-compute, see REAL-DATA.md). Radius 2,410.3 km and mass 1.0759e23 kg are the published values.
// ============================================================================

export default {
  id: 'callisto', name: 'Callisto', kind: 'moon', placeholder: true, order: 105,
  blurb: 'Jupiter fills the sky. Mystara and the Unbound live here; the long-range drive reaches it in weeks, and the ground is not built yet, so she holds off.',
  radiusMean: 2_410_300, massKg: 1.0759e23,
  orbit: { parent: 'jupiter', frame: 'ecliptic', a: 1_882_700_000, e: 0.0074, i: 2.2, node: 100.0, peri: 43.0, M0: 120, periodS: 16.6890184 * 86400 },
};
