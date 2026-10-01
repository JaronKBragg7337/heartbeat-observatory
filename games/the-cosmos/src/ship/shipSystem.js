// ============================================================================
// shipSystem.js — the ship as a whole: built, placed on Mars, boarded, flown.
//
// OWNS: constructing the ship's interior and exterior into their scenes, putting
//       it on the ground near the player, the aboard/seated/outside state of the
//       player, the ramps and airlock, the lights, the camera while aboard, and
//       the per-frame order of everything the ship does.
// DOES NOT OWN: dimensions (shipSpec.js), walking (shipWalker.js), flight
//       (shipFlight.js), permissions (shipStations.js), bolts (guns.js), any
//       drawing routine.
//
// TWO SCENES, ONE DEPTH BUFFER
// ----------------------------
// The world is lit by a sun and a butterscotch sky. Inside a steel hull neither
// of those reaches you. Lights cannot be excluded per object in three.js, so the
// interior lives in its own scene with its own lights, drawn AFTER the world
// into the same depth buffer. Walls occlude terrain, the canopy glass shows it,
// and the sun never leaks through a bulkhead. The engine draws overlay scenes
// (see Engine.overlayScenes).
// ============================================================================

import * as THREE from 'three';
import { buildLayout, SHIP_ID, SHIP_NAME, SHIP_PHYS, GEAR, RAMPS, SEATS, PANELS, WALL_SCREENS, AVATAR, deckName, DECK, OBSERVATION } from './shipSpec.js';
import { ShipWalker, shipIndex, defaultState } from './shipWalker.js';
import { ShipBody } from './shipFlight.js';
import { Stations } from './shipStations.js';
import { GunSystem, DroneSystem, NEUTRAL_AIRSPACE_M } from './guns.js';
import { makeShipMaterials, applyEnvironment, makeSignAtlas, makePosterAtlas, DEPTH_LIFT, depthLiftStepFor } from './shipTextures.js';
import { depthEmulation } from '../dev/depthEmu.js';
import { buildInterior, buildSeats, NEST_SILL } from './shipInterior.js';
import { buildExterior, decalCanvasTexture, applyNeutralPose, HULL_STATIONS } from './shipExterior.js';
import { ShipScreens, TerrainScanner, KIND_FOR } from './shipScreens.js';
import { ShipFx, buildTargetMesh, buildDroneMesh, buildShieldMesh } from './shipFx.js';
import { ShipAudio } from './shipAudio.js';
import { geodeticToCartesian, cartesianToGeodetic, localFrame, cellIndex, cellLabel } from '../world/geodesy.js';
import { gravityAtRadius } from '../world/bodies.js';
import { Kit } from './shipKit.js';
import { findLandingSite, siteOrigin } from './shipSite.js';
import { buildPortals, reachRooms } from './shipVisibility.js';
import { rampEntry } from './rampTransfer.js';

const DEG = Math.PI / 180;
const SCAN_RANGES = [600, 2500, 9000];
// rooms with real windows in the outer wall (the exterior is drawn for them on the high tier)
const WINDOW_ROOMS = new Set(['crew_a', 'crew_b', 'medbay', 'galley', 'cabin', 'workshop']);

export class ShipSystem {
  constructor(o) {
    this.engine = o.engine;
    this.body = o.body;
    this.registry = o.registry;
    this.ground = o.ground;                 // (dx,dy,dz) -> outer surface solved in the density field
    this.walker = o.walker;                 // the planet walker; the ship never edits its physics
    this.spawn = o.spawn;
    this.landingSite = o.landingSite;
    this.tier = o.tier || 'high';
    this.ready = false;
    this.aboard = false;
    this.layout = buildLayout();
    this.state = defaultState();
    this.state.airlock.innerOpen = true;
    this.state.airlock.outerOpen = false;
    this.sw = new ShipWalker(shipIndex, this.state);
    this.flight = new ShipBody(this.body, this.ground);
    this.stations = new Stations(this.flight, {
      onSit: (s) => this._onSit(s), onStand: (s) => this._onStand(s),
    });
    this.guns = new GunSystem(this.flight, this.stations, this.ground);
    this.look = { yaw: 0, pitch: 0 };       // relative to the seat
    this.time = 0;
    this.boardCooldown = 0;
    this.rampCtl = {
      cargo: { progress: 0, target: 0, angle: 0.5 },
      airlock: { progress: 0, target: 0, angle: 0.5 },
    };
    this.air = { phase: 'idle', t: 0 };
    this.lightPool = [];
    this.tel = {};
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._eye = { x: 0, y: 0, z: 0 };
    this.eyeLocal = { x: 0, y: 0, z: 0 };
    this.currentRoom = null;
    this.scanRangeIdx = 1;
    this.targets = [];
    this.fireHeld = false;
    this.uiLift = 0;
    this.lastFrameStats = { visibleRooms: 0 };
    this.hudExtra = '';
    this.zoomOn = false; this.zoomFov = 24; this.baseFov = null;     // binoculars at an observation spot
    this.crew = null;                       // the hired crew (src/crew/crewSystem.js), set by main once it is built
  }

  // =========================================================================
  // BUILD
  // =========================================================================
  build() {
    const t0 = performance.now();
    const { engine } = this;
    const low = this.tier === 'low';

    // --- how deep is the depth buffer really? Faces that share a plane are pulled apart by a few steps of it.
    try {
      const gl = engine.renderer.getContext();
      this.depthBits = depthEmulation || gl.getParameter(gl.DEPTH_BITS) || 16;
    } catch (e) { this.depthBits = 16; }
    DEPTH_LIFT.value = depthLiftStepFor(this.depthBits);

    // --- materials: one set of textures, two sets of materials (each needs its own environment)
    this.matsInt = makeShipMaterials({ tier: this.tier });
    this.matsExt = cloneMaterials(this.matsInt);
    this._makeEnvironments();
    this._initWindowClip();

    // --- interior scene
    this.scene = new THREE.Scene();
    engine.overlayScenes.push(this.scene);
    this.hemi = new THREE.HemisphereLight(0xb4c4d6, 0x59606a, 1.0);
    this.scene.add(this.hemi);

    this.signs = makeSignAtlas();
    this.posters = makePosterAtlas();
    this.interior = buildInterior(this.layout, this.matsInt, { tier: this.tier, signs: this.signs, posters: this.posters });
    this.interior.mats = this.matsInt;
    buildSeats(this.layout, this.matsInt, this.interior);
    this.scene.add(this.interior.root);

    // --- glass, in the interior scene so it is drawn over the world
    this._buildGlass();

    // --- screens
    this.scanner = new TerrainScanner(this.ground, low ? 48 : 72);
    this.screens = new ShipScreens({ tier: this.tier, scanner: this.scanner });
    this._buildScreens();

    // --- exterior, in the world scene
    this.decal = null;
    const dtex = decalCanvasTexture(THREE);
    if (dtex) this.decal = new THREE.MeshBasicMaterial({ map: dtex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    this.exterior = buildExterior(this.layout, this.matsExt, { tier: this.tier, decal: this.decal });
    engine.scene.add(this.exterior.root);
    // Flames are effects, not hardware. Keep them out of the measured envelope.
    this.hardware = new THREE.Group(); this.hardware.name = 'ship-hardware';
    this.effects = new THREE.Group(); this.effects.name = 'ship-effects';
    for (const ch of [...this.exterior.root.children]) {
      if (ch.name === 'exhaust' || (ch.isMesh && ch.material && ch.material.blending === THREE.AdditiveBlending)) this.effects.add(ch);
      else this.hardware.add(ch);
    }
    this.exterior.root.add(this.hardware, this.effects);

    // --- tracked by the floating origin, sharing the ship's own pose
    this.entryExt = engine.track({ worldPos: this.flight.pos, object3d: this.exterior.root, quaternion: this.flight.quaternion });
    this.entryInt = engine.track({ worldPos: this.flight.pos, object3d: this.interior.root, quaternion: this.flight.quaternion });

    // --- one shadow-casting spot, over whichever room you are standing in (desktop tier only)
    for (const k of Object.keys(this.matsInt)) {
      if (k.startsWith('wall:') || k.startsWith('floor:') || k === 'ceil') this.matsInt[k].shadowSide = THREE.DoubleSide;
    }
    if (!low) {
      const sp = new THREE.SpotLight(0xfff1dc, 0, 14, 1.2, 0.6, 2);
      sp.castShadow = true;
      sp.shadow.mapSize.set(1024, 1024);
      sp.shadow.bias = -0.0004; sp.shadow.normalBias = 0.05;
      sp.shadow.camera.near = 0.3; sp.shadow.camera.far = 18;
      this.interior.root.add(sp, sp.target);
      this.spot = sp; this.spotK = 0; this.spotRoom = null;
    }

    // --- light pool
    const K = low ? 4 : 6;
    for (let i = 0; i < K; i++) {
      const L = new THREE.PointLight(0xffffff, 0, 10, 2);
      this.interior.root.add(L);
      this.lightPool.push({ light: L, fixture: -1, target: -1, k: 0 });
    }

    // --- fx (world scene)
    this.fx = new ShipFx(engine.scene, { tier: this.tier });

    // --- size is measured in the neutral pose, before anything moves
    applyNeutralPose(this.exterior);
    this._registerAssets();

    // --- put it on the ground
    this._place();

    // --- ramps start lowered so the way in is obvious
    this.rampCtl.cargo.progress = 1; this.rampCtl.cargo.target = 1;
    this._solveRamp('cargo');
    this.state.ramps.cargo.lowered = true;
    this._applyRampPose('cargo');
    this._applyRampPose('airlock');

    this._placeTargets();
    this._placeDrones();
    this.audio = typeof window !== 'undefined' ? new ShipAudio() : null;
    this.shield = buildShieldMesh();
    this.exterior.root.add(this.shield);
    this.shieldFlash = 0; this.hitShake = 0;

    this.note('Systems nominal. Ship down and stable.');
    this.buildMs = performance.now() - t0;
    this.ready = true;
    this._updateVisuals(0, true);
    return this.buildMs;
  }

  // -------------------------------------------------------------------------
  // WINDOWS THAT LOOK OUT. The hull's skin is drawn (from the inside too) just beyond every window, so a window showed grey plating
  // instead of Mars. In the room you are standing in, the skin is cut away inside the window's opening: a box of clipping planes
  // (clipIntersection: only what is inside ALL six is discarded) on the ship's exterior materials. The planes are re-aimed each
  // frame in render space; when you are not in a window room the box is parked a million metres away (no shader change, no hitch).
  // -------------------------------------------------------------------------
  _initWindowClip() {
    this.windowClip = { planes: Array.from({ length: 6 }, () => new THREE.Plane(new THREE.Vector3(1, 0, 0), 1e9)), room: null, boxes: new Map() };
    for (const w of this.layout.windows || []) {
      const r = this.layout.roomById.get(w.room);
      const x0 = w.wall === 'x0' ? r.x0 - 1.8 : r.x1 - 0.12, x1 = w.wall === 'x0' ? r.x0 + 0.12 : r.x1 + 1.8;
      // padded well beyond the opening: rays through a window fan out with distance, and everything outside the opening is
      // hidden from inside by the room's own wall anyway
      const pad = 2.2;
      this.windowClip.boxes.set(w.room, { x0, x1, y0: r.y + (w.y0 - 3.0) - pad, y1: r.y + (w.y1 - 3.0) + pad, z0: w.c - w.w / 2 - pad, z1: w.c + w.w / 2 + pad });
    }
    for (const k of Object.keys(this.matsExt)) {
      const m = this.matsExt[k];
      if (!m || !m.isMaterial) continue;
      m.clippingPlanes = this.windowClip.planes; m.clipIntersection = true;
    }
    if (this.engine.renderer) this.engine.renderer.localClippingEnabled = true;
  }

  /** Aim the box at the window of the room the camera is in (or park it). Ship-local box -> render space. */
  _windowClipFrame() {
    const wc = this.windowClip; if (!wc) return;
    const room = this.aboard ? this.currentRoom : null;
    const b = room ? wc.boxes.get(room) : null;
    const P = wc.planes;
    if (!b) { for (const p of P) { p.normal.set(1, 0, 0); p.constant = 1e9; } return; }
    const q = this.flight.quaternion, cam = this.engine.cameraWorldPos, f = this.flight.pos;
    const t = this._v.set(f.x - cam.x, f.y - cam.y, f.z - cam.z);
    // inside the box: x < x1, x > x0, y < y1, y > y0, z < z1, z > z0   (negative signed distance = clipped)
    const defs = [[1, 0, 0, -b.x1], [-1, 0, 0, b.x0], [0, 1, 0, -b.y1], [0, -1, 0, b.y0], [0, 0, 1, -b.z1], [0, 0, -1, b.z0]];
    defs.forEach(([nx, ny, nz, c], i) => {
      const n = this._v2.set(nx, ny, nz).applyQuaternion(q);
      P[i].normal.copy(n); P[i].constant = c - n.dot(t);
    });
  }

  _makeEnvironments() {
    const r = this.engine.renderer;
    const pm = new THREE.PMREMGenerator(r);
    // exterior: a dusty sky with a low sun
    {
      const sc = new THREE.Scene();
      const g = new THREE.SphereGeometry(50, 32, 16);
      const cols = [];
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i) / 50;
        const top = new THREE.Color(0x3a3350), hor = new THREE.Color(0xd9a878), bot = new THREE.Color(0x6b3b28);
        const c = y > 0 ? hor.clone().lerp(top, Math.pow(y, 0.6)) : hor.clone().lerp(bot, Math.min(1, -y * 2));
        cols.push(c.r, c.g, c.b);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      sc.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      const sun = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.92, 0.75).multiplyScalar(30) }));
      sun.position.set(-30, 26, -20);
      sc.add(sun);
      this.envSky = pm.fromScene(sc, 0.02).texture;
    }
    // interior: a ceiling of light panels over dark walls
    {
      const sc = new THREE.Scene();
      sc.add(new THREE.Mesh(new THREE.BoxGeometry(30, 12, 30), new THREE.MeshBasicMaterial({ color: 0x1b2026, side: THREE.BackSide })));
      const panel = (x, y, z, w, h, d, c, k) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) }));
        m.position.set(x, y, z); sc.add(m);
      };
      panel(0, 5.6, 0, 22, 0.2, 3, 0xfff1dc, 7);
      panel(-6, 5.6, 8, 8, 0.2, 2, 0xdfeaff, 5);
      panel(6, 5.6, -8, 8, 0.2, 2, 0xffe0b0, 5);
      panel(-14.5, 1.5, 0, 0.2, 2, 12, 0x59d8ff, 2.2);
      panel(14.5, 1.5, 0, 0.2, 2, 12, 0xffb45a, 2.2);
      this.envRoom = pm.fromScene(sc, 0.03).texture;
    }
    pm.dispose();
    applyEnvironment(this.matsInt, this.envRoom, 0.55);
    applyEnvironment(this.matsExt, this.envSky, 0.85);
    // Glass gets a stronger reflection
    this.matsInt.glass.envMapIntensity = 1.2;
  }

  _buildGlass() {
    const L = this.layout;
    const k = new (this._KitClass())();
    const b = L.roomById.get('bridge');
    const yb = b.y + 1.05, yt = b.y + b.h;
    const raked = 0.6;
    // windscreen (raked back at the top) and side windows
    k.poly('glassTint', [[-4.0, yb, b.z0], [4.0, yb, b.z0], [4.0, yt, b.z0 + raked], [-4.0, yt, b.z0 + raked]]);
    for (const s of [-1, 1]) {
      const x = s * 4.0;
      const z0 = b.z0 - 0.0, z1 = b.z1 - 0.4;
      k.poly('glassTint', s > 0
        ? [[x, yb, z0], [x, yb, z1], [x, yt, z1], [x, yt, z0]]
        : [[x, yb, z1], [x, yb, z0], [x, yt, z0], [x, yt, z1]]);
    }
    // the nest: a band of glass round the gunner
    const n = L.roomById.get('nest');
    const ny0 = n.y + NEST_SILL, ny1 = n.y + n.h;
    const quad = (pts) => k.poly('glassTint', pts);
    quad([[n.x0, ny0, n.z0], [n.x1, ny0, n.z0], [n.x1, ny1, n.z0], [n.x0, ny1, n.z0]]);
    quad([[n.x1, ny0, n.z1], [n.x0, ny0, n.z1], [n.x0, ny1, n.z1], [n.x1, ny1, n.z1]]);
    quad([[n.x1, ny0, n.z0], [n.x1, ny0, n.z1], [n.x1, ny1, n.z1], [n.x1, ny1, n.z0]]);
    quad([[n.x0, ny0, n.z1], [n.x0, ny0, n.z0], [n.x0, ny1, n.z0], [n.x0, ny1, n.z1]]);
    // ventral bubble: a dome under the floor of the pit
    k.dome('glassTint', 0, -0.4, -15.3, 1.2, 20, 10, { thetaMin: Math.PI * 0.5, thetaMax: Math.PI, scaleY: 0.95, inside: false });
    const g = k.toGroup(this.matsInt, { name: 'glass' });
    g.traverse((m) => { if (m.isMesh) m.renderOrder = 6; });
    this.glass = g;
    this.interior.root.add(g);
    // frame struts for the ventral bubble
    const fk = new (this._KitClass())();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      fk.pipe('steelDark', [Math.cos(a) * 1.15, -0.4, -15.3 + Math.sin(a) * 1.15], [0, -1.35, -15.3], 0.03, 6);
    }
    this.interior.root.add(fk.toGroup(this.matsInt, { name: 'ventral-frame' }));
  }

  _KitClass() { return Kit; }

  _buildScreens() {
    const L = this.layout;
    // console screens
    for (const p of L.props) {
      if (p.kind !== 'console' || !p.screens) continue;
      const kinds = KIND_FOR[p.station] || [];
      const n = p.screens;
      const th = (p.rot || 0) * Math.PI / 2;
      const c = Math.cos(th), s = Math.sin(th);
      for (let i = 0; i < n; i++) {
        const t = ((i + 0.5) / n - 0.5) * p.w;
        const sw = p.w / n - 0.06 - 0.06;
        const lx = t, ly = p.h + (p.lift ?? 0.27), lz = -p.d * 0.05 + 0.032;
        this.screens.create({
          id: `scr_${p.room}_${p.x}_${p.z}_${i}`, kind: kinds[i] || 'idle', room: p.room,
          w: sw, h: p.sh ?? 0.44, x: p.x + c * lx + s * lz, y: p.y + ly, z: p.z - s * lx + c * lz, facing: th,
        }, this.interior.rooms.get(p.room));
      }
    }
    // wall screens
    for (const w of WALL_SCREENS) {
      this.screens.create({ ...w }, this.interior.rooms.get(w.room));
    }
    // monitor stands in the medbay
    for (const p of L.props.filter((q) => q.kind === 'monitor_stand')) {
      const th = (p.rot || 0) * Math.PI / 2, c = Math.cos(th), s = Math.sin(th);
      this.screens.create({ id: `scr_stand_${p.x}`, kind: 'vitals', room: p.room, w: 0.4, h: 0.26,
        x: p.x + s * 0.052, y: p.y + 1.42, z: p.z + c * 0.052, facing: th }, this.interior.rooms.get(p.room));
    }
    // captain's armrest pads and the holo table are handled in _updateVisuals
    this._buildHolo();
  }

  _buildHolo() {
    const g = new THREE.Group();
    g.position.set(-3.3, 1.0 + 6.0, -15.8);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.006, 6, 48), this.matsInt.glowCyan);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.3;
    const sph = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 12),
      new THREE.MeshBasicMaterial({ color: 0x59d8ff, wireframe: true, transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false }));
    sph.position.y = 0.36;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xc98a5a, transparent: true, opacity: 0.85, toneMapped: false }));
    core.position.y = 0.36;
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.55, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x59d8ff, transparent: true, opacity: 0.08, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 0.24; beam.rotation.x = Math.PI;
    g.add(ring, sph, core, beam);
    this.interior.rooms.get('bridge').add(g);
    this.holo = { group: g, sphere: sph, core };
  }

  // =========================================================================
  // PLACEMENT
  // =========================================================================
  _place() {
    const { site, at } = this.landingSite
      ? { site: this.landingSite.site, at: null }
      : findLandingSite(this.body, this.ground, { ...this.walker.worldPos });
    this.site = site;
    this.flight.setDown(this.landingSite ? this.landingSite.toWorld(0,3.8,0) : siteOrigin(this.ground, at, site), site.hd * DEG);
    // Let it settle on the field before anyone sees it.
    for (let i = 0; i < 60 * 9; i++) this.flight.step(1 / 60);
    this.flight.vel = { x: 0, y: 0, z: 0 };
    this.flight.refreshOrientation();
    this._syncEntries();
  }

  _syncEntries() {
    // The ship's pose objects are shared by reference: pos and quaternion.
    this.entryExt.worldPos = this.flight.pos;
    this.entryInt.worldPos = this.flight.pos;
  }

  _placeTargets() {
    // Three practice targets ahead of the bow, on the real ground.
    const f = this.flight;
    const base = f.pos;
    const fwd = f.fwdH, right = f.rightH;
    const spots = [[120, -25], [190, 30], [260, -5]];
    spots.forEach(([d, side], i) => {
      const x = base.x + fwd.x * d + right.x * side, y = base.y + fwd.y * d + right.y * side, z = base.z + fwd.z * d + right.z * side;
      const l = Math.hypot(x, y, z);
      const g = this.ground(x / l, y / l, z / l);
      const pos = { x: (x / l) * g, y: (y / l) * g, z: (z / l) * g };
      const mesh = buildTargetMesh();
      const upv = new THREE.Vector3(pos.x, pos.y, pos.z).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), upv);
      // face the disc toward the ship
      const toShip = new THREE.Vector3(base.x - pos.x, base.y - pos.y, base.z - pos.z).projectOnPlane(upv).normalize();
      const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(upv, toShip).normalize(), upv, toShip);
      q.setFromRotationMatrix(basis);
      this.engine.scene.add(mesh);
      const entry = this.engine.track({ worldPos: pos, object3d: mesh, quaternion: q });
      const id = `COS-MARS-PRP-${String(i + 1).padStart(4, '0')}`;
      const centre = { x: pos.x + upv.x * 3.2, y: pos.y + upv.y * 3.2, z: pos.z + upv.z * 3.2 };
      const t = this.guns.addTarget({ id, pos: centre, radius: 1.5 });
      this.targets.push({ id, mesh, entry, pos, t, flash: 0 });
      this.registry.register({
        id, bodyId: 'mars', type: 'PRP', name: `Practice target ${i + 1}`, position: pos,
        authored: { width: 2.8, height: 3.26, depth: 2.8 }, massKg: 60, collision: 'none', materialId: 'MAT-ALUMINIUM',
        object3d: mesh, note: 'Steel disc on a post. Fire the guns at it.',
      });
      this.registry.measure(id, THREE);
    });
  }

  _placeDrones() {
    this.drones = new DroneSystem(this.flight, this.guns, this.ground);
    this.droneViews = [];
    const f = this.flight;
    const base = f.pos;
    // three hostile drones at a few hundred metres, 60 m over the ground, in different directions
    const spots = [[560, 0.6], [820, -1.3], [690, 2.6]];
    spots.forEach(([d, brg], i) => {
      const fr = f._frame;
      const e = Math.sin(brg) * d, n = Math.cos(brg) * d;
      const x = base.x + fr.east.x * e + fr.north.x * n, y = base.y + fr.east.y * e + fr.north.y * n, z = base.z + fr.east.z * e + fr.north.z * n;
      const l = Math.hypot(x, y, z);
      const g = this.ground(x / l, y / l, z / l);
      const R = g + 60;
      const id = `COS-MARS-VEH-${String(i + 2).padStart(4, '0')}`;
      const dr = this.drones.add(id, { x: (x / l) * R, y: (y / l) * R, z: (z / l) * R });
      const mesh = buildDroneMesh();
      this.engine.scene.add(mesh);
      const entry = this.engine.track({ worldPos: dr.pos, object3d: mesh, quaternion: new THREE.Quaternion() });
      this.droneViews.push({ dr, mesh, entry });
      this.registry.register({
        id, bodyId: 'mars', type: 'VEH', name: `Hostile drone ${i + 1}`, position: dr.pos,
        massKg: 180, collision: 'none', materialId: 'MAT-ALUMINIUM',
        object3d: mesh, note: 'Armed. Mars is neutral: it does not exist inside the airspace of the planet and arrives only once a ship climbs beyond it.',
      });
    });
  }

  _registerAssets() {
    registerShipAssets(this.registry, THREE, this.hardware, this.interior.seatGroups, this.flight.pos);
  }

  // =========================================================================
  // STATE
  // =========================================================================
  note(msg, warn = false) { this.stations.note(msg, warn); }

  _onSit(seat) {
    this.look.yaw = 0; this.look.pitch = 0;
    // The dorsal gunner starts looking a little up: straight ahead is the back of the bridge tower.
    if (seat.id === 'gun_dorsal') this.look.pitch = 0.3;
    if (seat.id === 'gun_ventral') this.look.pitch = -0.7;                 // the ground is under you
    this.sw.vx = this.sw.vz = 0;
    this.note(`${seat.name}: seated.`);
    if (this.crew) this.crew.onPlayerSit(seat.id);           // whoever was in it gets up
    if (this.onStationChange) this.onStationChange(seat);
  }
  _onStand(seat) {
    this._swivelSeat(seat, seat.yaw * DEG);
    const sg = this.interior && this.interior.seatGroups && this.interior.seatGroups.get(seat.id); if (sg) sg.visible = true;
    // step out in front of the seat
    const yaw = seat.yaw * DEG;
    this.sw.place(seat.x + Math.sin(yaw) * -0.0, seat.y, seat.z, this.sw.yaw);
    this._standClear(seat);
    this.note(`${seat.name}: stood down.`);
    if (this.crew) this.crew.onPlayerStand(seat.id);         // and they sit back down
    if (this.onStationChange) this.onStationChange(null);
  }

  /** Turn a seat model about its own post (a turret chair follows where the gunner looks). */
  _swivelSeat(seat, yaw) {
    const g = this.interior.seatGroups.get(seat.id);
    if (g) g.rotation.y = -yaw;
  }

  /** Move the standing body somewhere legal beside the seat. */
  _standClear(seat) {
    const offsets = [[0, 0.9], [0.9, 0], [-0.9, 0], [0, -0.9], [0.6, 0.6], [-0.6, 0.6], [1.2, 0], [0, 1.3]];
    const yaw = seat.yaw * DEG;
    const fwd = { x: Math.sin(yaw), z: -Math.cos(yaw) }, rgt = { x: Math.cos(yaw), z: Math.sin(yaw) };
    for (const [a, b] of offsets) {
      const x = seat.x - fwd.x * b + rgt.x * a, z = seat.z - fwd.z * b + rgt.z * a;
      const s = this.sw.canStand(x, seat.y, z);
      if (s) { this.sw.place(x, s.floor, z, yaw); return; }
    }
    this.sw.place(seat.x, seat.y, seat.z, yaw);
  }

  get seat() { return this.stations.seated ? this.stations.seatDef(this.stations.seated) : null; }

  /** Put the walking body aboard at a ship-local place. */
  boardAt(x, y, z, yaw) {
    this.sw.place(x, y, z, yaw);
    this.aboard = true;
    this.note('Boarded.');
  }

  /** Step out onto the ground. */
  disembark(key) {
    const w = this.walker;
    const wp = this.flight.toWorld({ x: this.sw.x, y: this.sw.y, z: this.sw.z });
    w.worldPos.x = wp.x; w.worldPos.y = wp.y; w.worldPos.z = wp.z;
    w.velocity = { x: 0, y: 0, z: 0 };
    w.yaw = this.flight.heading + this.sw.yaw; w.pitch = this.sw.pitch;
    w.grounded = false;
    // The last supported centre is just beyond the physical ramp tip; retain
    // its horizontal position and resolve only the centimetres of foot clearance.
    const r = Math.hypot(wp.x,wp.y,wp.z), gr=this.ground(wp.x/r,wp.y/r,wp.z/r);
    if(gr!=null && r<gr+.02) Object.assign(w.worldPos,{x:wp.x*(gr+.02)/r,y:wp.y*(gr+.02)/r,z:wp.z*(gr+.02)/r});
    this.aboard = false;
    this.boardCooldown = 0;
    this.note('Stepped off the ship.');
  }

  // =========================================================================
  // RAMPS AND AIRLOCK
  // =========================================================================
  /** Solve the angle at which the ramp's end just touches the ground. */
  _solveRamp(key) {
    const R = RAMPS[key];
    const f = this.flight;
    let ang = 0.5;
    for (let it = 0; it < 5; it++) {
      const run = R.length * Math.cos(ang);
      const end = f.toWorld({ x: R.hinge.x + R.dir.x * run, y: R.hinge.y - R.length * Math.sin(ang), z: R.hinge.z + R.dir.z * run });
      const hinge = f.toWorld({ x: R.hinge.x + R.dir.x * run, y: R.hinge.y, z: R.hinge.z + R.dir.z * run });
      const l = Math.hypot(end.x, end.y, end.z);
      const gr = this.ground(end.x / l, end.y / l, end.z / l);
      const hl = Math.hypot(hinge.x, hinge.y, hinge.z);
      const drop = hl - (gr === null || gr === undefined ? hl - 2.6 : gr);
      ang = Math.asin(Math.max(0.05, Math.min(0.9, drop / R.length)));
    }
    ang = Math.max(0.12, Math.min(0.72, ang));
    this.rampCtl[key].angle = ang;
    this.state.ramps[key].angle = ang;
    return ang;
  }

  rampState(key) {
    const c = this.rampCtl[key];
    if (c.progress >= 0.999) return 'lowered';
    if (c.progress <= 0.001) return 'raised';
    return c.target > c.progress ? 'lowering' : 'raising';
  }

  /** Is anybody standing on this ramp (so it must not fold)? */
  _rampOccupied(key) {
    if (!this.aboard) return false;
    const R = RAMPS[key];
    const w = this.sw;
    const run = R.length * Math.cos(this.rampCtl[key].angle);
    if (R.dir.z) return w.z > R.hinge.z + 0.2 && w.z < R.hinge.z + run + 1 && Math.abs(w.x - R.hinge.x) < R.width / 2 + 0.3 && w.y < 0.6;
    return w.x < R.hinge.x - 0.2 && w.x > R.hinge.x - run - 1 && Math.abs(w.z - R.hinge.z) < R.width / 2 + 0.3 && w.y < 0.6;
  }

  toggleRamp(key = 'cargo') {
    const c = this.rampCtl[key];
    if (c.target > 0.5) {
      if (this._rampOccupied(key)) { this.note('Clear the ramp first.', true); return false; }
      c.target = 0; this.state.ramps[key].lowered = false;
      this.note(`${RAMPS[key].name} raising.`);
      return true;
    }
    if (!this.flight.landed) { this.note('Cannot open the ramp in flight.', true); return false; }
    this._solveRamp(key);
    c.target = 1;
    this.note(`${RAMPS[key].name} lowering.`);
    return true;
  }

  /** Airlock sequence: inner shut, cycle, outer opens and the gangway comes down (or the reverse). */
  cycleAirlock() {
    const a = this.air;
    if (a.phase !== 'idle') return false;
    if (this.state.airlock.outerOpen) {
      if (this._rampOccupied('airlock')) { this.note('Clear the gangway first.', true); return false; }
      a.phase = 'closing_outer'; a.t = 0;
      this.rampCtl.airlock.target = 0; this.state.ramps.airlock.lowered = false;
      this.note('Airlock: securing outer hatch.');
    } else {
      if (!this.flight.landed) { this.note('Cannot open the outer hatch in flight.', true); return false; }
      a.phase = 'closing_inner'; a.t = 0;
      this.note('Airlock: inner door closing.');
    }
    return true;
  }

  _airlockStep(dt) {
    const a = this.air, st = this.state.airlock;
    if (a.phase === 'idle') return;
    a.t += dt;
    switch (a.phase) {
      case 'closing_inner': st.innerOpen = false; if (a.t > 1.2) { a.phase = 'cycling_out'; a.t = 0; this.note('Airlock: pumping down.'); } break;
      case 'cycling_out': if (a.t > 3.0) { a.phase = 'opening_outer'; a.t = 0; this._solveRamp('airlock'); this.rampCtl.airlock.target = 1; } break;
      case 'opening_outer': if (this.rampCtl.airlock.progress > 0.995) { st.outerOpen = true; this.state.ramps.airlock.lowered = true; a.phase = 'idle'; this.note('Airlock: outer hatch open.'); } break;
      case 'closing_outer': st.outerOpen = false; if (this.rampCtl.airlock.progress < 0.02) { a.phase = 'cycling_in'; a.t = 0; this.note('Airlock: repressurising.'); } break;
      case 'cycling_in': if (a.t > 3.0) { a.phase = 'opening_inner'; a.t = 0; } break;
      case 'opening_inner': st.innerOpen = true; if (a.t > 1.0) { a.phase = 'idle'; this.note('Airlock: inner door open.'); } break;
    }
  }

  _motorsRunning() {
    const m = (c) => c.progress > 0.001 && c.progress < 0.999;
    return m(this.rampCtl.cargo) || m(this.rampCtl.airlock);
  }

  _rampFrame(dt) {
    for (const key of ['cargo', 'airlock']) {
      const c = this.rampCtl[key];
      const speed = key === 'cargo' ? 1 / 6.0 : 1 / 5.0;
      if (c.progress < c.target) c.progress = Math.min(c.target, c.progress + dt * speed);
      else if (c.progress > c.target) c.progress = Math.max(c.target, c.progress - dt * speed);
      const lowered = c.progress >= 0.999 && c.target >= 1;
      this.state.ramps[key].lowered = lowered;
      this._applyRampPose(key);
    }
  }

  _applyRampPose(key) {
    const c = this.rampCtl[key];
    const r = this.exterior.ramps[key];
    const R = RAMPS[key];
    const p = c.progress;
    const ease = p * p * (3 - 2 * p);
    if (key === 'cargo') {
      r.hinge.rotation.set(-Math.PI / 2 + (c.angle + Math.PI / 2) * ease, 0, 0);
      r.hinge.scale.set(1, 1, 1);
    } else {
      // the gangway swings out from a vertical flap and extends: 2.5 m flap, 5 m deployed
      const len = 2.5 + 2.5 * Math.max(0, (p - 0.45) / 0.55);
      r.hinge.scale.set(1, 1, len / R.length);
      // built along +Z: rotate so +Z points to port (-X) and tilts down
      const tilt = -Math.PI / 2 + (c.angle + Math.PI / 2) * ease;
      r.hinge.rotation.set(0, 0, 0);
      r.hinge.quaternion.setFromEuler(new THREE.Euler(tilt, 0, 0, 'XYZ'));
      const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);   // +Z -> -X? see below
      // rotation about Y by +90 deg sends +Z to +X; we need -X, so -90 deg
      r.hinge.quaternion.premultiply(yaw);
    }
  }

  // =========================================================================
  // THE FRAME
  // =========================================================================
  /**
   * @param dt
   * @param inp { look:{dx,dy}, moveEast, moveNorth, run, jump, keys:Set, fire:boolean, tapAction:boolean }
   * @returns true when the ship owns the camera this frame
   */
  frame(dt, inp) {
    if (!this.ready) return false;
    this.time += dt;
    this.boardCooldown = Math.max(0, this.boardCooldown - dt);
    const f = this.flight;

    // ---- who is flying? ---------------------------------------------------------
    // A person in the pilot's or captain's chair flies by hand. Otherwise, if the crew have an order and an NPC pilot at the
    // controls, THEY fly it. The player's hands always win: touch the stick and the order is cancelled ("You have the controls").
    const seat = this.seat;
    const crewCtl = this.crew ? this.crew.pilotControls(dt) : null;
    if (seat && (seat.id === 'captain' || seat.id === 'pilot')) {
      const k = inp.keys;
      const lift = clamp((k && k.has('Space') ? 1 : 0) - (k && (k.has('KeyC') || k.has('ControlLeft')) ? 1 : 0) + this.uiLift, -1, 1);
      const stick = Math.abs(inp.moveNorth || 0) > 0.05 || Math.abs(inp.moveEast || 0) > 0.05 || lift !== 0;
      if (crewCtl && !stick) { f.controls.fwd = crewCtl.fwd; f.controls.lift = crewCtl.lift; f.controls.yaw = crewCtl.yaw; }
      else {
        if (crewCtl && stick) this.crew.cancelOrder('You have the controls.');
        this.stations.fly({ fwd: inp.moveNorth, yaw: inp.moveEast, lift });
      }
    } else if (crewCtl) {
      f.controls.fwd = crewCtl.fwd; f.controls.lift = crewCtl.lift; f.controls.yaw = crewCtl.yaw;
    } else if (!seat) {
      // nobody flying: the flight computer hovers
      f.controls.fwd = 0; f.controls.lift = 0; f.controls.yaw = 0;
    }
    // Ramp down means no lift-off. The flight computer folds it away first.
    if ((this.rampCtl.cargo.progress > 0.02 || this.rampCtl.airlock.progress > 0.02 || this.air.phase !== 'idle') && f.landed && f.controls.lift > 0) {
      f.controls.lift = 0;
      if (this.rampCtl.cargo.target > 0.5) this.toggleRamp('cargo');
      if (this.state.airlock.outerOpen && this.air.phase === 'idle') this.cycleAirlock();
      if (this.time - (this._warnAt || -9) > 6) { this.note('Securing ramp and hatches for lift-off. Hold LIFT.', true); this._warnAt = this.time; }
    }
    f.step(dt);
    for (const ev of f.events) {
      if (ev.type === 'liftoff') this.note('Lift-off.');
      if (ev.type === 'touchdown') this.note(`Touchdown at ${ev.speed.toFixed(1)} m/s.`);
      if (ev.type === 'hard_landing') this.note('Hard landing: hull damage.', true);
    }

    this._rampFrame(dt);
    this._airlockStep(dt);

    // ---- the person ---------------------------------------------------------------
    let owns = false;
    if (this.aboard) {
      owns = true;
      this._personFrame(dt, inp);
    } else {
      this._outsideFrame(dt, inp);
      if (this.aboard) { this._personFrame(0, { look: {dx:0,dy:0} }); owns = true; }
    }
    if (!this.aboard) owns = false;

    // ---- the crew: walking, sitting, working their stations -------------------------------
    if (this.crew) this.crew.update(dt);

    // ---- guns and the things that shoot back ---------------------------------------------
    this._gunFrame(dt, inp);
    this.drones.update(dt);
    if (this.audio) this.audio.update(dt, { thrustUp: f.thrustUp, maxLift: f.maxLiftN, thrustFwd: f.thrustFwd, maxDrive: f.maxDriveN, autoHover: f.autoHover, aboard: this.aboard || false, motors: this._motorsRunning() });
    for (const e of this.drones.drain()) {
      if (e.type === 'ship_hit') {
        if (this.audio) this.audio.hit(e.absorbed);
        this.shieldFlash = 1; this.hitShake = 0.35 + Math.min(0.5, e.hull < 100 ? 0.3 : 0);
        this.shield.material.uniforms.uHit.value.set(e.local.x / 15.5, (e.local.y - 3.2) / 10.5, (e.local.z - 0.5) / 28);
        this.shield.material.uniforms.uColor.value.set(e.absorbed > 0 ? 0.25 : 1.0, e.absorbed > 0 ? 0.75 : 0.3, e.absorbed > 0 ? 1.0 : 0.2);
        this.note(e.absorbed > 0 ? `Hit. Shield absorbed ${e.absorbed.toFixed(0)}.` : `Hull hit. Integrity ${e.hull.toFixed(0)}%.`, e.absorbed <= 0);
      } else if (e.type === 'airspace') {
        // The one cue: the line between Mars's neutral airspace and everything beyond it.
        if (e.neutral) this.note('Entering Mars neutral airspace. Contacts have broken off.');
        else this.note('Leaving Mars neutral airspace. Hostile contacts inbound.', true);
        this.airspaceBanner = { neutral: e.neutral, t: 6 };
      } else if (e.type === 'drone_fire' && this.aboard && !this._droneWarn) { this._droneWarn = 6; this.note('Contact firing on us.', true); }
      else if (e.type === 'impact') this.guns.events.push(e);
    }
    if (this._droneWarn) this._droneWarn = Math.max(0, this._droneWarn - dt);
    if (this.airspaceBanner) { this.airspaceBanner.t -= dt; if (this.airspaceBanner.t <= 0) this.airspaceBanner = null; }
    // crew patch the hull while the ship sits on the ground
    if (f.landed && f.hull < 100 && this.rampCtl.cargo.progress < 0.02) f.hull = Math.min(100, f.hull + dt * 0.5);

    this._zoomFrame(dt);
    this._updateVisuals(dt, false);
    this._windowClipFrame();
    return owns;
  }

  _personFrame(dt, inp) {
    const seat = this.seat;
    const sw = this.sw;
    // look
    const l = inp.look || { dx: 0, dy: 0 };
    if (seat) {
      const lim = this.stations.lookLimits();
      this.look.yaw = clamp(this.look.yaw + l.dx, -lim.yaw, lim.yaw);
      this.look.pitch = clamp(this.look.pitch - l.dy, -lim.down, lim.up);
      sw.vx = sw.vz = 0;
      const eyeY = seat.y + AVATAR.seatedEyeM;
      this.eyeLocal = { x: seat.x, y: eyeY, z: seat.z };
      this.camYaw = seat.yaw * DEG + this.look.yaw;
      this.camPitch = this.look.pitch;
      if (seat.role === 'turret') this._swivelSeat(seat, this.camYaw);      // a gunner's chair turns with the turret
      // The ventral gunner looks DOWN through the glass under the ship. The chair is under and behind the eye, so looking down
      // showed its cushion and back instead of the ground: it is not drawn while you look down from it (you are sitting on it).
      if (seat.id === 'gun_ventral') { const sg = this.interior.seatGroups.get(seat.id); if (sg) sg.visible = this.look.pitch > -0.35; }
      sw.x = seat.x; sw.y = seat.y; sw.z = seat.z;
    } else {
      const zk = this.baseFov ? this.engine.camera.fov / this.baseFov : 1;     // through binoculars the look slows to match
      sw.yaw += l.dx * zk;
      sw.pitch = clamp(sw.pitch - l.dy * zk, -1.45, 1.45);
      sw.tick(dt, { moveX: inp.moveEast, moveZ: inp.moveNorth, run: inp.run, jump: inp.jump });
      for (const e of sw.events) {
        if (e.startsWith('exit:')) { this.disembark(e.slice(5)); return; }
      }
      this.eyeLocal = { x: sw.x, y: sw.y + AVATAR.eyeM, z: sw.z };
      this.camYaw = sw.yaw; this.camPitch = sw.pitch;
    }
    this._placeCamera();
    // keep the planet walker glued to the person so patches, sun and debug follow
    const wp = this.flight.toWorld({ x: sw.x, y: sw.y, z: sw.z });
    this.walker.worldPos.x = wp.x; this.walker.worldPos.y = wp.y; this.walker.worldPos.z = wp.z;
    this.walker.velocity = { ...this.flight.vel };
    this.walker.yaw = this.flight.heading + this.camYaw;
    this.walker.pitch = this.camPitch;
    this.walker.grounded = true;
    this.walker.updateFrame();
  }

  _placeCamera() {
    const f = this.flight;
    const eye = f.toWorld(this.eyeLocal, this._eye);
    const cam = this.engine.cameraWorldPos;
    cam.x = eye.x; cam.y = eye.y; cam.z = eye.z;
    const sh = this.hitShake > 0 ? this.hitShake * 0.03 : 0;
    this._q.setFromEuler(new THREE.Euler(this.camPitch + (sh ? (Math.random() - 0.5) * sh : 0), -this.camYaw + (sh ? (Math.random() - 0.5) * sh : 0), sh ? (Math.random() - 0.5) * sh * 0.6 : 0, 'YXZ'));
    this.engine.camera.quaternion.copy(f.quaternion).multiply(this._q);
    this.engine.camera.up.set(0, 1, 0).applyQuaternion(f.quaternion);
  }

  _outsideFrame(dt, inp) {
    const w = this.walker, f = this.flight;
    const loc = f.toLocal(w.worldPos, this._v);
    // Solid hull: you cannot walk through it, or under the belly.
    const push = this._hullPush(loc);
    if (push) {
      const d = f.dirToWorld({ x: push.x, y: 0, z: push.z });
      w.worldPos.x += d.x; w.worldPos.y += d.y; w.worldPos.z += d.z;
      if (push.blockedVel) { w.velocity.x *= 0.2; w.velocity.y *= 0.2; w.velocity.z *= 0.2; }
    }
    if (this.boardCooldown > 0) return;
    // Boarding by walking onto a lowered ramp.
    const l2 = f.toLocal(w.worldPos, {});
    for (const key of ['cargo', 'airlock']) {
      const st = this.state.ramps[key];
      if (!st.lowered) continue;
      const yaw = w.yaw - f.heading;
      const mx=inp.moveEast||0, mz=inp.moveNorth||0;
      const motion={x:Math.sin(yaw)*mz+Math.cos(yaw)*mx,z:-Math.cos(yaw)*mz+Math.sin(yaw)*mx};
      const entry=rampEntry(key,st,l2,motion);
      if(!entry || !this.sw.canStand(entry.x,entry.y,entry.z)) continue;
      this.boardAt(entry.x,entry.y,entry.z,yaw);
      this.sw.pitch = w.pitch;
      return;
    }
  }

  /** Horizontal push (ship-local) needed to get a body at `loc` out of the hull, or null. */
  _hullPush(loc) {
    const H = AVATAR.heightM;
    const feet = loc.y;
    if (feet > 10.5 || feet + H < GEAR.keelY - 0.05) return null;
    const z = loc.z;
    if (z < -21.4 || z > 21.2) {
      // engines and the ramp gap: only the engine housings are solid, and only up high
      return null;
    }
    // ramp corridors are open when lowered
    const rc = this.state.ramps;
    if (rc.cargo.lowered && z > 19 && Math.abs(loc.x) < 2.0) return null;
    const hwAt = (zz) => {
      for (let i = 0; i < HULL_STATIONS.length - 1; i++) {
        const a = HULL_STATIONS[i], b = HULL_STATIONS[i + 1];
        if (zz >= a[0] && zz <= b[0]) return a[1] + (b[1] - a[1]) * ((zz - a[0]) / (b[0] - a[0]));
      }
      return 0;
    };
    const hw = hwAt(z) + 0.3;
    // the belly is solid down to the keel
    if (feet + H < GEAR.keelY - 0.05) return null;
    if (Math.abs(loc.x) >= hw) return null;
    // where would the shortest way out be?
    const outX = (hw - Math.abs(loc.x)) * Math.sign(loc.x || 1);
    const outZ = loc.z < 0 ? (-21.4 - z) : (21.2 - z);
    // the gangway hatch on the port side lets you in only when it is open
    if (rc.airlock.lowered && loc.x < -5 && Math.abs(z + 10.8) < 1.2) return null;
    if (Math.abs(outX) < Math.abs(outZ)) return { x: outX, z: 0, blockedVel: true };
    return { x: 0, z: outZ, blockedVel: true };
  }

  // ---- guns ----------------------------------------------------------------------------
  _gunFrame(dt, inp) {
    const g = this.guns;
    const seat = this.seat;
    if (seat && (seat.id === 'captain' || seat.id === 'gun_dorsal' || seat.id === 'gun_ventral')) {
      // where the camera looks, in ship-local
      const dirWorld = this._v2.set(0, 0, -1).applyQuaternion(this.engine.camera.quaternion);
      const inv = this.flight.quaternion.clone().invert();
      const dl = dirWorld.clone().applyQuaternion(inv);
      const gunId = seat.id === 'captain' ? 'main' : (seat.id === 'gun_dorsal' ? 'dorsal' : 'ventral');
      g.point(gunId, dl);
      this._aimWorld = { x: dirWorld.x, y: dirWorld.y, z: dirWorld.z };
      const want = inp.fire || this.fireHeld || (inp.keys && inp.keys.has('KeyF'));
      if (want) {
        const eye = this.flight.toWorld(this.eyeLocal, {});
        // main guns fire along the clamped aim, so out-of-arc shots go where the barrels point
        let dir = this._aimWorld;
        if (gunId === 'main') {
          const c = GunSystemDir(g.aim.main);
          const wd = this.flight.dirToWorld(c, {});
          dir = wd;
        }
        g.fire(gunId, dir, eye);
      }
    }
    g.update(dt);
    // targets: mirror hit points into their meshes
    for (const t of this.targets) {
      const alive = t.t.hp > 0;
      t.mesh.visible = alive || t.t.respawn > 6.5;
      t.mesh.scale.setScalar(alive ? 1 : Math.max(0.001, (t.t.respawn - 6.5)) );
      t.flash = Math.max(0, t.flash - dt * 4);
    }
  }

  // ---- visuals --------------------------------------------------------------------------
  /** Everything that follows from the ship's state: legs, lights, doors, screens, glow. */
  _updateVisuals(dt, first) {
    const f = this.flight;
    const ext = this.exterior;
    const t = this.time;

    // legs
    ext.legs.forEach((leg, i) => {
      const s = f.legs[i];
      const nom = s.ext * f.gearPos + 0.35 * (1 - f.gearPos);
      const len = Math.max(0.35, nom - s.comp * f.gearPos);
      leg.foot.position.y = -len;
      leg.piston.scale.y = len + 0.2;
      leg.piston.position.y = 0.2;
    });
    // engines
    const th = Math.min(1, f.thrustFwd / Math.max(1, f.maxDriveN));
    const tu = Math.min(1, f.thrustUp / Math.max(1, f.maxLiftN));
    for (const e of ext.engines) {
      e.outer.visible = e.core.visible = th > 0.03 || f.autoHover;
      const k = Math.max(0.06, th);
      e.outer.scale.set(0.8 + 0.5 * k, 0.8 + 0.5 * k, 0.4 + 1.6 * k);
      e.outer.material.opacity = 0.15 + 0.6 * k;
      e.core.scale.set(0.8 + 0.4 * k, 0.8 + 0.4 * k, 0.4 + 1.5 * k);
      e.core.material.opacity = 0.2 + 0.7 * k;
    }
    const airborne = !f.landed && f.thrustUp > 1000;
    for (const p of ext.liftPods) {
      const vis = airborne || f.thrustUp > f.weightN() * 0.2;
      p.mesh.visible = vis; p.core.visible = vis;
      const k = 0.3 + 0.9 * tu;
      p.mesh.scale.set(k, 0.4 + 1.3 * tu, k); p.core.scale.set(k, 0.4 + 1.3 * tu, k);
      p.mesh.material.opacity = 0.15 + 0.6 * tu; p.core.material.opacity = 0.2 + 0.7 * tu;
    }
    // On a phone the sun's shadow of the ship is not worth a second pass over 60 meshes while you are inside it.
    const wantShadow = !(this.tier === 'low' && this.aboard);
    if (wantShadow !== this._shadowOn) {
      this._shadowOn = wantShadow;
      this.exterior.root.traverse((o) => { if (o.isMesh) o.castShadow = wantShadow; });
    }
    // the shield ripple
    if (this.shield) {
      this.shieldFlash = Math.max(0, this.shieldFlash - dt * 1.6);
      const u = this.shield.material.uniforms;
      u.uFlash.value = this.shieldFlash; u.uTime.value = this.time * 3;
      u.uStrength.value = f.shieldMax > 0 ? 0.35 + 0.65 * (f.shield / f.shieldMax) : 0.2;
      this.shield.visible = this.shieldFlash > 0.02;
      this.hitShake = Math.max(0, this.hitShake - dt * 1.4);
    }
    // drones face where they are heading and spin their rotors
    if (this.droneViews) for (const v of this.droneViews) {
      const alive = v.dr.target.hp > 0 && v.dr.state !== 'away';
      v.mesh.visible = alive;
      if (!alive) continue;
      const sp = Math.hypot(v.dr.vel.x, v.dr.vel.y, v.dr.vel.z);
      const up = new THREE.Vector3(v.dr.pos.x, v.dr.pos.y, v.dr.pos.z).normalize();
      // face the ship when attacking, else along the velocity
      const tx = v.dr.state === 'attack' ? f.pos.x - v.dr.pos.x : v.dr.vel.x, ty = v.dr.state === 'attack' ? f.pos.y - v.dr.pos.y : v.dr.vel.y, tz = v.dr.state === 'attack' ? f.pos.z - v.dr.pos.z : v.dr.vel.z;
      const fwd = new THREE.Vector3(tx, ty, tz).projectOnPlane(up);
      if (fwd.lengthSq() < 1e-6) fwd.set(1, 0, 0).projectOnPlane(up);
      fwd.normalize();
      const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
      v.entry.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, fwd.clone().negate()));
      v.mesh.userData.spin(dt);
      const pulse = 1.3 + 0.9 * Math.sin(this.time * (v.dr.state === 'attack' ? 12 : 3));
      v.mesh.userData.eye.color.setRGB(pulse, 0.012 * pulse, 0.008 * pulse);
    }
    // gun mounts
    const A = this.guns.aim;
    for (const m of ext.guns.main) m.group.rotation.set(A.main.pitch, -A.main.yaw, 0, 'YXZ');
    ext.guns.dorsal.yaw.rotation.y = -A.dorsal.yaw; ext.guns.dorsal.pitch.rotation.x = A.dorsal.pitch;
    ext.guns.ventral.yaw.rotation.y = -A.ventral.yaw; ext.guns.ventral.pitch.rotation.x = A.ventral.pitch;

    // reactor glow follows the power draw
    if (this.interior.reactorCore) {
      const load = (f.power.engines + f.power.guns + f.power.shields) / 100;
      const pulse = 0.85 + 0.15 * Math.sin(t * 2.4);
      const k = 0.9 + 0.5 * load * pulse;
      this.matsInt.reactor.color.setRGB(0.25 * k, 0.85 * k, 1.1 * k);
      this.interior.reactorInner.scale.setScalar(0.95 + 0.06 * Math.sin(t * 6));
    }
    if (this.holo) {
      this.holo.sphere.rotation.y = t * 0.5; this.holo.core.rotation.y = t * 0.5;
    }

    // doors
    this._doorsFrame(dt, first);
    // portal culling and the light pool
    this._roomsAndLights(dt, first);
    // screens (telemetry)
    this._telemetry();
    this._scannerFrame();
    this.screens.update(t, this.tel, this._camLocalForScreens(), (id) => this._roomVisible(id));
  }

  _camLocalForScreens() {
    if (this.aboard) return this.eyeLocal;
    const c = this.engine.cameraWorldPos;
    return this.flight.toLocal(c, {});
  }

  _doorsFrame(dt, first) {
    // Whoever is on their feet opens doors: the player, and any crew member walking through the ship.
    const actors = this.crew ? this.crew.actors() : [];
    if (this.aboard && !this.seat) actors.push({ x: this.sw.x, y: this.sw.y, z: this.sw.z });
    for (const d of this.interior.doors) {
      const def = d.def;
      let target = 0;
      if (def.id === 'd_airlock_in') target = this.state.airlock.innerOpen ? 1 : 0;
      else if (def.kind === 'outer') target = this.state.airlock.outerOpen || this.rampCtl.airlock.progress > 0.4 ? 1 : 0;
      else {
        const cx = def.axis === 'x' ? def.at : def.c, cz = def.axis === 'x' ? def.c : def.at;
        for (const pl of actors) if (Math.abs(pl.y - def.y) < 2.6 && Math.hypot(pl.x - cx, pl.z - cz) < (def.w > 1.6 ? 2.4 : 1.7)) { target = 1; break; }
      }
      if (target !== d.was) { if (!first && this.audio && this.aboard && (this._roomVisible(def.a) || this._roomVisible(def.b))) this.audio.door(); d.was = target; }
      if (first) d.open = target;
      else d.open += Math.sign(target - d.open) * Math.min(Math.abs(target - d.open), dt * 3.2);
      const n = d.leaves.length;
      const travel = (def.w + 0.14) * (n === 2 ? 0.5 : 1) * d.open;
      d.leaves.forEach((leaf, i) => {
        const dir = n === 2 ? (i === 0 ? -1 : 1) : (def.axis === 'x' ? -1 : 1);
        const off = n === 2 ? (i === 0 ? -1 : 1) * (def.w / 4 + 0.01) : 0;
        if (def.kind === 'outer') {
          leaf.position.set(0, d.open * (def.h + 0.05), 0);
        } else if (def.axis === 'x') leaf.position.set(0, 0, off + dir * travel);
        else leaf.position.set(off + dir * travel, 0, 0);
      });
      d.group.visible = this._roomVisible(def.a) || this._roomVisible(def.b);
    }
  }

  /** In a doorway: which of the two rooms is the player on the near side of? (Not whichever they were last in.) */
  _doorSideRoom(doorId) {
    const d = this.layout.doors.find((q) => q.id === doorId);
    if (!d) return null;
    const A = this.layout.roomById.get(d.a), B = this.layout.roomById.get(d.b);
    if (!A || !B) return A ? d.a : (B ? d.b : null);
    const p = d.axis === 'x' ? this.sw.x : this.sw.z;
    const ca = d.axis === 'x' ? (A.x0 + A.x1) / 2 : (A.z0 + A.z1) / 2;
    const cb = d.axis === 'x' ? (B.x0 + B.x1) / 2 : (B.z0 + B.z1) / 2;
    if (Math.abs(p - d.at) < 0.02) return this._lastRoom === d.b ? d.b : d.a;
    return Math.sign(ca - d.at) === Math.sign(p - d.at) ? d.a : (Math.sign(cb - d.at) === Math.sign(p - d.at) ? d.b : null);
  }

  _roomVisible(id) { return this._visibleSet ? this._visibleSet.has(id) : true; }

  _roomsAndLights(dt, first) {
    const low = this.tier === 'low';
    const cam = this.aboard ? this.eyeLocal : this.flight.toLocal(this.engine.cameraWorldPos, {});
    // which room is the camera in?
    let cur = null;
    if (this.aboard) cur = this.seat ? this.seat.room : (this.sw.zoneRoom || null);
    if (cur === 'stair_up') cur = this.sw.y > 4.6 ? 'bridge' : 'corridor_main';
    if (cur && cur.startsWith('d_')) cur = this._doorSideRoom(cur) || this._lastRoom || 'corridor_main';
    if (cur && !this.interior.rooms.has(cur)) cur = this._lastRoom || null;
    if (cur) this._lastRoom = cur;
    this.currentRoom = cur;

    // --- which rooms can be seen? Follow real sight lines: from the room you are in, through every opening
    //     (an open door, a doorway, a stairwell, a hatch) that is in front of you or close beside you, into the
    //     next room, and so on. A closed door is opaque, so what is behind it is not drawn. Nothing is ever
    //     dropped for being "two doors away" if you can see it, and a room you just walked out of stays drawn
    //     for as long as its door is anything but shut. ------------------------------------------------------
    let set;
    if (this.aboard || first) {
      set = this._reach([cur || 'cargo'], cam, this._lookLocal(), low ? 8 : 14);
      this.interior.root.visible = true;
    } else {
      // Outside: the interior shows only through openings and glass.
      set = new Set();
      const dist = Math.hypot(cam.x, cam.y, cam.z);
      if (dist < 90) {
        const starts = [];
        if (dist < 60 && (this.state.ramps.cargo.lowered || this.rampCtl.cargo.progress > 0.02)) starts.push('cargo');
        if (dist < 40 && (this.state.airlock.outerOpen || this.rampCtl.airlock.progress > 0.05)) starts.push('airlock');
        if (dist < 55) starts.push('bridge', 'nest', 'ventral');              // through the glass
        if (starts.length) set = this._reach(starts, cam, this._lookLocal(), low ? 5 : 9, true);
      }
      this.interior.root.visible = set.size > 0;
    }
    this._visibleSet = set;
    if (this.crew) this.crew.applyVisibility(set, this.interior.root.visible);
    for (const r of this.interior.roomList) r.group.visible = set.has(r.id);
    for (const e of this.interior.sharedGroups) e.g.visible = e.rooms.some((id) => set.has(id));
    this.lastFrameStats.visibleRooms = set.size;

    // The hull, legs, wings and engines are only worth drawing when something you can see looks out at them
    // (about 60 draw calls, twice over when the sun's shadow pass counts).
    if (this.aboard) {
      let looksOut = !cur;
      for (const id of set) {
        if (id === 'bridge' || id === 'nest' || id === 'ventral' || id === 'cargo') looksOut = true;
        else if (id === 'airlock' && (this.state.airlock.outerOpen || this.rampCtl.airlock.progress > 0.02)) looksOut = true;
        else if (!low && WINDOW_ROOMS.has(id)) looksOut = true;
      }
      this.exterior.root.visible = looksOut;
    } else this.exterior.root.visible = true;

    // light pool: nearest fixtures among visible rooms
    const fixtures = this.interior.lights;
    const cand = [];
    for (let i = 0; i < fixtures.length; i++) {
      const L = fixtures[i];
      if (!set.has(L.roomId)) continue;
      const d = Math.hypot(L.x - cam.x, (L.y - cam.y) * 0.6, L.z - cam.z);
      cand.push([d, i]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    const K = this.lightPool.length;
    const want = new Set(cand.slice(0, K).map((c) => c[1]));
    // keep lights on the fixtures they already have where possible
    const free = [];
    for (const p of this.lightPool) {
      if (want.has(p.fixture)) { p.target = p.fixture; want.delete(p.fixture); }
      else free.push(p);
    }
    for (const idx of want) { const p = free.shift(); if (p) p.target = idx; }
    for (const p of free) p.target = -1;
    for (const p of this.lightPool) {
      const L = p.light;
      if (p.target !== p.fixture) {
        // fade out, then swap
        p.k = Math.max(0, p.k - dt * 5);
        if (p.k <= 0.001 || first) {
          p.fixture = p.target;
          if (p.fixture >= 0) {
            const fx = fixtures[p.fixture];
            L.position.set(fx.x, fx.y - 0.25, fx.z);
            L.color.setHex(fx.color); L.distance = fx.range;
            L.userData.base = fx.intensity;
          }
          if (first) p.k = 1;
        }
      } else if (p.fixture >= 0) p.k = Math.min(1, p.k + dt * 5);
      L.intensity = p.fixture >= 0 ? (L.userData.base || 0) * p.k * 1.0 : 0;
    }
    // the shadow-casting spot follows you from room to room
    if (this.spot) {
      const r = this.layout.roomById.get(cur);
      const sp = this.spot;
      if (r && this.aboard) {
        if (this.spotRoom !== cur) { this.spotK = Math.max(0, this.spotK - dt * 6); if (this.spotK <= 0.02 || first) { this.spotRoom = cur; const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, hd = Math.hypot(r.x1 - r.x0, r.z1 - r.z0) / 2, h = r.h - 0.45; sp.position.set(cx, r.y + r.h - 0.4, cz); sp.target.position.set(cx, r.y, cz); sp.angle = Math.max(0.5, Math.min(1.42, Math.atan(hd / h) + 0.12)); sp.distance = Math.hypot(hd, h) * 1.5; sp.target.updateMatrixWorld(); } }
        else this.spotK = Math.min(1, this.spotK + dt * 4);
      } else this.spotK = Math.max(0, this.spotK - dt * 6);
      sp.intensity = 9 * this.spotK * (cur === 'cargo' || cur === 'engineering' ? 1.6 : 1);
    }
    // interior ambient: brighter on the bridge (daylight through glass)
    // (a phone has four pooled lights, not six and a shadow-casting spot, so its ambient is a little higher)
    const amb = (cur === 'bridge' ? 1.35 : 1.0) * (low ? 1.2 : 1.0);
    this.hemi.intensity += (amb - this.hemi.intensity) * Math.min(1, dt * 3);
  }

  /** Which way the camera looks, in ship-local axes. */
  _lookLocal() {
    const out = this._lookV || (this._lookV = new THREE.Vector3());
    const q = this._lookQ || (this._lookQ = new THREE.Quaternion());
    q.copy(this.flight.quaternion).invert();
    return out.set(0, 0, -1).applyQuaternion(this.engine.camera.quaternion).applyQuaternion(q);
  }

  /** The rooms you can see from `starts` (see shipVisibility.js). */
  _reach(starts, cam, fwd, maxRooms, outside = false) {
    if (!this._portals) {
      this._portals = buildPortals(this.layout, new Set(this.interior.rooms.keys()));
      this._doorState = new Map(this.interior.doors.map((d) => [d.def.id, d]));
    }
    const cf = this.engine.camera;
    return reachRooms({
      portals: this._portals, starts: starts.filter((id) => this.interior.rooms.has(id)), cam, fwd,
      isOpen: (id) => { const dl = this._doorState.get(id); return !dl || dl.open > 0.001 || !!dl.was; },
      fovDeg: cf.fov, aspect: cf.aspect, maxRooms, outside,
    });
  }

  // ---- telemetry for screens and panels ---------------------------------------------------
  _telemetry() {
    const f = this.flight, tel = this.tel;
    const g = f.geodetic;
    tel.lat = g.lat; tel.lon = g.lon; tel.alt = g.alt;
    tel.agl = f.agl; tel.vs = f.verticalSpeed; tel.groundSpeed = f.groundSpeed; tel.speed = f.speed;
    tel.heading = (f.heading / DEG + 360) % 360; tel.pitch = f.pitch; tel.roll = f.roll;
    tel.power = f.power; tel.hull = f.hull; tel.shield = f.shield; tel.shieldMax = f.shieldMax;
    tel.gear = f.gearPos; tel.landed = f.landed;
    tel.thrustUp = f.thrustUp; tel.maxLift = f.maxLiftN; tel.massKg = f.massKg; tel.weightN = f.weightN();
    tel.canLift = f.canLiftOff(); tel.liftMargin = (f.maxLiftN - f.weightN()) / 1000;
    tel.log = this.stations.log.slice(-9).map((l) => ({ t: fmtTime(l.t), msg: l.msg, warn: l.warn }));
    tel.beacon = this.stations.beacon;
    tel.rampState = this.rampState('cargo');
    tel.airlockState = this.air.phase !== 'idle' ? this.air.phase.replace('_', ' ') : (this.state.airlock.outerOpen ? 'outer open' : 'inner open');
    tel.mapRangeM = SCAN_RANGES[this.stations.scanRangeIdx];
    tel.mapRangeKm = SCAN_RANGES[this.stations.scanRangeIdx] / 1000;
    tel.scanRangeM = SCAN_RANGES[this.stations.scanRangeIdx];
    if (this._telAt === undefined || this.time - this._telAt > 0.5) {
      this._telAt = this.time;
      const ci = cellIndex(this.body, g.lat, g.lon);
      tel.cell = cellLabel(ci.h, ci.r);
      // nearest landmark
      let best = null;
      for (const lm of this.body.landmarks) {
        const p = geodeticToCartesian(this.body, lm.lat, lm.lon, 0);
        const d = Math.hypot(p.x - f.pos.x, p.y - f.pos.y, p.z - f.pos.z);
        if (!best || d < best.d) best = { d, name: lm.name };
      }
      tel.nearest = best ? `${best.name} ${(best.d / 1000).toFixed(0)} km` : '';
      // contacts near the ship
      const fr = f._frame;
      const blips = [];
      for (const r of this.registry.all()) {
        if (!r.position || r.type === 'LMK' || r.type === 'TER' || r.id === SHIP_ID) continue;
        if (r.type === 'STR' && r.shipLocal) continue;
        const dx = r.position.x - f.pos.x, dy = r.position.y - f.pos.y, dz = r.position.z - f.pos.z;
        const e = dx * fr.east.x + dy * fr.east.y + dz * fr.east.z, n = dx * fr.north.x + dy * fr.north.y + dz * fr.north.z;
        if (Math.hypot(e, n) > 9000) continue;
        blips.push({ e, n, color: r.type === 'PRP' ? '#ffb45a' : '#6dff9c', id: r.id });
      }
      tel.blips = blips;
    }
  }

  _scannerFrame() {
    const sc = this.scanner;
    if (!sc) return;
    const range = SCAN_RANGES[this.stations.scanRangeIdx];
    const f = this.flight;
    const watching = this.seat && this.seat.id === 'nav';
    const near = this.aboard && (this.currentRoom === 'bridge');
    if (!(watching || near)) { sc._pending = false; return; }
    const moved = !sc.builtAt ? Infinity : Math.hypot(f.pos.x - sc.builtAt.x, f.pos.y - sc.builtAt.y, f.pos.z - sc.builtAt.z);
    if (!sc._pending && (moved > range * 0.18 || Math.abs(sc.rangeM - range) > 1 || !sc.builtAt)) {
      sc.request(f.pos, f._frame, range);
    }
    sc.tick(this.tier === 'low' ? 4 : 8);
  }

  // =========================================================================
  // LATE UPDATE: effects that need the final camera
  // =========================================================================
  late(dt) {
    if (!this.ready) return;
    const cam = this.engine.cameraWorldPos;
    const f = this.flight;
    const events = this.guns.drain();
    if (this.crew) this.crew.onGunEvents(events);
    this.fx.handle(events);
    if (this.audio) this.audio.events(events, this.aboard);
    this.fx.setViewScale(this.engine.renderer.domElement.height, this.engine.camera.fov);
    const enemy = this.drones ? this.drones.shots.map((b) => ({ x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, gun: 'enemy', power: 0.9 })) : [];
    this.fx.update(dt, cam, enemy.length ? this.guns.bolts.concat(enemy) : this.guns.bolts);
    // dust from the thrusters when low
    this._dust(dt);
    // target flash
    for (const e of events) {
      if (e.type === 'target_hit') { const t = this.targets.find((q) => q.id === e.id); if (t) t.flash = 1; }
    }
    for (const t of this.targets) {
      t.mesh.userData.discMat.emissive.setRGB(t.flash * 1.2, t.flash * 0.9, t.flash * 0.4);
    }
    // registry position follows the ship
    if (!this.shipRec) this.shipRec = this.registry.get(SHIP_ID);
    this.shipRec.position.x = f.pos.x; this.shipRec.position.y = f.pos.y; this.shipRec.position.z = f.pos.z;
    for (const s of SEATS) {
      const rec = this.registry.get(s.stationId);
      const w = f.toWorld(rec.shipLocal, {});
      rec.position.x = w.x; rec.position.y = w.y; rec.position.z = w.z;
    }
  }

  _dust(dt) {
    const f = this.flight;
    if (f.thrustUp < f.weightN() * 0.25) return;
    if (f.agl > 28 || f.agl < 0) return;
    const rnd = Math.random;
    const intensity = Math.min(1, f.thrustUp / f.weightN()) * Math.max(0, 1 - f.agl / 28);
    const n = Math.floor(intensity * (this.tier === 'low' ? 2 : 4) + rnd());
    for (let i = 0; i < n; i++) {
      const pod = this.exterior.liftPods[Math.floor(rnd() * 4)];
      const wp = f.toWorld({ x: pod.x, y: pod.y, z: pod.z }, {});
      const l = Math.hypot(wp.x, wp.y, wp.z);
      const gr = this.ground(wp.x / l, wp.y / l, wp.z / l);
      if (gr === null || gr === undefined) continue;
      const up = { x: wp.x / l, y: wp.y / l, z: wp.z / l };
      const a = rnd() * Math.PI * 2;
      const fr = f._frame;
      const dx = fr.east.x * Math.cos(a) + fr.north.x * Math.sin(a), dy = fr.east.y * Math.cos(a) + fr.north.y * Math.sin(a), dz = fr.east.z * Math.cos(a) + fr.north.z * Math.sin(a);
      const sp = 6 + rnd() * 10;
      this.fx.dust.emit({ x: up.x * gr, y: up.y * gr, z: up.z * gr,
        vx: dx * sp, vy: dy * sp, vz: dz * sp, life: 2.2 + rnd() * 1.5, size0: 1.5, size1: 6 + rnd() * 5,
        c0: [0.78, 0.56, 0.4], c1: [0.66, 0.46, 0.33], alpha: 0.42 * intensity + 0.1, drag: 1.1, grav: -1.5, up });
    }
  }

  // =========================================================================
  // INTERACTION
  // =========================================================================
  /** What the contextual button offers right now. */
  contextAction() {
    if (!this.ready) return null;
    const seat = this.seat;
    if (seat) return { label: 'Stand', run: () => this.stations.stand() };
    if (this.aboard) {
      const loc = { x: this.sw.x, y: this.sw.y, z: this.sw.z };
      const s = this.stations.seatNear(loc);
      if (s && this.sw.grounded) return { label: `Sit  ·  ${s.name}`, run: () => this._sit(loc) };
      const ob = this._observationNear(loc);
      if (ob) return { label: this.zoomOn ? 'Lower binoculars' : 'Binoculars', run: () => this.toggleBinoculars(ob) };
      for (const p of PANELS) {
        if (Math.abs(loc.y - p.y) < 1.5 && Math.hypot(loc.x - p.x, loc.z - p.z) < p.radius) {
          if (p.action === 'ramp_cargo') return { label: this.rampCtl.cargo.target > 0.5 ? 'Raise ramp' : 'Lower ramp', run: () => this.toggleRamp('cargo') };
          if (p.action === 'airlock') {
            const a = this.air.phase !== 'idle';
            return { label: a ? 'Cycling…' : (this.state.airlock.outerOpen ? 'Seal airlock' : 'Cycle airlock'), run: () => this.cycleAirlock() };
          }
        }
      }
      return null;
    }
    // outside: a wrist remote for the ramp
    const loc = this.flight.toLocal(this.walker.worldPos, {});
    if (Math.hypot(loc.x, loc.z - 22) < 16 && loc.y < 4) {
      return { label: this.rampCtl.cargo.target > 0.5 ? 'Raise ramp' : 'Lower ramp', run: () => this.toggleRamp('cargo') };
    }
    return null;
  }

  /** The observation spot the player stands at, if any. */
  _observationNear(loc) {
    for (const o of OBSERVATION) if (Math.abs(loc.y - o.y) < 1.5 && Math.hypot(loc.x - o.x, loc.z - o.z) < o.radius) return o;
    return null;
  }

  toggleBinoculars(ob) {
    this.zoomOn = !this.zoomOn; this.zoomFov = ob.fov;
    this.note(this.zoomOn ? `${ob.name}: 3x. Look about; press again to lower them.` : 'Binoculars lowered.');
  }

  /** Per frame: ease the field of view toward the binoculars or back, and drop them if you step away, sit down or leave. */
  _zoomFrame(dt) {
    const cam = this.engine.camera;
    if (this.baseFov == null) this.baseFov = cam.fov;
    if (this.zoomOn && (!this.aboard || this.seat || !this._observationNear({ x: this.sw.x, y: this.sw.y, z: this.sw.z }))) this.zoomOn = false;
    const want = this.zoomOn ? this.zoomFov : this.baseFov;
    if (Math.abs(cam.fov - want) > 0.05) { cam.fov += (want - cam.fov) * Math.min(1, dt * 9); cam.updateProjectionMatrix(); }
    else if (cam.fov !== want) { cam.fov = want; cam.updateProjectionMatrix(); }
  }

  /** Walk the player to a seat and sit them in it (the talk dialog's "take the seat"). */
  takeSeat(seatId) {
    const seat = SEATS.find((q) => q.id === seatId);
    if (!seat || !this.aboard || this.seat) return false;
    this.sw.place(seat.x, seat.y, seat.z, seat.yaw * DEG);
    this._standClear(seat);
    return this._sit({ x: seat.x, y: seat.y, z: seat.z });
  }

  _sit(loc) {
    const s = this.stations.sit(loc);
    if (!s) return false;
    this.sw.x = s.x; this.sw.y = s.y; this.sw.z = s.z;
    return true;
  }

  /** E on desktop */
  interact() {
    const a = this.contextAction();
    if (a) { a.run(); return true; }
    return false;
  }

  // =========================================================================
  // DEBUG / VERIFICATION
  // =========================================================================
  /** Put the player aboard at a named place. For screenshots and the validator. */
  teleport(name, yaw = 0) {
    const L = this.layout;
    const seat = SEATS.find((s) => s.id === name);
    this.aboard = true;
    if (this.seat) this.stations.stand();
    if (seat) {
      this.sw.place(seat.x, seat.y, seat.z + 0.9, yaw);
      this._standClear(seat);
      this.stations.sit({ x: seat.x, y: seat.y, z: seat.z });
      this.look.yaw = 0; this.look.pitch = 0;
      return true;
    }
    const r = L.roomById.get(name);
    if (r) {
      const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
      this.sw.place(cx, r.y, cz, yaw);
      let tries = 0;
      while (!this.sw.canStand(this.sw.x, this.sw.y, this.sw.z) && tries++ < 40) this.sw.x += 0.25;
      return true;
    }
    return false;
  }

  /** Verification helper: stand somewhere aboard, facing a way, and run a few frames. */
  debugAt(room, x, z, yawDeg = 0, pitchDeg = 0, frames = 30) {
    this.aboard = true;
    if (this.seat) this.stations.stand();
    const r = this.layout.roomById.get(room);
    this.sw.place(x ?? (r.x0 + r.x1) / 2, r.y, z ?? (r.z0 + r.z1) / 2, yawDeg * DEG);
    this.sw.pitch = pitchDeg * DEG;
    for (let i = 0; i < frames; i++) this.engine.step(1 / 60);
    return [this.currentRoom, this.sw.zoneId];
  }

  /** Verification helper: stand OUTSIDE at a ship-local point and look at another. */
  debugViewFrom(lx, ly, lz, tx, ty, tz, frames = 40) {
    const f = this.flight, w = this.walker;
    this.aboard = false;
    const p = f.toWorld({ x: lx, y: ly, z: lz }, {});
    w.worldPos.x = p.x; w.worldPos.y = p.y; w.worldPos.z = p.z; w.velocity = { x: 0, y: 0, z: 0 };
    const T = f.toWorld({ x: tx, y: ty, z: tz }, {});
    const fr = w.updateFrame();
    const dx = T.x - p.x, dy = T.y - p.y, dz = T.z - p.z;
    const e = dx * fr.east.x + dy * fr.east.y + dz * fr.east.z, n = dx * fr.north.x + dy * fr.north.y + dz * fr.north.z, u = dx * fr.up.x + dy * fr.up.y + dz * fr.up.z;
    w.yaw = Math.atan2(e, n); w.pitch = Math.atan2(u, Math.hypot(e, n));
    for (let i = 0; i < frames; i++) this.engine.step(1 / 60);
    return 'ok';
  }

  hudText() {
    const f = this.flight;
    const g = f.geodetic;
    if (!this.aboard) return '';
    const seat = this.seat;
    const where = seat ? seat.name : `${deckName(this.sw.y)} · ${this._roomName()}`;
    const neutral = !this.drones || this.drones.neutral;
    const air = f.landed ? '' : neutral
      ? `<br><span class="dim">Mars neutral airspace · hostile beyond ${NEUTRAL_AIRSPACE_M} m</span>`
      : `<br><span class="load">HOSTILE SPACE · outside Mars neutral airspace</span>`;
    return `<b>${SHIP_NAME}</b> · ${where}<br>` +
      `<span class="dim">${f.landed ? 'landed' : `${f.agl.toFixed(0)} m up · ${f.groundSpeed.toFixed(0)} m/s`} · deck plating 1.00 g</span>${air}`;
  }

  _roomName() {
    const r = this.layout.roomById.get(this.currentRoom);
    if (r) return r.name;
    return { stair_up: 'Bridge stair' }[this.sw.zoneRoom] || '';
  }
}

// ---------------------------------------------------------------------------
// helpers and constants
// ---------------------------------------------------------------------------
/**
 * Register the ship and every seat with measured sizes. Shared by the game and
 * the validator, so the check tests the code that ships.
 */
export function registerShipAssets(reg, THREE_, hardware, seatGroups, shipPos) {
  reg.register({
    id: SHIP_ID, bodyId: 'mars', type: 'VEH', name: SHIP_NAME, position: shipPos,
    authored: SHIP_ENVELOPE, massKg: SHIP_PHYS.massKg, collision: 'mesh', materialId: 'MAT-ALUMINIUM',
    object3d: hardware,
    note: 'Landed. Walk up the boarding ramp at the stern. Seats: bridge, engineering, two turrets.',
  });
  reg.measure(SHIP_ID, THREE_);
  for (const s of SEATS) {
    const rec = reg.register({
      id: s.stationId, bodyId: 'mars', type: 'STR', name: `${s.name} (${s.role})`,
      position: { x: shipPos.x, y: shipPos.y, z: shipPos.z },
      authored: SEAT_ENVELOPE[s.id], massKg: SEAT_MASS[s.id], collision: 'box', materialId: 'MAT-ALUMINIUM',
      object3d: seatGroups.get(s.id), note: s.hint,
    });
    reg.measure(s.stationId, THREE_);
    rec.shipLocal = { x: s.x, y: s.y, z: s.z };
  }
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fmtTime = (t) => { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };

function GunSystemDir(a) {
  const cp = Math.cos(a.pitch);
  return { x: Math.sin(a.yaw) * cp, y: Math.sin(a.pitch), z: -Math.cos(a.yaw) * cp };
}

function cloneMaterials(m) {
  const out = {};
  for (const k of Object.keys(m)) {
    if (k === '_textures') { out[k] = m[k]; continue; }
    out[k] = m[k] && m[k].clone ? m[k].clone() : m[k];
  }
  return out;
}

/**
 * Design envelopes: the size each registered thing is SUPPOSED to be. The
 * validator compares these to the built geometry and fails on drift.
 */
export const SHIP_ENVELOPE = { width: 24.52, height: 13.45, depth: 48.65 };
export const SEAT_ENVELOPE = {
  captain: { width: 0.93, height: 1.72, depth: 0.88 },
  pilot: { width: 0.75, height: 1.54, depth: 0.78 },
  nav: { width: 0.60, height: 1.13, depth: 0.50 },
  comms: { width: 0.60, height: 1.13, depth: 0.50 },
  engineer: { width: 0.60, height: 1.13, depth: 0.50 },
  gun_dorsal: { width: 0.64, height: 1.44, depth: 0.83 },
  gun_ventral: { width: 0.64, height: 1.44, depth: 0.83 },
};
export const SEAT_MASS = { captain: 46, pilot: 34, nav: 18, comms: 18, engineer: 18, gun_dorsal: 30, gun_ventral: 30 };
