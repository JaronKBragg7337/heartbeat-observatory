// ============================================================================
// cinema/stage.js — put the world where a trailer shot starts.
//
// The camera path stays in the shot JSON. This only poses the ship, the sun,
// the elevator, the crew, the hole, and the raider the path is aimed at.
// Stepping the game at the shot's fixed dt from here replays the motion.
// ============================================================================

import * as THREE from 'three';
import { shipDef } from '../ships/registry.js';
import { visualsFor } from '../ships/visuals.js';
import { buildDroneMesh } from '../ship/shipFx.js';
import { FORMATION } from '../ships/raider/escorts.js';
import { ESCORTS_PER_RAIDER } from '../ships/raider/stats.js';
import { TOWER } from '../port/portSpec.js';
import { headingBasis, subjectPoint } from './math.js';

const MORNING = [38, 118];
const DUSK = [7, 205];

let prop = null;

function clearProp(api) {
  if (!prop) return;
  for (const entry of prop.entries) {
    api.engine.untrack(entry);
    if (entry.object3d.parent) entry.object3d.parent.remove(entry.object3d);
  }
  prop = null;
}

function basisQuat(b) {
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(b.right.x, b.right.y, b.right.z),
    new THREE.Vector3(b.up.x, b.up.y, b.up.z),
    new THREE.Vector3(b.back.x, b.back.y, b.back.z),
  ));
}

function placeRaider(api, shot, t) {
  if (!prop) return;
  const frame = shot.frame || 'port';
  const pos = subjectPoint(shot.rig.subject, t, shot.duration);
  const ahead = subjectPoint(shot.rig.subject, Math.min(shot.duration, t + 0.2), shot.duration);
  const world = api.toWorld(pos, frame);
  const worldAhead = api.toWorld(ahead, frame);
  const b = headingBasis(world, worldAhead, api.radialUp(world));
  const q = basisQuat(b);
  Object.assign(prop.entry.worldPos, world);
  prop.entry.quaternion.copy(q);
  for (let i = 0; i < prop.escorts.length; i++) {
    const off = FORMATION[i];
    const weave = Math.sin(t * 1.6 + i * 1.7) * (i === 0 ? 14 : 6);
    const lift = Math.cos(t * 1.3 + i) * 4;
    const local = {
      x: world.x + b.right.x * (off.x + weave) + b.up.x * (off.y + lift) + b.back.x * off.z,
      y: world.y + b.right.y * (off.x + weave) + b.up.y * (off.y + lift) + b.back.y * off.z,
      z: world.z + b.right.z * (off.x + weave) + b.up.z * (off.y + lift) + b.back.z * off.z,
    };
    Object.assign(prop.escorts[i].worldPos, local);
    prop.escorts[i].quaternion.copy(q);
  }
}

function armRaider(api, shot) {
  clearProp(api);
  const def = shipDef('raider');
  const V = visualsFor('raider');
  const dec = V.decalTexture(THREE, def, 'Dust Wolf', def.registryId);
  const ext = V.buildExterior(def.layout, api.ship.matsExt, {
    tier: api.tier || 'high', def, remote: true,
    decal: dec ? new THREE.MeshBasicMaterial({
      map: dec, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }) : null,
  });
  V.applyNeutralPose(ext);
  // Gear up, engines lit: it is flying, not parked.
  for (const leg of ext.legs) {
    leg.foot.position.y = -0.35;
    leg.piston.scale.y = 0.55;
    leg.piston.position.y = 0.2;
  }
  for (const e of ext.engines) {
    e.outer.visible = e.core.visible = true;
    e.outer.scale.set(1.1, 1.1, 1.6);
    e.core.scale.set(1, 1, 1.5);
    e.outer.material.opacity = 0.7;
    e.core.material.opacity = 0.85;
  }
  for (const p of ext.liftPods) {
    p.mesh.visible = p.core.visible = true;
    p.mesh.material.opacity = 0.4;
    p.core.material.opacity = 0.55;
  }
  ext.root.name = 'cinema-raider';
  api.engine.scene.add(ext.root);
  const entry = api.engine.track({ worldPos: { x: 0, y: 0, z: 0 }, object3d: ext.root, quaternion: new THREE.Quaternion() });
  const escorts = [];
  const n = Math.min(ESCORTS_PER_RAIDER, FORMATION.length);
  for (let i = 0; i < n; i++) {
    const mesh = buildDroneMesh();
    mesh.name = 'cinema-escort-' + i;
    api.engine.scene.add(mesh);
    escorts.push(api.engine.track({ worldPos: { x: 0, y: 0, z: 0 }, object3d: mesh, quaternion: new THREE.Quaternion() }));
  }
  // Ahead of and above the hull, so a chase camera sees a rim instead of a black shape.
  const rim = new THREE.PointLight(0xffe6c0, 560, 70, 2);
  rim.name = 'cinema-rim';
  rim.position.set(0, 9, -14);
  rim.castShadow = false;
  ext.root.add(rim);
  prop = { entry, escorts, entries: [entry, ...escorts] };
  let lastFlash = -1;
  api.cinema.driver = (t) => {
    placeRaider(api, shot, t);
    const burst = Math.floor(t * 24) % 8 < 3;
    if (!burst) {
      if (api.ship.extraBolts) api.ship.extraBolts = [];
      return;
    }
    if (!api.ship.fx || t - lastFlash < 0.07) return;
    lastFlash = t;
    const frame = shot.frame || 'port';
    const pos = subjectPoint(shot.rig.subject, t, shot.duration);
    const ahead = subjectPoint(shot.rig.subject, Math.min(shot.duration, t + 0.2), shot.duration);
    const world = api.toWorld(pos, frame);
    const worldAhead = api.toWorld(ahead, frame);
    const b = headingBasis(world, worldAhead, api.radialUp(world));
    const fwd = { x: -b.back.x, y: -b.back.y, z: -b.back.z };
    const at = (x, y, z) => ({
      x: world.x + b.right.x * x + b.up.x * y + b.back.x * z,
      y: world.y + b.right.y * x + b.up.y * y + b.back.y * z,
      z: world.z + b.right.z * x + b.up.z * y + b.back.z * z,
    });
    const events = [];
    const bolts = [];
    const sparks = api.ship.fx.sparks;
    // Nose guns sit on the far side of a chase view. The dorsal turret is on top, where this camera looks.
    const guns = [[-0.75, 6.3, 0.7], [1.15, 6.3, 0.7], [-0.85, 0.6, -17.1], [0.85, 0.6, -17.1]];
    for (const [lx, ly, lz] of guns) {
      const m = at(lx, ly, lz);
      events.push({ type: 'muzzle', gun: 'main', x: m.x, y: m.y, z: m.z, dx: fwd.x, dy: fwd.y, dz: fwd.z, n: 0 });
      bolts.push({
        x: m.x + fwd.x * 10, y: m.y + fwd.y * 10, z: m.z + fwd.z * 10,
        vx: fwd.x * 160, vy: fwd.y * 160, vz: fwd.z * 160, gun: 'enemy', power: 2.6,
      });
      sparks.emit({ x: m.x, y: m.y, z: m.z, life: 0.22, size0: 9, size1: 16, c0: [1, 0.86, 0.4], c1: [1, 0.28, 0.05], alpha: 1 });
    }
    const escort = prop.escorts[Math.floor(t * 4) % prop.escorts.length];
    if (escort) {
      const e = escort.worldPos;
      const m = { x: e.x + fwd.x * 1.6, y: e.y + fwd.y * 1.6, z: e.z + fwd.z * 1.6 };
      sparks.emit({ x: m.x, y: m.y, z: m.z, life: 0.18, size0: 3.5, size1: 6, c0: [1, 0.7, 0.25], c1: [1, 0.2, 0.05], alpha: 1 });
    }
    api.ship.fx.handle(events);
    api.ship.extraBolts = bolts;
    // ship.late already ran. Age the flashes once so the fade is not still zero at the draw.
    api.ship.fx.update(0.05, api.engine.cameraWorldPos, bolts);
  };
  placeRaider(api, shot, 0);
}

function closeHatches(ship) {
  for (const key of ['cargo', 'airlock']) {
    const c = ship.rampCtl && ship.rampCtl[key];
    if (!c) continue;
    c.progress = 0;
    c.target = 0;
  }
  if (ship.air) ship.air.phase = 'idle';
}

function raiseShip(api, metres) {
  const f = api.ship.flight;
  const r = Math.hypot(f.pos.x, f.pos.y, f.pos.z) || 1;
  const R = r + metres;
  f.pos.x *= R / r; f.pos.y *= R / r; f.pos.z *= R / r;
  f.vel.x = f.vel.y = f.vel.z = 0;
  f.landed = false;
  f.airborne = true;
  f.autoHover = true;
  f.gearPos = 0;
  f.attitude = null;
  f.override = null;
  f.refreshOrientation();
  api.ship._syncEntries();
}

function onMars(api) {
  if (api.space.frameId !== 'mars') api.space.setFrame('mars');
}

async function seatCrew(api) {
  const crew = api.crew && api.crew();
  if (!crew || !crew.members) return 0;
  const t0 = performance.now();
  while (performance.now() - t0 < 8000) {
    const any = [...crew.members.values()].some((m) => m.person && m.person.loaded);
    if (any) break;
    await new Promise((r) => setTimeout(r, 80));
  }
  let n = 0;
  for (const m of crew.members.values()) {
    if (!m.person || !m.person.loaded || !m.def) continue;
    const seat = crew._seat(m);
    if (!seat) continue;
    m.status = 'hired';
    m.place = 'ship';
    m.mode = 'sit';
    m.seated = true;
    m.sitT = 1;
    m.displaced = false;
    m.sitFrom = { x: seat.x, y: seat.y, z: seat.z, yaw: (seat.yaw || 0) * Math.PI / 180 };
    if (m.sw) m.sw.place(seat.x, seat.y, seat.z, 0);
    if (crew._attachVisual) crew._attachVisual(m);
    m.person.play('Sit', 0);
    n++;
  }
  return n;
}

function digTunnel(api) {
  const site = api.port.site;
  const edits = api.edits;
  for (let d = 0.2; d <= 9.2; d += 0.55) {
    const p = site.toWorld(148, 0.8 - d, 24);
    edits.dig(p.x, p.y, p.z, 2.25);
  }
  for (let s = 0; s <= 11; s += 0.55) {
    const p = site.toWorld(148, -6.4, 24 - s);
    edits.dig(p.x, p.y, p.z, 2.05);
  }
  const stand = site.toWorld(145.3, 1.65, 27.6);
  const hole = site.toWorld(148, -2.2, 23.4);
  const w = api.walker;
  w.worldPos.x = stand.x; w.worldPos.y = stand.y; w.worldPos.z = stand.z;
  w.velocity = { x: 0, y: 0, z: 0 };
  const f = w.updateFrame();
  const dx = hole.x - stand.x, dy = hole.y - stand.y, dz = hole.z - stand.z;
  const east = dx * f.east.x + dy * f.east.y + dz * f.east.z;
  const north = dx * f.north.x + dy * f.north.y + dz * f.north.z;
  const up = dx * f.up.x + dy * f.up.y + dz * f.up.z;
  w.yaw = Math.atan2(east, north);
  w.pitch = Math.atan2(up, Math.hypot(east, north));
  api.setTool(2);
  api.flush();
  let last = -1;
  api.cinema.driver = (t) => {
    if (t - last < 0.4) return;
    last = t;
    try { api.doDig(); } catch { /* a bite that misses does not fail the shot */ }
  };
}

function callElevator(api) {
  const e = api.port.elevator;
  e.maxSpeed = 5.2;
  e.acceleration = 3;
  e.y = 0;
  e.target = 0;
  e.speed = 0;
  e.open = 1;
  e.phase = 'open';
  e.request(TOWER.cab.floorY);
  api.port.updateElevatorVisuals();
}

/** Pose the world for one shot. Safe to call again: the previous prop is removed. */
export async function runStage(shot, api) {
  clearProp(api);
  api.flight(null);
  api.ship.aboard = false;
  if (api.ship.extraBolts) api.ship.extraBolts = [];
  if (api.ship.seat) api.ship.stations.stand();
  onMars(api);
  api.cinema.grade = null;
  const beat = shot.beat;
  const dusk = beat === 'port-dusk' || beat === 'tower' || beat === 'raider' || beat === 'liftoff';
  api.setSun(...(dusk ? DUSK : MORNING));
  if (shot.id === 'port-dusk') {
    // Low sun, long shadows, and the practicals held on. The shared dusk angle is for the other beats.
    api.setSun(11, 250);
    api.cinema.grade = { sky: 0.18, sun: [1, 0.48, 0.18], sunIntensity: 4.2, portLights: true };
  } else if (shot.id === 'shrike-strafe') {
    api.setSun(16, 40);
    api.cinema.grade = { sky: 0.34, sun: [1, 0.78, 0.48], sunIntensity: 2.6 };
  }

  if (beat === 'tower') callElevator(api);

  if (beat === 'liftoff') {
    closeHatches(api.ship);
    api.flight({ lift: 1, fwd: 0.12, yaw: 0.04, climbCap: 16, autoHover: true, thrustDown: false });
  }

  if (beat === 'climb') {
    closeHatches(api.ship);
    raiseShip(api, 28000);
    api.flight({ lift: 1, fwd: 0.45, yaw: 0.02, climbCap: 420, autoHover: true, thrustDown: false, gearPos: 0 });
  }

  if (beat === 'limb') {
    closeHatches(api.ship);
    raiseShip(api, 78000);
    api.flight({ lift: 0.2, fwd: 0.25, yaw: 0, climbCap: 40, autoHover: true, thrustDown: false, gearPos: 0 });
  }

  if (beat === 'phobos') {
    closeHatches(api.ship);
    const space = api.space;
    if (space.trip) { space.trip = null; api.ship.flight.override = null; }
    space.debugLand('phobos');
    const f = api.ship.flight;
    const up = f.up;
    f.pos.x += up.x * 34;
    f.pos.y += up.y * 34;
    f.pos.z += up.z * 34;
    f.vel.x = f.vel.y = f.vel.z = 0;
    f.landed = false;
    f.airborne = true;
    f.autoHover = true;
    f.thrustDown = true;
    f.gearPos = 1;
    f.attitude = null;
    f.override = null;
    f.refreshOrientation();
    api.ship._syncEntries();
    space.moonWorld('phobos').force(f.pos);
    api.flight({ lift: -0.85, fwd: 0.02, yaw: 0, thrustDown: true, autoHover: true, climbCap: 14 });
  }

  if (beat === 'raider') armRaider(api, shot);

  if (beat === 'crew') {
    // Seat them and leave the clock at t = 0. The shot's own steps place the sit pose.
    // Stepping the engine here would also advance the film clock.
    shot._crewSeated = await seatCrew(api);
    api.flight({ lift: 0, fwd: 0, yaw: 0, autoHover: true });
  }

  if (beat === 'tunnel') {
    digTunnel(api);
    api.cinema.grade = { lamp: 28 };
  }
}
