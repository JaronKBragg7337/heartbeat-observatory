/* ============================================================================
   pet.js - the growing pet, as a three.js module
   ---------------------------------------------------------------------------
   createPet(scene, options) builds a soft, jiggly creature made of packed
   cells (one InstancedMesh, one draw call for the body), two eyes that blink
   and look at food or your finger, a little smile, and the berries you drop.
   The body and the behaviour live in pet-core.js (plain maths, node-testable);
   this file only draws what the core says.

   Drop it into any scene (a loft, a farm, the grass patch in index.html):

     import { createPet } from "/lab/pet/pet.js";
     const pet = createPet(scene, { name: "Pip", colour: "mint", cells: 24 });
     // each frame:
     pet.update(dt);
     // touch:
     pet.feed(x, z);  pet.poke();  pet.follow({ x, z }) / pet.follow(null);
     // save:
     localStorage.setItem("hb-pet:v1", JSON.stringify(pet.save()));

   Everything is sized in metres: a new pet is ~0.55 m across. Set
   options.position to put it somewhere else, options.save to restore one.
   See README.md for the whole surface.
   ========================================================================== */
import * as THREE from "three";
import { PetSim, PALETTE, DEFAULTS, formatAge } from "./pet-core.js";

export { PetSim, PALETTE, DEFAULTS, formatAge };

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(), _q = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _m = new THREE.Matrix4();
const _s = new THREE.Vector3(), _sphere = new THREE.Sphere();
const Y_UP = new THREE.Vector3(0, 1, 0);

/* the four colours a pet colour turns into: base, deep (inside), rim (edge light), glow (night) */
export function colourSet(id) {
  const entry = PALETTE.find((p) => p.id === id) || (typeof id === "string" && /^#?[0-9a-f]{6}$/i.test(id) ? { hex: id.startsWith("#") ? id : "#" + id } : PALETTE[0]);
  const base = new THREE.Color(entry.hex);
  const hsl = {}; base.getHSL(hsl);
  const deep = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 1.15 + 0.1), Math.max(0.2, hsl.l * 0.55));
  const rim = new THREE.Color().setHSL(hsl.h, Math.max(0.2, hsl.s * 0.7), Math.min(0.97, hsl.l + 0.22));
  const glow = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s + 0.1), Math.min(0.75, hsl.l + 0.05));
  return { base, deep, rim, glow, hex: entry.hex };
}

/* jelly: a physical material with a fresnel rim, a deeper colour toward the middle (fake subsurface)
   and a soft inner glow the host can turn up at night. Works per instance (instanceColor varies each cell). */
function makeCellMaterial(cols) {
  const m = new THREE.MeshPhysicalMaterial({
    color: cols.base, roughness: 0.3, metalness: 0, clearcoat: 0.75, clearcoatRoughness: 0.3, envMapIntensity: 0.7,
  });
  const u = { uRim: { value: cols.rim.clone() }, uDeep: { value: cols.deep.clone() }, uGlow: { value: cols.glow.clone() }, uGlowAmt: { value: 0.16 } };
  m.userData.u = u;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uRim; uniform vec3 uDeep; uniform vec3 uGlow; uniform float uGlowAmt;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        { vec3 nrmA = normalize(vNormal); vec3 vdA = normalize(vViewPosition); float ndvA = clamp(dot(nrmA, vdA), 0.0, 1.0);
          // the middle of each cell reads deeper and more saturated, like light coming through jelly
          diffuseColor.rgb = mix(diffuseColor.rgb, uDeep, 0.38 * pow(ndvA, 1.5)); }`)
      .replace("#include <opaque_fragment>", `{ vec3 nrmB = normalize(vNormal); vec3 vdB = normalize(vViewPosition); float ndvB = clamp(dot(nrmB, vdB), 0.0, 1.0);
          float fr = pow(1.0 - ndvB, 2.8);
          outgoingLight += uRim * fr * 0.5;                              // the light edge of every cell
          outgoingLight += uGlow * uGlowAmt * (0.25 + 0.75 * ndvB);      // soft light from inside
        }
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => "hb-pet-cell-1";
  return m;
}

function eyeParts(r) {
  const g = new THREE.Group();
  const white = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), new THREE.MeshStandardMaterial({ color: 0xfffaf2, roughness: 0.25, emissive: 0x332a22, emissiveIntensity: 0.25 }));
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(r * 0.56, 14, 10), new THREE.MeshStandardMaterial({ color: 0x1d1612, roughness: 0.3 }));
  pupil.position.z = r * 0.62;
  const shine = new THREE.Mesh(new THREE.SphereGeometry(r * 0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  shine.position.set(r * 0.25, r * 0.3, r * 1.0);
  white.castShadow = false;
  g.add(white, pupil, shine);
  return { group: g, pupil, shine, r };
}

/* -------------------------------------------------------------- createPet */
export function createPet(scene, options = {}) {
  const sim = options.sim || (options.save && PetSim.fromJSON(options.save, options)) || new PetSim(options);
  const maxCells = sim.o.maxCells;
  const group = new THREE.Group();
  group.name = "pet";
  if (scene) scene.add(group);

  // --- the body: one instanced mesh
  const geo = new THREE.SphereGeometry(1, 22, 16);
  let cols = colourSet(sim.colour);
  const mat = makeCellMaterial(cols);
  const body = new THREE.InstancedMesh(geo, mat, maxCells);
  body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxCells * 3), 3);
  body.castShadow = true;
  body.receiveShadow = false;
  body.frustumCulled = false;
  body.name = "pet-body";
  group.add(body);
  const tintColor = new THREE.Color();
  function recolourCells() {
    for (let i = 0; i < sim.cells.length; i++) {
      const t = sim.cells[i].tint;
      // small per-cell variation: a touch lighter or darker, a hair of hue drift, so it reads as many cells, not one blob
      tintColor.setHSL(0.5 + (t - 0.5) * 0.02, 0.5, 0.5 + (t - 0.5) * 0.14);   // a multiplier around 1
      tintColor.r = 0.92 + (t - 0.5) * 0.26; tintColor.g = 0.92 + ((t * 7.3) % 1 - 0.5) * 0.18; tintColor.b = 0.92 + ((t * 3.7) % 1 - 0.5) * 0.18;
      body.instanceColor.setXYZ(i, tintColor.r, tintColor.g, tintColor.b);
    }
    body.instanceColor.needsUpdate = true;
  }
  recolourCells();

  // --- the face
  const face = new THREE.Group();
  group.add(face);
  const eyeR = 0.065;
  const eyes = [eyeParts(eyeR), eyeParts(eyeR)];
  eyes.forEach((e) => face.add(e.group));
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x3a2420, roughness: 0.5 });
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.011, 6, 14, Math.PI * 0.75), mouthMat);
  mouth.rotation.z = Math.PI + Math.PI * 0.125;   // the arc hangs down: a smile
  face.add(mouth);
  const blushMat = new THREE.MeshBasicMaterial({ color: 0xff8aa0, transparent: true, opacity: 0.32, depthWrite: false });
  const blush = [new THREE.Mesh(new THREE.CircleGeometry(0.045, 14), blushMat), new THREE.Mesh(new THREE.CircleGeometry(0.045, 14), blushMat)];
  blush.forEach((b) => face.add(b));

  // --- berries (the food), a small pool reused
  const berries = [];
  const berryGeo = new THREE.SphereGeometry(1, 16, 12);
  const berryMat = new THREE.MeshPhysicalMaterial({ color: 0xe2443a, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x7cc46a, roughness: 0.7, side: THREE.DoubleSide });
  const leafGeo = new THREE.CircleGeometry(0.5, 8);
  leafGeo.scale(1, 0.5, 1);
  for (let i = 0; i < sim.o.maxFood; i++) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(berryGeo, berryMat); b.castShadow = true;
    const leaf = new THREE.Mesh(leafGeo, leafMat); leaf.position.set(0.25, 0.95, 0); leaf.rotation.set(-Math.PI / 2.4, 0, 0.4);
    const leaf2 = new THREE.Mesh(leafGeo, leafMat); leaf2.position.set(-0.2, 0.95, 0.1); leaf2.rotation.set(-Math.PI / 2.2, 0, -1.9);
    g.add(b, leaf, leaf2);
    g.visible = false;
    group.add(g);
    berries.push(g);
  }

  // --- state used by the face
  let blinkT = 2 + Math.random() * 3, blinkAmt = 0, blinkDir = 0;
  const lookWorld = new THREE.Vector3();
  const center = new THREE.Vector3();
  const forward = new THREE.Vector3();
  let night = 0;
  let smileAmt = 1;
  const listeners = { event: options.onEvent || null };

  function worldToGroup(v) { return group.worldToLocal(v); }

  /* where the body ends along a direction from the centre: the plane that touches the furthest cell that way.
     Nothing of the body sticks out past that plane along `dir`, so a face put there is never hidden by a cell. */
  function surfaceAlong(dir, out, normalOut) {
    let best = 0;
    const cx = sim.center.x, cy = sim.center.y, cz = sim.center.z;
    for (const c of sim.cells) {
      const t = (c.x - cx) * dir.x + (c.y - cy) * dir.y + (c.z - cz) * dir.z + c.r;
      if (t > best) best = t;
    }
    if (best <= 0) best = sim.R;
    out.set(cx + dir.x * best, cy + dir.y * best, cz + dir.z * best);
    if (normalOut) normalOut.copy(dir);
    return out;
  }

  function placeFace(dt) {
    const R = sim.R;
    const h = sim.heading, ch = Math.cos(h), sh = Math.sin(h);
    forward.set(sh, 0, ch);
    const side = _v3.set(ch, 0, -sh);  // body-space +x in the world
    center.set(sim.center.x, sim.center.y, sim.center.z);
    const droop = sim.droop, sleeping = sim.state === "sleep";

    // blinking
    blinkT -= dt;
    if (blinkT <= 0 && blinkDir === 0) { blinkDir = 1; blinkT = 2.4 + Math.random() * 4 + (Math.random() < 0.2 ? -1.9 : 0); }
    if (blinkDir === 1) { blinkAmt += dt * 14; if (blinkAmt >= 1) { blinkAmt = 1; blinkDir = -1; } }
    else if (blinkDir === -1) { blinkAmt -= dt * 9; if (blinkAmt <= 0) { blinkAmt = 0; blinkDir = 0; } }
    const lid = sleeping ? 0.9 : Math.max(blinkAmt, droop * 0.45, sim.gulp > 0.6 ? 0.35 : 0);

    // where the eyes look
    let hasLook = false;
    if (sim.lookAt) { lookWorld.set(sim.lookAt.x, sim.lookAt.y, sim.lookAt.z); hasLook = true; }

    for (let i = 0; i < 2; i++) {
      const e = eyes[i], sign = i === 0 ? -1 : 1;
      // eye direction in body space, then world
      const dir = _v.set(0, 0, 0).addScaledVector(side, sign * 0.4).addScaledVector(Y_UP, 0.4 - 0.12 * droop).addScaledVector(forward, 0.82).normalize();
      const n = _v2;
      surfaceAlong(dir, e.group.position, n);
      e.group.position.addScaledVector(n, -eyeR * 0.3);   // sunk a little into the jelly
      _m.lookAt(_s.set(0, 0, 0), _v4.copy(n).negate(), Y_UP);
      e.group.quaternion.setFromRotationMatrix(_m);
      // the pupil slides toward what it looks at
      if (hasLook) {
        // the look direction in the eye's own frame (group-local maths, no matrixWorld needed)
        _s.copy(lookWorld).sub(e.group.position).normalize().applyQuaternion(_qi.copy(e.group.quaternion).invert());
        const px = Math.max(-0.5, Math.min(0.5, _s.x)) * eyeR * 0.9, py = Math.max(-0.4, Math.min(0.45, _s.y)) * eyeR * 0.9;
        e.pupil.position.x += (px - e.pupil.position.x) * Math.min(1, dt * 10);
        e.pupil.position.y += (py - e.pupil.position.y) * Math.min(1, dt * 10);
      } else {
        e.pupil.position.x += (0 - e.pupil.position.x) * Math.min(1, dt * 4);
        e.pupil.position.y += (0.1 * eyeR - e.pupil.position.y) * Math.min(1, dt * 4);
      }
      e.pupil.position.z = eyeR * 0.62;
      e.group.scale.set(1, 1 - lid * 0.92, 1);
      e.shine.visible = lid < 0.6;
      // blush just below and outside each eye
      const bdir = _v.set(0, 0, 0).addScaledVector(side, sign * 0.6).addScaledVector(Y_UP, 0.12 - 0.1 * droop).addScaledVector(forward, 0.76).normalize();
      surfaceAlong(bdir, blush[i].position, n);
      blush[i].position.addScaledVector(n, -0.01);
      _m.lookAt(_s.set(0, 0, 0), _v4.copy(n).negate(), Y_UP);
      blush[i].quaternion.setFromRotationMatrix(_m);
      const happy = Math.max(0, sim.mood);
      blush[i].scale.setScalar(0.7 + 0.6 * happy);
      blushMat.opacity = 0.22 + 0.3 * happy;
    }
    // mouth: a small smile on the front, below the eyes; opens with the gulp, droops when hungry, flat when asleep
    const mdir = _v.set(0, 0, 0).addScaledVector(Y_UP, 0.06 - 0.12 * droop).addScaledVector(forward, 1).normalize();
    const n = _v2;
    surfaceAlong(mdir, mouth.position, n);
    mouth.position.addScaledVector(n, -0.008);
    _m.lookAt(_s.set(0, 0, 0), _v4.copy(n).negate(), Y_UP);
    mouth.quaternion.setFromRotationMatrix(_m);
    const targetSmile = sleeping ? 0.35 : 1 - 0.7 * droop + 0.5 * Math.max(0, sim.mood);
    smileAmt += (targetSmile - smileAmt) * Math.min(1, dt * 5);
    const open = sim.gulp;
    mouth.rotation.z = Math.PI + Math.PI * 0.125;
    mouth.scale.set(1 + 0.3 * smileAmt, (0.25 + 0.75 * smileAmt) * (1 + 1.4 * open), 1);
    // the face scales a little with the body so a big pet gets big eyes (slowly)
    const fs = Math.pow(sim.R / 0.58, 0.55);
    eyes.forEach((e) => e.group.scale.multiplyScalar(fs));
    mouth.scale.multiplyScalar(fs);
    blush.forEach((b) => b.scale.multiplyScalar(fs));
  }

  function placeCells() {
    const n = sim.cells.length;
    body.count = n;
    const t = sim.time;
    for (let i = 0; i < n; i++) {
      const c = sim.cells[i];
      const age = t - c.born;
      let grow = 1;
      if (c.born > 0 && age < 0.7) { const k = age / 0.7; grow = 0.25 + 0.75 * (1 + 1.7 * Math.pow(k - 1, 3) + 0.7 * Math.pow(k - 1, 2)); }  // ease out back
      const s = c.r * grow * (1 + c.pulse * 0.5);
      const sq = c.squash;
      _s.set(s * (1 + 0.16 * sq), s * (1 - 0.26 * sq), s * (1 + 0.16 * sq));
      _m.compose(_v.set(c.x, c.y, c.z), _q.identity(), _s);
      body.setMatrixAt(i, _m);
    }
    body.instanceMatrix.needsUpdate = true;
  }

  function placeBerries() {
    for (let i = 0; i < berries.length; i++) {
      const g = berries[i], f = sim.foods[i];
      if (!f) { g.visible = false; continue; }
      g.visible = true;
      g.position.set(f.x, f.y, f.z);
      const s = f.r * (1 - f.eaten * 0.9);
      g.scale.setScalar(Math.max(0.001, s));
      g.rotation.y = f.id * 1.7;
    }
  }

  let cellsSeen = sim.cells.length;

  const pet = {
    sim, group, body, face,
    get name() { return sim.name; },
    get colour() { return sim.colour; },
    get count() { return sim.cells.length; },
    get radius() { return sim.R; },
    get hunger() { return sim.hunger; },
    get state() { return sim.state; },
    get center() { return center; },
    get ageText() { return formatAge(sim.ageMs); },

    /* step the creature. dt in seconds. Returns the events that happened ("eat", "grow", "poke", "sleep", "wake"). */
    update(dt) {
      sim.step(dt);
      if (sim.cells.length !== cellsSeen) { cellsSeen = sim.cells.length; recolourCells(); }
      placeCells();
      placeFace(dt);
      placeBerries();
      const ev = sim.drainEvents();
      if (ev.length && listeners.event) for (const e of ev) listeners.event(e, pet);
      return ev;
    },

    /* a berry falls at (x, z) on the ground (local to the group) */
    feed(x, z) { return sim.dropFood(x, z); },
    poke() { sim.poke(); },
    /* hold a point on the ground to lead it; null when the finger lifts */
    follow(point) { sim.follow(point); },
    /* a ray (THREE.Ray, in the group's space) - does it hit the creature? */
    hitTest(ray) { _sphere.set(center, sim.R * 1.15 + 0.05); return ray.intersectsSphere(_sphere); },
    /* where its person is (the camera, in the group's space): it turns to face them when it has nothing to do */
    facePerson(point) { sim.faceHint = point ? { x: point.x, z: point.z } : null; },
    /* 0 day .. 1 night: more inner glow, more naps */
    setNight(f) { night = Math.max(0, Math.min(1, f)); mat.userData.u.uGlowAmt.value = 0.16 + 0.7 * night; sim.nightHint = night; },
    setColour(id) { sim.colour = id; cols = colourSet(id); mat.color.copy(cols.base); mat.userData.u.uRim.value.copy(cols.rim); mat.userData.u.uDeep.value.copy(cols.deep); mat.userData.u.uGlow.value.copy(cols.glow); },
    setName(n) { sim.name = String(n || "").slice(0, 18) || sim.name; },
    onEvent(fn) { listeners.event = fn; },
    save() { return sim.toJSON(); },
    dispose() {
      if (group.parent) group.parent.remove(group);
      geo.dispose(); mat.dispose(); berryGeo.dispose(); berryMat.dispose(); leafGeo.dispose(); leafMat.dispose(); mouthMat.dispose(); blushMat.dispose();
      eyes.forEach((e) => e.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }));
    },
  };
  // first placement so it is visible before the first update
  placeCells(); placeFace(0); placeBerries();
  return pet;
}
