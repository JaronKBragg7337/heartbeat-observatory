// ============================================================================
// engine.js — renderer, scene graph, camera rig, game loop, FLOATING ORIGIN.
//
// OWNS: WebGL renderer, THREE.Scene, the render camera, the frame loop, and
//       the floating-origin (camera-relative rendering) system.
// DOES NOT OWN: game logic, physics, world data, UI. Systems register update
//       callbacks; the engine only calls them and draws.
//
// FLOATING ORIGIN — THE MOST IMPORTANT IDEA IN THIS FILE (Kurearthis truth):
//   GPU vertex math is float32. At planetary distances (hundreds of km) f32
//   jitters and physics engines break. Proven fix: keep ALL authoritative
//   positions in float64 "world space" (plain JS numbers ARE f64), and every
//   frame place rendered meshes at (worldPos - cameraWorldPos), with the
//   render camera pinned at (0,0,0). The active region around the player is
//   therefore always numerically tiny and precise, no matter how far they fly.
//
//   RULES FOR FUTURE AGENTS:
//   1. NEVER store gameplay positions in mesh.position. Meshes are visuals.
//      Authoritative positions live on entities as THREE.Vector3 (f64 numbers)
//      in world space, and are copied in via syncToCamera() each frame.
//   2. NEVER hand a giant world-space coordinate to the renderer.
//   3. All physics is our own double-precision integration (see player/ship).
//      There is deliberately NO physics engine (Kurearthis proof 2b/2d: stock
//      engine forces are unusable at planetary coordinates).
//
// If Unreal agents port this: this file == FloatingOriginManager + game loop.
// ============================================================================

import * as THREE from 'three';

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000005);

    // Render camera is PINNED at the origin. It only rotates.
    // cameraWorldPos is the authoritative f64 position of the viewpoint.
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 500000);
    this.cameraWorldPos = new THREE.Vector3(0, 0, 0);

    // Entities that need world->camera-relative sync each frame.
    // Each entry: { worldPos: THREE.Vector3, object3d: THREE.Object3D, quaternion?: THREE.Quaternion }
    this._synced = new Set();

    // Update callbacks: fn(dt, timeSec). Order matters; register in main.js.
    this._updaters = [];

    this._last = performance.now();
    this.timeSec = 0;
    this.running = false;

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // Register a system update callback, called every frame with (dt, time).
  addUpdater(fn) { this._updaters.push(fn); }

  // Register an object for floating-origin sync. worldPos is a live reference:
  // move the entity by mutating worldPos; the engine re-places the mesh.
  trackWorldObject(entry) { this._synced.add(entry); return entry; }
  untrackWorldObject(entry) { this._synced.delete(entry); }

  // Convert a world-space position to the current camera-relative render space.
  worldToRender(worldPos, out) {
    out = out || new THREE.Vector3();
    return out.subVectors(worldPos, this.cameraWorldPos);
  }

  start() {
    this.running = true;
    this._last = performance.now();
    const loop = () => {
      if (!this.running) return;
      const now = performance.now();
      // Clamp dt: tab-switch pauses must not produce huge physics steps.
      const dt = Math.min((now - this._last) / 1000, 0.05);
      this._last = now;
      this.timeSec += dt;

      for (const fn of this._updaters) fn(dt, this.timeSec);

      // Floating-origin sync: place every tracked mesh camera-relative and,
      // when supplied, copy the authoritative simulation rotation into the visual.
      for (const e of this._synced) {
        e.object3d.position.subVectors(e.worldPos, this.cameraWorldPos);
        if (e.quaternion) e.object3d.quaternion.copy(e.quaternion);
      }
      this.camera.position.set(0, 0, 0);

      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

// ---------------------------------------------------------------------------
// Input — one tiny keyboard/mouse state holder shared by player + ship.
// OWNS: raw input state. DOES NOT OWN: what keys mean (systems decide that).
// ---------------------------------------------------------------------------
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.virtualKeys = new Set(); // touch-driven "keys" (src/ui/touch.js)
    this.virtualKeySources = new Map(); // code -> Set(source), so buttons and sticks don't fight
    this.touchMode = false;       // true once touch controls are active
    this.touchShipYaw = 0;        // analog ship steering from touch joystick
    this.touchShipPitch = 0;
    this.touchShipThrottle = 0;
    this.touchJoystickActive = false;
    this.touchLookActive = false;
    this.mouseDX = 0; this.mouseDY = 0;
    this.pointerLocked = false;
    this._pressListeners = new Map(); // code -> [fns] fired once on keydown

    window.addEventListener('keydown', (e) => {
      // Keep game keys from triggering browser actions (F5 refresh, etc.).
      if (e.code === 'F5' || e.code === 'F9' || e.code === 'Tab') e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      const fns = this._pressListeners.get(e.code);
      if (fns) for (const f of fns) f(e);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.virtualKeys.clear();
      this.virtualKeySources.clear();
      this.touchShipYaw = 0;
      this.touchShipPitch = 0;
      this.touchShipThrottle = 0;
      this.touchJoystickActive = false;
      this.touchLookActive = false;
    });

    canvas.addEventListener('click', () => {
      if (!this.pointerLocked) canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
    });
  }
  down(code) { return this.keys.has(code) || this.virtualKeys.has(code); }

  // Touch layer: press/release a virtual key. Press fires onPress listeners
  // exactly like a physical keydown, so all bindings work untouched.
  setVirtual(code, on, source = 'default') {
    if (!this.virtualKeySources.has(code)) this.virtualKeySources.set(code, new Set());
    const sources = this.virtualKeySources.get(code);
    if (on) {
      const wasDown = this.virtualKeys.has(code);
      sources.add(source);
      if (!wasDown) {
        this.virtualKeys.add(code);
        const fns = this._pressListeners.get(code);
        if (fns) for (const f of fns) f({ code, virtual: true });
      }
    } else {
      sources.delete(source);
      if (sources.size === 0) {
        this.virtualKeySources.delete(code);
        this.virtualKeys.delete(code);
      }
    }
  }

  // Whether look/movement input should be honored (mouse capture or touch).
  get lookActive() { return this.pointerLocked || this.touchMode; }

  onPress(code, fn) {
    if (!this._pressListeners.has(code)) this._pressListeners.set(code, []);
    this._pressListeners.get(code).push(fn);
  }
  // Call once per frame AFTER consumers read mouseDX/DY.
  endFrame() { this.mouseDX = 0; this.mouseDY = 0; }
}
