// ============================================================================
// worlds/_kit/schema.js - what a world definition must say, checked in words a builder can act on.
//
// A world def is plain data (no three.js, no DOM: the server imports it too). The full field list, with examples, is in
// docs/ADD-A-WORLD.md. validateWorldDef(def) returns an array of problems (empty = fine); the registry throws on any, so a
// broken def fails at load, in the validator, and never reaches a player.
//
// Kinds: planet | moon | dwarf | asteroid (ground you can land on: a frame of its own), star (the Sun: placed, never landed on),
//        station (a place that is built, not a ground: it orbits something and has docks; see "Stations" in the guide).
// ============================================================================

import { PROFILES } from './terrain.js';

export const KINDS = ['planet', 'moon', 'dwarf', 'asteroid', 'star', 'station'];
const GROUND_KINDS = ['planet', 'moon', 'dwarf', 'asteroid'];
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;
const isColour = (v) => Number.isInteger(v) && v >= 0 && v <= 0xffffff;
const isVec = (v) => v && isNum(v.x) && isNum(v.y) && isNum(v.z);

/** The problems with an `orbit` object ([] if fine). `legacy` orbits (parked shorthand) are filled in by the registry before this runs. */
export function orbitProblems(o) {
  const bad = [];
  if (!o || typeof o !== 'object') return ['orbit: an object { parent, a, e, i, node, peri | lonPeri, M0 | meanLon, ... } (see worlds/_kit/ephemeris.js)'];
  if (!isStr(o.parent)) bad.push("orbit.parent: what it goes round: 'sun', 'mars' or another world's id");
  if (o.offset !== undefined) { if (!isVec(o.offset)) bad.push('orbit.offset: { x, y, z } metres from the parent (a station that hangs beside its parent)'); return bad; }
  if (!(isNum(o.a) && o.a > 0)) bad.push('orbit.a: semi-major axis in metres');
  if (!(isNum(o.e) && o.e >= 0 && o.e < 1)) bad.push('orbit.e: eccentricity, 0 up to (not including) 1');
  for (const k of ['i', 'node']) if (o[k] !== undefined && !isNum(o[k])) bad.push(`orbit.${k}: degrees`);
  if (!(isNum(o.peri) || isNum(o.lonPeri)) && !o.parked) bad.push('orbit.peri (argument of periapsis) or orbit.lonPeri (longitude of periapsis): degrees');
  if (!(isNum(o.M0) || isNum(o.meanLon))) bad.push('orbit.M0 (mean anomaly at the game start) or orbit.meanLon (mean longitude at J2000, with rates.meanLon): degrees');
  if (o.frame !== undefined && !['ecliptic', 'equator'].includes(o.frame)) bad.push("orbit.frame: 'ecliptic' or 'equator'");
  return bad;
}

export function validateWorldDef(d) {
  const bad = [];
  const need = (cond, msg) => { if (!cond) bad.push(msg); };
  if (!d || typeof d !== 'object') return ['a world def must be an object'];
  need(isStr(d.id) && /^[a-z][a-z0-9-]*$/.test(d.id), 'id: lower-case letters, digits and dashes, starting with a letter (it is also the frame id and the folder name)');
  need(isStr(d.name), 'name: the name the player sees');
  need(KINDS.includes(d.kind), `kind: one of ${KINDS.join(', ')}`);
  if (d.placeholder) { need(isStr(d.blurb), 'blurb: a placeholder needs the sentence the nav computer shows'); if (d.orbit) bad.push(...orbitProblems(d.orbit)); return bad; }
  if (d.root) {
    need(d.body && isNum(d.body.radiusMean) && isNum(d.body.surfaceGravity), 'body: the root world carries the full body record (radiusMean, surfaceGravity, ...)');
    need(d.orbit && d.orbit.parent === 'sun', "orbit: the root world goes round the Sun (use SOLAR.orbit.mars from _kit/solar.js): every other world's place is measured from it");
    if (d.orbit) bad.push(...orbitProblems(d.orbit));
    return bad;
  }
  if (d.kind === 'star') { need(isNum(d.massKg) && d.massKg > 0 && isNum(d.radiusM) && d.radiusM > 0, 'massKg and radiusM: a star needs its real mass and radius'); return bad; }

  // ---- where it is -------------------------------------------------------------------------------------------------------
  const legacy = d.orbit === undefined || (d.orbit && d.orbit.parked);
  if (d.orbit && !d.orbit.parked) bad.push(...orbitProblems(d.orbit));
  else if (legacy) {
    need(d.parent === undefined || d.parent === 'mars', "parent: with the legacy shorthand (orbitRadiusM + lonS) only 'mars'; use an `orbit` object to go round anything else");
    need(isNum(d.orbitRadiusM) && d.orbitRadiusM > 3_389_500, 'orbitRadiusM (with lonS): distance from the centre of Mars to this world, metres; or give a full `orbit` object');
    need(isNum(d.lonS), 'lonS: where it sits, degrees of S-longitude, when parked; or give a full `orbit` object');
    need(d.latS === undefined || (isNum(d.latS) && Math.abs(d.latS) < 90), 'latS: degrees north of the equator plane, optional');
    need(isNum(d.orbitPeriodS) && d.orbitPeriodS > 0, 'orbitPeriodS: seconds (a moon\'s sidereal day equals it unless `rotation` says otherwise)');
  }
  if (d.rotation !== undefined) need(d.rotation && (isNum(d.rotation.periodS) && d.rotation.periodS !== 0 || d.rotation.lockedTo === 'parent') && (d.rotation.axialTiltDeg === undefined || isNum(d.rotation.axialTiltDeg)), "rotation: { periodS (seconds, negative = retrograde) or lockedTo: 'parent', axialTiltDeg }");
  need(d.jump === undefined || typeof d.jump === 'boolean', 'jump: true if this world is reached by a jump lane (F3)');

  // ---- a station: a built place, not a ground ----------------------------------------------------------------------------
  if (d.kind === 'station') {
    need(isNum(d.radiusM) && d.radiusM > 0, 'radiusM: the station\'s bounding radius in metres (the course stops this far plus a safe margin off it)');
    need(Array.isArray(d.docks), 'docks: [{ id, name, pos: {x,y,z}, dir: {x,y,z}, sizeClass: "S"|"M"|"L" }, ...] in the station\'s own metres (may be empty until the builder lays them out)');
    if (Array.isArray(d.docks)) need(d.docks.every((k) => isStr(k.id) && isStr(k.name) && isVec(k.pos) && isVec(k.dir) && ['S', 'M', 'L'].includes(k.sizeClass)), 'docks: each needs id, name, pos {x,y,z}, dir {x,y,z} (the way a ship leaves it) and sizeClass S, M or L');
    need(d.gravity === 'spin' || d.gravity === 'none' || isNum(d.gravity), "gravity: 'spin' (a rotating hull), 'none', or a number in m/s2");
    need(d.standoffM === undefined || (isNum(d.standoffM) && d.standoffM > 0), 'standoffM: optional, metres off the station centre where a course holds');
    need(d.orbit !== undefined, 'orbit: a station is placed by an `orbit` ({ parent, offset } hangs it beside its parent; a full Kepler orbit otherwise)');
    return bad;
  }

  // ---- a ground: moon, planet, dwarf, asteroid ---------------------------------------------------------------------------
  need(GROUND_KINDS.includes(d.kind), 'kind: a ground world is planet, moon, dwarf or asteroid');
  need(isNum(d.massKg) && d.massKg > 0, 'massKg: real mass in kilograms');
  const ax = d.axes;
  need((ax && isNum(ax.a) && isNum(ax.b) && isNum(ax.c) && ax.a > 0 && ax.b > 0 && ax.c > 0) || (isNum(d.radiusM) && d.radiusM > 0),
    'axes {a,b,c} in metres (a triaxial body) or radiusM (a sphere)');
  const R = d.radiusMean || (ax ? (ax.a + ax.b + ax.c) / 3 : d.radiusM);
  need(isNum(R) && R > 0, 'radiusMean: could not be worked out from axes / radiusM');
  const prof = (d.terrain && d.terrain.profile) || 'rocky';
  need(PROFILES[prof], `terrain.profile: one of ${Object.keys(PROFILES).join(', ')}`);
  if (PROFILES[prof] && !PROFILES[prof].landable) return bad;      // a gas giant needs no ground
  need(Number.isInteger(d.seed), 'seed: an integer, the same on the server and every phone');
  need(isNum(d.regolithDepthM) || (PROFILES[prof] && PROFILES[prof].defaults.regolithDepthM !== undefined), 'regolithDepthM: depth of the loose surface layer, metres');
  need(Array.isArray(d.landmarks), 'landmarks: an array (may be empty)');
  const P = d.pad;
  need(P && isNum(P.lat) && isNum(P.lon) && isNum(P.flatM) && isNum(P.blendM) && isStr(P.name) && P.blendM > P.flatM, 'pad: { lat, lon, flatM, blendM (> flatM), name } - the first landing pad, graded flat');
  if (d.ports !== undefined) need(Array.isArray(d.ports) && d.ports.every((p) => isStr(p.id) && isNum(p.lat) && isNum(p.lon) && isNum(p.flatM) && isNum(p.blendM) && isStr(p.name) && p.blendM > p.flatM), 'ports: [{ id, name, lat, lon, flatM, blendM }, ...] extra graded sites (the pad stays the arrival point)');
  if (d.atmosphere) {
    const A = d.atmosphere;
    need(isNum(A.rho0) && A.rho0 >= 0 && isNum(A.scaleHeightM) && A.scaleHeightM > 0 && isNum(A.topM) && A.topM > 0, 'atmosphere: { rho0 (kg/m3 at the surface), scaleHeightM, topM, skyColor, horizonColor } or null for airless');
    need(isColour(A.skyColor) && isColour(A.horizonColor), 'atmosphere.skyColor / horizonColor: 0xRRGGBB numbers');
  }
  const M = d.materials;
  need(M && typeof M === 'object' && M.regolith && M.rubble, 'materials: { regolith, rubble, clay? } each a material object (use groundMaterials() from _kit/materials.js) or the name of an existing MATERIALS key');
  if (M && Object.values(M).some((m) => typeof m === 'object')) need(Number.isInteger(d.worldIndex) && d.worldIndex >= 3, 'worldIndex: a unique integer (3 and up) that fixes the order new materials are numbered in; take the next free one');
  if (d.look !== undefined) need(d.look && typeof d.look === 'object', 'look: albedo units, see docs/ADD-A-WORLD.md');
  return bad;
}
