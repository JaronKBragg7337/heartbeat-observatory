// The thin view: it reads the rule state and moves three objects (from the stage) to match. All models are loaded once
// and reused across modes; vehicles and logs are pooled. Nothing here decides anything.
import { makeTurkeyRig, makeDogRig, makeWheelRig } from './rig.js';
import { DT } from './tuning.js';

const PEOPLE = ['ada', 'aoi', 'isaiah', 'jorge', 'sunita', 'walter', 'zuri'];
export { PEOPLE };

export async function createCast(stage, onProgress = () => {}) {
  const THREE = stage.THREE;
  const cast = { stage, THREE, people: new Map(), pools: new Map() };
  const turkey = await stage.loadModel('turkey');
  stage.dynamic.add(turkey);
  cast.turkey = { root: turkey, rig: makeTurkeyRig(THREE, turkey) };
  turkey.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  onProgress(0.3);
  const dog = await stage.loadModel('dog'); dog.visible = false; stage.dynamic.add(dog);
  cast.dog = { root: dog, rig: makeDogRig(THREE, dog) };
  const net = await stage.loadModel('net');
  cast.net = net;
  onProgress(0.4);
  cast.fallbackPerson = () => {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: 0x5a4a3c, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.1, 4, 10), m); body.position.y = 0.88; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshStandardMaterial({ color: 0xc9a080, roughness: 0.7 })); head.position.y = 1.62; g.add(head);
    return { root: g, mixer: null, actions: {}, height: 1.76 };
  };
  cast.person = async (id) => {
    if (cast.people.has(id)) return cast.people.get(id);
    let p;
    try { p = await stage.loadPerson(id); fixPersonScale(THREE, p); } catch (e) { console.warn('person failed', id, e); p = cast.fallbackPerson(); }
    const inner = p.root;
    const holder = new THREE.Group(); holder.name = 'actor_' + id; holder.add(inner); holder.visible = false;
    stage.dynamic.add(holder);
    const a = p.actions || {};
    if (a.Idle) { a.Idle.play(); a.Idle.setEffectiveWeight(1); }
    if (a.Walk) { a.Walk.play(); a.Walk.setEffectiveWeight(0); }
    const rec = { id, holder, inner, mixer: p.mixer, actions: a, walk: 0 };
    cast.people.set(id, rec);
    return rec;
  };
  // pooled models by kind
  cast.take = async (kind, n) => {
    let pool = cast.pools.get(kind);
    if (!pool) { pool = []; cast.pools.set(kind, pool); }
    while (pool.length < n) {
      const m = await stage.loadModel(kind); m.visible = false; stage.dynamic.add(m);
      pool.push({ root: m, wheels: makeWheelRig(THREE, m), size: m.userData.size || { w: 1, h: 1, l: 1 } });
    }
    return pool;
  };
  cast.hideAll = () => {
    cast.turkey.root.visible = false; cast.dog.root.visible = false;
    for (const p of cast.people.values()) p.holder.visible = false;
    for (const pool of cast.pools.values()) for (const m of pool) m.root.visible = false;
    if (cast.net.parent) cast.net.parent.remove(cast.net);
    stage.flashlight.visible = false;
  };
  return cast;
}

// stage v0 measures the person before its bones have world matrices, so the skinned body can come out ~94x too big.
// Measure the real skinned size here and bring it back to 1.76 m standing on y = 0. Harmless when the stage is right.
function fixPersonScale(THREE, p) {
  const inner = p.root.children[0]; if (!inner) return;
  const measure = () => {
    p.root.updateMatrixWorld(true);
    const box = new THREE.Box3(), b = new THREE.Box3();
    p.root.traverse((o) => { if (o.isSkinnedMesh) { o.skeleton && o.skeleton.update(); o.computeBoundingBox(); b.copy(o.boundingBox).applyMatrix4(o.matrixWorld); box.union(b); } else if (o.isMesh) { b.setFromObject(o); box.union(b); } });
    return box;
  };
  let box = measure();
  if (box.isEmpty()) return;
  const h = box.max.y - box.min.y;
  if (Math.abs(h - 1.76) > 0.15 && h > 0.01) { inner.scale.multiplyScalar(1.76 / h); box = measure(); }
  inner.position.y -= box.min.y;
}

function animatePerson(p, dt, speed, run) {
  if (!p.mixer) return;
  const w = Math.min(1, speed / 0.9);
  p.walk += (w - p.walk) * Math.min(1, dt * 8);
  const a = p.actions;
  if (a.Idle) a.Idle.setEffectiveWeight(1 - p.walk);
  if (a.Walk) { a.Walk.setEffectiveWeight(p.walk); a.Walk.timeScale = Math.max(0.7, Math.min(2.5, speed / 1.35)); }
  p.mixer.update(dt);
}

// Build the view for one game. Returns { beforeStep, update(dt, alpha), event(e) }.
export async function createView(cast, game, { personId, debug } = {}) {
  const { stage, THREE } = cast;
  cast.hideAll();
  const kind = game.kind;
  const T = cast.turkey, rootT = T.root;
  // where the creek's logs and ford stones sit (the look decides; layout.json carries the numbers)
  const creekLane = (((game.layout || stage.layout || {}).escape || {}).lanes || []).find((l) => l.kind === 'creek') || {};
  const CK = { logY: creekLane.logY ?? -0.05, rideY: creekLane.rideY ?? 0.42, stoneY: creekLane.stoneY ?? 0.16 };
  rootT.visible = true; rootT.rotation.set(0, 0, 0); rootT.scale.setScalar(1);
  const player = kind === 'escape' ? null : await cast.person(personId);
  if (player) { player.holder.visible = true; player.holder.rotation.set(0, 0, 0); }
  let farmer = null, dog = null, vehicles = [], prevV = null;
  if (kind === 'escape') {
    farmer = await cast.person(game.layout.escape.farmer.person || 'walter');
    farmer.holder.visible = true;
    farmer.holder.add(cast.net); cast.net.position.set(0.32, 0.95, 0.15); cast.net.rotation.set(0.35, 0, -0.15);
    dog = cast.dog; dog.root.visible = true;
    // pool: one model per rule vehicle, by kind
    const need = {};
    for (const v of game.vehicles) need[v.kind] = (need[v.kind] || 0) + 1;
    const pools = {};
    for (const k of Object.keys(need)) pools[k] = await cast.take(k, need[k]);
    const used = {};
    vehicles = game.vehicles.map((v) => { const i = used[v.kind] = (used[v.kind] || 0) + 1; const m = pools[v.kind][i - 1]; m.root.visible = true; return m; });
  }
  stage.flashlight.visible = kind !== 'escape';
  stage.flashlight.intensity = kind !== 'escape' ? 70 : 0;

  // interpolation: positions before the latest rule step
  const prev = { px: 0, pz: 0, tx: 0, tz: 0, fx: 0, fz: 0, dx: 0, dz: 0 };
  const P = game.player, TU = game.turkey;
  function beforeStep() {
    prev.px = P.x; prev.pz = P.z; prev.tx = TU.x; prev.tz = TU.z;
    if (game.farmer) { prev.fx = game.farmer.x; prev.fz = game.farmer.z; prev.dx = game.dog.x; prev.dz = game.dog.z; }
  }
  beforeStep();
  const lerp = (a, b, k) => a + (b - a) * k;
  let time = 0, blink = 0;
  const focus = { x: P.x, y: 0, z: P.z };

  // debug: draw the colliders
  let dbg = null;
  if (debug) {
    const pts = [];
    const W = game.world;
    for (const b of W.boxes) { const c = [[-b.hw, -b.hd], [b.hw, -b.hd], [b.hw, b.hd], [-b.hw, b.hd]].map(([lx, lz]) => [b.x + lx * b.c + lz * b.s, b.z - lx * b.s + lz * b.c]); for (let i = 0; i < 4; i++) { const a = c[i], d = c[(i + 1) % 4]; pts.push(a[0], 0.08, a[1], d[0], 0.08, d[1]); } }
    for (const c of W.circles) for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, d = ((i + 1) / 16) * Math.PI * 2; pts.push(c.x + Math.cos(a) * c.r, 0.08, c.z + Math.sin(a) * c.r, c.x + Math.cos(d) * c.r, 0.08, c.z + Math.sin(d) * c.r); }
    for (const s of W.segs) pts.push(s.x1, 0.08, s.z1, s.x2, 0.08, s.z2);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    dbg = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x44ff88 })); stage.dynamic.add(dbg);
  }

  function knockPulse() {
    const e = game.ending; if (!e || e.stage !== 'knock') return 0;
    const b = (x) => (x > 0 && x < 0.26 ? Math.sin((x / 0.26) * Math.PI) : 0);
    return Math.max(b(e.t - 0.55 + 0.13), b(e.t - 1.15 + 0.13));
  }
  const extras = { knock: 0 };

  function update(dt, alpha) {
    time += dt;
    const k = Math.max(0, Math.min(1, alpha));
    const gh = stage.groundHeight;
    // the player person (modes 1 to 3)
    if (player) {
      const x = lerp(prev.px, P.x, k), z = lerp(prev.pz, P.z, k);
      const h = player.holder;
      h.position.set(x, gh(x, z), z); h.rotation.y = P.heading;
      let lie = 0;
      if (game.dive) { if (game.dive.t > 0) lie = 1.25 * (1 - game.dive.t / 0.36); else if (game.dive.down > 0) lie = 1.25 * Math.min(1, game.dive.down / 0.35); }
      player.inner.rotation.x = lie; player.inner.position.y = lie > 0 ? 0.12 * Math.sin(lie) : 0;
      animatePerson(player, dt, lie > 0 ? 0 : P.speed, P.running);
      if (game.hud.invuln) { blink += dt; h.visible = Math.floor(blink * 12) % 2 === 0; } else { h.visible = true; blink = 0; }
      focus.x = x; focus.z = z; focus.y = gh(x, z);
      // the torch: chest height, a few meters ahead
      const fl = stage.flashlight, fx = Math.sin(P.heading), fz = Math.cos(P.heading);
      fl.position.set(x + fx * 0.25, focus.y + 1.35, z + fz * 0.25);
      fl.target.position.set(x + fx * 7, focus.y + 0.2, z + fz * 7); fl.target.updateMatrixWorld();
    }
    // the turkey
    {
      const x = lerp(prev.tx, TU.x, k), z = lerp(prev.tz, TU.z, k);
      let y = gh(x, z) + (TU.y || 0);
      if (kind === 'escape') { if (TU.onLog) y += CK.rideY + Math.sin(time * 2 + TU.onLog.id) * 0.03; else if (TU.onStone) y += CK.stoneY; }
      rootT.position.set(x, y, z); rootT.rotation.y = TU.heading;
      extras.knock = knockPulse();
      T.rig.update(dt, TU.anim, TU.animT, TU.speed, extras);
      if (kind === 'escape') {
        focus.x = x; focus.z = z; focus.y = gh(x, z);
        if (TU.invuln > 0 && game.phase === 'play') { blink += dt; rootT.visible = Math.floor(blink * 12) % 2 === 0; } else { rootT.visible = true; blink = 0; }
      }
    }
    if (farmer) {
      const F = game.farmer, x = lerp(prev.fx, F.x, k), z = lerp(prev.fz, F.z, k);
      farmer.holder.position.set(x, gh(x, z), z); farmer.holder.rotation.y = F.heading;
      animatePerson(farmer, dt, F.speed, F.anim === 'run');
      cast.net.rotation.x = F.anim === 'swing' ? 1.4 : F.anim === 'run' ? 0.7 : 0.35;
      // in the yard the farmer carries the torch: it is his eyes
      const fl = stage.flashlight, inYard = TU.z < 2;
      fl.visible = inYard; fl.intensity = inYard ? 80 : 0;
      if (inYard) {
        const fx = Math.sin(F.heading), fz = Math.cos(F.heading);
        fl.position.set(x + fx * 0.3, gh(x, z) + 1.4, z + fz * 0.3); fl.target.position.set(x + fx * 8, 0.1, z + fz * 8); fl.target.updateMatrixWorld();
      }
      const D = game.dog, dx = lerp(prev.dx, D.x, k), dz = lerp(prev.dz, D.z, k);
      dog.root.position.set(dx, gh(dx, dz), dz); dog.root.rotation.y = D.heading;
      dog.rig.update(dt, D.anim, D.speed);
    }
    if (vehicles.length) {
      const su = game.speedUp(), back = (1 - k) * DT;
      for (let i = 0; i < vehicles.length; i++) {
        const v = game.vehicles[i], m = vehicles[i];
        const vx = v.x - v.dir * v.sub.speed * su * back;
        // only what the camera can see (it looks mostly south): fewer draw calls on the phone
        const dz = v.z - focus.z, near = dz > -24 && dz < 48 && Math.abs(vx - focus.x) < 52 + v.l / 2;
        m.root.visible = near;
        if (!near) continue;
        if (v.kind === 'log') {
          m.root.position.set(vx, gh(vx, v.z) + CK.logY + Math.sin(time * 1.6 + i) * 0.03, v.z);
          m.root.rotation.set(Math.sin(time * 1.1 + i) * 0.03, Math.PI / 2, 0);
          m.root.scale.set(1, 1, v.l / (m.size.l || 4));
        } else {
          m.root.position.set(vx, gh(vx, v.z), v.z);
          m.root.rotation.y = v.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          m.wheels.update(v.wheel * v.dir);
        }
      }
    }
    return focus;
  }

  function dispose() { if (dbg) { stage.dynamic.remove(dbg); dbg.geometry.dispose(); } }
  return { beforeStep, update, dispose, focus, player, farmer };
}
