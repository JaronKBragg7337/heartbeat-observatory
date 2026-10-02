// ============================================================================
// cinema/cinema.js — cinematic mode. Hides the HUD, letterboxes 2.39:1, and
// plays a saved camera path over the live world.
//
// The game keeps simulating. This only owns the camera, and only while a shot
// is playing. Escape opens Settings so the toggle can be turned off.
// ============================================================================

import * as THREE from 'three';
import { letterbox, sampleShot, parseShot, postAllowed, FILM_ASPECT } from './math.js';
import { FilmPresent } from './present.js';

export class Cinema {
  constructor({ engine, tier, safe, search }) {
    this.engine = engine;
    this.tier = tier;
    this.safe = !!safe;
    this.enabled = false;
    this.letterboxOn = false;
    this.playing = false;
    this.finished = false;
    this.shot = null;
    this.time = 0;
    this.baseFov = engine.camera.fov;
    this.hooks = { pre() {}, after() {} };
    this.driver = null;
    this._look = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this.bars = { top: null, bottom: null, left: null, right: null };
    this._ensureBars();
    this.post = null;
    this._presentFn = (engine) => {
      try { this.post.render(engine); }
      catch (e) {
        console.warn('Film post failed; drawing the frame plain', e);
        this.post.enabled = false;
        this.engine.present = null;
        engine.renderer.setRenderTarget(null);
        engine.renderer.autoClear = true;
        engine.renderer.render(engine.scene, engine.camera);
        if (engine.overlayScenes.length) {
          engine.renderer.autoClear = false;
          for (const sc of engine.overlayScenes) engine.renderer.render(sc, engine.camera);
          engine.renderer.autoClear = true;
        }
      }
    };
    const q = search || new URLSearchParams(location.search);
    if (postAllowed({ tier, safe }) && q.get('post') !== '0') {
      try { this.post = new FilmPresent(engine); }
      catch (e) { console.warn('Film post unavailable', e); this.post = null; }
    }
    if (q.get('cinema') === '1') this.setEnabled(true);
    if (q.get('letterbox') === '1' || (q.get('cinema') === '1' && q.get('letterbox') !== '0')) this.setLetterbox(true);
    this.engine.onResize(() => this._layoutBars());
    this._usePost(false);
  }

  /** The film pass replaces Engine's draw only while a shot asks for it. */
  _usePost(on) {
    this.engine.present = on && this.post ? this._presentFn : null;
    if (this.post) this.post.enabled = !!on;
  }

  _ensureBars() {
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      const el = document.createElement('div');
      el.className = 'letterbox';
      el.id = 'letterbox-' + edge;
      const side = edge === 'left' || edge === 'right';
      el.style.cssText = 'position:fixed;background:#000;z-index:40;pointer-events:none;display:none;'
        + (side ? edge + ':0;top:0;bottom:0;width:0;' : edge + ':0;left:0;right:0;height:0;');
      document.body.appendChild(el);
      this.bars[edge] = el;
    }
  }

  _layoutBars() {
    const on = this.letterboxOn;
    const box = letterbox(window.innerWidth, window.innerHeight, FILM_ASPECT);
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      const el = this.bars[edge];
      const size = Math.max(0, box[edge]);
      el.style.display = on && size > 0.5 ? 'block' : 'none';
      if (edge === 'left' || edge === 'right') el.style.width = size + 'px';
      else el.style.height = size + 'px';
    }
  }

  setEnabled(on) {
    this.enabled = !!on;
    document.documentElement.classList.toggle('cinema-on', this.enabled);
    if (!this.enabled) {
      this.playing = false;
      this.driver = null;
      this.engine.camera.fov = this.baseFov;
      this.engine.camera.updateProjectionMatrix();
      this._usePost(false);
      if (this.stageApi) this.stageApi.flight(null);
    }
    const box = document.getElementById('set-cinema');
    if (box) box.checked = this.enabled;
    return this.enabled;
  }

  setLetterbox(on) {
    this.letterboxOn = !!on;
    this._layoutBars();
    const box = document.getElementById('set-letterbox');
    if (box) box.checked = this.letterboxOn;
    return this.letterboxOn;
  }

  /** Load a shot object or a JSON string and pose the camera at t = 0. */
  async prepare(shot) {
    const parsed = parseShot(shot);
    this.shot = parsed;
    this.time = 0;
    this.finished = false;
    // Stay idle while the stage poses the world. A step in there must not burn the shot clock.
    this.playing = false;
    this.driver = null;
    this.setEnabled(true);
    if (parsed.letterbox !== false) this.setLetterbox(true);
    const wantPost = !!(this.post && parsed.post !== false);
    if (this.post) this.post.setShot(parsed, wantPost);
    this._usePost(wantPost);
    const { runStage } = await import('./stage.js');
    await runStage(parsed, this.stageApi);
    this.time = 0;
    this.finished = false;
    this.playing = true;
    this.pose();
    return parsed;
  }

  pose() {
    if (!this.shot) return null;
    if (this.driver) this.driver(this.time, 0);
    return this.apply(this.time);
  }

  /** Camera for the current time, before the world steps. */
  preFrame() {
    if (!this.playing || !this.shot) return;
    this.hooks.pre(this.shot);
    this.apply(this.time);
  }

  /** Camera again after the world has stepped, then advance the clock by dt. */
  postFrame(dt) {
    if (!this.playing || !this.shot) return;
    if (this.driver) this.driver(this.time, dt);
    this.apply(this.time);
    this.hooks.after(dt);
    this.time = Math.min(this.shot.duration, this.time + dt);
    if (this.time >= this.shot.duration - 1e-6) this.finished = true;
  }

  sample(t = this.time) {
    return sampleShot(this.shot, t);
  }

  apply(t = this.time) {
    const s = this.sample(t);
    const api = this.stageApi;
    const eye = api.toWorld(s.eye, s.frame);
    const target = api.toWorld(s.target, s.frame);
    const cam = this.engine.cameraWorldPos;
    cam.x = eye.x; cam.y = eye.y; cam.z = eye.z;
    const up = s.frame === 'ship' ? api.shipUp() : api.radialUp(eye);
    this._up.set(up.x, up.y, up.z);
    if (this._up.lengthSq() < 1e-8) this._up.set(0, 1, 0);
    this.engine.camera.up.copy(this._up);
    this._look.set(target.x - eye.x, target.y - eye.y, target.z - eye.z);
    this.engine.camera.lookAt(this._look);
    if (s.roll) this.engine.camera.rotateZ(s.roll);
    if (s.fov && Math.abs(this.engine.camera.fov - s.fov) > 0.01) {
      this.engine.camera.fov = s.fov;
      this.engine.camera.updateProjectionMatrix();
    }
    return { eye, target, fov: s.fov, t, frame: s.frame };
  }

  stop() {
    this.playing = false;
    this.driver = null;
    if (this.stageApi) this.stageApi.flight(null);
    this._usePost(false);
    this.engine.camera.fov = this.baseFov;
    this.engine.camera.updateProjectionMatrix();
  }
}
