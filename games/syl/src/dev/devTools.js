// ============================================================================
// devTools.js — opt-in editor/god tools for building and testing SYL.
//
// OWNS: deliberate test/editor actions that bypass the survival grind.
// DOES NOT OWN: normal ship-builder rules, save format, or renderer assets.
//
// Mobile law: this starts with code-built state changes and DOM controls. No
// heavy GLB/Blender assets are required for this first slice.
// ============================================================================

import * as THREE from 'three';
import { ITEMS } from '../items/items.js';
import { PART_TYPES, SLOTS } from '../ship/shipParts.js';
import { MODE } from '../world/traversal.js';
import { dominantBody, upAt } from '../world/planet.js';
import * as SaveSystem from '../save/save.js';

const DEV_FLAG = 'syl_dev_tools';
const FLY_BASE_SPEED = 28;
const FLY_FAST_SPEED = 95;

export function devToolsRequested() {
  try {
    const qs = new URLSearchParams(location.search);
    if (qs.get('dev') === '1') {
      localStorage.setItem(DEV_FLAG, '1');
      return true;
    }
    return localStorage.getItem(DEV_FLAG) === '1';
  } catch (e) {
    return false;
  }
}

export function readyShip(ship, options = {}) {
  const includeExperimental = options.includeExperimental === true;
  const safeSlots = new Set([
    'frame_core', 'cockpit_fwd', 'engine_main', 'tank_left', 'tank_right',
    'power_bay', 'cargo_belly', 'hull_top', 'hull_bottom',
    'gear_fl', 'gear_fr', 'gear_rl', 'gear_rr',
  ]);
  for (const slot of SLOTS) {
    if (!includeExperimental && !safeSlots.has(slot.slotId)) continue;
    const part = PART_TYPES[slot.accepts];
    if (!part) continue;
    ship.modules[slot.slotId] = { typeId: slot.accepts, hp: part.maxHp };
  }
  ship.refreshStats();
  ship.fuel = ship.stats.fuelCap;
  ship.landed = true;
  ship.gearDown = true;
  ship.throttle = 0;
  ship.velocity.set(0, 0, 0);
  ship.angVel.set(0, 0, 0);
  ship.rebuildVisual();
  return { ok: true, msg: 'Ready test ship installed and fueled.' };
}

export function giveInventoryKit(inventory, count = 8) {
  for (const item of ITEMS) {
    const n = item.kind === 'part' ? 1 : count;
    inventory.add(item.id, n);
  }
  return { ok: true, msg: 'Added a mobile-safe test kit to inventory.' };
}

export function placeShipNearPlayer(ship, player, bodies, distance = 14) {
  const body = dominantBody(bodies, player.worldPos);
  const up = upAt(body, player.worldPos, new THREE.Vector3());
  const frame = player.localFrame(up);
  const pos = player.worldPos.clone()
    .addScaledVector(frame.fwd, distance)
    .addScaledVector(up, 2.0);
  ship.placeAt(pos, up);
  return { ok: true, msg: 'Moved the test ship in front of you.' };
}

export class DevTools {
  constructor(game, ui, input, bodies) {
    this.game = game;
    this.ui = ui;
    this.input = input;
    this.bodies = bodies;
    this.enabled = devToolsRequested();
    this.flyEnabled = false;
    this.panel = null;
    this.toggle = null;

    input.onPress('F10', () => this.enableAndToggle());
    input.onPress('Backquote', () => {
      if (this.enabled) this.togglePanel();
    });

    if (this.enabled) this.mount();
  }

  enableAndToggle() {
    if (!this.enabled) {
      this.enabled = true;
      try { localStorage.setItem(DEV_FLAG, '1'); } catch (e) {}
      this.mount();
    }
    this.togglePanel();
  }

  mount() {
    if (this.panel) return;
    const root = this.ui.root;
    this.toggle = document.createElement('button');
    this.toggle.className = 'dev-toggle';
    this.toggle.type = 'button';
    this.toggle.textContent = 'DEV';
    this.toggle.addEventListener('click', () => this.togglePanel());
    root.appendChild(this.toggle);

    this.panel = document.createElement('div');
    this.panel.className = 'syl-panel dev-panel';
    this.panel.innerHTML = `
      <button class="panel-close" type="button" aria-label="Close panel">Close</button>
      <h2>DEV EDITOR</h2>
      <div class="body"></div>
      <p class="dim" style="margin-bottom:0">Opt-in test tools. Add <b>?dev=1</b> to the URL on phone.</p>`;
    root.appendChild(this.panel);
    this.panel.querySelector('.panel-close').addEventListener('click', () => this.closePanel());
    this.render();
  }

  anyPanelOpen() { return !!this.panel && this.panel.style.display === 'block'; }
  closePanel() {
    if (this.panel) this.panel.style.display = 'none';
    if (this.toggle) this.toggle.style.display = 'block';
  }
  togglePanel() {
    if (!this.panel) this.mount();
    const opening = !this.anyPanelOpen();
    this.panel.style.display = opening ? 'block' : 'none';
    if (this.toggle) this.toggle.style.display = opening ? 'none' : 'block';
    if (this.anyPanelOpen()) {
      this.ui.closePanels();
      if (document.pointerLockElement) document.exitPointerLock();
      this.render();
    }
  }

  render() {
    if (!this.panel) return;
    const shipReady = this.game.ship.stats.ready ? 'READY' : 'NOT READY';
    const fly = this.flyEnabled ? 'ON' : 'OFF';
    this.panel.querySelector('.body').innerHTML = `
      <div class="dev-grid">
        <button data-dev="ready-here">Ready ship here</button>
        <button data-dev="ready">Ready current ship</button>
        <button data-dev="kit">Give supply kit</button>
        <button data-dev="fuel">Fill fuel</button>
        <button data-dev="fly">Fly person: ${fly}</button>
        <button data-dev="ship-to-me">Move ship to me</button>
        <button data-dev="player-to-ship">Go to ship</button>
        <button data-dev="save">Save now</button>
      </div>
      <p class="dim">Ship ${shipReady} · fuel ${Math.round(this.game.ship.fuel)}/${this.game.ship.stats.fuelCap}</p>
      <p class="dim">Fly person uses WASD, mouse/touch look, Space up, X or Ctrl down, Shift fast. It does not add any heavy assets.</p>`;
    this.panel.querySelectorAll('button[data-dev]').forEach((btn) => {
      btn.addEventListener('click', () => this.run(btn.dataset.dev));
    });
  }

  run(action) {
    let res = { ok: true, msg: 'Done.' };
    if (action === 'ready-here') {
      placeShipNearPlayer(this.game.ship, this.game.player, this.bodies);
      res = readyShip(this.game.ship);
    } else if (action === 'ready') {
      res = readyShip(this.game.ship);
    } else if (action === 'kit') {
      res = giveInventoryKit(this.game.inventory);
    } else if (action === 'fuel') {
      this.game.ship.refreshStats();
      this.game.ship.fuel = this.game.ship.stats.fuelCap;
      res = { ok: true, msg: 'Fuel filled.' };
    } else if (action === 'fly') {
      this.flyEnabled = !this.flyEnabled;
      res = { ok: true, msg: `Fly person ${this.flyEnabled ? 'on' : 'off'}.` };
    } else if (action === 'ship-to-me') {
      res = placeShipNearPlayer(this.game.ship, this.game.player, this.bodies);
    } else if (action === 'player-to-ship') {
      this.game.player.placeAt(this.game.ship.worldPos.clone());
      res = { ok: true, msg: 'Moved player to ship.' };
    } else if (action === 'save') {
      res = SaveSystem.save(this.game);
    }
    this.ui.showToast(res.msg, 2600);
    this.render();
  }

  tick(dt, active) {
    if (!this.flyEnabled || this.game.traversal.mode !== MODE.ON_FOOT) return false;
    if (this.anyPanelOpen()) return true;

    const player = this.game.player;
    const body = dominantBody(this.bodies, player.worldPos);
    const up = upAt(body, player.worldPos, _up);
    player._upSmooth.copy(up);

    if (active) {
      player.yaw += this.input.mouseDX * 0.0023;
      player.pitch += this.input.mouseDY * 0.0023;
      player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch));
    }

    const frame = player.localFrame(up);
    const lookFwd = _look.copy(frame.fwd).applyAxisAngle(frame.right, player.pitch).normalize();
    const move = _move.set(0, 0, 0);
    if (active) {
      if (this.input.down('KeyW')) move.add(lookFwd);
      if (this.input.down('KeyS')) move.sub(lookFwd);
      if (this.input.down('KeyD')) move.add(frame.right);
      if (this.input.down('KeyA')) move.sub(frame.right);
      if (this.input.down('Space')) move.add(up);
      if (this.input.down('KeyX') || this.input.down('ControlLeft') || this.input.down('ControlRight')) move.sub(up);
    }
    if (move.lengthSq() > 0) {
      const speed = this.input.down('ShiftLeft') || this.input.down('ShiftRight') ? FLY_FAST_SPEED : FLY_BASE_SPEED;
      move.normalize().multiplyScalar(speed * dt);
      player.worldPos.add(move);
    }
    player.velocity.set(0, 0, 0);
    player.grounded = false;
    return true;
  }
}

const _up = new THREE.Vector3();
const _move = new THREE.Vector3();
const _look = new THREE.Vector3();
