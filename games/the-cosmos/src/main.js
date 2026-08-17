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
import { Engine } from './core/engine.js';
import { registry } from './core/registry.js';
import { BODIES, getBody } from './world/bodies.js';
import { buildGlobalShell, LocalPatch } from './world/planetMesh.js';
import { geodeticToCartesian, cartesianToGeodetic, formatCoord, coordSlug } from './world/geodesy.js';
import { surfaceRadiusAlong, materialAt, MATERIALS, attachEdits, density } from './world/field.js';
import { EditStore } from './world/edits.js';
import { ExcavationMesh } from './world/excavation.js';
import { Walker } from './player/walker.js';
import { TouchControls, DesktopControls } from './ui/touch.js';
import { DebugLayer } from './dev/debugLayer.js';

const canvas = document.getElementById('game-canvas');
const engine = new Engine(canvas, { fov: 72 });
const body = getBody('mars');

// --- Spawn. A real place, not a random direction. ---------------------------
// Valles Marineris: the canyon floor gives immediate scale and a horizon with
// something in it. Chosen from the landmark table, so it has an address.
const SPAWN = { lat: -14.0, lon: -59.2, name: 'Valles Marineris' };

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

// --- Terrain, three resolutions of one field. -------------------------------
// shell   whole planet, ~83 km between vertices  (horizon, orbit)
// mid     880 m across,  6.72 m between vertices (the middle distance)
// near     48 m across,  0.60 m between vertices (the ground at your feet)
//
// 0.60 m is a deliberate compromise, and the number came from measurement, not
// taste. It is fine enough to cut a precise gap around a pit, and 6.5k vertices
// keeps the rebuild affordable. Sizing was done conservatively because the only
// timings available were from a throttled background browser tab, which ran
// ~7x slower per vertex than the same code in Node — a real phone is the only
// instrument that settles this, so the budget was set low and handed over.
//
// The near patch is the piece that makes excavation visible. A heightfield can
// only stop drawing in whole quads, so the smallest hole it can make room for
// is one quad. At 6.72 m that was a 6.72 m square — vastly bigger than any pit,
// which is why a dug hole stayed buried under solid ground. At 0.40 m the
// terrain can step aside for something spade-sized.
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

// Geometry for anything dug. The heightfield cannot draw a hole at any
// resolution, so excavated ground is meshed cell by cell from the field and
// the heightfield yields that region to it.
// EVERY NUMBER HERE IS SET BY A MEASUREMENT, NOT BY TASTE.
//
// cellM 0.09 — the shovel takes a 0.15 m radius bite, so the bite is 0.30 m
//   across. At the old 0.22 m cell a 0.18 m bite was 0.8 CELLS: the mesh could
//   not hold the pit at all, and drew a 4 cm dimple where a 14 cm hole belonged.
//   This is Nyquist, not polish. 0.09 m keeps 3.3 cells across the bite, with
//   margin — 0.10 m gives exactly 3.0 and lands on the same kind of
//   floating-point tie the handover square did.
//   It also buys DEPTH. The region coarsens once it outgrows maxCells, so the
//   cell size decides how deep a hole stays sharp: 0.06 m blurred past 2.9 m,
//   0.09 m holds to 4.3 m — and costs 25^3 samples instead of 39^3.
// minRadiusM 1.1 — the heightfield yields in whole 0.60 m quads, so the region
//   handed to it must be MORE than 2 quads across or there is no whole quad to
//   yield and the pit stays buried. The handover square is 0.60 of this
//   half-width, so 1.1 gives a 0.66 m half-side: 1.32 m across against a 1.20 m
//   pair of quads, a 10% margin.
//   Exactly 2 quads is not enough, and the way it fails is instructive. At
//   minRadiusM 1.0 the square is 1.20 m across and the quad pair is 1.20 m, so
//   with the dig directly underfoot the quad corners land at 0.6000 against a
//   0.6000 bound and floating point decides it — 0 quads yielded, pit buried.
//   A guarantee that holds only as an exact tie is not a guarantee.
//   It was 0.9 with a CIRCLE, where the best-placed quad's far corner sat
//   0.91 m out against a 0.907 m radius: same symptom, and no amount of tuning
//   fixes the shape, because a circle's overlap with a square grid depends on
//   where it lands. That is why this is a square.
// padM 0.35 — margin past the edits. Was 1.2, which made a 2.58 m box around a
//   0.18 m bite: 28x wider than the thing being drawn.
// maxCells 48 — the cap that bounds the worst case. A region that grows past
//   ~2.9 m coarsens rather than costing more.
const excavation = new ExcavationMesh(body, {
  cellM: 0.09, minRadiusM: 1.1, padM: 0.35, maxCells: 48,
});
engine.scene.add(excavation.mesh);
const excavationEntry = engine.track({ worldPos: excavation.worldPos, object3d: excavation.mesh });

let excavationDue = 0;
/** Called after any change to the ground. Coalesced: a burst of digs costs
 *  one rebuild, not one per bite. */
function requestExcavationRefresh() { excavationDue = 0.12; }

/** The excavated region the near patch's hole was last cut for. */
let holeCutFor = null;

function refreshExcavation() {
  excavation.rebuild(edits.edits);
  excavationEntry.worldPos = excavation.worldPos;
  const fp = excavation.footprint();

  // The NEAR patch yields to the excavation, not the mid patch. Its 0.60 m
  // quads mean the gap it leaves is the size of the hole rather than the size
  // of a terrain cell — which is the whole reason a dug pit stayed buried
  // under solid ground before.
  //
  // A SQUARE, not a radius. `radius` is the half-diagonal of the excavated box
  // and is 73% larger than the box itself, so handing over that much told the
  // heightfield to stop drawing 0.45 m further out than the volumetric mesh
  // reaches — a ring you could see straight through the planet in, with a
  // 0.60 m staircase edge. That ring was the hard rectangular seam.
  //
  // Handing over a circle instead is phase-fragile: the heightfield yields in
  // whole quads, and measured, the best-placed quad's far corner sat 0.91 m
  // out against a 0.907 m radius, so nothing was yielded at all and the pit
  // went back under the ground. A square runs along the same grid the quads do
  // and always contains whole ones.
  //
  // And re-cut it only when the excavated REGION moves or grows. What the mesh
  // looks like inside the hole changes with every bite; the hole it needs does
  // not. Without this the whole near patch — 6,561 ray-marched vertices — was
  // rebuilt per spade bite to arrive at the same hole it already had.
  const moved = !holeCutFor || !fp ||
    Math.abs(fp.handoverM - holeCutFor.halfSideM) > 0.01 ||
    Math.hypot(fp.centre.x - holeCutFor.x, fp.centre.y - holeCutFor.y,
               fp.centre.z - holeCutFor.z) > 0.01;
  if (!moved) return;

  holeCutFor = fp ? { x: fp.centre.x, y: fp.centre.y, z: fp.centre.z, halfSideM: fp.handoverM } : null;
  nearPatch.setExcluded(fp ? [{ centre: { ...fp.centre }, halfSideM: fp.handoverM }] : []);
  rebuildNear(true);
}

/** Where the mid patch's hole was last cut, so it is not re-cut for nothing. */
let midHoleAt = null;

/** Rebuild the near patch, and keep the mid patch out from under it. */
function rebuildNear(force = false) {
  const moved = nearPatch.needsRebuild(walker.worldPos.x, walker.worldPos.y, walker.worldPos.z);
  if (!force && !moved) return;
  nearPatch.rebuild(walker.worldPos.x, walker.worldPos.y, walker.worldPos.z);
  nearEntry.worldPos = nearPatch.worldPos;

  // The mid patch stops drawing under the near patch, or the two z-fight: they
  // agree at shared vertices but the coarse one runs straight lines between
  // them across ground the fine one curves over.
  //
  // But it only cares WHERE the near patch is, not what has been dug inside
  // it. Rebuilding all 17,424 of its vertices on every spade bite cost 415 ms
  // of an 865 ms freeze to arrive at the identical mesh already on screen.
  // Cut the hole again only when the hole actually has to move.
  const np = nearPatch.worldPos;
  const holeMoved = !midHoleAt ||
    Math.hypot(np.x - midHoleAt.x, np.y - midHoleAt.y, np.z - midHoleAt.z) > 0.01;
  if (!holeMoved) return;

  midHoleAt = { x: np.x, y: np.y, z: np.z };
  patch.setExcluded([{ centre: midHoleAt, radius: nearPatch.sizeM * 0.40 }]);
  patch.rebuild(walker.worldPos.x, walker.worldPos.y, walker.worldPos.z);
  patchEntry.worldPos = patch.worldPos;
}

// THE TOOL. r = 0.15 m sphere is 14.1 litres — a scoop shovel, the wide-bladed
// kind used for loose material (blade about 460 x 380 mm, a heaped 12-15 L).
// That is 21.5 kg of regolith at its real 1520 kg/m3, and it cuts a 0.30 m
// bite 0.23 m deep. The 0.09 m spade before it took 3 L and left a 0.18 m
// rat-hole; a hole you can stand in needs a tool sized to make one.
// Widening the bite also makes the ground CHEAPER to draw, not dearer: the mesh
// cell only has to resolve the bite, so a 0.30 m bite allows a 0.10 m cell
// where a 0.18 m bite needed 0.06 m, and the cost of a cell size is cubic.
// reachM measured against real use: from a 1.66 m eye height, a 2.6 m reach
// forced a ~60 degree look-down before the ray met the ground, and missed
// entirely on a downslope. 3.6 m lets you dig at a natural working angle.
const SHOVEL = { radius: 0.15, reachM: 3.6, name: 'Scoop shovel' };
const carried = [];                      // lots in hand, each a real object

// What you can carry is a WEIGHT limit, not a mass limit, so it belongs to the
// body you are standing on. 40 kg is a heavy but ordinary load on Earth; the
// same pull on Mars is 105 kg of rock. The old flat 40 kg was Earth's number
// used on Mars, which quietly made you three times weaker than you should be.
const CARRY_EARTH_KGF = 40;
const EARTH_G = 9.80665;                 // CODATA standard gravity
const carryCapacityKg = CARRY_EARTH_KGF * EARTH_G / body.surfaceGravity;

const carriedMass = () => carried.reduce((a, l) => a + l.massKg, 0);
const carriedVolume = () => carried.reduce((a, l) => a + l.looseVolumeM3, 0);

/** Where the player is looking, on the ground, within reach. */
function digTarget() {
  const f = walker.updateFrame();
  const cy = Math.cos(walker.yaw), sy = Math.sin(walker.yaw);
  const cp = Math.cos(walker.pitch), sp = Math.sin(walker.pitch);
  const dir = {
    x: f.north.x * cy * cp + f.east.x * sy * cp + f.up.x * sp,
    y: f.north.y * cy * cp + f.east.y * sy * cp + f.up.y * sp,
    z: f.north.z * cy * cp + f.east.z * sy * cp + f.up.z * sp,
  };
  const eyeP = walker.eyeWorldPos({});

  // Step along the look ray until it passes below the surface the player can
  // SEE. Testing the analytic field here instead would be wrong for the same
  // reason it was wrong for the feet: the drawn ground sits up to ~0.7 m above
  // the field between vertices, so a player standing on visible ground would
  // aim at it and be told there is nothing in reach.
  for (let t = 0.25; t <= SHOVEL.reachM; t += 0.06) {
    const p = { x: eyeP.x + dir.x * t, y: eyeP.y + dir.y * t, z: eyeP.z + dir.z * t };
    const l = Math.hypot(p.x, p.y, p.z);
    const drawn = patch.surfaceRadiusAt(p.x / l, p.y / l, p.z / l);
    if (drawn !== null) { if (l <= drawn) return p; }
    else if (density(body, p.x, p.y, p.z) < 0) return p;
  }
  return null;
}

/**
 * You AIM at the ground you can see, but you CUT real material, and they are
 * up to ~0.7 m apart because the drawn mesh runs flat triangles across a curved
 * field. So the aim point is snapped down the radial to where material actually
 * starts — otherwise every swing lands in the gap between the picture and the
 * substance and comes back empty.
 *
 * The aim marker calls this too. It has to be the same function: a marker that
 * derived the cut point separately would be a picture of a second opinion.
 */
function cutPointFor(aim) {
  const l = Math.hypot(aim.x, aim.y, aim.z);
  const u = { x: aim.x / l, y: aim.y / l, z: aim.z / l };
  const surf = surfaceRadiusAlong(body, u.x, u.y, u.z,
    { minStep: 0.08, startRadius: l + 3, range: 12 });
  const cut = surf - SHOVEL.radius * 0.55;      // bite in, not skim the top
  return { x: u.x * cut, y: u.y * cut, z: u.z * cut };
}

function doDig() {
  if (carriedMass() >= carryCapacityKg) return { ok: false, msg: 'Hands full' };
  let t = digTarget();
  if (!t) return { ok: false, msg: 'Nothing in reach' };

  t = cutPointFor(t);

  const lot = edits.dig(
    (x, y, z) => density(body, x, y, z),
    (x, y, z) => materialAt(body, x, y, z),
    MATERIALS, t.x, t.y, t.z, SHOVEL.radius);
  if (!lot) return { ok: false, msg: 'Cannot cut this' };
  carried.push(lot);
  requestExcavationRefresh();
  return { ok: true, msg: `+${lot.massKg.toFixed(1)} kg ${lot.materialName}` };
}

/**
 * Where a shovelful actually lands.
 *
 * NOT where you are aiming. Dumping at the aim point drops the spoil straight
 * back into the hole you are standing over, because that is exactly where you
 * are looking while digging. Measured: dig to 1.259 m, drop the load, and the
 * hole is 0.404 m — you keep a third of the work, every cycle. Carry capacity
 * is 40 kg, about 9 bites, so you cannot get past roughly 2 m however long you
 * dig. That is the "I can only go so deep" ceiling, and it is not a limit of
 * the ground: with the spoil thrown clear, the same six cycles reach 6.0 m.
 *
 * So the spoil goes where a person actually throws it — clear of the rim, on
 * the side they are standing. It is still real material landing in a real
 * place, and it still has to be carried there.
 */
function dumpTarget(lot) {
  const aim = digTarget() || walker.worldPos;
  const fp = excavation.footprint();
  if (!fp) return aim;                      // nothing dug yet: land it where you look

  const up = { x: aim.x, y: aim.y, z: aim.z };
  const ul = Math.hypot(up.x, up.y, up.z) || 1;
  up.x /= ul; up.y /= ul; up.z /= ul;

  // Horizontal direction from the hole towards the player.
  let vx = walker.worldPos.x - fp.centre.x;
  let vy = walker.worldPos.y - fp.centre.y;
  let vz = walker.worldPos.z - fp.centre.z;
  const along = vx * up.x + vy * up.y + vz * up.z;
  vx -= up.x * along; vy -= up.y * along; vz -= up.z * along;
  let vl = Math.hypot(vx, vy, vz);
  if (vl < 1e-3) {                          // stood dead centre: throw ahead
    const f = walker.updateFrame();
    vx = f.north.x; vy = f.north.y; vz = f.north.z; vl = 1;
  }
  vx /= vl; vy /= vl; vz /= vl;

  // Far enough out to clear the rim and the pile's own radius.
  const pileR = Math.cbrt((3 * lot.looseVolumeM3) / (4 * Math.PI));
  const reach = fp.handoverM + pileR + 0.25;
  const px = fp.centre.x + vx * reach, py = fp.centre.y + vy * reach, pz = fp.centre.z + vz * reach;
  const pl = Math.hypot(px, py, pz);
  const d = { x: px / pl, y: py / pl, z: pz / pl };
  const surf = surfaceRadiusAlong(body, d.x, d.y, d.z,
    { minStep: 0.08, startRadius: pl + 3, range: 40 });
  // Sit the pile ON the ground, not half-buried in it.
  const at = surf + pileR * 0.35;
  return { x: d.x * at, y: d.y * at, z: d.z * at };
}

function doDump() {
  if (!carried.length) return { ok: false, msg: 'Carrying nothing' };
  const lot = carried.pop();
  const t = dumpTarget(lot);
  edits.deposit(lot, t.x, t.y, t.z);
  requestExcavationRefresh();
  const left = carried.length;
  return { ok: true, msg: `dropped ${lot.massKg.toFixed(1)} kg${left ? ` · ${left} left` : ''}` };
}

// ---------------------------------------------------------------------------
// AIM MARKER — where the tool will actually bite, drawn at its real size.
//
// Not a decoration. The aim point and the cut point are not the same thing:
// you aim at the drawn ground, and the cut is snapped down the radial to where
// material actually starts, up to ~0.7 m below. And since the spoil now lands
// clear of the rim rather than where you look, the place it lands is a third
// position again. Three positions the player was expected to hold in their
// head. The marker is drawn AT the bite radius, so its width is the width of
// the hole you are about to make and its stem is how deep this one scoop goes.
// ---------------------------------------------------------------------------
function buildAimMarker(hex) {
  const g = new THREE.Group();
  const glow = (geo, opacity) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: hex, transparent: true, opacity, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  // Rim at exactly the bite radius: this circle is the hole's real width.
  const rim = glow(new THREE.RingGeometry(0.88, 1.0, 56), 0.95);
  const fill = glow(new THREE.CircleGeometry(1.0, 56), 0.13);
  // Stem dropping from the surface by one bite depth.
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

/** Lay a marker flat on the ground at a world point, facing local up. */
function placeMarker(mark, entry, at, radius, depth, pulse) {
  if (!at) { mark.group.visible = false; return; }
  const l = Math.hypot(at.x, at.y, at.z) || 1;
  _markUp.set(at.x / l, at.y / l, at.z / l);
  entry.quaternion.setFromUnitVectors(_markZ, _markUp);
  // Lift clear of the surface so it reads as a mark ON the ground, not in it.
  entry.worldPos.x = at.x + _markUp.x * 0.02;
  entry.worldPos.y = at.y + _markUp.y * 0.02;
  entry.worldPos.z = at.z + _markUp.z * 0.02;
  mark.group.scale.setScalar(radius);
  mark.stem.scale.set(1, Math.max(0.001, depth / radius), 1);
  mark.stem.position.set(0, 0, -depth / 2 / radius);
  // Additive on bright regolith saturates to white and both markers stop
  // being different colours, which is the one thing they have to be. Keep it
  // low enough to tint rather than blow out.
  mark.rim.material.opacity = 0.42 + 0.18 * pulse;
  mark.fill.material.opacity = 0.055 + 0.035 * pulse;
  mark.stem.material.opacity = 0.30 + 0.15 * pulse;
  mark.group.visible = true;
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------
const walker = new Walker(body);
// Contact reads the DRAWN ground wherever the patch covers, and the field
// beyond it. This is what stops the player floating above or sinking into the
// surface they can see — one surface at two resolutions, never two surfaces.
walker.groundSampler = (dx, dy, dz) => {
  // Inside an excavated region, return null so contact falls through to the
  // field itself — the drawn patches have a GAP there, and only the field
  // knows the shape of the hole that fills it.
  // Ask the patch itself where it stopped drawing, rather than re-deriving the
  // shape here. Two copies of that rule is two chances for the ground you
  // stand on to disagree with the ground you can see, which is exactly the
  // floating-and-sinking bug this sampler exists to prevent.
  // Compare at roughly surface radius; the region is metres across on a body
  // millions of metres wide, so this is exact enough to classify.
  const R = nearPatch._originR || body.radiusMean;
  if (nearPatch.handedOver(dx * R, dy * R, dz * R)) return null;

  const near = nearPatch.surfaceRadiusAt(dx, dy, dz);
  if (near !== null) return near;
  return patch.surfaceRadiusAt(dx, dy, dz);
};
walker.placeAtGeodetic(SPAWN.lat, SPAWN.lon, 1.5);
rebuildNear(true);

registry.register({
  id: 'COS-MARS-CHR-0001', bodyId: 'mars', type: 'CHR',
  name: 'Player (EVA suit)', position: walker.worldPos,
  authored: { width: 0.48, height: walker.heightM, depth: 0.55 },
  massKg: walker.massKg, collision: 'capsule', materialId: 'MAT-SUIT',
});

// --- Third-person body. Simple for now, but real dimensions and a real ------
// --- registry entry, so the fidelity pass has something measured to replace.
const suitGroup = new THREE.Group();
suitGroup.name = 'player-body';
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
  suitGroup.add(torso, helmet, pack, legL, legR);
  suitGroup.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}
engine.scene.add(suitGroup);
const suitEntry = engine.track({ worldPos: walker.worldPos, object3d: suitGroup });
registry.get('COS-MARS-CHR-0001').object3d = suitGroup;
registry.measure('COS-MARS-CHR-0001', THREE);

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
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
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
}

// ---------------------------------------------------------------------------
// Debug layer + HUD
// ---------------------------------------------------------------------------
const debugLayer = new DebugLayer(engine, body, registry);
const hud = document.getElementById('hud');
const settingsPanel = document.getElementById('settings-panel');

function refreshHud() {
  const g = walker.geodetic;
  const load = carriedMass();
  hud.innerHTML =
    `<b>${body.name}</b> · ${SPAWN.name}<br>` +
    `${formatCoord(g.lat, g.lon, g.alt)}<br>` +
    `<span class="dim">${walker.groundMaterialName()} · ${body.surfaceGravity.toFixed(2)} m/s²` +
    `${walker.grounded ? '' : ' · airborne'}</span>` +
    (load > 0
      ? `<br><span class="load">carrying ${load.toFixed(1)} kg · ` +
        `${(carriedVolume() * 1000).toFixed(0)} L · ${carried.length} load${carried.length > 1 ? 's' : ''}</span>`
      : '');
}

// Marker update. Solving the cut point ray-marches the field, so it runs at
// 20 Hz rather than 60 and holds the result between — the marker is a readout,
// and a readout does not need to be re-derived three times per frame.
let markAccum = 0, markPulse = 0, lastCut = null, lastDrop = null, lastDropR = 0.1;
function updateAimMarkers(dt) {
  markPulse = 0.5 + 0.5 * Math.sin(engine.timeSec * 3.4);
  markAccum += dt;
  if (markAccum >= 0.05) {
    markAccum = 0;
    const aim = digTarget();
    lastCut = aim ? cutPointFor(aim) : null;
    const top = carried[carried.length - 1];
    // Cache the pile's SIZE with its position. Reading the lot again on the
    // frames in between crashes the moment the last load leaves your hands,
    // because the cached position outlives the lot it was computed for.
    lastDrop = top ? dumpTarget(top) : null;
    lastDropR = top ? Math.cbrt((3 * top.looseVolumeM3) / (4 * Math.PI)) : 0.1;
  }
  if (!carried.length) lastDrop = null;

  const canDig = lastCut && carriedMass() < carryCapacityKg;
  // The bite is a sphere of SHOVEL.radius centred just under the surface, so
  // what it opens is that wide and about 1.55 radii deep. Both are drawn.
  placeMarker(digMark, digMarkEntry, canDig ? lastCut : null,
    SHOVEL.radius, SHOVEL.radius * 1.55, markPulse);
  placeMarker(dropMark, dropMarkEntry, lastDrop, lastDropR, 0.04, markPulse);
}

// The action button exists only when there is something to do with it — the
// same rule as the movement stick. No permanent controls waiting on screen.
const actionBtn = document.getElementById('btn-action');
let actionFlash = 0;
// What a TAP on the button does right now. The button already changed its word
// depending on whether you can dig; the tap did not, so a button reading "Drop"
// still ran a dig and answered "Hands full". Pressing the thing that says Drop
// has to drop.
let tapAction = 'dig';

function refreshAction() {
  if (actionFlash > 0) return;
  const inReach = !!digTarget();
  const load = carriedMass();
  if (inReach && load < carryCapacityKg) {
    tapAction = 'dig';
    actionBtn.style.display = 'block';
    actionBtn.textContent = load > 0 ? 'Dig  ·  hold to drop' : 'Dig';
  } else if (load > 0) {
    tapAction = 'dump';
    actionBtn.style.display = 'block';
    // Say why the shovel is idle, so a full load does not read as a dead button.
    actionBtn.textContent = load >= carryCapacityKg ? 'Hands full  ·  Drop' : 'Drop';
  } else {
    tapAction = 'dig';
    actionBtn.style.display = 'none';
  }
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

engine.addUpdater((dt) => {
  const src = (isTouch && touch.active) || (isTouch && !desktop.locked) ? touch : desktop;

  // Look. Both input sources contribute so a hybrid device works.
  const l1 = touch.consumeLook(), l2 = desktop.consumeLook();
  walker.yaw += l1.dx + l2.dx;
  walker.pitch -= l1.dy + l2.dy;
  walker.pitch = Math.max(-1.45, Math.min(1.45, walker.pitch));

  const input = {
    moveEast: touch.moveEast || desktop.moveEast,
    moveNorth: touch.moveNorth || desktop.moveNorth,
    run: touch.run || desktop.run,
    jump: touch.consumeJump() || desktop.consumeJump(),
  };

  walker.tick(dt, input);

  rebuildNear();

  updateCamera();
  updateAimMarkers(dt);
  debugLayer.update(walker, engine.camera);

  if (excavationDue > 0) { excavationDue -= dt; if (excavationDue <= 0) refreshExcavation(); }
  if (actionFlash > 0) { actionFlash -= dt; if (actionFlash <= 0) refreshAction(); }

  hudAccum += dt;
  if (hudAccum > 0.2) { refreshHud(); refreshAction(); hudAccum = 0; }
});

// Keyboard shortcuts for desktop: V toggles view, G toggles the debug layer.
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyV') {
    view.mode = view.mode === 'first' ? 'third' : 'first';
    document.getElementById('set-view').value = view.mode;
  }
  if (e.code === 'KeyE') flash(doDig().msg);
  if (e.code === 'KeyQ') flash(doDump().msg);
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
  engine, body, walker, patch, registry, debugLayer, view,
  report: () => debugLayer.reportAt(walker),
  edits, carried, doDig, doDump, digTarget, excavation, refreshExcavation,
  nearPatch, rebuildNear,
  ledger: () => edits.ledger(carried),
  step: (dt = 1 / 60) => engine.step(dt),
  goto: (lat, lon) => {
    walker.placeAtGeodetic(lat, lon, 1.5);
    patch.rebuild(walker.worldPos.x, walker.worldPos.y, walker.worldPos.z);
    patchEntry.worldPos = patch.worldPos;
  },
};
