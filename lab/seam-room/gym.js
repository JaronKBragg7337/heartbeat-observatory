/* ============================================================================
   gym.js - Page F, the gym behind the media room's side door
   ---------------------------------------------------------------------------
   Jaron, from inside the room (11/1): "Can the door by the bookshelf open to
   a new page and that page be a giant gym? Basketball court?"
   Built into the SAME scene (one world, no portal), like the garage, the
   media room and the kitchen. The media room's side door (d-side, x = -8.25,
   next to the bookshelf) opens into it: den.js openDoor() cuts that wall.
   Interior: x -32.4..-8.4, z -10.15..23.85 (24 x 34 m), 9.5 m to the deck.
   A full FIBA court (28 x 15 m) runs along z: polished maple boards, and ONE
   markings texture (lines, keys, arcs, circles, the navy border) instead of
   meshes. Two portable hoops (padded base, pole, boom, glass board, rim,
   net), seven-row bleachers along the west wall, a scoreboard over them,
   clerestory windows, skylights, steel trusses, banners, wall pads behind
   each hoop, team benches, a ball rack, the PAGE F sign and an EXIT sign.
   For the phone: every static part is merged per material, the bleacher
   seat brackets and the rack balls are instanced, nothing casts shadows,
   one point light without shadows; fixtures, windows and skylights glow.

   THE BALL: tap it (within 2.4 m) or press Use / E to pick it up. While you
   hold it you dribble when you walk. Tap anywhere (or Use / E) to shoot at
   the nearer hoop; the shot is a real arc with a little aim error that grows
   with distance, then plain physics decides: floor, walls, bleachers,
   backboard, rim, net. The thrower sends the throw (start point + velocity)
   as the world event "gym-ball" and every browser flies the same arc; makes
   count on the scoreboard (3 from beyond the arc). A newcomer asks with
   "gym-ask". The last ball spot and score are kept per browser.
   This module only uses what today's room.js already hands every zone
   (plus k.world / window.__seam for the player, camera and shell), so it
   hot-loads into a room that was opened before it existed.
   ========================================================================== */
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export function buildGym(k) {
  const { THREE, scene, M, canvasTex, rnd, solids, signTex } = k;
  const G = { x0: -32.4, x1: -8.4, z0: -10.15, z1: 23.85, h: 9.5 };
  const GW = G.x1 - G.x0, GD = G.z1 - G.z0, CX = (G.x0 + G.x1) / 2, CZ = (G.z0 + G.z1) / 2;
  const DOOR = { z0: 6.39, z1: 7.31, h: 2.05 };                 // d-side, in the shared wall x -8.40..-8.25
  const C = { cx: -18.9, cz: 6.85, L: 28, W: 15 };               // the court; its long axis is z
  const C0 = { x: C.cx - C.W / 2, z: C.cz - C.L / 2 }, C1 = { x: C.cx + C.W / 2, z: C.cz + C.L / 2 };
  const RIM_Y = 3.05, RIM_R = 0.225, TUBE = 0.01, BALL_R = 0.12;
  // dir = the way the hoop faces (toward mid-court); the board face is 1.2 m in from the baseline, the rim centre 1.575 m
  const HOOPS = [
    { id: 0, dir: 1, base: C0.z, z: C0.z + 1.575, board: C0.z + 1.2 },
    { id: 1, dir: -1, base: C1.z, z: C1.z - 1.575, board: C1.z - 1.2 },
  ];
  const BL = { front: -28.4, back: G.x0, z0: -4.15, z1: 17.85, rows: 7, run: 0.56, rise: 0.3 };   // bleachers, west wall
  const solid = (a, b, c, d) => solids.push([a, b, c, d]);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  /* ------------------------------------------------- merge per material - */
  const buckets = new Map();
  const tmp = new THREE.Object3D();
  function put(geo, mat, x, y, z, o) {
    o = o || {};
    tmp.position.set(x, y, z); tmp.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || "XYZ");
    tmp.scale.set(o.sx || 1, o.sy || 1, o.sz || 1); tmp.updateMatrix();
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.applyMatrix4(tmp.matrix);
    for (const n of Object.keys(g.attributes)) if (n !== "position" && n !== "normal" && n !== "uv") g.deleteAttribute(n);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    let b = buckets.get(mat.uuid);
    if (!b) buckets.set(mat.uuid, (b = { mat, geos: [] }));
    b.geos.push(g);
  }
  const bx = (w, h, d, mat, x, y, z, o) => put(new THREE.BoxGeometry(w, h, d), mat, x, y, z, o);
  const cy = (r1, r2, h, mat, x, y, z, o) => put(new THREE.CylinderGeometry(r1, r2, h, (o && o.seg) || 16, 1, !!(o && o.open)), mat, x, y, z, o);
  /* a flat rectangle with its UVs in metres / tile (so textures never stretch), placed by o (rx, ry) */
  function quad(w, h, mat, x, y, z, o, tile, u0, v0) {
    const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv, t = tile || 0;
    if (t) for (let i = 0; i < uv.count; i++) uv.setXY(i, ((u0 || 0) + uv.getX(i) * w) / t, ((v0 || 0) + uv.getY(i) * h) / t);
    put(g, mat, x, y, z, o);
  }
  /* a straight bar between two points (trusses, rails, braces) */
  const up = V(0, 1, 0), qa = new THREE.Quaternion(), ea = new THREE.Euler();
  function bar(a, b, t, mat) {
    const d = b.clone().sub(a), len = d.length();
    qa.setFromUnitVectors(up, d.normalize()); ea.setFromQuaternion(qa, "XYZ");
    bx(t, len, t, mat, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, { rx: ea.x, ry: ea.y, rz: ea.z });
  }
  const meshes = [];
  function flush() {
    for (const b of buckets.values()) {
      const g = mergeGeometries(b.geos, false);
      for (const q of b.geos) q.dispose();
      const m = new THREE.Mesh(g, b.mat); m.receiveShadow = true; m.castShadow = false;
      if (b.mat.transparent) m.renderOrder = 2;
      scene.add(m); meshes.push(m);
    }
    buckets.clear();
  }

  /* ---------------------------------------------------------- textures - */
  // polished maple strip flooring: 57 mm strips running the length of the court (z), staggered butt joints. 4 m a repeat.
  const maple = canvasTex(1024, 1024, (g, w, h) => {
    const r = rnd(701), sw = w / 70;
    for (let i = 0; i < 70; i++) {
      let y = -r() * 600;
      while (y < h) {
        const len = 160 + r() * 520, t = (r() - 0.5) * 22, warm = r() * 10;
        g.fillStyle = `rgb(${226 + t + warm},${178 + t},${118 + t * 0.7 - warm})`;
        g.fillRect(i * sw, y, sw, len);
        for (let q = 0; q < 5; q++) {          // a few soft grain lines along the strip
          g.strokeStyle = `rgba(150,96,46,${0.05 + r() * 0.07})`; g.lineWidth = 0.6 + r();
          const x = i * sw + r() * sw; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + (r() - 0.5) * 3, y + len * 0.3, x + (r() - 0.5) * 3, y + len * 0.7, x + (r() - 0.5) * 2, y + len); g.stroke();
        }
        if (r() < 0.25) { g.fillStyle = `rgba(120,70,30,${0.08 + r() * 0.08})`; g.beginPath(); g.ellipse(i * sw + sw / 2, y + r() * len, 1.5, 4, 0, 0, 7); g.fill(); }   // a pin knot
        g.fillStyle = "rgba(90,52,22,.45)"; g.fillRect(i * sw, y, sw, 1.5);   // butt joint
        y += len;
      }
      g.fillStyle = "rgba(90,52,22,.32)"; g.fillRect(i * sw, 0, 1, h);        // strip seam
    }
  }, [GW / 4, GD / 4]);
  const floorMat = new THREE.MeshStandardMaterial({ map: maple, roughness: 0.34, envMapIntensity: 0.6 });

  // the court markings, ONE texture (17 x 30 m: the court + the 1 m navy border), 68 px per metre, drawn in metres:
  // canvas x = world x, canvas y = world z (both increasing)
  const MK = { w: 17, d: 30, x0: C.cx - 8.5, z0: C.cz - 15, s: 68 };
  const NAVY = "#1f3354", GOLD = "#d9a32a", LINE = "#f4f1e8";
  const markTex = canvasTex(MK.w * MK.s, MK.d * MK.s, (g) => {
    g.save(); g.scale(MK.s, MK.s); g.translate(-MK.x0, -MK.z0);
    const LW = 0.05;
    // the navy out-of-bounds border
    g.fillStyle = NAVY; g.fillRect(MK.x0, MK.z0, MK.w, MK.d);
    g.globalCompositeOperation = "destination-out"; g.fillRect(C0.x, C0.z, C.W, C.L); g.globalCompositeOperation = "source-over";
    for (const hp of HOOPS) {
      const zb = hp.base, zf = hp.base + hp.dir * 5.8, dz = Math.sqrt(6.75 * 6.75 - 6.6 * 6.6);
      // the key (4.9 m wide, to the free-throw line 5.8 m out), painted navy
      g.fillStyle = NAVY; g.fillRect(C.cx - 2.45, Math.min(zb, zf), 4.9, 5.8);
      g.strokeStyle = LINE; g.lineWidth = LW;
      g.strokeRect(C.cx - 2.45 + LW / 2, Math.min(zb, zf) + LW / 2, 4.9 - LW, 5.8 - LW);
      // lane hash marks
      for (const d of [1.75, 2.6, 3.45, 4.3]) for (const sx of [-1, 1]) { g.fillStyle = LINE; g.fillRect(C.cx + sx * 2.45 + (sx > 0 ? 0 : -0.1), zb + hp.dir * d - 0.025, 0.1, 0.05); }
      // the free-throw circle: solid toward mid-court, dashed inside the key
      const a0 = hp.dir > 0 ? 0 : Math.PI;
      g.beginPath(); g.arc(C.cx, zf, 1.8, a0, a0 + Math.PI); g.stroke();
      g.setLineDash([0.4, 0.35]); g.beginPath(); g.arc(C.cx, zf, 1.8, a0 + Math.PI, a0 + 2 * Math.PI); g.stroke(); g.setLineDash([]);
      // the three-point line: straight 0.9 m in from the sidelines, then the 6.75 m arc round the basket
      const zc = hp.z, ang = Math.atan2(dz, 6.6);   // where the arc meets the straight parts
      g.beginPath(); g.moveTo(C.cx - 6.6, zb); g.lineTo(C.cx - 6.6, zc + hp.dir * dz);
      if (hp.dir > 0) g.arc(C.cx, zc, 6.75, Math.PI - ang, ang, true); else g.arc(C.cx, zc, 6.75, Math.PI + ang, -ang, false);
      g.lineTo(C.cx + 6.6, zb); g.stroke();
      // the no-charge semicircle under the basket
      g.beginPath(); g.arc(C.cx, zc, 1.25, hp.dir > 0 ? 0 : Math.PI, hp.dir > 0 ? Math.PI : 2 * Math.PI); g.stroke();
    }
    // centre: a gold circle with a navy ring, PAGE F, the half-court line, the boundary
    g.fillStyle = GOLD; g.beginPath(); g.arc(C.cx, C.cz, 1.8, 0, 7); g.fill();
    g.strokeStyle = NAVY; g.lineWidth = 0.14; g.beginPath(); g.arc(C.cx, C.cz, 1.45, 0, 7); g.stroke();
    g.strokeStyle = LINE; g.lineWidth = LW; g.beginPath(); g.arc(C.cx, C.cz, 1.8, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(C0.x, C.cz); g.lineTo(C1.x, C.cz); g.stroke();
    g.strokeRect(C0.x + LW / 2, C0.z + LW / 2, C.W - LW, C.L - LW);
    g.fillStyle = NAVY; g.textAlign = "center"; g.textBaseline = "middle";
    g.save(); g.translate(C.cx, C.cz); g.rotate(-Math.PI / 2);   // reads upright from the door (east)
    g.font = "900 0.9px Georgia, serif"; g.fillText("PAGE F", 0, -0.08);
    g.font = "700 0.26px ui-monospace, Menlo, Consolas, monospace"; g.fillText("HEARTBEAT OBSERVATORY", 0, 0.62);
    g.restore();
    // words in the border along both sidelines
    g.fillStyle = GOLD; g.font = "800 0.6px Georgia, serif";
    for (const [x, rot] of [[C0.x - 0.5, -Math.PI / 2], [C1.x + 0.5, Math.PI / 2]]) {
      g.save(); g.translate(x, C.cz); g.rotate(rot); g.fillText("THE SEAM ROOM", 0, 0); g.restore();
    }
    g.restore();
  });
  markTex.anisotropy = 8;
  const markMat = new THREE.MeshStandardMaterial({ map: markTex, transparent: true, roughness: 0.34, envMapIntensity: 0.6,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

  // painted concrete block: 400 x 200 mm blocks, one repeat = 1.6 m; tinted per material
  const blockTex = canvasTex(512, 512, (g, w, h) => {
    const r = rnd(711);
    g.fillStyle = "#c9c3b8"; g.fillRect(0, 0, w, h);
    const bw = w / 4, bh = h / 8;
    for (let j = 0; j < 8; j++) for (let i = -1; i < 4; i++) {
      const x = i * bw + (j % 2) * bw / 2, t = (r() - 0.5) * 10;
      g.fillStyle = `rgb(${236 + t},${234 + t},${228 + t})`; g.fillRect(x + 3, j * bh + 3, bw - 6, bh - 6);
      for (let q = 0; q < 26; q++) { g.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "120,110,96"},${0.05 + r() * 0.06})`; g.beginPath(); g.arc(x + 4 + r() * (bw - 8), j * bh + 4 + r() * (bh - 8), 1 + r() * 2.4, 0, 7); g.fill(); }
    }
  }, [1, 1]);
  const wallMat = new THREE.MeshStandardMaterial({ map: blockTex, color: 0xf2ece0, roughness: 0.92, envMapIntensity: 0.5 });
  const wallLow = new THREE.MeshStandardMaterial({ map: blockTex, color: 0x50678c, roughness: 0.75, envMapIntensity: 0.5 });   // navy band
  // corrugated steel roof deck, seen from below
  const deckTex = canvasTex(256, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 4; i++) { gr.addColorStop(i / 4, "#aeb3b7"); if (i < 4) gr.addColorStop(i / 4 + 0.08, "#8a9095"); if (i < 4) gr.addColorStop(i / 4 + 0.16, "#c4c8cb"); }
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, [GW / 0.8, 1]);
  const deckMat = new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.7, metalness: 0.3 });
  const skyMat = new THREE.MeshBasicMaterial({ map: canvasTex(64, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#bcd8ee"); gr.addColorStop(1, "#eef4f6"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }) });
  const skylightMat = new THREE.MeshBasicMaterial({ color: 0xe9f2f6 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xfff6e6 });
  const GM = {
    steel: new THREE.MeshStandardMaterial({ color: 0x3b4148, roughness: 0.55, metalness: 0.6 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf0f0ec, roughness: 0.4 }),
    pad: new THREE.MeshStandardMaterial({ color: 0x1f3354, roughness: 0.62 }),
    padSeam: new THREE.MeshStandardMaterial({ color: 0x14223a, roughness: 0.7 }),
    deck: new THREE.MeshStandardMaterial({ color: 0x4d5258, roughness: 0.8 }),
    seat: new THREE.MeshStandardMaterial({ color: 0xc9925a, roughness: 0.4 }),
    nosing: new THREE.MeshStandardMaterial({ color: 0xe0b928, roughness: 0.5 }),
    rim: new THREE.MeshStandardMaterial({ color: 0xd2501e, roughness: 0.35, metalness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xcfe3ea, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.22, envMapIntensity: 1.2, depthWrite: false }),
    black: new THREE.MeshStandardMaterial({ color: 0x16181a, roughness: 0.5 }),
    exit: new THREE.MeshBasicMaterial({ color: 0xff3b30 }),
  };

  /* ----------------------------------------------------------- shell - */
  quad(GW, GD, floorMat, CX, 0, CZ, { rx: -Math.PI / 2 });
  flush();   // the floor first, so the markings draw over it
  {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(MK.w, MK.d), markMat);
    // laid flat (rx -90deg) the canvas's top row (v = 1, local +y) lands on -z, so canvas y = world z, canvas x = world x
    m.rotation.set(-Math.PI / 2, 0, 0); m.position.set(C.cx, 0.002, C.cz); m.renderOrder = 1; m.receiveShadow = true;
    scene.add(m); meshes.push(m);
  }
  quad(GW, GD, deckMat, CX, G.h, CZ, { rx: Math.PI / 2 });

  // walls: lower 2.4 m navy band, cream block above; UVs in metres (1.6 m a repeat). The east wall has the door.
  const BAND = 2.4;
  function wallPart(axis, c, u0, u1, v0, v1, ry) {
    if (u1 - u0 < 0.001 || v1 - v0 < 0.001) return;
    const mid = (u0 + u1) / 2;
    const part = (a, b, mat) => { if (b - a > 0.001) quad(u1 - u0, b - a, mat, axis === "x" ? c : mid, (a + b) / 2, axis === "x" ? mid : c, { ry }, 1.6, u0, a); };
    part(v0, Math.min(v1, BAND), wallLow); part(Math.max(v0, BAND), v1, wallMat);
  }
  // east wall x = -8.4, facing -x, with the doorway
  wallPart("x", G.x1, G.z0, DOOR.z0, 0, G.h, -Math.PI / 2);
  wallPart("x", G.x1, DOOR.z1, G.z1, 0, G.h, -Math.PI / 2);
  wallPart("x", G.x1, DOOR.z0, DOOR.z1, DOOR.h, G.h, -Math.PI / 2);
  wallPart("x", G.x0, G.z0, G.z1, 0, G.h, Math.PI / 2);        // west
  wallPart("z", G.z0, G.x0, G.x1, 0, G.h, 0);                  // south
  wallPart("z", G.z1, G.x0, G.x1, 0, G.h, Math.PI);            // north
  // the door from the media room: casing on the gym side, rubber base, an EXIT sign over it
  {
    const x = G.x1 - 0.02;
    for (const z of [DOOR.z0 - 0.035, DOOR.z1 + 0.035]) bx(0.04, DOOR.h + 0.07, 0.07, GM.steel, x, (DOOR.h + 0.07) / 2, z);
    bx(0.04, 0.07, DOOR.z1 - DOOR.z0 + 0.14, GM.steel, x, DOOR.h + 0.035, (DOOR.z0 + DOOR.z1) / 2);
    bx(0.025, 0.1, DOOR.z0 - G.z0, GM.black, G.x1 - 0.012, 0.05, (G.z0 + DOOR.z0) / 2);
    bx(0.025, 0.1, G.z1 - DOOR.z1, GM.black, G.x1 - 0.012, 0.05, (DOOR.z1 + G.z1) / 2);
    bx(0.1, 0.22, 0.52, GM.black, G.x1 - 0.06, DOOR.h + 0.32, (DOOR.z0 + DOOR.z1) / 2);
  }
  // base cove on the other walls
  bx(0.025, 0.1, GD, GM.black, G.x0 + 0.012, 0.05, CZ);
  for (const z of [G.z0 + 0.012, G.z1 - 0.012]) bx(GW, 0.1, 0.025, GM.black, CX, 0.05, z);

  // clerestory windows high on the east and west walls, between the trusses
  const WIN = { y0: 7.05, y1: 8.65 };
  for (const [x, ry, s] of [[G.x1 - 0.01, -Math.PI / 2, -1], [G.x0 + 0.01, Math.PI / 2, 1]]) {
    for (let z = G.z0 + 2.2; z + 2.6 < G.z1 - 1.5; z += 4.0) {
      const zc = z + 1.3, yc = (WIN.y0 + WIN.y1) / 2, ww = 2.6, wh = WIN.y1 - WIN.y0;
      quad(ww, wh, skyMat, x, yc, zc, { ry });
      for (const dz of [-ww / 2, -ww / 6, ww / 6, ww / 2]) bx(0.08, wh + 0.06, 0.07, GM.steel, x + s * 0.03, yc, zc + dz);
      for (const y of [WIN.y0, yc, WIN.y1]) bx(0.08, 0.07, ww + 0.07, GM.steel, x + s * 0.03, y, zc);
      bx(0.22, 0.05, ww + 0.2, GM.white, x + s * 0.1, WIN.y0 - 0.03, zc);    // sill
    }
  }

  // roof trusses across the width every 4 m (bottom chord 8.3 m, top chord 9.4 m, web between), purlins along z
  for (let z = G.z0 + 2.0; z < G.z1 - 1; z += 4.0) {
    const yb = 8.3, yt = 9.4;
    bar(V(G.x0, yb, z), V(G.x1, yb, z), 0.14, GM.steel);
    bar(V(G.x0, yt, z), V(G.x1, yt, z), 0.16, GM.steel);
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const xa = G.x0 + (GW * i) / n;
      bar(V(xa, yb, z), V(xa, yt, z), 0.06, GM.steel);
      if (i < n) bar(V(xa, i % 2 ? yt : yb, z), V(G.x0 + (GW * (i + 1)) / n, i % 2 ? yb : yt, z), 0.06, GM.steel);
    }
  }
  for (let x = G.x0 + 3; x < G.x1; x += 3) bx(0.1, 0.12, GD, GM.steel, x, 9.42, CZ);
  // skylights in the deck, between trusses
  for (const z of [G.z0 + 8, CZ, G.z1 - 8]) for (const x of [CX - 5.5, CX + 5.5]) {
    quad(2.4, 2.2, skylightMat, x, G.h - 0.012, z, { rx: Math.PI / 2 });
    for (const [w, d, dx, dz] of [[2.6, 0.1, 0, -1.15], [2.6, 0.1, 0, 1.15], [0.1, 2.4, -1.25, 0], [0.1, 2.4, 1.25, 0]]) bx(w, 0.25, d, GM.white, x + dx, G.h - 0.13, z + dz);
  }
  // high-bay LED lights: 3 x 5, hanging under the bottom chords
  for (let i = 0; i < 3; i++) for (let j = 0; j < 5; j++) {
    const x = C.cx + (i - 1) * 5.5, z = C.cz + (j - 2) * 6.4;
    cy(0.012, 0.012, 0.9, GM.steel, x, 8.3 - 0.45, z, { seg: 6 });
    cy(0.32, 0.36, 0.12, GM.steel, x, 7.8, z, { seg: 24 });
    quad(0.6, 0.6, glow, x, 7.735, z, { rx: Math.PI / 2 });
  }

  /* ------------------------------------------------------ wall pads - */
  // navy pads on both end walls behind the hoops (8 m wide, 2 m tall, 1.2 m sections), and on the end walls' corners
  for (const [z, s] of [[G.z0 + 0.04, 1], [G.z1 - 0.04, -1]]) {
    for (let i = 0; i < 7; i++) {
      const x = C.cx - 4.2 + 0.6 + i * 1.2;
      bx(1.18, 2.0, 0.07, GM.pad, x, 1.05, z + s * 0.035, { rx: 0 });
    }
    bx(8.4, 2.06, 0.04, GM.padSeam, C.cx, 1.05, z);
  }

  /* -------------------------------------------------------- the hoops - */
  // portable hoops: padded base behind the baseline, pole, boom, a glass board with white lines, rim, net
  const BOARDS = [];   // for the ball: the board as a box
  const STAND = [];    // and the bases, poles, booms
  for (const hp of HOOPS) {
    const s = hp.dir, bz = hp.base - s * 1.45, poleZ = hp.base - s * 0.85;
    // base (1.3 x 0.85 x 2.1), with a navy pad wrap on its front face and sides
    bx(1.3, 0.85, 2.1, GM.steel, C.cx, 0.425, bz);
    bx(1.38, 0.9, 0.14, GM.pad, C.cx, 0.45, hp.base - s * 0.42);
    for (const sx of [-1, 1]) bx(0.06, 0.9, 1.4, GM.pad, C.cx + sx * 0.68, 0.45, bz + s * 0.3);
    STAND.push([C.cx - 0.69, 0, Math.min(bz - 1.05, hp.base - s * 0.35), C.cx + 0.69, 0.9, Math.max(bz + 1.05, hp.base - s * 0.35)]);
    solid(C.cx - 0.75, Math.min(bz - 1.05, hp.base - s * 0.35) - 0.05, C.cx + 0.75, Math.max(bz + 1.05, hp.base - s * 0.35) + 0.05);
    // pole, pole pad, boom, brace
    bx(0.2, 2.6, 0.2, GM.steel, C.cx, 0.85 + 1.3, poleZ);
    bx(0.34, 1.9, 0.34, GM.pad, C.cx, 0.85 + 0.95, poleZ);
    STAND.push([C.cx - 0.17, 0.85, poleZ - 0.17, C.cx + 0.17, 3.45, poleZ + 0.17]);
    const boomEnd = hp.board - s * 0.06;
    bar(V(C.cx, 3.35, poleZ), V(C.cx, 3.38, boomEnd), 0.18, GM.steel);
    bar(V(C.cx, 2.55, poleZ), V(C.cx, 3.35, (poleZ + boomEnd) / 2), 0.1, GM.steel);
    STAND.push([C.cx - 0.1, 3.26, Math.min(poleZ, boomEnd), C.cx + 0.1, 3.48, Math.max(poleZ, boomEnd)]);
    // the board: 1.8 x 1.05 m tempered glass, bottom at 2.9 m; a white frame and shooter's square on the court face
    const bzc = hp.board - s * 0.02, face = hp.board + s * 0.002;
    bx(1.8, 1.05, 0.04, GM.glass, C.cx, 2.9 + 0.525, bzc);
    for (const [w, h, x, y] of [[1.8, 0.05, 0, 3.925], [1.8, 0.05, 0, 2.925], [0.05, 1.05, -0.875, 3.425], [0.05, 1.05, 0.875, 3.425],
      [0.59, 0.05, 0, 3.1], [0.59, 0.05, 0, 3.55], [0.05, 0.45, -0.27, 3.325], [0.05, 0.45, 0.27, 3.325]]) bx(w, h, 0.006, GM.white, C.cx + x, y, face);
    bx(1.84, 0.07, 0.09, GM.pad, C.cx, 2.87, bzc);                            // pad along the board's bottom edge
    for (const sx of [-1, 1]) bx(0.06, 1.1, 0.06, GM.steel, C.cx + sx * 0.92, 3.425, bzc - s * 0.04);   // frame posts behind
    BOARDS.push([C.cx - 0.9, 2.88, Math.min(bzc - 0.02, bzc + 0.02), C.cx + 0.9, 3.95, Math.max(bzc - 0.02, bzc + 0.02)]);
    // rim + bracket (the rim is its own torus so it reads round); 0.15 m from the board to the rim's inner edge
    bx(0.16, 0.06, 0.16, GM.rim, C.cx, RIM_Y - 0.02, hp.board + s * 0.08);
    put(new THREE.TorusGeometry(RIM_R + TUBE, TUBE, 8, 40), GM.rim, C.cx, RIM_Y, hp.z, { rx: Math.PI / 2 });
  }

  /* ------------------------------------------------------ the bleachers - */
  // seven rows along the west wall: a stepped deck (one extruded profile), wood bench seats in three sections with two
  // aisles, aisle half-steps with yellow nosing, rails. Seat brackets are one InstancedMesh.
  {
    // the side profile: tread i (the feet of row i) is at height i * rise, from x = front - i*run back one run
    const prof = new THREE.Shape();
    prof.moveTo(0, 0); prof.lineTo(0, 0.02);
    for (let i = 0; i < BL.rows; i++) { const y = i * BL.rise + 0.02; prof.lineTo(-i * BL.run, y); prof.lineTo(-(i + 1) * BL.run, y); }
    prof.lineTo(-(BL.front - BL.back), (BL.rows - 1) * BL.rise + 0.02); prof.lineTo(-(BL.front - BL.back), 0); prof.closePath();
    const ex = new THREE.ExtrudeGeometry(prof, { depth: BL.z1 - BL.z0, bevelEnabled: false });
    put(ex, GM.deck, BL.front, 0, BL.z0);
    const AISLES = [[2.35, 3.35], [10.35, 11.35]];
    const sections = [[BL.z0 + 0.1, AISLES[0][0]], [AISLES[0][1], AISLES[1][0]], [AISLES[1][1], BL.z1 - 0.1]];
    const brackets = [];
    for (let i = 0; i < BL.rows; i++) {
      const xs = BL.front - i * BL.run - 0.38, ys = i * BL.rise + 0.02 + 0.43;
      for (const [a, b] of sections) {
        bx(0.3, 0.045, b - a, GM.seat, xs, ys, (a + b) / 2);
        for (let z = a + 0.3; z < b - 0.1; z += 1.2) brackets.push([xs, ys - 0.22, z]);
      }
      // aisle half-steps (so the climb is 15 cm a step) and yellow nosing on every tread edge in the aisles
      for (const [a, b] of AISLES) {
        const zc = (a + b) / 2, w = b - a;
        if (i < BL.rows - 1) bx(BL.run / 2, BL.rise / 2, w, GM.deck, BL.front - (i + 1) * BL.run + BL.run / 4, i * BL.rise + 0.02 + BL.rise / 4, zc);
        bx(0.05, 0.012, w, GM.nosing, BL.front - i * BL.run - 0.025, i * BL.rise + 0.026, zc);
      }
    }
    // handrails up the aisles and along the top, end rails
    for (const [a, b] of AISLES) {
      const zc = (a + b) / 2;
      const p0 = V(BL.front - 0.3, 0.95, zc), p1 = V(BL.front - (BL.rows - 0.5) * BL.run, (BL.rows - 1) * BL.rise + 0.95, zc);
      bar(p0, p1, 0.045, GM.steel);
      for (let i = 0; i < BL.rows; i += 2) bar(V(BL.front - i * BL.run - 0.3, i * BL.rise, zc), V(BL.front - i * BL.run - 0.3, i * BL.rise + 0.95, zc), 0.04, GM.steel);
    }
    const topY = (BL.rows - 1) * BL.rise + 0.02;
    bar(V(BL.back + 0.15, topY + 1.0, BL.z0), V(BL.back + 0.15, topY + 1.0, BL.z1), 0.05, GM.steel);
    for (const z of [BL.z0 + 0.03, BL.z1 - 0.03]) {
      bar(V(BL.front - 0.05, 0.95, z), V(BL.back + 0.15, topY + 1.0, z), 0.05, GM.steel);
      for (let i = 0; i < BL.rows; i += 3) bar(V(BL.front - i * BL.run - 0.1, i * BL.rise, z), V(BL.front - i * BL.run - 0.1, i * BL.rise + 1.0, z), 0.045, GM.steel);
    }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.43, 0.05), GM.steel, brackets.length);
    const mm = new THREE.Matrix4();
    brackets.forEach((b, i) => im.setMatrixAt(i, mm.makeTranslation(b[0], b[1], b[2])));
    im.receiveShadow = true; scene.add(im); meshes.push(im);
    solid(BL.back, BL.z0 - 0.05, BL.front + 0.05, BL.z1 + 0.05);
  }

  /* -------------------------------------------- scoreboard over the bleachers - */
  const SB = { x: G.x0 + 0.14, y: 5.55, z: C.cz, w: 4.6, h: 2.1 };
  const sbCanvas = document.createElement("canvas"); sbCanvas.width = 1024; sbCanvas.height = 468;
  const sbTex = new THREE.CanvasTexture(sbCanvas); sbTex.colorSpace = THREE.SRGBColorSpace; sbTex.anisotropy = 8;
  function drawBoard(score) {
    const g = sbCanvas.getContext("2d"), w = sbCanvas.width, h = sbCanvas.height;
    g.fillStyle = "#0b0d10"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#2a3140"; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = "#1f3354"; g.fillRect(16, 16, w - 32, 70);
    g.fillStyle = "#f2c14e"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "800 46px Georgia, serif"; g.fillText("HEARTBEAT  ·  PAGE F", w / 2, 52);
    g.fillStyle = "#e8e4d8"; g.font = "700 44px ui-monospace, Menlo, Consolas, monospace";
    g.fillText("HOME", 200, 136); g.fillText("GUEST", w - 200, 136);
    const digits = (n, x) => {
      const s = String(Math.max(0, n | 0) % 1000).padStart(2, "0");
      g.font = "700 170px ui-monospace, Menlo, Consolas, monospace";
      g.fillStyle = "rgba(255,80,40,.10)"; g.fillText("8".repeat(s.length), x, 280);   // unlit segments
      g.fillStyle = "#ff5a2a"; g.shadowColor = "#ff5a2a"; g.shadowBlur = 18; g.fillText(s, x, 280); g.shadowBlur = 0;
    };
    digits(score[1], 200); digits(score[0], w - 200);
    g.font = "700 96px ui-monospace, Menlo, Consolas, monospace";
    g.fillStyle = "rgba(255,200,60,.1)"; g.fillText("88:88", w / 2, 220);
    g.fillStyle = "#ffc53a"; g.shadowColor = "#ffc53a"; g.shadowBlur = 14; g.fillText("12:00", w / 2, 220); g.shadowBlur = 0;
    g.fillStyle = "#e8e4d8"; g.font = "700 34px ui-monospace, Menlo, Consolas, monospace"; g.fillText("PERIOD", w / 2, 320);
    g.fillStyle = "#3fd16b"; g.font = "700 70px ui-monospace, Menlo, Consolas, monospace"; g.fillText("1", w / 2, 384);
    g.fillStyle = "#8a93a3"; g.font = "600 26px ui-monospace, Menlo, Consolas, monospace"; g.fillText("3 FROM BEYOND THE ARC", w / 2, 440);
    sbTex.needsUpdate = true;
  }
  bx(0.22, SB.h + 0.2, SB.w + 0.2, GM.black, SB.x, SB.y, SB.z);
  bx(0.06, 0.6, 0.06, GM.steel, SB.x, SB.y + SB.h / 2 + 0.4, SB.z - 1.6); bx(0.06, 0.6, 0.06, GM.steel, SB.x, SB.y + SB.h / 2 + 0.4, SB.z + 1.6);
  const sbFace = new THREE.Mesh(new THREE.PlaneGeometry(SB.w, SB.h), new THREE.MeshBasicMaterial({ map: sbTex, toneMapped: false }));
  sbFace.position.set(SB.x + 0.115, SB.y, SB.z); sbFace.rotation.y = Math.PI / 2; scene.add(sbFace); meshes.push(sbFace);

  /* ------------------------------------------------- banners (one atlas) - */
  const BAN = [["CONFERENCE", "CHAMPIONS", "2026"], ["REGIONAL", "CHAMPIONS", "2025"], ["SECTIONAL", "CHAMPIONS", "2024"],
    ["SEAM ROOM", "INVITATIONAL", "2026"], ["PAGE F", "HOME OF THE", "HEARTBEAT"]];
  const banTex = canvasTex(256 * BAN.length, 400, (g, w, h) => {
    BAN.forEach((lines, i) => {
      const x = i * 256, gold = i % 2 === 0;
      g.fillStyle = gold ? "#1f3354" : "#d9a32a";
      g.beginPath(); g.moveTo(x + 8, 0); g.lineTo(x + 248, 0); g.lineTo(x + 248, 340); g.lineTo(x + 128, 392); g.lineTo(x + 8, 340); g.closePath(); g.fill();
      g.strokeStyle = gold ? "#d9a32a" : "#1f3354"; g.lineWidth = 6;
      g.beginPath(); g.moveTo(x + 20, 12); g.lineTo(x + 236, 12); g.lineTo(x + 236, 330); g.lineTo(x + 128, 376); g.lineTo(x + 20, 330); g.closePath(); g.stroke();
      g.fillStyle = gold ? "#f2e6c8" : "#14223a"; g.textAlign = "center"; g.textBaseline = "middle";
      g.font = "800 30px Georgia, serif"; g.fillText(lines[0], x + 128, 80, 200);
      g.font = "700 26px Georgia, serif"; g.fillText(lines[1], x + 128, 130, 200);
      g.font = "900 70px Georgia, serif"; g.fillText(lines[2], x + 128, 225, 196);
    });
  });
  const banMat = new THREE.MeshStandardMaterial({ map: banTex, alphaTest: 0.5, roughness: 0.85, side: THREE.DoubleSide });
  function banner(i, x, y, z, ry) {
    const g = new THREE.PlaneGeometry(1.5, 2.35), uv = g.attributes.uv;
    for (let q = 0; q < uv.count; q++) uv.setX(q, (i + uv.getX(q)) / BAN.length);
    put(g, banMat, x, y, z, { ry });
    bx(0.03, 0.03, 0.03, GM.steel, x, y + 1.2, z);
  }
  BAN.forEach((_, i) => banner(i, C.cx + (i - 2) * 2.4, 6.1, G.z1 - 0.05, Math.PI));
  [0, 1, 3].forEach((b, i) => banner(b, C.cx + (i - 1) * 2.4, 6.1, G.z0 + 0.05, 0));

  /* ---------------------------------------- team benches, ball rack, sign - */
  for (const z of [C.cz - 4.6, C.cz + 4.6]) {
    const len = 4.2;
    bx(0.42, 0.06, len, GM.seat, G.x1 - 0.65, 0.46, z);
    bx(0.06, 0.4, len, GM.seat, G.x1 - 0.45, 0.78, z);
    for (const dz of [-len / 2 + 0.2, 0, len / 2 - 0.2]) bx(0.4, 0.43, 0.05, GM.steel, G.x1 - 0.62, 0.215, z + dz);
    solid(G.x1 - 0.9, z - len / 2 - 0.05, G.x1, z + len / 2 + 0.05);
  }
  const RACK = { x: G.x1 - 0.55, z: C1.z - 0.6 };
  for (const dz of [-0.55, 0.55]) for (const dx of [-0.22, 0.22]) bx(0.03, 1.0, 0.03, GM.steel, RACK.x + dx, 0.5, RACK.z + dz);
  for (const y of [0.32, 0.72]) for (const dx of [-0.22, 0.22]) bx(0.025, 0.025, 1.14, GM.steel, RACK.x + dx, y, RACK.z);
  solid(RACK.x - 0.3, RACK.z - 0.62, G.x1, RACK.z + 0.62);

  // contact shadows (one merged mesh): under the hoop bases, the bleachers' front edge, benches, rack
  const blob = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, "rgba(0,0,0,.5)"); gr.addColorStop(0.6, "rgba(0,0,0,.28)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const blobMat = new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  for (const hp of HOOPS) quad(2.0, 3.0, blobMat, C.cx, 0.004, hp.base - hp.dir * 1.4, { rx: -Math.PI / 2 });
  quad(1.6, BL.z1 - BL.z0 + 1.0, blobMat, BL.front + 0.1, 0.004, (BL.z0 + BL.z1) / 2, { rx: -Math.PI / 2 });
  for (const z of [C.cz - 4.6, C.cz + 4.6]) quad(1.2, 4.8, blobMat, G.x1 - 0.6, 0.004, z, { rx: -Math.PI / 2 });

  flush();

  // EXIT sign letters + the PAGE F sign (like A, B, C, D, E's), east wall right of the door
  {
    const ex = canvasTex(256, 96, (g, w, h) => { g.fillStyle = "#16181a"; g.fillRect(0, 0, w, h); g.fillStyle = "#ff4433"; g.font = "800 64px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("EXIT", w / 2, h / 2 + 2); });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.18), new THREE.MeshBasicMaterial({ map: ex, toneMapped: false }));
    p.position.set(G.x1 - 0.115, DOOR.h + 0.32, (DOOR.z0 + DOOR.z1) / 2); p.rotation.y = -Math.PI / 2; scene.add(p); meshes.push(p);
    const g = new THREE.Group(); g.position.set(G.x1 - 0.03, 1.65, DOOR.z1 + 1.45); g.rotation.y = -Math.PI / 2; scene.add(g);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.74, 0.04), M.walnut); back.receiveShadow = true; g.add(back);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.625), new THREE.MeshStandardMaterial({ map: signTex("F", "/lab/seam-room/f/"), roughness: 0.8 }));
    face.position.z = 0.022; g.add(face);
  }

  /* ----------------------------------------------------------- light - */
  // NO new light: a point light big enough for a 24 x 34 m hall would reach through the walls into the media room and
  // room A (lights have no walls without shadows), and every new light recompiles every shader. The room's hemisphere
  // and sun light it; the high-bay fixtures, windows and skylights glow, and the walls/deck carry a little emissive
  // "bounce" so the side away from the sun is not dark.

  /* ======================================================== the ball - */
  const ballTex = canvasTex(1024, 512, (g, w, h) => {
    const r = rnd(731);
    g.fillStyle = "#c4561f"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26000; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,170,110,.16)" : "rgba(80,22,6,.16)"; g.fillRect(r() * w, r() * h, 2, 2); }   // pebbles
    g.strokeStyle = "#1a0f0a"; g.lineWidth = 7; g.lineCap = "round";
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    for (const u of [0, 0.5, 1]) { g.beginPath(); g.moveTo(u * w, 0); g.lineTo(u * w, h); g.stroke(); }
    for (const [u0, s] of [[0.25, 1], [0.75, -1]]) {
      g.beginPath();
      for (let i = 0; i <= 64; i++) { const v = i / 64, u = u0 + s * 0.13 * Math.cos(Math.PI * v); i ? g.lineTo(u * w, v * h) : g.moveTo(u * w, v * h); }
      g.stroke();
    }
  });
  const ballMat = new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.62 });
  const ballGeo = new THREE.SphereGeometry(BALL_R, 32, 20);
  const ballMesh = new THREE.Mesh(ballGeo, ballMat); ballMesh.castShadow = false; ballMesh.receiveShadow = true;
  scene.add(ballMesh);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
  ballMesh.add(hit);
  const ballShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), blobMat); ballShadow.rotation.x = -Math.PI / 2; ballShadow.renderOrder = 1; scene.add(ballShadow);
  // the rack's six balls (instanced)
  {
    const im = new THREE.InstancedMesh(ballGeo, ballMat, 6), mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    let n = 0;
    for (const y of [0.32 + BALL_R + 0.01, 0.72 + BALL_R + 0.01]) for (const dz of [-0.33, 0, 0.33]) {
      q.setFromEuler(e.set(n * 1.3, n * 0.7, n * 2.1)); mm.compose(V(RACK.x, y, RACK.z + dz), q, V(1, 1, 1)); im.setMatrixAt(n++, mm);
    }
    scene.add(im); meshes.push(im);
  }
  // the nets: open cones with a diamond-mesh texture; each its own mesh so a make can swish it
  const netTex = canvasTex(256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = "#f6f3ea"; g.lineWidth = 3;
    for (let i = -8; i < 24; i++) { g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16 + 64, h); g.stroke(); g.beginPath(); g.moveTo(i * 16 + 64, 0); g.lineTo(i * 16, h); g.stroke(); }
    g.lineWidth = 5; g.beginPath(); g.moveTo(0, 2); g.lineTo(w, 2); g.stroke();
  });
  netTex.wrapS = THREE.RepeatWrapping; netTex.repeat.set(3, 1);
  const netMat = new THREE.MeshStandardMaterial({ map: netTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 });
  const nets = HOOPS.map((hp) => {
    const g = new THREE.CylinderGeometry(RIM_R, 0.14, 0.42, 20, 3, true); g.translate(0, -0.21, 0);
    const m = new THREE.Mesh(g, netMat); m.position.set(C.cx, RIM_Y, hp.z); scene.add(m); meshes.push(m);
    return { mesh: m, swish: 0 };
  });

  /* ----------------------------------------------- the world, from room.js - */
  // today's room.js hands no player/shell to a zone, so fall back to its window.__seam handle (always there after load)
  const world = () => k.world || window.__seam || null;
  const getShell = () => { const w = world(); if (!w) return null; return typeof w.shell === "function" ? w.shell() : w.shell; };
  const myId = () => { const s = getShell(); return (s && s.selfKey) || "me"; };
  const inGym = () => { const w = world(); return !!w && w.zone === "f"; };
  const log = (t) => {
    if (typeof k.log === "function") return k.log(t);
    const lines = window.__seamLog; if (!lines) return;
    const d = new Date(); lines.push(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} ${t}`);
    while (lines.length > 5) lines.shift();
    const box = document.getElementById("seamLog");
    if (box) box.innerHTML = lines.map((l) => `<div>${String(l).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))}</div>`).join("");
  };

  /* ball state: what goes over the wire (plain JSON). mode: rest | held | fly. rev orders changes (higher wins). */
  const KEY = "seam-room:gym-ball";
  const START = { x: -12.6, z: 7.9 };
  const ball = { rev: 0, mode: "rest", by: null, byName: "", p: [START.x, BALL_R, START.z], v: [0, 0, 0], t0: 0, tid: "", shooter: null, pts: 0, score: [0, 0] };
  try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && Array.isArray(s.p) && Array.isArray(s.score)) { ball.rev = s.rev | 0; ball.p = s.p.slice(0, 3); ball.score = s.score.slice(0, 2); } } catch (_) {}
  if (!(ball.p[0] > G.x0 && ball.p[0] < G.x1 && ball.p[2] > G.z0 && ball.p[2] < G.z1)) ball.p = [START.x, BALL_R, START.z];
  ball.p[1] = BALL_R;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ rev: ball.rev, p: ball.p, score: ball.score })); } catch (_) {} };
  drawBoard(ball.score);

  // the local simulation (every browser flies the same throw)
  const sim = { on: false, p: V(...ball.p), v: V(0, 0, 0), acc: 0, tid: "", restTo: null, spin: V(0, 0, 0) };
  const shown = V(...ball.p);   // where the ball is drawn
  const GRAV = 9.81, STEP = 1 / 240;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const tmpV = V(0, 0, 0), nrm = V(0, 0, 0);
  function bounceOff(n, e, fr) {   // reflect the velocity off a surface with normal n (restitution e, tangential keep fr)
    const vn = sim.v.dot(n);
    if (vn >= 0) return;
    tmpV.copy(n).multiplyScalar(vn);        // normal part
    sim.v.sub(tmpV).multiplyScalar(fr).addScaledVector(tmpV, -e);
  }
  function boxHit(b, e, fr) {   // sphere vs an axis-aligned box [x0, y0, z0, x1, y1, z1]
    const p = sim.p, qx = clamp(p.x, b[0], b[3]), qy = clamp(p.y, b[1], b[4]), qz = clamp(p.z, b[2], b[5]);
    let dx = p.x - qx, dy = p.y - qy, dz = p.z - qz, d = Math.hypot(dx, dy, dz);
    if (d >= BALL_R) return false;
    if (d < 1e-6) { dy = 1; dx = dz = 0; d = 1; p.y = b[4]; }
    nrm.set(dx / d, dy / d, dz / d);
    p.set(qx + nrm.x * BALL_R, qy + nrm.y * BALL_R, qz + nrm.z * BALL_R);
    bounceOff(nrm, e, fr);
    if (nrm.y > 0.7) { onTop = true; if (Math.abs(sim.v.y) < 0.3) sim.v.y = 0; }   // sitting on a hoop base / board top
    return true;
  }
  let makes = 0;   // drops through a ring seen by this browser (tests)
  const BLOCKS = BOARDS.map((b) => [b[0], b[1], b[2], b[3], b[4], b[5], 0.62, 0.9])
    .concat(STAND.map((b) => [b[0], b[1], b[2], b[3], b[4], b[5], 0.45, 0.85]));
  let lastHit = 0, onTop = false;
  function stepSim(dt) {
    const p = sim.p, v = sim.v, py = p.y;
    onTop = false;
    v.y -= GRAV * dt;
    p.addScaledVector(v, dt);
    // floor (rolling friction once it rolls)
    if (p.y < BALL_R) {
      p.y = BALL_R;
      if (v.y < 0) { if (v.y < -1.2) lastHit = 1; v.y = -v.y * 0.76; if (v.y < 0.3) v.y = 0; v.x *= 0.97; v.z *= 0.97; }
      onTop = true;
    }
    // walls + deck
    if (p.x < G.x0 + BALL_R) { p.x = G.x0 + BALL_R; v.x = Math.abs(v.x) * 0.66; }
    if (p.x > G.x1 - BALL_R) { p.x = G.x1 - BALL_R; v.x = -Math.abs(v.x) * 0.66; }
    if (p.z < G.z0 + BALL_R) { p.z = G.z0 + BALL_R; v.z = Math.abs(v.z) * 0.66; }
    if (p.z > G.z1 - BALL_R) { p.z = G.z1 - BALL_R; v.z = -Math.abs(v.z) * 0.66; }
    if (p.y > 8.2 - BALL_R) { p.y = 8.2 - BALL_R; v.y = -Math.abs(v.y) * 0.5; }   // the truss chords
    // bleachers: a staircase; a tread under you lifts you, a riser in front of you bounces you back
    if (p.z > BL.z0 && p.z < BL.z1 && p.x < BL.front + BALL_R) {
      const i = clamp(Math.floor((BL.front - p.x) / BL.run), 0, BL.rows - 1), top = i * BL.rise + 0.02;
      if (p.y - BALL_R < top) {
        if (top - (p.y - BALL_R) > 0.07 && i > 0) { p.x = BL.front - i * BL.run + BALL_R; v.x = Math.abs(v.x) * 0.55; }
        else { p.y = top + BALL_R; if (v.y < 0) v.y = -v.y * 0.6; if (v.y < 0.3) v.y = 0; v.x *= 0.98; v.z *= 0.98; onTop = true; }
      }
    }
    // the boards, bases, poles, booms
    for (const b of BLOCKS) if (p.y < b[4] + BALL_R + 0.01 && p.y > b[1] - BALL_R - 0.01) if (boxHit(b, b[6], b[7])) lastHit = 1;
    // rims: a torus; the nets slow the ball and say "make" when it drops through the ring
    for (const hp of HOOPS) {
      const dx = p.x - C.cx, dz = p.z - hp.z, rho = Math.hypot(dx, dz);
      if (Math.abs(p.y - RIM_Y) < BALL_R + TUBE + 0.02 && rho < RIM_R + TUBE + BALL_R + 0.02) {
        const R0 = RIM_R + TUBE, ux = rho > 1e-6 ? dx / rho : 1, uz = rho > 1e-6 ? dz / rho : 0;
        const qx = C.cx + ux * R0, qz = hp.z + uz * R0;
        nrm.set(p.x - qx, p.y - RIM_Y, p.z - qz);
        const d = nrm.length();
        if (d < BALL_R + TUBE && d > 1e-6) {
          nrm.multiplyScalar(1 / d);
          p.set(qx + nrm.x * (BALL_R + TUBE), RIM_Y + nrm.y * (BALL_R + TUBE), qz + nrm.z * (BALL_R + TUBE));
          bounceOff(nrm, 0.55, 0.9); lastHit = 1;
        }
      }
      if (rho < RIM_R && p.y < RIM_Y && p.y > RIM_Y - 0.45) { const f = Math.max(0, 1 - 5 * dt); v.x *= f; v.z *= f; if (v.y < -1) v.y *= Math.max(0, 1 - 1.5 * dt); }
      if (py >= RIM_Y && p.y < RIM_Y && v.y < 0 && rho < RIM_R - 0.03) onMake(hp);
    }
    if (onTop && v.y === 0) {   // rolling on whatever holds it up: ~0.45 m/s^2 of rolling resistance plus a little drag
      const hs = Math.hypot(v.x, v.z), ns = Math.max(0, hs - 0.45 * dt) * Math.max(0, 1 - 0.25 * dt);
      if (hs > 1e-6) { v.x *= ns / hs; v.z *= ns / hs; }
      if (ns < 0.05) { v.set(0, 0, 0); return false; }   // at rest (floor, a bleacher row, a hoop base)
    }
    return true;
  }

  function startFly(s, catchUp) {
    sim.on = true; sim.tid = s.tid; sim.acc = 0; sim.restTo = null;
    sim.p.set(s.p[0], s.p[1], s.p[2]); sim.v.set(s.v[0], s.v[1], s.v[2]);
    for (let t = 0; t < catchUp && sim.on; t += STEP) sim.on = stepSim(STEP);
  }
  function onMake(hp) {
    nets[hp.id].swish = 1; makes += 1;
    if (ball.shooter === myId() && sim.tid === ball.tid && !ball.scored) {
      ball.scored = true;
      ball.score[hp.id] += ball.pts;
      ball.rev += 1; save(); drawBoard(ball.score);
      send();
      log(`${ball.pts} points! HOME ${ball.score[1]} - GUEST ${ball.score[0]}`);
    }
  }
  function wire() { return { rev: ball.rev, mode: ball.mode, by: ball.by, byName: ball.byName, p: ball.p, v: ball.v, t0: ball.t0, tid: ball.tid, shooter: ball.shooter, pts: ball.pts, score: ball.score, scored: !!ball.scored }; }
  function send() { const s = getShell(); if (s && s.send) s.send("gym-ball", { s: wire() }); }
  function adopt(s, from) {
    if (!s || !Array.isArray(s.p) || !Array.isArray(s.score)) return;
    if (!(s.rev > ball.rev || (s.rev === ball.rev && String(s.tid || "") > String(ball.tid || "")))) return;
    const prevScore = ball.score.slice(), sameThrow = s.tid && s.tid === sim.tid;
    Object.assign(ball, { rev: s.rev | 0, mode: s.mode, by: s.by || null, byName: s.byName || "", p: s.p.slice(0, 3), v: (s.v || [0, 0, 0]).slice(0, 3),
      t0: s.t0 || 0, tid: s.tid || "", shooter: s.shooter || null, pts: s.pts || 2, score: s.score.slice(0, 2).map((n) => n | 0), scored: !!s.scored });
    if (ball.mode === "fly" && !sameThrow) startFly(ball, clamp((Date.now() - ball.t0) / 1000, 0, 0.35));
    else if (ball.mode === "rest") { if (sim.on && sameThrow) sim.restTo = V(...ball.p); else { sim.on = false; sim.p.set(...ball.p); } }
    else if (ball.mode === "held") sim.on = false;
    if (ball.score[0] !== prevScore[0] || ball.score[1] !== prevScore[1]) {
      drawBoard(ball.score);
      if (ball.score[0] + ball.score[1] > prevScore[0] + prevScore[1]) log(`${ball.byName || "someone"} scored · HOME ${ball.score[1]} - GUEST ${ball.score[0]}`);
    }
    save();
  }

  // who holds it, and are they here
  const peerSeen = new Map();   // id -> { x, z, t, speed }
  function holderPos() {
    const w = world(); if (!w || !ball.by) return null;
    if (ball.by === myId()) return { x: w.player.x, z: w.player.z, yaw: w.player.body, speed: w.player.speed || 0, me: true };
    const p = (w.peers || []).find((q) => q.id === ball.by);
    if (!p) return null;
    const e = peerSeen.get(p.id) || { speed: 0 };
    return { x: p.x, z: p.z, yaw: p.yaw || 0, speed: e.speed || 0 };
  }
  const iHold = () => ball.mode === "held" && ball.by && ball.by === myId();
  const free = () => ball.mode !== "held" || !holderPos();
  function ballNow() { return sim.on ? sim.p : shown; }
  function pickUp() {
    const w = world(); if (!w) return;
    const s = getShell();
    sim.on = false;
    Object.assign(ball, { rev: ball.rev + 1, mode: "held", by: myId(), byName: (s && s.displayName) || "you", v: [0, 0, 0] });
    send(); save();
  }
  function setDown(x, z) {
    sim.on = false; sim.p.set(x, BALL_R, z); shown.set(x, BALL_R, z);
    Object.assign(ball, { rev: ball.rev + 1, mode: "rest", by: null, byName: "", p: [x, BALL_R, z], v: [0, 0, 0] });
    send(); save();
  }
  function shoot() {
    const w = world(); if (!w) return;
    const pl = w.player;
    const hp = HOOPS.reduce((a, b) => (Math.hypot(pl.x - C.cx, pl.z - a.z) <= Math.hypot(pl.x - C.cx, pl.z - b.z) ? a : b));
    const dxh = C.cx - pl.x, dzh = hp.z - pl.z, dist = Math.hypot(dxh, dzh) || 0.01;
    pl.body = Math.atan2(dxh, dzh);                                       // square up to the hoop
    const p0 = V(pl.x + (dxh / dist) * 0.32, 2.15, pl.z + (dzh / dist) * 0.32);
    const gauss = () => { let s = 0; for (let i = 0; i < 4; i++) s += Math.random(); return (s - 2) / 0.58; };
    const sd = 0.03 + 0.016 * dist;                                      // aim error grows with distance
    const tx = C.cx + gauss() * sd, tz = hp.z + gauss() * sd * 1.2, ty = RIM_Y + 0.02;
    const T = 0.62 + 0.085 * Math.hypot(tx - p0.x, tz - p0.z);
    const v0 = [(tx - p0.x) / T, (ty - p0.y + 0.5 * GRAV * T * T) / T, (tz - p0.z) / T];
    const three = Math.hypot(pl.x - C.cx, pl.z - hp.z) > 6.75 || (Math.abs(pl.x - C.cx) > 6.6 && Math.abs(pl.z - hp.base) < 1.6);
    const s = getShell();
    Object.assign(ball, { rev: ball.rev + 1, mode: "fly", by: null, byName: (s && s.displayName) || "you", p: [p0.x, p0.y, p0.z], v: v0,
      t0: Date.now(), tid: `${myId()}-${Date.now().toString(36)}`, shooter: myId(), pts: three ? 3 : 2, scored: false });
    startFly(ball, 0);
    send(); save();
  }
  function act() {   // the one action: pick up / shoot
    if (!inGym()) return false;
    const w = world();
    const a = w && w.asset;
    if (a && (a.holder === myId() || Math.hypot(w.player.x - a.x, w.player.z - a.z) < 1.35)) return false;   // the room's own Use wins
    if (iHold()) { shoot(); return true; }
    const b = ballNow();
    if (free() && b.y < 2.4 && Math.hypot(w.player.x - b.x, w.player.z - b.z) < 2.4) { pickUp(); return true; }
    return false;
  }

  /* ------------------------------------------- input: taps, Use, E (own listeners) - */
  const alive = () => !!ballMesh.parent && !!scene.parent;   // false once this zone is hot-swapped out
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null;
  const canvas = document.getElementById("gl");
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 }; };
  const onMove = (e) => { if (down) down.moved = Math.max(down.moved, Math.hypot(e.clientX - down.x, e.clientY - down.y)); };
  const onUp = (e) => {
    if (!alive()) return cleanup();
    const d = down; down = null;
    if (!d || d.moved > 10 || performance.now() - d.t > 400 || !inGym()) return;
    const w = world(); if (!w || !w.camera) return;
    if (iHold()) { act(); return; }
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, w.camera);
    if (ray.intersectObject(hit, false).some((h) => h.distance < 14)) {
      const b = ballNow();
      if (Math.hypot(w.player.x - b.x, w.player.z - b.z) < 2.4) act();
      else if (free()) log("walk up to the ball to pick it up");
    }
  };
  const onKey = (e) => { if (!alive()) return cleanup(); if (e.code === "KeyE" && !(e.target.matches && e.target.matches("input,textarea,select"))) act(); };
  let useBtn = null;
  const onUse = (e) => { if (!alive()) return cleanup(); act(); };
  function cleanup() {
    if (canvas) canvas.removeEventListener("pointerdown", onDown);
    removeEventListener("pointermove", onMove); removeEventListener("pointerup", onUp); removeEventListener("keydown", onKey);
    if (useBtn) useBtn.removeEventListener("pointerdown", onUse);
    if (net.offs) { for (const f of net.offs) try { f(); } catch (_) {} net.offs = null; }
  }
  if (canvas) canvas.addEventListener("pointerdown", onDown);
  addEventListener("pointermove", onMove); addEventListener("pointerup", onUp); addEventListener("keydown", onKey);
  addEventListener("pagehide", () => { if (alive() && iHold()) { const w = world(); setDown(clamp(w.player.x, G.x0 + 0.5, G.x1 - 0.5), clamp(w.player.z, G.z0 + 0.5, G.z1 - 0.5)); } });

  // the network: once the shell exists (room.js mounts it after the zones are built). One set of handlers per page,
  // even across hot-swaps (the previous gym's are taken off).
  const net = { shell: null, offs: null, asked: false };
  function hookNet() {
    const s = getShell();
    if (!s || !s.on) return;
    if (net.shell !== s) {
      const prev = window.__gymNet;
      if (prev && prev.offs) for (const f of prev.offs) try { f(); } catch (_) {}
      net.shell = s;
      net.offs = [s.on("gym-ball", (m, from) => adopt(m && m.s, from)),
        s.on("gym-ask", () => { if (ball.rev > 0) setTimeout(() => { if (!alive()) return; if (sim.on) { const w = wire(); w.p = sim.p.toArray(); w.v = sim.v.toArray(); w.t0 = Date.now(); s.send("gym-ball", { s: w }); } else send(); }, Math.random() * 400); })];
      window.__gymNet = net;
      net.asked = false;
    }
    if (!net.asked && s.connected) { net.asked = true; s.send("gym-ask", {}); }
  }

  /* -------------------------------------- rooms you cannot see (older room.js) - */
  // The world is one scene: from the gym looking east, the whole house is in view (~770 draw calls) though the wall
  // hides it. A room.js with world.culls does this for every zone; for one opened before that existed, the gym does it
  // from its own side: while the camera is in here, the other zones are drawn only through the open gym door (the
  // media room) and never the garage or kitchen; outside, the gym is drawn only while its door is open.
  const selfCull = !(k.world && k.world.culls);
  let culled = false;
  function cullFromGym(w) {
    const B = w.built || {}, dr = w.doors && w.doors["d-side"], open = !!dr && dr.amt > 0.001;
    const camIn = !!w.camera && w.camera.position.x < G.x1;
    for (const [id, e] of Object.entries(B)) {
      if (!e || !e.group) continue;
      if (id === "f") e.group.visible = camIn || open;
      else if (camIn) e.group.visible = id === "d" && open;
      else if (culled) e.group.visible = true;
    }
    culled = camIn;
  }

  /* --------------------------------------------------------------- tick - */
  let promptSet = "", t = 0, lastPromptAt = 0;
  const spinAxis = V(0, 0, 0), qs = new THREE.Quaternion();
  function tick(dt) {
    t += dt;
    if (!useBtn) { useBtn = document.querySelector(".hbs-act.go"); if (useBtn) useBtn.addEventListener("pointerdown", onUse); }
    hookNet();
    const w = world();
    if (selfCull && w) cullFromGym(w);
    // peer speeds (for the dribble)
    if (w && w.peers) for (const p of w.peers) {
      const e = peerSeen.get(p.id) || { x: p.x, z: p.z, speed: 0 };
      const v = dt > 0 ? Math.hypot(p.x - e.x, p.z - e.z) / dt : 0;
      e.speed += (Math.min(v, 4) - e.speed) * 0.15; e.x = p.x; e.z = p.z; peerSeen.set(p.id, e);
    }
    // fly
    if (sim.on) {
      sim.acc += Math.min(dt, 0.05);
      while (sim.acc >= STEP && sim.on) { sim.acc -= STEP; sim.on = stepSim(STEP); }
      shown.copy(sim.p);
      if (!sim.on) {   // it came to rest here
        if (sim.restTo) { shown.copy(sim.restTo); sim.p.copy(sim.restTo); }
        if (ball.shooter === myId() && ball.mode === "fly") { Object.assign(ball, { rev: ball.rev + 1, mode: "rest", p: sim.p.toArray(), v: [0, 0, 0] }); send(); }
        else ball.p = sim.p.toArray();
        save();
      }
    }
    // draw
    const hpos = ball.mode === "held" ? holderPos() : null;
    let x, y, z, moving = 0;
    if (hpos) {
      const fx = Math.sin(hpos.yaw), fz = Math.cos(hpos.yaw), rx = Math.cos(hpos.yaw), rz = -Math.sin(hpos.yaw);
      if (hpos.speed > 0.35) {   // dribble at the walker's side
        const ph = Math.abs(Math.sin(t * (5.5 + hpos.speed)));
        x = hpos.x + fx * 0.34 - rx * 0.2; z = hpos.z + fz * 0.34 - rz * 0.2; y = BALL_R + ph * 0.86;
        moving = hpos.speed;
      } else { x = hpos.x + fx * 0.3; z = hpos.z + fz * 0.3; y = 1.08 + Math.sin(t * 2) * 0.01; }
      if (hpos.me) {
        if (x > G.x1 - 0.25) { setDown(G.x1 - 0.7, clamp(z, DOOR.z0 - 0.6, DOOR.z1 + 0.6)); log("ball set down by the door (it stays in the gym)"); }
        else ball.p = [x, BALL_R, z];
      }
      shown.set(x, y, z);
    } else if (!sim.on) {
      // resting (or its holder left): settle onto the floor where it is
      const target = ball.mode === "held" ? V(ball.p[0], BALL_R, ball.p[2]) : V(...ball.p);
      shown.lerp(target, Math.min(1, dt * 6)); if (shown.y < BALL_R) shown.y = BALL_R;
    }
    // spin: roll on the floor, backspin in the air, the dribble's own roll
    const vel = sim.on ? sim.v : null;
    if (vel) {
      const hs = Math.hypot(vel.x, vel.z);
      if (hs > 0.01) { spinAxis.set(vel.z / hs, 0, -vel.x / hs); qs.setFromAxisAngle(spinAxis, (sim.p.y <= BALL_R + 0.01 ? hs / BALL_R : -9) * dt); ballMesh.quaternion.premultiply(qs); }
    } else if (moving) { qs.setFromAxisAngle(V(1, 0, 0), moving * dt / BALL_R * 0.5); ballMesh.quaternion.premultiply(qs); }
    ballMesh.position.copy(shown);
    ballShadow.position.set(shown.x, 0.004, shown.z);
    const sc = clamp(1.1 - shown.y * 0.18, 0.35, 1.0); ballShadow.scale.set(sc, sc, 1);
    // nets
    for (const n of nets) {
      if (n.swish > 0) { n.swish = Math.max(0, n.swish - dt * 1.8); const e = n.swish; n.mesh.scale.set(1 - 0.25 * e, 1 + 0.35 * Math.sin(e * 9) * e, 1 - 0.25 * e); }
      else n.mesh.scale.set(1, 1, 1);
    }
    // the prompt (the shell's line above the buttons); never a box over the screen
    let text = "";
    if (inGym() && w) {
      const a = w.asset, assetBusy = a && (a.holder === myId() || Math.hypot(w.player.x - a.x, w.player.z - a.z) < 1.35);
      if (!assetBusy) {
        if (iHold()) text = "Tap to shoot";
        else if (free() && ballNow().y < 2.4 && Math.hypot(w.player.x - ballNow().x, w.player.z - ballNow().z) < 2.4) text = "Pick up the ball";
      }
    }
    const s = getShell();
    if (s && s.setPrompt && (text !== promptSet || (text && performance.now() - lastPromptAt > 1500))) {
      if (text || promptSet) {
        s.setPrompt(text ? (s.isTouch ? text : `${text}  (E)`) : "");
        if (useBtn && text) useBtn.textContent = iHold() ? "Shoot" : "Pick up";
      }
      promptSet = text; lastPromptAt = performance.now();
    }
  }

  const camBlocks = [];
  for (let i = 0; i < BL.rows; i++) camBlocks.push([BL.back, BL.z0, BL.front - i * BL.run, BL.z1, 0, i * BL.rise + 0.55]);
  for (const b of STAND) camBlocks.push(b.length === 6 ? [b[0], b[2], b[3], b[5], b[1], b[4]] : b);
  for (const b of BOARDS) camBlocks.push([b[0], b[2] - 0.05, b[3], b[5] + 0.05, b[1], b[4]]);
  camBlocks.push([SB.x - 0.2, SB.z - SB.w / 2 - 0.1, SB.x + 0.2, SB.z + SB.w / 2 + 0.1, SB.y - SB.h / 2 - 0.1, SB.y + SB.h / 2 + 0.1]);

  return {
    G, C, HOOPS, DOOR, lights: [], meshes, camBlocks, tick,
    ball: {
      get state() { return wire(); }, get pos() { return ballNow().toArray(); }, get flying() { return sim.on; },
      pickUp, shoot, act, setDown, adopt, get holding() { return iHold(); }, get makes() { return makes; },
      /* tests: run the flight to its end now (fixed steps), as tick() would over the next seconds */
      fastForward(maxSec) { let n = 0; const lim = (maxSec || 30) / STEP; while (sim.on && n++ < lim) sim.on = stepSim(STEP); return { flying: sim.on, p: sim.p.toArray(), secs: n * STEP }; },
    },
  };
}
