// ============================================================================
// main.js — bootstrap and frame order. Nothing else lives here.
//
// OWNS: wiring the systems together and the deliberate order they tick in.
// DOES NOT OWN: any system's internals. If logic belongs to a system, it goes
//       in that system's file.
//
// FRAME ORDER (deliberate):
//   input -> walker physics -> patch rebuild -> camera -> lighting -> debug
//
// The patch rebuilds AFTER physics because the player must be able to walk
// past the edge of the loaded ground without falling: contact is a field
// query, so the ground is always there whether or not it has been drawn yet.
// ============================================================================

import * as THREE from 'three';
import { depthEmulation } from './dev/depthEmu.js';
import { auditGaps } from './dev/gapAudit.js';
import { Engine } from './core/engine.js';
import { registry } from './core/registry.js';
import { BODIES, getBody } from './world/bodies.js';
import { buildGlobalShell, LocalPatch } from './world/planetMesh.js';
import { geodeticToCartesian, cartesianToGeodetic, formatCoord, coordSlug } from './world/geodesy.js';
import { surfaceRadiusAlong, surfaceRadiusFast, materialAt, MATERIALS, attachEdits, attachGrades, density, normalAt, raycast, baseDensityAt } from './world/field.js';
import { EditStore } from './world/edits.js';
import { Digger } from './player/digging.js';
import { EditedTerrain, installCoverDiscard } from './world/excavation.js';
import { Walker } from './player/walker.js';
import { TouchControls, DesktopControls } from './ui/touch.js';
import { DebugLayer } from './dev/debugLayer.js';
import { ShipSystem } from './ship/shipSystem.js';
import { ShipUI } from './ship/shipUI.js';
import { createPortSite, PADS } from './port/portSpec.js';
import { PortSystem } from './port/portSystem.js';
import { makePortTour } from './port/portTour.js';
import { PeopleLibrary } from './crew/personRig.js';
import { CrewSystem } from './crew/crewSystem.js';
import { CrewUI } from './crew/crewUI.js';

const canvas = document.getElementById('game-canvas');
const engine = new Engine(canvas, { fov: 72 });
const body = getBody('mars');

// --- Spawn. A real place, not a random direction. ---------------------------
// Valles Marineris: the canyon floor gives immediate scale and a horizon with
// something in it. Chosen from the landmark table, so it has an address.
const SPAWN = { lat: -14.0, lon: -59.2, name: 'Valles Marineris' };
const portSite = createPortSite(body, SPAWN);
attachGrades([portSite]);

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------
const shell = buildGlobalShell(body, { segments: 128 });
const shellEntry = engine.track({ worldPos: { x: 0, y: 0, z: 0 }, object3d: shell });
engine.scene.add(shell);
registry.register({
  id: `COS-MARS-TER-0001`, bodyId: 'mars', type: 'TER',
  name: 'Mars global shell', position: { x: 0, y: 0, z: 0 },
  collision: 'field', materialId: 'MAT-BASALT',
  note: 'Coarse whole-planet render surface. Not the collision authority.',
});

// --- Terrain: the original geology at three resolutions, and the dug ground on top. ----
// shell   whole planet, ~83 km between vertices  (horizon, orbit)
// mid     880 m across,  6.72 m between vertices (the middle distance)
// near     48 m across,  0.60 m between vertices (the ground at your feet)
// bricks  3.2 m cubes of 0.1 m lattice wherever the ground has been changed (excavation.js)
//
// The three heightfield tiers draw the ORIGINAL geology and never look at edits. The brick
// meshes draw the truth wherever somebody has dug or dumped, and the tiers are told (a
// per-pixel discard under every built brick) to leave that ground alone. Before this, the
// heightfields tried to carve holes for the edits in whole quads, which is why a hole
// narrower than a quad was covered over by the quad, and why the mid-distance tier put a
// lid back on a hole as soon as you walked off and returned.
const params = new URLSearchParams(location.search);
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const tier = params.get('tier') === 'low' || params.get('tier') === 'high' ? params.get('tier') : (isTouch ? 'low' : 'high');

const patch = new LocalPatch(body, { sizeM: 880, res: 132 });
engine.scene.add(patch.mesh);
const patchEntry = engine.track({ worldPos: patch.worldPos, object3d: patch.mesh });

const nearPatch = new LocalPatch(body, { sizeM: 48, res: 81 });
nearPatch.mesh.name = `patch-near:${body.id}`;
engine.scene.add(nearPatch.mesh);
const nearEntry = engine.track({ worldPos: nearPatch.worldPos, object3d: nearPatch.mesh });

// ---------------------------------------------------------------------------
// Excavation. The ground is a solid object; this is what takes pieces out.
// ---------------------------------------------------------------------------
const edits = new EditStore(body);
attachEdits(edits);
// Phone tier meshes a little closer and spends less of each frame doing it.
const terrain = new EditedTerrain(engine, body, edits, {
  rangeM: tier === 'low' ? 56 : 90, budgetMs: tier === 'low' ? 3 : 6,
});
const midCover = { value: new THREE.Vector3() }, nearCover = { value: new THREE.Vector3() };
installCoverDiscard(patch.mesh.material, terrain.cover, midCover, THREE);
installCoverDiscard(nearPatch.mesh.material, terrain.cover, nearCover, THREE);

/** Keep the near patch under the player, and the mid patch out from under the near patch (the two would
 *  z-fight: they agree at shared vertices but the coarse one runs straight lines across ground the fine one
 *  curves over). `force` rebuilds both at once (spawn, teleport, review shots). Otherwise a rebuild is only
 *  STARTED here and finished a couple of milliseconds a frame by stepPatches(), so crossing 13 m (near) or
 *  250 m (wide) of ground is not a freeze. The mid patch is not re-sampled just to move its hole: that is an
 *  index rebuild. */
function rebuildNear(force = false) {
  const wp = walker.worldPos;
  if (force) {
    nearPatch._job = null; patch._job = null;
    nearPatch.rebuild(wp.x, wp.y, wp.z);
    nearEntry.worldPos = nearPatch.worldPos;
    const np = nearPatch.worldPos;
    patch.setExcluded([{ centre: { x: np.x, y: np.y, z: np.z }, radius: nearPatch.sizeM * 0.40 }]);
    patch.rebuild(wp.x, wp.y, wp.z);
    patchEntry.worldPos = patch.worldPos;
    return;
  }
  if (!nearPatch.rebuilding && nearPatch.needsRebuild(wp.x, wp.y, wp.z)) nearPatch.beginRebuild(wp.x, wp.y, wp.z);
  if (!patch.rebuilding && patch.needsRebuild(wp.x, wp.y, wp.z)) patch.beginRebuild(wp.x, wp.y, wp.z);
}

/** Finish any patch rebuild that is under way, within a frame budget. */
function stepPatches(budgetMs) {
  if (nearPatch.rebuilding) {
    if (nearPatch.stepRebuild(budgetMs)) {
      nearEntry.worldPos = nearPatch.worldPos;
      const np = nearPatch.worldPos;
      patch.setExcluded([{ centre: { x: np.x, y: np.y, z: np.z }, radius: nearPatch.sizeM * 0.40 }]);
    }
  } else if (patch.rebuilding) {
    if (patch.stepRebuild(budgetMs)) patchEntry.worldPos = patch.worldPos;
  }
}

// ---------------------------------------------------------------------------
// THE TOOLS and what a person does with them live in player/digging.js (pure, so the
// validator can play a whole dig-and-dump shift against the real field). Here they are wired
// to the body and the buttons.
// ---------------------------------------------------------------------------
let digger = null;                       // made once the walker exists
const tool = () => digger.tool;
const carried = [];
const carriedMass = () => digger.carriedMass();
const carriedVolume = () => digger.carriedVolume();
const setTool = (i) => digger.setTool(i);
const digTarget = (r) => digger.digTarget(r);
const dumpPlan = (lot) => digger.dumpPlan(lot);
const groundBelowPoint = (...a) => digger.groundBelowPoint(...a);
function doDig() {
  if (ship.ready && ship.aboard) return { ok: false, msg: 'Not aboard' };
  return digger.dig();
}
function doDump() { return digger.dump(); }

// ---------------------------------------------------------------------------
// AIM MARKER — where the tool will actually bite, drawn at its real size.
//
// Not a decoration. The ring lies on the surface you are aiming at (it follows the surface's
// own slope, so on a pit wall it stands up) at the width of the bite where it enters the
// ground, and the stem is how far in this scoop goes. The spoil marker is where the load
// will land and how wide the heap will be.
// ---------------------------------------------------------------------------
function buildAimMarker(hex) {
  const g = new THREE.Group();
  const glow = (geo, opacity) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: hex, transparent: true, opacity, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  const rim = glow(new THREE.RingGeometry(0.88, 1.0, 56), 0.95);
  const fill = glow(new THREE.CircleGeometry(1.0, 56), 0.13);
  const stem = glow(new THREE.CylinderGeometry(0.045, 0.045, 1, 10, 1, true), 0.5);
  stem.rotation.x = Math.PI / 2;          // cylinder is +Y; the stem runs along -Z
  g.add(rim, fill, stem);
  g.renderOrder = 10;
  g.frustumCulled = false;
  for (const m of g.children) m.frustumCulled = false;
  return { group: g, rim, fill, stem };
}

// Amber for cutting, cyan for placing. Two verbs, two colours, same shape.
const digMark = buildAimMarker(0xffb057);
const dropMark = buildAimMarker(0x63e0ff);
engine.scene.add(digMark.group, dropMark.group);
const digMarkEntry = engine.track({
  worldPos: { x: 0, y: 0, z: 0 }, object3d: digMark.group, quaternion: new THREE.Quaternion(),
});
const dropMarkEntry = engine.track({
  worldPos: { x: 0, y: 0, z: 0 }, object3d: dropMark.group, quaternion: new THREE.Quaternion(),
});
const _markUp = new THREE.Vector3(), _markZ = new THREE.Vector3(0, 0, 1);

/** Lay a marker on a surface at a world point, facing along the surface normal. */
function placeMarker(mark, entry, at, normal, radius, depth, pulse) {
  if (!at) { mark.group.visible = false; return; }
  const nl = Math.hypot(normal.x, normal.y, normal.z) || 1;
  _markUp.set(normal.x / nl, normal.y / nl, normal.z / nl);
  entry.quaternion.setFromUnitVectors(_markZ, _markUp);
  entry.worldPos.x = at.x + _markUp.x * 0.02;
  entry.worldPos.y = at.y + _markUp.y * 0.02;
  entry.worldPos.z = at.z + _markUp.z * 0.02;
  mark.group.scale.setScalar(radius);
  mark.stem.scale.set(1, Math.max(0.001, depth / radius), 1);
  mark.stem.position.set(0, 0, -depth / 2 / radius);
  // Additive on bright regolith saturates to white and both markers stop being different
  // colours, which is the one thing they have to be. Keep it low enough to tint.
  mark.rim.material.opacity = 0.42 + 0.18 * pulse;
  mark.fill.material.opacity = 0.055 + 0.035 * pulse;
  mark.stem.material.opacity = 0.30 + 0.15 * pulse;
  mark.group.visible = true;
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------
const walker = new Walker(body);
digger = new Digger(body, edits, walker);
digger.carried = carried;
const TOOLS = digger.tools;
// The surveyed port reads the field directly. Where the ground has been dug or dumped on, contact
// is the field itself (the heightfield tiers are not drawing it, and only the field knows the
// shape of a hole). Elsewhere, outside the earthworks, the drawn surface is what you stand on:
// collision must sample whatever the player sees.
let portRef = null;                      // the port, once it is built (the stair and the cab are floors above the ground)
walker.groundSampler = (dx, dy, dz, r) => {
  if (portRef) { const tf = portRef.towerFloorRadius(dx * r, dy * r, dz * r); if (tf !== null) return tf; }
  if (!edits.isEmpty && terrain.touchedAt(dx * r, dy * r, dz * r)) return null;
  const sr = surfaceRadiusFast(body, dx, dy, dz, 3, { ignoreEdits: true });
  if (portSite.weight(dx * sr, dy * sr, dz * sr) > 0) return sr;
  const near = nearPatch.surfaceRadiusAt(dx, dy, dz);
  if (near !== null) return near;
  return patch.surfaceRadiusAt(dx, dy, dz);
};
// A body is more than a point at the feet: near dug ground it must also keep its shins, hips
// and head out of rock, or a tunnel's wall is a suggestion and the camera ends up in the dirt.
walker.collisionActive = (x, y, z) => !edits.isEmpty && edits.affects(x, y, z, 2.5);

// Every arrival begins beside the Meridian's ramp on surveyed ground.
Object.assign(walker.worldPos, portSite.toWorld(-10, 0.02, 38));
walker.grounded = true;
walker.updateFrame();
rebuildNear(true);

registry.register({
  id: 'COS-MARS-CHR-0001', bodyId: 'mars', type: 'CHR',
  name: 'Player (EVA suit)', position: walker.worldPos,
  authored: { width: 0.48, height: walker.heightM, depth: 0.55 },
  massKg: walker.massKg, collision: 'capsule', materialId: 'MAT-SUIT',
});

// ---------------------------------------------------------------------------
// The ship. A landed 46-tonne gunship a few dozen metres from the spawn point.
// Its landing contact always reads the field, independent of moving mesh LODs.
// ---------------------------------------------------------------------------
const groundRadius = (dx, dy, dz) => {
  return surfaceRadiusFast(body, dx, dy, dz);
};
const ship = new ShipSystem({ engine, body, registry, ground: groundRadius, walker, spawn: SPAWN, tier, landingSite: portSite });
let shipUI = null;
try {
  ship.build();
  shipUI = new ShipUI(ship, { isTouch });
  // Start the player looking at the ship.
  walker.yaw = portSite.heading + Math.atan2(10,38);
} catch (err) {
  console.error('Ship failed to build', err);
  ship.ready = false;
}
// Reuse the actual Meridian texture objects and sky environment: no second
// ship-sized texture set for the port. Fallback still allows independent builds.
const port = new PortSystem(engine, registry, portSite, tier, ship.matsExt).build();
portRef = port;
port.padOccupancy = () => {
  if (!ship.flight.landed) return [];
  const p = portSite.toLocal(ship.flight.pos);
  return PADS.filter(a => Math.abs(p.x-a.x)<a.w/2 && Math.abs(p.z-a.z)<a.d/2).map(a=>a.number);
};
port.updateDisplays();
const portTour = makePortTour({ engine, walker, ship: () => ship, port, rebuild: () => rebuildNear(true) });

// --- Third-person body: a real person. The Loft people (homes/people) are MetaHuman-built, skinned, with Idle and Walk
// --- clips. Until the model has loaded (a second or two) a plain capsule figure of the same real dimensions stands in, so
// --- the registry entry and the shadow are never empty. `hb-look` is the person you picked in the Loft (default Isaiah).
const suitGroup = new THREE.Group();
suitGroup.name = 'player-body';
const people = new PeopleLibrary({ phone: tier === 'low' });
let playerLook = 'isaiah';
try { playerLook = localStorage.getItem('hb-look') || 'isaiah'; } catch (e) { /* storage may be blocked */ }
const stand_in = [];
{
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.24, 0.62, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0xd8d5cc, roughness: 0.62, metalness: 0.08 })
  );
  torso.position.y = 1.06;
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 20, 16),
    new THREE.MeshStandardMaterial({ color: 0x2a3138, roughness: 0.18, metalness: 0.5 })
  );
  helmet.position.y = 1.61;   // crown lands at exactly 1.78 m
  const pack = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.44, 0.18),
    new THREE.MeshStandardMaterial({ color: 0xb9b3a6, roughness: 0.75 })
  );
  pack.position.set(0, 1.12, -0.22);
  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.5, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0xcfcabf, roughness: 0.7 }));
  legL.position.set(-0.13, 0.36, 0);   // soles land at exactly 0.00 m
  const legR = legL.clone(); legR.position.x = 0.13;
  stand_in.push(torso, helmet, pack, legL, legR);
  suitGroup.add(...stand_in);
  suitGroup.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}
const playerPerson = people.spawn(playerLook);
playerPerson.ready.then((p) => {
  if (!p.loaded) return;                                  // the folder was unreachable: the stand-in stays
  for (const c of stand_in) suitGroup.remove(c);
  suitGroup.add(p.group);
});
engine.scene.add(suitGroup);
const suitEntry = engine.track({ worldPos: walker.worldPos, object3d: suitGroup });
registry.get('COS-MARS-CHR-0001').object3d = suitGroup;
registry.measure('COS-MARS-CHR-0001', THREE);
playerPerson.ready.then((p) => {
  if (!p.loaded) return;
  // the person's box is the skinned rest pose (arms out): record that as what this model is
  const m = registry.measure('COS-MARS-CHR-0001', THREE);
  const rec = registry.get('COS-MARS-CHR-0001');
  rec.name = `Player (${playerLook})`;
  rec.authored = { width: Math.round(m.width * 100) / 100, height: Math.round(m.height * 100) / 100, depth: Math.round(m.depth * 100) / 100 };
});

// --- The crew: five people waiting at the port to be hired (src/crew). Built once the ship and the port are.
let crew = null, crewUI = null;
if (ship.ready) {
  const c = new CrewSystem({ engine, ship, site: portSite, people, ground: groundRadius, walker, tier, playerLook });
  c.build().then(() => { crew = c; ship.crew = c; crewUI = new CrewUI(c, { ship, walker, isTouch }); }).catch((e) => console.error('Crew failed to build', e));
}

// --- Landmark markers, so the debug layer has real registered assets --------
// --- to label from the first frame.
for (const lm of body.landmarks) {
  const p = geodeticToCartesian(body, lm.lat, lm.lon, 0);
  const l = Math.hypot(p.x, p.y, p.z);
  const R = surfaceRadiusAlong(body, p.x / l, p.y / l, p.z / l, { minStep: 8 });
  registry.register({
    id: lm.id, bodyId: 'mars', type: 'LMK', name: lm.name,
    position: { x: (p.x / l) * R, y: (p.y / l) * R, z: (p.z / l) * R },
    collision: 'none', note: lm.note,
  });
}

// --- A survey marker at spawn: one measured, ID'd, physical object you can ---
// --- walk up to, so the identity system is demonstrable on frame one.
{
  const r = Math.hypot(walker.worldPos.x, walker.worldPos.y, walker.worldPos.z);
  const f = { x: walker.worldPos.x / r, y: walker.worldPos.y / r, z: walker.worldPos.z / r };
  const east = { x: -f.z, y: 0, z: f.x };
  const el = Math.hypot(east.x, east.z) || 1;
  const MAST_H = 2.4, MAST_R = 0.045;

  const mast = new THREE.Group();
  mast.name = 'survey-mast';
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(MAST_R, MAST_R, MAST_H, 10),
    new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.42, metalness: 0.85 })
  );
  pole.position.y = MAST_H / 2;
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.30, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xe8a33d, roughness: 0.55, metalness: 0.2 })
  );
  plate.position.y = MAST_H - 0.28;
  const foot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.30, 0.10, 12),
    new THREE.MeshStandardMaterial({ color: 0x8d9196, roughness: 0.7, metalness: 0.5 })
  );
  foot.position.y = 0.05;
  mast.add(pole, plate, foot);
  mast.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  const mastPos = {
    x: walker.worldPos.x + (east.x / el) * 6,
    y: walker.worldPos.y,
    z: walker.worldPos.z + (east.z / el) * 6,
  };
  const ml = Math.hypot(mastPos.x, mastPos.y, mastPos.z);
  const mR = surfaceRadiusAlong(body, mastPos.x / ml, mastPos.y / ml, mastPos.z / ml, { minStep: 0.4 });
  mastPos.x = (mastPos.x / ml) * mR;
  mastPos.y = (mastPos.y / ml) * mR;
  mastPos.z = (mastPos.z / ml) * mR;

  // Orient the mast so its +Y is the local up. A mast leaning off-plumb is
  // exactly the kind of placement error the validator exists to catch.
  const up = new THREE.Vector3(mastPos.x, mastPos.y, mastPos.z).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
  mast.quaternion.copy(q);

  engine.scene.add(mast);
  engine.track({ worldPos: mastPos, object3d: mast, quaternion: q });
  const rec = registry.register({
    id: 'COS-MARS-STR-0001', bodyId: 'mars', type: 'STR',
    name: 'Survey mast', position: mastPos,
    authored: { width: 0.60, height: MAST_H, depth: 0.60 },
    massKg: 34, collision: 'box', materialId: 'MAT-ALUMINIUM',
    object3d: mast,
    note: 'Reference marker at the spawn coordinate. Plumb to local up.',
  });
  registry.measure(rec.id, THREE);
}

// ---------------------------------------------------------------------------
// Lighting — sun angle and sky from the body's real atmosphere.
// ---------------------------------------------------------------------------
const sun = new THREE.DirectionalLight(0xffe9d2, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 220;
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;

// SHADOW BIAS. This is what made dug ground look corrugated.
//
// The shadow map is 1024 texels over 120 m, so one texel is 0.117 m of ground.
// The excavated mesh has cells a third of that, and it casts. With no bias, a
// surface samples its own depth from a texel that covers several of its own
// cells, so alternate rows decide they are in their own shadow — striping that
// follows the cell grid and reads exactly like corrugation. It looked like a
// meshing bug and was a lighting one.
//
// Measured on the frame buffer, luminance direction changes per row over the
// dug area: 12.2 as shipped, 1.7 with the excavation not casting at all, 2.5 at
// normalBias 0.03, 1.7 at 0.08. So 0.08 costs nothing and removes it entirely.
// normalBias rather than bias because it scales with the angle to the light,
// which is where the acne actually lives — on ground the sun rakes across.
sun.shadow.normalBias = 0.08;
sun.shadow.bias = -0.0006;
engine.scene.add(sun, sun.target);

// Mars' sky is dust-scattered butterstotch, and the ground bounce is strong
// because the regolith is bright. Both colours come from the body record.
// The suit lamp: it comes on in a hole (below), a warm pool of light that falls off with distance so the walls
// have depth and the strata read. It rides at the eye, which is the origin of render space.
const suitLamp = new THREE.PointLight(0xffe6c8, 0, 24, 1.5);
engine.scene.add(suitLamp);
const sky = new THREE.HemisphereLight(
  body.atmosphere.skyColor, MATERIALS.regolith.color, 0.85);
engine.scene.add(sky);
engine.scene.background = new THREE.Color(body.atmosphere.skyColor);
engine.scene.fog = new THREE.FogExp2(body.atmosphere.horizonColor, 0.00016);

// Stars, visible because the atmosphere is thin.
{
  const n = 2200, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = ((i * 2654435761) % 100000) / 100000 * 2 - 1;
    const th = i * 2.399963;
    const s = Math.sqrt(1 - u * u);
    pos[i * 3] = s * Math.cos(th) * 1e6;
    pos[i * 3 + 1] = u * 1e6;
    pos[i * 3 + 2] = s * Math.sin(th) * 1e6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({
    color: 0xdfe8ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.55,
  }));
  stars.name = 'starfield';
  stars.frustumCulled = false;
  engine.scene.add(stars);
}

// ---------------------------------------------------------------------------
// Input + camera
// ---------------------------------------------------------------------------
const touch = new TouchControls(canvas);
const desktop = new DesktopControls(canvas);

const view = { mode: 'first', distance: 4.2 };   // 'first' | 'third'
const eye = { x: 0, y: 0, z: 0 };

// Sun position as an observer on the ground would measure it: degrees above
// the local horizon, and degrees clockwise from local north. Mid-morning gives
// long enough shadows to read the terrain's shape.
const SUN = {
  elevationRad: 38 * Math.PI / 180,
  azimuthRad: 118 * Math.PI / 180,
};

function updateCamera() {
  walker.eyeWorldPos(eye);
  const f = walker.updateFrame();

  // Build the look basis from the local frame so "up" is the planet's up.
  const up = new THREE.Vector3(f.up.x, f.up.y, f.up.z);
  const north = new THREE.Vector3(f.north.x, f.north.y, f.north.z);
  const east = new THREE.Vector3(f.east.x, f.east.y, f.east.z);

  const cy = Math.cos(walker.yaw), sy = Math.sin(walker.yaw);
  const cp = Math.cos(walker.pitch), sp = Math.sin(walker.pitch);

  const fwd = new THREE.Vector3()
    .addScaledVector(north, cy * cp)
    .addScaledVector(east, sy * cp)
    .addScaledVector(up, sp)
    .normalize();

  if (view.mode === 'first') {
    engine.cameraWorldPos.x = eye.x;
    engine.cameraWorldPos.y = eye.y;
    engine.cameraWorldPos.z = eye.z;
    suitGroup.visible = false;
  } else {
    // Pull back along -forward, then lift a little, and never let the camera
    // end up inside the ground.
    const d = view.distance;
    engine.cameraWorldPos.x = eye.x - fwd.x * d + up.x * 0.35;
    engine.cameraWorldPos.y = eye.y - fwd.y * d + up.y * 0.35;
    engine.cameraWorldPos.z = eye.z - fwd.z * d + up.z * 0.35;
    suitGroup.visible = true;

    // Orient the visible body to stand plumb and face where it is looking.
    //
    // This was built by composing two rotations: one taking the model's +Y to
    // local up, then a yaw about up. That is wrong, because the first rotation
    // sends the model's +Z somewhere arbitrary — setFromUnitVectors picks the
    // shortest arc, not a heading — so the yaw was applied to an unknown
    // starting direction and the body ended up facing a direction unrelated to
    // its travel. It is the same family as the inverted stick and the
    // inside-out ground: an orientation assumed rather than constructed.
    //
    // Built explicitly instead. The model's front is +Z (the backpack sits at
    // -Z), so: model +Y -> local up, model +Z -> heading, and model +X is
    // whatever keeps the basis right-handed (X = Y x Z).
    const flat = fwd.clone().projectOnPlane(up).normalize();
    const xAxis = new THREE.Vector3().crossVectors(up, flat).normalize();
    const basis = new THREE.Matrix4().makeBasis(xAxis, up, flat);
    suitEntry.quaternion = new THREE.Quaternion().setFromRotationMatrix(basis);
  }

  const target = new THREE.Vector3(
    eye.x - engine.cameraWorldPos.x + fwd.x,
    eye.y - engine.cameraWorldPos.y + fwd.y,
    eye.z - engine.cameraWorldPos.z + fwd.z
  );
  engine.camera.up.copy(up);
  engine.camera.lookAt(target);

  updateSun(f);
}

function updateSun(f) {
  const up = new THREE.Vector3(f.up.x, f.up.y, f.up.z);
  const north = new THREE.Vector3(f.north.x, f.north.y, f.north.z);
  const east = new THREE.Vector3(f.east.x, f.east.y, f.east.z);
  // --- Sun -----------------------------------------------------------------
  // The first version of this used a fixed world-space direction, which put
  // the sun 13.3 degrees BELOW the local horizon at the spawn coordinate — the
  // planet rendered black because it was night there and nothing said so.
  //
  // A direction in world space means nothing without a place to stand. The sun
  // is built from the player's own local frame instead, so its elevation and
  // azimuth are the angles an observer would actually measure. Wiring this to
  // the body's real rotation period gives a true day/night cycle later without
  // changing anything here.
  const elev = SUN.elevationRad;
  const az = SUN.azimuthRad;
  const sunDir = new THREE.Vector3()
    .addScaledVector(up, Math.sin(elev))
    .addScaledVector(north, Math.cos(elev) * Math.cos(az))
    .addScaledVector(east, Math.cos(elev) * Math.sin(az))
    .normalize();

  // The light rides with the camera so the shadow frustum stays useful at
  // planetary scale — a fixed shadow camera 3,389 km from the origin resolves
  // nothing.
  sun.position.copy(sunDir).multiplyScalar(140);
  sun.target.position.set(0, 0, 0);

  // The sky's ambient light comes from straight overhead, which is LOCAL up. (It was the scene's +Y,
  // the planet's polar axis: at the spawn latitude that is nearly horizontal, so the floor of a hole
  // got a mix of sky and ground and its walls got more of the sky than the floor did.)
  sky.position.copy(up);
  // And in a hole the sky is a smaller part of what the walls see but the walls are bright rust that
  // bounces it back: lift the ambient with the depth below the original ground so a deep pit is dim,
  // not black. (Measured, not styled: with the ambient at 1.6 the pit floor at 6 m was still under 5% of the surface
  // brightness, because a hemisphere light reaches the surface divided by pi.)
  const cw = engine.cameraWorldPos;
  const below = Math.max(0, -baseDensityAt(body, cw.x, cw.y, cw.z));
  ambientDepth += (Math.min(1, below / 2.5) - ambientDepth) * 0.15;
  sky.intensity = 0.85 + 1.3 * ambientDepth;
  suitLamp.position.set(0, 0.15, 0);
  suitLamp.intensity = 5 * Math.min(1, Math.max(0, (below - 0.8) / 1.2));
}
let ambientDepth = 0;

// ---------------------------------------------------------------------------
// Debug layer + HUD
// ---------------------------------------------------------------------------
const debugLayer = new DebugLayer(engine, body, registry);
const hud = document.getElementById('hud');
const settingsPanel = document.getElementById('settings-panel');

function refreshHud() {
  const g = walker.geodetic;
  const load = carriedMass();
  if (ship.ready && ship.aboard) {
    hud.innerHTML = ship.hudText() + `<br><span class="dim">${formatCoord(g.lat, g.lon, g.alt)}</span>`;
    return;
  }
  hud.innerHTML =
    `<b>${body.name}</b> · ${SPAWN.name}<br>` +
    `${formatCoord(g.lat, g.lon, g.alt)}<br>` +
    `<span class="dim">${walker.groundMaterialName()} · ${body.surfaceGravity.toFixed(2)} m/s²` +
    `${walker.grounded ? '' : ' · airborne'}</span>` +
    (load > 0
      ? `<br><span class="load">carrying ${load.toFixed(1)} kg · ` +
        `${(carriedVolume() * 1000).toFixed(0)} L · ${carried.length} load${carried.length > 1 ? 's' : ''}</span>`
      : '') + `<br><span class="dim">tool: ${tool().name}</span>`;
}

// Marker update. Finding the aim point steps through the field, so it runs at 20 Hz rather than 60
// and holds the result between: the marker is a readout, and a readout does not need to be
// re-derived three times per frame.
let markAccum = 0, markPulse = 0, lastCut = null, lastDrop = null;
function updateAimMarkers(dt) {
  if (ship.ready && ship.aboard) { digMark.group.visible = false; dropMark.group.visible = false; return; }
  markPulse = 0.5 + 0.5 * Math.sin(engine.timeSec * 3.4);
  markAccum += dt;
  if (markAccum >= 0.05) {
    markAccum = 0;
    lastCut = digTarget();
    const top = carried[carried.length - 1];
    lastDrop = top ? dumpPlan(top) : null;
  }
  if (!carried.length) lastDrop = null;

  const tl = tool();
  const canDig = lastCut && carriedMass() < tl.capacityKg;
  // The bite is a sphere centred half a radius into the material, so where it meets the surface
  // it is about 0.87 r wide and it goes 1.5 r deep. Both are drawn.
  placeMarker(digMark, digMarkEntry, canDig ? lastCut.point : null, canDig ? lastCut.normal : { x: 0, y: 1, z: 0 },
    tl.radius * 0.9, tl.radius * 1.5, markPulse);
  // The marker for a load sits on the ground it will land on; its width is the heap's.
  let dropAt = null, dropN = null;
  if (lastDrop) {
    dropAt = groundBelowPoint({ x: lastDrop.x, y: lastDrop.y, z: lastDrop.z }, lastDrop.up, 2.5, 6) || lastDrop;
    dropN = lastDrop.up;
  }
  placeMarker(dropMark, dropMarkEntry, dropAt, dropN || { x: 0, y: 1, z: 0 }, Math.max(0.15, lastDrop ? lastDrop.r : 0.15), 0.04, markPulse);
}

// The action button exists only when there is something to do with it — the
// same rule as the movement stick. No permanent controls waiting on screen.
const actionBtn = document.getElementById('btn-action');
const toolBtn = document.getElementById('btn-tool');
toolBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
toolBtn.addEventListener('pointerup', (e) => { e.preventDefault(); e.stopPropagation(); setTool(digger.toolIdx + 1); flash(tool().name); });
let actionFlash = 0;
// What a TAP on the button does right now. The button already changed its word
// depending on whether you can dig; the tap did not, so a button reading "Drop"
// still ran a dig and answered "Hands full". Pressing the thing that says Drop
// has to drop.
let tapAction = 'dig';

let shipPress = false;
function refreshAction() {
  if (actionFlash > 0) return;
  if (ship.ready) {
    const a = ship.contextAction();
    if (a) { tapAction = 'ship'; actionBtn.style.display = 'block'; actionBtn.textContent = a.label; return; }
    if (ship.aboard) { tapAction = 'none'; actionBtn.style.display = 'none'; return; }
  }
  const inReach = !!digTarget();
  const load = carriedMass();
  const cap = tool().capacityKg;
  if (inReach && load < cap) {
    tapAction = 'dig';
    actionBtn.style.display = 'block';
    actionBtn.textContent = load > 0 ? 'Dig  ·  hold to drop' : 'Dig';
  } else if (load > 0) {
    tapAction = 'dump';
    actionBtn.style.display = 'block';
    // Say why the shovel is idle, so a full load does not read as a dead button.
    actionBtn.textContent = load >= cap ? 'Hands full  ·  Drop' : 'Drop';
  } else {
    tapAction = 'dig';
    actionBtn.style.display = 'none';
  }
  toolBtn.style.display = actionBtn.style.display;
  toolBtn.textContent = tool().name;
}
function flash(msg) {
  actionBtn.style.display = 'block';
  actionBtn.textContent = msg;
  actionFlash = 0.9;
}

// One button, two verbs. A tap does whatever the button currently SAYS; a hold
// always drops, and repeats, because emptying nine loads should not be nine
// separate deliberate gestures.
let holdTimer = null, holdRepeat = null;
function stopHold() {
  if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  if (holdRepeat) { clearInterval(holdRepeat); holdRepeat = null; }
}
actionBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  if (tapAction === 'ship') { shipPress = true; return; }
  holdTimer = setTimeout(() => {
    holdTimer = null;
    flash(doDump().msg);
    holdRepeat = setInterval(() => {
      if (!carried.length) { stopHold(); return; }
      flash(doDump().msg);
    }, 260);
  }, 420);
});
const endPress = (e) => {
  e.preventDefault(); e.stopPropagation();
  if (shipPress) {
    shipPress = false;
    const a = ship.contextAction();
    if (a) a.run();
    hudAccum = 1;                                  // refresh the label now
    return;
  }
  if (holdTimer) {                                  // released before the hold
    stopHold();
    flash(tapAction === 'dump' ? doDump().msg : doDig().msg);
  } else stopHold();                                // hold already fired
};
actionBtn.addEventListener('pointerup', endPress);
actionBtn.addEventListener('pointercancel', endPress);
actionBtn.addEventListener('pointerleave', () => stopHold());

// Settings, including the DEV toggle that turns on the measurement layer.
document.getElementById('btn-settings').addEventListener('click', () => {
  settingsPanel.classList.toggle('open');
});
document.getElementById('set-dev').addEventListener('change', (e) => {
  debugLayer.setEnabled(e.target.checked);
});
document.getElementById('set-view').addEventListener('change', (e) => {
  view.mode = e.target.value;
});
document.getElementById('set-tool').addEventListener('change', (e) => { setTool(Number(e.target.value)); hudAccum = 1; });
document.getElementById('btn-copy-coord').addEventListener('click', async () => {
  const r = debugLayer.reportAt(walker);
  const text = `${r.slug}\n${r.coord}\nground: ${r.groundMaterial}, clearance ${r.clearanceM.toFixed(2)} m\n` +
    `nearby: ${r.nearby.map((n) => `${n.id} @${n.d.toFixed(1)}m`).join(', ') || 'none'}`;
  try { await navigator.clipboard.writeText(text); } catch { /* clipboard may be blocked */ }
  const btn = document.getElementById('btn-copy-coord');
  btn.textContent = 'Copied';
  setTimeout(() => { btn.textContent = 'Copy my position'; }, 1400);
});

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------
let hudAccum = 0;

// A camera placed by hand for review shots (cosmos.freeCam.set(eye, target); .off() to play again).
// Physics and input pause while it is on; the ground meshes keep building around the eye.
const freeCam = {
  active: false, eye: null, target: null,
  set(eye, target) { this.active = true; this.eye = { ...eye }; this.target = { ...target }; return this; },
  off() { this.active = false; return this; },
};

engine.addUpdater((dt) => {
  if (freeCam.active) {
    suitGroup.visible = false;
    Object.assign(engine.cameraWorldPos, freeCam.eye);
    const l = Math.hypot(freeCam.eye.x, freeCam.eye.y, freeCam.eye.z) || 1;
    engine.camera.up.set(freeCam.eye.x / l, freeCam.eye.y / l, freeCam.eye.z / l);
    engine.camera.lookAt(new THREE.Vector3(freeCam.target.x - freeCam.eye.x, freeCam.target.y - freeCam.eye.y, freeCam.target.z - freeCam.eye.z));
    updateSun(walker.updateFrame());
    if (ship.ready) ship._updateVisuals(dt, false);        // drones, ramps and lights still follow their state in a review shot
    if (!edits.isEmpty || terrain.meshes.size) {
      terrain.update(dt, freeCam.eye);
      terrain.coverOffsetFor(patch.worldPos, midCover);
      terrain.coverOffsetFor(nearPatch.worldPos, nearCover);
    }
    return;
  }
  if (portTour.active) { suitGroup.visible=false; port.tick(dt, walker, false, true); portTour.update(); return; }
  // Look. Both input sources contribute so a hybrid device works.
  const l1 = touch.consumeLook(), l2 = desktop.consumeLook();
  const lookDX = l1.dx + l2.dx, lookDY = l1.dy + l2.dy;

  // Space is a jump key AND the lift key: `keys` is consumed by the jump, `held` is not.
  const heldKeys = desktop.held;
  const input = {
    moveEast: touch.moveEast || desktop.moveEast,
    moveNorth: touch.moveNorth || desktop.moveNorth,
    run: touch.run || desktop.run,
    jump: touch.consumeJump() || desktop.consumeJump(),
  };

  // The ship gets first refusal. Aboard, it owns the body and the camera; outside
  // it still flies itself (hover, ramps) and checks whether you are boarding.
  let owned = false;
  if (ship.ready) {
    owned = ship.frame(dt, {
      look: { dx: lookDX, dy: lookDY }, ...input, keys: heldKeys,
      fire: shipUI ? shipUI.fire : false,
    });
  }

  if (owned) {
    suitGroup.visible = false;
    updateSun(walker.updateFrame());
    followTerrain();
  } else {
    walker.yaw += lookDX;
    walker.pitch -= lookDY;
    walker.pitch = Math.max(-1.45, Math.min(1.45, walker.pitch));
    walker.tick(dt, input);
    port.tick(dt, walker);
    rebuildNear();
    updateCamera();
  }
  if (ship.ready) ship.late(dt);
  if (owned) port.tick(dt, walker, false);
  if (shipUI) shipUI.update(dt);
  if (crewUI) crewUI.update(dt);
  if (suitGroup.visible && playerPerson.loaded) {
    // the body stands or walks with what the legs are doing
    const v = walker.velocity, sp = Math.hypot(v.x, v.y, v.z);
    playerPerson.play(walker.grounded && sp > 0.35 ? 'Walk' : 'Idle');
    playerPerson.update(dt, sp);
  }

  stepPatches(tier === 'low' ? 2.5 : 4);
  updateAimMarkers(dt);
  debugLayer.update(walker, engine.camera);

  // Bricks of dug ground: a few ms of meshing per frame at most, nearest first; and tell each
  // heightfield tier where the occupancy window is so it can discard under built bricks.
  if (!edits.isEmpty || terrain.meshes.size) {
    terrain.update(dt, walker.worldPos);
    terrain.coverOffsetFor(patch.worldPos, midCover);
    terrain.coverOffsetFor(nearPatch.worldPos, nearCover);
  }
  if (actionFlash > 0) { actionFlash -= dt; if (actionFlash <= 0) refreshAction(); }

  hudAccum += dt;
  if (hudAccum > 0.2) { refreshHud(); refreshAction(); hudAccum = 0; }
});

/**
 * Keep the drawn ground under a moving ship. The near patch only matters within
 * a few dozen metres of it; higher up, only the wide patch needs to follow.
 */
function followTerrain() {
  const p = walker.worldPos;
  if (ship.flight.agl < 45) { rebuildNear(); return; }
  if (!patch.rebuilding && patch.needsRebuild(p.x, p.y, p.z)) patch.beginRebuild(p.x, p.y, p.z);
}

// Keyboard shortcuts for desktop: V toggles view, G toggles the debug layer.
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyV') {
    view.mode = view.mode === 'first' ? 'third' : 'first';
    document.getElementById('set-view').value = view.mode;
  }
  if (e.code === 'KeyE') {
    if (ship.ready && (ship.aboard || ship.contextAction())) { ship.interact(); hudAccum = 1; }
    else flash(doDig().msg);
  }
  if (e.code === 'KeyQ' && !(ship.ready && ship.aboard)) flash(doDump().msg);
  if (!(ship.ready && ship.aboard) && /^Digit[123]$/.test(e.code)) { setTool(Number(e.code.slice(5)) - 1); document.getElementById('set-tool').value = String(digger.toolIdx); flash(tool().name); }
  if (e.code === 'KeyG') {
    const box = document.getElementById('set-dev');
    box.checked = !box.checked;
    debugLayer.setEnabled(box.checked);
  }
});

document.getElementById('boot')?.remove();
refreshHud();
engine.start();

// Debug handle. This is the hook automated verification uses to drive frames
// deterministically when a browser tab is throttled, and to read world truth
// without guessing from pixels.
window.cosmos = {
  port, portTour,
  depthBits: (() => { try { const g = engine.renderer.getContext(); return g.getParameter(g.DEPTH_BITS); } catch (e) { return null; } })(), depthEmulated: depthEmulation,
  auditGaps: (rooms, o) => auditGaps(engine, ship, rooms, o),
  drones: () => ship.drones,
  at: (...a) => ship.debugAt(...a), viewFrom: (...a) => ship.debugViewFrom(...a), desktop, touch,
  ship, shipUI, engine, body, walker, patch, registry, debugLayer, view, people,
  get crew() { return crew; }, get crewUI() { return crewUI; }, playerPerson, suitGroup,
  report: () => debugLayer.reportAt(walker),
  edits, carried, doDig, doDump, digTarget, dumpPlan, terrain, TOOLS, setTool, tool,
  nearPatch, rebuildNear, freeCam,
  flushTerrain: () => terrain.flush(walker.worldPos),
  ledger: () => edits.ledger(carried),
  step: (dt = 1 / 60) => engine.step(dt),
  goto: (lat, lon) => {
    walker.placeAtGeodetic(lat, lon, 1.5);
    patch.rebuild(walker.worldPos.x, walker.worldPos.y, walker.worldPos.z);
    patchEntry.worldPos = patch.worldPos;
  },
};
