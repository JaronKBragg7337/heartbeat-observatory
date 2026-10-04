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
import { GraphicsHealth } from './graphicsHealth.js';
import { safeMaterials } from './safeMaterials.js';
import { makeFrame, setFrameState, framePoint, frameDir, frameVel } from './frameMath.js';
const _Y = new THREE.Vector3(0, 1, 0);

export class Engine {
  constructor(canvas, opts = {}) {
    const params=new URLSearchParams(location.search);
    this.safe=params.get('tier')==='safe';this.dprCap=this.safe?1:(opts.dprCap||2);this.safeCache=new Map();
    window.addEventListener('error',e=>{if(/webgl|shader|out of memory|allocation failed/i.test(e.message||''))this.graphics.problem('Graphics initialization failed: '+e.message.slice(0,200));});
    this.graphics=new GraphicsHealth(this.safe?'safe':params.get('tier')||('ontouchstart' in window?'low':'high'));
    if(opts.world)this.graphics.bindWorld(opts.world);
    canvas.addEventListener('webglcontextcreationerror',e=>this.graphics.problem('WebGL context creation: '+(e.statusMessage||'unavailable')));
    const webgl1=this.safe||params.get('webgl')==='1';
    try { const context=webgl1?canvas.getContext('webgl',{alpha:false,antialias:false,stencil:false}):undefined;
    if(webgl1&&!context)throw Error('WebGL1 context unavailable');
    this.renderer = new THREE.WebGLRenderer({
      ...(context?{context}:{}),
      canvas,
      antialias: !this.safe && opts.antialias !== false,
      powerPreference: 'high-performance',
      // Ask for a stencil too: some phones give a bare 16-bit depth buffer when none is requested, and give a
      // 24-bit depth+stencil one when it is. (Surfaces a centimetre apart fight in 16 bits.)
      stencil: !this.safe,
      // Metre-scale surfaces and a 160 km horizon cannot share linear 24-bit depth
      // with a 0.1 m near plane: at 20 km its steps are hundreds of metres.
      logarithmicDepthBuffer: !this.safe && params.get('logdepth')!=='0',
    }); } catch(e) {this.graphics.problem('WebGL renderer creation failed: '+String(e.message||e).slice(0,200));throw e;}
    this.graphics.attach(this,this.renderer.getContext());
    // Cap DPR: a modern phone can report 3-4x, which quadruples fragment cost
    // for detail no one can resolve. This is a measured budget, not a
    // fidelity opinion — raise it when a real device says it can afford more.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.dprCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = !this.safe && params.get('shadows')!=='0';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();

    // Near plane at 0.1 m so a player can stand close to a wall; far plane far
    // enough to see a planet's limb from orbit. The floating origin is what
    // makes this range survivable.
    this.camera = new THREE.PerspectiveCamera(
      opts.fov || 70,
      window.innerWidth / window.innerHeight,
      0.1,
      // Far enough for the Sun and Deimos (23,463 km out) as well as Mars's own limb. Logarithmic depth makes the
      // ratio free: precision is relative, so 0.1 m up close and 1e9 m away both resolve.
      this.safe ? 2000 : Number(params.get('far')) || 1.0e13
    );

    /** Authoritative f64 camera position in the ACTIVE FRAME's metres (see "frames" below). */
    this.cameraWorldPos = { x: 0, y: 0, z: 0 };

    // FRAMES. Everything has always lived in Mars's body-fixed frame. A moon you can land on has its own
    // body-fixed frame (its field, its walker, its digging all take coordinates with the moon's centre at the origin), and
    // frames are translated copies of each other (no rotation: their axes are parallel). One frame is ACTIVE: the camera,
    // the ship, the walker and everything that rides with them (`followActive`) are expressed in it. Anything else
    // (Mars's ground, the port) belongs to the root frame, or to the frame it names with `frame`, and is drawn at
    // worldPos + frame.origin - activeFrame.origin - cameraWorldPos. With the root frame active that is the formula it
    // always was.
    // F2: a moving moon's frame is Mars's turning axes translated to its centre and turned about +Y by `yaw`; it carries `vel` and
    // `yawRate` (in the root's axes) so a ship can be carried across with its velocity. Change a frame only with setFrameState().
    this.rootFrame = makeFrame('mars');
    this.activeFrame = this.rootFrame;

    // Extra scenes drawn after the main one, into the SAME depth buffer, with the
    // same camera. The ship's interior is one: it needs its own lights (no sun
    // reaches inside a hull), and this is the only way three.js lets an object
    // ignore the world's lights. See src/ship/shipSystem.js.
    this.overlayScenes = [];

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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.dprCap));
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

  /** Convert an f64 world position (in the active frame) into current render space. */
  toRender(worldPos, out) {
    out = out || new THREE.Vector3();
    return out.set(
      worldPos.x - this.cameraWorldPos.x,
      worldPos.y - this.cameraWorldPos.y,
      worldPos.z - this.cameraWorldPos.z
    );
  }

  /**
   * Make `frame` the active one. The camera keeps its place in space: its coordinates are re-expressed. Callers that hold
   * positions in the active frame (the ship, the walker) translate them with `frameShift`.
   */
  setActiveFrame(frame) {
    if (frame === this.activeFrame) return;
    this.framePoint(this.activeFrame, frame, this.cameraWorldPos, this.cameraWorldPos);
    this.activeFrame = frame;
  }

  /** Give a frame its motion: k = { c: centre, v: velocity, yaw, yawRate } in the ROOT frame's axes (space/frames.js worldKin). */
  setFrameState(frame, k) { return setFrameState(frame, k); }
  /** What to ADD to a position in frame `from` to express it in frame `to` WHEN THE TWO ARE NOT TURNED RELATIVE TO EACH OTHER (use framePoint otherwise). */
  frameShift(from, to, out = {}) {
    out.x = from.origin.x - to.origin.x; out.y = from.origin.y - to.origin.y; out.z = from.origin.z - to.origin.z;
    return out;
  }
  framePoint(from, to, p, out) { return framePoint(from, to, p, out); }
  frameDir(from, to, v, out) { return frameDir(from, to, v, out); }
  frameVel(from, to, p, v, out) { return frameVel(from, to, p, v, out); }

  /** The camera in another frame's coordinates (f64). */
  cameraIn(frame, out = {}) { return this.framePoint(this.activeFrame, frame, this.cameraWorldPos, out); }

  /** The placement of frame F in the active frame AF's axes for this step (cached per step): the origin's position, and the turn between them. */
  _xf(F, AF) {
    if (F._xfAt === this.frameCount && F._xfFor === AF) return F._xf;
    const t = this.framePoint(F, AF, { x: 0, y: 0, z: 0 }), d = F.yaw - AF.yaw, xf = F._xf || (F._xf = { q: new THREE.Quaternion() });
    xf.tx = t.x; xf.ty = t.y; xf.tz = t.z; xf.c = Math.cos(d); xf.s = Math.sin(d);
    xf.q.setFromAxisAngle(_Y, d);
    F._xfAt = this.frameCount; F._xfFor = AF;
    return xf;
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

    // Rebase everything against the camera's f64 position. An entry that rides with the player (`followActive`)
    // is in the active frame; one that names a `frame` is in that; the rest are in the root (Mars) frame.
    const AF = this.activeFrame, A = AF.origin, cam = this.cameraWorldPos;
    for (const e of this._tracked) {
      if (!e.object3d) continue;
      const F = e.followActive ? AF : (e.frame || this.rootFrame), q = e.object3d.quaternion;
      if (F === AF || (F.yaw === AF.yaw && F.yaw === 0)) {
        const o = F.origin;
        e.object3d.position.set(e.worldPos.x + o.x - A.x - cam.x, e.worldPos.y + o.y - A.y - cam.y, e.worldPos.z + o.z - A.z - cam.z);
        if (e._wq) { if (q.equals(e._wq)) q.copy(e.quaternion || e._bq); e._wq = null; }      // it was turned for another frame: put its own orientation back
        if (e.quaternion) q.copy(e.quaternion);
        continue;
      }
      // a frame turned relative to the active one (a moon's, seen from Mars; Mars's, seen from a moon): translate, turn the position about +Y and turn the object with it
      const xf = this._xf(F, AF);
      const wx = e.worldPos.x, wz = e.worldPos.z;
      e.object3d.position.set(xf.tx + wx * xf.c + wz * xf.s - cam.x, xf.ty + e.worldPos.y - cam.y, xf.tz - wx * xf.s + wz * xf.c - cam.z);
      let base = e.quaternion;
      if (!base) { if (!e._wq || !q.equals(e._wq)) e._bq = (e._bq || new THREE.Quaternion()).copy(q); base = e._bq; }
      q.copy(base).premultiply(xf.q);
      (e._wq || (e._wq = new THREE.Quaternion())).copy(q);
    }
    this.camera.position.set(0, 0, 0);

    if(this.safe){safeMaterials(this.scene,this.safeCache);for(const sc of this.overlayScenes)safeMaterials(sc,this.safeCache);}
    const renderFrame=this.renderer.info.render.frame;
    try {
    // A film pass (cinematic mode) draws the scene itself, overlays included.
    // Left unset, this is the same draw the graphics probe has always measured.
    if (typeof this.present === 'function') this.present(this);
    else this.renderer.render(this.scene, this.camera);
    const drewWorld=this.renderer.info.render.frame!==renderFrame;
    // Overlay renders change GL's clear-color state even with autoClear off.
    // Remember the world's clear color before they do, for the frame probe.
    if(drewWorld&&typeof this.present!=='function'&&this.graphics.checked<90&&(this.graphics.checked+1)%10===0){const gl=this.renderer.getContext();this.graphics.clearColor=Array.from(gl.getParameter(gl.COLOR_CLEAR_VALUE));}
    if (typeof this.present !== 'function' && this.overlayScenes.length) {
      const r = this.renderer;
      r.autoClear = false;
      for (const sc of this.overlayScenes) r.render(sc, this.camera);
      r.autoClear = true;
    }
    // Deterministic physics harnesses can replace render() with a no-op. An
    // intentionally undrawn frame must not count as a failed GPU frame.
    if(drewWorld)this.graphics.afterFrame();
    } catch(e) { this.renderer.autoClear=true;this.graphics.problem('Render failed: '+String(e.message||e).slice(0,200)); }
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
