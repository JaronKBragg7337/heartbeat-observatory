/* ============================================================================
   kitchen.js - Page E, the kitchen behind B's back wall
   ---------------------------------------------------------------------------
   Built into the SAME scene as the room (one world, no portal), like the
   garage (garage.js) and the media room (den.js). Open B's back door and you
   see straight in; from inside you see the room. B's back window is now a
   real window between B and the kitchen, so you see through it both ways.
   Interior: x 0.15..6.15, z -10.15..-4.15, 2.8 m tall. The shared wall with
   the room is z -4.00..-4.15; B's back door opening is x 0.54..1.46, 2.05 m.
   Shaker cabinets (upper + lower) with brass pulls, stone counters, a sink
   with a gooseneck faucet under the window, a range with a hood, a fridge,
   an island with stools, pendants, a tile backsplash, a fruit bowl, a kettle,
   a cutting board and the PAGE E sign.
   For the phone: every static part is merged per material (about 30 draw
   calls for the whole kitchen), nothing casts shadows (the sun's shadow
   frustum does not reach here anyway; soft contact shadows instead), one warm
   point light without shadows; the pendants and under-cabinet strip glow.
   ========================================================================== */
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export function buildKitchen(k) {
  const { THREE, scene, M, box, cyl, plane, canvasTex, rnd, solids, signTex, RoundedBoxGeometry } = k;
  const K = { x0: 0.15, x1: 6.15, z0: -10.15, z1: -4.15, h: 2.8 };
  const KW = K.x1 - K.x0, KD = K.z1 - K.z0, CX = (K.x0 + K.x1) / 2, CZ = (K.z0 + K.z1) / 2;
  const DOOR = { x0: 0.54, x1: 1.46, h: 2.05 };
  const PASS = { x0: 1.95, x1: 3.25, y0: 0.945, y1: 2.295 };   // B's back window: now a window between B and the kitchen
  const WIN = { x0: 2.6, x1: 3.7, y0: 1.12, y1: 2.2 };          // over the sink, to the outside
  const TOP = 0.92;                                             // counter height
  const solid = (a, b, c, d) => solids.push([a, b, c, d]);

  /* ------------------------------------------------- merge per material - */
  const buckets = new Map();
  const tmp = new THREE.Object3D();
  function put(geo, mat, x, y, z, o) {
    o = o || {};
    tmp.position.set(x, y, z); tmp.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || "XYZ");
    tmp.scale.set(o.sx || 1, o.sy || 1, o.sz || 1); tmp.updateMatrix();
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.applyMatrix4(tmp.matrix);
    if (o.f) g.applyMatrix4(o.f);
    for (const n of Object.keys(g.attributes)) if (n !== "position" && n !== "normal" && n !== "uv") g.deleteAttribute(n);
    let b = buckets.get(mat.uuid);
    if (!b) buckets.set(mat.uuid, (b = { mat, geos: [] }));
    b.geos.push(g);
  }
  const bx = (w, h, d, mat, x, y, z, o) => put(o && o.round ? new RoundedBoxGeometry(w, h, d, 2, o.round) : new THREE.BoxGeometry(w, h, d), mat, x, y, z, o);
  const cy = (r1, r2, h, mat, x, y, z, o) => put(new THREE.CylinderGeometry(r1, r2, h, (o && o.seg) || 16, 1, !!(o && o.open)), mat, x, y, z, o);
  const sp = (r, mat, x, y, z, o) => put(new THREE.SphereGeometry(r, (o && o.seg) || 14, (o && o.seg2) || 10), mat, x, y, z, o);
  const fr = (x, z, ry) => new THREE.Matrix4().makeRotationY(ry || 0).setPosition(x, 0, z);
  function flush() {
    const out = [];
    for (const b of buckets.values()) {
      const g = mergeGeometries(b.geos, false);
      for (const q of b.geos) q.dispose();
      const m = new THREE.Mesh(g, b.mat); m.receiveShadow = true; m.castShadow = false;
      if (b.mat.transparent) m.renderOrder = 1;
      scene.add(m); out.push(m);
    }
    buckets.clear();
    return out;
  }

  /* ---------------------------------------------------------- textures - */
  // terracotta floor tiles, 30 cm, warm grout; one repeat = 1.2 m (4 x 4 tiles)
  const floorTex = canvasTex(1024, 1024, (g, w, h) => {
    const r = rnd(601), n = 4, s = w / n;
    g.fillStyle = "rgb(150,132,110)"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const t = (r() - 0.5) * 30;
      g.fillStyle = `rgb(${158 + t},${88 + t * 0.6},${58 + t * 0.4})`;
      g.fillRect(i * s + 5, j * s + 5, s - 10, s - 10);
      for (let q = 0; q < 140; q++) {   // clay mottling
        g.fillStyle = `rgba(${r() < 0.5 ? "120,58,30" : "222,150,104"},${0.05 + r() * 0.09})`;
        g.beginPath(); g.arc(i * s + 8 + r() * (s - 16), j * s + 8 + r() * (s - 16), 3 + r() * 16, 0, 7); g.fill();
      }
      g.fillStyle = "rgba(255,230,200,.10)"; g.fillRect(i * s + 5, j * s + 5, s - 10, 6);
    }
  }, [KW / 1.2, KD / 1.2]);
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.62 });
  // warm cream plaster; UVs in metres (2.2 m per repeat)
  const plasterTex = canvasTex(512, 512, (g, w, h) => {
    const r = rnd(611);
    g.fillStyle = "rgb(228,214,188)"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) {
      const v = (r() - 0.5) * 16;
      g.fillStyle = `rgba(${v > 0 ? "255,250,238" : "120,96,64"},${Math.abs(v) / 260})`;
      g.beginPath(); g.arc(r() * w, r() * h, 3 + r() * 22, 0, 7); g.fill();
    }
  });
  plasterTex.wrapS = plasterTex.wrapT = THREE.RepeatWrapping;
  const wallMat = new THREE.MeshStandardMaterial({ map: plasterTex, roughness: 0.93, envMapIntensity: 0.5 });
  // glazed cream subway tile, 15 x 7.5 cm, running bond; one repeat = 0.6 m
  const tileTex = canvasTex(512, 512, (g, w, h) => {
    const r = rnd(621), cols = 4, rows = 8, tw = w / cols, th = h / rows;
    g.fillStyle = "rgb(214,204,186)"; g.fillRect(0, 0, w, h);
    for (let j = 0; j < rows; j++) for (let i = -1; i < cols + 1; i++) {
      const x = i * tw + (j % 2 ? tw / 2 : 0), y = j * th, t = (r() - 0.5) * 14;
      const gr = g.createLinearGradient(x, y, x, y + th);
      gr.addColorStop(0, `rgb(${246 + t},${240 + t},${226 + t})`); gr.addColorStop(1, `rgb(${232 + t},${224 + t},${206 + t})`);
      g.fillStyle = gr; g.fillRect(x + 3, y + 3, tw - 6, th - 6);
      g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(x + 6, y + 5, tw - 12, 3);
    }
  });
  tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
  const tileMat = new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.22, envMapIntensity: 0.9 });
  const runnerTex = canvasTex(512, 192, (g, w, h) => {
    const r = rnd(631);
    g.fillStyle = "#6c2f22"; g.fillRect(0, 0, w, h);
    for (const [y, c] of [[14, "#d9b77a"], [30, "#2d3b37"], [h - 40, "#2d3b37"], [h - 22, "#d9b77a"]]) { g.fillStyle = c; g.fillRect(10, y, w - 20, 8); }
    g.fillStyle = "#d9b77a";
    for (let x = 40; x < w - 30; x += 52) { g.beginPath(); g.moveTo(x, h / 2 - 26); g.lineTo(x + 18, h / 2); g.lineTo(x, h / 2 + 26); g.lineTo(x - 18, h / 2); g.fill(); }
    for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "255,236,210" : "20,10,5"},${r() * 0.09})`; g.fillRect(r() * w, r() * h, 2, 2); }
  });
  const blobTex = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, "rgba(0,0,0,.5)"); gr.addColorStop(0.6, "rgba(0,0,0,.28)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });

  const KM = {
    trim: new THREE.MeshStandardMaterial({ color: 0xf0e7d4, roughness: 0.5 }),
    cab: new THREE.MeshStandardMaterial({ color: 0xe7dcc4, roughness: 0.48 }),           // cream shaker
    island: new THREE.MeshStandardMaterial({ color: 0x55603f, roughness: 0.5 }),         // olive
    kick: new THREE.MeshStandardMaterial({ color: 0x3a3127, roughness: 0.8 }),
    stone: new THREE.MeshStandardMaterial({ color: 0xebe6dc, roughness: 0.28, envMapIntensity: 0.9 }),
    butcher: new THREE.MeshStandardMaterial({ color: 0xb37b47, roughness: 0.45 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc4c7c9, roughness: 0.3, metalness: 0.88 }),
    gap: new THREE.MeshStandardMaterial({ color: 0x1d1c1b, roughness: 0.6 }),
    cooktop: new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.18, metalness: 0.4 }),
    ovenGlass: new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.06, metalness: 0.3, envMapIntensity: 1.2 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x232323, roughness: 0.55, metalness: 0.6 }),
    brass: M.brass,
    walnut: M.walnut,
    maple: M.maple,
    leaf: M.leaf,
    terra: M.ceramic,
    bowl: new THREE.MeshStandardMaterial({ color: 0xe6e2d6, roughness: 0.35 }),
    kettle: new THREE.MeshStandardMaterial({ color: 0xa8342a, roughness: 0.3, metalness: 0.15 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xe07a1f, roughness: 0.6 }),
    apple: new THREE.MeshStandardMaterial({ color: 0x9e2a1f, roughness: 0.4 }),
    lemon: new THREE.MeshStandardMaterial({ color: 0xe3c43a, roughness: 0.55 }),
    pear: new THREE.MeshStandardMaterial({ color: 0x9aab45, roughness: 0.5 }),
    bread: new THREE.MeshStandardMaterial({ color: 0xb98345, roughness: 0.85 }),
    towel: new THREE.MeshStandardMaterial({ color: 0xd8ccb2, roughness: 0.95 }),
    jar: new THREE.MeshStandardMaterial({ color: 0xd9e3df, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.55, depthWrite: false }),
    shade: new THREE.MeshStandardMaterial({ color: 0x2f4236, roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide }),
    shadeIn: new THREE.MeshStandardMaterial({ color: 0xf6ead2, emissive: 0xffcf96, emissiveIntensity: 0.9, side: THREE.BackSide }),
    bulb: M.bulb,
    glow: new THREE.MeshBasicMaterial({ color: 0xffe0b0 }),
    clear: new THREE.MeshStandardMaterial({ color: 0xe8f0f0, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.1, depthWrite: false, envMapIntensity: 1.4 }),
    blob: new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }),
    runner: new THREE.MeshStandardMaterial({ map: runnerTex, roughness: 0.97 }),
    ceil: new THREE.MeshStandardMaterial({ color: 0xf0e8d8, roughness: 0.97, envMapIntensity: 0.4 }),
  };
  const contact = (w, d, x, z, ry) => put(new THREE.PlaneGeometry(w, d), KM.blob, x, 0.004, z, { rx: -Math.PI / 2, rz: ry || 0 });

  /* ------------------------------------------------------------- shell - */
  plane(KW, KD, floorMat, CX, 0, CZ, -Math.PI / 2);
  plane(DOOR.x1 - DOOR.x0, 0.15, floorMat, (DOOR.x0 + DOOR.x1) / 2, 0.001, -4.075, -Math.PI / 2);
  bx(DOOR.x1 - DOOR.x0, 0.014, 0.17, KM.maple, (DOOR.x0 + DOOR.x1) / 2, 0.007, -4.075);   // threshold
  plane(KW, KD, KM.ceil, CX, K.h, CZ, Math.PI / 2);

  /* a wall as one shape with holes; u along the wall, v up, UVs in metres. `notch` holes start at the floor. */
  function wall(len, holes, place, mat, tile) {
    const t = tile || 2.2, sh = new THREE.Shape();
    sh.moveTo(0, 0);
    for (const o of holes.filter((q) => q.v0 <= 0).sort((a, b) => a.u0 - b.u0)) { sh.lineTo(o.u0, 0); sh.lineTo(o.u0, o.v1); sh.lineTo(o.u1, o.v1); sh.lineTo(o.u1, 0); }
    sh.lineTo(len, 0); sh.lineTo(len, K.h); sh.lineTo(0, K.h); sh.closePath();
    for (const o of holes.filter((q) => q.v0 > 0)) {
      const p = new THREE.Path(); p.moveTo(o.u0, o.v0); p.lineTo(o.u1, o.v0); p.lineTo(o.u1, o.v1); p.lineTo(o.u0, o.v1); p.closePath(); sh.holes.push(p);
    }
    const geo = new THREE.ShapeGeometry(sh), pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / t, pos.getY(i) / t);
    const m = new THREE.Mesh(geo, mat || wallMat); m.receiveShadow = true; place(m); scene.add(m); return m;
  }
  // front wall (shared with B), faces -z: u runs from x1 toward x0
  wall(KW, [{ u0: K.x1 - DOOR.x1, u1: K.x1 - DOOR.x0, v0: 0, v1: DOOR.h }, { u0: K.x1 - PASS.x1, u1: K.x1 - PASS.x0, v0: PASS.y0, v1: PASS.y1 }],
    (m) => { m.position.set(K.x1, 0, K.z1); m.rotation.y = Math.PI; });
  // back wall faces +z, u along +x, with the window over the sink
  wall(KW, [{ u0: WIN.x0 - K.x0, u1: WIN.x1 - K.x0, v0: WIN.y0, v1: WIN.y1 }], (m) => { m.position.set(K.x0, 0, K.z0); });
  // left wall faces +x, u along -z from z1
  wall(KD, [], (m) => { m.position.set(K.x0, 0, K.z1); m.rotation.y = Math.PI / 2; });
  // right wall faces -x, u along +z from z0
  wall(KD, [], (m) => { m.position.set(K.x1, 0, K.z0); m.rotation.y = -Math.PI / 2; });

  // B's back door opening: jamb linings through the 15 cm wall + casing on the kitchen side
  for (const x of [DOOR.x0 + 0.015, DOOR.x1 - 0.015]) bx(0.03, DOOR.h, 0.15, KM.trim, x, DOOR.h / 2, -4.075);
  bx(DOOR.x1 - DOOR.x0, 0.03, 0.15, KM.trim, (DOOR.x0 + DOOR.x1) / 2, DOOR.h - 0.015, -4.075);
  bx(1.04, 0.07, 0.03, KM.trim, (DOOR.x0 + DOOR.x1) / 2, DOOR.h + 0.035, K.z1 - 0.015);
  for (const x of [DOOR.x0 - 0.035, DOOR.x1 + 0.035]) bx(0.07, DOOR.h + 0.07, 0.03, KM.trim, x, (DOOR.h + 0.07) / 2, K.z1 - 0.015);

  // the window between B and the kitchen: reveals, one clear pane, muntins + casing + a sill on the kitchen side
  {
    const xc = (PASS.x0 + PASS.x1) / 2, yc = (PASS.y0 + PASS.y1) / 2, ww = PASS.x1 - PASS.x0, wh = PASS.y1 - PASS.y0;
    for (const x of [PASS.x0 + 0.015, PASS.x1 - 0.015]) bx(0.03, wh, 0.15, KM.trim, x, yc, -4.075);
    for (const y of [PASS.y0 + 0.015, PASS.y1 - 0.015]) bx(ww, 0.03, 0.15, KM.trim, xc, y, -4.075);
    put(new THREE.PlaneGeometry(ww - 0.04, wh - 0.04), KM.clear, xc, yc, -4.075);
    for (const x of [PASS.x0 - 0.04, PASS.x1 + 0.04]) bx(0.08, wh + 0.1, 0.03, KM.trim, x, yc, K.z1 - 0.015);
    bx(ww + 0.16, 0.08, 0.03, KM.trim, xc, PASS.y1 + 0.04, K.z1 - 0.015);
    bx(ww + 0.16, 0.04, 0.16, KM.trim, xc, PASS.y0 - 0.02, K.z1 - 0.08);
  }

  // baseboards and crown
  const BASE = 0.1;
  const base = (len, x, z, ry) => bx(len, BASE, 0.022, KM.trim, x, BASE / 2, z, { ry });
  base(DOOR.x0 - 0.07 - K.x0, (K.x0 + DOOR.x0 - 0.07) / 2, K.z1 - 0.011);
  base(5.4 - DOOR.x1 - 0.07, (DOOR.x1 + 0.07 + 5.4) / 2, K.z1 - 0.011);
  base(KD, K.x0 + 0.011, CZ, Math.PI / 2);
  base(1.0, K.x0 + 0.5, K.z0 + 0.011);
  for (const [len, x, z, ry] of [[KW, CX, K.z1 - 0.02, 0], [KW, CX, K.z0 + 0.02, 0], [KD, K.x0 + 0.02, CZ, Math.PI / 2], [KD, K.x1 - 0.02, CZ, Math.PI / 2]]) {
    bx(len, 0.08, 0.04, KM.trim, x, K.h - 0.04, z, { ry });
  }

  /* -------------------------------------------- window to the outside - */
  {
    const xc = (WIN.x0 + WIN.x1) / 2, yc = (WIN.y0 + WIN.y1) / 2, ww = WIN.x1 - WIN.x0, wh = WIN.y1 - WIN.y0;
    plane(ww, wh, M.glass, xc, yc, K.z0 - 0.12, 0, 0);                         // daylight beyond
    for (const x of [WIN.x0 + 0.015, WIN.x1 - 0.015]) bx(0.03, wh, 0.13, KM.trim, x, yc, K.z0 - 0.06);
    bx(ww, 0.03, 0.13, KM.trim, xc, WIN.y1 - 0.015, K.z0 - 0.06);
    bx(0.04, wh, 0.04, KM.trim, xc, yc, K.z0 - 0.1);
    bx(ww, 0.04, 0.04, KM.trim, xc, yc + 0.12, K.z0 - 0.1);
    for (const x of [WIN.x0 - 0.04, WIN.x1 + 0.04]) bx(0.08, wh + 0.1, 0.03, KM.trim, x, yc, K.z0 + 0.015);
    bx(ww + 0.16, 0.08, 0.03, KM.trim, xc, WIN.y1 + 0.04, K.z0 + 0.015);
    bx(ww + 0.06, 0.035, 0.15, KM.stone, xc, WIN.y0 - 0.017, K.z0 - 0.04);    // stone sill
    // herbs on the sill
    for (const [i, x] of [[0, WIN.x0 + 0.2], [1, WIN.x1 - 0.22]]) {
      cy(0.055, 0.045, 0.1, KM.terra, x, WIN.y0 + 0.05, K.z0 - 0.04);
      const r = rnd(640 + i);
      for (let q = 0; q < 9; q++) sp(0.03 + r() * 0.025, KM.leaf, x + (r() - 0.5) * 0.09, WIN.y0 + 0.13 + r() * 0.1, K.z0 - 0.04 + (r() - 0.5) * 0.07, { sy: 0.7, seg: 7, seg2: 5 });
    }
  }

  /* ----------------------------------------------------------- cabinets - */
  /* one lower cabinet in a run's frame f: local x along the run, local z out of the wall (front at z = 0.6) */
  function lower(f, x, w, kind) {
    bx(w, 0.78, 0.56, KM.cab, x, 0.1 + 0.39, 0.28, { f });                 // carcass
    bx(w, 0.1, 0.5, KM.kick, x, 0.05, 0.25, { f });                        // toe kick
    const fz = 0.575, gap = 0.004;
    const shaker = (cx, cy0, fw, fh) => {                                  // a shaker front: slab + 4 rails
      bx(fw - gap, fh - gap, 0.018, KM.cab, cx, cy0, fz, { f });
      const rw = Math.min(0.065, fw * 0.14);
      for (const s of [-1, 1]) bx(rw, fh - gap, 0.012, KM.cab, cx + s * (fw / 2 - rw / 2 - gap), cy0, fz + 0.012, { f });
      for (const s of [-1, 1]) bx(fw - 2 * rw, rw, 0.012, KM.cab, cx, cy0 + s * (fh / 2 - rw / 2 - gap), fz + 0.012, { f });
    };
    if (kind === "sink") {     // a false front on top, two doors
      bx(w - gap, 0.15, 0.018, KM.cab, x, 0.785, fz, { f });
      for (const s of [-1, 1]) {
        shaker(x + s * w / 4, 0.4, w / 2, 0.58);
        cy(0.012, 0.012, 0.03, KM.brass, x + s * (0.04), 0.62, fz + 0.03, { f, rx: Math.PI / 2, seg: 10 });
      }
      return;
    }
    shaker(x, 0.785, w, 0.15);                                             // drawer
    cy(0.007, 0.007, Math.min(0.26, w * 0.45), KM.brass, x, 0.785, fz + 0.04, { f, rz: Math.PI / 2, seg: 8 });   // bar pull
    for (const s of [-1, 1]) bx(0.012, 0.012, 0.03, KM.brass, x + s * Math.min(0.12, w * 0.21), 0.785, fz + 0.025, { f });
    if (w > 0.7) {
      for (const s of [-1, 1]) { shaker(x + s * w / 4, 0.4, w / 2, 0.58); cy(0.012, 0.012, 0.03, KM.brass, x + s * 0.04, 0.62, fz + 0.03, { f, rx: Math.PI / 2, seg: 10 }); }
    } else {
      shaker(x, 0.4, w, 0.58);
      cy(0.012, 0.012, 0.03, KM.brass, x + w / 2 - 0.06, 0.62, fz + 0.03, { f, rx: Math.PI / 2, seg: 10 });
    }
  }
  /* an upper cabinet: 0.8 m tall, 0.34 m deep, bottom at 1.42 m, a warm strip light underneath */
  function upper(f, x, w) {
    const y0 = 1.42, hh = 0.8, d = 0.34;
    bx(w, hh, d - 0.02, KM.cab, x, y0 + hh / 2, (d - 0.02) / 2, { f });
    const n = w > 0.75 ? 2 : 1, dw = w / n;
    for (let i = 0; i < n; i++) {
      const cx = x - w / 2 + dw * (i + 0.5);
      bx(dw - 0.004, hh - 0.004, 0.018, KM.cab, cx, y0 + hh / 2, d - 0.01, { f });
      const rw = 0.06;
      for (const s of [-1, 1]) bx(rw, hh - 0.004, 0.012, KM.cab, cx + s * (dw / 2 - rw / 2 - 0.002), y0 + hh / 2, d + 0.004, { f });
      for (const s of [-1, 1]) bx(dw - 2 * rw, rw, 0.012, KM.cab, cx, y0 + hh / 2 + s * (hh / 2 - rw / 2 - 0.002), d + 0.004, { f });
      const kx = n === 2 ? (i === 0 ? cx + dw / 2 - 0.05 : cx - dw / 2 + 0.05) : cx + dw / 2 - 0.05;
      cy(0.012, 0.012, 0.03, KM.brass, kx, y0 + 0.09, d + 0.02, { f, rx: Math.PI / 2, seg: 10 });
    }
    bx(w - 0.06, 0.012, 0.03, KM.glow, x, y0 - 0.007, d - 0.06, { f });   // under-cabinet strip
    bx(w, 0.05, d + 0.02, KM.trim, x, y0 + hh + 0.025, (d + 0.02) / 2, { f });   // crown on the box
  }

  // back run, along the window wall: x 1.2 .. 5.55 (the corner belongs to the side run)
  const FB = fr(0, K.z0, 0);
  const SINK = { x0: 2.8, x1: 3.5, z0: K.z0 + 0.12, z1: K.z0 + 0.52, depth: 0.2 };
  {
    const xs = [[1.2, 1.8], [1.8, 2.4], [2.4, 2.8], [2.8, 3.5, "sink"], [3.5, 4.1], [4.1, 4.85], [4.85, 5.55]];
    for (const [a, b, kind] of xs) lower(FB, (a + b) / 2, b - a, kind);
    // stone top with the sink cut out: left, right, behind, in front
    const ty = TOP - 0.02, tz0 = K.z0, tz1 = K.z0 + 0.62;
    bx(SINK.x0 - 1.18, 0.04, tz1 - tz0, KM.stone, (1.18 + SINK.x0) / 2, ty, (tz0 + tz1) / 2);
    bx(5.55 - SINK.x1, 0.04, tz1 - tz0, KM.stone, (SINK.x1 + 5.55) / 2, ty, (tz0 + tz1) / 2);
    bx(SINK.x1 - SINK.x0, 0.04, SINK.z0 - tz0, KM.stone, (SINK.x0 + SINK.x1) / 2, ty, (tz0 + SINK.z0) / 2);
    bx(SINK.x1 - SINK.x0, 0.04, tz1 - SINK.z1, KM.stone, (SINK.x0 + SINK.x1) / 2, ty, (SINK.z1 + tz1) / 2);
    // undermount steel basin: floor + four sides, a drain
    const sxc = (SINK.x0 + SINK.x1) / 2, szc = (SINK.z0 + SINK.z1) / 2, sw = SINK.x1 - SINK.x0, sd = SINK.z1 - SINK.z0, sb = TOP - 0.04 - SINK.depth;
    bx(sw, 0.01, sd, KM.steel, sxc, sb, szc);
    for (const s of [-1, 1]) bx(0.01, SINK.depth, sd, KM.steel, sxc + s * (sw / 2 - 0.005), sb + SINK.depth / 2, szc);
    for (const s of [-1, 1]) bx(sw, SINK.depth, 0.01, KM.steel, sxc, sb + SINK.depth / 2, szc + s * (sd / 2 - 0.005));
    cy(0.035, 0.035, 0.004, KM.iron, sxc, sb + 0.007, szc, { seg: 18 });
    // gooseneck faucet behind the basin
    const fx = sxc, fz = K.z0 + 0.07;
    cy(0.028, 0.032, 0.03, KM.steel, fx, TOP + 0.015, fz, { seg: 18 });
    cy(0.015, 0.015, 0.3, KM.steel, fx, TOP + 0.18, fz, { seg: 12 });
    put(new THREE.TorusGeometry(0.11, 0.015, 8, 18, Math.PI), KM.steel, fx, TOP + 0.33, fz + 0.11, { ry: Math.PI / 2 });
    cy(0.017, 0.013, 0.07, KM.steel, fx, TOP + 0.3, fz + 0.22, { seg: 12 });
    bx(0.015, 0.012, 0.09, KM.steel, fx + 0.06, TOP + 0.08, fz, { ry: 0.5 });   // lever
    cy(0.016, 0.016, 0.06, KM.steel, fx + 0.06, TOP + 0.03, fz, { seg: 10 });
    // uppers either side of the window
    upper(FB, (1.2 + 2.45) / 2, 1.25);
    upper(FB, (3.85 + 5.55) / 2, 1.7);
    // tile backsplash between counter and uppers (under the window only up to its sill)
    const splash = (x0, x1, y0, y1) => {
      const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0), uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + uv.getX(i) * (x1 - x0)) / 0.6, (y0 + uv.getY(i) * (y1 - y0)) / 0.6);
      const m = new THREE.Mesh(g, tileMat); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, K.z0 + 0.006); m.receiveShadow = true; scene.add(m);
    };
    splash(1.18, WIN.x0 - 0.08, TOP, 1.42);
    splash(WIN.x0 - 0.08, WIN.x1 + 0.08, TOP, WIN.y0 - 0.035);
    splash(WIN.x1 + 0.08, K.x1, TOP, 1.42);
    solid(1.13, K.z0, 5.6, K.z0 + 0.67);
    contact(4.6, 1.0, 3.4, K.z0 + 0.6);
  }

  // side run along the right wall (x = 6.15), facing -x: local x = world z
  const FS = fr(K.x1, 0, -Math.PI / 2);
  const RANGE = { z0: -8.0, z1: -7.24 };
  {
    // the corner square (behind the back run's end) is a blind corner: carcass only
    bx(0.6, 0.86, 0.6, KM.cab, K.z0 + 0.3, 0.43, 0.3, { f: FS });
    for (const [a, b] of [[-9.55, -8.8], [-8.8, RANGE.z0], [RANGE.z1, -6.64], [-6.64, -6.04], [-6.04, -5.5]]) lower(FS, (a + b) / 2, b - a);
    const ty = TOP - 0.02;
    bx(RANGE.z0 - K.z0, 0.04, 0.62, KM.stone, (K.z0 + RANGE.z0) / 2, ty, 0.31, { f: FS });
    bx(-5.5 - RANGE.z1 + 0.02, 0.04, 0.62, KM.stone, (RANGE.z1 - 5.48) / 2, ty, 0.31, { f: FS });
    // the range: 76 cm, stainless, black glass cooktop with four iron grates, oven door with a window and a bar handle
    const rx = (RANGE.z0 + RANGE.z1) / 2, rw = RANGE.z1 - RANGE.z0;
    bx(rw - 0.006, 0.9, 0.62, KM.steel, rx, 0.45, 0.31, { f: FS });
    bx(rw - 0.01, 0.012, 0.6, KM.cooktop, rx, 0.906, 0.3, { f: FS });
    bx(rw - 0.006, 0.1, 0.05, KM.steel, rx, 0.98, 0.025, { f: FS });        // back guard
    for (const [dx, dz] of [[-0.19, 0.17], [0.19, 0.17], [-0.19, 0.43], [0.19, 0.43]]) {
      put(new THREE.TorusGeometry(0.075, 0.008, 6, 20), KM.iron, rx + dx, 0.918, dz, { rx: Math.PI / 2, f: FS });
      for (const a of [0, Math.PI / 2]) bx(0.2, 0.012, 0.014, KM.iron, rx + dx, 0.92, dz, { ry: a, f: FS });
      cy(0.03, 0.03, 0.012, KM.iron, rx + dx, 0.916, dz, { f: FS, seg: 12 });
    }
    bx(rw - 0.08, 0.06, 0.012, KM.cooktop, rx, 0.835, 0.625, { f: FS });    // control strip
    for (let i = 0; i < 5; i++) cy(0.018, 0.018, 0.03, KM.steel, rx - 0.26 + i * 0.13, 0.835, 0.64, { f: FS, rx: Math.PI / 2, seg: 12 });
    bx(rw - 0.1, 0.42, 0.01, KM.ovenGlass, rx, 0.47, 0.622, { f: FS });     // oven window
    cy(0.012, 0.012, rw - 0.12, KM.steel, rx, 0.75, 0.67, { f: FS, rz: Math.PI / 2, seg: 10 });
    for (const s of [-1, 1]) bx(0.018, 0.018, 0.05, KM.steel, rx + s * (rw / 2 - 0.08), 0.75, 0.645, { f: FS });
    bx(rw - 0.1, 0.015, 0.012, KM.gap, rx, 0.18, 0.622, { f: FS });          // drawer line
    // a linen towel over the oven handle
    bx(0.2, 0.34, 0.008, KM.towel, rx + 0.12, 0.6, 0.684, { f: FS, rx: -0.06 });
    bx(0.2, 0.05, 0.03, KM.towel, rx + 0.12, 0.765, 0.67, { f: FS });
    // the hood: a steel canopy (a squared frustum, half in the wall) and its chimney up to the ceiling
    cy(0.2, 0.62, 0.42, KM.steel, rx, 1.78, 0, { f: FS, seg: 4, ry: Math.PI / 4 });
    bx(0.32, K.h - 1.99, 0.3, KM.steel, rx, (1.99 + K.h) / 2, 0.15, { f: FS });
    bx(0.86, 0.04, 0.5, KM.steel, rx, 1.555, 0.25, { f: FS });
    bx(0.6, 0.006, 0.3, KM.gap, rx, 1.533, 0.3, { f: FS });                   // filter
    bx(0.5, 0.008, 0.03, KM.glow, rx, 1.535, 0.48, { f: FS });               // hood light
    // uppers either side of the hood, and a small one over the fridge
    upper(FS, (-9.55 + -8.25) / 2, 1.3);
    upper(FS, (-7.0 + -5.55) / 2, 1.45);
    // backsplash on the side wall
    const splash = (a, b, y0, y1) => {
      const g = new THREE.PlaneGeometry(b - a, y1 - y0), uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (a + uv.getX(i) * (b - a)) / 0.6, (y0 + uv.getY(i) * (y1 - y0)) / 0.6);
      const m = new THREE.Mesh(g, tileMat); m.position.set(K.x1 - 0.006, (y0 + y1) / 2, (a + b) / 2); m.rotation.y = -Math.PI / 2; m.receiveShadow = true; scene.add(m);
    };
    splash(K.z0 + 0.62, -8.25, TOP, 1.42);
    splash(-8.25, -7.0, TOP, 1.53);
    splash(-7.0, -5.5, TOP, 1.42);
    solid(K.x1 - 0.67, K.z0, K.x1, -5.45);
    contact(1.0, 4.8, K.x1 - 0.55, -7.8);
  }

  // the fridge: stainless French doors + freezer drawer, at the end of the side run
  {
    const F = { z0: -5.42, z1: -4.5, d: 0.72, h: 1.84 };
    const fz = (F.z0 + F.z1) / 2, fw = F.z1 - F.z0, fxF = K.x1 - F.d;   // front face x
    bx(F.d - 0.04, F.h, fw, KM.steel, K.x1 - (F.d - 0.04) / 2, F.h / 2, fz);
    // doors (slightly proud), a dark seam between them and above the drawer
    for (const s of [-1, 1]) bx(0.04, 1.12, fw / 2 - 0.006, KM.steel, fxF + 0.02, 0.7 + 0.56, fz + s * (fw / 4), { round: 0.008 });
    bx(0.04, 0.66, fw - 0.01, KM.steel, fxF + 0.02, 0.36, fz, { round: 0.008 });
    bx(0.03, 1.12, 0.008, KM.gap, fxF + 0.03, 1.26, fz);
    bx(0.03, 0.01, fw - 0.01, KM.gap, fxF + 0.03, 0.695, fz);
    bx(0.03, 0.03, fw, KM.gap, fxF + 0.03, 0.02, fz);
    for (const s of [-1, 1]) {
      cy(0.012, 0.012, 0.62, KM.steel, fxF - 0.04, 1.25, fz + s * 0.045, { seg: 10 });
      for (const dy of [-0.28, 0.28]) bx(0.05, 0.02, 0.02, KM.steel, fxF - 0.015, 1.25 + dy, fz + s * 0.045);
    }
    cy(0.012, 0.012, fw - 0.24, KM.steel, fxF - 0.04, 0.6, fz, { rx: Math.PI / 2, seg: 10 });
    for (const s of [-1, 1]) bx(0.05, 0.02, 0.02, KM.steel, fxF - 0.015, 0.6, fz + s * (fw / 2 - 0.13));
    // cabinet over it
    bx(0.6, 0.48, fw + 0.04, KM.cab, K.x1 - 0.3, F.h + 0.06 + 0.24, fz);
    for (const s of [-1, 1]) bx(0.02, 0.46, fw / 2 - 0.006, KM.cab, K.x1 - 0.6, F.h + 0.3, fz + s * fw / 4);
    for (const s of [-1, 1]) cy(0.012, 0.012, 0.03, KM.brass, K.x1 - 0.625, F.h + 0.12, fz + s * 0.05, { rz: Math.PI / 2, seg: 10 });
    bx(0.6, 0.05, fw + 0.06, KM.trim, K.x1 - 0.3, F.h + 0.565, fz);
    for (const s of [-1, 1]) bx(0.62, F.h + 0.06, 0.02, KM.cab, K.x1 - 0.31, (F.h + 0.06) / 2, fz + s * (fw / 2 + 0.03));   // panels
    solid(K.x1 - F.d - 0.08, F.z0 - 0.06, K.x1, F.z1 + 0.06);
    contact(1.0, 1.2, K.x1 - 0.4, fz);
  }

  /* -------------------------------------------------------- the island - */
  const IS = { x: 3.3, z: -7.67, w: 1.8, d: 0.66 };
  {
    // cabinets face the sink (-z): a run frame turned around so the fronts sit on the island's sink side
    const FI = fr(IS.x, IS.z - IS.d / 2 + 0.6, Math.PI);
    for (const [a, b] of [[-0.9, -0.3], [-0.3, 0.3], [0.3, 0.9]]) lower(FI, (a + b) / 2, b - a);
    // stool side (+z): a plain panelled back with a recessed groove every 15 cm
    bx(IS.w, 0.76, 0.02, KM.island, IS.x, 0.48, IS.z + IS.d / 2 + 0.005);
    for (let x = -IS.w / 2 + 0.15; x < IS.w / 2 - 0.01; x += 0.15) bx(0.008, 0.72, 0.006, KM.kick, IS.x + x, 0.48, IS.z + IS.d / 2 + 0.016);
    for (const s of [-1, 1]) bx(0.025, 0.86, IS.d + 0.04, KM.island, IS.x + s * (IS.w / 2 + 0.012), 0.43, IS.z);   // end panels
    // butcher-block top, 34 cm overhang on the stool side
    const T = { w: 2.1, d: 1.05, z: IS.z - IS.d / 2 - 0.05 + 1.05 / 2 };
    bx(T.w, 0.05, T.d, KM.butcher, IS.x, TOP - 0.025, T.z, { round: 0.008 });
    solid(IS.x - T.w / 2 - 0.05, T.z - T.d / 2 - 0.05, IS.x + T.w / 2 + 0.05, T.z + T.d / 2 + 0.05);
    contact(2.4, 1.3, IS.x, IS.z);
    // three counter stools: walnut seats, splayed black legs, a footrest ring
    for (const x of [IS.x - 0.6, IS.x, IS.x + 0.6]) {
      const sz = T.z + T.d / 2 + 0.22;
      cy(0.19, 0.18, 0.05, KM.walnut, x, 0.645, sz, { seg: 24 });
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        cy(0.012, 0.014, 0.64, KM.iron, x + Math.cos(a) * 0.14, 0.31, sz + Math.sin(a) * 0.14, { rx: -Math.sin(a) * 0.13, rz: Math.cos(a) * 0.13, seg: 8 });
      }
      put(new THREE.TorusGeometry(0.15, 0.008, 6, 24), KM.iron, x, 0.26, sz, { rx: Math.PI / 2 });
      contact(0.55, 0.55, x, sz);
    }
    solid(IS.x - 0.85, T.z + T.d / 2, IS.x + 0.85, T.z + T.d / 2 + 0.45);
    // a fruit bowl, a few pieces of fruit
    const bowlPts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; bowlPts.push(new THREE.Vector2(0.04 + Math.sin(t * Math.PI / 2) * 0.13, t * 0.09)); }
    for (let i = 10; i >= 0; i--) { const t = i / 10; bowlPts.push(new THREE.Vector2(0.03 + Math.sin(t * Math.PI / 2) * 0.12, 0.01 + t * 0.08)); }
    const bxp = IS.x - 0.35, bzp = T.z - 0.05;
    put(new THREE.LatheGeometry(bowlPts, 24), KM.bowl, bxp, TOP, bzp);
    const fr8 = rnd(651);
    const fruit = [[KM.orange, 0.04], [KM.orange, 0.04], [KM.apple, 0.038], [KM.lemon, 0.033], [KM.pear, 0.036], [KM.apple, 0.037]];
    fruit.forEach(([m, r], i) => {
      const a = i * 1.1 + fr8(), d = i < 4 ? 0.06 : 0.02;
      sp(r, m, bxp + Math.cos(a) * d, TOP + 0.06 + (i >= 4 ? 0.04 : 0), bzp + Math.sin(a) * d, { sy: m === KM.lemon ? 0.8 : 1, sx: m === KM.lemon ? 1.25 : 1 });
    });
    bx(0.008, 0.02, 0.008, KM.walnut, bxp + 0.02, TOP + 0.15, bzp + 0.01);   // a stem
    // a cookbook, open, by the bowl
    bx(0.3, 0.02, 0.22, KM.towel, IS.x + 0.35, TOP + 0.01, T.z - 0.1, { ry: -0.25 });
    bx(0.006, 0.022, 0.22, KM.walnut, IS.x + 0.35, TOP + 0.012, T.z - 0.1, { ry: -0.25 });
  }

  /* ------------------------------------------------------------- items - */
  // a cutting board with a loaf and a knife on the back counter
  bx(0.46, 0.025, 0.3, KM.maple, 4.45, TOP + 0.013, K.z0 + 0.33, { round: 0.008, ry: 0.06 });
  sp(0.1, KM.bread, 4.4, TOP + 0.06, K.z0 + 0.33, { sx: 1.5, sy: 0.6, sz: 0.8 });
  bx(0.2, 0.004, 0.035, KM.steel, 4.62, TOP + 0.03, K.z0 + 0.44, { ry: 0.25 });
  bx(0.1, 0.018, 0.022, KM.iron, 4.76, TOP + 0.034, K.z0 + 0.475, { ry: 0.25 });
  // a red enamel kettle on the front-left burner
  {
    const kz = RANGE.z1 - 0.19 - 0.0, kx = K.x1 - 0.43, ky = 0.93;
    cy(0.085, 0.1, 0.15, KM.kettle, kx, ky + 0.075, kz, { seg: 24 });
    cy(0.06, 0.085, 0.03, KM.kettle, kx, ky + 0.165, kz, { seg: 24 });
    cy(0.012, 0.02, 0.025, KM.iron, kx, ky + 0.19, kz, { seg: 10 });
    cy(0.012, 0.02, 0.13, KM.kettle, kx - 0.1, ky + 0.12, kz, { rz: 0.9, seg: 10 });
    put(new THREE.TorusGeometry(0.075, 0.009, 6, 16, Math.PI), KM.iron, kx, ky + 0.2, kz, { ry: Math.PI / 2 });
  }
  // a utensil crock and a salt cellar by the range
  cy(0.06, 0.055, 0.14, KM.bowl, K.x1 - 0.2, TOP + 0.07, -6.95, { seg: 18 });
  for (const [dx, dz, t] of [[-0.02, 0.01, -0.12], [0.02, -0.01, 0.1], [0, 0.02, 0.05]]) cy(0.01, 0.01, 0.3, KM.maple, K.x1 - 0.2 + dx, TOP + 0.2, -6.95 + dz, { rz: t, seg: 6 });
  cy(0.035, 0.035, 0.05, KM.maple, K.x1 - 0.3, TOP + 0.025, -6.75, { seg: 12 });
  // jars by the sink
  for (const [i, x] of [[0, 1.4], [1, 1.55], [2, 1.7]]) {
    const h = 0.16 + i * 0.03;
    cy(0.045, 0.045, h, KM.jar, x, TOP + h / 2, K.z0 + 0.12, { seg: 16 });
    cy(0.047, 0.047, 0.02, KM.maple, x, TOP + h + 0.01, K.z0 + 0.12, { seg: 16 });
    cy(0.04, 0.04, h * 0.6, [KM.bread, KM.lemon, KM.towel][i], x, TOP + h * 0.3 + 0.005, K.z0 + 0.12, { seg: 12 });
  }
  // an open shelf on the left wall with plates and bowls
  {
    const sx = K.x0 + 0.13, sz = -8.6;
    bx(0.24, 0.035, 1.2, KM.walnut, sx, 1.62, sz);
    for (const dz of [-0.45, 0.45]) bx(0.2, 0.12, 0.03, KM.iron, sx - 0.02, 1.56, sz + dz);
    for (let i = 0; i < 6; i++) cy(0.11, 0.08, 0.012, KM.bowl, sx, 1.645 + i * 0.013, sz - 0.3, { seg: 24 });
    for (let i = 0; i < 3; i++) cy(0.08, 0.05, 0.06, KM.bowl, sx, 1.67 + i * 0.045, sz + 0.1, { seg: 20 });
    for (const dz of [0.38, 0.5]) cy(0.04, 0.035, 0.1, dz > 0.4 ? KM.kettle : KM.island, sx, 1.69, sz + dz, { seg: 14 });
  }
  // a tall plant in the back-left corner
  {
    const px = K.x0 + 0.42, pz = K.z0 + 0.42;
    cy(0.2, 0.15, 0.42, KM.terra, px, 0.21, pz, { seg: 18 });
    const r = rnd(661);
    for (let i = 0; i < 22; i++) sp(0.09 + r() * 0.07, KM.leaf, px + (r() - 0.5) * 0.45, 0.55 + r() * 0.9, pz + (r() - 0.5) * 0.45, { sx: 1, sy: 0.45, sz: 1.6, rx: r() * 2, ry: r() * 6, seg: 8, seg2: 6 });
    solid(K.x0, K.z0, px + 0.3, pz + 0.3);
    contact(0.7, 0.7, px, pz);
  }
  // a runner in front of the sink
  plane(1.7, 0.62, KM.runner, 3.2, 0.006, K.z0 + 1.05, -Math.PI / 2);

  /* ---------------------------------------------------------- pendants - */
  for (const x of [IS.x - 0.45, IS.x + 0.45]) {
    const z = -7.52, y = 1.86;
    cy(0.004, 0.004, K.h - y - 0.2, KM.iron, x, (K.h + y + 0.2) / 2, z, { seg: 6 });
    cy(0.04, 0.04, 0.02, KM.iron, x, K.h - 0.01, z, { seg: 14 });
    cy(0.035, 0.18, 0.2, KM.shade, x, y + 0.1, z, { open: true, seg: 28 });
    cy(0.033, 0.175, 0.195, KM.shadeIn, x, y + 0.1, z, { open: true, seg: 28 });
    sp(0.045, KM.bulb, x, y + 0.03, z, { seg: 12, seg2: 8 });
  }
  const L = new THREE.PointLight(0xffc68e, 8.5, 9.5, 1.6); L.position.set(IS.x, 1.75, -7.52); scene.add(L);

  /* ----------------------------------------------------- PAGE E sign - */
  {
    const g = new THREE.Group(); g.position.set(K.x0 + 0.03, 1.65, -6.75); g.rotation.y = Math.PI / 2; scene.add(g);
    box(1.12, 0.74, 0.04, M.walnut, 0, 0, 0, { parent: g, cast: false });
    plane(1.0, 0.625, new THREE.MeshStandardMaterial({ map: signTex("E", "/lab/seam-room/e/"), roughness: 0.8 }), 0, 0, 0.022, 0, 0, g);
    cyl(0.02, 0.03, 0.18, M.brass, 0, 0.47, 0.08, { parent: g, rx: Math.PI / 2, cast: false });
  }

  const meshes = flush();
  /* boxes the camera stays out of (so it never ends up inside the fridge or a cabinet): [minX, minZ, maxX, maxZ, minY, maxY] */
  const camBlocks = [
    [K.x1 - 0.76, -5.47, K.x1, -4.45, 0, 2.42],                 // fridge + cabinet over it
    [1.18, K.z0, 5.55, K.z0 + 0.36, 1.4, 2.3],                  // back uppers
    [K.x1 - 0.36, -9.55, K.x1, -5.5, 1.4, 2.3],                 // side uppers
    [K.x1 - 0.52, RANGE.z0 - 0.08, K.x1, RANGE.z1 + 0.08, 1.53, K.h],   // hood
    [1.13, K.z0, 5.6, K.z0 + 0.64, 0, 0.95],                    // back counter
    [K.x1 - 0.64, K.z0, K.x1, -5.48, 0, 0.95],                  // side counter + range
    [2.25, -8.05, 4.35, -7.0, 0, 0.95],                         // island
  ];
  return { K, DOOR, PASS, lights: [L], meshes, camBlocks };
}
