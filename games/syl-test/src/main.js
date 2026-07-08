// ============================================================================
// main.js — bootstrap + game loop wiring ONLY.
//
// OWNS: system construction order, the per-frame update order, camera views,
//       input->action routing, pickup spawning, and gameplay-loop events
//       (discovery, first launch, landings). NOTHING ELSE.
// DOES NOT OWN: any system's internals. If you are adding logic here that
//       belongs to a system, put it in that system's file instead
//       (fable-survival law: main.js never grows beyond bootstrap + loop).
//
// PER-FRAME ORDER (deliberate):
//   input → player/ship physics → traversal state → camera → interactions →
//   HUD → floating-origin sync (engine) → render.
// ============================================================================

import * as THREE from 'three';
import { Engine, Input } from './core/engine.js';
import { BODIES, getBody } from './world/bodies.js';
import { buildBodyVisual, buildStarfield, zoneWorldPos, upAt, dominantBody } from './world/planet.js';
import { WorldState } from './world/worldState.js';
import { Traversal, MODE, PHASE } from './world/traversal.js';
import { Player } from './player/player.js';
import { Ship } from './ship/ship.js';
import { applyStarterDamage } from './ship/shipBuilder.js';
import { FactionState } from './factions/factions.js';
import { Inventory } from './inventory/inventory.js';
import { getItem } from './items/items.js';
import { UI } from './ui/ui.js';
import { initTouch } from './ui/touch.js';
import { Settings } from './ui/settings.js';
import * as SaveSystem from './save/save.js';
import { PICKUPS } from './world/pickups.js';
import { Multiplayer } from './multiplayer/multiplayer.js';
import { DevTools } from './dev/devTools.js';
import { Tuner } from './dev/tuner.js';
import { CivilTransport } from './world/civilTransport.js';
import { SpaceProps } from './world/spaceProps.js';
import { initLighting, updateLighting } from './render/lighting.js';
import { enableShadows } from './render/props.js';

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
const canvas = document.getElementById('game-canvas');
const engine = new Engine(canvas);
const input = new Input(canvas);

const factionState = new FactionState();
const worldState = new WorldState();
const inventory = new Inventory();
const traversal = new Traversal(BODIES, worldState);

const settings = new Settings();

// World visuals: every body always exists and renders (second-body
// coexistence). Floating origin keeps the numbers safe, not scene swaps.
for (const body of BODIES) {
  const { group } = buildBodyVisual(body, factionState.byId);
  engine.scene.add(group);
  engine.trackWorldObject({ worldPos: body._centerV, object3d: group });
}
const stars = buildStarfield();
stars.material.fog = false; // stars live above any atmosphere
engine.scene.add(stars); // camera-anchored (position 0), rotates with nothing

// Lighting/atmosphere: warm sun + sky bounce + shadows + altitude-reactive
// fog and sky color (render/lighting.js owns the whole mood system).
const lighting = initLighting(engine, settings);

// Space debris / props (visual only, no collision).
const spaceProps = new SpaceProps(engine);

// Player + ship at the Fortis outpost spawn.
const homeBody = getBody('earth');
const spawnZone = homeBody.landingZones.find((z) => z.id === homeBody.spawn.zoneId);
const player = new Player(engine, input, BODIES);
player.placeAt(zoneWorldPos(homeBody, spawnZone, 0.2));
// Face the parked ship (local east — see ship placement below) and tilt the
// view slightly down so the pad/horizon reads immediately on a small planet.
player.yaw = Math.PI / 2;
player.pitch = -0.12;

const ship = new Ship(engine, BODIES);
player.shipRef = ship; // solid hull: the player collides with (and can stand on) the ship
{
  const padDir = spawnZone._dirV.clone();
  const shipPos = zoneWorldPos(homeBody, spawnZone, 1.95);
  // Park the ship ~18 m from the player on the pad.
  shipPos.addScaledVector(new THREE.Vector3(1, 0, 0).cross(padDir).normalize(), 18);
  ship.placeAt(shipPos, upAt(homeBody, shipPos));
  applyStarterDamage(ship);
}

// ---------------------------------------------------------------------------
// Pickups — salvage crates the player gathers (F). Deterministic ids so the
// collected-set in the save stays valid. Placement is data below; adding a
// crate = adding a line. (Future agents: move to a spawner module when
// resource nodes/mining arrive.)
// ---------------------------------------------------------------------------
const pickupEntities = new Map(); // id -> { worldPos, mesh, itemId, trackEntry }
function spawnPickups(collectedSet) {
  for (const p of PICKUPS) {
    if (collectedSet.has(p.id) || pickupEntities.has(p.id)) continue;
    const body = getBody(p.bodyId);
    const zone = body.landingZones.find((z) => z.id === p.zoneId);
    // Offset direction on the sphere, then sit on the analytic ground.
    const up = zone._dirV;
    const east = new THREE.Vector3(0, 1, 0).cross(up);
    if (east.lengthSq() < 1e-6) east.set(1, 0, 0);
    east.normalize();
    const north = up.clone().cross(east).normalize();
    const dir = up.clone()
      .addScaledVector(east, p.east / body.radius)
      .addScaledVector(north, p.north / body.radius).normalize();
    const worldPos = zoneWorldPos(body, { _dirV: dir }, 0.5);

    const item = getItem(p.itemId);
    const color = item.kind === 'fuel' ? 0xff8f00 : item.kind === 'part' ? 0x64b5f6 : 0xa1887f;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.8, 0.8),
      new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.25 })
    );
    engine.scene.add(mesh);
    const trackEntry = engine.trackWorldObject({ worldPos, object3d: mesh });
    pickupEntities.set(p.id, { worldPos, mesh, itemId: p.itemId, trackEntry });
  }
}

function removePickup(id) {
  const e = pickupEntities.get(id);
  if (!e) return;
  engine.untrackWorldObject(e.trackEntry);
  engine.scene.remove(e.mesh);
  pickupEntities.delete(id);
}

// ---------------------------------------------------------------------------
// Civil transport fleet — 3 public passenger transports staggered on the route.
// ---------------------------------------------------------------------------
const civilTransportFleet = [
  new CivilTransport(engine, BODIES, { startStopIndex: 0, phaseOffset: 0 }),
  new CivilTransport(engine, BODIES, { startStopIndex: 2, phaseOffset: 10 }),
  new CivilTransport(engine, BODIES, { startStopIndex: 4, phaseOffset: 20 }),
];
for (const t of civilTransportFleet) t.nudgeIfOverlappingPlayer(player);

// ---------------------------------------------------------------------------
// The `game` composition object — what save.js and ui.js see.
// ---------------------------------------------------------------------------
const game = {
  engine, input, player, ship, civilTransportFleet, inventory, worldState, factionState, traversal,
  settings, spaceProps,
  pickupsCollected: new Set(),
  applyLoadedMode(mode) {
    traversal.mode = mode === 'PILOTING' ? MODE.PILOTING : MODE.ON_FOOT;
    player.setVisible(traversal.mode === MODE.ON_FOOT);
    // Re-sync pickups with the loaded collected-set.
    for (const id of [...pickupEntities.keys()]) {
      if (game.pickupsCollected.has(id)) removePickup(id);
    }
    spawnPickups(game.pickupsCollected);
  },
};

spawnPickups(game.pickupsCollected);
player.civilTransportFleet = civilTransportFleet;
const multiplayer = new Multiplayer({ engine, player, ship, traversal, civilTransportFleet });
const ui = new UI(document.getElementById('ui-root'), game);
const devTools = new DevTools(game, ui, input, BODIES);
const tuner = new Tuner(input, engine); // F8 — Jaron's no-AI-usage tuning panel

// Debug handle for agents/console: inspect any system live (window.game.ship
// etc.). Read-only by convention — mutate through system APIs only.
window.game = game;

// Touch controls (phones/tablets): activates only on touch devices and routes
// through the same Input as the keyboard. See src/ui/touch.js.
const touchActive = initTouch(input, document.getElementById('ui-root'));
if (touchActive) ui.hideHelp();

// ---------------------------------------------------------------------------
// World events → player-facing feedback + faction hooks.
// ---------------------------------------------------------------------------
worldState.on((name, payload) => {
  if (name === 'bodyDiscovered') {
    ui.showToast(`NEW BODY DISCOVERED: <b>${getBody(payload).name}</b>`, 4500);
  }
  if (name === 'zoneDiscovered') {
    for (const body of BODIES) {
      const zone = body.landingZones.find((z) => z.id === payload);
      if (!zone) continue;
      let msg = `ZONE DISCOVERED: <b>${zone.name}</b>`;
      const metFaction = factionState.meet(zone.factionId);
      if (metFaction) {
        factionState.adjustStanding(metFaction.id, 5);
        msg += `<br>Faction contact: <b>${metFaction.name}</b> — ${metFaction.archetype}`;
      }
      if (zone.discovery) {
        inventory.add(zone.discovery.resourceItemId, 3);
        msg += `<br>Recovered 3x ${getItem(zone.discovery.resourceItemId).name}. <i>${zone.discovery.note}</i>`;
      }
      ui.showCenter(msg, 6500);
      SaveSystem.save(game); // discovery is a checkpoint
    }
  }
});

traversal.on((name, payload) => {
  if (name === 'phase') {
    if (payload === PHASE.SPACE && !worldState.flags.launchedOnce) {
      worldState.setFlag('launchedOnce');
      ui.showCenter('YOU ARE IN SPACE.<br><span class="dim">Open M — pick a body, burn toward it, then brake (X) and descend.</span>', 6000);
    }
  }
  if (name === 'enteredShip') ui.showToast(input.touchMode
    ? 'Piloting. Left stick flies · right stick banks/pitches.'
    : 'Piloting. W/S drives · A/D strafes · Q/R bank · ↑/↓ pitch · chase follows nose.', 4500);
});

ship._onCrash = (impact) => {
  ui.showToast(`<span class="bad">HARD IMPACT ${impact.toFixed(0)} m/s — modules damaged. Check the builder (B).</span>`, 5000);
};

// ---------------------------------------------------------------------------
// Input routing (press events; held keys are read inside system ticks).
// ---------------------------------------------------------------------------
input.onPress('KeyE', () => {
  if (ui.anyPanelOpen()) return;
  const carrying = getCarryingTransport();
  if (carrying) {
    if (carrying.disembark(player)) {
      const stop = carrying.currentStop();
      worldState.discoverBody(stop.bodyId);
      worldState.discoverZone(stop.zoneId);
      ui.showToast(`Disembarked at ${stop.label}.`, 2600);
    } else {
      ui.showToast(`In transit to ${carrying.destinationLabel()}. Wait for docking.`, 2400);
    }
    return;
  }
  if (traversal.mode === MODE.ON_FOOT) {
    const boardable = civilTransportFleet.find((t) => t.canBoard(player));
    if (boardable) {
      boardable.board(player);
      ui.showCenter(`BOARDED CIVIL TRANSPORT<br><span class="dim">Next stop: ${boardable.destinationLabel()}. Press E to disembark after docking.</span>`, 4800);
      return;
    }
    if (traversal.canEnterShip(player, ship)) traversal.enterShip(player, ship);
  } else if (traversal.canExitShip(ship)) {
    traversal.exitShip(player, ship);
  } else {
    ui.showToast('Land before leaving the cockpit.', 2000);
  }
});

input.onPress('KeyF', () => {
  if (traversal.mode !== MODE.ON_FOOT || ui.anyPanelOpen()) return;
  for (const [id, e] of pickupEntities) {
    if (player.worldPos.distanceTo(e.worldPos) < 4.5) {
      inventory.add(e.itemId, 1);
      game.pickupsCollected.add(id);
      ui.showToast(`Gathered: <b>${getItem(e.itemId).name}</b>`, 2200);
      removePickup(id);
      break;
    }
  }
});

input.onPress('KeyG', () => {
  if (traversal.mode === MODE.PILOTING && !ship.landed) {
    ship.gearDown = !ship.gearDown;
    ui.showToast(`Landing gear ${ship.gearDown ? 'DOWN' : 'UP'}`, 1500);
  }
});

input.onPress('KeyB', () => {
  if (traversal.mode === MODE.PILOTING || player.worldPos.distanceTo(ship.worldPos) < 12) {
    ui.togglePanel('ship');
  } else {
    ui.showToast('Walk to the ship to use the builder.', 2000);
  }
});
input.onPress('KeyI', () => ui.togglePanel('inv'));
input.onPress('KeyM', () => ui.togglePanel('map'));
input.onPress('KeyO', () => ui.togglePanel('settings'));
input.onPress('KeyH', () => ui.toggleHelp());
input.onPress('Escape', () => ui.closePanels());
input.onPress('KeyC', () => { chaseCam = !chaseCam; });

let shipInteriorView = false;
let transportInteriorView = false;

input.onPress('KeyV', () => {
  if (traversal.mode === MODE.PILOTING) {
    shipInteriorView = !shipInteriorView;
    ui.showToast(shipInteriorView ? 'Interior view' : 'Cockpit view', 1500);
  } else if (getCarryingTransport()) {
    transportInteriorView = !transportInteriorView;
    ui.showToast(transportInteriorView ? 'Transport interior view' : 'Passenger camera view', 1500);
  }
});

input.onPress('KeyT', () => {
  if (traversal.mode === MODE.PILOTING) {
    ship.toggleDoor();
    ui.showToast(`Ship door ${ship.doorOpen ? 'OPEN' : 'CLOSED'}`, 1500);
  } else if (getCarryingTransport()) {
    const t = getCarryingTransport();
    t.toggleDoor();
    ui.showToast(`Transport door ${t.doorOpen ? 'OPEN' : 'CLOSED'}`, 1500);
  }
});

function getCarryingTransport() {
  for (const t of civilTransportFleet) if (t.passenger) return t;
  return null;
}

input.onPress('F5', () => {
  if (getCarryingTransport()) {
    ui.showToast('Wait until the civil transport docks before saving.', 2500);
    return;
  }
  ui.showToast(SaveSystem.save(game).msg, 2000);
});
input.onPress('F9', () => {
  const res = SaveSystem.load(game);
  ui.showToast(res.msg, 2500);
});

// ---------------------------------------------------------------------------
// Camera views.
// ---------------------------------------------------------------------------
let chaseCam = true; // piloting: chase (3rd person) vs cockpit; C toggles
const camPos = new THREE.Vector3(), camQuat = new THREE.Quaternion();
const _cv = new THREE.Vector3(), _cq = new THREE.Quaternion(), _cm = new THREE.Matrix4();
const _shipCamUp = new THREE.Vector3(), _shipCamFwd = new THREE.Vector3(), _shipCamViewUp = new THREE.Vector3(), _shipCamTarget = new THREE.Vector3();
const _refY = new THREE.Vector3(0, 1, 0), _refX = new THREE.Vector3(1, 0, 0);
const _east = new THREE.Vector3(), _north = new THREE.Vector3(), _fwd = new THREE.Vector3(), _right = new THREE.Vector3();
const _tmpV = new THREE.Vector3(), _tmpV2 = new THREE.Vector3(), _zero = new THREE.Vector3();

function updateCamera(dt) {
  const carrying = getCarryingTransport();
  if (carrying) {
    if (transportInteriorView) {
      carrying.interiorCameraPose(camPos, camQuat);
    } else {
      carrying.passengerCameraPose(camPos, camQuat);
    }
  } else if (traversal.mode === MODE.ON_FOOT) {
    player.cameraPose(camPos, camQuat);
  } else if (traversal.mode === MODE.PILOTING && shipInteriorView) {
    // Interior walk view: fixed position inside ship, can look around with mouse.
    _cv.set(0, 0.5, -2).applyQuaternion(ship.quaternion);
    camPos.copy(ship.worldPos).add(_cv);
    // Build look direction from player yaw/pitch in world space.
    const body = dominantBody(BODIES, ship.worldPos);
    const up = upAt(body, ship.worldPos, _shipCamUp);
    const ref = Math.abs(up.y) < 0.95 ? _refY : _refX;
    const east = _east.crossVectors(ref, up).normalize();
    const north = _north.crossVectors(up, east).normalize();
    const fwd = _fwd.copy(north).multiplyScalar(Math.cos(player.yaw))
      .addScaledVector(east, Math.sin(player.yaw)).normalize();
    const right = _right.crossVectors(fwd, up).normalize();
    const lookFwd = _tmpV.copy(fwd).applyAxisAngle(right, player.pitch);
    _cm.lookAt(_zero.set(0, 0, 0), _tmpV2.copy(lookFwd), up);
    camQuat.setFromRotationMatrix(_cm);
  } else {
    // Ship views: offsets in ship space, world math in f64.
    if (chaseCam) {
      // Locked chase rig: follow the ship's real 3D nose, but keep the camera
      // upright to the planet unless the nose is nearly vertical.
      const body = dominantBody(BODIES, ship.worldPos);
      const up = upAt(body, ship.worldPos, _shipCamUp);
      _shipCamFwd.set(0, 0, 1).applyQuaternion(ship.quaternion);
      if (_shipCamFwd.lengthSq() < 1e-6) _shipCamFwd.set(0, 0, 1);
      _shipCamFwd.normalize();
      _shipCamViewUp.copy(up).addScaledVector(_shipCamFwd, -up.dot(_shipCamFwd));
      if (_shipCamViewUp.lengthSq() < 1e-6) {
        _shipCamViewUp.set(0, 1, 0).applyQuaternion(ship.quaternion)
          .addScaledVector(_shipCamFwd, -_shipCamViewUp.dot(_shipCamFwd));
      }
      if (_shipCamViewUp.lengthSq() < 1e-6) _shipCamViewUp.copy(up);
      _shipCamViewUp.normalize();
      camPos.copy(ship.worldPos)
        .addScaledVector(_shipCamFwd, -24)
        .addScaledVector(up, 10);
      _shipCamTarget.copy(ship.worldPos)
        .addScaledVector(_shipCamFwd, 24)
        .addScaledVector(up, 1.4);
      _cm.lookAt(camPos, _shipCamTarget, _shipCamViewUp);
      camQuat.setFromRotationMatrix(_cm);
    } else {
      _cv.set(0, 1.35, 2.1).applyQuaternion(ship.quaternion);
      camPos.copy(ship.worldPos).add(_cv);
      camQuat.copy(ship.quaternion);
      // Cockpit looks forward: ship forward is +Z, camera looks -Z → flip.
      camQuat.multiply(_flipY);
    }
  }
  engine.cameraWorldPos.lerp(camPos, Math.min(1, 14 * dt));
  engine.camera.quaternion.slerp(camQuat, Math.min(1, 14 * dt));
}
const _flipY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

// ---------------------------------------------------------------------------
// Ship pilot controls (read per frame).
// ---------------------------------------------------------------------------
const controls = { pitch: 0, yaw: 0, roll: 0, thrustUp: false, brake: false, mouseSensitivity: settings.get('mouseSens'), touchSensitivity: settings.get('touchSens') };

function readShipControls(dt) {
  // Assisted ship piloting:
  // W/S or stick up/down = forward/reverse movement.
  // A/D or stick left/right = lateral movement.
  // Q/R or right attitude stick X = turn-bank.
  // ArrowUp/ArrowDown or right attitude stick Y = pitch in high flight/space.
  // Camera/look input owns camera rotation separately.
  const touchThrottle = input.touchShipThrottle || 0;
  const keyForward = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
  const assistForward = input.touchMode ? touchThrottle : keyForward;
  ship.throttle = Math.max(0, assistForward);

  const keyRoll = (input.down('KeyR') ? 1 : 0) - (input.down('KeyQ') ? 1 : 0);
  const keyPitch = (input.down('ArrowDown') ? 1 : 0) - (input.down('ArrowUp') ? 1 : 0);
  // Mobile-only attitude authority: the right ATTITUDE stick was too swingy on
  // phone (bank whipped around, nose pitch felt twitchy). These scalars tame the
  // touch attitude inputs ONLY — PC keys (keyRoll/keyPitch) go through the else
  // branch untouched, and the shared rate constants in ship.js are unchanged.
  // Tune these two numbers for phone feel; do not touch ASSIST_*_RATE for PC.
  const MOBILE_BANK_AUTHORITY = 0.35;  // bank/turn swing on phone (lowered from 0.5 — still felt too hard)
  const MOBILE_PITCH_AUTHORITY = 0.55; // nose up/down on phone (was effectively 1.0)
  const shipBank = input.touchMode ? (input.touchShipBank || 0) * MOBILE_BANK_AUTHORITY * controls.touchSensitivity : keyRoll;
  const shipPitch = input.touchMode ? (input.touchShipPitch || 0) * MOBILE_PITCH_AUTHORITY * controls.touchSensitivity : keyPitch;
  const keySide = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
  const assistStrafe = input.touchMode ? (input.touchShipYaw || 0) : keySide;
  const descend = input.down('KeyZ');
  const touchAutoLift = input.touchMode && input.touchJoystickActive && !descend;

  controls.pitch = shipPitch;
  controls.yaw = shipBank * 0.65;
  controls.roll = shipBank;
  controls.thrustUp = input.down('Space') || touchAutoLift;
  controls.descend = descend;
  controls.brake = input.down('KeyX') || input.down('ControlLeft') || input.down('ControlRight');
  controls.assist = true;
  controls.mobileAssist = input.touchMode;
  controls.assistForward = assistForward;
  controls.assistStrafe = assistStrafe;

  // Mobile takeoff assist: if the player is throttling up from the ground, add
  // vertical lift until the hull is safely away from terrain. This prevents the
  // phone controls from scraping the ship into a "hard impact" loop.
  if (ship.landed && !descend && (ship.throttle > 0.12 || controls.brake || touchAutoLift)) {
    controls.thrustUp = true;
  }

  // Takeoff moment: on the ground, ready, thrusting up => leave the surface.
  if (ship.landed && !descend && (controls.thrustUp || Math.abs(assistForward) > 0.12)) {
    if (!ship.stats.ready) {
      ui.showToast('<span class="bad">Ship not flight-ready. Open the builder (B).</span>', 2500);
      ship.throttle = 0;
    } else if (ship.fuel <= 0) {
      ui.showToast('<span class="bad">No fuel. Load hydrazine at the builder (B).</span>', 2500);
      ship.throttle = 0;
    } else {
      ship.landed = false;
      const up = upAt(dominantBody(BODIES, ship.worldPos), ship.worldPos, _cv);
      ship.velocity.addScaledVector(up, 3);
      ship.gearDown = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Zone-discovery check: landing inside a zone's angular radius discovers it.
// ---------------------------------------------------------------------------
function checkZoneDiscovery() {
  if (traversal.mode !== MODE.PILOTING || !ship.landed) return;
  const body = ship.dominant();
  if (!body) return;
  const dir = _cv.subVectors(ship.worldPos, body._centerV).normalize();
  for (const zone of body.landingZones) {
    const ang = Math.acos(Math.min(1, Math.max(-1, dir.dot(zone._dirV))));
    if (ang < zone.angularRadius * 1.4) {
      if (worldState.discoverZone(zone.id) && body.id !== 'earth') {
        worldState.setFlag('landedAway');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Interaction prompt (on foot).
// ---------------------------------------------------------------------------
function updatePrompt() {
  if (ui.anyPanelOpen()) { ui.hidePrompt(); return; }
  const carrying = getCarryingTransport();
  if (carrying) {
    ui.showPrompt(carrying.isDocked()
      ? `E — disembark at ${carrying.currentStop().label}   ·   V — toggle view   ·   T — toggle door`
      : `Riding civil transport → ${carrying.destinationLabel()}   ·   V — toggle view`);
    return;
  }
  if (traversal.mode === MODE.ON_FOOT) {
    const boardable = civilTransportFleet.find((t) => t.canBoard(player));
    if (boardable) {
      ui.showPrompt(`E — board civil transport → ${boardable.destinationLabel()}`);
      return;
    }
    for (const [, e] of pickupEntities) {
      if (player.worldPos.distanceTo(e.worldPos) < 4.5) {
        ui.showPrompt(`F — gather ${getItem(e.itemId).name}`);
        return;
      }
    }
    if (traversal.canEnterShip(player, ship)) { ui.showPrompt('E — board ship   ·   B — ship builder'); return; }
    if (player.worldPos.distanceTo(ship.worldPos) < 12) { ui.showPrompt('B — ship builder'); return; }
  } else if (ship.landed) {
    ui.showPrompt(touchActive
      ? 'E — exit ship   ·   hold stick — take off'
      : 'E — exit ship   ·   Space — take off (if ready)   ·   V — interior view   ·   T — toggle door');
    return;
  } else if (traversal.mode === MODE.PILOTING) {
    ui.showPrompt('V — interior view   ·   T — toggle door');
    return;
  }
  ui.hidePrompt();
}

function discoverCivilStopIfDocked() {
  for (const t of civilTransportFleet) {
    if (t.passenger && t.isDocked()) {
      const stop = t.currentStop();
      if (stop.bodyId !== 'earth') worldState.setFlag('landedAway');
      worldState.discoverBody(stop.bodyId);
      worldState.discoverZone(stop.zoneId);
    }
  }
}

// ---------------------------------------------------------------------------
// Main update registration (order matters — see header).
// ---------------------------------------------------------------------------
let saveTimer = 0;
engine.addUpdater((dt) => {
  updateLighting(lighting, engine, BODIES);
  const panelsOpen = ui.anyPanelOpen() || devTools.anyPanelOpen() || tuner.anyPanelOpen();
  controls.mouseSensitivity = settings.get('mouseSens');
  controls.touchSensitivity = settings.get('touchSens');

  const carrying = getCarryingTransport();
  for (const t of civilTransportFleet) t.tick(dt, player);

  if (carrying) {
    ship.tick(dt, false, null);
    // Allow look-around while passenger (interior or exterior view).
    if (input.lookActive) {
      player.yaw += input.mouseDX * 0.0023 * controls.mouseSensitivity;
      player.pitch += input.mouseDY * 0.0023 * controls.mouseSensitivity;
      player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch));
    }
  } else if (traversal.mode === MODE.PILOTING) {
    if (!panelsOpen) readShipControls(dt);
    ship.tick(dt, !panelsOpen, controls);
    player.worldPos.copy(ship.worldPos); // pilot rides inside
    // Look-around while in interior view or normal cockpit.
    if (input.lookActive) {
      player.yaw += input.mouseDX * 0.0023 * controls.mouseSensitivity;
      player.pitch += input.mouseDY * 0.0023 * controls.mouseSensitivity;
      player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch));
    }
  } else {
    const devFlying = devTools.tick(dt, !panelsOpen && input.lookActive);
    if (!devFlying) {
      player.mouseSensitivity = input.touchMode ? controls.touchSensitivity : controls.mouseSensitivity;
      player.tick(dt, !panelsOpen && input.lookActive);
    }
    ship.tick(dt, false, null);
  }

  if (traversal.phase === PHASE.SPACE) spaceProps.tick(dt);

  traversal.tick(player, ship, { worldPos: engine.cameraWorldPos });
  updateCamera(dt);
  checkZoneDiscovery();
  discoverCivilStopIfDocked();
  updatePrompt();
  ui.refreshHUD();
  multiplayer.update(dt);

  // Autosave every 60 s of play.
  saveTimer += dt;
  if (saveTimer > 60) {
    saveTimer = 0;
    if (!getCarryingTransport()) SaveSystem.save(game);
  }

  input.endFrame();
});

// ---------------------------------------------------------------------------
// Start.
// ---------------------------------------------------------------------------
document.getElementById('boot-msg')?.remove();
if (SaveSystem.hasSave()) {
  ui.showToast('Save found — press F9 to continue, or play fresh.', 6000);
}
ui.showCenter(
  'SYL — FOUNDATION BUILD<br>' +
  '<span class="dim">Your ship is damaged. Gather crates (F), repair and fuel it (B), then fly to another world.<br>' +
  (touchActive
    ? 'Left stick flies · right stick banks/pitches · DESCEND lands. Or board the civil transport at a terminal.</span>'
    : 'Click to take mouse control. H toggles help. Or board the civil transport at a terminal.</span>'), 9000);
engine.start();
