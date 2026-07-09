// ============================================================================
// worldDetails.js - surface dressing for SYL worlds: settlements + nature.
//
// OWNS: the deterministic settlement/nature LAYOUT per landing zone, the
//       visual construction of that layout (via render/props.js), and the
//       collider specs for it (consumed by planet.js allCollidersForZone —
//       you cannot walk through a settlement building).
// DOES NOT OWN: terrain truth (planet.js terrainRadiusAt is the only height
//       source), collision RESOLUTION (planet.js), saves, loot, discovery.
//
// GROUNDING LAW (this file's reason to exist in its current form): every
// placed object samples the terrain under its whole footprint
// (props.sampleFootprint) and bases itself on the LOWEST corner; buildings
// fill the slope gap with a foundation plinth, rocks/trees sink and tilt to
// the terrain normal. Nothing floats, nothing hovers on a slope edge.
//
// DETERMINISM LAW: layout comes from computeSettlementLayout()/
// computeNatureLayout() — pure functions of (body, zone). Visuals AND
// colliders both derive from the same layout, so what you see is what blocks
// you. If you change a layout rule, visuals and collision stay in lockstep.
// ============================================================================

import * as THREE from 'three';
import {
  surfaceMat, glowMat, sampleFootprint, enableShadows,
  makeRock, makeBoulderCluster, makeTree, makePine, makeIceSpire,
  makeCrystalCluster, makeVent, makeGabledBuilding, makeQuonsetHut,
  makeBlockTower, makeContainer, makeSolarArray, makeCanopy, makeBanner,
} from '../render/props.js';
import { roadTexture } from '../render/textures.js';

const BODY_DETAIL = {
  earth: { nature: 'forest', settlement: 'city', tint: 0x7ba35f },
  moon: { nature: 'rock', settlement: 'survey', tint: 0xa7a7aa },
  rustholm: { nature: 'scrap', settlement: 'claim', tint: 0xb46c38 },
  aethelgard: { nature: 'archipelago', settlement: 'harbor', tint: 0x6f8ee8 },
  cryos: { nature: 'ice', settlement: 'research', tint: 0xbce9ff },
  pyrrhus: { nature: 'volcanic', settlement: 'bastion', tint: 0xe15b2f },
  veldora: { nature: 'forest', settlement: 'nomad', tint: 0x86bc74 },
  ironcore: { nature: 'ore', settlement: 'foundry', tint: 0xa2a2a2 },
  dunewind: { nature: 'desert', settlement: 'caravan', tint: 0xd6a464 },
  obsidian: { nature: 'volcanic', settlement: 'forge', tint: 0xff6e40 },
  mirrorglass: { nature: 'ice', settlement: 'observatory', tint: 0xc6f6ff },
};

const _worldY = new THREE.Vector3(0, 1, 0);
const _basis = new THREE.Matrix4();
const _yawQ = new THREE.Quaternion();
const _tmpQ = new THREE.Quaternion();
const _east = new THREE.Vector3();
const _north = new THREE.Vector3();

// ---------------------------------------------------------------------------
// LAYOUT (pure, deterministic — shared by visuals and colliders)
// ---------------------------------------------------------------------------
export function computeSettlementLayout(body, zone, quality = 'mobile') {
  const rng = mulberry32(hashString(`${body.id}:${zone.id}:settlement`));
  const plan = BODY_DETAIL[body.id] || fallbackPlan(body);
  let baseCount = zone.structures === 'transit' ? 12
    : zone.structures === 'outpost' ? 10
      : zone.structures === 'depot' ? 7
        : zone.structures === 'relay' ? 5 : 4;
  if (quality === 'desktop') baseCount = Math.min(baseCount, 5);
  const count = baseCount + (quality === 'desktop' ? 1 : 0);
  const out = [];
  const placed = [];
  for (let i = 0; i < count; i++) {
    const ring = 42 + rng() * 82 + (i % 3) * 10;
    const a = i * 2.399963 + rng() * 0.55;
    const east = Math.cos(a) * ring;
    const north = Math.sin(a) * ring;
    if (Math.hypot(east, north) < 34) continue;
    const w = 6 + rng() * (zone.structures === 'transit' ? 8 : 5);
    const d = 6 + rng() * 8;
    const h = 4 + rng() * (plan.settlement === 'city' ? 9 : 6);
    // Scene-validation law: buildings never overlap. A spot that clashes with
    // an already-placed building is skipped (deterministically).
    if (placed.some((pb) => Math.abs(pb.east - east) < (pb.w + w) / 2 + 1 &&
                            Math.abs(pb.north - north) < (pb.d + d) / 2 + 1)) continue;
    placed.push({ east, north, w, d });
    const roll = rng();
    const type = h > 9 ? 'tower' : (roll < 0.42 ? 'gabled' : roll < 0.75 ? 'quonset' : 'gabled');
    out.push({ type, east, north, w, h, d, yaw: a + Math.PI / 2, i });
    if (i % 3 === 0) out.push({ type: 'solar', east: east + 9 + rng() * 4, north: north - 4, yaw: rng() * Math.PI, i: `s${i}` });
    if (i % 4 === 1) out.push({ type: 'container', east: east - 8, north: north + 6, yaw: rng() * Math.PI, i: `c${i}` });
  }
  if (zone.structures === 'transit') {
    for (const side of [-1, 1]) {
      out.push({ type: 'canopy', east: side * 36, north: 18, w: 26, d: 9, yaw: side * 0.18, i: `k${side}` });
    }
  }
  if (zone.factionId) out.push({ type: 'banner', east: 30, north: -8, yaw: 0, i: 'b' });
  return out;
}

// Collider specs for a layout (merged by planet.js allCollidersForZone).
export function detailCollidersForLayout(layout) {
  const out = [];
  for (const spec of layout) {
    if (spec.type === 'gabled' || spec.type === 'quonset' || spec.type === 'tower') {
      out.push({
        kind: 'box', east: spec.east, north: spec.north,
        halfEast: spec.w / 2 + 0.4, halfNorth: spec.d / 2 + 0.4,
        height: spec.h + 4,
      });
    } else if (spec.type === 'container') {
      out.push({ kind: 'box', east: spec.east, north: spec.north, halfEast: 2.3, halfNorth: 1.3, height: 2.8 });
    }
  }
  return out;
}

export function computeNatureLayout(body, zone, quality = 'mobile') {
  const rng = mulberry32(hashString(`${body.id}:${zone.id}:nature`));
  const plan = BODY_DETAIL[body.id] || fallbackPlan(body);
  const count = quality === 'desktop' ? 8 : 18 + (plan.nature === 'forest' ? 8 : 0);
  const out = [];
  for (let i = 0; i < count; i++) {
    const ring = 88 + rng() * 210;
    const a = i * 2.199115 + rng() * 0.9;
    const east = Math.cos(a) * ring;
    const north = Math.sin(a) * ring;
    if (Math.hypot(east, north) < 70) continue;
    out.push({ kind: plan.nature, east, north, seed: Math.floor(rng() * 1e9), i });
  }
  return out;
}

// Tree/large-prop colliders: thin circles so you brush past, not through.
export function natureCollidersForLayout(layout) {
  const out = [];
  for (const spec of layout) {
    if (spec.kind === 'forest') {
      out.push({ kind: 'circle', east: spec.east, north: spec.north, radius: 0.55, height: 7 });
    } else if (spec.kind === 'ice' || spec.kind === 'volcanic') {
      out.push({ kind: 'circle', east: spec.east, north: spec.north, radius: 1.6, height: 6 });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// VISUAL construction
// ---------------------------------------------------------------------------
export function buildWorldDetailLayer(body, factionById, terrainRadiusAtFn, options = {}) {
  const quality = options.quality || 'mobile';
  const group = new THREE.Group();
  group.name = `world-detail:${body.id}`;

  const plan = BODY_DETAIL[body.id] || fallbackPlan(body);
  const stats = {
    zonesDetailed: 0, settlementBuildings: 0, roadSegments: 0,
    naturalProps: 0, lightMasts: 0, profile: plan.nature,
  };
  if (!body.landingZones?.length || body.terrain?.profile === 'gas') {
    body._detailStats = stats;
    return group;
  }

  const roadMat = makeRoadMaterial();
  for (const zone of body.landingZones) {
    const faction = zone.factionId && factionById ? factionById[zone.factionId] : null;
    const accent = faction ? faction.color : plan.tint;

    // Deterministic layout shared with collision.
    const layout = computeSettlementLayout(body, zone, quality);
    const natureLayout = computeNatureLayout(body, zone, quality);
    zone._extraColliders = detailCollidersForLayout(layout)
      .concat(natureCollidersForLayout(natureLayout));

    const town = new THREE.Group();
    town.name = `settlement:${body.id}:${zone.id}`;
    addRoads(town, body, zone, roadMat, terrainRadiusAtFn, stats);
    const rng = mulberry32(hashString(`${body.id}:${zone.id}:vis`));
    for (const spec of layout) {
      const obj = buildSettlementProp(spec, plan, accent, rng);
      if (!obj) continue;
      groundObject(body, zone, spec, obj, terrainRadiusAtFn, spec.type !== 'banner');
      town.add(obj);
      if (spec.type === 'gabled' || spec.type === 'quonset' || spec.type === 'tower') stats.settlementBuildings += 1;
      if (spec.type === 'banner' || spec.type === 'tower') stats.lightMasts += 1;
    }
    enableShadows(town, true, true);
    group.add(town);

    const nature = new THREE.Group();
    nature.name = `terrain-detail:${body.id}:${zone.id}:${plan.nature}`;
    for (const spec of natureLayout) {
      const obj = buildNatureProp(spec, plan, rng);
      if (!obj) continue;
      groundNatureProp(body, zone, spec, obj, terrainRadiusAtFn);
      nature.add(obj);
      stats.naturalProps += 1;
    }
    enableShadows(nature, true, true);
    group.add(nature);
    stats.zonesDetailed += 1;
  }

  body._detailStats = stats;
  return group;
}

function buildSettlementProp(spec, plan, accent, rng) {
  const base = 0x95a4ae;
  switch (spec.type) {
    case 'gabled': return makeGabledBuilding(rng, spec.w, spec.h, spec.d, base, accent, 1.2);
    case 'quonset': return makeQuonsetHut(rng, spec.w, spec.d, base, accent, 1.2);
    case 'tower': return makeBlockTower(rng, Math.min(spec.w, spec.d), spec.h + 3, base, accent, 1.2);
    case 'container': return makeContainer(rng, 0x7d8c96);
    case 'solar': return makeSolarArray(rng);
    case 'canopy': return makeCanopy(rng, spec.w, spec.d, 0x4f7482);
    case 'banner': return makeBanner(rng, accent);
    default: return null;
  }
}

function buildNatureProp(spec, plan, rngShared) {
  const rng = mulberry32(spec.seed >>> 0);
  switch (spec.kind) {
    case 'forest': return rng() < 0.55 ? makeTree(rng, 0x4b3621, plan.tint || 0x6fa35f) : makePine(rng, 0x4b3621, plan.tint || 0x5d8f4e);
    case 'ice': return rng() < 0.7 ? makeIceSpire(rng, 0xb9f2ff) : makeCrystalCluster(rng, 0x9fe8ff);
    case 'volcanic': return makeVent(rng, 0x25201e);
    case 'desert': return rng() < 0.6 ? makeRock(rng, 0xc49a62) : makeBoulderCluster(rng, 0xb08850);
    case 'scrap': return rng() < 0.5 ? makeContainer(rng, 0xa06a3c) : makeBoulderCluster(rng, 0x7d6753);
    case 'archipelago': return rng() < 0.5 ? makeTree(rng, 0x54422c, 0x5e9e6a) : makeRock(rng, 0x76858f);
    case 'ore': return makeCrystalCluster(rng, 0xd8dde2);
    default: return rng() < 0.4 ? makeBoulderCluster(rng, 0x8a8f95) : makeRock(rng, 0x8a8f95);
  }
}

// --- Grounding ---------------------------------------------------------------
// Buildings: base at the LOWEST footprint corner; their built-in foundation
// plinth (height slopeGap+0.4) fills the gap, so walls never hang in the air.
// Buildings stay plumb (radial up) like real construction.
function groundObject(body, zone, spec, obj, terrainRadiusAtFn, plumb = true) {
  const frame = zoneFrame(zone._dirV);
  const dir = zone._dirV.clone()
    .addScaledVector(frame.east, spec.east / body.radius)
    .addScaledVector(frame.north, spec.north / body.radius)
    .normalize();
  const halfE = (spec.w || 4) / 2 + 0.5;
  const halfN = (spec.d || 4) / 2 + 0.5;
  const fp = sampleFootprint(body, dir, halfE, halfN, terrainRadiusAtFn);
  obj.position.copy(dir).multiplyScalar(fp.minR - 0.06);
  orientObject(obj, plumb ? dir : fp.normal, spec.yaw || 0);
}

// Nature: sink into the slope and tilt most of the way toward the terrain
// normal (rocks fully, trees a little — trees grow toward the light).
function groundNatureProp(body, zone, spec, obj, terrainRadiusAtFn) {
  const frame = zoneFrame(zone._dirV);
  const dir = zone._dirV.clone()
    .addScaledVector(frame.east, spec.east / body.radius)
    .addScaledVector(frame.north, spec.north / body.radius)
    .normalize();
  const fp = sampleFootprint(body, dir, 1.6, 1.6, terrainRadiusAtFn);
  const isRock = spec.kind !== 'forest';
  obj.position.copy(dir).multiplyScalar(fp.minR - (isRock ? 0.35 : 0.12));
  const up = isRock ? fp.normal : dir.clone().lerp(fp.normal, 0.25).normalize();
  orientObject(obj, up, (spec.seed % 628) / 100);
}

function addRoads(town, body, zone, roadMat, terrainRadiusAtFn, stats) {
  const specs = [
    { len: 76, w: 5.2, yaw: 0 },
    { len: 62, w: 4.4, yaw: Math.PI / 2 },
  ];
  if (zone.structures === 'transit') specs.push({ len: 118, w: 3.4, yaw: Math.PI / 4 });
  const frame = zoneFrame(zone._dirV);
  for (const rs of specs) {
    // Split into segments, each grounded at its own centre => roads follow
    // the ground instead of bridging over dips.
    const segs = 4;
    const segLen = rs.len / segs;
    for (let i = 0; i < segs; i++) {
      const along = -rs.len / 2 + segLen * (i + 0.5);
      const east = Math.sin(rs.yaw) * along;
      const north = Math.cos(rs.yaw) * along;
      const dir = zone._dirV.clone()
        .addScaledVector(frame.east, east / body.radius)
        .addScaledVector(frame.north, north / body.radius)
        .normalize();
      const fp = sampleFootprint(body, dir, rs.w / 2, segLen / 2, terrainRadiusAtFn);
      const seg = new THREE.Mesh(new THREE.BoxGeometry(rs.w, 0.22, segLen + 0.6), roadMat);
      seg.position.copy(dir).multiplyScalar(fp.avgR + 0.02);
      orientObject(seg, fp.normal, rs.yaw);
      seg.receiveShadow = true;
      town.add(seg);
      stats.roadSegments += 1;
    }
  }
}

function makeRoadMaterial() {
  const tex = roadTexture();
  let map = null;
  if (tex) {
    map = tex.clone();
    map.repeat.set(1, 4);
    map.needsUpdate = true;
  }
  return surfaceMat({ color: 0xffffff, map, mapKey: 'road' });
}

function orientObject(obj, up, yaw = 0) {
  const frame = zoneFrame(up);
  _basis.makeBasis(frame.east, up, frame.north);
  _tmpQ.setFromRotationMatrix(_basis);
  _yawQ.setFromAxisAngle(_worldY, yaw || 0);
  obj.quaternion.copy(_tmpQ).multiply(_yawQ);
}

function zoneFrame(dirUnit) {
  const east = _east.crossVectors(_worldY, dirUnit);
  if (east.lengthSq() < 1e-6) east.set(1, 0, 0);
  east.normalize();
  const north = _north.crossVectors(dirUnit, east).normalize();
  return { east: east.clone(), north: north.clone() };
}

function fallbackPlan(body) {
  if (body.terrain?.profile === 'ice') return { nature: 'ice', settlement: 'research', tint: 0xc6f6ff };
  if (body.terrain?.profile === 'volcanic') return { nature: 'volcanic', settlement: 'forge', tint: 0xff7043 };
  if (body.terrain?.profile === 'dune') return { nature: 'desert', settlement: 'caravan', tint: 0xd6a464 };
  if (body.seaLevel !== null && body.seaLevel !== undefined) return { nature: 'forest', settlement: 'city', tint: 0x8fbc8f };
  return { nature: 'rock', settlement: 'survey', tint: 0x9ea7ad };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function next() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
