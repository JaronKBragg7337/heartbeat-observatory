// ============================================================================
// desktopBodies.js - desktop-only high-fidelity solar-system data.
//
// OWNS: a cloned, scaled presentation/simulation registry for desktop.html.
// DOES NOT OWN: the mobile/public BODIES registry. This file must never mutate
//               src/world/bodies.js records in place.
//
// The core engine is scale-independent, so the desktop tier makes one coherent
// decision: bigger bodies, wider interplanetary distances, richer terrain
// profiles, and the same custom f64/floating-origin physics.
// ============================================================================

import { BODIES } from '../world/bodies.js';

export const DESKTOP_WORLD_SCALE = {
  radius: 2.65,
  distance: 5.2,
  terrain: 2.15,
  atmosphere: 1.55,
};

const PROFILE_BY_ID = {
  earth: 'continental',
  moon: 'cratered',
  rustholm: 'ridged',
  aethelgard: 'oceanic',
  cryos: 'ice',
  pyrrhus: 'volcanic',
  veldora: 'continental',
  ironcore: 'ridged',
  dunewind: 'dune',
};

const DESKTOP_ONLY = [
  {
    id: 'nimbara',
    name: 'Nimbara (Storm Giant)',
    position: [180000, -78000, 112000],
    radius: 18500,
    surfaceGravity: 21.0,
    realRadiusKm: 69911,
    realGravity: 24.79,
    colors: { low: 0x3b305d, mid: 0x9a6e57, high: 0xe0c58e },
    atmosphere: { color: 0xd8a86a, height: 8200, density: 1.4 },
    terrain: { seed: 61613, amplitude: 230, octaves: 5, freq: 1.35, profile: 'gas' },
    seaLevel: null,
    ownerFactionId: null,
    landingZones: [],
    spawn: null,
    desktopOnly: true,
    lore: 'A non-landing storm giant. Its banded atmosphere is a navigation landmark and future fuel-skimming target.',
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    position: [-156000, 26000, -93000],
    radius: 7200,
    surfaceGravity: 8.2,
    realRadiusKm: 6051,
    realGravity: 8.87,
    colors: { low: 0x08090a, mid: 0x25252a, high: 0xd14a22 },
    atmosphere: { color: 0xff7043, height: 1300, density: 0.42 },
    terrain: { seed: 51427, amplitude: 420, octaves: 6, freq: 3.9, profile: 'volcanic' },
    seaLevel: null,
    ownerFactionId: 'fortis',
    landingZones: [
      {
        id: 'obsidian_forge',
        name: 'Fortis Forge Line',
        dir: [0.18, 0.94, -0.28],
        angularRadius: 0.026,
        flatten: true,
        factionId: 'fortis',
        structures: 'outpost',
        discovery: { resourceItemId: 'titanium_ore', note: 'A hardened Fortis refinery cut into volcanic glass.' },
      },
    ],
    spawn: null,
    desktopOnly: true,
    lore: 'Black volcanic continents, active calderas, and Fortis industrial heat shields.',
  },
  {
    id: 'mirrorglass',
    name: 'Mirrorglass',
    position: [112000, 54000, 176000],
    radius: 3900,
    surfaceGravity: 2.7,
    realRadiusKm: 2410,
    realGravity: 1.31,
    colors: { low: 0x183b4a, mid: 0x8fd3e8, high: 0xf4fbff },
    atmosphere: { color: 0xbdefff, height: 520, density: 0.18 },
    terrain: { seed: 71891, amplitude: 150, octaves: 6, freq: 5.4, profile: 'ice' },
    seaLevel: null,
    ownerFactionId: 'meridian',
    landingZones: [
      {
        id: 'mirrorglass_observatory',
        name: 'Meridian Mirror Observatory',
        dir: [-0.35, 0.83, 0.44],
        angularRadius: 0.034,
        flatten: true,
        factionId: 'meridian',
        structures: 'relay',
        discovery: { resourceItemId: 'sensor_crystal', note: 'The ice crust lenses weak signals from deep space.' },
      },
    ],
    spawn: null,
    desktopOnly: true,
    lore: 'A blue-white ice body with long cracks and reflective crust fields.',
  },
];

export const DESKTOP_BODIES = [
  ...BODIES.map(cloneAndScaleBody),
  ...DESKTOP_ONLY.map(cloneBody),
];

export function getDesktopBody(id) {
  const body = DESKTOP_BODIES.find((b) => b.id === id);
  if (!body) throw new Error(`Unknown desktop body id: ${id}`);
  return body;
}

function cloneAndScaleBody(source) {
  const body = cloneBody(source);
  body.position = body.position.map((v) => v * DESKTOP_WORLD_SCALE.distance);
  body.radius = Math.round(body.radius * DESKTOP_WORLD_SCALE.radius);
  body.terrain = {
    ...body.terrain,
    amplitude: Math.round(body.terrain.amplitude * DESKTOP_WORLD_SCALE.terrain),
    freq: body.terrain.freq * 0.72,
    profile: PROFILE_BY_ID[body.id] || body.terrain.profile || 'continental',
  };
  if (body.atmosphere) {
    body.atmosphere = {
      ...body.atmosphere,
      height: Math.round(body.atmosphere.height * DESKTOP_WORLD_SCALE.atmosphere),
      density: Math.min(1.5, body.atmosphere.density * 1.08),
    };
  }
  if (typeof body.seaLevel === 'number') body.seaLevel = body.seaLevel * DESKTOP_WORLD_SCALE.radius;
  body.desktopScale = DESKTOP_WORLD_SCALE;
  return body;
}

function cloneBody(source) {
  return JSON.parse(JSON.stringify(source));
}
