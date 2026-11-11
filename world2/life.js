// WORLD 2 - street life (remake Phase 2, 2026-11-05). See /WORLD2-REMAKE.md.
//
// PEOPLE: an instanced crowd that walks the sidewalks. Each figure is one shared human mesh (tapered legs and arms,
// a shaped torso, neck, head and hair, shoes) whose walk cycle runs in the vertex shader: legs swing from the hip with
// a knee bend, arms counter-swing from the shoulder, the body bobs. Outfits (skin, top, bottom, hair, short or long
// sleeves) are per-instance colours, so the whole crowd is 2 draw calls: a detailed mesh near the camera (casts
// shadows) and a light one further out (no shadows). People walk a graph of sidewalk corners, wait at crosswalks
// on red, look both ways at unsignalled corners, and never step into the street except on a crosswalk. Cars yield
// to anyone on a crosswalk (city.js reads `crossers`).
//
// SOUND: one WebAudio graph, created only after a tap (iOS rule), quiet by default and mutable (the speaker button;
// the choice is remembered). Traffic hum by distance to the streets and to moving cars, the river near the
// promenade, footsteps while you walk, birds by day, crickets by night, everything quieter after dark.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";
import { GRID, ROAD, CURB, cityFloor } from "./city.js?v=2026-11-11-phase3";

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------------------------------------------------------
// the figure: built facing +z, feet at y = 0, about 1.72 m tall. aPart: 0 body, 1/2 left/right leg, 3/4 left/right arm.
// aSlot: 0 skin, 1 top, 2 bottom, 3 hair, 4 shoes, 5 sleeve (top or skin, per person)
// ---------------------------------------------------------------------------------------------------------------
function figureGeometry(lo, face) {
  const P = [], N = [], A = [], S = [], K = [], I = []; let v = 0;
  // mask: 0 always, 1 long hair, 2 coat, 3 skirt (per-person style flags collapse the pieces they don't wear)
  const add = (g, part, slot, mask = 0) => {
    const p = g.attributes.position, n = g.attributes.normal;
    for (let k = 0; k < p.count; k++) { P.push(p.getX(k), p.getY(k), p.getZ(k)); N.push(n.getX(k), n.getY(k), n.getZ(k)); A.push(part); S.push(slot); K.push(mask); }
    if (g.index) for (let k = 0; k < g.index.count; k++) I.push(v + g.index.getX(k)); else for (let k = 0; k < p.count; k++) I.push(v + k);
    v += p.count;
  };
  const seg = lo ? 5 : 8, M = new THREE.Matrix4();
  const cyl = (rt, rb, h, y0, x, z = 0, sx = 1, sz = 1) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg, lo ? 1 : 2); g.scale(sx, 1, sz); g.translate(x, y0 + h / 2, z); return g; };
  for (const side of [-1, 1]) {
    const leg = side < 0 ? 1 : 2, arm = side < 0 ? 3 : 4, x = side * 0.092;
    add(cyl(0.078, 0.062, 0.44, 0.48, x), leg, 2);                 // thigh
    add(cyl(0.06, 0.045, 0.42, 0.07, x), leg, 7);                  // shin (trousers, or bare legs under a skirt)
    const shoe = new THREE.BoxGeometry(0.095, 0.075, 0.25); shoe.translate(x, 0.037, 0.04); add(shoe, leg, 4);
    add(cyl(0.05, 0.043, 0.3, 1.12, side * 0.205), arm, 1);        // upper arm (always the top's colour)
    add(cyl(0.042, 0.034, 0.27, 0.86, side * 0.21), arm, 5);       // forearm (sleeve or skin)
    if (!lo) { const hand = new THREE.SphereGeometry(0.042, 6, 4); hand.scale(0.8, 1.2, 0.9); hand.translate(side * 0.212, 0.83, 0); add(hand, arm, 0); }
  }
  add(cyl(0.165, 0.17, 0.16, 0.88, 0, 0, 1, 0.68), 0, 2);         // hips
  // torso: a lathe from waist to shoulders, flattened front-to-back
  const prof = [[0.0, 1.03], [0.15, 1.03], [0.152, 1.12], [0.172, 1.27], [0.19, 1.38], [0.17, 1.44], [0.075, 1.48], [0.0, 1.485]].map(([r, y]) => new THREE.Vector2(r, y));
  const torso = new THREE.LatheGeometry(prof, lo ? 6 : 10); torso.scale(1, 1, 0.62); add(torso, 0, 1);
  add(cyl(0.048, 0.052, 0.1, 1.47, 0), 0, 0);                      // neck
  const head = new THREE.SphereGeometry(0.1, lo ? 7 : 12, lo ? 5 : 9); head.scale(0.92, 1.14, 1.0); head.translate(0, 1.655, 0.008); add(head, 0, 0);
  if (!lo) { const nose = new THREE.ConeGeometry(0.018, 0.04, 4); nose.rotateX(Math.PI / 2); nose.translate(0, 1.64, 0.105); add(nose, 0, 0); }
  if (face) {   // Phase 3: the people you stand a metre from (shopkeepers, customers) get eyes, brows and a mouth
    for (const s of [-1, 1]) { const eye = new THREE.SphereGeometry(0.0115, 6, 4); eye.scale(1.15, 0.85, 0.6); eye.translate(s * 0.036, 1.668, 0.097); add(eye, 0, 4);
      const brow = new THREE.BoxGeometry(0.034, 0.006, 0.006); brow.rotateZ(-s * 0.12); brow.translate(s * 0.037, 1.692, 0.098); add(brow, 0, 3); }
    const mouth = new THREE.BoxGeometry(0.04, 0.007, 0.006); mouth.translate(0, 1.607, 0.097); add(mouth, 0, 6);
  }
  { const lh = new THREE.CylinderGeometry(0.104, 0.09, 0.3, lo ? 5 : 9, 1, true, Math.PI / 2, Math.PI); lh.scale(1, 1, 0.9); lh.translate(0, 1.56, -0.012); add(lh, 0, 3, 1); }   // long hair down the back
  { const coat = new THREE.CylinderGeometry(0.182, 0.2, 0.52, lo ? 6 : 10, 1, true); coat.scale(1, 1, 0.72); coat.translate(0, 0.8, 0); add(coat, 0, 6, 2); }   // coat skirt to mid-thigh
  { const sk = new THREE.CylinderGeometry(0.17, 0.235, 0.4, lo ? 6 : 10, 1, true); sk.scale(1, 1, 0.78); sk.translate(0, 0.72, 0); add(sk, 0, 2, 3); }   // skirt
  const hair = new THREE.SphereGeometry(0.108, lo ? 7 : 12, lo ? 4 : 6, 0, Math.PI * 2, 0, Math.PI * 0.56); hair.scale(0.95, 1.12, 1.04); hair.translate(0, 1.672, -0.01); add(hair, 0, 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("aPart", new THREE.Float32BufferAttribute(A, 1)); g.setAttribute("aSlot", new THREE.Float32BufferAttribute(S, 1)); g.setAttribute("aMask", new THREE.Float32BufferAttribute(K, 1));
  g.setIndex(I); g.computeBoundingSphere();
  return g;
}

function injectWalk(sh) {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", `#include <common>
      attribute float aPart; attribute float aSlot; attribute float aMask;
      attribute vec3 iSkin; attribute vec3 iTop; attribute vec3 iBottom; attribute vec3 iHair; attribute vec4 iAnim; attribute vec3 iStyle;
      varying vec3 vPed;
      // walk pose: rotate about x through a pivot (y, z)
      vec3 rotX(vec3 p, float a, float py) { p.y -= py; float c = cos(a), s = sin(a); p = vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); p.y += py; return p; }
      float legA() { float s = sin(iAnim.x) * iAnim.z; return aPart < 1.5 ? s : -s; }`)
      .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
      if (aPart > 0.5) { float sw = sin(iAnim.x) * iAnim.z;
        float ang = aPart < 1.5 ? -sw * 0.42 : aPart < 2.5 ? sw * 0.42 : aPart < 3.5 ? sw * 0.36 : -sw * 0.36; float c = cos(ang), s = sin(ang); objectNormal = vec3(objectNormal.x, objectNormal.y * c - objectNormal.z * s, objectNormal.y * s + objectNormal.z * c); }`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
      float ph = iAnim.x, amp = iAnim.z;
      if (aPart > 0.5 && aPart < 2.5) {
        float a = legA();
        // knee: the lower leg folds back while the leg swings through behind (foot lifts)
        float knee = max(0.0, cos(ph + (aPart < 1.5 ? 0.0 : 3.14159))) * 0.75 * amp;   // swing phase only
        if (transformed.y < 0.5) transformed = rotX(transformed, knee, 0.5);
        transformed = rotX(transformed, -a * 0.42, 0.93);
      } else if (aPart > 2.5) {
        float a = (aPart < 3.5 ? sin(ph) : -sin(ph)) * amp;   // arm opposite its own side's leg
        transformed = rotX(transformed, a * 0.36, 1.42);
        if (transformed.y < 1.12) transformed.z += max(0.0, a) * 0.05;   // a little elbow bend on the forward swing
      }
      transformed.y += (abs(cos(ph)) - 0.64) * 0.045 * amp;
      transformed.x += sin(ph) * 0.012 * amp;
      vec3 sleeve = iAnim.w > 0.5 ? iTop : iSkin;
      vec3 shin = iStyle.z > 0.5 ? iSkin * 0.92 : iBottom;
      vPed = aSlot < 0.5 ? iSkin : aSlot < 1.5 ? iTop : aSlot < 2.5 ? iBottom : aSlot < 3.5 ? iHair : aSlot < 4.5 ? vec3(0.06, 0.055, 0.05) + iHair * 0.25 : aSlot < 5.5 ? sleeve : aSlot < 6.5 ? iTop * 0.62 : shin;
      // pieces this person doesn't wear collapse to a point (degenerate triangles cost almost nothing)
      if ((aMask > 0.5 && aMask < 1.5 && iStyle.x < 0.5) || (aMask > 1.5 && aMask < 2.5 && iStyle.y < 0.5) || (aMask > 2.5 && iStyle.z < 0.5)) transformed = vec3(0.0, 1.0, 0.0);`);
}
function crowdMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    injectWalk(sh);
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vPed;")
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= vPed;");
  };
  // the shadow pass walks too (and drops the coats/skirts/hair a person doesn't wear)
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = (sh) => injectWalk(sh);
  return { mat, depth };
}

// outfit palette (linear-ish colours that read as real clothes, not toy colours)
const SKIN = [0xf1d3bd, 0xe0b899, 0xc99a74, 0xa87850, 0x8a5a3a, 0x6a4028, 0x4a2c1c, 0xf5ddc9];
const HAIR = [0x1a1410, 0x2e2018, 0x4a3020, 0x6a4a2a, 0x9a7a4a, 0xb8b0a8, 0x2a2a2a, 0x7a3a1a, 0xd8c08a];
const TOPS = [0x23324a, 0x6b1f24, 0xd8d4cc, 0x2f4a36, 0x1c1c1e, 0x8a6a4a, 0x4a5a6a, 0xb8862a, 0x5a2a4a, 0x9aa8b0, 0xe8e2d6, 0x3a5a8a, 0x8a2a1a, 0x6a6a5a];
const BOTTOMS = [0x1f2a3a, 0x2a2a2c, 0x3a3226, 0x4a5466, 0x6a5a40, 0x1a1a1a, 0x5a4a3a, 0x2a3a4a, 0x7a7266];

// ---------------------------------------------------------------------------------------------------------------
// the sidewalk graph. A node is a block corner: intersection (ix, iz) + quadrant (qx, qz). A person walks the
// sidewalk at offset `o` from the street centre lines (between the lamp/tree line and the building line).
// ---------------------------------------------------------------------------------------------------------------
const OFF = 7.4;    // curb is at 5.5, lamps 6.05, tree trunks 6.8, benches start at 8.05, building line 9.0
function cornerPos(n, o) { return [GRID.xs[n.ix] + n.qx * o, GRID.zs[n.iz] + n.qz * o]; }
function neighbours(n) {
  const out = [], X = GRID.xs.length, Z = GRID.zs.length;
  const ix2 = n.ix + n.qx; if (ix2 >= 0 && ix2 < X) out.push({ to: { ix: ix2, iz: n.iz, qx: -n.qx, qz: n.qz }, cross: null });
  const iz2 = n.iz + n.qz; if (iz2 >= 0 && iz2 < Z) out.push({ to: { ix: n.ix, iz: iz2, qx: n.qx, qz: -n.qz }, cross: null });
  out.push({ to: { ix: n.ix, iz: n.iz, qx: -n.qx, qz: n.qz }, cross: "x" });   // across the N-S street (walking along x)
  out.push({ to: { ix: n.ix, iz: n.iz, qx: n.qx, qz: -n.qz }, cross: "z" });   // across the E-W street (walking along z)
  return out;
}
const sameNode = (a, b) => a && b && a.ix === b.ix && a.iz === b.iz && a.qx === b.qx && a.qz === b.qz;
const isSignal = (x, z) => x >= -104 && x <= 104 && z >= -104 && z <= 104;

export function buildCrowd(scene, city, opts = {}) {
  const tier = opts.tier || "desktop";
  const COUNT = opts.count || (tier === "desktop" ? 150 : tier === "lite" ? 60 : 96);
  const NEAR = 38, FAR = 175;   // metres: detailed mesh inside NEAR, light mesh to FAR, nobody drawn beyond
  const R = rng(20261105);
  const geoHi = figureGeometry(false), geoLo = figureGeometry(true);
  const { mat, depth } = crowdMaterial();
  const mk = (geo, n) => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    for (const [k, w] of [["iSkin", 3], ["iTop", 3], ["iBottom", 3], ["iHair", 3], ["iAnim", 4], ["iStyle", 3]]) { const a = new THREE.InstancedBufferAttribute(new Float32Array(n * w), w); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, a); }
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; m.name = "crowd";
    return m;
  };
  const near = mk(geoHi, COUNT), far = mk(geoLo, COUNT);
  near.castShadow = true; near.receiveShadow = true; near.customDepthMaterial = depth; far.castShadow = false; far.receiveShadow = true;
  scene.add(near, far);

  const col = new THREE.Color();
  const lin3 = (hex, jit) => { col.setHex(hex); const j = 1 + (R() - 0.5) * jit; return [col.r * j, col.g * j, col.b * j]; };
  const people = [];
  for (let k = 0; k < COUNT; k++) {
    const n = { ix: Math.floor(R() * GRID.xs.length), iz: Math.floor(R() * GRID.zs.length), qx: R() < 0.5 ? -1 : 1, qz: R() < 0.5 ? -1 : 1 };
    const tall = 0.9 + R() * 0.17;
    const p = { from: n, to: null, cross: null, t: 0, len: 1, x: 0, z: 0, yaw: R() * 6.28, o: OFF + (R() - 0.5) * 0.24,
      speed: 1.12 + R() * 0.42, phase: R() * 6.28, amp: 0, wait: 0, waitFor: null, scale: tall, w: 0.94 + R() * 0.14,
      skin: lin3(SKIN[Math.floor(R() * SKIN.length)], 0.1), top: lin3(TOPS[Math.floor(R() * TOPS.length)], 0.2), bottom: lin3(BOTTOMS[Math.floor(R() * BOTTOMS.length)], 0.2),
      hair: lin3(HAIR[Math.floor(R() * HAIR.length)], 0.15), sleeves: R() < 0.62 ? 1 : 0, prev: null, style: [0, 0, 0] };
    { const r = R(); p.style = [R() < 0.38 ? 1 : 0, r < 0.22 ? 1 : 0, r > 0.86 ? 1 : 0]; if (p.style[1]) p.sleeves = 1; }
    [p.x, p.z] = cornerPos(n, p.o);
    pickNext(p, R);
    p.t = R() * p.len * (p.cross ? 0 : 1);   // start spread along the sidewalks (not mid-crosswalk)
    advance(p, 0);
    people.push(p);
  }

  function pickNext(p, rnd) {
    const opts = neighbours(p.from).filter((e) => !sameNode(e.to, p.prev));
    // sidewalks are preferred over crossings 3:2, so people follow blocks the way people do
    const wts = opts.map((e) => (e.cross ? 2 : 3)); let sum = wts.reduce((a, b) => a + b, 0), r = rnd() * sum, e = opts[0];
    for (let k = 0; k < opts.length; k++) { r -= wts[k]; if (r <= 0) { e = opts[k]; break; } }
    p.to = e.to; p.cross = e.cross; p.t = 0;
    const a = cornerPos(p.from, p.o), b = cornerPos(p.to, p.o); p.ax = a[0]; p.az = a[1]; p.bx = b[0]; p.bz = b[1]; p.len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    p.wait = 0; p.waitFor = e.cross ? (isSignal(GRID.xs[p.from.ix], GRID.zs[p.from.iz]) ? "signal" : "look") : null;
    if (p.waitFor === "look") p.wait = 0.6 + rnd() * 1.6;
  }
  function advance(p, d) {
    p.t = Math.min(p.len, p.t + d);
    const u = p.t / p.len; p.x = p.ax + (p.bx - p.ax) * u; p.z = p.az + (p.bz - p.az) * u;
  }

  const crossers = city.crossers || [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), sphere = new THREE.Sphere(new THREE.Vector3(), 1.2);
  const setAttr = (geo, i, p) => {
    const A = geo.attributes;
    A.iStyle.array.set(p.style, i * 3); A.iSkin.array.set(p.skin, i * 3); A.iTop.array.set(p.top, i * 3); A.iBottom.array.set(p.bottom, i * 3); A.iHair.array.set(p.hair, i * 3);
    A.iAnim.array[i * 4] = p.phase; A.iAnim.array[i * 4 + 1] = 0; A.iAnim.array[i * 4 + 2] = p.amp; A.iAnim.array[i * 4 + 3] = p.sleeves;
  };
  let stat = { near: 0, far: 0, waiting: 0, crossing: 0 }, recycleT = 0, recycled = 0;
  // keep the crowd where you are: anyone further than KEEP from the camera steps back in at a corner 22-85 m away,
  // out of view when possible. 150 people spread over 7 km of sidewalk would be one per 50 m; this way the streets
  // around you hold one every ~13 m (desktop) / ~20 m (phone), and nobody pops in on screen.
  const KEEP = 92;
  let lastCX = null, lastCZ = null;
  function recycle(p, cx, cz, anywhere) {
    let n = null;
    for (let tries = 0; tries < 12; tries++) {
      const c = { ix: Math.floor(R() * GRID.xs.length), iz: Math.floor(R() * GRID.zs.length), qx: R() < 0.5 ? -1 : 1, qz: R() < 0.5 ? -1 : 1 };
      const [x, z] = cornerPos(c, p.o), d = Math.hypot(x - cx, z - cz); if (d < (anywhere ? 4 : 22) || d > 85) continue;
      n = c; sphere.center.set(x, CURB + 0.9, z); if (anywhere || !frustum.intersectsSphere(sphere)) break;
    }
    if (!n) return;
    p.from = n; p.prev = null; pickNext(p, R);
    if (!p.cross) { p.t = R() * p.len; advance(p, 0); } else { p.t = 0; p.x = p.ax; p.z = p.az; }   // a crossing starts at the curb
    recycled++;
  }

  function step(dt, sig) {
    crossers.length = 0;
    for (const p of people) {
      let moving = true;
      if (p.t === 0 && p.cross) {   // at the curb: wait for the walk signal / look both ways
        if (p.waitFor === "signal") { const light = p.cross === "x" ? sig.state.ew : sig.state.ns; if (light !== "g") moving = false; }
        else if (p.wait > 0) { p.wait -= dt; moving = false; }
        if (!moving) { const want = Math.atan2(p.bx - p.ax, p.bz - p.az); p.yaw += angDiff(want, p.yaw) * Math.min(1, dt * 4); }
      }
      const tgt = moving ? 1 : 0; p.amp += (tgt - p.amp) * Math.min(1, dt * 5);
      if (moving) {
        advance(p, p.speed * dt);
        const want = Math.atan2(p.bx - p.ax, p.bz - p.az); p.yaw += angDiff(want, p.yaw) * Math.min(1, dt * 7);
        p.phase += dt * p.speed * 6.2832 / 1.42;   // one stride cycle (two steps) per ~1.42 m
        if (p.t >= p.len) { p.prev = p.from; p.from = p.to; pickNext(p, Math.random); }
      } else p.phase += dt * p.amp * 3;
      if (p.cross && p.t > 0) crossers.push(p);
    }
  }
  return {
    people, near, far,
    update(dt, camera, sig) {
      step(dt, sig);
      pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pv);
      const cx = camera.position.x, cz = camera.position.z, cy = camera.position.y; let nn = 0, nf = 0, w = 0;
      // first frame, or a jump (map walk, door, teleport): fill the streets around the camera at once
      const jumped = lastCX === null || Math.hypot(cx - lastCX, cz - lastCZ) > 30; lastCX = cx; lastCZ = cz;
      if (jumped || (recycleT -= dt) <= 0) { recycleT = 0.5; for (const p of people) if (!(p.cross && p.t > 0) && (p.x - cx) ** 2 + (p.z - cz) ** 2 > KEEP * KEEP) recycle(p, cx, cz, jumped); }
      for (const p of people) {
        if (p.amp < 0.5) w++;
        const d2 = (p.x - cx) ** 2 + (p.z - cz) ** 2 + (cy - 1) ** 2; if (d2 > FAR * FAR) continue;
        sphere.center.set(p.x, CURB + 0.9, p.z); if (!frustum.intersectsSphere(sphere)) continue;
        const y = cityFloor(p.x, p.z) ?? CURB;
        q.setFromAxisAngle(up, p.yaw); scl.set(p.w * p.scale, p.scale, p.w * p.scale); m4.compose(pos.set(p.x, y, p.z), q, scl);
        if (d2 < NEAR * NEAR) { near.setMatrixAt(nn, m4); setAttr(near.geometry, nn, p); nn++; } else { far.setMatrixAt(nf, m4); setAttr(far.geometry, nf, p); nf++; }
      }
      near.count = nn; far.count = nf;
      for (const m of [near, far]) { m.instanceMatrix.needsUpdate = true; for (const k of ["iSkin", "iTop", "iBottom", "iHair", "iAnim", "iStyle"]) m.geometry.attributes[k].needsUpdate = true; }
      stat = { near: nn, far: nf, waiting: w, crossing: crossers.length, total: people.length, recycled, trisNear: geoHi.index.count / 3, trisFar: geoLo.index.count / 3 };
    },
    // test: fast-forward the crowd (no rendering) and check nobody is in a wall or in the street off a crosswalk
    simulate(seconds, sig, colliders) {
      const dt = 0.1, t0 = performance.now() / 1000; let bad = [];
      for (let t = 0; t < seconds; t += dt) {
        sig.update(t0 + t);   // the signals keep cycling in the fast-forward too
        step(dt, sig);
        if (Math.round(t * 10) % 50 === 0) for (const p of people) {
          const f = cityFloor(p.x, p.z);
          const onCross = p.cross && p.t > 0;
          if (!onCross && f !== CURB) bad.push({ t: +t.toFixed(1), x: +p.x.toFixed(2), z: +p.z.toFixed(2), why: "street" });
          for (const c of colliders) { const small = c.width < 1 && c.depth < 1, pad = small ? 0.18 : 0.2, hw = small ? 0.17 : c.width / 2, hd = small ? 0.17 : c.depth / 2;   // trunks/posts are ~0.17 m, a body ~0.2 m
            if (c.h > 1.2 && Math.abs(p.x - c.x) < hw + pad && Math.abs(p.z - c.z) < hd + pad) { bad.push({ t: +t.toFixed(1), x: +p.x.toFixed(2), z: +p.z.toFixed(2), why: "wall", c }); break; } }
        }
        if (bad.length > 20) break;
      }
      return bad;
    },
    stats: () => stat,
  };
}
// ---------------------------------------------------------------------------------------------------------------
// Phase 3: a small pool of the same figure for the people you deal with (shopkeepers, customers, theater guests).
// One instanced mesh = one draw call wherever they stand. They use the crowd's shader, so they walk the same way.
// ---------------------------------------------------------------------------------------------------------------
export function makeFigures(n) {
  const geo = figureGeometry(false, true), { mat, depth } = crowdMaterial();
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  for (const [k, w] of [["iSkin", 3], ["iTop", 3], ["iBottom", 3], ["iHair", 3], ["iAnim", 4], ["iStyle", 3]]) { const a = new THREE.InstancedBufferAttribute(new Float32Array(n * w), w); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, a); }
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0; mesh.name = "npcs";
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.customDepthMaterial = depth;
  const used = new Array(n).fill(false), col = new THREE.Color(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0), A = geo.attributes;
  const lin3 = (hex) => { col.set(hex); return [col.r, col.g, col.b]; };
  const dirty = () => { mesh.instanceMatrix.needsUpdate = true; for (const k of ["iSkin", "iTop", "iBottom", "iHair", "iAnim", "iStyle"]) A[k].needsUpdate = true; };
  const recount = () => { let c = 0; for (let k = 0; k < n; k++) if (used[k]) c = k + 1; mesh.count = c; };
  return {
    mesh,
    // look: { top: "#hex" } pins the shirt (a shopkeeper's apron colour); everything else comes from the seed
    alloc(seed, look = {}) {
      const i = used.indexOf(false); if (i < 0) return -1; used[i] = true; recount();
      const R = rng((seed >>> 0) + 17);
      A.iSkin.array.set(lin3(SKIN[Math.floor(R() * SKIN.length)]), i * 3); A.iHair.array.set(lin3(HAIR[Math.floor(R() * HAIR.length)]), i * 3);
      A.iTop.array.set(lin3(look.top || TOPS[Math.floor(R() * TOPS.length)]), i * 3); A.iBottom.array.set(lin3(BOTTOMS[Math.floor(R() * BOTTOMS.length)]), i * 3);
      const r = R(); A.iStyle.array.set([R() < 0.4 ? 1 : 0, 0, r > 0.86 ? 1 : 0], i * 3);
      A.iAnim.array.set([R() * 6.28, 0, 0, R() < 0.6 ? 1 : 0], i * 4);
      mesh.setMatrixAt(i, zero); dirty(); return i;
    },
    free(i) { if (i < 0 || i >= n) return; used[i] = false; mesh.setMatrixAt(i, zero); recount(); dirty(); },
    // amp 0 = standing, 1 = walking; phase advances with the distance walked
    set(i, x, y, z, yaw, amp = 0, phase, scale = 1) {
      if (i < 0) return; q.setFromAxisAngle(up, yaw); m4.compose(pos.set(x, y, z), q, scl.set(scale, scale, scale)); mesh.setMatrixAt(i, m4);
      if (phase !== undefined) A.iAnim.array[i * 4] = phase; A.iAnim.array[i * 4 + 2] = amp; dirty();
    },
    get inUse() { return used.filter(Boolean).length; }, tris: geo.index.count / 3,
  };
}

function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }

// ---------------------------------------------------------------------------------------------------------------
// city sound
// ---------------------------------------------------------------------------------------------------------------
export function createCitySound() {
  let ac = null, master = null, hum = null, river = null, crick = null, started = false;
  let muted = false; try { muted = localStorage.getItem("w2-sound") === "off"; } catch (e) {}
  const VOL = 0.32;   // quiet by default
  let lastX = null, lastZ = null, stepAcc = 0, birdT = 2, lvl = { hum: 0, river: 0, night: 0 };
  const noiseBuf = (kind) => {
    const n = ac.sampleRate * 2, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1;
      if (kind === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else if (kind === "pink") { b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.05) * 0.9; }
      else d[i] = w; }
    return b;
  };
  const loop = (buf, filt, f, Q) => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; const fl = ac.createBiquadFilter(); fl.type = filt; fl.frequency.value = f; if (Q) fl.Q.value = Q; const g = ac.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(master); s.start(); return g; };
  function start() {
    if (started) { if (ac && ac.state !== "running" && !muted) ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
      ac = new AC(); started = true;
      master = ac.createGain(); master.gain.value = muted ? 0 : VOL; master.connect(ac.destination);
      const brown = noiseBuf("brown"), pink = noiseBuf("pink"); white = noiseBuf("white");
      hum = loop(brown, "lowpass", 420, 0.5);
      river = loop(pink, "bandpass", 900, 0.5);
      // crickets: a 4.6 kHz tone gated by a fast pulse and a slow chirp envelope
      const osc = ac.createOscillator(); osc.frequency.value = 4600; const gate = ac.createGain(); gate.gain.value = 0;
      const lfo = ac.createOscillator(); lfo.type = "square"; lfo.frequency.value = 28; const lfoG = ac.createGain(); lfoG.gain.value = 0.5;
      const slow = ac.createOscillator(); slow.type = "square"; slow.frequency.value = 1.6; const slowG = ac.createGain(); slowG.gain.value = 0.5;
      lfo.connect(lfoG).connect(gate.gain); slow.connect(slowG).connect(gate.gain);
      crick = ac.createGain(); crick.gain.value = 0; osc.connect(gate).connect(crick).connect(master); osc.start(); lfo.start(); slow.start();
      if (ac.state !== "running" && !muted) ac.resume();
    } catch (e) { started = false; }
  }
  let white = null;
  function footstep(vol) {
    const s = ac.createBufferSource(); s.buffer = white; const f = ac.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 700 + Math.random() * 500; f.Q.value = 1.1;
    const g = ac.createGain(), t = ac.currentTime; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 1.5, 0.12);
  }
  function bird(vol) {
    const t0 = ac.currentTime, base = 2600 + Math.random() * 2200, n = 2 + Math.floor(Math.random() * 5), pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
    const g = ac.createGain(); g.gain.value = 0; if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; g.connect(pan).connect(master); } else g.connect(master);
    const o = ac.createOscillator(); o.type = "sine"; o.connect(g);
    for (let k = 0; k < n; k++) { const t = t0 + k * (0.09 + Math.random() * 0.05), f = base * (0.85 + Math.random() * 0.4);
      o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (Math.random() < 0.5 ? 1.35 : 0.7), t + 0.06);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.012); g.gain.linearRampToValueAtTime(0, t + 0.07); }
    o.start(t0); o.stop(t0 + n * 0.15 + 0.1);
  }
  // crosswalk push-button signal: a soft locator tick near a signalled corner, a chirp burst when the walk light turns green
  function tick(vol, f, len) {
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; o.type = "square"; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + len);
    o.connect(g).connect(master); o.start(t); o.stop(t + len + 0.02);
  }
  let lastNS = null, lastEW = null, locT = 0;
  function crosswalk(dt, x, z, sig) {
    if (!sig) return;
    let near = 99; for (const X of GRID.xs) for (const Z of GRID.zs) if (Math.abs(X) <= 104 && Math.abs(Z) <= 104) near = Math.min(near, Math.hypot(x - X, z - Z));
    const turned = (sig.state.ns === "g" && lastNS !== "g") || (sig.state.ew === "g" && lastEW !== "g"); lastNS = sig.state.ns; lastEW = sig.state.ew;
    if (near > 16) return;
    const v = 0.05 * (1 - near / 16);
    if (turned) for (let k = 0; k < 4; k++) setTimeout(() => { if (ac && !muted) { const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; o.frequency.setValueAtTime(2800, t); o.frequency.exponentialRampToValueAtTime(1500, t + 0.09); g.gain.setValueAtTime(v * 1.6, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.11); o.connect(g).connect(master); o.start(t); o.stop(t + 0.13); } }, k * 160);
    if ((locT -= dt) <= 0) { locT = 1.0; tick(v * 0.5, 880, 0.03); }
  }
  const set = (g, v) => g.gain.setTargetAtTime(v, ac.currentTime, 0.4);
  // Phase 3: small job sounds (a sale, a mistake, a door bell, a bike bell). Nothing plays before the first tap.
  function note(f, t0, len, vol, type) {
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + t0; o.type = type || "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + len);
    o.connect(g).connect(master); o.start(t); o.stop(t + len + 0.03);
  }
  function blip(kind) {
    if (!ac || ac.state !== "running" || muted) return;
    if (kind === "ok") { note(880, 0, 0.12, 0.16); note(1320, 0.07, 0.16, 0.14); }
    else if (kind === "coin") { note(1568, 0, 0.09, 0.16); note(2093, 0.08, 0.28, 0.16); }
    else if (kind === "bad") { note(196, 0, 0.2, 0.12, "sawtooth"); }
    else if (kind === "bell") { note(2637, 0, 0.5, 0.14); note(3322, 0.0, 0.4, 0.07); note(2637, 0.16, 0.6, 0.12); }
    else if (kind === "door") { note(1760, 0, 0.5, 0.1); note(1319, 0.12, 0.7, 0.09); }
    else if (kind === "done") { note(784, 0, 0.18, 0.15); note(988, 0.14, 0.18, 0.15); note(1175, 0.28, 0.2, 0.15); note(1568, 0.42, 0.5, 0.15); }
    else note(1200, 0, 0.06, 0.1);
  }
  return {
    start, blip,
    get muted() { return muted; }, get running() { return !!(ac && ac.state === "running"); },
    setMuted(m) {
      muted = !!m; try { localStorage.setItem("w2-sound", muted ? "off" : "on"); } catch (e) {}
      if (!ac) { if (!muted) start(); return; }
      master.gain.setTargetAtTime(muted ? 0 : VOL, ac.currentTime, 0.08);
      if (!muted && ac.state !== "running") ac.resume();
    },
    // player: {x,z} or null (inside / not entered); cars: moving cars [{x,z,v}]; nightF 0..1
    update(dt, player, cars, nightF, grounded, sig) {
      if (!ac || ac.state !== "running" || muted) { if (player) { lastX = player.x; lastZ = player.z; } return; }
      const quiet = 1 - 0.5 * nightF;
      if (!player) { set(hum, 0.05 * quiet); set(river, 0); set(crick, 0); return; }
      const x = player.x, z = player.z;
      let dStreet = 99; for (const L of GRID.xs) dStreet = Math.min(dStreet, Math.abs(x - L)); for (const L of GRID.zs) dStreet = Math.min(dStreet, Math.abs(z - L));
      let near = 0; for (const c of cars) { const d2 = (c.x - x) ** 2 + (c.z - z) ** 2; if (d2 < 1600) near += (c.v / 9) / (1 + d2 / 60); }
      lvl.hum = (0.16 + 0.34 * Math.max(0, 1 - dStreet / 40) + Math.min(0.6, near * 0.5)) * quiet;
      lvl.river = Math.max(0, Math.min(1, 1 - (z + 112) / 50)) * 0.5;
      set(hum, lvl.hum); set(river, lvl.river); set(crick, Math.max(0, nightF - 0.35) * 0.05);
      // footsteps: one every ~0.7 m you walk on the ground
      if (lastX !== null) { const d = Math.hypot(x - lastX, z - lastZ); if (d < 2 && grounded) { stepAcc += d; if (stepAcc > 0.72) { stepAcc = 0; footstep(0.5 * (d / dt > 5 ? 1.25 : 1)); } } else stepAcc = 0; }
      lastX = x; lastZ = z;
      crosswalk(dt, x, z, sig);
      // birds by day (fewer right downtown, more by the river and the green)
      birdT -= dt; if (birdT <= 0) { birdT = 1.2 + Math.random() * 4; const day = 1 - nightF; if (day > 0.35) bird(0.06 * day); }
    },
    levels: () => lvl,
  };
}
