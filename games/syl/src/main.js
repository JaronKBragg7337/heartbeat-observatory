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
import * as SaveSystem from './save/save.js';
import { PICKUPS } from './world/pickups.js';
import { Multiplayer } from './multiplayer/multiplayer.js';
import { DevTools } from './dev/devTools.js';

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

// World visuals: every body always exists and renders (second-body
// coexistence). Floating origin keeps the numbers safe, not scene swaps.
for (const body of BODIES) {
  const { group } = buildBodyVisual(body, factionState.byId);
  engine.scene.add(group);
  engine.trackWorldObject({ worldPos: body._centerV, object3d: group });
}
const stars = buildStarfield();
engine.scene.add(stars); // camera-anchored (position 0), rotates with nothing

// Lighting: one sun + gentle fill.
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(1, 0.6, 0.3);
engine.scene.add(sun, new THREE.AmbientLight(0x445566, 0.5));

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
// The `game` composition object — what save.js and ui.js see.
// ---------------------------------------------------------------------------
const game = {
  engine, input, player, ship, inventory, worldState, factionState, traversal,
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
const multiplayer = new Multiplayer({ engine, player, ship, traversal });
const ui = new UI(document.getElementById('ui-root'), game);
const devTools = new DevTools(game, ui, input, BODIES);

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
    ? 'Piloting. Hold stick to lift/drive · BANK turns · DESCEND lands · right drag looks.'
    : 'Piloting. W/S drives · A/D strafes · Q/R turn-bank · Z descend · mouse looks.', 4500);
});

ship._onCrash = (impact) => {
  ui.showToast(`<span class="bad">HARD IMPACT ${impact.toFixed(0)} m/s — modules damaged. Check the builder (B).</span>`, 5000);
};

// ---------------------------------------------------------------------------
// Input routing (press events; held keys are read inside system ticks).
// ---------------------------------------------------------------------------
input.onPress('KeyE', () => {
  if (ui.anyPanelOpen()) return;
  if (traversal.mode === MODE.ON_FOOT) {
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
input.onPress('KeyH', () => ui.toggleHelp());
input.onPress('Escape', () => ui.closePanels());
input.onPress('KeyC', () => { chaseCam = !chaseCam; });

input.onPress('F5', () => ui.showToast(SaveSystem.save(game).msg, 2000));
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
let shipTouchCamYaw = 0, shipTouchCamPitch = 0;
let shipCamBaseReady = false;
const shipCamBaseQuat = new THREE.Quaternion();

function updateCamera(dt) {
  if (traversal.mode === MODE.ON_FOOT) {
    shipCamBaseReady = false;
    player.cameraPose(camPos, camQuat);
  } else {
    // Ship views: offsets in ship space, world math in f64.
    if (chaseCam) {
      // Control-isolated chase camera: movement/drive input must never rotate
      // the camera. The camera base is captured when entering the ship; only
      // explicit look input (mouse/right-side touch/arrows) changes the orbit.
      _cv.set(0, 4.5, -15);
      if (!shipCamBaseReady) {
        shipCamBaseQuat.copy(ship.quaternion);
        shipCamBaseReady = true;
      }
      const shipTurnInput = input.down('KeyQ') || input.down('KeyR');
      if (shipTurnInput) {
        shipCamBaseQuat.slerp(ship.quaternion, Math.min(1, 2.2 * dt));
      }
      const looking = input.touchMode
        ? (input.touchLookActive && !input.touchJoystickActive)
        : (input.pointerLocked && Math.abs(input.mouseDX) + Math.abs(input.mouseDY) > 0);
      const arrowYaw = (input.down('ArrowRight') ? 1 : 0) - (input.down('ArrowLeft') ? 1 : 0);
      const arrowPitch = (input.down('ArrowDown') ? 1 : 0) - (input.down('ArrowUp') ? 1 : 0);
      const arrowLooking = arrowYaw !== 0 || arrowPitch !== 0;

      if (looking) {
        shipTouchCamYaw -= input.mouseDX * 0.003;
        shipTouchCamPitch = Math.max(-0.75, Math.min(0.55, shipTouchCamPitch - input.mouseDY * 0.003));
      }

      if (arrowLooking) {
        shipTouchCamYaw += arrowYaw * 1.8 * dt;
        shipTouchCamPitch = Math.max(-0.75, Math.min(0.55, shipTouchCamPitch + arrowPitch * 1.2 * dt));
      }

      _cv.applyAxisAngle(_touchCamX, shipTouchCamPitch);
      _cv.applyAxisAngle(_touchCamY, shipTouchCamYaw);
      _cv.applyQuaternion(shipCamBaseQuat);
      camPos.copy(ship.worldPos).add(_cv);
      _cm.lookAt(camPos, ship.worldPos, _cq2v.set(0, 1, 0).applyQuaternion(shipCamBaseQuat));
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
const _cq2v = new THREE.Vector3();
const _touchCamX = new THREE.Vector3(1, 0, 0);
const _touchCamY = new THREE.Vector3(0, 1, 0);
const _flipY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

// ---------------------------------------------------------------------------
// Ship pilot controls (read per frame).
// ---------------------------------------------------------------------------
const controls = { pitch: 0, yaw: 0, roll: 0, thrustUp: false, brake: false };

function readShipControls(dt) {
  // Assisted ship piloting:
  // W/S or stick up/down = forward/reverse movement.
  // A/D or stick left/right = lateral movement.
  // Q/R or BANK buttons = turn-bank.
  // Camera/look input owns camera rotation separately.
  const touchThrottle = input.touchShipThrottle || 0;
  const keyForward = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
  const assistForward = input.touchMode ? touchThrottle : keyForward;
  ship.throttle = Math.max(0, assistForward);

  const keyRoll = (input.down('KeyR') ? 1 : 0) - (input.down('KeyQ') ? 1 : 0);
  const keySide = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
  const assistStrafe = input.touchMode ? (input.touchShipYaw || 0) : keySide;
  const descend = input.down('KeyZ');
  const touchAutoLift = input.touchMode && input.touchJoystickActive && !descend;

  controls.pitch = 0;
  controls.yaw = keyRoll * 0.65;
  controls.roll = keyRoll;
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
  if (traversal.mode === MODE.ON_FOOT) {
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
      : 'E — exit ship   ·   Space — take off (if ready)');
    return;
  }
  ui.hidePrompt();
}

// ---------------------------------------------------------------------------
// Main update registration (order matters — see header).
// ---------------------------------------------------------------------------
let saveTimer = 0;
engine.addUpdater((dt) => {
  const panelsOpen = ui.anyPanelOpen() || devTools.anyPanelOpen();
  if (traversal.mode === MODE.PILOTING) {
    if (!panelsOpen) readShipControls(dt);
    ship.tick(dt, !panelsOpen, controls);
    player.worldPos.copy(ship.worldPos); // pilot rides inside
    player.tickPassive?.();
  } else {
    const devFlying = devTools.tick(dt, !panelsOpen && input.lookActive);
    if (!devFlying) player.tick(dt, !panelsOpen && input.lookActive);
    ship.tick(dt, false, null);
  }

  traversal.tick(player, ship, { worldPos: engine.cameraWorldPos });
  updateCamera(dt);
  checkZoneDiscovery();
  updatePrompt();
  ui.refreshHUD();
  multiplayer.update(dt);

  // Autosave every 60 s of play.
  saveTimer += dt;
  if (saveTimer > 60) { saveTimer = 0; SaveSystem.save(game); }

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
    ? 'Hold stick to lift/drive · BANK turns · DESCEND lands · drag to look.</span>'
    : 'Click to take mouse control. H toggles help.</span>'), 9000);
engine.start();
