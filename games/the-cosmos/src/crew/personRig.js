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
  cachedFiles() { return [...this._glb.keys()]; }

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
    if (this._pendingLook) this.dress(this._pendingLook);
  }

  /**
   * Tint this person and, when the look asks, put a duty helmet on the head bone.
   * Called every frame from the body cache, so a look that is already on is a no-op.
   * The GLB is not loaded yet: the look is kept and applied at the end of _attach.
   */
  dress(look) {
    if (!look) return;
    this._pendingLook = look;
    if (!this.loaded || !this.body) return;
    const key = [look.personId, look.cloth, look.hair, look.skin, look.visorTint, look.helmet ? 1 : 0].join('|');
    if (this._lookKey === key) return;
    applyPersonLook(this.group, look);
    this._lookKey = key;
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

/**
 * Classify a Loft material by the name authored on it.
 * Skin_Body / Skin_Face tint as skin. Anything with "hair" in the name (Hair, HairCard_*) tints as hair.
 * Teeth and eyes are left alone. Shirt, Shorts, Pants, Shoes and the rest are cloth.
 */
function lookKind(name) {
  if (/^Skin_/.test(name)) return 'skin';
  if (/hair/i.test(name)) return 'hair';
  if (/^(Teeth|Eye)/.test(name)) return 'keep';
  return 'cloth';
}

/** Clone from the untinted source so a second dress does not stack, and so the hall's shared Ada is not painted. */
function tintMaterial(mt, kind, look) {
  const src = mt.userData && mt.userData.lookSrc ? mt.userData.lookSrc : mt;
  const clone = src.clone();
  clone.name = src.name;
  clone.userData = { lookSrc: src };
  const hex = kind === 'skin' ? look.skin : kind === 'hair' ? look.hair : look.cloth;
  if (hex != null) clone.color.multiply(new THREE.Color(hex));
  if (/^HairCard/.test(clone.name || '')) {
    clone.transparent = false; clone.alphaTest = 0.38; clone.depthWrite = true; clone.side = THREE.DoubleSide;
  }
  return clone;
}

/**
 * The head bone's world position, measured on ada.glb's bind pose, is (0, 1.563, 0.003) metres.
 * The Person node is scaled 0.01 (Unreal centimetres). A child of the bone inherits that scale, so the
 * helmet is built in centimetres: a radius of about 13 is a head, and a radius of 0.13 would be a
 * millimetre. The bone sits on the brow. Its local +Y runs back through the skull: a shell at
 * y=+12 poked out behind the hair, and a shell at y=-6 covers the face. The visor sits further
 * toward the face, at a smaller Y.
 */
function findHead(root) {
  let head = null;
  root.traverse((o) => {
    if (!head && o.isBone && /(^|[:_])head$/i.test(o.name || '')) head = o;
  });
  return head;
}

function dutyHelmet(look) {
  const g = new THREE.Group();
  g.name = 'raider-helmet';
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x3c434c, roughness: 0.55, metalness: 0.32 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(14, 18, 14), shellMat);
  shell.name = 'helmet-shell';
  shell.position.set(0, -2, 0);          // local +Y runs back; negative Y covers the face and the crown
  shell.scale.set(1.08, 1.05, 1.12);
  const sealMat = new THREE.MeshStandardMaterial({ color: 0x23272c, roughness: 0.84, metalness: 0.04 });
  const seal = new THREE.Mesh(new THREE.SphereGeometry(12, 14, 10), sealMat);
  seal.name = 'helmet-seal';
  seal.position.set(0, 8, 0);            // the rim, toward the nape
  seal.scale.set(1.16, 0.22, 1.2);
  const visorMat = new THREE.MeshStandardMaterial({
    color: look.visorTint != null ? look.visorTint : 0x1c2128,
    roughness: 0.08, metalness: 0.55,
    transparent: true, opacity: look.visorOpacity != null ? look.visorOpacity : 0.72,
    depthWrite: false,
  });
  const visor = new THREE.Mesh(new THREE.SphereGeometry(8.4, 16, 12), visorMat);
  visor.name = 'helmet-visor';
  visor.position.set(0, -11, 0.6);       // further toward the face than the shell
  visor.scale.set(1.7, 0.28, 0.55);
  for (const m of [shell, seal, visor]) { m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; g.add(m); }
  return g;
}

/**
 * Paint a person (or any group that uses the Loft material names) with a crew look, and parent one
 * helmet to the head bone. Safe to call again: tints clone from the original material, and the previous
 * helmet is removed first. Eyes and teeth are not tinted.
 */
export function applyPersonLook(root, look) {
  if (!root || !look) return;
  root.traverse((m) => {
    if (!m.isMesh || !m.material || m.name === 'helmet-shell' || m.name === 'helmet-seal' || m.name === 'helmet-visor') return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const next = mats.map((mt) => {
      const kind = lookKind(mt.name || '');
      if (kind === 'keep') return mt;
      return tintMaterial(mt, kind, look);
    });
    m.material = Array.isArray(m.material) ? next : next[0];
  });
  const head = findHead(root);
  if (!head) return;
  const prev = head.getObjectByName('raider-helmet');
  if (prev) prev.removeFromParent();
  if (look.helmet) head.add(dutyHelmet(look));
}
