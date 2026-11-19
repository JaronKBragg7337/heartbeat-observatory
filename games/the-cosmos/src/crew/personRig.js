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
import { mergeGeometries } from '../../lib/examples/jsm/utils/BufferGeometryUtils.js';

/** The live site serves the people at /homes/people/; the local dev server (server.js) routes the same path. */
export const PEOPLE_BASE = '/homes/people/';

/** How fast the Walk clip is a walk (metres/second at timeScale 1). Measured on the clip, see PROVENANCE. */
export const WALK_CLIP_SPEED = 1.35;

export class PeopleLibrary {
  constructor(o = {}) {
    this.base = o.base || PEOPLE_BASE;
    this.phone = !!o.phone;
    this.safe = !!o.safe;
    this.loader = new GLTFLoader();
    this._roster = null;
    this._glb = new Map();
    this._safeFiles = new Set();
  }

  /** The people that exist: ['isaiah', 'ada', ...]. Empty if the folder cannot be reached (the game still runs). */
  roster() {
    if (!this._roster) {
      this._roster = fetch(this.base + 'people.json', { cache: 'no-cache' })
        .then((r) => r.json()).then((j) => (j.people || []).map((p) => ({ id: p.id, file: p.file })))
        .catch(() => ['isaiah','ada','zuri','jorge','sunita','walter'].map(id=>({id,file:id+'.glb'})));
    }
    return this._roster;
  }

  glb(file) {
    if (!this._glb.has(file)) {
      const loading=this.loader.loadAsync(this.base + file);let timer;
      const bounded=Promise.race([loading,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Person load timed out')),15000);})])
        .finally(()=>clearTimeout(timer));
      this._glb.set(file,bounded);
    }
    return this._glb.get(file);
  }
  cachedFiles() { return this.safe ? [...this._safeFiles] : [...this._glb.keys()]; }

  /** A person standing at the origin. Resolves once the model is in; the Person object is usable immediately. */
  spawn(id, file) {
    const p = new Person(id);
    // Visible, animated suit from the first frame, including failed downloads.
    p._attachSafe();
    if(this.safe){this._safeFiles.add(file||id+'.glb');p._attachSafe();p.ready=Promise.resolve(p);return p;}
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
    if(this.safe){this.body.removeFromParent();const mats=new Set();this.body.traverse(o=>{o.geometry?.dispose();if(o.material)mats.add(o.material);});
      for(const mat of mats)mat.dispose();this.safe=false;}
    this.body = body;
    this.group.add(body);
    this.mixer = new THREE.AnimationMixer(body);
    for (const clip of gl.animations) if (['Idle', 'Walk', 'Sit'].includes(clip.name)) this.acts[clip.name] = this.mixer.clipAction(clip);
    this.loaded = true;
    this.pose = null;
    this.play(this._want, 0);
    this.mixer.update(0);
    this._lookKey=null;this._phone=!!phone;
    if (this._pendingLook) this.dress(this._pendingLook);
    if (this._suitWant) { const w=this._suitWant; this._suitWant=null; this.setSuit(true,w.look,w.opts); }
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

  /**
   * SUITS (2026-11-19): a pressure suit and helmet for anyone standing outside on a world with no air to breathe.
   * The suit is rigid pieces bound to this person's own bones (one draw call + the visor), so it walks and sits with them.
   * The clothes and body under it are hidden while it is on; the face stays, behind the visor.
   * `look.cloth` (the faction or crew colour) becomes the suit's stripes. `opts.gait`: 'lope' = the slow low-gravity bound.
   * Safe-mode silhouettes are already a suit and are left alone.
   */
  setSuit(on, look, opts) {
    on = !!on;
    this.gait = on && opts && opts.gait ? opts.gait : null;
    if (!this.loaded || !this.body || this.safe) { this._suitWant = on ? { look, opts } : null; return; }
    const accent = look && look.cloth != null ? look.cloth : (this._pendingLook && this._pendingLook.cloth != null ? this._pendingLook.cloth : 0xb8412c);
    if (on && this.suit && this.suit.accent === accent) return;
    if (this.suit) {
      for (const m of this.suit.meshes) { m.removeFromParent(); m.geometry.dispose(); m.material.dispose(); }
      for (const [m, v] of this.suit.hidden) m.visible = v;
      this.suit = null;
    }
    if (!on) return;
    const built = buildSuit(this.body, accent, this._phone);
    if (built) this.suit = built;
  }

  // Avoid bone float textures and GLSL 3 texelFetch in the vendored renderer's
  // skinning chunk. Safe mode uses a small animated, unskinned suit silhouette.
  // looks-r1: a flight suit. Boots stay on the legs and gloves on the arms so the walk still swings them.
  // The visor faces +Z, which is this rig's front. Materials stay unnamed so a crew tint still paints the cloth.
  _attachSafe() {
    if (this.loaded) return;
    this.safe = true; this.phase = 0; this.body = new THREE.Group(); this.group.add(this.body);
    const suit = new THREE.MeshLambertMaterial({ color: 0xd7dbe0 });
    const hard = new THREE.MeshLambertMaterial({ color: 0x2a3038 });
    const visor = new THREE.MeshLambertMaterial({ color: 0x9ee7ff, emissive: new THREE.Color(0x1a6a88), emissiveIntensity: 0.65 });
    const lamp = new THREE.MeshLambertMaterial({ color: 0x6dff9c, emissive: new THREE.Color(0x1c7a3a), emissiveIntensity: 0.55 });
    const part = (geometry, material, x, y, z, parent) => {
      const m = new THREE.Mesh(geometry, material);
      m.position.set(x, y, z);
      (parent || this.body).add(m);
      return m;
    };
    part(new THREE.CapsuleGeometry(0.22, 0.4, 3, 6), suit, 0, 1.12, 0);
    part(new THREE.BoxGeometry(0.16, 0.1, 0.025), hard, 0, 1.16, 0.2);
    part(new THREE.BoxGeometry(0.035, 0.028, 0.01), lamp, 0, 1.14, 0.216);
    part(new THREE.BoxGeometry(0.42, 0.055, 0.26), hard, 0, 0.9, 0);
    part(new THREE.BoxGeometry(0.22, 0.28, 0.09), hard, 0, 1.18, -0.2);
    part(new THREE.BoxGeometry(0.52, 0.05, 0.16), hard, 0, 1.38, 0);
    part(new THREE.SphereGeometry(0.17, 8, 6), hard, 0, 1.62, 0);
    part(new THREE.BoxGeometry(0.15, 0.065, 0.02), visor, 0, 1.64, 0.15);
    this.safeLegs = [-0.12, 0.12].map((x) => part(new THREE.CapsuleGeometry(0.075, 0.48, 3, 6), suit, x, 0.38, 0));
    for (const leg of this.safeLegs) part(new THREE.BoxGeometry(0.12, 0.08, 0.2), hard, 0, -0.3, 0.04, leg);
    this.safeArms = [-0.32, 0.32].map((x) => part(new THREE.CapsuleGeometry(0.06, 0.4, 3, 6), suit, x, 1.12, 0));
    for (const arm of this.safeArms) part(new THREE.BoxGeometry(0.075, 0.07, 0.09), hard, 0, -0.26, 0.02, arm);
    this.loaded = true; this.pose = 'Idle';
  }

  /** Cross-fade to Idle, Walk or Sit. */
  play(name, fade = 0.25) {
    this._want = name;
    if(this.safe){this.pose=name;return;}
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
    if(this.safe){this.phase+=dt*Math.max(1,speed)*3;
      const walking=this.pose==='Walk',sitting=this.pose==='Sit';
      this.safeLegs.forEach((m,i)=>{m.rotation.x=sitting?-Math.PI/2:walking?Math.sin(this.phase+i*Math.PI)*.45:0;m.position.y=sitting?.6:.37;m.position.z=sitting?.28:0;});
      this.safeArms.forEach((m,i)=>m.rotation.x=walking?-Math.sin(this.phase+i*Math.PI)*.35:0);return;}
    if (!this.mixer) return;
    if (this.pose === 'Walk' && this.acts.Walk) this.acts.Walk.timeScale = this.gait === 'lope' ? LOPE.clipRate : Math.max(0.4, Math.min(2.2, speed / WALK_CLIP_SPEED));
    this.mixer.update(dt);
    // the low-gravity bound: each slow step leaves the ground and floats back (a visual lift of the body; the feet's truth is the walker's)
    if (this.body && (this.gait === 'lope' || this._lope)) {
      const walking = this.gait === 'lope' && this.pose === 'Walk';
      this._lope = (this._lope || 0) + ((walking ? 1 : 0) - (this._lope || 0)) * Math.min(1, dt * 3);
      if (this._lope < 0.002) this._lope = 0;
      const d = (this.acts.Walk && this.acts.Walk.getClip().duration) || 1, ph = this.acts.Walk ? ((this.acts.Walk.time / d) * 2) % 1 : 0;      // two steps per cycle
      this.body.position.y = this._lope * LOPE.lift * 4 * ph * (1 - ph);
      this.body.rotation.x = this._lope * LOPE.lean;
    }
  }

  dispose() { if (this.group.parent) this.group.parent.remove(this.group); }
}

/** The low-gravity bound: the Walk clip at this rate, each step lifting the body this many metres, leaning this far forward. */
export const LOPE = { clipRate: 0.42, lift: 0.34, lean: 0.14 };

const SUIT_COL = { cloth: 0xd9d6cd, soft: 0xbfbcb2, joint: 0x8b8e92, dark: 0x2c3034, sole: 0x45474a, pack: 0xc9c6bc, lamp: 0xfff2cf };

/**
 * Build the suit on a person's body. Everything is laid out in metres in the person's own frame (x = their left, y = up, z = front,
 * origin on the ground under the pelvis), read from the skeleton's bind pose, then bound rigidly: every piece follows exactly one bone.
 */
function buildSuit(body, accent, phone) {
  let sk = null;
  body.traverse((o) => { if (!sk && o.isSkinnedMesh && o.skeleton) sk = o; });
  if (!sk) return null;
  const J = {}, idx = {};
  sk.skeleton.bones.forEach((b, i) => { J[b.name] = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(sk.skeleton.boneInverses[i]).invert()); idx[b.name] = i; });
  const sides = ['l', 'r'];
  const need = ['pelvis', 'spine_02', 'spine_03', 'spine_05', 'neck_01', 'head', ...sides.flatMap((s) => ['upperarm_', 'lowerarm_', 'hand_', 'middle_01_', 'thigh_', 'calf_', 'foot_', 'ball_'].map((n) => n + s))];
  if (need.some((n) => !J[n])) return null;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const U = J.head.clone().sub(J.pelvis).normalize();
  const F = J.ball_l.clone().sub(J.foot_l).add(J.ball_r).sub(J.foot_r); F.addScaledVector(U, -F.dot(U)).normalize();
  const L = new THREE.Vector3().crossVectors(U, F).normalize();
  const k = J.head.distanceTo(J.pelvis) > 5 ? 100 : 1;                                   // the rig may be in centimetres
  const ground = Math.min(J.ball_l.dot(U), J.ball_r.dot(U)) - 0.02 * k;
  const O = J.pelvis.clone().addScaledVector(U, ground - J.pelvis.dot(U));
  const c = {};
  for (const n in J) { const d = J[n].clone().sub(O); c[n] = V(d.dot(L) / k, d.dot(U) / k, d.dot(F) / k); }

  const parts = [], Q0 = new THREE.Quaternion(), ONE = V(1, 1, 1), UP = V(0, 1, 0);
  const put = (geo, bone, color, m) => {
    if (m) geo.applyMatrix4(m);
    if (geo.index) geo = geo.toNonIndexed();
    geo.deleteAttribute('uv');
    const n = geo.attributes.position.count, col = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), cc = new THREE.Color(color);
    for (let i = 0; i < n; i++) { col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b; si[i * 4] = idx[bone]; sw[i * 4] = 1; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    parts.push(geo);
  };
  const rs = phone ? 8 : 12;
  const along = (a, b) => new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize());
  const seg = (a, b, r, bone, color) => put(new THREE.CapsuleGeometry(r, a.distanceTo(b), 3, rs), bone, color, new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), along(a, b), ONE));
  const ball = (p, r, bone, color, sc = ONE) => put(new THREE.SphereGeometry(r, rs, Math.max(6, rs - 4)), bone, color, new THREE.Matrix4().compose(p, Q0, sc));
  const box = (p, w, h, d, bone, color, q = Q0) => put(new THREE.BoxGeometry(w, h, d), bone, color, new THREE.Matrix4().compose(p, q, ONE));
  const ring = (a, b, t, r, tube, bone, color) => {                                        // a band round a limb, t of the way from a to b
    put(new THREE.CylinderGeometry(r, r, tube, rs, 1, true), bone, color, new THREE.Matrix4().compose(a.clone().lerp(b, t), along(a, b), ONE));
  };

  for (const s of sides) {
    const sh = c['upperarm_' + s], el = c['lowerarm_' + s], wr = c['hand_' + s], kn = c['calf_' + s], hip = c['thigh_' + s], an = c['foot_' + s], toe = c['ball_' + s];
    const fing = wr.clone().add(c['middle_01_' + s].clone().sub(wr).multiplyScalar(1.55));
    ball(sh, 0.092, 'upperarm_' + s, SUIT_COL.cloth);
    seg(sh, el, 0.066, 'upperarm_' + s, SUIT_COL.cloth);
    ring(sh, el, 0.45, 0.0685, 0.045, 'upperarm_' + s, accent);
    ball(el, 0.07, 'lowerarm_' + s, SUIT_COL.soft);
    seg(el, wr, 0.058, 'lowerarm_' + s, SUIT_COL.cloth);
    ring(el, wr, 0.9, 0.062, 0.03, 'lowerarm_' + s, SUIT_COL.joint);
    seg(wr, fing, 0.047, 'hand_' + s, SUIT_COL.dark);
    seg(hip, kn, 0.1, 'thigh_' + s, SUIT_COL.cloth);
    ring(hip, kn, 0.55, 0.1025, 0.05, 'thigh_' + s, accent);
    ball(kn, 0.092, 'calf_' + s, SUIT_COL.soft);
    seg(kn, an, 0.082, 'calf_' + s, SUIT_COL.cloth);
    ring(kn, an, 0.82, 0.088, 0.05, 'calf_' + s, SUIT_COL.joint);
    // the boot: ankle, a long upper over the foot, and a flat sole on the ground
    const heel = V(an.x, 0, an.z - 0.07), tip = V(toe.x, 0, toe.z + 0.09), yaw = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), tip.clone().sub(heel).normalize());
    ball(an, 0.085, 'foot_' + s, SUIT_COL.soft);
    seg(V(an.x, 0.07, an.z - 0.02), V(toe.x, 0.058, toe.z + 0.035), 0.06, 'foot_' + s, SUIT_COL.joint);
    seg(V(an.x, 0.03, an.z - 0.035), V(toe.x, 0.03, toe.z + 0.05), 0.045, 'foot_' + s, SUIT_COL.sole);
  }
  // trunk: hips, the hard upper torso, the life-support pack, the chest controls, the neck ring
  const waist = c.spine_02, chest = c.spine_03.clone().lerp(c.spine_05, 0.5), neck = c.neck_01, shY = (c.upperarm_l.y + c.upperarm_r.y) / 2;
  ball(V(0, c.pelvis.y - 0.02, c.pelvis.z), 0.16, 'pelvis', SUIT_COL.cloth, V(1.22, 0.95, 0.95));
  ball(V(0, (waist.y + c.pelvis.y) / 2 + 0.04, waist.z), 0.15, 'spine_02', SUIT_COL.soft, V(1.16, 1.0, 0.92));
  ball(V(0, chest.y - 0.02, chest.z + 0.005), 0.2, 'spine_03', SUIT_COL.cloth, V(1.1, 1.12, 0.84));
  ball(V(0, shY - 0.035, chest.z), 0.12, 'spine_05', SUIT_COL.cloth, V(1.62, 0.6, 0.98));       // the shoulder yoke
  box(V(0, chest.y - 0.01, chest.z - 0.18), 0.36, 0.52, 0.15, 'spine_03', SUIT_COL.pack);
  box(V(0, chest.y + 0.262, chest.z - 0.18), 0.3, 0.03, 0.12, 'spine_03', SUIT_COL.joint);
  box(V(0, chest.y - 0.05, chest.z - 0.258), 0.26, 0.3, 0.012, 'spine_03', SUIT_COL.soft);
  box(V(0, chest.y - 0.02, chest.z + 0.175), 0.21, 0.13, 0.06, 'spine_03', SUIT_COL.joint);
  box(V(-0.055, chest.y + 0.0, chest.z + 0.207), 0.05, 0.03, 0.006, 'spine_03', accent);
  box(V(0.05, chest.y + 0.0, chest.z + 0.207), 0.06, 0.05, 0.006, 'spine_03', SUIT_COL.dark);
  put(new THREE.CylinderGeometry(0.128, 0.14, 0.05, rs + 4, 1, false), 'spine_05', SUIT_COL.joint, new THREE.Matrix4().compose(V(0, neck.y + 0.035, neck.z + 0.005), Q0, ONE));

  // helmet: a white shell open at the face (three patches of one sphere), a brow lamp either side
  const hc = V(0, c.head.y + 0.055, c.head.z + 0.012), HR = 0.19, P0 = Math.PI / 2 - 1.12, PL = 2.24, T0 = 0.86, T1 = 2.02;
  const patch = (p0, pl, t0, tl, r = HR) => new THREE.SphereGeometry(r, Math.max(6, Math.round(rs * 1.6 * pl / 6.3)), Math.max(4, Math.round(rs * tl / 3.2 * 1.2)), p0, pl, t0, tl);
  const at = new THREE.Matrix4().makeTranslation(hc.x, hc.y, hc.z);
  put(patch(P0 + PL, Math.PI * 2 - PL, 0, Math.PI), 'head', SUIT_COL.cloth, at);
  put(patch(P0, PL, 0, T0), 'head', SUIT_COL.cloth, at);
  put(patch(P0, PL, T1, Math.PI - T1), 'head', SUIT_COL.cloth, at);
  for (const sx of [-1, 1]) box(V(hc.x + sx * 0.165, hc.y + 0.085, hc.z + 0.075), 0.035, 0.035, 0.05, 'head', SUIT_COL.lamp);

  const basis = new THREE.Matrix4().makeBasis(L.clone().multiplyScalar(k), U.clone().multiplyScalar(k), F.clone().multiplyScalar(k)).setPosition(O);
  const toMesh = new THREE.Matrix4().copy(sk.bindMatrix).invert().multiply(basis);
  const finish = (geo, mat, name) => {
    geo.applyMatrix4(toMesh);
    const m = new THREE.SkinnedMesh(geo, mat);
    m.name = name; m.frustumCulled = false; m.castShadow = !phone; m.receiveShadow = !phone;
    sk.parent.add(m); m.bind(sk.skeleton, sk.bindMatrix);
    return m;
  };
  const suitMesh = finish(mergeGeometries(parts, false), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02, side: THREE.DoubleSide }), 'suit-body');
  parts.length = 0;
  put(patch(P0 + 0.02, PL - 0.04, T0 + 0.01, T1 - T0 - 0.02, HR - 0.004), 'head', 0xffffff, at);
  const visor = finish(parts[0], new THREE.MeshStandardMaterial({ color: 0x9a7a34, roughness: 0.12, metalness: 0.35, emissive: 0x2a1f08, transparent: true, opacity: 0.62, depthWrite: false }), 'suit-visor');
  visor.castShadow = false; visor.renderOrder = 3;

  // under the suit: only the face shows
  const hidden = [];
  body.traverse((o) => {
    if (!o.isMesh || o === suitMesh || o === visor) return;
    if (o.name && o.name.startsWith('helmet-')) { hidden.push([o, o.visible]); o.visible = false; return; }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((mt) => mt && /^(Skin_Face|Teeth|Eye|HairCard|Hair)/.test(mt.name || ''))) return;
    hidden.push([o, o.visible]); o.visible = false;
  });
  return { meshes: [suitMesh, visor], hidden, accent };
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

/**
 * A patch of an ellipsoid, as its own geometry. Centre c, radii r (bone-local axes: X up, -Y forward, Z lateral).
 * a0..a1 run around the head (0 = straight ahead, + toward +Z), b0..b1 run up the head (0 = level with the centre, + up).
 */
function ellipsoidPatch(c, r, a0, a1, b0, b1, na, nb) {
  const pos = [], idx = [];
  for (let j = 0; j <= nb; j++) {
    const b = b0 + (b1 - b0) * (j / nb);
    for (let i = 0; i <= na; i++) {
      const a = a0 + (a1 - a0) * (i / na);
      pos.push(c[0] + r[0] * Math.sin(b), c[1] - r[1] * Math.cos(b) * Math.cos(a), c[2] + r[2] * Math.cos(b) * Math.sin(a));
    }
  }
  for (let j = 0; j < nb; j++) for (let i = 0; i < na; i++) {
    const p = j * (na + 1) + i, q = p + na + 1;
    idx.push(p, p + 1, q, p + 1, q + 1, q);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A duty helmet: a closed shell that clears the head AND the hair (no hair pokes through), a crest, ear pods, a chin guard, a neck seal,
 * and a curved visor in a bezel. Built in the head bone's frame, in centimetres (measured on ada.glb: face from x -21.6 (chin) to +16.3
 * (crown), nose at y -12.5, hair to x +20.6 and y +11.3 behind, eyes at x +4.7..7.4 and z about ±3; X is up, -Y is the face, Z is lateral).
 * The shell is an ellipsoid with centre (5, -0.3, 0) and radii (18, 17.5, 14.5), cut below the jaw.
 */
function dutyHelmet(look) {
  const g = new THREE.Group();
  g.name = 'raider-helmet';
  const C = [5, -0.3, 0], RAD = [18, 17.5, 14.5];
  const accent = look.cloth != null ? new THREE.Color(look.cloth).multiplyScalar(0.7) : new THREE.Color(0x8a5a2c);
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x5a636c, roughness: 0.52, metalness: 0.12 });
  const trimMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.55, metalness: 0.3 });
  const sealMat = new THREE.MeshStandardMaterial({ color: 0x2c3237, roughness: 0.85, metalness: 0.05 });
  const bezelMat = new THREE.MeshStandardMaterial({ color: 0x14171a, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide });
  const visorMat = new THREE.MeshStandardMaterial({
    color: look.visorTint != null ? new THREE.Color(look.visorTint).multiplyScalar(1.7) : 0x2a3340, roughness: 0.08, metalness: 0.15,
    emissive: look.visorTint != null ? new THREE.Color(look.visorTint).multiplyScalar(0.35) : 0x0a0e12,
    transparent: true, opacity: look.visorOpacity != null ? look.visorOpacity : 0.72, depthWrite: false, side: THREE.DoubleSide,
  });
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffb25a, toneMapped: false });
  const add = (name, mesh, mat) => { mesh.name = 'helmet-' + name; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; g.add(mesh); return mesh; };

  // shell: a sphere with its pole on +X (up), scaled to the ellipsoid, the bottom cut away below the jaw
  const dome = new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, 2.5);
  dome.rotateZ(-Math.PI / 2);
  const shell = add('shell', new THREE.Mesh(dome, shellMat));
  shell.position.set(C[0], C[1], C[2]); shell.scale.set(RAD[0], RAD[1], RAD[2]);
  shellMat.side = THREE.DoubleSide;           // the cut edge shows its inside from below

  // crest: a ridge from the brow over the crown to the nape, riding on the shell
  const crestPts = [];
  for (let i = 0; i <= 10; i++) {
    const t = -1.0 + 2.0 * (i / 10), ang = t * 1.25;                 // angle in the sagittal plane, 0 = straight up
    crestPts.push([C[0] + (RAD[0] + 0.6) * Math.cos(ang), C[1] + (RAD[1] + 0.6) * Math.sin(ang), 0]);
  }
  for (let i = 0; i < crestPts.length - 1; i++) {
    const a = crestPts[i], b = crestPts[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const bar = add('crest', new THREE.Mesh(new THREE.BoxGeometry(len + 0.3, 1.0, 2.6), trimMat));
    bar.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0);
    bar.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
  }

  // ear pods and a lamp, left and right
  for (const s of [-1, 1]) {
    const pod = add('pod', new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, 3.2, 14), sealMat));
    pod.rotation.x = Math.PI / 2;
    pod.position.set(1.5, 2.5, s * (RAD[2] + 0.4));
    const cap = add('pod-cap', new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.6, 12), trimMat));
    cap.rotation.x = Math.PI / 2;
    cap.position.set(1.5, 2.5, s * (RAD[2] + 2.2));
  }
  const lamp = add('lamp', new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.0), lampMat));
  lamp.position.set(15.2, -9.5, 10.2);

  // chin guard and neck seal
  const chin = add('chin', new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), shellMat));
  chin.scale.set(6.2, 8.5, 11.5); chin.position.set(-8.4, -8.6, 0);
  const seal = add('seal', new THREE.Mesh(new THREE.CylinderGeometry(11.5, 12.8, 4.2, 22), sealMat));
  seal.rotation.z = Math.PI / 2 * 0 ; seal.position.set(-9.5, 1.0, 0);          // the cylinder's axis is already local Y; turn it to X
  seal.rotation.set(0, 0, Math.PI / 2);
  seal.scale.set(1, 1, 1);
  const ring = add('ring', new THREE.Mesh(new THREE.TorusGeometry(11.6, 0.7, 6, 24), trimMat));
  ring.rotation.y = Math.PI / 2; ring.position.set(-7.4, 1.0, 0);

  // visor: the lens in a thin bezel, both patches of a slightly larger ellipsoid so they stand proud of the shell
  const bezelGeo = ellipsoidPatch(C, [RAD[0] + 0.5, RAD[1] + 0.5, RAD[2] + 0.5], -1.22, 1.22, -0.72, 0.5, 20, 8);
  add('bezel', new THREE.Mesh(bezelGeo, bezelMat));
  const lensGeo = ellipsoidPatch(C, [RAD[0] + 1.0, RAD[1] + 1.0, RAD[2] + 1.0], -1.12, 1.12, -0.62, 0.4, 20, 8);
  const lens = add('visor', new THREE.Mesh(lensGeo, visorMat));
  lens.renderOrder = 3;
  // a pale band across the upper lens, so the glass reads as glass and not as a hole
  const glint = add('glint', new THREE.Mesh(ellipsoidPatch(C, [RAD[0] + 1.15, RAD[1] + 1.15, RAD[2] + 1.15], -0.78, 0.5, 0.12, 0.2, 14, 1), glintMat));
  glint.renderOrder = 4;
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
    if (!m.isMesh || !m.material || (m.name && m.name.startsWith('helmet-'))) return;
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
