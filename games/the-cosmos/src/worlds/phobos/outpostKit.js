// ============================================================================
// worlds/phobos/outpostKit.js - what the two small-moon outposts (Stickney East on Phobos, the survey camp on Deimos) are drawn with.
// Client only, decoration only: nothing here is known to the server, nobody here talks or trades.
//
// It stands on the Moon's settlement kit (worlds/moon/kit.js: merged geometry, one mesh per material) and adds what a body with almost
// no gravity needs: anchor piles, guy cables, tie-down straps, tether lines to clip on to, a hopper instead of a rover; plus the night
// (lamp heads are unlit emissive material; the light they throw on the ground is one additive mesh, faded in after sunset: no THREE lights),
// one sign texture, one strobe mesh, and a few suited people (the same Loft people as everywhere, dressed by crew/suitPolicy.js).
//
// Coordinates are outpost-local metres (worlds/moon/place.js): x EAST, y UP, z SOUTH, origin the middle of the landing pad.
// ============================================================================
import * as THREE from 'three';
import { makeKit, canvasTexture, rng } from '../moon/kit.js';
import { frameToOutpost, outpostToFrame, bleedSideways } from '../moon/place.js';
import { Person } from '../../crew/personRig.js';
import { dressForWorld } from '../../crew/suitPolicy.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** The suited people of an outpost. `specs`: [{ body, x, z, face (radians, 0 = looks south), cloth, path: [[x, z], ...], pause }]. */
class Folk {
  constructor(o) { Object.assign(this, o); this.members = []; this.built = false; }
  async build() {
    if (this.built || !this.library) return this;
    this.built = true;
    const roster = await this.library.roster();
    for (const w of this.specs) {
      const r = roster.find((q) => q.id === w.body) || roster[0];
      const person = r ? this.library.spawn(r.id, r.file) : new Person(w.body);
      const look = { personId: w.body, cloth: w.cloth ?? 0xd9772b, helmet: true, visorTint: 0x20262e, visorOpacity: 0.7 };
      person.dress(look);
      dressForWorld(person, this.body, look);
      person.group.position.set(w.x, this.G(w.x, w.z) + 0.02, w.z);
      person.group.rotation.y = w.face || 0;
      person.play('Idle', 0);
      person.group.visible = false;
      this.root.add(person.group);
      this.members.push({ ...w, person, leg: 0, dir: 1, wait: w.path ? 2 + this.members.length * 3 : 0, walking: false });
    }
    await Promise.all(this.members.map((m) => m.person.ready));
    return this;
  }
  /** `c` is the camera in outpost-local metres. A walker goes to and fro along his path, stopping at each end. */
  tick(dt, c) {
    if (!this.built) return;
    const range = this.library && this.library.phone ? 110 : 220;
    for (const m of this.members) {
      const g = m.person.group, near = Math.hypot(c.x - g.position.x, c.y, c.z - g.position.z) < range;
      g.visible = near;
      if (!near) continue;
      let speed = 0;
      if (m.path) {
        if (m.wait > 0) {
          m.wait -= dt;
          if (m.walking) { m.walking = false; m.person.play('Idle', 0.5); }
        } else {
          if (!m.walking) { m.walking = true; m.person.play('Walk', 0.5); }
          speed = m.speed || 0.55;
          const to = m.path[m.leg + (m.dir > 0 ? 1 : 0)], dx = to[0] - g.position.x, dz = to[1] - g.position.z, d = Math.hypot(dx, dz), step = speed * dt;
          if (d <= step) {
            g.position.x = to[0]; g.position.z = to[1];
            m.leg += m.dir;
            if (m.leg < 0 || m.leg >= m.path.length - 1) { m.dir = -m.dir; m.leg += m.dir; m.wait = m.pause ?? 9; }
          } else {
            g.position.x += dx / d * step; g.position.z += dz / d * step;
            let da = Math.atan2(dx, dz) - g.rotation.y; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
            g.rotation.y += da * Math.min(1, dt * 3);
          }
          g.position.y = this.G(g.position.x, g.position.z) + 0.02;
        }
      }
      m.person.update(dt, speed);
    }
  }
}

/**
 * One outpost. `ctx` = { engine, world, space, tier }. Returns S: the Moon kit (S.K) and the small-moon helpers. Build with them, then
 * `S.finish()` gives the handle a world's client.js returns ({ update(dt, focus), dispose() }).
 * `o.bag`: the colour of the berm's regolith bags.
 */
export function makeSite(ctx, o = {}) {
  const { engine, world, space } = ctx;
  const K = makeKit(ctx), k = K.k, { low, body, pi, B, X, cyl, pipe } = K;
  let ox = 0, oz = 0;                                             // S.shift: the whole of what is drawn inside it stands this far east / south
  const G = (x, z) => K.groundY(x + ox, z + oz);
  // regolith in bags and sintered courses: what a berm is built of when nothing stays where you pile it
  K.mats.regolith = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, metalness: 0, map: canvasTexture(low ? 128 : 256, (g, N) => {
    const r = rng(o.seed || 5); g.fillStyle = '#b9b5ae'; g.fillRect(0, 0, N, N);
    for (let i = 0; i < N * 10; i++) { const v = 150 + Math.floor(r() * 70); g.fillStyle = `rgba(${v},${v - 3},${v - 8},0.4)`; g.fillRect(r() * N, r() * N, 1 + r() * 2, 1 + r() * 2); }
    const rows = 8, h = N / rows;
    for (let j = 0; j < rows; j++) {
      g.fillStyle = 'rgba(40,38,36,0.4)'; g.fillRect(0, j * h, N, 2);
      g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(0, j * h + 2, N, 2);
      for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(40,38,36,0.3)'; g.fillRect(((i + (j % 2) * 0.5 + (r() - 0.5) * 0.12) / 4) * N, j * h, 2, h); }
    }
  }, 4) });
  k.tiles.regolith = 2.6;
  K.mats.dust = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, metalness: 0 });        // loose regolith: spoil heaps
  const BAG = o.bag || [0.5, 0.47, 0.44];
  const S = { K, G, low, body, pi, boxes: [], folkSpecs: [] };

  /** Draw in a frame standing on the ground at (x, z), turned `rot` (kit yaw: +x swings toward north). */
  S.at = (x, z, rot, fn, y = 0) => { k.push(x, G(x, z) + y, z, rot); fn(); k.pop(); };
  /** A point of that frame in outpost metres (for the piles and cables that leave it). */
  S.abs = (x, z, rot, lx, lz) => { const c = Math.cos(rot), s = Math.sin(rot); return [x + c * lx + s * lz, z - s * lx + c * lz]; };
  /** Build `fn` moved (dx east, dz south): a camp laid out round one origin can be slid clear of the pad in one line. */
  S.shift = (dx, dz, fn) => { k.push(dx, 0, dz, 0); ox += dx; oz += dz; fn(); ox -= dx; oz -= dz; k.pop(); };
  /** A solid the walker is kept out of. */
  S.box = (x0, z0, x1, z1, h = 3) => S.boxes.push({ x0: Math.min(x0, x1) + ox, z0: Math.min(z0, z1) + oz, x1: Math.max(x0, x1) + ox, z1: Math.max(z0, z1) + oz, h });

  /** An anchor pile: a screw pile driven into the regolith, a yellow cap and a shackle plate. Everything here is tied to one. */
  S.pile = (x, z) => { const g = G(x, z); cyl('steelDark', x, g + 0.18, z, 0.055, 0.5, 6); X('hazard', x, g + 0.45, z, 0.15, 0.05, 0.15); X('steelDark', x, g + 0.02, z, 0.34, 0.03, 0.34); return [x, g + 0.4, z]; };
  /** A guy cable or lashing from a point down to a new pile at (x, z). */
  S.guy = (from, x, z, r = 0.016, key = 'steelDark') => { const p = S.pile(x, z); pipe(key, from, p, r, 4); };
  /** A bank of regolith bags: base rectangle b = [x0, z0, x1, z1], crown rectangle t (inside it), `h` high. Keep every slope steeper than
   *  45 degrees (run < h): the bag courses then lie level on all four faces. */
  S.mound = (b, t, h, col = BAG) => {
    const g = Math.min(G(b[0], b[1]), G(b[2], b[1]), G(b[0], b[3]), G(b[2], b[3]), G((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)), y0 = g - 0.3, y1 = g + h;
    const bb = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]], tt = [[t[0], t[1]], [t[2], t[1]], [t[2], t[3]], [t[0], t[3]]], out = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    k._faceQuad('regolith', tt.map((p) => [p[0], y1, p[1]]), [0, 1, 0], [col[0] * 1.08, col[1] * 1.08, col[2] * 1.08]);
    for (let i = 0; i < 4; i++) { const a = bb[i], c = bb[(i + 1) % 4], ta = tt[i], tc = tt[(i + 1) % 4]; k._faceQuad('regolith', [[a[0], y0, a[1]], [c[0], y0, c[1]], [tc[0], y1, tc[1]], [ta[0], y1, ta[1]]], [out[i][0], 0.5, out[i][1]], col); }
  };
  /** A loose heap of dug regolith (spoil). */
  S.heap = (x, z, r, h, col = BAG) => { const g = G(x, z); k.dome('dust', x, g - 0.12, z, r, low ? 10 : 16, low ? 4 : 6, { thetaMax: Math.PI / 2, scaleY: (h + 0.12) / r, col: [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8] }); };

  // ---- the night: light pools on the ground (one additive mesh), strobes (one mesh), signs (one mesh, one texture) ----
  const poolPos = [], poolCol = [];
  /** Lamplight on the ground round (x, z): bright under the lamp, gone at `r`. */
  S.pool = (x, z, r, col = [1, 0.9, 0.7], y = 0.06) => {
    const n = low ? 10 : 18, g = G(x, z) + y, X0 = x + ox, Z0 = z + oz, RING = [[0, 1], [0.22, 0.62], [0.5, 0.26], [0.78, 0.07], [1, 0]];
    for (let j = 0; j < RING.length - 1; j++) for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, [r0, k0] = RING[j], [r1, k1] = RING[j + 1];
      const P = (a, rr) => [X0 + Math.cos(a) * r * rr, g, Z0 + Math.sin(a) * r * rr], C = (kk) => [col[0] * kk, col[1] * kk, col[2] * kk];
      if (j) { poolPos.push(...P(a0, r0), ...P(a1, r0), ...P(a1, r1)); poolCol.push(...C(k0), ...C(k0), ...C(k1)); }
      poolPos.push(...P(a0, r0), ...P(a1, r1), ...P(a0, r1)); poolCol.push(...C(k0), ...C(k1), ...C(k1));
    }
  };
  const strobePos = [];
  /** A strobe head at a point (all the strobes of a site flash together). */
  S.strobe = (x, y, z, s = 0.16) => {
    const v = [[-s, -s, -s], [s, -s, -s], [s, s, -s], [-s, s, -s], [-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s]];
    for (const [a, b, c] of [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [2, 3, 7], [2, 7, 6], [1, 2, 6], [1, 6, 5], [0, 4, 7], [0, 7, 3]]) for (const i of [a, b, c]) strobePos.push(x + ox + v[i][0], y + v[i][1], z + oz + v[i][2]);
  };
  const signs = [];
  /** A lit sign plate on two posts: centre (x, z) at height `y`, w x h metres, facing `yaw` (0 looks south, -PI/2 looks west).
   *  lines: [{ t, s (letter height, metres), c (css colour) }], top to bottom. */
  S.sign = (x, y, z, w, h, yaw, lines, so = {}) => {
    signs.push({ x: x + ox, y: y + G(x, z), z: z + oz, w, h, yaw, lines, so });
    S.at(x, z, yaw, () => {
      B('steelDark', 0, y, -0.05, w + 0.14, h + 0.14, 0.06, [0.6, 0.6, 0.62], 0.02);
      if (so.posts !== false) for (const s of [-1, 1]) { X('steelDark', s * w * 0.36, y / 2, -0.12, 0.08, y, 0.08); }
      X('glowWhite', 0, y + h / 2 + 0.1, 0.06, w * 0.7, 0.05, 0.1, [0.9, 0.9, 0.85]); X('steelDark', 0, y + h / 2 + 0.14, 0.02, w * 0.74, 0.04, 0.2);     // the strip lamp over the plate
    });
    if (so.posts !== false) for (const s of [-1, 1]) { const [px, pz] = S.abs(x, z, yaw, s * w * 0.36, -0.12), [qx, qz] = S.abs(x, z, yaw, s * w * 0.36, -1.5); S.guy([px, y + G(x, z), pz], qx, qz); }
  };

  /** A lamp on a guyed pole, its light on the ground. */
  S.lamp = (x, z, h = 5, glow = 'glowWhite', r = 9, col = [0.95, 0.9, 0.8]) => {
    const g = G(x, z);
    cyl('steelDark', x, g + h / 2, z, 0.07, h, 6, { r2: 0.05 }); B('steelDark', x, g + h, z, 0.7, 0.1, 0.3, null, 0.02); X(glow, x, g + h - 0.07, z, 0.6, 0.05, 0.22);
    for (let i = 0; i < 3; i++) { const a = i * 2.094 + x; S.guy([x, g + h * 0.8, z], x + Math.cos(a) * h * 0.35, z + Math.sin(a) * h * 0.35, 0.012); }
    if (r) S.pool(x, z, r, col);
  };
  /** A ring of low pad-edge lights. */
  S.edgeLights = (R, n, glow = 'glowCyan', col = [0.25, 0.75, 0.95], phase = 0.5) => {
    for (let i = 0; i < n; i++) {
      const a = (i + phase) / n * Math.PI * 2, x = Math.cos(a) * R, z = Math.sin(a) * R, g = G(x, z);
      cyl('steelDark', x, g + 0.14, z, 0.07, 0.28, 6); X(glow, x, g + 0.32, z, 0.17, 0.09, 0.17); X('steelDark', x, g + 0.015, z, 0.4, 0.03, 0.4);
      S.pool(x, z, 1.6, [col[0] * 0.7, col[1] * 0.7, col[2] * 0.7], 0.05);
    }
  };
  /** A tether line: low posts with a cable to clip on to (nobody walks free where escape velocity is a good jump). pts: [[x, z], ...]. */
  S.tether = (pts, h = 1.05) => {
    let prev = null;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 3.2));
      for (let j = i ? 1 : 0; j <= n; j++) {
        const x = ax + (bx - ax) * j / n, z = az + (bz - az) * j / n, g = G(x, z);
        cyl('steelDark', x, g + h / 2, z, 0.028, h, 5); X('hazard', x, g + h + 0.02, z, 0.09, 0.05, 0.09);
        if (prev) pipe('pipeYellow', prev, [x, g + h - 0.04, z], 0.011, 4);
        prev = [x, g + h - 0.04, z];
      }
    }
  };
  /** A cargo container (6 x 2.4 x 2.4 m by default), ribbed, lashed over the top to piles on both sides. `y0` stacks it. */
  S.container = (x, z, rot, col, y0 = 0, L = 6, W = 2.4, H = 2.4) => {
    S.at(x, z, rot, () => {
      B('paint', 0, H / 2, 0, L, H, W, col, 0.04);
      const dk = [col[0] * 0.72, col[1] * 0.72, col[2] * 0.72];
      for (let t = -L / 2 + 0.4; t < L / 2 - 0.2; t += low ? 1.2 : 0.6) for (const s of [-1, 1]) X('paint', t, H / 2, s * (W / 2 + 0.015), 0.16, H - 0.3, 0.03, dk);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) X('steelDark', sx * (L / 2 - 0.07), H / 2, sz * (W / 2 - 0.07), 0.16, H + 0.02, 0.16);
      for (const s of [-0.5, 0.5]) { X('steelDark', L / 2 + 0.02, H / 2, s * 0.9, 0.04, H - 0.4, 0.06); X('steelDark', L / 2 + 0.03, H * 0.45, s * 0.9, 0.05, 0.1, 0.3); }
      X('white', L / 2 + 0.012, H * 0.8, 0, 0.02, 0.3, 1.2);                                  // the label plate on the doors
      for (const sx of [-L * 0.3, L * 0.3]) { X('hazard', sx, H / 2, W / 2 + 0.035, 0.09, H, 0.015); X('hazard', sx, H / 2, -W / 2 - 0.035, 0.09, H, 0.015); X('hazard', sx, H + 0.012, 0, 0.09, 0.02, W + 0.07); }
    }, y0);
    if (!y0) { for (const sx of [-L * 0.3, L * 0.3]) for (const s of [-1, 1]) { const [px, pz] = S.abs(x, z, rot, sx, s * (W / 2 + 0.04)), [qx, qz] = S.abs(x, z, rot, sx, s * (W / 2 + 0.75)); S.guy([px, G(x, z) + 0.5, pz], qx, qz, 0.02, 'pipeYellow'); }
      const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot)), hx = (L * c + W * s) / 2, hz = (L * s + W * c) / 2; S.box(x - hx, z - hz, x + hx, z + hz, H + y0 + 2.4); }
  };
  /** A lashed pile of crates under a cargo net: `list` = [[lx, lz, w, h, d, colourKey, y]], net over the box (W x H x D) round them. */
  S.cratePile = (x, z, rot, list, W, H, D) => {
    S.at(x, z, rot, () => {
      for (const [lx, lz, w, h, d, key, y] of list) { B(key || 'crateA', lx, (y || 0) + h / 2, lz, w, h, d, null, 0.03); X('steelDark', lx, (y || 0) + h / 2, lz + d / 2 + 0.006, w * 0.9, 0.05, 0.01); }
      const st = low ? 0.6 : 0.3, t = 0.012, c = [0.5, 0.46, 0.34];
      for (let u = -W / 2; u <= W / 2 + 0.01; u += st) { X('paint', u, H + 0.03, 0, t, t, D + 0.06, c); X('paint', u, H / 2, D / 2 + 0.03, t, H, t, c); X('paint', u, H / 2, -D / 2 - 0.03, t, H, t, c); }
      for (let v = -D / 2; v <= D / 2 + 0.01; v += st) { X('paint', 0, H + 0.03, v, W + 0.06, t, t, c); X('paint', W / 2 + 0.03, H / 2, v, t, H, t, c); X('paint', -W / 2 - 0.03, H / 2, v, t, H, t, c); }
      for (let y = st; y < H; y += st) { X('paint', 0, y, D / 2 + 0.03, W + 0.06, t, t, c); X('paint', 0, y, -D / 2 - 0.03, W + 0.06, t, t, c); X('paint', W / 2 + 0.03, y, 0, t, t, D + 0.06, c); X('paint', -W / 2 - 0.03, y, 0, t, t, D + 0.06, c); }
    });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const [px, pz] = S.abs(x, z, rot, sx * W / 2, sz * D / 2), [qx, qz] = S.abs(x, z, rot, sx * (W / 2 + 0.6), sz * (D / 2 + 0.6)); S.guy([px, G(x, z) + H * 0.5, pz], qx, qz, 0.014, 'pipeYellow'); }
    const R = Math.hypot(W, D) / 2; S.box(x - R * 0.8, z - R * 0.8, x + R * 0.8, z + R * 0.8, H + 2);
  };
  /** A row of solar wings on braced posts, each foot on a pile. Faces `yaw` (kit yaw; PI looks north), leaning back `tilt` from upright. */
  S.solarRow = (xs, z, w, h, yaw, tilt, y = 2.3) => {
    for (const x of xs) {
      const g = G(x, z);
      K.solarWing(x, g + y, z, w, h, yaw, tilt);
      for (const s of [-1, 1]) {
        const px = x + s * w * 0.3;
        cyl('steelDark', px, g + y / 2, z, 0.06, y, 6); X('steelDark', px, g + 0.03, z, 0.5, 0.05, 0.5);
        S.guy([px, g + y * 0.85, z], px, z + 1.5, 0.014); S.guy([px, g + y * 0.85, z], px, z - 1.5, 0.014);
      }
      pipe('steelDark', [x - w * 0.3, g + y, z], [x + w * 0.3, g + y, z], 0.05, 6);                // the torque tube the wing turns on
      B('steelDark', x, g + y - 0.2, z, 0.3, 0.3, 0.3, null, 0.03);
    }
    const x0 = xs[0], x1 = xs[xs.length - 1];
    pipe('rubber', [x0, G(x0, z) + 0.06, z + 0.5], [x1 + w / 2 + 1, G(x1, z) + 0.06, z + 0.5], 0.035, 4);
  };
  /** A cable or hose lying on the ground through the points [[x, z], ...]. */
  S.cable = (pts, r = 0.035, key = 'rubber', y = 0.05) => { for (let i = 0; i < pts.length - 1; i++) pipe(key, [pts[i][0], G(pts[i][0], pts[i][1]) + y, pts[i][1]], [pts[i + 1][0], G(pts[i + 1][0], pts[i + 1][1]) + y, pts[i + 1][1]], r, 4); };
  /** The crew hopper: a cold-gas platform two people ride standing, clipped to its rail. Parked, and lashed down like everything else. */
  S.hopper = (x, z, rot) => {
    S.at(x, z, rot, () => {
      B('steelDark', 0, 0.95, 0, 2.6, 0.1, 1.8, [1.3, 1.3, 1.35], 0.03);
      X('hazard', 0, 1.005, 0.84, 2.5, 0.012, 0.1); X('hazard', 0, 1.005, -0.84, 2.5, 0.012, 0.1);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        pipe('steel', [sx * 1.15, 0.92, sz * 0.8], [sx * 1.8, 0.1, sz * 1.35], 0.045, 6); cyl('steelDark', sx * 1.8, 0.05, sz * 1.35, 0.24, 0.1, 8);
        pipe('steelDark', [sx * 0.5, 0.92, sz * 0.5], [sx * 1.6, 0.34, sz * 1.2], 0.025, 4);
        B('gunmetal', sx * 1.32, 1.02, sz * 0.92, 0.26, 0.26, 0.26, null, 0.03);                                             // thruster quad
        cyl('gunmetal', sx * 1.32, 0.84, sz * 0.92, 0.06, 0.14, 8, { r2: 0.1 }); cyl('gunmetal', sx * 1.5, 1.02, sz * 0.92, 0.1, 0.12, 8, { r2: 0.06, axis: 'x' });
      }
      for (const sx of [-0.62, 0.62]) { k.dome('white', sx, 0.52, 0, 0.4, low ? 8 : 12, low ? 5 : 8); cyl('steelDark', sx, 0.52, 0, 0.41, 0.06, 10); }
      cyl('pipeYellow', 0, 0.55, 0, 0.16, 1.5, 8, { axis: 'z' });
      // the rail the riders clip to, and the control post
      for (const sx of [-1.2, 1.2]) pipe('steel', [sx, 1.0, -0.8], [sx, 2.0, -0.8], 0.03, 5);
      pipe('steel', [-1.2, 2.0, -0.8], [1.2, 2.0, -0.8], 0.03, 5); pipe('steel', [-1.2, 1.5, -0.8], [1.2, 1.5, -0.8], 0.022, 5);
      pipe('steel', [0, 1.0, -0.45], [0, 1.95, -0.6], 0.04, 5); B('plasticDark', 0, 2.02, -0.62, 0.5, 0.3, 0.12, null, 0.02); X('glowCyan', 0, 2.02, -0.555, 0.36, 0.18, 0.01, [0.6, 0.6, 0.6]);
      for (const sx of [-0.5, 0.5]) { B('rubber', sx, 1.03, 0.2, 0.34, 0.06, 0.5, null, 0.02); pipe('steelDark', [sx - 0.15, 1.0, 0.3], [sx + 0.15, 1.0, 0.3], 0.02, 4); }     // foot plates and their toe bars
      B('crateB', 0.85, 1.22, 0.5, 0.6, 0.44, 0.5, null, 0.03); X('hazard', 0.85, 1.22, 0.5, 0.07, 0.46, 0.52);
    });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const [px, pz] = S.abs(x, z, rot, sx * 1.25, sz * 0.88), [qx, qz] = S.abs(x, z, rot, sx * 2.5, sz * 2.0); S.guy([px, G(x, z) + 0.95, pz], qx, qz, 0.016, 'pipeYellow'); }
    S.box(x - 1.4, z - 1.4, x + 1.4, z + 1.4, 2.2);
  };
  /** A gas bottle rack: `n` bottles upright in a frame. */
  S.bottles = (x, z, rot, n = 4, key = 'white') => S.at(x, z, rot, () => {
    for (let i = 0; i < n; i++) { const lx = (i - (n - 1) / 2) * 0.42; cyl(key, lx, 0.75, 0, 0.17, 1.3, 8); k.dome(key, lx, 1.4, 0, 0.17, 8, 4, { thetaMax: Math.PI / 2 }); cyl('steelDark', lx, 1.6, 0, 0.04, 0.1, 5); }
    B('steelDark', 0, 0.06, 0, n * 0.42 + 0.2, 0.1, 0.5, null, 0.02); X('steelDark', 0, 1.0, 0.2, n * 0.42 + 0.2, 0.05, 0.03); X('steelDark', 0, 1.0, -0.2, n * 0.42 + 0.2, 0.05, 0.03); X('hazard', 0, 0.5, 0.2, n * 0.42 + 0.2, 0.05, 0.03);
  });
  /** People: standing at a task, or walking a path. */
  S.person = (spec) => S.folkSpecs.push({ ...spec, x: spec.x + ox, z: spec.z + oz, path: spec.path ? spec.path.map(([x, z]) => [x + ox, z + oz]) : null });

  /** Merge, place, and return the handle the world's client gives moonWorld.js. */
  S.finish = () => {
    const poolMat = new THREE.MeshBasicMaterial({ color: 0x000000, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
    const strobeMat = new THREE.MeshBasicMaterial({ color: 0x3a0806, toneMapped: false, fog: false });
    let poolMesh = null, signMat = null, signTex = null;
    const handle = K.finish({ extra: (root) => {
      if (poolPos.length) {
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(poolPos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(poolCol, 3));
        poolMesh = new THREE.Mesh(geo, poolMat); poolMesh.name = 'outpost-lamplight'; poolMesh.renderOrder = 3; poolMesh.visible = false; root.add(poolMesh);
      }
      if (strobePos.length) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(strobePos, 3)); const m = new THREE.Mesh(geo, strobeMat); m.name = 'outpost-strobes'; root.add(m); }
      if (signs.length) {
        const n = signs.length, N = low ? 512 : 1024, H = N / n, c = document.createElement('canvas'); c.width = c.height = N;
        const g = c.getContext('2d'), pos = [], uv = [], idx = [];
        signs.forEach((s, i) => {
          g.save(); g.translate(0, i * H); g.scale(N / (s.w * 100), H / (s.h * 100));                 // draw in centimetres of the plate
          g.fillStyle = s.so.bg || '#0d1216'; g.fillRect(0, 0, s.w * 100, s.h * 100);
          g.strokeStyle = s.so.edge || '#e8b53a'; g.lineWidth = 5; g.strokeRect(6, 6, s.w * 100 - 12, s.h * 100 - 12);
          const total = s.lines.reduce((a, l) => a + l.s * 150, 0); let y = (s.h * 100 - total) / 2;
          g.textAlign = 'center'; g.textBaseline = 'middle';
          for (const l of s.lines) { g.font = `${l.b === false ? '' : 'bold '}${Math.round(l.s * 100)}px sans-serif`; g.fillStyle = l.c || '#f2efe6'; g.fillText(l.t, s.w * 50, y + l.s * 75, s.w * 100 - 30); y += l.s * 150; }
          g.restore();
          const cs = Math.cos(s.yaw), sn = Math.sin(s.yaw), b = pos.length / 3;
          for (const [lx, ly] of [[-s.w / 2, -s.h / 2], [s.w / 2, -s.h / 2], [s.w / 2, s.h / 2], [-s.w / 2, s.h / 2]]) { pos.push(s.x + cs * lx, s.y + ly, s.z - sn * lx); uv.push(lx < 0 ? 0 : 1, 1 - (i + (ly < 0 ? 1 : 0)) / n); }
          idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
        });
        signTex = new THREE.CanvasTexture(c); signTex.colorSpace = THREE.SRGBColorSpace; signTex.anisotropy = 4;
        signMat = new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false, fog: false });
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
        const m = new THREE.Mesh(geo, signMat); m.name = 'outpost-signs'; root.add(m);
      }
    } });
    const root = handle.root;
    root.name = 'outpost:' + body.id; root.visible = false;
    const folk = new Folk({ root, library: space.peopleLib || null, body, G: K.groundY, specs: S.folkSpecs });
    let t = 0, night = 0;
    const up = pi.up, r = 0.38;
    return {
      root, folk, boxes: S.boxes,                                 // (not `people`: that name is what the Talk button looks for)
      update(dt, focus) {
        const c = frameToOutpost(pi, focus);
        const near = Math.hypot(c.x, c.y, c.z) < 9000;             // from further off it is under a pixel: do not draw it, do not tick it
        root.visible = near;
        if (!near) return;
        t += dt;
        if (space.frameId === body.id) { const s = space.sunLocal, l = Math.hypot(s.x, s.y, s.z) || 1; night = clamp01((0.1 - (s.x * up.x + s.y * up.y + s.z * up.z) / l) / 0.2); }
        if (poolMesh) { poolMesh.visible = night > 0.02; poolMat.color.setScalar(night * 0.3); }
        strobeMat.color.setHex(t % 1.6 < 0.12 || (t + 0.3) % 1.6 < 0.1 ? 0xff3a28 : 0x3a0806);
        handle.tick(dt, t);
        if (!folk.built && space.peopleLib) { folk.library = space.peopleLib; folk.build().catch((e) => console.error(body.id + ' outpost people failed', e)); }
        if (Math.abs(c.x) < 400 && Math.abs(c.z) < 400) folk.tick(dt, c);
        // the walker is kept out of the solid things, as at every outpost
        const w = space.walker;
        if (w && !space.ship.aboard && space.frameId === body.id) {
          const p = frameToOutpost(pi, w.worldPos);
          if (Math.abs(p.x) < 120 && Math.abs(p.z) < 120) {
            let pushed = false;
            for (const b of S.boxes) {
              if (p.y > 0.4 + b.h || p.x <= b.x0 - r || p.x >= b.x1 + r || p.z <= b.z0 - r || p.z >= b.z1 + r) continue;
              const ch = [[b.x0 - r - p.x, 0], [b.x1 + r - p.x, 0], [0, b.z0 - r - p.z], [0, b.z1 + r - p.z]].sort((a, q) => Math.hypot(a[0], a[1]) - Math.hypot(q[0], q[1]))[0];
              p.x += ch[0]; p.z += ch[1]; pushed = true;
            }
            if (pushed) { const q = outpostToFrame(pi, p.x, p.y, p.z); w.worldPos.x = q.x; w.worldPos.y = q.y; w.worldPos.z = q.z; bleedSideways(w, up); }
          }
        }
      },
      dispose() { handle.dispose(); poolMat.dispose(); strobeMat.dispose(); if (signMat) signMat.dispose(); if (signTex) signTex.dispose(); K.mats.regolith.map.dispose(); K.mats.regolith.dispose(); K.mats.dust.dispose(); },
    };
  };
  return S;
}
