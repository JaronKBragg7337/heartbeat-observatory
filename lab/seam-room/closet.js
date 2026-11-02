/* ============================================================================
   closet.js - Page H, the walk-in closet behind hallway door 1
   ---------------------------------------------------------------------------
   Jaron, standing in the hallway (page G, 11/1): "On page G door 1 make it a
   closet". Door 1 (g-1, the oak door on the hall's east wall at z 13) is a
   real door now; behind it, built into the SAME scene (one world, no portal):
   inside x -1.3..1.2, z 11.5..14.5 (2.5 x 3 m), 2.6 m high. The hall wall is
   x -1.45..-1.3; hallway.js openDoor() cuts it (linings + threshold) and
   paints the leaf oak; this file draws the closet's own face of that wall
   with the opening already in it.
   South wall: double-hung shirts over trousers, a shelf of boxes above.
   North wall: coats and jackets, a shelf of boxes above. East wall: a mirror
   over a two-tier shoe rack. A wicker laundry basket, a porcelain pull-chain
   bulb in the middle of the ceiling, the PAGE H sign over the door.
   Phone budget: static parts merged per material; every garment, hanger,
   box, shoe and chain bead is an InstancedMesh (one draw call per kind); no
   shadow casters and NO new light (the bulb glows, its light on the walls and
   floor is additive decals). The mirror is one cube snapshot of the closet,
   taken once the first time you are inside (no per-frame reflection pass).
   ========================================================================== */
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export function buildCloset(k) {
  const { THREE, scene, M, canvasTex, rnd, solids, signTex } = k;
  const C = { x0: -1.3, x1: 1.2, z0: 11.5, z1: 14.5, h: 2.6 };
  const CW = C.x1 - C.x0, CD = C.z1 - C.z0, CX = (C.x0 + C.x1) / 2, CZ = (C.z0 + C.z1) / 2;
  const DOOR = { z0: 12.54, z1: 13.46, h: 2.05 };       // g-1, in the west wall (the hall's east wall)
  const solid = (a, b, c, d) => solids.push([a, b, c, d]);
  const world = () => k.world || window.__seam || null;

  /* ------------------------------------------------- merge per material - */
  const map = new Map();
  const S = {
    add(geo, mat) {
      const g = geo.index ? geo.toNonIndexed() : geo;
      if (g !== geo) geo.dispose();
      for (const n of Object.keys(g.attributes)) if (n !== "position" && n !== "normal" && n !== "uv") g.deleteAttribute(n);
      if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      let b = map.get(mat.uuid); if (!b) map.set(mat.uuid, (b = { mat, geos: [] }));
      b.geos.push(g);
    },
    flush(into) {
      for (const b of map.values()) {
        const g = mergeGeometries(b.geos, false);
        for (const q of b.geos) q.dispose();
        const m = new THREE.Mesh(g, b.mat); m.castShadow = false; m.receiveShadow = false;
        if (b.mat.transparent) m.renderOrder = 2;
        into.add(m);
      }
      map.clear();
    },
  };
  const boxG = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x || 0, y || 0, z || 0);
  const cylG = (r1, r2, h, seg, x, y, z, rx, rz) => { const g = new THREE.CylinderGeometry(r1, r2, h, seg || 16); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); return g.translate(x || 0, y || 0, z || 0); };
  function quadG(w, h, tu, tv) {   // a rectangle with UVs in metres / tile
    const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
    if (tu) for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tu, uv.getY(i) * h / (tv || tu));
    return g;
  }
  const merge = (parts) => { const gs = parts.map((g) => (g.index ? g.toNonIndexed() : g)); for (const g of gs) for (const n of Object.keys(g.attributes)) if (n !== "position" && n !== "normal" && n !== "uv" && n !== "color") g.deleteAttribute(n); return mergeGeometries(gs, false); };

  /* ---------------------------------------------------------- textures - */
  const plaster = canvasTex(256, 256, (g, w, h) => {
    const r = rnd(1201); g.fillStyle = "#ede5d6"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = r() < 0.5 ? "120,100,80" : "255,250,240"; g.fillStyle = `rgba(${v},${0.03 + r() * 0.05})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
  }, [1, 1]);
  plaster.wrapS = plaster.wrapT = THREE.RepeatWrapping;
  const boards = canvasTex(256, 512, (g, w, h) => {   // oak boards running east-west (x), 125 mm: one repeat = 1 x 2 m
    const r = rnd(1203), n = 8, bw = w / n;
    for (let i = 0; i < n; i++) {
      let y = -r() * 300;
      while (y < h) {
        const len = 160 + r() * 300, t = (r() - 0.5) * 24;
        g.fillStyle = `rgb(${168 + t},${128 + t * 0.85},${86 + t * 0.6})`; g.fillRect(i * bw, y, bw, len);
        for (let q = 0; q < 5; q++) {
          g.strokeStyle = `rgba(${70 + r() * 30},${44 + r() * 16},20,${0.06 + r() * 0.08})`; g.lineWidth = 0.6 + r();
          const x = i * bw + r() * bw; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + (r() - 0.5) * 4, y + len * 0.3, x + (r() - 0.5) * 4, y + len * 0.7, x + (r() - 0.5) * 3, y + len); g.stroke();
        }
        g.fillStyle = "rgba(40,24,10,.5)"; g.fillRect(i * bw, y, bw, 2);
        y += len;
      }
      g.fillStyle = "rgba(40,24,10,.45)"; g.fillRect(i * bw, 0, 1.5, h);
    }
  });
  boards.wrapS = boards.wrapT = THREE.RepeatWrapping;
  // woven cotton (shirts, trousers): a fine twill; tinted per garment by the instance colour
  const weave = canvasTex(128, 128, (g, w, h) => {
    const r = rnd(1205); g.fillStyle = "#f4f4f2"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { if (((x + y) >> 1) % 3 === 0) { g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.05})`; g.fillRect(x, y, 2, 2); } }
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.12})`; g.fillRect(r() * w, r() * h, 1, 1); }
  }, [10, 10]);
  // wool (coats): heathered flecks
  const wool = canvasTex(128, 128, (g, w, h) => {
    const r = rnd(1207); g.fillStyle = "#e8e8e8"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) { const v = r() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${0.05 + r() * 0.12})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
  }, [8, 8]);
  // storage boxes: a lid band at the top and a hand hole, on every face; tinted per box
  const boxTex = canvasTex(128, 128, (g, w, h) => {
    const r = rnd(1209); g.fillStyle = "#f2f0ea"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(90,70,40,${r() * 0.07})`; g.fillRect(r() * w, r() * h, 2, 1); }
    g.fillStyle = "rgba(0,0,0,.22)"; g.fillRect(0, 22, w, 3);           // the lid's lower edge
    g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(0, 0, w, 3);
    g.fillStyle = "rgba(20,14,8,.75)"; g.beginPath(); g.ellipse(w / 2, 46, 15, 6, 0, 0, Math.PI * 2); g.fill();   // hand hole
  });
  const wicker = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = "#8a6a3c"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) {
      const odd = ((x + y) / 8) % 2;
      const gr = g.createLinearGradient(x, y, odd ? x + 8 : x, odd ? y : y + 8);
      gr.addColorStop(0, "#5e4424"); gr.addColorStop(0.5, "#c9a56c"); gr.addColorStop(1, "#5e4424");
      g.fillStyle = gr; g.fillRect(x + 0.5, y + 0.5, 7, 7);
    }
  }, [6, 3]);
  const glowTex = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });

  /* --------------------------------------------------------- materials - */
  const CM = {
    floor: new THREE.MeshStandardMaterial({ map: boards, color: 0xb09276, roughness: 0.45 }),
    wall: new THREE.MeshStandardMaterial({ map: plaster, color: 0xf3ece0, roughness: 0.94 }),
    ceil: new THREE.MeshStandardMaterial({ map: plaster, color: 0xf6f1e8, roughness: 0.97, envMapIntensity: 0.4 }),
    trim: M.trim,
    shelf: new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.45 }),   // white lacquer
    chrome: new THREE.MeshStandardMaterial({ color: 0xd7dadc, roughness: 0.18, metalness: 0.95 }),
    hanger: new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.45 }),   // walnut-stained wood hangers
    frame: new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.4, metalness: 0.2 }),
    porcelain: new THREE.MeshStandardMaterial({ color: 0xf2eee6, roughness: 0.25 }),
    brass: M.brass,
    bulb: M.bulb,
    wicker: new THREE.MeshStandardMaterial({ map: wicker, roughness: 0.9, side: THREE.DoubleSide }),
    towel: new THREE.MeshStandardMaterial({ map: wool, color: 0x9fb4c8, roughness: 0.98 }),
    towel2: new THREE.MeshStandardMaterial({ map: wool, color: 0xe9e2d2, roughness: 0.98 }),
    pool: new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffd9a8, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false }),
    shade: new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }),   // soft contact shadows
    sign: new THREE.MeshStandardMaterial({ map: signTex("H", "/lab/seam-room/h/"), roughness: 0.7 }),
  };

  /* ------------------------------------------------------------- shell - */
  S.add(quadG(CW, CD, 1, 2).rotateX(-Math.PI / 2).translate(CX, 0, CZ), CM.floor);
  S.add(quadG(CW, CD, 1).rotateX(Math.PI / 2).translate(CX, C.h, CZ), CM.ceil);
  S.add(quadG(CW, C.h, 1).translate(CX, C.h / 2, C.z0), CM.wall);                                        // south
  S.add(quadG(CW, C.h, 1).rotateY(Math.PI).translate(CX, C.h / 2, C.z1), CM.wall);                       // north
  S.add(quadG(CD, C.h, 1).rotateY(-Math.PI / 2).translate(C.x1, C.h / 2, CZ), CM.wall);                  // east
  const westQuad = (z0, z1, y0, y1) => S.add(quadG(z1 - z0, y1 - y0, 1).rotateY(Math.PI / 2).translate(C.x0, (y0 + y1) / 2, (z0 + z1) / 2), CM.wall);
  westQuad(C.z0, DOOR.z0, 0, C.h); westQuad(DOOR.z1, C.z1, 0, C.h); westQuad(DOOR.z0, DOOR.z1, DOOR.h, C.h);   // west, with the door opening
  // casing round the opening on the closet side
  for (const z of [DOOR.z0 - 0.035, DOOR.z1 + 0.035]) S.add(boxG(0.02, DOOR.h + 0.07, 0.07, C.x0 + 0.01, (DOOR.h + 0.07) / 2, z), CM.trim);
  S.add(boxG(0.02, 0.07, DOOR.z1 - DOOR.z0 + 0.14, C.x0 + 0.01, DOOR.h + 0.035, (DOOR.z0 + DOOR.z1) / 2), CM.trim);
  // baseboards and a small crown
  const BB = 0.09;
  S.add(boxG(CW, BB, 0.015, CX, BB / 2, C.z0 + 0.0075), CM.trim);
  S.add(boxG(CW, BB, 0.015, CX, BB / 2, C.z1 - 0.0075), CM.trim);
  S.add(boxG(0.015, BB, CD, C.x1 - 0.0075, BB / 2, CZ), CM.trim);
  for (const [z0, z1] of [[C.z0, DOOR.z0 - 0.07], [DOOR.z1 + 0.07, C.z1]]) S.add(boxG(0.015, BB, z1 - z0, C.x0 + 0.0075, BB / 2, (z0 + z1) / 2), CM.trim);
  const CR = 0.055;
  S.add(boxG(CW, CR, 0.03, CX, C.h - CR / 2, C.z0 + 0.015), CM.trim);
  S.add(boxG(CW, CR, 0.03, CX, C.h - CR / 2, C.z1 - 0.015), CM.trim);
  S.add(boxG(0.03, CR, CD, C.x1 - 0.015, C.h - CR / 2, CZ), CM.trim);
  S.add(boxG(0.03, CR, CD, C.x0 + 0.015, C.h - CR / 2, CZ), CM.trim);
  // PAGE H, small, over the door on the closet side
  S.add(quadG(0.38, 0.24).rotateY(Math.PI / 2).translate(C.x0 + 0.006, 2.33, (DOOR.z0 + DOOR.z1) / 2), CM.sign);
  S.add(boxG(0.012, 0.26, 0.4, C.x0 + 0.003, 2.33, (DOOR.z0 + DOOR.z1) / 2), CM.frame);

  /* ------------------------------------------------- rods and shelves - */
  // south wall (z0): double hang (shirts over trousers), shelf above. north wall (z1): one long hang (coats), shelf above.
  const RODX0 = C.x0 + 0.02, RODX1 = C.x1 - 0.02, RODL = RODX1 - RODX0, RODC = (RODX0 + RODX1) / 2;
  const SOUTH = { z: C.z0 + 0.3, rods: [2.0, 1.06], shelf: 2.24 };
  const NORTH = { z: C.z1 - 0.31, rods: [1.86], shelf: 2.1 };
  for (const [wz, side, W] of [[C.z0, 1, SOUTH], [C.z1, -1, NORTH]]) {
    for (const y of W.rods) {
      S.add(cylG(0.0125, 0.0125, RODL, 20, RODC, y, W.z, 0, Math.PI / 2), CM.chrome);
      for (const x of [C.x0 + 0.012, C.x1 - 0.012]) S.add(cylG(0.03, 0.03, 0.012, 20, x, y, W.z, 0, Math.PI / 2), CM.chrome);   // flanges
      // a centre support from the wall
      S.add(boxG(0.012, 0.03, 0.3, RODC, y + 0.03, wz + side * 0.15), CM.chrome);
    }
    const sd = 0.36;
    S.add(boxG(CW, 0.025, sd, CX, W.shelf, wz + side * sd / 2), CM.shelf);
    S.add(boxG(CW, 0.04, 0.02, CX, W.shelf - 0.0325, wz + side * 0.01), CM.shelf);                      // wall cleat
    for (const x of [C.x0 + 0.01, C.x1 - 0.01]) S.add(boxG(0.02, 0.04, sd - 0.02, x, W.shelf - 0.0325, wz + side * sd / 2), CM.shelf);
    for (const x of [CX - 0.62, CX + 0.62]) {   // steel shelf brackets
      S.add(boxG(0.008, 0.02, sd - 0.04, x, W.shelf - 0.0225, wz + side * (sd / 2)), CM.chrome);
      S.add(boxG(0.008, 0.22, 0.02, x, W.shelf - 0.13, wz + side * 0.012), CM.chrome);
      S.add(boxG(0.008, 0.02, 0.3, x, W.shelf - 0.13, wz + side * 0.16).rotateX(0), CM.chrome);
    }
  }
  solid(C.x0, C.z0, C.x1, C.z0 + 0.62);
  solid(C.x0, C.z1 - 0.62, C.x1, C.z1);

  /* ------------------------------------------------------- the clothes - */
  // garment outlines (across the garment = shape x, down = shape -y; the top is the shoulder line under the hanger bar)
  function outline(pts, hem) {
    const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    for (let i = pts.length - 1; i >= 0; i--) { if (i === pts.length - 1 && hem) s.quadraticCurveTo(0, hem, -pts[i][0], pts[i][1]); else s.lineTo(-pts[i][0], pts[i][1]); }
    s.closePath();
    return s;
  }
  function garment(shape, depth, bevel) {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 6 });
    g.translate(0, -0.075, -depth / 2);
    g.rotateY(Math.PI / 2);                 // shape x -> -z (across), thickness along the rod (x)
    return g;
  }
  const shirtShape = outline([[-0.05, 0.004], [-0.17, -0.03], [-0.222, -0.07], [-0.236, -0.56], [-0.205, -0.585], [-0.2, -0.70]], -0.76);
  const trouserShape = outline([[-0.17, -0.005], [-0.175, -0.07], [-0.155, -0.6]], -0.61);
  const coatShape = outline([[-0.065, 0.006], [-0.2, -0.025], [-0.258, -0.06], [-0.27, -0.72], [-0.238, -0.75], [-0.235, -0.93]], -0.945);
  const SH = garment(shirtShape, 0.016, 0.011), TR = garment(trouserShape, 0.012, 0.01), CO = garment(coatShape, 0.04, 0.02);
  TR.translate(0, -0.02, 0);
  // a wooden hanger + chrome hook, at the rod (origin = rod centre)
  const hangerWood = merge([
    boxG(0.012, 0.022, 0.23, 0, 0, 0).rotateX(0.28).translate(0, -0.09, 0.105),
    boxG(0.012, 0.022, 0.23, 0, 0, 0).rotateX(-0.28).translate(0, -0.09, -0.105),
    boxG(0.014, 0.03, 0.05, 0, -0.062, 0),
  ]);
  const hook = new THREE.TorusGeometry(0.021, 0.0028, 6, 16, Math.PI * 1.35).rotateZ(-0.2).rotateY(Math.PI / 2);
  const hangerHook = merge([hook, cylG(0.003, 0.003, 0.05, 6, 0, -0.04, 0)]);
  const shirtCols = [0xf4f4f0, 0xdfe9f4, 0x9cb8d6, 0xf2f2ee, 0x4f6b8d, 0xc9d7c0, 0xe7d7c4, 0x2d3e57, 0xf0e2e2, 0x7f8f9e, 0xffffff, 0xb24b45, 0x6f7f5e, 0xdfe6ee, 0x343434, 0xe8eef6, 0x8ba8c4, 0xd8c6a6];
  const trouserCols = [0x2f3440, 0x6b5a45, 0x1f2a3c, 0xb7a684, 0x3d3d3d, 0x4b5a6d, 0x5a4636, 0x283a5c, 0x9d8e72, 0x2a2a2a, 0x46586b];
  const coatCols = [0x2b2d33, 0x1d2840, 0xa47d55, 0x4b5240, 0x151515, 0x5a6c88, 0x6e2d2a, 0x3b3b3e, 0x8e7a5c, 0x26364f, 0x50463c];
  const R = rnd(1211), mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
  const hangs = [];   // [geo index, x, y, z, ry, color]
  function row(kind, y, z, gap0, gap1, cols, xs0, xs1) {
    const out = []; let x = xs0, i = 0;
    while (x < xs1) { out.push([kind, x, y, z, (R() - 0.5) * 0.16, cols[(i * 7 + Math.floor(R() * 3)) % cols.length]]); x += gap0 + R() * (gap1 - gap0); i++; if (R() < 0.08) x += 0.08; }
    return out;
  }
  hangs.push(...row(0, SOUTH.rods[0], SOUTH.z, 0.055, 0.085, shirtCols, C.x0 + 0.1, C.x1 - 0.12));
  hangs.push(...row(1, SOUTH.rods[1], SOUTH.z, 0.07, 0.11, trouserCols, C.x0 + 0.12, C.x1 - 0.14));
  hangs.push(...row(2, NORTH.rods[0], NORTH.z, 0.1, 0.15, coatCols, C.x0 + 0.13, C.x1 - 0.14));
  const garmentMats = [
    new THREE.MeshStandardMaterial({ map: weave, roughness: 0.82 }),
    new THREE.MeshStandardMaterial({ map: weave, roughness: 0.88 }),
    new THREE.MeshStandardMaterial({ map: wool, roughness: 0.96 }),
  ];
  const geos = [SH, TR, CO];
  const IMs = geos.map((g, i) => {
    const n = hangs.filter((h) => h[0] === i).length;
    const m = new THREE.InstancedMesh(g, garmentMats[i], n); m.castShadow = m.receiveShadow = false; m.name = ["closet-shirts", "closet-trousers", "closet-coats"][i];
    m.userData.n = 0; scene.add(m); return m;
  });
  const hW = new THREE.InstancedMesh(hangerWood, CM.hanger, hangs.length), hH = new THREE.InstancedMesh(hangerHook, CM.chrome, hangs.length);
  hW.castShadow = hH.castShadow = false; scene.add(hW); scene.add(hH);
  hangs.forEach((h, j) => {
    const [kind, x, y, z, ry, c] = h;
    q.setFromEuler(e.set(0, ry, 0)); v.set(x, y, z);
    mtx.compose(v, q, one);
    const m = IMs[kind]; m.setMatrixAt(m.userData.n, mtx); m.setColorAt(m.userData.n, col.setHex(c)); m.userData.n++;
    hW.setMatrixAt(j, mtx); hH.setMatrixAt(j, mtx);
  });
  for (const m of [...IMs, hW, hH]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); }

  /* -------------------------------------------------- boxes on shelves - */
  const boxes = [];   // [x, y (bottom), z, w, h, d, ry, colour]
  const boxCols = [0xc9a576, 0xf1ece2, 0x9aa0a6, 0xd2b48c, 0x6f7d8c, 0xe5ddd0, 0xb98b5c, 0x5f6e5a];
  for (const [W, wz, side, maxH] of [[SOUTH, C.z0, 1, 0.3], [NORTH, C.z1, -1, 0.42]]) {
    let x = C.x0 + 0.06 + R() * 0.05;
    while (x < C.x1 - 0.3) {
      const w = 0.3 + R() * 0.16, h = 0.16 + R() * (maxH - 0.2), d = 0.28 + R() * 0.05;
      const c = boxCols[Math.floor(R() * boxCols.length)], ry = (R() - 0.5) * 0.06;
      boxes.push([x + w / 2, W.shelf + 0.0125, wz + side * (d / 2 + 0.02), w, h, d, ry, c]);
      if (h < maxH * 0.62 && R() < 0.6) {   // a smaller one on top
        const w2 = w * (0.7 + R() * 0.2), h2 = Math.min(maxH - h - 0.02, 0.1 + R() * 0.1);
        if (h2 > 0.06) boxes.push([x + w / 2 + (R() - 0.5) * 0.04, W.shelf + 0.0125 + h, wz + side * (d / 2 + 0.02), w2, h2, d * 0.9, (R() - 0.5) * 0.12, boxCols[Math.floor(R() * boxCols.length)]]);
      }
      x += w + 0.03 + R() * 0.08;
    }
  }
  const boxIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ map: boxTex, roughness: 0.8 }), boxes.length);
  boxIM.castShadow = false; boxIM.name = "closet-boxes";
  boxes.forEach((b, i) => {
    q.setFromEuler(e.set(0, b[6], 0)); mtx.compose(v.set(b[0], b[1], b[2]), q, new THREE.Vector3(b[3], b[4], b[5]));
    boxIM.setMatrixAt(i, mtx); boxIM.setColorAt(i, col.setHex(b[7]));
  });
  boxIM.instanceMatrix.needsUpdate = true; boxIM.instanceColor.needsUpdate = true; boxIM.computeBoundingSphere(); scene.add(boxIM);

  /* --------------------------------------------- the mirror + shoe rack - */
  const MIR = { z: 13.0, y: 1.39, w: 0.62, h: 1.2, x: C.x1 - 0.028 };
  // frame
  for (const s of [-1, 1]) {
    S.add(boxG(0.035, MIR.h + 0.09, 0.045, C.x1 - 0.018, MIR.y, MIR.z + s * (MIR.w / 2 + 0.0225)), CM.frame);
    S.add(boxG(0.035, 0.045, MIR.w + 0.09, C.x1 - 0.018, MIR.y + s * (MIR.h / 2 + 0.0225), MIR.z), CM.frame);
  }
  S.add(boxG(0.008, MIR.h, MIR.w, C.x1 - 0.004, MIR.y, MIR.z), CM.frame);   // backing
  const mirStd = new THREE.MeshStandardMaterial({ color: 0xeef1f2, metalness: 1, roughness: 0.04 });
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(MIR.w, MIR.h).rotateY(-Math.PI / 2), mirStd);
  mirror.position.set(MIR.x, MIR.y, MIR.z); mirror.name = "closet-mirror"; scene.add(mirror);
  // shoe rack: two sloped tiers between two chrome end frames, against the east wall under the mirror
  const SR = { x0: C.x1 - 0.34, x1: C.x1 - 0.02, z0: 12.22, z1: 13.78 }, SRL = SR.z1 - SR.z0, SRC = (SR.z0 + SR.z1) / 2;
  const tiers = [{ yF: 0.09, yB: 0.17 }, { yF: 0.3, yB: 0.38 }];
  for (const z of [SR.z0, SR.z1]) {
    for (const x of [SR.x0 + 0.01, SR.x1 - 0.01]) S.add(cylG(0.008, 0.008, 0.46, 8, x, 0.23, z), CM.chrome);
    for (const t of tiers) S.add(cylG(0.007, 0.007, SR.x1 - SR.x0, 8, (SR.x0 + SR.x1) / 2, (t.yF + t.yB) / 2, z, 0, Math.PI / 2 + 0.25), CM.chrome);
  }
  for (const t of tiers) for (const [x, y] of [[SR.x0 + 0.02, t.yF + 0.015], [SR.x0 + 0.1, t.yF + 0.022], [SR.x1 - 0.1, t.yB - 0.022], [SR.x1 - 0.02, t.yB]]) S.add(cylG(0.006, 0.006, SRL, 8, x, y, SRC, Math.PI / 2), CM.chrome);
  solid(SR.x0, SR.z0 - 0.02, C.x1, SR.z1 + 0.02);
  // a shoe: sole + upper (vertex colour darkens the opening), toe toward -x (the aisle)
  const sole = merge([new THREE.BoxGeometry(0.28, 0.024, 0.098).translate(0, 0.012, 0), new THREE.CylinderGeometry(0.049, 0.049, 0.024, 14).translate(-0.14, 0.012, 0)]);
  const upperBody = new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.27, 0.17, 0.094).translate(-0.01, 0.022, 0);
  const heel = new THREE.BoxGeometry(0.08, 0.075, 0.09).translate(0.1, 0.06, 0);
  const opening = new THREE.CircleGeometry(0.5, 14).rotateX(-Math.PI / 2).scale(0.12, 1, 0.07).translate(0.075, 0.1, 0);
  const paint = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3).fill(c); g.setAttribute("color", new THREE.Float32BufferAttribute(a, 3)); return g; };
  const upper = merge([paint(upperBody, 1), paint(heel, 1), paint(opening, 0.12)].map((g) => (g.index ? g.toNonIndexed() : g)));
  const shoes = [];   // [x, y, z, tilt, ry, upper colour, sole colour]
  const shoeTypes = [[0x5a3720, 0x2a1a10], [0x161616, 0x111111], [0xf2f2f0, 0xf4f4f4], [0x9a6b3e, 0x3a2a1e], [0x2c3d5c, 0xf0f0ee], [0x7a2a28, 0x2a1a10], [0xd9c9a8, 0x7a5a3a], [0x404448, 0xe8e8e6]];
  const tilt = Math.atan2(tiers[0].yB - tiers[0].yF, SR.x1 - SR.x0 - 0.04);
  let si = 0;
  for (const t of tiers) {
    for (let p = 0; p < 4; p++) {
      const [cu, cs] = shoeTypes[si++ % shoeTypes.length], zc = SR.z0 + 0.2 + p * (SRL - 0.4) / 3;
      for (const dz of [-0.06, 0.06]) shoes.push([(SR.x0 + SR.x1) / 2, (t.yF + t.yB) / 2 + 0.012, zc + dz + (R() - 0.5) * 0.01, tilt, (R() - 0.5) * 0.08, cu, cs]);
    }
  }
  const shoeIM = new THREE.InstancedMesh(upper, new THREE.MeshStandardMaterial({ map: null, roughness: 0.5, vertexColors: true }), shoes.length);
  const soleIM = new THREE.InstancedMesh(sole, new THREE.MeshStandardMaterial({ roughness: 0.75 }), shoes.length);
  shoeIM.name = "closet-shoes"; shoeIM.castShadow = soleIM.castShadow = false;
  shoes.forEach((s, i) => {
    q.setFromEuler(e.set(0, s[4], s[3])); mtx.compose(v.set(s[0], s[1], s[2]), q, one);
    shoeIM.setMatrixAt(i, mtx); soleIM.setMatrixAt(i, mtx); shoeIM.setColorAt(i, col.setHex(s[5])); soleIM.setColorAt(i, col.setHex(s[6]));
  });
  for (const m of [shoeIM, soleIM]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); scene.add(m); }

  /* --------------------------------------------------- laundry basket - */
  const BK = { x: 0.45, z: 13.63, r0: 0.19, r1: 0.235, h: 0.5 };
  const prof = []; for (let i = 0; i <= 6; i++) { const t = i / 6; prof.push(new THREE.Vector2(BK.r0 + (BK.r1 - BK.r0) * t, t * BK.h)); }
  S.add(new THREE.LatheGeometry(prof, 22).translate(BK.x, 0, BK.z), CM.wicker);
  S.add(new THREE.CircleGeometry(BK.r0, 22).rotateX(-Math.PI / 2).translate(BK.x, 0.01, BK.z), CM.wicker);
  S.add(new THREE.TorusGeometry(BK.r1, 0.016, 8, 26).rotateX(Math.PI / 2).translate(BK.x, BK.h, BK.z), CM.hanger);
  for (const s of [-1, 1]) S.add(new THREE.TorusGeometry(0.045, 0.01, 6, 12, Math.PI).translate(BK.x, BK.h - 0.09, BK.z + s * (BK.r1 - 0.005)), CM.hanger);   // rope handles
  S.add(new THREE.SphereGeometry(0.2, 14, 8).scale(1, 0.38, 0.9).translate(BK.x - 0.03, BK.h - 0.02, BK.z + 0.02), CM.towel);
  S.add(new THREE.SphereGeometry(0.16, 12, 8).scale(1.1, 0.42, 0.8).rotateY(0.7).translate(BK.x + 0.05, BK.h + 0.02, BK.z - 0.05), CM.towel2);
  solid(BK.x - BK.r1 - 0.01, BK.z - BK.r1 - 0.01, BK.x + BK.r1 + 0.01, C.z1 - 0.62);

  /* ------------------------------------------ the pull-chain bulb + glow - */
  const BU = { x: CX, z: CZ };
  S.add(cylG(0.06, 0.065, 0.035, 22, BU.x, C.h - 0.0175, BU.z), CM.porcelain);
  S.add(cylG(0.026, 0.03, 0.05, 16, BU.x, C.h - 0.06, BU.z), CM.porcelain);
  S.add(cylG(0.016, 0.016, 0.016, 12, BU.x, C.h - 0.093, BU.z), CM.brass);
  S.add(new THREE.SphereGeometry(0.031, 16, 12).scale(1, 1.25, 1).translate(BU.x, C.h - 0.13, BU.z), CM.bulb);
  // the chain: a run of tiny brass beads, then the pull
  const chainTop = C.h - 0.07, chainLen = 0.62, beads = 70;
  const beadIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0022, 5, 4), CM.brass, beads + 1);
  for (let i = 0; i < beads; i++) { mtx.makeTranslation(BU.x + 0.032, chainTop - (i / beads) * chainLen, BU.z); beadIM.setMatrixAt(i, mtx); }
  mtx.compose(v.set(BU.x + 0.032, chainTop - chainLen - 0.012, BU.z), q.identity(), new THREE.Vector3(3.2, 6, 3.2)); beadIM.setMatrixAt(beads, mtx);   // the pull
  beadIM.instanceMatrix.needsUpdate = true; beadIM.computeBoundingSphere(); beadIM.castShadow = false; beadIM.name = "closet-chain"; scene.add(beadIM);
  // the bulb's light: a halo round it and soft washes on the ceiling, walls and floor (additive, no real light)
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe2b0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(0.42, 0.42, 1); halo.position.set(BU.x, C.h - 0.13, BU.z); halo.renderOrder = 3; scene.add(halo);
  S.add(quadG(1.6, 1.6).rotateX(Math.PI / 2).translate(BU.x, C.h - 0.003, BU.z), CM.pool);
  S.add(quadG(2.4, 2.4).rotateX(-Math.PI / 2).translate(BU.x, 0.004, BU.z), CM.pool);
  S.add(quadG(2.4, 1.8).translate(CX, C.h - 0.9, C.z0 + 0.003), CM.pool);
  S.add(quadG(2.4, 1.8).rotateY(Math.PI).translate(CX, C.h - 0.9, C.z1 - 0.003), CM.pool);
  S.add(quadG(2.6, 1.8).rotateY(-Math.PI / 2).translate(C.x1 - 0.003, C.h - 0.9, CZ), CM.pool);
  // soft contact shadows under the rack, the basket and the hanging clothes
  S.add(quadG(0.42, 1.7).rotateX(-Math.PI / 2).translate((SR.x0 + SR.x1) / 2, 0.003, SRC), CM.shade);
  S.add(quadG(0.62, 0.62).rotateX(-Math.PI / 2).translate(BK.x, 0.0035, BK.z), CM.shade);
  S.add(quadG(CW, 0.7).rotateX(-Math.PI / 2).translate(CX, 0.0025, C.z0 + 0.3), CM.shade);
  S.add(quadG(CW, 0.7).rotateX(-Math.PI / 2).translate(CX, 0.0025, C.z1 - 0.3), CM.shade);

  S.flush(scene);

  /* ---------------------------------------------------------- the mirror - */
  /* One cube snapshot from the mirror, taken the first time the camera is inside the closet (people hidden for it),
     then a plain reflective material that samples it: no per-frame reflection pass. */
  let snap = null, inside = 0;
  function takeSnapshot() {
    const w = world(), r = (w && w.renderer) || (window.__seam && window.__seam.renderer);
    if (!r || !THREE.CubeCamera) return false;
    let root = scene; while (root.parent) root = root.parent;
    const rt = new THREE.WebGLCubeRenderTarget(256, { generateMipmaps: false });
    const cc = new THREE.CubeCamera(0.05, 20, rt);
    cc.position.set(MIR.x - 0.6, MIR.y, MIR.z);   // a step out from the glass, where a person looking in would be
    const hidden = [];
    root.traverse((o) => { if (o.visible && (o.isSkinnedMesh || o.isSprite) && o !== halo) { o.visible = false; hidden.push(o); } });
    mirror.visible = false;
    try { cc.update(r, root); } catch (_) { mirror.visible = true; for (const o of hidden) o.visible = true; rt.dispose(); return false; }
    mirror.visible = true; for (const o of hidden) o.visible = true;
    mirror.material = new THREE.MeshBasicMaterial({ envMap: rt.texture, color: 0xf2f4f4 });
    mirStd.dispose();
    snap = rt;
    return true;
  }
  /* --------------------------------------- the room you cannot see - */
  /* room.js always draws the room itself (A and B); from in here it sits behind the closet's south wall (~150 extra
     draw calls). While the camera is in the closet and the way to A (g-1, d-back and a-d) is not all open, the room's
     static pieces and the doors you cannot see are switched to a layer the camera does not draw. A layer, not
     `visible`, so this never fights hallway.js (which uses `visible` for the same pieces while you are in the hall).
     Lights, people, name tags, the log/chair and its halo are never touched. */
  const root = scene.parent, OFF = 30;
  const cut = { list: null, key: "" };
  function shellList(key, dd) {
    const out = [], bb = new THREE.Box3();
    if (!root) return out;
    for (const c of root.children) {
      if (c === scene || /^zone-/.test(c.name || "")) continue;
      const dm = /^door-(.+)$/.exec(c.name || "");
      if (dm) {
        const btw = (dd[dm[1]] && dd[dm[1]].data && dd[dm[1]].data.between) || [];
        if (!btw.includes("g") && !btw.includes("h") && !(key === "den" && btw.includes("d"))) out.push(c);
        continue;
      }
      let skip = false, meshes = 0;
      c.traverse((o) => {
        if (o.isLight || o.isSkinnedMesh || o.isBone || o.isSprite || o.isPoints || (o.userData && (o.userData.asset || o.userData.placeholder)) || (o.geometry && o.geometry.type === "RingGeometry")) skip = true;
        if (o.isMesh) meshes++;
      });
      if (skip || !meshes) continue;
      bb.setFromObject(c);
      if (bb.isEmpty() || bb.min.x < -6.4 || bb.max.x > 6.4 || bb.min.z < -4.4 || bb.max.z > 4.4) continue;
      out.push(c);
    }
    return out;
  }
  const hideTree = (c, on) => c.traverse((o) => {
    if (on) { if (o.userData.closetMask == null) { o.userData.closetMask = o.layers.mask; o.layers.set(OFF); } }
    else if (o.userData.closetMask != null) { o.layers.mask = o.userData.closetMask; delete o.userData.closetMask; }
  });
  if (root) for (const c of root.children) if (c.userData && c.userData.closetCut) { hideTree(c, false); delete c.userData.closetCut; }   // a hot-swapped closet
  function cullRoom() {
    const w = world(), cam = w && w.camera;
    if (!root || !cam) return;
    const p = cam.position, dd = (w && w.doors) || {}, open = (id) => !!dd[id] && dd[id].amt > 0.001;
    const inC = scene.visible && p.x > C.x0 - 0.02 && p.x < C.x1 + 0.1 && p.z > C.z0 - 0.1 && p.z < C.z1 + 0.1;
    const key = !inC ? "" : !(open("g-1") && open("d-back")) ? "shut" : !open("a-d") ? "den" : "";
    if (key === cut.key) return;
    if (cut.list) for (const c of cut.list) { hideTree(c, false); delete c.userData.closetCut; }
    cut.list = key ? shellList(key, dd) : null; cut.key = key;
    if (cut.list) for (const c of cut.list) { hideTree(c, true); c.userData.closetCut = true; }
  }

  function tick(dt) {
    cullRoom();
    if (snap || !scene.visible) return;
    const w = world(), pl = w && w.player;
    if (!pl) return;
    const isIn = pl.x > C.x0 + 0.1 && pl.x < C.x1 && pl.z > C.z0 && pl.z < C.z1;
    inside = isIn ? inside + dt : 0;
    if (inside > 0.6 && !takeSnapshot()) inside = -30;   // no renderer handle: keep the plain metal mirror
  }

  /* camera keep-outs ([minX, minZ, maxX, maxZ, minY, maxY]): the third-person camera stays in the aisle, out of the
     clothes and the mirror */
  const camBlocks = [
    [C.x0, C.z0, C.x1, C.z0 + 0.6, 0, C.h], [C.x0, C.z1 - 0.6, C.x1, C.z1, 0, C.h], [SR.x0, SR.z0, C.x1, SR.z1, 0, C.h],
  ];

  return { C, DOOR, tick, mirror, camBlocks, get snapshot() { return !!snap; }, get roomHidden() { return cut.list ? cut.list.length : 0; },
    counts: { shirts: IMs[0].count, trousers: IMs[1].count, coats: IMs[2].count, boxes: boxes.length, shoes: shoes.length } };
}
