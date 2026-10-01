// ============================================================================
// personRig.js — real people. The Loft's MetaHuman people (homes/people/*.glb: 63 bones, Idle / Walk / Sit),
// loaded once, cloned per person, and driven by one of three poses.
//
// OWNS: loading the roster and the GLBs, cloning a skinned person, the pose cross-fade, hair cards that
//       are cut out rather than blended. DOES NOT OWN: where a person is or what they are doing (crewSystem.js).
//
// A Person is a Group whose origin is the SOLES of the feet and whose front is +Z (the model's own front, the same
// convention as the player's body in main.js). Put it in a scene, set its position, set `group.rotation.y`.
// On the ship the heading convention is "yaw clockwise from the bow (-Z)": rotation.y = PI - yaw.
// ============================================================================

import * as THREE from 'three';
import { GLTFLoader } from '../../lib/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from '../../lib/examples/jsm/utils/SkeletonUtils.js';

/** The live site serves the people at /homes/people/; the local dev server (server.js) routes the same path. */
export const PEOPLE_BASE = '/homes/people/';

/** How fast the Walk clip is a walk (metres/second at timeScale 1). Measured on the clip, see PROVENANCE. */
export const WALK_CLIP_SPEED = 1.35;

export class PeopleLibrary {
  constructor(o = {}) {
    this.base = o.base || PEOPLE_BASE;
    this.phone = !!o.phone;
    this.loader = new GLTFLoader();
    this._roster = null;
    this._glb = new Map();
  }

  /** The people that exist: ['isaiah', 'ada', ...]. Empty if the folder cannot be reached (the game still runs). */
  roster() {
    if (!this._roster) {
      this._roster = fetch(this.base + 'people.json', { cache: 'no-cache' })
        .then((r) => r.json()).then((j) => (j.people || []).map((p) => ({ id: p.id, file: p.file })))
        .catch(() => []);
    }
    return this._roster;
  }

  glb(file) {
    if (!this._glb.has(file)) this._glb.set(file, this.loader.loadAsync(this.base + file));
    return this._glb.get(file);
  }

  /** A person standing at the origin. Resolves once the model is in; the Person object is usable immediately. */
  spawn(id, file) {
    const p = new Person(id);
    p.ready = this.glb(file || id + '.glb').then((gl) => { p._attach(gl, this.phone); return p; })
      .catch((e) => { console.warn('person failed to load', id, e); return p; });
    return p;
  }
}

export class Person {
  constructor(id) {
    this.id = id;
    this.group = new THREE.Group();
    this.group.name = 'person-' + id;
    this.loaded = false;
    this.pose = null;
    this.acts = {};
    this.mixer = null;
    this.speed = 1;
    this.ready = null;
    this._want = 'Idle';
    this.heightM = 1.8;
  }

  _attach(gl, phone) {
    const body = cloneSkinned(gl.scene);
    body.traverse((m) => {
      if (!m.isMesh) return;
      m.frustumCulled = false;          // skinned bounds are the rest pose; a seated or walking body leaves them
      m.castShadow = !phone; m.receiveShadow = !phone;     // a phone draws no sun shadow for a person (the shadow pass is the expensive one)
      const mt = m.material;
      if (mt && /^HairCard/.test(mt.name)) {   // strand cards: cut out by the alpha, both sides, no sorting flicker
        mt.transparent = false; mt.alphaTest = 0.38; mt.depthWrite = true; mt.side = THREE.DoubleSide;
        if (!phone) mt.alphaToCoverage = true;
      }
    });
    this.body = body;
    this.group.add(body);
    this.mixer = new THREE.AnimationMixer(body);
    for (const clip of gl.animations) if (['Idle', 'Walk', 'Sit'].includes(clip.name)) this.acts[clip.name] = this.mixer.clipAction(clip);
    this.loaded = true;
    this.pose = null;
    this.play(this._want, 0);
    this.mixer.update(0);
  }

  /** Cross-fade to Idle, Walk or Sit. */
  play(name, fade = 0.25) {
    this._want = name;
    if (!this.loaded || this.pose === name) return;
    const next = this.acts[name]; if (!next) return;
    const prev = this.pose ? this.acts[this.pose] : null;
    next.reset().setEffectiveWeight(1).play();
    if (prev && fade > 0) prev.crossFadeTo(next, fade, false);
    else if (prev) prev.stop();
    this.pose = name;
  }

  /** Advance the animation. `speed` is the ground speed in m/s, so a slow walk is a slow step. */
  update(dt, speed = 0) {
    if (!this.mixer) return;
    if (this.pose === 'Walk' && this.acts.Walk) this.acts.Walk.timeScale = Math.max(0.4, Math.min(2.2, speed / WALK_CLIP_SPEED));
    this.mixer.update(dt);
  }

  dispose() { if (this.group.parent) this.group.parent.remove(this.group); }
}
