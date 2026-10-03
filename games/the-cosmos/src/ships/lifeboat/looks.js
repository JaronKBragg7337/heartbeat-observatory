// ============================================================================
// ships/lifeboat/looks.js - the lifeboat's paint for each start world (data only; server-safe). One hull, five local looks: the bible asks
// for "one per world, local look". tint multiplies the hull plating's own colour, so it is a share of white, not a paint code.
// Mars is read live from F0's faction style sheet (src/factions/mars/style.js). The other four worlds have no neutral style in F0 (the two
// factions of each world are not the boat's builders), so their paints are written here in the same slots and are PLACEHOLDERS until Jaron or F0
// names a neutral look for each world. Names are the boats' own class names.
// ============================================================================
import { shipLivery } from '../../factions/registry.js';

const rgb = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const M = shipLivery('mars');
// Slots follow F0: accent = the thin line (hullAccent), stripe = the wide band (hullStripe). Mars is F0's neutral livery itself.
export const LIFEBOAT_LOOKS = {
  mars: { id: 'mars', name: 'Marineris Skiff', tint: rgb(M.hull), belly: rgb(M.belly), dark: M.belly, accent: M.accent, stripe: M.stripe.colors[0], engine: M.engineGlow, weather: 0.85, note: 'F0 neutral Mars: plain white, a rust band and a thin cyan line; port-grey going orange with dust.' },
  moon: { id: 'moon', name: 'Tranquility Skiff', tint: [0.86, 0.89, 0.95], belly: [0.4, 0.42, 0.46], dark: 0x30343c, accent: 0xe9ecec, stripe: 0x4a6fa5, engine: 0x9fdcff, weather: 0.5, note: 'Civil-hub white and blue; no dust, hard shadows.' },
  ceres: { id: 'ceres', name: 'Kerwan Skiff', tint: [0.9, 0.93, 0.93], belly: [0.45, 0.47, 0.5], dark: 0x2b2f33, accent: 0x2b2f33, stripe: 0xe0b030, engine: 0xffd27a, weather: 0.75, note: 'Salt-white with hi-vis yellow: a mine-camp boat.' },
  earth: { id: 'earth', name: 'Coast Skiff', tint: [0.95, 0.95, 0.94], belly: [0.5, 0.5, 0.52], dark: 0x2a3138, accent: 0xe86a1a, stripe: 0x2a6fa8, engine: 0xbfe4ff, weather: 0.45, note: 'Sea-blue and rescue orange; rain-clean.' },
  callisto: { id: 'callisto', name: 'Valhalla Skiff', tint: [0.78, 0.83, 0.92], belly: [0.34, 0.37, 0.43], dark: 0x232830, accent: 0xd9a441, stripe: 0x6fa0c8, engine: 0x7fd0ff, weather: 0.9, note: 'Ice-grey with a frost-blue band and an amber line; frost on the belly.' },
};
export const lifeboatLook = (world) => LIFEBOAT_LOOKS[world] || LIFEBOAT_LOOKS.mars;
