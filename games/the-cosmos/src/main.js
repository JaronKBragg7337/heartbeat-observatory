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

const patch = new LocalPatch(body, { sizeM: 880, res: 132 });
engine.scene.add(patch.mesh);
const patchEntry = engine.track({ worldPos: patch.worldPos, object3d: patch.mesh });

// ---------------------------------------------------------------------------
// Excavation. The ground is a solid object; this is what takes pieces out.
// ---------------------------------------------------------------------------
const edits = new EditStore(body);
attachEdits(edits);

// Geometry for anything dug. The heightfield cannot draw a hole at any
// resolution, so excavated ground is meshed cell by cell from the field and
// the heightfield yields that region to it.
// minRadiusM is derived from the heightfield's own cell size: the excavated
// region has to be bigger than one terrain quad or the heightfield cannot be
// made to yield, and the hole stays buried underneath it.
// minRadiusM is deliberately NOT set. Growing the excavated region past one
// heightfield quad (6.72 m) is what it would take to make the heightfield yield
// and reveal the hole — but that measured at ~400 ms per dig and froze the
// renderer after twenty of them. The mesh below is correct and cheap over the
// tight region; making it VISIBLE needs the near-field terrain to be volumetric
// too, which is the next piece of work rather than a constant to tune.
const excavation = new ExcavationMesh(body, { cellM: 0.22, maxCells: 64 });
engine.scene.add(excavation.mesh);
const excavationEntry = engine.track({ worldPos: excavation.worldPos, object3d: excavation.mesh });

let excavationDue = 0;
/** Called after any change to the ground. Coalesced: a burst of digs costs
 *  one rebuild, not one per bite. */
function requestExcavationRefresh() { excavationDue = 0.12; }

function refreshExcavation() {
  excavation.rebuild(edits.edits);
  excavationEntry.worldPos = excavation.worldPos;
  const fp = excavation.footprint();
  // The heightfield stops drawing where the volumetric mesh takes over.
    patch.setExcluded(fp ? [{ centre: fp.centre, radius: fp.radius * 0.9 }] : []);
  patch.rebuild(walker.worldPos.x, walker.worldPos.y, walker.worldPos.z);
  patchEntry.worldPos = patch.worldPos;
}

// A real shovel blade. r = 0.09 m sphere is ~3 litres, which is what a spade
// actually lifts, and ~4.6 kg of regolith at its real density.
// reachM measured against real use: from a 1.66 m eye height, a 2.6 m reach
// forced a ~60 degree look-down before the ray met the ground, and missed
// entirely on a downslope. 3.6 m lets you dig at a natural working angle.
const SHOVEL = { radius: 0.09, reachM: 3.6, name: 'Hand shovel' };
const carried = [];                      // lots in hand, each a real object
const carryCapacityKg = 40;

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

function doDig() {
  if (carriedMass() >= carryCapacityKg) return { ok: false, msg: 'Hands full' };
  let t = digTarget();
  if (!t) return { ok: false, msg: 'Nothing in reach' };

  // You AIM at the ground you can see, but you CUT real material. Those are up
  // to ~0.7 m apart, because the drawn mesh interpolates flat triangles across
  // a curved field. So the aim point is snapped down the radial to where the
  // material actually starts — otherwise every swing lands in the gap between
  // the picture and the substance and comes back empty.
  {
    const l = Math.hypot(t.x, t.y, t.z);
    const u = { x: t.x / l, y: t.y / l, z: t.z / l };
    const surf = surfaceRadiusAlong(body, u.x, u.y, u.z,
      { minStep: 0.08, startRadius: l + 3, range: 12 });
    const cut = surf - SHOVEL.radius * 0.55;    // bite in, not skim the top
    t = { x: u.x * cut, y: u.y * cut, z: u.z * cut };
  }

  const lot = edits.dig(
    (x, y, z) => density(body, x, y, z),
    (x, y, z) => materialAt(body, x, y, z),
    MATERIALS, t.x, t.y, t.z, SHOVEL.radius);
  if (!lot) return { ok: false, msg: 'Cannot cut this' };
  carried.push(lot);
  requestExcavationRefresh();
  return { ok: true, msg: `+${lot.massKg.toFixed(1)} kg ${lot.materialName}` };
}

function doDump() {
  if (!carried.length) return { ok: false, msg: 'Carrying nothing' };
  const t = digTarget() || walker.worldPos;
  const lot = carried.pop();
  edits.deposit(lot, t.x, t.y, t.z);
  requestExcavationRefresh();
  return { ok: true, msg: `dropped ${lot.massKg.toFixed(1)} kg` };
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------
const walker = new Walker(body);
// Contact reads the DRAWN ground wherever the patch covers, and the field
// beyond it. This is what stops the player floating above or sinking into the
// surface they can see — one surface at two resolutions, never two surfaces.
walker.groundSampler = (dx, dy, dz) => patch.surfaceRadiusAt(dx, dy, dz);
walker.placeAtGeodetic(SPAWN.lat, SPAWN.lon, 1.5);
patch.rebuild(walker.worldPos.x, walker.worldPos.y, walker.worldPos.z);
patchEntry.worldPos = patch.worldPos;

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

// The action button exists only when there is something to do with it — the
// same rule as the movement stick. No permanent controls waiting on screen.
const actionBtn = document.getElementById('btn-action');
let actionFlash = 0;
function refreshAction() {
  if (actionFlash > 0) return;
  const inReach = !!digTarget();
  const load = carriedMass();
  if (inReach && load < carryCapacityKg) {
    actionBtn.style.display = 'block';
    actionBtn.textContent = load > 0 ? 'Dig  ·  hold to drop' : 'Dig';
  } else if (load > 0) {
    actionBtn.style.display = 'block';
    actionBtn.textContent = 'Drop';
  } else {
    actionBtn.style.display = 'none';
  }
}
function flash(msg) {
  actionBtn.style.display = 'block';
  actionBtn.textContent = msg;
  actionFlash = 0.9;
}

// Tap digs; press and hold drops. One button, two verbs, no clutter.
let holdTimer = null;
actionBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  holdTimer = setTimeout(() => { holdTimer = null; flash(doDump().msg); }, 420);
});
actionBtn.addEventListener('pointerup', (e) => {
  e.preventDefault(); e.stopPropagation();
  if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; flash(doDig().msg); }
});

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

  if (patch.needsRebuild(walker.worldPos.x, walker.worldPos.y, walker.worldPos.z)) {
    patch.rebuild(walker.worldPos.x, walker.worldPos.y, walker.worldPos.z);
    patchEntry.worldPos = patch.worldPos;
  }

  updateCamera();
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
  ledger: () => edits.ledger(carried),
  step: (dt = 1 / 60) => engine.step(dt),
  goto: (lat, lon) => {
    walker.placeAtGeodetic(lat, lon, 1.5);
    patch.rebuild(walker.worldPos.x, walker.worldPos.y, walker.worldPos.z);
    patchEntry.worldPos = patch.worldPos;
  },
};
