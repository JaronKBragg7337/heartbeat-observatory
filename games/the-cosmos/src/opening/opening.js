// ============================================================================
// opening/opening.js - the opening (BIBLE-v3 10.1, DECISIONS 10/3 10:46 AM), run on the client against the authority's rules
// (state.js; solo runs the same file locally). Seven stages, one private scene (the shared world never sees it):
//   0 LINER    the Ares inbound to Mars with the convoy beside it; the entry; a normal landing on Apron A.
//   1 PORT     walk the port, the arrivals hall, the world board, the Kestrel's gate.
//   2 DESCENT  the Kestrel to the chosen world, and the season's crash.
//   3..6       the wreck, the dig, the driver's pitch, the ride (the old opening's good parts: the wreck art, the survey rover).
// Every stage is a pure function of the stage clock (script.js), so a refresh resumes where it was. Skip intro gives the same start.
// ============================================================================
import * as THREE from 'three';
import { OpeningModel, freshOpening, STAGE } from './state.js';
import { LINER, KESTREL, LINER_PHASE, KESTREL_PHASE, KESTREL_SECONDS, RIDE_SECONDS, CONTACT_SECONDS, linerPhase, kestrelPhase, linerDescentPose, linerDown,
  linerRampProgress, linerExit, gangwayEndX, BOARD_SPOT, GUIDE_SPOT, kestrelGate, kestrelLift, restHeight, portPath, LOCKER, CRATE, kestrelApproach, kestrelShake } from './script.js';
import * as D from './dialogue.js';
import { supplyCrate, passengerCabin, driftingDust } from './art.js';
import { ShipStage } from './stageShip.js';
import { SpaceScene } from './spaceScene.js';
import { linerPath, linerHeat, kestrelPath, ceresRelative, farFlightWindow, CERES_RADIUS } from './flightPath.js';
import { CrashFx } from './crashFx.js';
import { openBoard } from './boardUI.js';
import { boardData } from './worlds.js';
import { OpeningLook, skyDome, SUN } from './look.js';
import { LocalPatch, installTierDiscard } from '../world/planetMesh.js';
import { getBody } from '../world/bodies.js';
import { EditedTerrain, installCoverDiscard } from '../world/excavation.js';
import { Kit } from '../ship/shipKit.js';
import { detachBodyEdits } from '../world/field.js';
import { WRECK_Y } from './freighterHull.js';
import { bindActivation } from '../ui/activation.js';
import { buildAimMarker } from '../player/aimMarker.js';
import { density } from '../world/field.js';
import { surveyOpeningVehicle, ridePose, rideSupportHeight } from './rideVehicle.js';
import { writeOpeningCheckpoint } from './checkpoint.js';
import { factionLook } from '../factions/registry.js';
import { shipDef } from '../ships/registry.js';
import { ShipWalker, shipIndexFor } from '../ship/shipWalker.js';
import { GoalHint } from '../ui/goalHint.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const Y = new THREE.Vector3(0, 1, 0);
const LINER_MARS_DIR = new THREE.Vector3(1, -.12, -.15).normalize();      // where Mars sits in the lounge's windows during the cruise (starboard, a little below the horizon)

export class Opening {
  constructor({ engine, world, ship, people, port, tier, onFinish, voice }) {
    Object.assign(this, { engine, world, ship, people, port, tier, onFinish, voice });
    const buildStart = performance.now();
    this.active = !!world.state.opening && !world.state.opening.complete;
    this.state = structuredClone(world.state.opening || freshOpening());
    this.accum = 0; this.pending = Promise.resolve(); this.busy = false; this.film = false;
    this.elapsed = this.state.elapsed || 0; this.clock = this.state.clock || 0; this.rideSeconds = this.state.rideSeconds || 0; this.contactSeconds = this.state.contactSeconds || 0;
    if (!this.active) return;
    this.low = tier === 'low';
    this.cause = this.state.season?.cause || 'storm'; this._syncDest();
    this.model = new OpeningModel(this.state, world.playerId || 'local');
    this.mainScene = engine.scene; this.mainOverlays = engine.overlayScenes; this.beforeTracks = new Set(engine._tracked);
    engine.scene = this.scene = new THREE.Scene(); engine.overlayScenes = [];
    this.scene.userData.privateOpening = true;
    this.scene.background = new THREE.Color(0x000000);
    this.portQ = port.quaternion.clone(); this.portQinv = this.portQ.clone().invert();
    // TWO RENDER FRAMES. The ship stages (0 to 2) are drawn in PORT-LOCAL metres (x right, y up, z back: up is +Y, so a ship's interior reflections and its
    // hemisphere light find their ceiling where the ship does); the wreck stages (3 to 6) keep the old Mars-axes frame. `useFrame` switches the tracked entries.
    this.frameKind = null;
    this.stageNo = null; this.lines = { until: 0, text: '', who: '' }; this.spokenKeys = new Set(); this.talk = { next: 0 };
    this.mats = { int: ship.matsInt, ext: ship.matsExt };
    // ---- the space and the Ares -------------------------------------------------------------------------------------------
    this.space = new SpaceScene({ engine, mats: ship.matsExt, tier });
    this.spaceEntry = engine.track({ worldPos: { x: 0, y: 0, z: 0 }, object3d: this.space.root, quaternion: new THREE.Quaternion() });
    this.scene.add(this.space.root);
    this.space.buildConvoy(this.low ? 5 : 6);
    this.liner = new ShipStage({ engine, type: LINER.type, name: LINER.name, registry: LINER.registry, mats: this.mats, signs: ship.signs, posters: ship.posters, tier });
    this.scene.add(this.liner.group);
    this.linerDef = this.liner.def; this.linerQ = new THREE.Quaternion();
    // ---- the port, seen at its true place, and the flat ground of the walk ---------------------------------------------------
    this.portRoot = new THREE.Group(); this.portRoot.name = 'opening-port-root'; this.scene.add(this.portRoot);
    this.portEntry = engine.track({ worldPos: { x: 0, y: 0, z: 0 }, object3d: this.portRoot, quaternion: new THREE.Quaternion() });
    this.portSky = skyDome(this.low, SUN.clone().normalize(), 1);
    this.portClone = port.root.clone(true);
    const lights = []; this.portClone.traverse((o) => { if (o.isLight) lights.push(o); }); for (const l of lights) l.removeFromParent();   // the port's own lamps are the game's; the opening lights its own
    this.scene.add(this.portClone);
    this.portCloneEntryL = engine.track({ worldPos: { x: 0, y: 0, z: 0 }, object3d: this.portClone, quaternion: new THREE.Quaternion() });
    this.portCloneEntryW = engine.track({ worldPos: port.site.center, object3d: null, quaternion: port.quaternion });
    this._buildPortGround();
    this._buildPath();
    this._buildJourney();
    this.hemi = new THREE.HemisphereLight(0xb5bacc, 0x492e23, .5); this.hemi.position.set(0, 1, 0); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffcf9a, 1.7); this.sun.position.copy(SUN); this.scene.add(this.sun, this.sun.target);
    this.sun.castShadow = false;
    this.portLamps = [[-88, 3.4, 40], [-12, 3.2, 40], [18, 4, 8], [-168, 4, 40]].map(([x, y, z]) => { const l = new THREE.PointLight(0xffb36a, this.low ? 18 : 30, 26, 1.6); l.position.set(x, y, z); this.portRoot.add(l); return l; });
    this._buildPortPeople();
    // ---- the talkers aboard the Ares ----------------------------------------------------------------------------------------
    this._buildLinerPeople();
    // ---- the wreck's art waits until it is wanted (it is heavy); the Kestrel is built when the port is reached -------------------
    this.wreckBuilt = false; this.kestrel = null; this.crashFx = null;
    this.buildUI();
    this.goalHint=new GoalHint(engine);
    this.keyboard = (e) => { if (!this.active) return; if (e.code === 'KeyE' && !e.repeat) { e.preventDefault(); this.interact(); } if (e.code === 'KeyQ' && !e.repeat) this.walkInstead(); };
    window.addEventListener('keydown', this.keyboard);
    this.audioStart = () => this.startAudio(); window.addEventListener('pointerdown', this.audioStart, { once: true }); window.addEventListener('keydown', this.audioStart, { once: true });
    this.hideMainUI = true; document.body.dataset.opening = 'active';
    this.pageHide = () => { this.checkpoint(true); this.savePose(); }; window.addEventListener('pagehide', this.pageHide);
    this.visibility = () => { if (document.hidden) this.pageHide(); }; document.addEventListener('visibilitychange', this.visibility);
    this.ready = Promise.all([...this.linerPeople.map((p) => p.person.ready), ...this.portPeople.map((p) => p.person.ready)]);
    this.actorsReady = false; this.readyAt = performance.now(); this.ready.then(() => { this.actorsReady = true; });
    this.enterStage(this.state.stage, true);
    this.buildMs = Math.round(performance.now() - buildStart);
  }

  _syncDest() {
    const d = this.state.dest; this.dest = d; this.worldId = d?.world || 'mars';
    this.wd = D.worldDialogue(this.worldId); this.driverInfo = D.driverFor(this.worldId, this.state.driver); this.counterInfo = this.state.driver ? D.counterFor(this.worldId, this.state.driver) : null;
  }

  // ---- building ------------------------------------------------------------------------------------------------------------
  _buildPortGround() {
    const m = this.model.kits.port || this.model.use('port') && this.model.kits.port;
    const k = this.model.kits.port;
    this.portKit = k;
    const far = new LocalPatch(k.body, { sizeM: 6000, res: this.low ? 41 : 65, skirtM: 20 });
    far.rebuild(k.origin.x, k.origin.y, k.origin.z);
    const up = this.port.site.up; far.worldPos.x -= up.x * .045; far.worldPos.y -= up.y * .045; far.worldPos.z -= up.z * .045;
    this.scene.add(far.mesh); this.portGround = far;
    this.portGroundEntry = this.engine.track({ worldPos: k.toLocal(far.worldPos), object3d: far.mesh, quaternion: this.portQinv });     // its vertices are in Mars axes: turned into the port's
    void m;
  }
  /**
   * SEAMLESS FLIGHT (Jaron, 10/3 7:34 PM: one Solar System, no cuts). The whole liner and Kestrel trip is drawn in the PORT'S OWN FRAME: Mars is one
   * planet at its true place under the port (the game's own global shell, a 60 km tier of real ground and the 6 km graded port ground, handed over
   * pixel by pixel), the sky is one dome that thins from the port's dusk to black as the ship climbs, and the stars, the Sun and the neighbours ride with
   * the ship. Nothing is switched: the ships simply fly through it (script: flightPath.js).
   */
  _buildJourney() {
    const k = this.portKit, engine = this.engine, sp = this.space;
    // the sky follows the camera and is drawn first, behind everything (its air thins with height)
    this.portSky.mesh.material.depthTest = false;
    this.skyHolder = new THREE.Group(); this.skyHolder.add(this.portSky.mesh); this.scene.add(this.skyHolder);
    this.skyPos = { x: 0, y: 0, z: 0 }; this.skyEntry = engine.track({ worldPos: this.skyPos, object3d: this.skyHolder, quaternion: new THREE.Quaternion() });
    // the stars of the space scene are not drawn (the sky is one dome); its Sun, its neighbours and its effects ride with the SHIP
    sp.dome.visible = false; sp.sun.visible = false; sp.hemi.visible = false;
    this.skyHolder.add(sp.sunCore, sp.sunGlow, sp.shine, sp.shine.target);       // the Sun and Mars's light belong to the WORLD (they do not turn with the ship)
    const sunDir = SUN.clone().normalize(); for (const s of [sp.sunCore, sp.sunGlow]) s.position.copy(sunDir).multiplyScalar(2.5e8);
    this.shipPos = { x: 0, y: 0, z: 0 }; this.spaceEntry.worldPos = this.shipPos;
    // Mars, once, at its true place: its centre in the port's frame, its own axes turned into it; sunk a little so the real ground tiers lie over it
    const m = sp.takeMars(); this.mars = m;
    this.marsHolder = new THREE.Group(); this.marsHolder.add(m.group, m.atm, m.haze); this.scene.add(this.marsHolder);
    const c = k.toLocal({ x: 0, y: 0, z: 0 }); this.marsPos = { x: c.x, y: c.y - 220, z: c.z };
    this.marsEntry = engine.track({ worldPos: this.marsPos, object3d: this.marsHolder, quaternion: this.portQinv });
    m.atm.material.userData.k0 = m.atm.material.uniforms.uK.value; m.haze.material.userData.k0 = m.haze.material.uniforms.uK.value;
    // a 60 km tier of Mars's real ground between the shell and the graded port ground (a pixel of it under the port ground is not drawn)
    const mars = getBody('mars'), mid = new LocalPatch(mars, { sizeM: 60000, res: this.low ? 49 : 81, skirtM: 90 });
    mid.rebuild(k.origin.x, k.origin.y, k.origin.z);
    const up = this.port.site.up; mid.worldPos.x -= up.x * .09; mid.worldPos.y -= up.y * .09; mid.worldPos.z -= up.z * .09;
    this.scene.add(mid.mesh); this.portMid = mid; this.midEntry = engine.track({ worldPos: k.toLocal(mid.worldPos), object3d: mid.mesh, quaternion: this.portQinv });
    installTierDiscard(mid.mesh.material).update(mid.worldPos, this.portGround);
    // another world's globe (Ceres) is drawn at its own place relative to the Kestrel, from the moment it is wanted
    this.worldGlobe = null;
  }
  /** The far world's globe, built once when the flight to it starts. */
  _ensureWorldGlobe() {
    if (this.worldGlobe || this.worldId === 'mars') return this.worldGlobe;
    const w = this.space.takeWorld(this.worldId); if (!w) return null;
    this.worldHolder = new THREE.Group(); this.worldHolder.add(w.grp); this.scene.add(this.worldHolder);
    this.worldPos = { x: 0, y: 1e12, z: 0 }; this.worldEntry = this.engine.track({ worldPos: this.worldPos, object3d: this.worldHolder, quaternion: new THREE.Quaternion() });
    this.worldHolder.visible = false; this.worldGlobe = w; return w;
  }
  /**
   * Everything the height changes, one place: the sky's air, the fog, the lights, the planet's rim glow. `alt` is metres over the port, `ship` its place.
   * Called every frame of the liner and the Kestrel flights, so the world thins and thickens by itself.
   */
  _atmosphere(alt, ship, eye) {
    const air = 1 - smooth(45e3, 150e3, alt), sp = this.space;
    Object.assign(this.shipPos, ship); Object.assign(this.skyPos, eye);
    this.portSky.uniforms.air.value = air; this.portSky.uniforms.time.value = this.elapsed;
    const fog = this.scene.fog; sp.fogBase = fog && fog.density !== undefined ? .00013 * Math.exp(-Math.max(0, alt) / 2600) * (1 - smooth(30e3, 60e3, alt)) : 0; if (fog) fog.density = sp.fogBase;
    this.sun.intensity = 2.4 - .7 * air; this.hemi.intensity = .14 + .36 * air; this.hemi.color.set(air > .5 ? 0xb5bacc : 0x8aa0d0);
    sp.shine.intensity = (this.worldId === 'mars' ? .5 : .16) * (1 - air); sp.sunCore.material.opacity = sp.sunGlow.material.opacity = 1 - air;
    for (const a of [this.mars.atm, this.mars.haze]) a.material.uniforms.uK.value = a.material.userData.k0 * smooth(40e3, 400e3, alt);
    this.marsHolder.visible = this.portMid.mesh.visible = true; this.skyHolder.visible = true;
  }
  _person(id) { return this.people.spawn(id); }
  _buildLinerPeople() {
    const def = this.linerDef, seats = def.passengerSeats || [], list = [], used = new Set();
    const bankSeat = ([room, bank, seat]) => { const inRoom = seats.filter((s) => s.room === room), banks = [...new Set(inRoom.map((s) => s.bank))]; const b = banks[Math.min(bank, banks.length - 1)]; const s = inRoom.filter((x) => x.bank === b)[Math.min(seat, inRoom.filter((x) => x.bank === b).length - 1)]; return s; };
    this.linerPeople = []; this.talkers = [];
    for (const t of D.LINER_TALKERS) {
      if (this.low && !t.low) continue;
      const person = this._person(t.person); person.dress(factionLook('mars', t.id.length + this.linerPeople.length, t.id === 'sunita' || t.id === 'isaiah' ? 'worker' : 'civilian'));
      let x = t.at[0], z = t.at[1], yaw = t.yaw, room = null;
      if (t.bank) { const s = bankSeat(t.bank); if (s) { x = s.x; z = s.z; yaw = s.yaw; room = s.room; used.add(s); } }
      const rec = this.liner.addPerson(person, { x, y: 0, z, yawDeg: yaw, room: room || this._roomAt(x, z), seat: t.seat });
      const entry = { ...t, person, rec, x, z, said: 0 }; this.linerPeople.push(entry); this.talkers.push(entry);
    }
    let n = 0;
    for (const spec of D.LINER_EXTRAS.slice(0, this.low ? 2 : D.LINER_EXTRAS.length)) {
      const s = bankSeat(spec); if (!s || used.has(s)) continue; used.add(s);
      const person = this._person(D.EXTRA_PEOPLE[n % D.EXTRA_PEOPLE.length]); person.dress(factionLook('mars', 31 + n * 7, 'civilian')); n++;
      const rec = this.liner.addPerson(person, { x: s.x, y: 0, z: s.z, yawDeg: s.yaw, room: s.room, seat: true }); this.linerPeople.push({ person, rec, extra: true });
    }
  }
  _roomAt(x, z) { for (const r of this.linerDef.layout.rooms) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.id; return null; }
  _buildPortPeople() {
    this.portPeople = [];
    const mk = (spec, x, z, face, look) => { const p = this._person(spec.person); if (look) p.dress(look); p.group.position.set(x, 0.02, z); p.group.rotation.y = { south: 0, east: Math.PI / 2, north: Math.PI, west: -Math.PI / 2 }[face] || 0; p.play('Idle', 0); this.portRoot.add(p.group); return p; };
    this.guide = mk(D.GUIDE, GUIDE_SPOT.x, GUIDE_SPOT.z, GUIDE_SPOT.face, factionLook('mars', 3, 'worker'));
    const g = kestrelGate(shipDef(KESTREL.type));
    this.gate = mk(D.GATE, g.x + 1.4, g.z, 'west', factionLook('mars', 5, 'officer'));
    this.portPeople.push({ person: this.guide, at: GUIDE_SPOT }, { person: this.gate, at: { x: g.x + 1.4, z: g.z } });
  }
  _ensureKestrel() {
    if (this.kestrel) return this.kestrel;
    this.kestrel = new ShipStage({ engine: this.engine, type: KESTREL.type, name: KESTREL.name, registry: KESTREL.registry, mats: this.mats, signs: this.ship.signs, posters: this.ship.posters, tier: this.tier });
    this.scene.add(this.kestrel.group); this.kestrelDef = this.kestrel.def;
    // a few seated people for company
    const seats = (this.kestrelDef.passengerSeats || []).filter((s) => s.room === 'cabin_a');
    const wanted = this.low ? [2, 9] : [2, 9, 14, 20, 27, 31];
    wanted.forEach((i, n) => { const s = seats[i % seats.length]; if (!s) return; const p = this._person(D.EXTRA_PEOPLE[(n + 2) % D.EXTRA_PEOPLE.length]); p.dress(factionLook('mars', 51 + n * 5, 'civilian'));
      this.kestrel.addPerson(p, { x: s.x, y: 0, z: s.z, yawDeg: s.yaw, room: s.room, seat: true }); });
    this.kestrel.place({ x: KESTREL.spot.x, y: restHeight(this.kestrelDef), z: KESTREL.spot.z }, new THREE.Quaternion());
    this.kestrel.setRamps(0, 1, true);
    this.kestrel.exterior.root.visible = true;
    return this.kestrel;
  }
  /** The wreck: the cabin, the site, the rover, the crate, the ground and the look. Heavy, so it is built when the Kestrel crashes. */
  _ensureWreck() {
    if (this.wreckBuilt) return; this.wreckBuilt = true;
    const m = this.model.use('wreck'), engine = this.engine, ship = this.ship, f = m.frame;
    this.q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().copy(f.right), new THREE.Vector3().copy(f.up), new THREE.Vector3().copy(f.back)));
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.rootEntry = engine.track({ worldPos: m.origin, object3d: this.root, quaternion: this.q });
    const mats = ship.matsInt;
    this.cabin = passengerCabin(mats, this.low, ship.matsExt); this.root.add(this.cabin.root);
    this.cabin.root.position.set(0, WRECK_Y, 0); this.cabin.root.rotation.set(.015, 0, .105);
    this.cabinSw = new ShipWalker(shipIndexFor({ type: 'opening-passenger', layout: this.cabin.layout }));
    this.cabinSw.place(0, .02, 4, Math.PI); this.cabinSw.pitch = 0;
    this.dust = driftingDust(this.low); this.cabin.root.add(this.dust);
    this.rover = surveyOpeningVehicle(mats, this.tier); this.root.add(this.rover.root);
    this.rover.root.position.set(-7, 0, 23); this.rover.root.rotation.y = Math.PI * .64; this.rover.root.visible = false;
    this.crate = supplyCrate(mats); this.crate.position.set(CRATE.x, -.09, CRATE.z); this.root.add(this.crate);
    this.digMark = buildAimMarker(0xffb057); this.digMark.group.visible = false; this.root.add(this.digMark.group);      // FIX-R3: the same amber dig ring as the ordinary game
    this._buildLocker();
    // the driver (the rover's), and the recruiter of the other side who waits at the port
    this._dressDriver();
    if (this.counterInfo) { this.counterPerson = this._person(this.counterInfo.person); this.counterPerson.dress(this._look(this.counterInfo.faction, 9)); this.counterPerson.group.position.set(-2594, m.height(-2594, -352), -352); this.counterPerson.group.rotation.y = Math.PI * -.5 - .5; this.root.add(this.counterPerson.group); this.counterPerson.play('Idle', 0); }
    this.cabinEmitters = []; this.cabin.root.traverse((o) => { if (o.isMesh && o.name.endsWith(':glow')) { o.material = o.material.clone(); this.cabinEmitters.push(o.material); } });
    this.wreckHemi = this.hemi; this.wreckSun = this.sun;
    this.lamp = new THREE.PointLight(0xff5133, this.low ? 15 : 32, 22, 1.5); this.lamp.position.set(0, 2.7, 3); this.cabin.root.add(this.lamp);
    this.cabinFill = new THREE.PointLight(0xc9d8ec, this.low ? 14 : 30, 25, 1.5); this.cabinFill.position.set(0, 2.5, -5); this.cabin.root.add(this.cabinFill);
    this.wreckTerrain = new EditedTerrain(engine, m.body, m.edits, { rangeM: 35, budgetMs: this.low ? 2 : 4 });
    m.walker.collisionActive = (x, y, z) => this.wreckTerrain.touchedAt(x, y, z);
    this.ground = new LocalPatch(m.body, { sizeM: 140, res: this.low ? 81 : 121, skirtM: 6 });
    this.ground.rebuild(m.origin.x, m.origin.y, m.origin.z);
    this.scene.add(this.ground.mesh); this.groundEntry = engine.track({ worldPos: this.ground.worldPos, object3d: this.ground.mesh });
    this.cover = { value: new THREE.Vector3() }; installCoverDiscard(this.ground.mesh.material, this.wreckTerrain.cover, this.cover, THREE);
    this.far = new LocalPatch(m.body, { sizeM: 10000, res: this.low ? 49 : 81, skirtM: 15 });
    this.far.rebuild(m.origin.x, m.origin.y, m.origin.z);
    installTierDiscard(this.far.mesh.material).update(this.far.worldPos, this.ground);
    this.scene.add(this.far.mesh); this.farEntry = engine.track({ worldPos: this.far.worldPos, object3d: this.far.mesh });
    // Ceres: grey crust and salt, not rust (the patches' vertex colours are Mars's: take the colour out of them in the shader)
    if (this.worldId === 'ceres') for (const patch of [this.ground, this.far]) {
      const mat = patch.mesh.material, prev = mat.onBeforeCompile, key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
      mat.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r); sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(.299, .587, .114))) * vec3(.93, .95, 1.), diffuseColor.rgb, .1) * 1.15;'); };
      mat.customProgramCacheKey = () => key + '|ceres-grey'; mat.needsUpdate = true;
    }
    this.wreckLook = new OpeningLook({ engine, scene: this.scene, root: this.root, low: this.low, ship, model: m, cabin: this.cabin, crate: this.crate, ui: this.ui, lamp: this.lamp, cabinFill: this.cabinFill, sun: this.sun, hemi: this.hemi, q: this.q, dust: this.dust, worldId: this.worldId, cause: this.cause });
    this.look = this.wreckLook; this.wreckFog = this.scene.fog; this.wreckBg = this.scene.background;
    this.wreckSun.shadow.mapSize.set(1024, 1024); Object.assign(this.wreckSun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 180 }); this.wreckSun.shadow.bias = -.0001; this.wreckSun.shadow.normalBias = .025;
  }
  _look(faction, seq) { try { return factionLook(faction, seq, 'worker'); } catch { return { cloth: 0x9a735f }; } }
  _dressDriver() {
    const d = this.driverInfo, root = this.root;
    if (this.driver) { this.rover.root.remove(this.driver.group); }
    this.driver = this._person(d.person);
    this.driver.dress(d.faction ? this._look(d.faction, 2) : factionLook('mars', 4, 'worker'));
    this.driver.group.position.set(this.rover.driverSeat.x, this.rover.driverSeat.y - .42, this.rover.driverSeat.z); this.driver.group.rotation.y = Math.PI; this.driver.play('Sit');
    this.rover.root.add(this.driver.group);
    this.driver.ready.then((p) => { if (!p.loaded || !this.rover) return; if (p.safe) { p.group.position.y = (this.rover.driverHead || 2) - 1.61; return; }
      let head; p.group.traverse((o) => { if (o.isBone && /(^|[:_])head$/i.test(o.name)) head = o; });
      if (head) { p.group.updateWorldMatrix(true, true); const local = p.group.worldToLocal(head.getWorldPosition(new THREE.Vector3())); p.group.position.y = (this.rover.driverHead || 2) - local.y; } });
    void root;
  }
  _buildLocker() {
    const k = new Kit(); k.tiles = { metal: 1 };
    k.bevelBox('steel', 0, .95, 0, .62, 1.9, .5, .03); k.bevelBox('steelDark', 0, .95, .26, .56, 1.84, .02, .01);
    for (let i = 0; i < 5; i++) k.box('steelDark', 0, 1.62 + i * .035, .275, .3, .012, .004);
    k.bevelBox('gunmetal', .22, .95, .28, .04, .24, .03, .01); k.box('hazard', 0, .12, .275, .5, .06, .004);
    this.locker = k.toGroup(this.ship.matsInt, { name: 'crew-locker', cast: false, receive: true });
    this.locker.position.set(2.62, 0, LOCKER.z); this.locker.rotation.y = -Math.PI / 2; this.cabin.root.add(this.locker);
    const ledM = new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false }); this.lockerLed = ledM;
    const led = new THREE.Mesh(new THREE.BoxGeometry(.05, .05, .02), ledM); led.position.set(-.2, 1.78, .29); this.locker.add(led);
  }

  // ---- UI ------------------------------------------------------------------------------------------------------------------
  buildUI() {
    this.style = document.createElement('style'); this.style.textContent = `
      body[data-opening="active"] > .btn,body[data-opening="active"] #hud,body[data-opening="active"] #settings-panel,
      body[data-opening="active"] #crew-panel,body[data-opening="active"] #space-panel,
      body[data-opening="active"] #economy-purse,body[data-opening="active"] #key-controls{display:none!important}
      body[data-opening="active"] #multiplayer-button,body[data-opening="active"] #multiplayer-panel,
      body[data-opening="active"] #crew-ui{display:none!important}
      #opening-ui{position:fixed;inset:0;pointer-events:none;z-index:100;font:14px/1.6 system-ui,sans-serif;color:#ece4d9}
      #opening-caption{position:absolute;bottom:calc(110px + env(safe-area-inset-bottom));left:10%;right:10%;text-align:center;text-shadow:0 2px 5px #000}
      #opening-caption .who{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#ffd9a0;opacity:.9}
      #opening-hint{position:absolute;top:calc(18px + env(safe-area-inset-top));left:20px;font-size:12px;color:#e5d2bd;max-width:62%}
      #opening-action,#opening-walk,#opening-skip{pointer-events:auto;position:absolute;min-height:48px;border:1px solid #c7b29666;border-radius:6px;background:#151313bf;color:#f1e2d0;padding:12px 18px;font:13px system-ui;cursor:pointer}
      #opening-action{bottom:calc(24px + env(safe-area-inset-bottom));right:20px}
      #opening-walk{bottom:calc(24px + env(safe-area-inset-bottom));right:180px}
      #opening-skip{top:calc(14px + env(safe-area-inset-top));right:18px}#opening-fade{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none}
      #opening-warp{position:absolute;top:calc(60px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);padding:6px 14px;border:1px solid #ffd9a088;border-radius:3px;background:#0b0a0cb0;color:#ffd9a0;font:11px system-ui;letter-spacing:.16em;text-transform:uppercase;white-space:nowrap;animation:ow 1.4s ease-in-out infinite}@keyframes ow{50%{opacity:.55}}
      #opening-plasma{position:absolute;inset:0;pointer-events:none;opacity:0;mix-blend-mode:screen;background:radial-gradient(ellipse at 50% 55%,rgba(255,200,120,.1) 0%,rgba(255,120,40,.55) 55%,rgba(255,70,10,.9) 100%)}
      #opening-flash{position:absolute;inset:0;pointer-events:none;opacity:0;background:rgb(255,255,255)}
      #opening-noise{position:absolute;inset:0;pointer-events:none;opacity:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.18) 0 1px,rgba(0,0,0,.22) 1px 3px);mix-blend-mode:screen}
      #opening-note{position:absolute;left:8%;right:8%;top:22%;max-height:60%;overflow:auto;pointer-events:auto;background:#17130f;border:1px solid #c7b296;border-radius:10px;padding:16px 18px;font-size:14px;line-height:1.55}
      #opening-note b{display:block;font-size:12px;letter-spacing:.12em;color:#ffd9a0;margin-bottom:6px;text-transform:uppercase}
      #opening-note button{margin-top:12px;pointer-events:auto;min-height:44px;border:1px solid #c7b29688;border-radius:6px;background:#2a2118;color:#f1e2d0;padding:10px 16px;font:13px system-ui}
      body[data-opening-film="true"] #opening-caption,body[data-opening-film="true"] #opening-hint,
      body[data-opening-film="true"] #opening-ui button{visibility:hidden}
      @media(max-width:600px){#opening-caption{font-size:13px;left:5%;right:5%;bottom:100px}#opening-hint{font-size:11px}}
    `; document.head.appendChild(this.style);
    this.ui = document.createElement('div'); this.ui.id = 'opening-ui';
    this.ui.innerHTML = '<div id="opening-plasma"></div><div id="opening-noise"></div><div id="opening-flash"></div><div id="opening-warp" hidden>Cruise to another world &middot; time compressed</div><div id="opening-fade"></div><div id="opening-hint"></div><div id="opening-caption" aria-live="polite">Preparing the opening…</div><button id="opening-action" hidden></button><button id="opening-walk" hidden>Walk (Q)</button><button id="opening-skip">Skip intro</button>';
    document.body.appendChild(this.ui);
    const q = (s) => this.ui.querySelector(s);
    Object.assign(this, { caption: q('#opening-caption'), hint: q('#opening-hint'), action: q('#opening-action'), walkButton: q('#opening-walk'), fade: q('#opening-fade'), skip: q('#opening-skip'),
      plasmaEl: q('#opening-plasma'), warpEl: q('#opening-warp'), flashEl: q('#opening-flash'), noiseEl: q('#opening-noise') });
    this.skip.hidden = !this.state.played && !this._playedBefore();
    bindActivation(this.action, () => this.interact()); bindActivation(this.walkButton, () => this.walkInstead());
    bindActivation(this.skip, () => this.useAction(() => this.command({ type: 'opening-skip', replay: this._playedBefore() })));
  }
  _playedBefore() { try { return localStorage.getItem('cosmos-opening-played') === '1'; } catch { return false; } }
  startAudio() {
    if (this.audio || !this.active) return; const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = new C(), gain = ctx.createGain(), rumble = ctx.createOscillator(), alarm = ctx.createOscillator(), alarmGain = ctx.createGain();
    gain.gain.value = .02; gain.connect(ctx.destination); rumble.type = 'triangle'; rumble.frequency.value = 38; rumble.connect(gain); rumble.start();
    alarm.type = 'sine'; alarm.frequency.value = 650; alarmGain.gain.value = 0; alarm.connect(alarmGain); alarmGain.connect(ctx.destination); alarm.start();
    this.audio = { ctx, gain, rumble, alarm, alarmGain }; ctx.resume().catch(() => {});
  }
  syncFilm(hidden = true) {
    this.film = hidden; document.body.dataset.openingFilm = String(hidden); document.body.dataset.cosmosFilm = String(hidden);
    if (!document.getElementById('cosmos-film-style')) { const style = document.createElement('style'); style.id = 'cosmos-film-style';
      style.textContent = 'body[data-cosmos-film="true"] > :not(canvas):not(#opening-ui):not(.opening-transition){visibility:hidden}'; document.head.appendChild(style); }
    return this;
  }

  // ---- stages ------------------------------------------------------------------------------------------------------------------
  /** Switch the picture to a place: 'space' (the liner's flight), 'port' (the port frame: sky, ground, the port) or 'wreck' (the old site). */
  useFrame(kind) {
    if (this.frameKind === kind) return; this.frameKind = kind;
    this.portCloneEntryL.object3d = kind === 'local' ? this.portClone : null; this.portCloneEntryW.object3d = kind === 'world' ? this.portClone : null;
    if (kind === 'world') { this.sun.position.copy(SUN).applyQuaternion(this.q || this.portQ); this.hemi.position.copy(this.port.site.up); }
    else { this.sun.position.copy(SUN); this.hemi.position.set(0, 1, 0); }
  }
  setScene(kind) {
    if (this.sceneKind === kind) return; this.sceneKind = kind; this.useFrame(kind === 'wreck' ? 'world' : 'local');
    const flight = kind === 'port';     // the port's frame: the walk AND the whole flight (the sky, the planet and the ships are one world there)
    this.space.setVisible(flight);
    this.portRoot.visible = this.portGround.mesh.visible = this.portMid.mesh.visible = this.skyHolder.visible = this.marsHolder.visible = flight;
    if (this.worldHolder && !flight) this.worldHolder.visible = false;
    this.portClone.visible = flight || (kind === 'wreck' && this.worldId === 'mars');
    this.sun.visible = this.hemi.visible = true;
    if (this.root) { this.root.visible = kind === 'wreck'; this.ground.mesh.visible = this.far.mesh.visible = kind === 'wreck'; }
    if (kind === 'wreck') { this.scene.fog = this.wreckFog || null; this.scene.background = this.wreckBg || new THREE.Color(0x2a1a22); this.sun.castShadow = !this.low && !this.engine.safe; }
    else { this.scene.fog = new THREE.FogExp2(0x594b46, .00013); this.scene.background = new THREE.Color(0x000000);
      this.hemi.color.set(0xb5bacc); this.hemi.groundColor.set(0x492e23); this.hemi.intensity = .5; this.sun.color.set(0xffcf9a); this.sun.intensity = 1.7; this.sun.castShadow = false; }
  }
  /** Begin a stage (also on a resume). */
  enterStage(n, resuming = false) {
    this.stageNo = n; const s = this.state; this.spokenKeys.clear(); this.lines.until = 0;
    if (n === STAGE.LINER) { this.setScene('port'); this._linerPlace(); this.liner.sw.place(s.pose.x, s.pose.y, s.pose.z, s.pose.yaw); this.liner.sw.pitch = s.pose.pitch; this.engine.overlayScenes = [this.liner.interiorScene]; this._firstRooms = true; }
    else if (n === STAGE.PORT) { this.setScene('port'); this.space.setConvoyVisible(false); this._atmosphere(0, linerDown(this.linerDef), { x: 0, y: 2, z: 0 }); this.model.use('port'); this.model.place(s.pose); this.engine.overlayScenes = []; this._linerPlace(); this.liner.exterior.root.visible = true; this.liner.interior.root.visible = false;
      setTimeout(() => { if (this.active && !this.kestrel) this._ensureKestrel(); }, 700);
      this.liner.hardware.visible = true;
      this.say(D.STEP_OFF, 'Steward');
      this._pathBuilt || this._buildPath(); }
    else if (n === STAGE.DESCENT) { this._ensureKestrel(); this.liner.group.visible = true; this.engine.overlayScenes = [this.kestrel.interiorScene]; this.kestrel.sw.place(s.pose.x, s.pose.y, s.pose.z, s.pose.yaw); this.kestrel.sw.pitch = s.pose.pitch; this._firstRooms = true;
      this.crashFx?.dispose(); this.crashFx = new CrashFx({ space: this.space, stage: this.kestrel, cause: this.cause, worldId: this.worldId, tier: this.tier, mats: this.ship.matsExt, scene: this.scene }); this.space.setConvoyVisible(false); this._kestrelScene = null; }
    else if (n >= STAGE.WRECK) { this._ensureWreck(); this.engine.overlayScenes = []; this.setScene('wreck'); this.liner.group.visible = false; if (this.kestrel) this.kestrel.group.visible = false;
      this.portClone.visible = this.worldId === 'mars';
      if (n === STAGE.WRECK) { this.cabinSw.place(s.pose.x, s.pose.y, s.pose.z, s.pose.yaw); this.cabinSw.pitch = s.pose.pitch; }
      else this.model.place(s.pose);
      if (n === STAGE.WRECK && !resuming) { this.say(D.WRECK_WAKE, 'Ship'); this.wreckSay = [D.WRECK_CAUSE[this.cause], this.wd.surface]; this.wreckSayAt = this.elapsed + 6; } }
  }
  _buildPath() {
    this._pathBuilt = true; const pk = new Kit(), pts = portPath(this.linerDef);
    for (let i = 1; i < pts.length; i++) { const [x0, z0] = pts[i - 1], [x1, z1] = pts[i], len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.floor(len / 14));
      for (let j = 0; j < n; j++) { const t = (j + .5) / n; pk.cyl('steelDark', x0 + (x1 - x0) * t, .6, z0 + (z1 - z0) * t + 3.4, .04, 1.2, 6); pk.box('glowAmber', x0 + (x1 - x0) * t, 1.25, z0 + (z1 - z0) * t + 3.4, .14, .1, .14); } }
    this.pathMesh = pk.toGroup(this.ship.matsExt, { name: 'opening-path' }); this.portRoot.add(this.pathMesh);
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=192;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#102021';ctx.fillRect(0,0,1024,192);
    ctx.strokeStyle='#ffd28b';ctx.lineWidth=12;ctx.strokeRect(8,8,1008,176);
    ctx.fillStyle='#ffd28b';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 132px Arial';ctx.fillText('ARRIVALS',512,103,970);
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(8,1.5),new THREE.MeshBasicMaterial({map:tex,toneMapped:false,side:THREE.DoubleSide}));
    sign.name='lit ARRIVALS entrance';sign.position.set(-100.65,3.7,40.2);sign.rotation.y=-Math.PI/2;this.portRoot.add(sign);
    for(const [x,z] of [pts[1],pts[2],pts[4],pts[6]]){const l=new THREE.PointLight(0xffc486,35,35,1.4);l.position.set(x,2.7,z+3.4);this.portRoot.add(l);}
  }

  // ---- ship placement --------------------------------------------------------------------------------------------------------
  /** Place the Ares: in the space frame while it flies, in the port frame once it is down (or coming down). */
  _linerPlace(shake = 0, t = this.clock) {
    const L = this.liner, def = this.linerDef, k = this.elapsed;
    const jitter = (a) => shake * a * (Math.sin(k * 23.1) * Math.sin(k * 7.3) + .6 * Math.sin(k * 41));
    const down = this.state.stage > STAGE.LINER, p = down ? { ...linerDown(def), pitch: 0, roll: 0, alt: 0 } : linerPath(t, def), swayK = clamp(p.alt / 4000, 0, 1);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(p.pitch + jitter(.004) + swayK * .004 * Math.sin(k * .31), 0, p.roll + jitter(.006) + swayK * .006 * Math.sin(k * .23), 'YXZ'));
    // in the cruise the ship holds Mars off the starboard windows (it turns to it); the turn comes out again, smoothly, as the air takes the ship (by the touchdown it is upright)
    const w = down ? 0 : 1 - smooth(100, 134, t);
    if (w > 0) { const d = new THREE.Vector3(this.marsPos.x - p.x, this.marsPos.y - p.y, this.marsPos.z - p.z).normalize(), qc = new THREE.Quaternion().setFromUnitVectors(LINER_MARS_DIR, d); q.premultiply(new THREE.Quaternion().slerp(qc, w)); }
    this.spaceEntry.quaternion.copy(q);
    L.place({ x: p.x, y: p.y, z: p.z }, q); this.linerQ.copy(q); this.linerLocal = p;
    // Passenger exit only; the cargo hatch stays closed throughout the opening.
    L.setRamps(0, linerRampProgress(down ? LINER_PHASE.rampsDown : t));
    return p;
  }

  // ---- protocol --------------------------------------------------------------------------------------------------------------
  pose() {
    switch (this.state.stage) {
      case STAGE.LINER: return { x: this.liner.sw.x, y: this.liner.sw.y, z: this.liner.sw.z, yaw: this.liner.sw.yaw, pitch: this.liner.sw.pitch };
      case STAGE.DESCENT: return { x: this.kestrel.sw.x, y: this.kestrel.sw.y, z: this.kestrel.sw.z, yaw: this.kestrel.sw.yaw, pitch: this.kestrel.sw.pitch };
      case STAGE.WRECK: return { x: this.cabinSw.x, y: this.cabinSw.y, z: this.cabinSw.z, yaw: this.cabinSw.yaw, pitch: this.cabinSw.pitch };
      default: return this.model.pose();
    }
  }
  checkpoint(force = false) {
    if (!this.active || this.world.remote || !force && performance.now() < (this.nextCheckpoint || 0)) return;
    this.nextCheckpoint = performance.now() + 150;
    writeOpeningCheckpoint(this.world, { ...this.state, pose: this.pose(), elapsed: this.elapsed, clock: this.clock, rideSeconds: this.rideSeconds, contactSeconds: this.contactSeconds });
  }
  savePose(seconds = this.accum) { if (!this.active || this.busy) return this.pending; this.accum = 0; return this.command({ type: 'opening-pose', pose: this.pose(), seconds: Math.min(130, seconds) }, false); }
  command(a, show = true) {
    this.busy = true;
    const task = async () => {
      let r;
      try {
        if (this.world.remote) {
          r = await this.world.request(a);
          if (r.opening) { const count = this.state.cuts.length, was = this.state.stage; Object.assign(this.state, r.opening); this._syncDest();
            if (this.model.kind === 'wreck') { for (const cut of this.state.cuts.slice(count)) this.model.cut(cut, false); }
            if (r.corrected && r.pose && this.state.stage === was) this._applyPose(r.pose); }
        } else { r = this.model.act(a); this.world.state.opening = structuredClone(this.state); this.world.state.shipType = 'lifeboat'; await this.world.persist(); await this.world.flush(); this._syncDest(); }
        if (!r.ok) { if (a.type === 'opening-next' && (this.state.stage === STAGE.LINER || this.state.stage === STAGE.DESCENT)) return r;       // the clocks differ by a second: the next frame asks again
          this.status = r.msg || 'Wait for the shared world.'; this.statusUntil = this.elapsed + 6; return r; }
        if (this.stageNo !== this.state.stage) { const from = this.stageNo; this.accum = 0; this.clock = this.state.clock || 0; this.enterStage(this.state.stage); this._afterStage(from); }
        if (this.state.complete) this.finish(r.arrivalPose, r.arrivalFrame);
        return r;
      } catch (e) { this.status = e.message; this.statusUntil = this.elapsed + 6; return { ok: false, msg: e.message }; }
    };
    this.pending = this.pending.then(task).finally(() => { this.busy = false; this.checkpoint(true); }); return this.pending;
  }
  _applyPose(p) {
    switch (this.state.stage) { case STAGE.LINER: this.liner.sw.place(p.x, p.y, p.z, p.yaw); break; case STAGE.DESCENT: this.kestrel.sw.place(p.x, p.y, p.z, p.yaw); break;
      case STAGE.WRECK: this.cabinSw.place(p.x, p.y, p.z, p.yaw); break; default: this.model.place(p); }
  }
  _afterStage(from) { if (from === STAGE.LINER) this.fadeFrom = this.elapsed; if (from === STAGE.PORT) this.fadeFrom = this.elapsed; if (from === STAGE.DESCENT) this.fadeFrom = this.elapsed; }
  async useAction(run) { if (this.actionPending || !this.active) return; this.actionPending = true; try { await this.pending; if (!this.active) return; return await run(); } finally { this.actionPending = false; } }
  tryFinish() {
    if (this.busy || (this.finishRetryAt || 0) > this.elapsed) return; this.finishRetryAt = this.elapsed + 2.5;
    this.savePose().then(() => this.command({ type: 'opening-finish' })).then((r) => { if (r?.ok || !this.active) return; this.finishFails = (this.finishFails || 0) + 1; if (this.finishFails >= 3) this.command({ type: 'opening-skip' }); });
  }
  interact() { return this.useAction(() => this._interact()); }
  /** FIX-R2: "Dig" at the crate cuts where you LOOK, within arm's reach (3 m or so); a phone player looking at the horizon cut nothing and got "Nothing in reach".
   *  The button said Dig, so the tap now turns the head to the buried crate first. Only when the crate is close enough to dig (the button is already gated on that). */
  _aimAtCrate() {
    const m = this.model, w = m?.walker; if (!w || m.kind !== 'wreck' || m.exposed()) return;      // FIX-R3: always aim; r2 left a look at ground already in reach alone, so the cut could land in a hole already dug
    const t = this._crateDirt(); if (!t) return;
    const f = w.updateFrame(), eye = w.eyeWorldPos({});
    const dx = t.x - eye.x, dy = t.y - eye.y, dz = t.z - eye.z;
    const e = dx * f.east.x + dy * f.east.y + dz * f.east.z, n = dx * f.north.x + dy * f.north.y + dz * f.north.z, u = dx * f.up.x + dy * f.up.y + dz * f.up.z;
    const flat = Math.hypot(e, n); if (flat < .05) return;
    w.yaw = Math.atan2(e, n); w.pitch = Math.max(-1.2, Math.min(1.2, Math.atan2(u, flat)));
  }
  /** FIX-R3: the dirt that still covers the crate (world point): the highest surface, just inside it, over the five spots exposed() tests. The cut then lands on the
   *  top of that dirt, never beside or underneath the crate. */
  _crateDirt() {
    const m = this.model; let best = null;
    for (const [x, z] of [[0, 0], [.18, 0], [-.18, 0], [0, .18], [0, -.18]]) {
      let w = m.toWorld(CRATE.x + x, .34, CRATE.z + z); if (!(density(m.body, w.x, w.y, w.z) < 0)) continue;      // this spot is already clear
      let top = .34; for (let y = .9; y > .34; y -= .02) { w = m.toWorld(CRATE.x + x, y, CRATE.z + z); if (density(m.body, w.x, w.y, w.z) < 0) { top = y; break; } }
      if (!best || top > best.top) best = { x, z, top };
    }
    return best ? m.toWorld(CRATE.x + best.x, best.top - .03, CRATE.z + best.z) : null;
  }
  /** FIX-R3: the amber ring on the dirt the Dig button will cut (same marker as the ordinary game's dig). */
  _updateDigMark(show) {
    const mk = this.digMark; if (!mk) return;
    const m = this.model, hit = show && m?.kind === 'wreck' ? m.digger.digTarget() : null;
    if (!hit) { mk.group.visible = false; return; }
    const l = m.toLocal(hit.point), tl = m.digger.tool, n = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z).normalize().applyQuaternion(this.q.clone().invert());
    mk.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); mk.group.position.set(l.x + n.x * .02, l.y + n.y * .02, l.z + n.z * .02);
    const r = tl.radius * .9, pulse = .5 + .5 * Math.sin(performance.now() / 1000 * 3.4);
    mk.group.scale.setScalar(r); mk.stem.scale.set(1, Math.max(.001, tl.radius * 1.5 / r), 1); mk.stem.position.set(0, 0, -tl.radius * 1.5 / 2 / r);
    mk.rim.material.opacity = .42 + .18 * pulse; mk.fill.material.opacity = .055 + .035 * pulse; mk.stem.material.opacity = .30 + .15 * pulse; mk.group.visible = true;
  }
  async _interact() {
    if (this.actionKind === 'dig') this._aimAtCrate();
    await this.savePose(Math.max(this.accum, .1)); const s = this.state, a = this.actionKind;
    if (a === 'board') return this.showBoard();
    if (a === 'gate') return this.command({ type: 'opening-board' });
    if (a === 'locker') return this.openLocker();
    if (a === 'climb') return this.command({ type: 'opening-next' });
    if (a === 'dig') return this.command({ type: 'opening-dig' });
    if (a === 'carry') return this.command({ type: 'opening-carry' });
    if (a === 'ride') return this.command({ type: 'opening-ride' });
    void s;
  }
  walkInstead() { return this.useAction(async () => { if (this.state.stage !== STAGE.CONTACT || this.state.contactSeconds < CONTACT_SECONDS) return; await this.savePose(); return this.command({ type: 'opening-walk' }); }); }

  // ---- the board, the locker ---------------------------------------------------------------------------------------------------
  async fetchBoard() {
    if (this.world.remote && this.world.board) { try { return await this.world.board(); } catch { /* fall through to the local data */ } }
    // A solo world has only Mars (the other worlds are the shared world's): the board says so rather than offering a start it cannot give.
    const data = boardData({ season: this.state.season });
    for (const w of data.worlds) if (w.id !== 'mars' && w.status === 'open') { w.status = 'coming'; w.nearest = 'mars'; w.line += ' Only the shared world can start you here.'; }
    return data;
  }
  async showBoard() {
    if (this.boardOpen) return; this.boardOpen = true; this.say(D.GUIDE_LINES.board, 'Guide');
    const data = await this.fetchBoard();
    this.boardCtl = openBoard({ data, initial: this.dest?.world || 'mars',
      onPick: async (pick) => { await this.savePose(.1); const r = await this.command({ type: 'opening-pick', ...pick }); if (r?.ok && !this.state.complete) this.say(pick.stay ? D.GUIDE_LINES.stay : D.GUIDE_LINES.picked, 'Guide'); return r; },
      onClose: () => { this.boardOpen = false; this.boardCtl = null; } });
  }
  openLocker() {
    const L = this.wd.locker; if (this.noteEl) return;
    this.command({ type: 'opening-locker' });
    this.noteEl = document.createElement('div'); this.noteEl.id = 'opening-note';
    this.noteEl.innerHTML = `<b>${L.name}, ${L.role}</b><p>${L.photo}</p><p><i>${L.note}</i></p><button>Close the locker</button>`;
    this.ui.appendChild(this.noteEl); bindActivation(this.noteEl.querySelector('button'), () => { this.noteEl.remove(); this.noteEl = null; });
    if (this.lockerLed) this.lockerLed.color.set(0x40ff80);
  }

  // ---- words -------------------------------------------------------------------------------------------------------------------
  /** Say a line now (caption and voice): who is the label shown over it. */
  say(text, who = '', secs = 0) { this.lines = { text, who, until: this.elapsed + (secs || Math.max(3.2, text.length * .07)) }; }
  _speak(text) {
    if (!text) { this._spoken = ''; return; } if (text === this._spoken) return; this._spoken = text;
    const who = this.voice && D.speakerOf(text); if (!who) return;
    const src = who.source;
    let source = null;
    if (src === 'driver') source = this.driver?.group; else if (src === 'counter') source = this.counterPerson?.group; else if (src === 'guide') source = this.guide?.group; else if (src === 'gate') source = this.gate?.group;
    else if (src?.startsWith('talker:')) source = this.talkers?.find((t) => t.id === src.slice(7))?.person.group || null;
    this.voice.sayLine(text, { voice: who.voice, source, channel: source ? 'room' : 'radio' });
  }

  // ---- the frame ---------------------------------------------------------------------------------------------------------------
  frame(dt, input, look) {
    if (!this.active) return false;
    const s = this.state, disconnected = this.world.remote && !this.world.connected;
    if (disconnected) { dt = 0; input = {}; }
    if (s.stage === STAGE.LINER && !this.actorsReady && performance.now() - this.readyAt < 7000) dt = 0;
    this.elapsed += dt; this.accum += dt;
    if (s.stage === STAGE.LINER || s.stage === STAGE.DESCENT) this.clock += dt;
    if (s.stage === STAGE.TRAVEL && s.ride) this.rideSeconds += dt;
    if (s.stage === STAGE.CONTACT) this.contactSeconds += dt;
    this.skip.hidden = !s.played && !this._playedBefore();
    this.walkButton.hidden = s.stage !== STAGE.CONTACT || this.contactSeconds < CONTACT_SECONDS;
    this.action.disabled = this.walkButton.disabled = this.skip.disabled = !!this.actionPending || disconnected || this.boardOpen;
    this.hint.textContent = ''; this.actionLabel = ''; this.actionKind = '';
    let cam;
    switch (s.stage) {
      case STAGE.LINER: cam = this._frameLiner(dt, input, look); break;
      case STAGE.PORT: cam = this._framePort(dt, input, look); break;
      case STAGE.DESCENT: cam = this._frameDescent(dt, input, look); break;
      default: cam = this._frameWreck(dt, input, look);
    }
    const e = this.engine;
    Object.assign(e.cameraWorldPos, cam.eye); e.camera.up.copy(cam.up); e.camera.lookAt(cam.forward);
    if (s.stage !== STAGE.LINER && s.stage !== STAGE.DESCENT && this.audio) this.audio.alarmGain.gain.setTargetAtTime(0, this.audio.ctx.currentTime, .2);
    // words: a scripted line wins over a proximity line; a status message (a refusal, a reconnect) wins over both
    let text = this.lines.until > this.elapsed ? this.lines.text : '', who = this.lines.until > this.elapsed ? this.lines.who : '';
    if (cam.caption) { text = cam.caption; who = cam.who || ''; }
    if (disconnected) { text = 'Shared world disconnected. Reconnecting…'; who = ''; } else if (this.statusUntil > this.elapsed) { text = this.status; who = ''; }
    this.caption.innerHTML = text ? (who ? `<span class="who">${who}</span>` : '') + text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])) : '';
    this.action.hidden = !this.actionLabel; if (this.action.textContent !== this.actionLabel) this.action.textContent = this.actionLabel;
    if (!this.hint.textContent && cam.hint) this.hint.textContent = cam.hint;
    const gate=kestrelGate(this.kestrelDef||shipDef(KESTREL.type));
    const goal=s.stage===STAGE.PORT ? (!this.dest ? {id:'arrivals',label:'Arrivals hall',target:{x:-100,y:1.5,z:40.2},reach:14} : {id:'kestrel',label:'Pad 01 / Kestrel',target:{x:gate.x,y:1.5,z:gate.z},reach:8}) : null;
    this.goalHint.update(dt,goal?{...goal,onPlanet:true,eye:cam.eye}:null);
    this._speak(disconnected || this.statusUntil > this.elapsed ? '' : text);
    this.checkpoint();
    if (this.look && s.stage >= STAGE.WRECK) this.look.frame(dt, s, this.elapsed);
    if (this.accum >= 1 && !this.busy) this.savePose();
    return true;
  }

  // -- stage 0: the liner
  _linerEyeCam(L, look, input, dt, walking) {
    const sw = L.sw;
    sw.yaw += look.dx; sw.pitch = clamp(sw.pitch - look.dy, -1.4, 1.3);
    if (walking) sw.tick(dt, { moveX: input.moveEast, moveZ: input.moveNorth, run: input.run, jump: input.jump });
    const eye = new THREE.Vector3().copy(sw.eyeLocal()), fwd = new THREE.Vector3(Math.sin(sw.yaw) * Math.cos(sw.pitch), Math.sin(sw.pitch), -Math.cos(sw.yaw) * Math.cos(sw.pitch));
    return { eye, fwd };
  }
  _frameLiner(dt, input, look) {
    const s = this.state, L = this.liner, t = this.clock, ph = linerPhase(t), def = this.linerDef;
    // ONE CONTINUOUS FLIGHT: the heat and the shaking of the entry are the air meeting the hull; nothing is switched under them (flightPath.js)
    const entryK = linerHeat(t);
    const shake = ph === 'entry' ? .4 + 1.6 * entryK : ph === 'descent' ? .5 * (1 - smooth(LINER_PHASE.entryEnd, LINER_PHASE.entryEnd + 30, t)) + .12 : ph === 'cruise' ? .5 * entryK : 0;
    this.setScene('port');
    const p = this._linerPlace(shake, t);
    this.plasmaEl.style.opacity = String(clamp(entryK, 0, 1) * .78);
    this.space.updateConvoy(t, 1 + 24 * smooth(108, 130, t) ** 1.4); this.space.setConvoyVisible(t < 131 && !this.state.stage);
    // walking and the camera
    const { eye, fwd } = this._linerEyeCam(L, look, input, dt, true);
    const worldEye = this._shipWorld(L, eye, fwd, 'liner');
    this._atmosphere(p.alt, p, worldEye.eye);
    L.update(dt, eye, fwd, { walking: true, inside: L.sw.x < def.ramps.airlock.hinge.x, aspect: this.engine.camera.aspect, fov: this.engine.camera.fov, first: this._firstRooms }); this._firstRooms = false;
    // the wake: fade in from black over three seconds (and a black screen while the people are still loading)
    if (this.t0 === undefined && dt > 0) this.t0 = this.elapsed;
    const waiting = !this.actorsReady && performance.now() - this.readyAt < 7000;
    this.fade.style.opacity = String(waiting ? 1 : clamp(1 - (this.elapsed - (this.t0 ?? this.elapsed)) / 3, 0, 1));
    const prep = waiting;
    if (this.voice && !this.voice.unlocked && t > 2 && t < 14) this.hint.textContent = 'Tap the screen once to turn on sound.';
    else if (t < 12) this.hint.textContent = 'Move: left thumb · Look: right thumb. Walk the ship. Talk to people by walking up to them.';
    // sound
    if (this.audio) { this.audio.rumble.frequency.value = 36 + entryK * 30 + (ph === 'descent' ? 6 : 0); this.audio.gain.gain.setTargetAtTime(.02 + entryK * .03, this.audio.ctx.currentTime, .3); }
    // the captain, then the people
    let line = D.LINER_SCRIPT.find((l) => t >= l.t0 && t < l.t1);
    let caption = '', who = '';
    if (line) { caption = line.text; who = line.voice === 'radio' ? 'Port control' : 'Captain'; }
    else { const r = this._talkers(dt, 'liner'); caption = r.text; who = r.who; }
    // getting off: the gangway is down; stepping off its end is the way out
    const landed = ph === 'landed' && t >= LINER_PHASE.rampsDown + 1;
    if (landed) {
      this.hint.textContent = 'Welcome to Marineris. Leave by the starboard gangway: the boarding hall is behind the promenade.';
      if ((L.sw.wantsExit || L.sw.x >= gangwayEndX(def) + .4 && L.sw.y <= -restHeight(def) + .35) && !this.busy && !this._leaving) { this._leaving = true; this.savePose().then(() => this.command({ type: 'opening-next' })).finally(() => { this._leaving = false; }); }
    }
    if (prep) { caption = 'Preparing the opening…'; who = ''; }
    return { eye: worldEye.eye, forward: worldEye.forward, up: worldEye.up, caption, who };
  }
  /** Ship-local eye and look -> world (f64 for the eye). `which`: 'liner' or 'kestrel' (their frames and quaternions). */
  _shipWorld(stage, eye, fwd, which) {
    const q = stage.quaternion, wp = stage.worldPos;
    const e = eye.clone().applyQuaternion(q), f = fwd.clone().applyQuaternion(q), up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    void which;
    return { eye: { x: wp.x + e.x, y: wp.y + e.y, z: wp.z + e.z }, forward: f, up };
  }
  /** Proximity talk: the nearest talker within range says its next line (one at a time, a pause between). Returns the caption to show. */
  _talkers(dt, where) {
    const sw = where === 'liner' ? this.liner.sw : this.kestrel.sw;
    if (where !== 'liner') return { text: '', who: '' };
    if (this.elapsed < this.talk.next) return { text: this.talk.text || '', who: this.talk.who || '' };
    this.talk.text = ''; this.talk.who = '';
    let best = null, bd = 1e9;
    for (const t of this.talkers) { if (t.said >= t.lines.length) continue; const d = Math.hypot(sw.x - t.x, sw.z - t.z); if (d < t.range && d < bd) { best = t; bd = d; } }
    if (best) { const text = best.lines[best.said++]; this.talk = { text, who: best.name, next: this.elapsed + Math.max(3.4, text.length * .075) + .8 }; return { text, who: best.name }; }
    return { text: '', who: '' };
  }

  // -- stage 1: the port
  _framePort(dt, input, look) {
    const s = this.state, m = this.model, w = m.walker;
    this.fade.style.opacity = String(clamp(1 - (this.elapsed - (this.fadeFrom ?? -9)) / 2, 0, 1));
    this.plasmaEl.style.opacity = '0'; this.flashEl.style.opacity = '0'; this.noiseEl.style.opacity = '0';
    this._linerPlace(0, 999);
    if (this.kestrel) { this.kestrel.group.visible = true; this.kestrel.exterior.root.visible = true; this.kestrel.interior.root.visible = false; this.kestrel.setRamps(0, 1); this.kestrel.place({ x: KESTREL.spot.x, y: restHeight(this.kestrelDef), z: KESTREL.spot.z }, new THREE.Quaternion()); }
    w.yaw += look.dx; w.pitch = clamp(w.pitch - look.dy, -1.4, 1.3);
    if (!this.boardOpen) w.tick(dt, input);
    // solid things: the ships' hulls, and what the port itself stands on (its own collision boxes)
    const p = m.pose(), r = .3; let pushed = false;
    const boxes = this.portBoxes || (this.portBoxes = this._portBoxes());
    for (const b of boxes) { if (p.y >= b.y1 || p.y + 1.8 <= b.y0) continue; if (p.x <= b.x0 - r || p.x >= b.x1 + r || p.z <= b.z0 - r || p.z >= b.z1 + r) continue;
      const ch = [{ dx: b.x0 - r - p.x, dz: 0 }, { dx: b.x1 + r - p.x, dz: 0 }, { dx: 0, dz: b.z0 - r - p.z }, { dx: 0, dz: b.z1 + r - p.z }].sort((a, c) => Math.hypot(a.dx, a.dz) - Math.hypot(c.dx, c.dz));
      p.x += ch[0].dx; p.z += ch[0].dz; pushed = true; }
    if (pushed) m.place(p);
    const eye = new THREE.Vector3().copy(m.toLocal(w.eyeWorldPos())), d = this._lookDir(w);
    Object.assign(this.skyPos, eye);
    const forward = new THREE.Vector3(d.x, d.y, d.z).applyQuaternion(this.portQinv), up = new THREE.Vector3(0, 1, 0);
    // the words and the actions of the place
    let caption = '', who = '';
    const gd = Math.hypot(p.x - GUIDE_SPOT.x, p.z - GUIDE_SPOT.z), bd = Math.hypot(p.x - BOARD_SPOT.x, p.z - BOARD_SPOT.z), g = kestrelGate(this.kestrelDef || shipDef(KESTREL.type)), kd = Math.hypot(p.x - g.x, p.z - g.z);
    if (gd < 13 && !this.spokenKeys.has('welcome')) { this.spokenKeys.add('welcome'); this.say(D.GUIDE_LINES.welcome, 'Guide'); }
    if (bd <= BOARD_SPOT.reach) { this.actionLabel = 'Read the board (E)'; this.actionKind = 'board'; }
    if (kd < g.reach + 4) {
      if (!this.spokenKeys.has('gate')) { this.spokenKeys.add('gate'); this.say(this.dest ? (D.GATE_LINES[this.dest.world] || D.GATE_LINES.ceres) : D.GUIDE_LINES.board, this.dest ? 'Gate agent' : 'Gate agent'); }
      if (this.dest && !this.dest.stay) { this.actionLabel = `Board the Kestrel to ${this.dest.world === 'mars' ? 'Mars' : this.dest.world[0].toUpperCase() + this.dest.world.slice(1)} (E)`; this.actionKind = 'gate'; }
      else { this.hint.textContent = 'Pick a world on the arrivals board first.'; }
    }
    if (!this.hint.textContent) this.hint.textContent = !this.dest ? 'Walk the port to the arrivals hall and read the board. Lit posts mark the way.' : 'Walk to the Kestrel on Pad 01.';
    this.portSky.uniforms.time.value = this.elapsed;
    this.portGround.mesh.visible = true;
    for (const pp of this.portPeople) pp.person.update(dt);
    void s; void caption; void who;
    return { eye: { x: eye.x, y: eye.y, z: eye.z }, forward, up, caption: '' };
  }
  _lookDir(w) {
    const f = w.updateFrame(), cy = Math.cos(w.yaw), sy = Math.sin(w.yaw), cp = Math.cos(w.pitch), sp = Math.sin(w.pitch);
    return { x: f.north.x * cy * cp + f.east.x * sy * cp + f.up.x * sp, y: f.north.y * cy * cp + f.east.y * sy * cp + f.up.y * sp, z: f.north.z * cy * cp + f.east.z * sy * cp + f.up.z * sp };
  }
  _portBoxes() {
    const boxes = [...this.port.boxes.filter((b) => b.y1 - b.y0 > .5)];
    const L = this.linerDef, down = linerDown(L);
    boxes.push({ x0: down.x - 14.4, x1: down.x + 14.4, z0: down.z - 61, z1: down.z + 61, y0: 0, y1: 8 });
    boxes.push({ x0: -15.8, x1: 15.8, z0: -33.5, z1: 33.5, y0: 0, y1: 8 });
    return boxes;
  }

  // -- stage 2: the Kestrel
  _frameDescent(dt, input, look) {
    const K = this.kestrel, def = this.kestrelDef, t = this.clock, ph = kestrelPhase(t), sw = K.sw, e = this.engine, cf = this.crashFx, far = this.worldId !== 'mars';
    // ONE CONTINUOUS FLIGHT (flightPath.js): off the pad over the apron (the Ares sits there), up through the thinning air to the edge of space with the
    // planet falling away below the windows, then either down onto the desert (Mars) or, for another world, a TIME-COMPRESSED cruise (shown on screen) with the
    // world growing ahead and coming round under the ship. The sky, the planet and the stars are the same ones all the way: nothing is switched.
    this.setScene('port'); this.liner.group.visible = true; this._linerPlace(0, 999); this.liner.exterior.root.visible = true;
    const p = kestrelPath(t, def, far), cause = this.cause;
    let overlay = { flash: 0, flashColor: '255,255,255', noise: 0, plasma: 0 };
    const shake = t < KESTREL_PHASE.climbEnd ? (ph === 'pad' ? .1 : .5 * smooth(3, 10, t)) : kestrelShake(t, cause) * .5 + (cf?.out.shake || 0) * .5;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(p.pitch + .003 * shake * Math.sin(this.elapsed * 19) + (t >= KESTREL_PHASE.climbEnd ? .004 * Math.sin(this.elapsed * .4) : 0), 0, .004 * shake * Math.sin(this.elapsed * 13) + .006 * Math.sin(this.elapsed * .27) * smooth(10, 24, t), 'YXZ'));
    // the ship banks to starboard on the climb and the fall, so the windows show the planet it is leaving and the one it is falling toward
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -.42 * smooth(15, 26, t) * (far ? 1 - smooth(26, 34, t) : 1 - smooth(46, 56, t))));
    this.spaceEntry.quaternion.copy(q); K.place({ x: p.x, y: p.y, z: p.z }, q); this.kQ = q;
    K.setRamps(0, ph === 'pad' ? 1 : 1 - smooth(3, 5, t)); K.exterior.root.visible = false;
    for (const eg of K.exterior.engines) eg.outer.visible = eg.core.visible = t > 2;
    this.space.setConvoyVisible(false);
    const gone = t >= KESTREL_PHASE.crash;
    if (t >= KESTREL_PHASE.crash + .8 && !this.wreckBuilt) this._ensureWreck();       // the screen is black: build the wreck now, not when the clock runs out
    // the walking and the camera
    const { eye, fwd } = this._linerEyeCam(K, look, input, dt, true);
    const worldEye = this._shipWorld(K, eye, fwd, 'kestrel');
    K.update(dt, eye, fwd, { walking: true, inside: true, aspect: e.camera.aspect, fov: e.camera.fov, first: this._firstRooms }); this._firstRooms = false;
    this._atmosphere(p.alt, { x: p.x, y: p.y, z: p.z }, worldEye.eye);
    this.space.alt = p.alt;      // the height the crash effects judge by (over the world the ship is falling to)
    // the other world, drawn at its own place relative to the ship (it is far, then it is huge)
    let warp = 0;
    if (far && this._ensureWorldGlobe()) {
      const w = this.worldGlobe, rel = ceresRelative(t, w.radius, 90e3), dir = new THREE.Vector3(rel.dir.x, rel.dir.y, rel.dir.z), on = rel.dist < 9.6e8 && t >= KESTREL_PHASE.spaceStart - 2;
      this.worldHolder.visible = on; Object.assign(this.worldPos, { x: p.x + dir.x * rel.dist, y: p.y + dir.y * rel.dist, z: p.z + dir.z * rel.dist });
      w.grp.quaternion.setFromUnitVectors(new THREE.Vector3(.9, .34, -.28).normalize(), dir.clone().negate()).premultiply(new THREE.Quaternion().setFromAxisAngle(dir, t * .002));
      this.space.shine.position.copy(dir).multiplyScalar(100);
      this.space.alt = rel.dist - w.radius;
      const [w0, w1] = farFlightWindow(); warp = smooth(w0 - 1, w0 + 1.5, t) * (1 - smooth(w1 - 1.5, w1 + 1, t));
    }
    if (cf) overlay = cf.update(dt, t, { x: 0, y: 1.6, z: 0 });
    this.warpEl.style.opacity = String(warp); this.warpEl.hidden = warp <= 0;
    this.flashEl.style.background = `rgb(${overlay.flashColor || '255,255,255'})`; this.flashEl.style.opacity = String(clamp(overlay.flash || 0, 0, 1));
    this.noiseEl.style.opacity = String(clamp(overlay.noise || 0, 0, 1)); this.plasmaEl.style.opacity = String(clamp(overlay.plasma || 0, 0, 1));
    void gone; void sw; void e;
    const fadeIn = t < 2.5 ? clamp(1 - (t) / 2.5, 0, 1) : 0, fadeOut = gone ? clamp((t - KESTREL_PHASE.crash) / .5, 0, 1) : 0;
    this.fade.style.opacity = String(Math.max(fadeIn, fadeOut));
    if (this.audio) { this.audio.rumble.frequency.value = 40 + 28 * clamp(t / 60, 0, 1) + shake * 10; this.audio.gain.gain.setTargetAtTime(.025 + shake * .02, this.audio.ctx.currentTime, .1);
      const alarm = t > 44 && t < KESTREL_PHASE.crash; this.audio.alarmGain.gain.setTargetAtTime(alarm ? (Math.sin(t * 5) > 0 ? .022 : .002) : 0, this.audio.ctx.currentTime, .05); }
    const script = D.kestrelScript(this.cause, this.worldId), line = script.find((l) => t >= l.t0 && t < l.t1);
    let caption = line ? line.text : '', who = line ? (line.voice === 'w-fenrir' ? 'Corsair' : 'Pilot') : '';
    if (t < 4 && !caption) this.hint.textContent = 'You are aboard the Kestrel. Walk to a window if you like.';
    else if (gone) this.hint.textContent = 'Impact. Hold on, the cabin is going dark.';   // FIX-R2: ten seconds of black with no word on it read as a crash of the page
    // when the clock runs out the authority takes us to the wreck
    if (t >= KESTREL_SECONDS && !this.busy && !this._leaving) { this._leaving = true; this.savePose().then(() => this.command({ type: 'opening-next' })).finally(() => { this._leaving = false; }); }
    return { eye: worldEye.eye, forward: worldEye.forward, up: worldEye.up, caption, who };
  }

  // -- stages 3 to 6: the wreck, the dig, the driver, the ride (the old opening's scenes)
  _frameWreck(dt, input, look) {
    const s = this.state, e = this.engine, m = this.model;
    if (!this.wreckBuilt) this._ensureWreck();
    this.fade.style.opacity = String(clamp(1 - (this.elapsed - (this.fadeFrom ?? -9)) / 3, 0, 1)); this.plasmaEl.style.opacity = '0'; this.flashEl.style.opacity = '0'; this.noiseEl.style.opacity = '0';
    this.cabin.root.position.set(0, WRECK_Y, 0); this.cabin.root.rotation.set(.015, 0, .105);
    this.driver.update(dt); this.counterPerson?.update(dt);
    for (const mat of this.cabinEmitters) mat.color.setScalar(.08);
    this.dust.visible = true; this.dust.material.opacity = .15 + Math.sin(this.elapsed * .1) * .035;
    const motes = this.dust.geometry.attributes.position, seed = this.dust.userData.seed;
    for (let i = 0; i < motes.count; i++) motes.setXYZ(i, seed[i * 3] + Math.sin(this.elapsed * .2 + i) * .14, (seed[i * 3 + 1] + this.elapsed * .04) % 3.3, (seed[i * 3 + 2] + 12 + this.elapsed * .07) % 32 - 12);
    motes.needsUpdate = true;
    this.rover.root.visible = s.stage >= STAGE.CONTACT;
    let eye, forward, up = new THREE.Vector3(0, 1, 0), local = true, caption = '', who = '';
    if (s.stage === STAGE.CONTACT) {
      const t = clamp(this.contactSeconds / CONTACT_SECONDS, 0, 1), ease = 1 - (1 - t) ** 3;
      this.rover.root.position.set(-7 - (1 - ease) * 90, 0, 23 + (1 - ease) * 20); this.rover.root.rotation.y = Math.atan2(-90, 20);
      for (const w of this.rover.wheels) w.rotation.x += dt * (1 - t) * 18; this.rover.update?.(dt, { speed: (1 - t) * 14, night: true });
    }
    this.cabin.root.visible = s.stage <= STAGE.CONTACT || (s.stage === STAGE.TRAVEL && !s.ride && Math.hypot(s.pose.x, s.pose.z) < 90);
    if (this.wreckSay && this.elapsed > this.wreckSayAt && this.wreckSay.length && !(this.lines.until > this.elapsed)) { this.say(this.wreckSay.shift(), 'Ship'); this.wreckSayAt = this.elapsed + 5; }
    if (s.stage === STAGE.WRECK) {
      const sw = this.cabinSw;
      sw.yaw += look.dx; sw.pitch = clamp(sw.pitch - look.dy, -1.4, 1.3);
      sw.tick(dt, { moveX: input.moveEast, moveZ: input.moveNorth, run: input.run, jump: input.jump });
      eye = new THREE.Vector3().copy(sw.eyeLocal()); forward = new THREE.Vector3(Math.sin(sw.yaw) * Math.cos(sw.pitch), Math.sin(sw.pitch), -Math.cos(sw.yaw) * Math.cos(sw.pitch));
      this.cabin.root.updateMatrix(); eye.applyMatrix4(this.cabin.root.matrix); forward.transformDirection(this.cabin.root.matrix); up.transformDirection(this.cabin.root.matrix);
      this.hint.textContent = 'Move: WASD / left thumb · Look: mouse / right thumb';
      const dl = Math.hypot(sw.x - LOCKER.x, sw.z - LOCKER.z);
      if (dl < LOCKER.reach + 1.2) { this.actionLabel = D.LOCKER_PROMPT; this.actionKind = 'locker'; }
      else if (sw.z > 12) { this.actionLabel = 'Climb out (E)'; this.actionKind = 'climb'; }
    } else {
      if (s.stage === STAGE.TRAVEL && s.ride) {
        this.rover.seatPlayer(); this.fade.style.opacity = String(clamp((this.rideSeconds - 64) / 2, 0, 1));
        const rp = ridePose(this.rideSeconds, m.height);
        this.rover.root.rotation.y = THREE.MathUtils.lerp(Math.atan2(-90, 20), Math.atan2(2593, 373), clamp(this.rideSeconds / 6, 0, 1));
        this.rover.root.position.set(rp.x, rideSupportHeight(m, [this.ground,this.far], rp.x,rp.z,this.rover.root.rotation.y), rp.z);
        for (const w of this.rover.wheels) w.rotation.x += dt * 12; this.rover.update?.(dt, { speed: 12, night: true });
        const p = this.rover.root.position; m.place({ ...s.pose, x: p.x, y: p.y, z: p.z });
        eye = new THREE.Vector3().copy(this.rover.passengerEye); this.rover.root.updateMatrix(); eye.applyMatrix4(this.rover.root.matrix);
        this.rideYaw = (this.rideYaw || 0) + look.dx; this.ridePitch = clamp((this.ridePitch || 0) - look.dy, -1, 1);
        forward = new THREE.Vector3(Math.sin(this.rideYaw) * Math.cos(this.ridePitch), Math.sin(this.ridePitch), -Math.cos(this.rideYaw) * Math.cos(this.ridePitch)).transformDirection(this.rover.root.matrix);
        const d = this.driverInfo, rs = this.rideSeconds;
        caption = rs < 4 ? '' : rs < 9 ? '' : rs < 21 ? d.pitch1 : rs < 24 ? '' : rs < 37 ? d.pitch2 : rs > 56 ? d.closing : rs > 50 ? D.NEUTRAL_SETTLEMENT : '';
        if (!caption && rs < 4) caption = d.greeting; who = d.name;
        if (this.counterInfo && rs > 61) { caption = this.counterInfo.line; who = this.counterInfo.name; }
        if (rs >= 66) this.tryFinish();
      } else {
        m.walker.yaw += look.dx; m.walker.pitch = clamp(m.walker.pitch - look.dy, -1.4, 1.3); m.walker.tick(dt, input);
        const p = m.pose();
        if (p.y < 3.9 && p.z > -17 && p.z < 14 && Math.abs(p.x) < 3.6) {      // the exterior pressure hull is solid after leaving its interior walker
          const moves = [{ x: 3.6 - p.x, z: 0 }, { x: -3.6 - p.x, z: 0 }, { x: 0, z: 14 - p.z }, { x: 0, z: -17 - p.z }];
          moves.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)); p.x += moves[0].x; p.z += moves[0].z; m.place(p);
        }
        if (s.stage >= STAGE.CONTACT) {
          const rv = this.rover.root, dx = p.x - rv.position.x, dz = p.z - rv.position.z, c = Math.cos(rv.rotation.y), v = Math.sin(rv.rotation.y), x = c * dx - v * dz, z = v * dx + c * dz;
          if (Math.abs(x) < 1.7 && Math.abs(z) < 2.5) { const moves = [{ x: 1.7 - x, z: 0 }, { x: -1.7 - x, z: 0 }, { x: 0, z: 2.5 - z }, { x: 0, z: -2.5 - z }];
            moves.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)); const d = moves[0]; p.x += c * d.x + v * d.z; p.z += -v * d.x + c * d.z; m.place(p); }
        }
        eye = new THREE.Vector3().copy(m.walker.eyeWorldPos()); forward = new THREE.Vector3().copy(m.digger.lookDir()); up.copy(m.walker.updateFrame().up); local = false;
        this._updateDigMark(false);
        if (s.stage === STAGE.DIG) { const d = Math.hypot(p.x - CRATE.x, p.z - CRATE.z); this.hint.textContent = 'Walk · Look · Use (E / touch)';
          caption = d > 4 ? 'Something lies beneath the collapsed dust.' : m.exposed() ? 'Lift the cleared supply crate.' : 'Aim the shovel at the dust around the crate.';
          if (d < 4) { const ex = m.exposed(); if (ex || d < 2.8) { this.actionLabel = ex ? 'Carry (E)' : 'Dig (E)'; this.actionKind = ex ? 'carry' : 'dig'; } else { this.actionLabel = ''; this.actionKind = null; this.hint.textContent = 'Closer to the crate, then Dig.'; } } this._updateDigMark(this.actionKind === 'dig'); }
        else if (s.stage === STAGE.CONTACT) {
          const d = this.driverInfo, cs = this.contactSeconds;
          caption = cs < 5 ? 'A vehicle is approaching.' : cs < CONTACT_SECONDS ? d.greeting : d.offer; who = cs < 5 ? '' : d.name;
          if (cs >= CONTACT_SECONDS && Math.hypot(p.x + 7, p.z - 23) < 5) { this.actionLabel = 'Ride (E)'; this.actionKind = 'ride'; } }
        else if (s.stage === STAGE.TRAVEL) { this.hint.textContent = D.RIDE_HINT; if (Math.hypot(p.x + 2600, p.z + 350) < 100) this.tryFinish(); }
      }
      if (s.carriedCrate && s.stage === STAGE.TRAVEL && s.ride) { this.crate.position.set(0, 1.62, 1.15).applyMatrix4(this.rover.root.matrix); this.crate.rotation.y = this.rover.root.rotation.y; }
      else if (s.carriedCrate) { this.crate.position.copy(local ? eye : this.localPoint(eye)); const dir = local ? forward : forward.clone().applyQuaternion(this.q.clone().invert()); this.crate.position.addScaledVector(dir, .72); this.crate.position.y -= .65; }
      this.wreckTerrain.update(dt, m.walker.worldPos); this.wreckTerrain.coverOffsetFor(this.ground.worldPos, this.cover);
    }
    if (local) { const wp = m.toWorld(eye.x, eye.y, eye.z); eye = wp; forward.applyQuaternion(this.q); up.applyQuaternion(this.q); }
    else eye = { x: eye.x, y: eye.y, z: eye.z };
    void e;
    return { eye, forward, up, caption, who };
  }
  localPoint(p) { return new THREE.Vector3().copy(this.model.toLocal(p)); }

  /** The opening is over: take the private scene down and hand the player to the world (the server has placed them). */
  finish(pose, frameId) {
    if (!this.active) return; this.active = false; const e = this.engine;
    const transition = document.createElement('div'); transition.className = 'opening-transition';
    transition.style.cssText = 'position:fixed;inset:0;background:#000;pointer-events:none;z-index:101'; document.body.appendChild(transition);
    transition.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1600, easing: 'ease-out', fill: 'forwards' }).finished.then(() => transition.remove());
    e.scene = this.mainScene; e.overlayScenes = this.mainOverlays;
    for (const t of [...e._tracked]) if (!this.beforeTracks.has(t)) e._tracked.delete(t);
    this.boardCtl?.close(); this.noteEl?.remove();
    this.goalHint?.dispose();
    this.look?.dispose(); this.look = null; this.ui.remove(); this.style.remove(); delete document.body.dataset.opening; delete document.body.dataset.openingFilm;
    window.removeEventListener('keydown', this.keyboard); window.removeEventListener('pagehide', this.pageHide);
    document.removeEventListener('visibilitychange', this.visibility); window.removeEventListener('pointerdown', this.audioStart); window.removeEventListener('keydown', this.audioStart);
    if (this.audio) this.audio.ctx.close().catch(() => {});
    // Geometry is ours; material maps and Loft mesh buffers are shared with the main game.
    const borrowed = new Set(); this.scene.traverse((o) => { if (o.isSkinnedMesh) borrowed.add(o.geometry); });
    for (const p of [...(this.linerPeople || []).map((x) => x.person), ...(this.portPeople || []).map((x) => x.person), this.driver, this.counterPerson].filter(Boolean)) p.group.traverse((o) => { if (o.isMesh) borrowed.add(o.geometry); });
    this.portClone.traverse((o) => { if (o.isMesh) borrowed.add(o.geometry); });
    try { this.liner.dispose(); this.kestrel?.dispose(); this.space.dispose(); this.crashFx?.dispose(); } catch (err) { console.warn('opening cleanup', err); }
    this.scene.traverse((o) => { if (o.isMesh || o.isPoints) if (!borrowed.has(o.geometry)) o.geometry?.dispose(); });
    if (this.wreckBuilt) { this.wreckTerrain.cover.tex.dispose(); this.wreckTerrain.material.dispose(); this.model.release(); }
    this.world.state.opening = { ...this.state, complete: true, played: true };
    writeOpeningCheckpoint(this.world, this.world.state.opening);
    try { localStorage.setItem('cosmos-opening-played', '1'); } catch { /* storage may be blocked */ }
    this.onFinish(pose, frameId);
    for (const p of [...(this.linerPeople || []).map((x) => x.person), ...(this.portPeople || []).map((x) => x.person), this.driver, this.counterPerson].filter(Boolean)) { p.mixer?.stopAllAction(); p.group.traverse((o) => {
      for (const mat of (Array.isArray(o.material) ? o.material : [o.material])) if (mat?.userData.lookSrc) mat.dispose(); }); }
    this.scene.clear(); this.ready = null;
    for (const key of ['root', 'cabin', 'liner', 'kestrel', 'space', 'driver', 'rover', 'crate', 'model', 'wreckTerrain', 'ground', 'far', 'portClone', 'portRoot', 'portGround', 'crashFx', 'linerPeople', 'portPeople', 'counterPerson']) this[key] = null;
    void detachBodyEdits;
  }
}
void Y;
