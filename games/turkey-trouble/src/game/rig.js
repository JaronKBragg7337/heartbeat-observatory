// Procedural animation by NODE NAME (see CONTRACT.md). Each node's rest pose is captured at load and every frame the pose
// is rest + offset, with offsets applied in the parent's space (+z forward, +y up). So the same code drives the
// placeholder turkey and the final model. THREE is passed in (from stage.THREE); this file never imports it.

const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

// Target pose per animation. Missing keys fall back to BASE.
const BASE = { crouch: 0, neck: 0, head: 0, yaw: 0, wing: 0.05, flap: 0, fan: 0.6, tailUp: 0, puff: 0, lean: 0, shake: 0, tuck: 0, sway: 0 };
const POSES = {
  idle: {},
  walk: { fan: 0.45, neck: 0.12 },
  run: { fan: 0.25, neck: 0.5, wing: 0.55, lean: 0.28, tailUp: -0.15 },
  hide: { crouch: 0.9, neck: -1.05, head: 0.95, fan: 0.0, wing: 0, tailUp: -0.55, lean: 0.12 },
  peek: { crouch: 0.3, neck: 0.3, head: -0.1, fan: 0.12, tailUp: -0.2 },
  gobble: { neck: 0.75, head: -0.25, shake: 1, puff: 0.6, fan: 1, wing: 0.28, tailUp: 0.15 },
  startled: { crouch: -0.15, flap: 1, wing: 0.9, puff: 0.5, fan: 0.95, neck: -0.2, head: 0.2 },
  peck: { neck: 0.35, fan: 0.7, puff: 0.3 },
  charge: { wing: 1.0, fan: 1.0, neck: 0.55, puff: 0.45, lean: 0.3, tailUp: 0.15, shake: 0.4 },
  knock: { neck: 0.25, fan: 0.65, puff: 0.15 },
  ride: { wing: 0.35, crouch: 0.15, fan: 0.4, sway: 1 },
  splash: { flap: 1, wing: 0.8, fan: 0.3, puff: 0.7, neck: -0.2 },
  hop: { flap: 1, wing: 0.95, fan: 0.8, tuck: 1, neck: 0.3, lean: 0.1 },
  tired: { neck: -0.1, head: 0.3, fan: 0.35, wing: 0.25, shake: 0.25 },
  sleep: {},
};
const KEYS = Object.keys(BASE);

function captureNodes(root, names) {
  const out = {};
  for (const n of names) {
    const node = root.getObjectByName(n);
    if (node) out[n] = { node, p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone() };
  }
  return out;
}

export function makeTurkeyRig(THREE, root) {
  const fanNames = []; for (let i = 0; i < 13; i++) fanNames.push('tf' + i);
  const N = captureNodes(root, ['body', 'neck1', 'neck2', 'head', 'beak', 'snood', 'wattle', 'tail', 'wingL', 'wingR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR', ...fanNames]);
  const fans = fanNames.map((n) => N[n]).filter(Boolean);
  const mid = N.tf6 || fans[Math.floor(fans.length / 2)];
  const e = new THREE.Euler(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion();
  const side = (n) => (n && n.p.x < 0 ? -1 : 1);
  const P = { ...BASE }; let t = 0, phase = 0;
  const bodyH = N.body ? N.body.p.y : 0.46;
  const WINGS = [N.wingL, N.wingR].filter(Boolean);
  const LEGS = [[N.thighL, N.shinL, N.footL, 0], [N.thighR, N.shinR, N.footR, Math.PI]];

  function rot(n, rx, ry, rz) {
    if (!n) return;
    e.set(rx, ry, rz, 'YXZ'); q.setFromEuler(e);
    n.node.quaternion.copy(n.q).premultiply(q);
  }

  // anim: name; animT: seconds in it; speed: m/s over the ground; x: extras { knock: 0..1 pulse, peck: 0..1 }
  function update(dt, anim, animT, speed, x) {
    t += dt;
    const pose = POSES[anim] || POSES.idle;
    for (const k of KEYS) P[k] = damp(P[k], pose[k] ?? BASE[k], anim === 'startled' || anim === 'hop' ? 16 : 9, dt);
    const moving = Math.min(1, speed / 1.2);
    phase += dt * speed * (Math.PI * 2) / 0.62;
    const stride = Math.min(0.75, 0.25 + speed * 0.1) * moving * (1 - P.tuck);
    const step = Math.sin(phase);
    const bob = Math.abs(Math.cos(phase)) * 0.035 * moving;

    // the head: the famous turkey head-bob while walking, a strike for a peck, two raps for the knock
    let strike = 0;
    if (anim === 'peck') { const k = Math.min(1, animT / 0.32); strike = k < 0.7 ? -0.25 * (k / 0.7) : 1.2 * Math.sin(((k - 0.7) / 0.3) * Math.PI); }
    if (x && x.knock) strike += x.knock * 1.1;
    const headBob = moving * Math.sin(phase * 2) * 0.18;
    const idleLook = anim === 'idle' || anim === 'peek' ? Math.sin(t * 0.9) * 0.6 + Math.sin(t * 2.3) * 0.15 : 0;

    if (N.body) {
      const b = N.body;
      b.node.position.copy(b.p);
      b.node.position.y = bodyH * (1 - 0.5 * P.crouch) + bob + (anim === 'startled' ? Math.max(0, Math.sin(Math.min(1, animT / 0.5) * Math.PI)) * 0.18 : 0);
      const sway = P.sway * Math.sin(t * 2.1) * 0.12;
      rot(b, P.lean + (anim === 'tired' ? Math.sin(t * 9) * 0.03 : 0), 0, sway + step * 0.04 * moving);
      const s = 1 + 0.12 * P.puff;
      b.node.scale.set(b.s.x * s, b.s.y * (1 + 0.06 * P.puff), b.s.z * s);
    }
    rot(N.neck1, P.neck * 0.8 + strike * 0.7 + headBob * 0.5, 0, 0);
    rot(N.neck2, P.neck * 0.35 + strike * 0.35 - headBob * 0.3, 0, 0);
    rot(N.head, -P.neck * 0.9 - strike * 0.6 + P.head, idleLook, P.shake * Math.sin(t * 31) * 0.12);
    rot(N.wattle, P.shake * Math.sin(t * 38) * 0.25 + moving * Math.sin(phase * 2) * 0.2, 0, P.shake * Math.sin(t * 41) * 0.55);
    rot(N.snood, 0, 0, P.shake * Math.sin(t * 29 + 1) * 0.5 + Math.sin(t * 1.7) * 0.08 + moving * Math.sin(phase * 2 + 0.5) * 0.25);

    // tail: fold every feather toward the middle one; tilt
    const spread = Math.max(0, Math.min(1, P.fan + (P.shake > 0.5 ? Math.sin(t * 22) * 0.04 : 0)));
    if (mid) for (const f of fans) { f.node.quaternion.copy(f.q).slerp(mid.q, 1 - spread); }
    rot(N.tail, P.tailUp - (1 - spread) * 0.35, 0, 0);

    // wings: out to the side, plus a flap
    const flap = P.flap * Math.sin(t * 30) * 0.75;
    for (const w of WINGS) {
      const sg = side(w);
      rot(w, -P.wing * 0.15, 0, sg * (P.wing * 1.05 + flap + (anim === 'run' ? Math.sin(phase) * 0.12 : 0)));
    }

    // legs
    for (let li = 0; li < 2; li++) {
      const th = LEGS[li][0], sh = LEGS[li][1], ft = LEGS[li][2], ph = LEGS[li][3];
      const s = Math.sin(phase + ph), lift = Math.max(0, Math.sin(phase + ph + 1.2));
      const c = Math.max(0, P.crouch);
      rot(th, -s * stride - c * 0.7 - P.tuck * 0.9, 0, 0);
      rot(sh, lift * stride * 1.1 + c * 1.25 + P.tuck * 1.4, 0, 0);
      rot(ft, -lift * stride * 0.6 - c * 0.55, 0, 0);
    }
  }
  return { update, nodes: N };
}

export function makeDogRig(THREE, root) {
  const N = captureNodes(root, ['body', 'head', 'tail', 'legFL', 'legFR', 'legRL', 'legRR']);
  const e = new THREE.Euler(), q = new THREE.Quaternion();
  let t = 0, phase = 0, sleep = 1;
  const bodyH = N.body ? N.body.p.y : 0.42;
  function rot(n, rx, ry, rz) { if (!n) return; e.set(rx, ry, rz, 'YXZ'); q.setFromEuler(e); n.node.quaternion.copy(n.q).premultiply(q); }
  function update(dt, anim, speed) {
    t += dt;
    sleep = damp(sleep, anim === 'sleep' ? 1 : 0, 4, dt);
    const moving = Math.min(1, speed / 1.0);
    phase += dt * speed * Math.PI * 2 / (speed > 3 ? 1.3 : 0.8);
    const gallop = speed > 3 ? 1 : 0;
    if (N.body) {
      N.body.node.position.copy(N.body.p);
      N.body.node.position.y = bodyH * (1 - 0.55 * sleep) + Math.abs(Math.sin(phase)) * 0.05 * moving + Math.sin(t * 1.4) * 0.008 * sleep;
      rot(N.body, gallop * Math.sin(phase) * 0.12, 0, sleep * 0.25);
    }
    const amp = 0.55 * moving;
    const s = Math.sin(phase), c = Math.sin(phase + (gallop ? 0.6 : Math.PI));
    rot(N.legFL, s * amp - sleep * 1.3, 0, 0); rot(N.legRR, (gallop ? c : s) * amp + sleep * 1.3, 0, 0);
    rot(N.legFR, -s * amp - sleep * 1.3, 0, 0); rot(N.legRL, -(gallop ? c : s) * amp + sleep * 1.3, 0, 0);
    rot(N.head, sleep * 0.55 + (anim === 'wake' ? Math.sin(t * 18) * 0.15 : 0) + moving * Math.sin(phase * 2) * 0.06, sleep * 0.3, 0);
    const wag = anim === 'sleep' ? Math.sin(t * 0.8) * 0.05 : Math.sin(t * (anim === 'run' ? 16 : 10)) * 0.6;
    rot(N.tail, -0.2 * (1 - sleep) + sleep * 0.5, wag, 0);
  }
  return { update };
}

// Spin every node whose name starts with "wheel_" about its parent's x axis.
export function makeWheelRig(THREE, root) {
  const wheels = [];
  root.traverse((o) => { if (o.name && o.name.startsWith('wheel_')) wheels.push({ node: o, q: o.quaternion.clone() }); });
  const q = new THREE.Quaternion(), ax = new THREE.Vector3(1, 0, 0);
  return { update(angle) { q.setFromAxisAngle(ax, angle); for (const w of wheels) w.node.quaternion.copy(w.q).premultiply(q); } };
}
