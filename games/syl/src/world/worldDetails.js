// ============================================================================
// worldDetails.js - lightweight surface dressing for SYL worlds.
//
// OWNS: visual-only settlement, town, forest, rock, ice, and hazard dressing.
// DOES NOT OWN: terrain truth, collision, saves, loot, or discovery state.
// The layer is deterministic from body/zone ids and rides on terrainRadiusAt().
// ============================================================================

import * as THREE from 'three';

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

export function buildWorldDetailLayer(body, factionById, terrainRadiusAtFn, options = {}) {
  const quality = options.quality || 'mobile';
  const group = new THREE.Group();
  group.name = `world-detail:${body.id}`;

  const plan = BODY_DETAIL[body.id] || fallbackPlan(body);
  const stats = {
    zonesDetailed: 0,
    settlementBuildings: 0,
    roadSegments: 0,
    naturalProps: 0,
    lightMasts: 0,
    profile: plan.nature,
  };
  if (!body.landingZones?.length || body.terrain?.profile === 'gas') {
    body._detailStats = stats;
    return group;
  }

  const mats = makeMaterials(plan, body, factionById);
  for (const zone of body.landingZones) {
    const faction = zone.factionId && factionById ? factionById[zone.factionId] : null;
    addSettlementCluster(group, body, zone, faction, plan, mats, terrainRadiusAtFn, quality, stats);
    addNatureCluster(group, body, zone, plan, mats, terrainRadiusAtFn, quality, stats);
    stats.zonesDetailed += 1;
  }

  body._detailStats = stats;
  return group;
}

function addSettlementCluster(group, body, zone, faction, plan, mats, terrainRadiusAtFn, quality, stats) {
  const rng = mulberry32(hashString(`${body.id}:${zone.id}:settlement`));
  const town = new THREE.Group();
  town.name = `settlement:${body.id}:${zone.id}`;
  let baseCount = zone.structures === 'transit' ? 12
    : zone.structures === 'outpost' ? 10
      : zone.structures === 'depot' ? 7
        : zone.structures === 'relay' ? 5 : 4;
  if (quality === 'desktop') baseCount = Math.min(baseCount, 5);
  const count = baseCount + (quality === 'desktop' ? 1 : 0);
  const accent = faction ? faction.color : plan.tint;
  const accentMat = new THREE.MeshBasicMaterial({ color: accent });

  addRoad(town, body, zone, 0, 0, 76, 5.2, 0, mats.road, terrainRadiusAtFn, stats);
  addRoad(town, body, zone, 0, 0, 62, 4.4, Math.PI / 2, mats.road, terrainRadiusAtFn, stats);
  if (zone.structures === 'transit' || plan.settlement === 'city') {
    addRoad(town, body, zone, 0, 0, 118, 3.4, Math.PI / 4, mats.road, terrainRadiusAtFn, stats);
  }

  for (let i = 0; i < count; i++) {
    const ring = 42 + rng() * 82 + (i % 3) * 10;
    const a = i * 2.399963 + rng() * 0.55;
    const east = Math.cos(a) * ring;
    const north = Math.sin(a) * ring;
    if (Math.hypot(east, north) < 34) continue;
    const w = 5 + rng() * (zone.structures === 'transit' ? 8 : 5);
    const d = 5 + rng() * 8;
    const h = 4 + rng() * (plan.settlement === 'city' ? 9 : 6);
    const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.building);
    block.name = `detail-building:${zone.id}:${i}`;
    placeOffset(body, zone, east, north, block, h / 2, a + Math.PI / 2, terrainRadiusAtFn);
    town.add(block);
    stats.settlementBuildings += 1;

    if (i % 3 === 0) {
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.58, 2.2, 4), mats.roof);
      roof.name = `detail-roof:${zone.id}:${i}`;
      placeOffset(body, zone, east, north, roof, h + 1.1, a + Math.PI / 4, terrainRadiusAtFn);
      town.add(roof);
    }
    if (i % 4 === 0) {
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), accentMat);
      light.name = `detail-light:${zone.id}:${i}`;
      placeOffset(body, zone, east * 0.92, north * 0.92, light, h + 2.6, 0, terrainRadiusAtFn);
      town.add(light);
      stats.lightMasts += 1;
    }
  }

  if (zone.structures === 'transit') {
    for (const side of [-1, 1]) {
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(32, 2.2, 8), mats.canopy);
      canopy.name = `detail-passenger-canopy:${zone.id}:${side}`;
      placeOffset(body, zone, side * 36, 18, canopy, 4.6, side * 0.18, terrainRadiusAtFn);
      town.add(canopy);
      stats.settlementBuildings += 1;
    }
  }

  group.add(town);
}

function addNatureCluster(group, body, zone, plan, mats, terrainRadiusAtFn, quality, stats) {
  const rng = mulberry32(hashString(`${body.id}:${zone.id}:nature`));
  const nature = new THREE.Group();
  nature.name = `terrain-detail:${body.id}:${zone.id}:${plan.nature}`;
  const count = quality === 'desktop' ? 8 : 18 + (plan.nature === 'forest' ? 8 : 0);

  for (let i = 0; i < count; i++) {
    const ring = 88 + rng() * 210;
    const a = i * 2.199115 + rng() * 0.9;
    const east = Math.cos(a) * ring;
    const north = Math.sin(a) * ring;
    if (Math.hypot(east, north) < 70) continue;
    addNatureProp(nature, body, zone, plan.nature, mats, east, north, i, rng, terrainRadiusAtFn);
    stats.naturalProps += 1;
  }
  group.add(nature);
}

function addNatureProp(group, body, zone, kind, mats, east, north, i, rng, terrainRadiusAtFn) {
  if (kind === 'forest') {
    const trunkH = 3.2 + rng() * 3.2;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, trunkH, 6), mats.trunk);
    trunk.name = `detail-tree-trunk:${zone.id}:${i}`;
    placeOffset(body, zone, east, north, trunk, trunkH / 2, rng() * Math.PI, terrainRadiusAtFn);
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(2.1 + rng() * 1.1, 4.6 + rng() * 2.4, 7), mats.leaf);
    crown.name = `detail-tree-crown:${zone.id}:${i}`;
    placeOffset(body, zone, east, north, crown, trunkH + 2.1, rng() * Math.PI, terrainRadiusAtFn);
    group.add(crown);
    return;
  }

  if (kind === 'ice') {
    const h = 4 + rng() * 9;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.2 + rng() * 1.2, h, 6), mats.ice);
    spire.name = `detail-ice-spire:${zone.id}:${i}`;
    placeOffset(body, zone, east, north, spire, h / 2, rng() * Math.PI, terrainRadiusAtFn);
    group.add(spire);
    return;
  }

  if (kind === 'volcanic') {
    const h = 2.2 + rng() * 4.5;
    const vent = new THREE.Mesh(new THREE.ConeGeometry(2.8 + rng() * 2.6, h, 9), mats.basalt);
    vent.name = `detail-volcanic-vent:${zone.id}:${i}`;
    placeOffset(body, zone, east, north, vent, h / 2, rng() * Math.PI, terrainRadiusAtFn);
    group.add(vent);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.8 + rng() * 0.6, 8, 6), mats.lava);
    glow.name = `detail-vent-glow:${zone.id}:${i}`;
    placeOffset(body, zone, east, north, glow, h + 0.35, 0, terrainRadiusAtFn);
    group.add(glow);
    return;
  }

  if (kind === 'desert') {
    const sail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 5 + rng() * 4, 9 + rng() * 8), mats.windbreak);
    sail.name = `detail-windbreak:${zone.id}:${i}`;
    placeOffset(body, zone, east, north, sail, 2.8, rng() * Math.PI, terrainRadiusAtFn);
    group.add(sail);
    return;
  }

  if (kind === 'archipelago') {
    const pylonH = 5 + rng() * 7;
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.9, pylonH, 7), mats.pylon);
    pylon.name = `detail-harbor-pylon:${zone.id}:${i}`;
    placeOffset(body, zone, east, north, pylon, pylonH / 2, 0, terrainRadiusAtFn);
    group.add(pylon);
    return;
  }

  const rockH = 1.4 + rng() * 3.8;
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rockH, 0), mats.rock);
  rock.name = `detail-rock:${zone.id}:${i}`;
  rock.scale.set(1 + rng() * 1.4, 0.6 + rng() * 0.9, 0.9 + rng() * 1.3);
  placeOffset(body, zone, east, north, rock, rockH * 0.55, rng() * Math.PI, terrainRadiusAtFn);
  group.add(rock);
}

function addRoad(group, body, zone, east, north, length, width, yaw, mat, terrainRadiusAtFn, stats) {
  const road = new THREE.Mesh(new THREE.BoxGeometry(width, 0.18, length), mat);
  road.name = `detail-road:${zone.id}:${stats.roadSegments}`;
  placeOffset(body, zone, east, north, road, 0.09, yaw, terrainRadiusAtFn);
  group.add(road);
  stats.roadSegments += 1;
}

function makeMaterials(plan, body) {
  const base = new THREE.Color(body.colors.mid || 0x607d8b);
  const high = new THREE.Color(body.colors.high || plan.tint);
  return {
    building: new THREE.MeshLambertMaterial({ color: base.clone().lerp(high, 0.28) }),
    roof: new THREE.MeshLambertMaterial({ color: 0x2c3438 }),
    road: new THREE.MeshLambertMaterial({ color: 0x20282d }),
    canopy: new THREE.MeshLambertMaterial({ color: 0x334148 }),
    trunk: new THREE.MeshLambertMaterial({ color: 0x4b3621 }),
    leaf: new THREE.MeshLambertMaterial({ color: plan.tint || 0x6fa35f }),
    ice: new THREE.MeshLambertMaterial({ color: 0xb9f2ff, transparent: true, opacity: 0.82 }),
    basalt: new THREE.MeshLambertMaterial({ color: 0x25201e }),
    lava: new THREE.MeshBasicMaterial({ color: 0xff6d00 }),
    windbreak: new THREE.MeshLambertMaterial({ color: 0x8f6a3a }),
    pylon: new THREE.MeshLambertMaterial({ color: 0x546e7a }),
    rock: new THREE.MeshLambertMaterial({ color: base.clone().lerp(new THREE.Color(0x999999), 0.25) }),
  };
}

function placeOffset(body, zone, eastM, northM, obj, extraHeight, yaw, terrainRadiusAtFn) {
  const frame = zoneFrame(zone._dirV);
  const dir = zone._dirV.clone()
    .addScaledVector(frame.east, eastM / body.radius)
    .addScaledVector(frame.north, northM / body.radius)
    .normalize();
  const r = terrainRadiusAtFn(body, dir) + extraHeight;
  obj.position.copy(dir).multiplyScalar(r);
  orientObject(obj, dir, yaw);
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
