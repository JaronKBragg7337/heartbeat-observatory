// ============================================================================
// worlds/sun/def.js - the Sun: the root of every orbit in the registry (`orbit: { parent: 'sun', ... }`). Never landed on, never a
// destination; it exists so the tree has a top and the planets' periods come from a real mass (GM 1.32712440018e20 m3/s2).
// ============================================================================
import { SOLAR } from '../_kit/solar.js';

export default { id: 'sun', name: 'Sun', designation: 'SOL', kind: 'star', order: -10, nav: false, massKg: SOLAR.sun.massKg, radiusM: SOLAR.sun.radiusM };
