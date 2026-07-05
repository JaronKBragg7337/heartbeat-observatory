// ============================================================================
// desktopMain.js - DESKTOP-tier SYL entry.
//
// OWNS: desktop bootstrap/wiring only. This deliberately coexists with
// src/main.js: the phone-safe public build stays untouched, while desktop.html
// gets larger body scale, richer PBR render presentation, GLB model dressing,
// HDR lighting, shadows, and post-processing on the proven core systems.
// ============================================================================

import * as THREE from 'three';
import { Engine, Input } from './core/engine.js';
import { DESKTOP_BODIES, getDesktopBody } from './desktop/desktopBodies.js';
import { buildDesktopBodyVisual, buildDesktopStarfield } from './desktop/desktopPlanet.js';
import { DesktopAssetLibrary, installDesktopShipVisual } from './desktop/desktopAssets.js';
import { installDesktopLighting } from './desktop/desktopLighting.js';
import { installDesktopPost } from './desktop/desktopPost.js';
import { zoneWorldPos, upAt, dominantBody, altitudeAt } from './world/planet.js';
import { WorldState } from './world/worldState.js';
import { Traversal, MODE, PHASE } from './world/traversal.js';
import { Player } from './player/player.js';
import { Ship } from './ship/ship.js';
import { applyStarterDamage } from './ship/shipBuilder.js';
import { FactionState } from './factions/factions.js';
import { Inventory } from './inventory/inventory.js';
import { getItem } from './items/items.js';
import { UI } from './ui/ui.js';
import * as SaveSystem from './save/save.js';
import { PICKUPS } from './world/pickups.js';
import { DevTools } from './dev/devTools.js';

const canvas = document.getElementById('game-canvas');
const engine = new Engine(canvas, {
  highFidelity: true,
  powerPreference: 'high-performance',
  pixelRatioCap: 2.5,
  exposure: 1.12,
});
const input = new Input(canvas);
const assets = new DesktopAssetLibrary();
assets.preload().catch(() => {});

const factionState = new FactionState();
const worldState = new WorldState(DESKTOP_BODIES);
const inventory = new Inventory();
const traversal = new Traversal(DESKTOP_BODIES, worldState);

for (const body of DESKTOP_BODIES) {
  const { group } = buildDesktopBodyVisual(body, factionState.byId, assets);
  engine.scene.add(group);
  engine.trackWorldObject({ worldPos: body._centerV, object3d: group });
}
const stars = buildDesktopStarfield();
engine.scene.add(stars);
installDesktopLighting(engine);
installDesktopPost(engine);

const homeBody = getDesktopBody('earth');
const spawnZone = homeBody.landingZones.find((z) => z.id === homeBody.spawn.zoneId);
const player = new Player(engine, input, DESKTOP_BODIES);
player.placeAt(zoneWorldPos(homeBody, spawnZone, 0.2));
player.yaw = Math.PI / 2;
player.pitch = -0.1;

const ship = new Ship(engine, DESKTOP_BODIES);
player.shipRef = ship;
{
  const padDir = spawnZone._dirV.clone();
  const shipPos = zoneWorldPos(homeBody, spawnZone, 1.95);
  shipPos.addScaledVector(new THREE.Vector3(1, 0, 0).cross(padDir).normalize(), 22);
  ship.placeAt(shipPos, upAt(homeBody, shipPos));
  applyStarterDamage(ship);
  installDesktopShipVisual(ship, assets);
}

const pickupEntities = new Map();
function spawnPickups(collectedSet) {
  for (const p of PICKUPS) {
    if (collectedSet.has(p.id) || pickupEntities.has(p.id)) continue;
    const body = DESKTOP_BODIES.find((b) => b.id === p.bodyId);
    if (!body) continue;
    const zone = body.landingZones.find((z) => z.id === p.zoneId);
    if (!zone) continue;
    const up = zone._dirV;
    const east = new THREE.Vector3(0, 1, 0).cross(up);
    if (east.lengthSq() < 1e-6) east.set(1, 0, 0);
    east.normalize();
    const north = up.clone().cross(east).normalize();
    const dir = up.clone()
      .addScaledVector(east, p.east / body.radius)
      .addScaledVector(north, p.north / body.radius).normalize();
    const worldPos = zoneWorldPos(body, { _dirV: dir }, 0.7);
    const group = new THREE.Group();
    group.name = `desktop-pickup:${p.id}`;
    engine.scene.add(group);
    assets.instance('prop', { name: `desktop-pickup-model:${p.id}`, scale: 0.68 })
      .then((model) => group.add(model))
      .catch(() => {});
    const trackEntry = engine.trackWorldObject({ worldPos, object3d: group });
    pickupEntities.set(p.id, { worldPos, mesh: group, itemId: p.itemId, trackEntry });
  }
}

function removePickup(id) {
  const e = pickupEntities.get(id);
  if (!e) return;
  engine.untrackWorldObject(e.trackEntry);
  engine.scene.remove(e.mesh);
  pickupEntities.delete(id);
}

const game = {
  saveKey: 'syl_desktop_save',
  engine, input, player, ship, inventory, worldState, factionState, traversal,
  pickupsCollected: new Set(),
  applyLoadedMode(mode) {
    traversal.mode = mode === 'PILOTING' ? MODE.PILOTING : MODE.ON_FOOT;
    player.setVisible(traversal.mode === MODE.ON_FOOT);
    for (const id of [...pickupEntities.keys()]) {
      if (game.pickupsCollected.has(id)) removePickup(id);
    }
    spawnPickups(game.pickupsCollected);
  },
};

spawnPickups(game.pickupsCollected);
const ui = new UI(document.getElementById('ui-root'), game);
const devTools = new DevTools(game, ui, input, DESKTOP_BODIES);
window.game = game;

worldState.on((name, payload) => {
  if (name === 'bodyDiscovered') {
    ui.showToast(`NEW BODY DISCOVERED: <b>${getDesktopBody(payload).name}</b>`, 4500);
  }
  if (name === 'zoneDiscovered') {
    for (const body of DESKTOP_BODIES) {
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
      SaveSystem.save(game);
    }
  }
});

traversal.on((name, payload) => {
  if (name === 'phase' && payload === PHASE.SPACE && !worldState.flags.launchedOnce) {
    worldState.setFlag('launchedOnce');
    ui.showCenter('DESKTOP SPACEFRAME CLEAR.<br><span class="dim">Bigger system scale is active. Use M for the body map and expect longer burns.</span>', 6000);
  }
  if (name === 'enteredShip') {
    ui.showToast('Desktop piloting. W/S forward/reverse · A/D strafe · Q/R bank · arrows pitch · bloom/shadows active.', 4500);
  }
});

ship._onCrash = (impact) => {
  ui.showToast(`<span class="bad">HARD IMPACT ${impact.toFixed(0)} m/s — modules damaged. Check the builder (B).</span>`, 5000);
};

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
    if (player.worldPos.distanceTo(e.worldPos) < 5.5) {
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
  if (traversal.mode === MODE.PILOTING || player.worldPos.distanceTo(ship.worldPos) < 14) ui.togglePanel('ship');
  else ui.showToast('Walk to the ship to use the builder.', 2000);
});
input.onPress('KeyI', () => ui.togglePanel('inv'));
input.onPress('KeyM', () => ui.togglePanel('map'));
input.onPress('KeyH', () => ui.toggleHelp());
input.onPress('Escape', () => ui.closePanels());
input.onPress('KeyC', () => { chaseCam = !chaseCam; });
input.onPress('F5', () => ui.showToast(SaveSystem.save(game).msg, 2000));
input.onPress('F9', () => ui.showToast(SaveSystem.load(game).msg, 2500));

let chaseCam = true;
const camPos = new THREE.Vector3(), camQuat = new THREE.Quaternion();
const _cv = new THREE.Vector3(), _cm = new THREE.Matrix4();
const _shipCamUp = new THREE.Vector3(), _shipCamFwd = new THREE.Vector3();
const _shipCamViewUp = new THREE.Vector3(), _shipCamTarget = new THREE.Vector3();
const _flipY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

function updateCamera(dt) {
  if (traversal.mode === MODE.ON_FOOT) {
    player.cameraPose(camPos, camQuat);
  } else if (chaseCam) {
    const body = dominantBody(DESKTOP_BODIES, ship.worldPos);
    const up = upAt(body, ship.worldPos, _shipCamUp);
    _shipCamFwd.set(0, 0, 1).applyQuaternion(ship.quaternion).normalize();
    _shipCamViewUp.copy(up).addScaledVector(_shipCamFwd, -up.dot(_shipCamFwd));
    if (_shipCamViewUp.lengthSq() < 1e-6) _shipCamViewUp.copy(up);
    _shipCamViewUp.normalize();
    camPos.copy(ship.worldPos)
      .addScaledVector(_shipCamFwd, -36)
      .addScaledVector(up, 15);
    _shipCamTarget.copy(ship.worldPos)
      .addScaledVector(_shipCamFwd, 34)
      .addScaledVector(up, 1.6);
    _cm.lookAt(camPos, _shipCamTarget, _shipCamViewUp);
    camQuat.setFromRotationMatrix(_cm);
  } else {
    _cv.set(0, 1.35, 2.1).applyQuaternion(ship.quaternion);
    camPos.copy(ship.worldPos).add(_cv);
    camQuat.copy(ship.quaternion).multiply(_flipY);
  }
  engine.cameraWorldPos.lerp(camPos, Math.min(1, 12 * dt));
  engine.camera.quaternion.slerp(camQuat, Math.min(1, 12 * dt));
}

const controls = { pitch: 0, yaw: 0, roll: 0, thrustUp: false, brake: false };
function readShipControls() {
  const keyForward = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
  ship.throttle = Math.max(0, keyForward);
  const keyRoll = (input.down('KeyR') ? 1 : 0) - (input.down('KeyQ') ? 1 : 0);
  const keyPitch = (input.down('ArrowDown') ? 1 : 0) - (input.down('ArrowUp') ? 1 : 0);
  const keySide = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
  const descend = input.down('KeyZ');
  controls.pitch = keyPitch;
  controls.yaw = keyRoll * 0.65;
  controls.roll = keyRoll;
  controls.thrustUp = input.down('Space');
  controls.descend = descend;
  controls.brake = input.down('KeyX') || input.down('ControlLeft') || input.down('ControlRight');
  controls.assist = true;
  controls.mobileAssist = false;
  controls.assistForward = keyForward;
  controls.assistStrafe = keySide;
  if (ship.landed && !descend && (controls.thrustUp || Math.abs(keyForward) > 0.12)) {
    if (!ship.stats.ready) {
      ui.showToast('<span class="bad">Ship not flight-ready. Open the builder (B).</span>', 2500);
      ship.throttle = 0;
    } else if (ship.fuel <= 0) {
      ui.showToast('<span class="bad">No fuel. Load fuel at the builder (B).</span>', 2500);
      ship.throttle = 0;
    } else {
      ship.landed = false;
      const up = upAt(dominantBody(DESKTOP_BODIES, ship.worldPos), ship.worldPos, _cv);
      ship.velocity.addScaledVector(up, 3);
      ship.gearDown = true;
    }
  }
}

function checkZoneDiscovery() {
  if (traversal.mode !== MODE.PILOTING || !ship.landed) return;
  const body = ship.dominant();
  if (!body) return;
  const dir = _cv.subVectors(ship.worldPos, body._centerV).normalize();
  for (const zone of body.landingZones) {
    const ang = Math.acos(Math.min(1, Math.max(-1, dir.dot(zone._dirV))));
    if (ang < zone.angularRadius * 1.4 && worldState.discoverZone(zone.id) && body.id !== 'earth') {
      worldState.setFlag('landedAway');
    }
  }
}

function updatePrompt() {
  if (ui.anyPanelOpen()) { ui.hidePrompt(); return; }
  if (traversal.mode === MODE.ON_FOOT) {
    for (const [, e] of pickupEntities) {
      if (player.worldPos.distanceTo(e.worldPos) < 5.5) {
        ui.showPrompt(`F - gather ${getItem(e.itemId).name}`);
        return;
      }
    }
    if (traversal.canEnterShip(player, ship)) { ui.showPrompt('E - board ship   ·   B - ship builder'); return; }
    if (player.worldPos.distanceTo(ship.worldPos) < 14) { ui.showPrompt('B - ship builder'); return; }
  } else if (ship.landed) {
    ui.showPrompt('E - exit ship   ·   Space - take off (if ready)');
    return;
  }
  ui.hidePrompt();
}

function updateSpaceVisibility() {
  const focus = traversal.mode === MODE.PILOTING ? ship.worldPos : player.worldPos;
  const body = dominantBody(DESKTOP_BODIES, focus);
  if (!body?.atmosphere) {
    stars.material.opacity = 0.9;
    return;
  }
  const alt = Math.max(0, altitudeAt(body, focus));
  const t = Math.max(0, Math.min(1, alt / (body.atmosphere.height * 0.9)));
  stars.material.opacity = 0.06 + t * 0.84;
}

let saveTimer = 0;
engine.addUpdater((dt) => {
  const panelsOpen = ui.anyPanelOpen() || devTools.anyPanelOpen();
  if (traversal.mode === MODE.PILOTING) {
    if (!panelsOpen) readShipControls();
    ship.tick(dt, !panelsOpen, controls);
    player.worldPos.copy(ship.worldPos);
  } else {
    const devFlying = devTools.tick(dt, !panelsOpen && input.lookActive);
    if (!devFlying) player.tick(dt, !panelsOpen && input.lookActive);
    ship.tick(dt, false, null);
  }
  traversal.tick(player, ship, { worldPos: engine.cameraWorldPos });
  updateSpaceVisibility();
  updateCamera(dt);
  checkZoneDiscovery();
  updatePrompt();
  ui.refreshHUD();
  saveTimer += dt;
  if (saveTimer > 60) { saveTimer = 0; SaveSystem.save(game); }
  input.endFrame();
});

document.getElementById('boot-msg')?.remove();
if (SaveSystem.hasSave(game)) ui.showToast('Desktop save found - press F9 to continue, or play fresh.', 6000);
ui.showCenter(
  'SYL - DESKTOP FIDELITY BUILD<br>' +
  '<span class="dim">Separate RTX-class route: scaled worlds, PBR terrain, GLB models, shadows, bloom, and the same seamless traversal core.</span>',
  9000
);
engine.start();
