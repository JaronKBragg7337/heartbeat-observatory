// ============================================================================
// engine.js — renderer, frame loop, and the floating origin.
//
// OWNS: the WebGL context, the camera, the per-frame update order, and the
//       rebasing that keeps float32 rendering accurate 3,389 km from a
//       planet's centre.
// DOES NOT OWN: what anything is or where it should be. It draws what it is
//       told, relative to wherever the camera currently is.
//
// THE FLOATING ORIGIN, AND WHY IT IS NOT OPTIONAL
// -----------------------------------------------
// Mars' surface is 3.39e6 metres from its centre. A float32 has ~7 significant
// digits, so at that magnitude the smallest representable step is roughly
// 0.25 m. Vertices snap to a quarter-metre grid, geometry visibly jitters, and
// the camera shakes when you turn your head.
//
// The fix: every gameplay position is a JS number (f64) in body-fixed metres,
// and every frame the renderer subtracts the camera's world position before
// handing anything to the GPU. The camera itself sits at exactly (0,0,0) in
// render space, so the numbers WebGL sees are small and precise regardless of
// where in the solar system the player actually is.
//
// Rule this enforces: a mesh transform is a projection, never storage. If a
// position only exists in `object3d.position`, it is already lost.
// ============================================================================

import * as THREE from 'three';

export class Engine {
  constructor(canvas, opts = {}) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: opts.antialias !== false,
      powerPreference: 'high-performance',
    });
    // Cap DPR: a modern phone can report 3-4x, which quadruples fragment cost
    // for detail no one can resolve. This is a measured budget, not a
    // fidelity opinion — raise it when a real device says it can afford more.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.dprCap || 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();

    // Near plane at 0.1 m so a player can stand close to a wall; far plane far
    // enough to see a planet's limb from orbit. The floating origin is what
    // makes this range survivable.
    this.camera = new THREE.PerspectiveCamera(
      opts.fov || 70,
      window.innerWidth / window.innerHeight,
      0.1,
      2.0e7
    );

    /** Authoritative f64 camera position in body-fixed metres. */
    this.cameraWorldPos = { x: 0, y: 0, z: 0 };

    this._tracked = new Set();
    this._updaters = [];
    this._resizers = [];
    this.timeSec = 0;
    this.running = false;
    this.frameCount = 0;
    this.fps = 0;
    this._fpsAccum = 0;
    this._fpsFrames = 0;

    window.addEventListener('resize', () => this._onResize());
    // iOS fires this on rotate before innerWidth settles; the extra tick is
    // cheap insurance against a one-frame wrong aspect ratio.
    window.addEventListener('orientationchange', () => setTimeout(() => this._onResize(), 120));
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    for (const fn of this._resizers) fn(w, h);
  }

  addUpdater(fn) { this._updaters.push(fn); return fn; }
  onResize(fn) { this._resizers.push(fn); }

  /**
   * Register an object whose real position lives in f64 `worldPos`.
   * The engine re-places its mesh every frame relative to the camera.
   */
  track(entry) { this._tracked.add(entry); return entry; }
  untrack(entry) { this._tracked.delete(entry); }

  /** Convert an f64 world position into current render space. */
  toRender(worldPos, out) {
    out = out || new THREE.Vector3();
    return out.set(
      worldPos.x - this.cameraWorldPos.x,
      worldPos.y - this.cameraWorldPos.y,
      worldPos.z - this.cameraWorldPos.z
    );
  }

  /**
   * One frame. Split out from the rAF loop so it can be driven deterministically
   * by tests and by automated verification — a browser tab that is not focused
   * stops issuing rAF, and a stale frame is worse than no frame.
   */
  step(dt) {
    this.timeSec += dt;
    this.frameCount++;

    for (const fn of this._updaters) fn(dt, this.timeSec);

    // Rebase everything against the camera's f64 position.
    for (const e of this._tracked) {
      if (!e.object3d) continue;
      e.object3d.position.set(
        e.worldPos.x - this.cameraWorldPos.x,
        e.worldPos.y - this.cameraWorldPos.y,
        e.worldPos.z - this.cameraWorldPos.z
      );
      if (e.quaternion) e.object3d.quaternion.copy(e.quaternion);
    }
    this.camera.position.set(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
  }

  start() {
    this.running = true;
    let last = performance.now();
    const loop = () => {
      if (!this.running) return;
      const now = performance.now();
      // Clamp dt so a backgrounded tab cannot resume with a one-second
      // physics step and fling the player through the planet.
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      this._fpsAccum += dt; this._fpsFrames++;
      if (this._fpsAccum >= 0.5) {
        this.fps = this._fpsFrames / this._fpsAccum;
        this._fpsAccum = 0; this._fpsFrames = 0;
      }

      this.step(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() { this.running = false; }
}
