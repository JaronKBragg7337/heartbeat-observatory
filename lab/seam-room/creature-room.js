/* ============================================================================
   creature-room.js - Page J, the creature's room behind hallway door 3
   ---------------------------------------------------------------------------
   Jaron picked it (11/4): door 3 (g-3, the walnut door on the hall's east
   wall at z 20) opens into a cozy room for the creature, the growing pet from
   /lab/pet/ (createPet in pet.js, the script-driven pet: cells, springs, a
   hop to walk). It keeps its bounce walk and wanders the room. Built into the
   SAME scene (one world, no portal): inside x -1.3..3.9, z 16.2..23.4
   (5.2 x 7.2 m), 2.6 m high. The hall wall is x -1.45..-1.3; hallway.js
   openDoor() cuts it and paints the leaf walnut; this file draws the room's
   own face of that wall with the opening already in it.
   A soft round rug, sage beadboard under a starry paper, a window with a
   garden view and curtains, a paper lantern and fairy lights (no new light:
   they glow, their light is additive decals), a woven bed with a cushion and a
   blanket (it walks to its bed when it gets sleepy), a food bowl and a water
   bowl, a teepee, wooden blocks, a ring stacker, a plant, a growth chart and
   a crayon drawing of it, a ball it bumps around, the PAGE J sign.
   Tap the creature: a squish and a happy double bounce, with hearts.
   Tap the food bowl: a berry drops in and it hops over to eat it.
   Tap the ball: it rolls away from you.
   If this phone already has a pet from /lab/pet/ (localStorage "hb-pet:v1"),
   it is THAT pet (its name, colour and size), and what it eats here counts
   there. With no saved pet it is a fresh peach one and nothing is saved.
   Phone budget: static parts merged per material, the fairy bulbs are one
   InstancedMesh, the pet's body is one InstancedMesh (pet.js), no shadows,
   NO new light. The pet only thinks while its room can be seen. While the
   camera is in here the room's (A/B) static pieces go to an undrawn camera
   layer, like closet.js and studio.js.
   ========================================================================== */
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createPet } from "/lab/pet/pet.js";

export function buildCreatureRoom(k) {
  const { THREE, scene, M, canvasTex, rnd, solids, signTex } = k;
  const R = { x0: -1.3, x1: 3.9, z0: 16.2, z1: 23.4, h: 2.6 };
  const RW = R.x1 - R.x0, RD = R.z1 - R.z0, CX = (R.x0 + R.x1) / 2, CZ = (R.z0 + R.z1) / 2;
  const DOOR = { z0: 19.54, z1: 20.46, h: 2.05 };            // g-3, in the west wall (the hall's east wall)
  const WIN = { z0: 19.1, z1: 20.5, y0: 0.8, y1: 2.05 };      // the window, in the east wall
  const WAIN = 0.9;
  const SAVE_KEY = "hb-pet:v1";
  const solid = (a, b, c, d) => solids.push([a, b, c, d]);
  const world = () => k.world || window.__seam || null;
  const log = (t) => { if (typeof k.log === "function") k.log(t); };

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
      const out = [];
      for (const b of map.values()) {
        const g = mergeGeometries(b.geos, false);
        for (const q of b.geos) q.dispose();
        const m = new THREE.Mesh(g, b.mat); m.castShadow = false; m.receiveShadow = false;
        if (b.mat.transparent) m.renderOrder = 2;
        into.add(m); out.push(m);
      }
      map.clear();
      return out;
    },
  };
  const boxG = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x || 0, y || 0, z || 0);
  const cylG = (r1, r2, h, seg, x, y, z, rx, rz) => { const g = new THREE.CylinderGeometry(r1, r2, h, seg || 16); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); return g.translate(x || 0, y || 0, z || 0); };
  /* a rectangle with UVs in metres / tile, starting at (u0, v0) metres */
  function quadG(w, h, tu, tv, u0, v0) {
    const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
    if (tu) for (let i = 0; i < uv.count; i++) uv.setXY(i, ((u0 || 0) + uv.getX(i) * w) / tu, ((v0 || 0) + uv.getY(i) * h) / (tv || tu));
    return g;
  }
  const rb = (w, h, d, r) => (k.RoundedBoxGeometry ? new k.RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)) : new THREE.BoxGeometry(w, h, d));
  const ry = (a) => new THREE.Matrix4().makeRotationY(a);

  /* ---------------------------------------------------------- the pet's save - */
  let saved = null;
  try { const s = localStorage.getItem(SAVE_KEY); saved = s ? JSON.parse(s) : null; } catch (_) { saved = null; }
  if (saved && (typeof saved !== "object" || !saved.cells)) saved = null;
  const petName = saved && saved.name ? String(saved.name).slice(0, 18) : "";

  /* ---------------------------------------------------------- textures - */
  const boards = canvasTex(256, 512, (g, w, h) => {   // light oak boards along x, 125 mm: one repeat = 1 x 2 m
    const r = rnd(1401), n = 8, bw = w / n;
    for (let i = 0; i < n; i++) {
      let y = -r() * 300;
      while (y < h) {
        const len = 160 + r() * 300, t = (r() - 0.5) * 20;
        g.fillStyle = `rgb(${200 + t},${162 + t * 0.85},${118 + t * 0.6})`; g.fillRect(i * bw, y, bw, len);
        for (let q = 0; q < 4; q++) { g.strokeStyle = `rgba(120,80,40,${0.05 + r() * 0.07})`; g.lineWidth = 0.6 + r(); const x = i * bw + r() * bw; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + (r() - 0.5) * 4, y + len * 0.3, x + (r() - 0.5) * 4, y + len * 0.7, x, y + len); g.stroke(); }
        g.fillStyle = "rgba(90,60,30,.35)"; g.fillRect(i * bw, y, bw, 2);
        y += len;
      }
      g.fillStyle = "rgba(90,60,30,.3)"; g.fillRect(i * bw, 0, 1.5, h);
    }
  });
  boards.wrapS = boards.wrapT = THREE.RepeatWrapping;
  // the walls, one texture for the full height (2.6 m): sage beadboard to 0.9 m, a rail, cream paper with little stars
  const wallTex = canvasTex(128, 512, (g, w, h) => {
    const r = rnd(1403), railY = h * (1 - WAIN / R.h);
    g.fillStyle = "#f3e6d4"; g.fillRect(0, 0, w, railY);
    for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "255,255,250" : "160,130,100"},${0.03 + r() * 0.04})`; g.fillRect(r() * w, r() * railY, 1.5, 1.5); }
    const star = (x, y, s, c) => { g.fillStyle = c; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? s * 0.45 : s; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); };
    for (let row = 0; row * 40 < railY - 20; row++) for (let col = 0; col < 2; col++) {
      const x = 32 + col * 64 + (row % 2) * 32, y = 24 + row * 40;
      if (y > railY - 16) continue;
      if ((row + col) % 3 === 0) star(x % w, y, 6, "rgba(222,170,90,.75)");
      else { g.fillStyle = "rgba(150,180,170,.5)"; g.beginPath(); g.arc(x % w, y, 2.5, 0, 7); g.fill(); }
    }
    g.fillStyle = "#a9bea3"; g.fillRect(0, railY, w, h - railY);
    for (let x = 0; x < w; x += 32) { g.fillStyle = "rgba(60,80,55,.35)"; g.fillRect(x, railY, 2, h - railY); g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(x + 2, railY, 1, h - railY); }
  });
  wallTex.wrapS = THREE.RepeatWrapping; wallTex.wrapT = THREE.ClampToEdgeWrapping;
  const shag = canvasTex(256, 256, (g, w, h) => {   // the round rug: cream wool, two soft rings, fluffy
    const r = rnd(1405);
    g.fillStyle = "#efe4d2"; g.fillRect(0, 0, w, h);
    for (const [rr, c] of [[118, "#e2c9a6"], [96, "#efe4d2"], [70, "#e7b9a2"], [52, "#efe4d2"]]) { g.fillStyle = c; g.beginPath(); g.arc(w / 2, h / 2, rr, 0, 7); g.fill(); }
    for (let i = 0; i < 9000; i++) { const a = r() * 7, d = r() * 128; g.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "120,90,60"},${0.05 + r() * 0.08})`; g.fillRect(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, 1 + r() * 2, 1 + r() * 2); }
  });
  const wicker = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = "#9a7444"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) {
      const odd = ((x + y) / 8) % 2, gr = g.createLinearGradient(x, y, odd ? x + 8 : x, odd ? y : y + 8);
      gr.addColorStop(0, "#6a4b26"); gr.addColorStop(0.5, "#d4b07a"); gr.addColorStop(1, "#6a4b26");
      g.fillStyle = gr; g.fillRect(x + 0.5, y + 0.5, 7, 7);
    }
  }, [8, 2]);
  const knit = canvasTex(128, 128, (g, w, h) => {   // a knitted blanket: rows of little Vs
    g.fillStyle = "#e9a8a0"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) { g.strokeStyle = "rgba(150,70,70,.45)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4, y + 7); g.lineTo(x + 8, y); g.stroke(); }
    g.fillStyle = "rgba(255,255,255,.7)"; for (let y = 24; y < h; y += 48) g.fillRect(0, y, w, 6);
  }, [3, 3]);
  const viewTex = canvasTex(512, 384, (g, w, h) => {   // out of the window: a soft sky, an apple tree, a garden
    const r = rnd(1407);
    const sk = g.createLinearGradient(0, 0, 0, h * 0.62); sk.addColorStop(0, "#8cbfe6"); sk.addColorStop(1, "#f4e6cf");
    g.fillStyle = sk; g.fillRect(0, 0, w, h);
    for (let c = 0; c < 6; c++) { g.fillStyle = "rgba(255,255,255,.6)"; const x = r() * w, y = 30 + r() * 110; for (let b = 0; b < 5; b++) { g.beginPath(); g.arc(x + b * 14, y + (r() - 0.5) * 8, 12 + r() * 10, 0, 7); g.fill(); } }
    for (let x = -10; x < w + 10; x += 12) { g.fillStyle = `rgb(${70 + r() * 25},${110 + r() * 30},${70 + r() * 18})`; g.beginPath(); g.ellipse(x, h * 0.6, 18, 30 + r() * 20, 0, 0, 7); g.fill(); }
    const lawn = g.createLinearGradient(0, h * 0.6, 0, h); lawn.addColorStop(0, "#8fb062"); lawn.addColorStop(1, "#6a8e44"); g.fillStyle = lawn; g.fillRect(0, h * 0.6, w, h * 0.4);
    g.fillStyle = "#6a4a2e"; g.fillRect(w * 0.62, h * 0.38, 16, h * 0.3);
    g.fillStyle = "#5f8f4a"; g.beginPath(); g.arc(w * 0.62 + 8, h * 0.34, 70, 0, 7); g.fill();
    for (let i = 0; i < 16; i++) { g.fillStyle = "#d8443a"; g.beginPath(); g.arc(w * 0.62 + 8 + (r() - 0.5) * 110, h * 0.34 + (r() - 0.5) * 90, 5, 0, 7); g.fill(); }
    for (let i = 0; i < 120; i++) { g.fillStyle = ["#f4d35e", "#f28fb0", "#ffffff", "#c9a6ff"][i % 4]; g.beginPath(); g.arc(r() * w, h * 0.7 + r() * h * 0.28, 2.5, 0, 7); g.fill(); }
  });
  const glowTex = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const PAL = { peach: "#ffb088", mint: "#8fe3b4", sky: "#8cc8ff", lilac: "#c9a6ff", lemon: "#f6e27a", rose: "#ff9ac2" };
  const petHex = (saved && (PAL[saved.colour] || (/^#?[0-9a-f]{6}$/i.test(saved.colour || "") ? (saved.colour[0] === "#" ? saved.colour : "#" + saved.colour) : null))) || PAL.peach;
  const drawing = canvasTex(256, 192, (g, w, h) => {   // a crayon drawing of the creature, a sun, a heart
    const r = rnd(1409);
    g.fillStyle = "#fbf7ee"; g.fillRect(0, 0, w, h);
    const crayon = (c, wd, path) => { g.strokeStyle = c; g.lineWidth = wd; g.lineCap = "round"; g.beginPath(); path(); g.stroke(); };
    g.fillStyle = "#7dbb5e"; g.fillRect(0, h - 34, w, 34);
    for (let i = 0; i < 40; i++) crayon("#5a9a3e", 2, () => { const x = r() * w; g.moveTo(x, h - 34); g.lineTo(x + (r() - 0.5) * 6, h - 44); });
    g.fillStyle = petHex; g.beginPath(); g.ellipse(112, h - 70, 52, 40, 0, 0, 7); g.fill();
    crayon("rgba(60,40,30,.7)", 3, () => g.ellipse(112, h - 70, 52, 40, 0, 0, 7));
    g.fillStyle = "#2a1c14"; for (const x of [96, 128]) { g.beginPath(); g.arc(x, h - 80, 6, 0, 7); g.fill(); }
    crayon("#2a1c14", 3, () => g.arc(112, h - 70, 12, 0.2, Math.PI - 0.2));
    g.fillStyle = "#f6c64a"; g.beginPath(); g.arc(214, 38, 20, 0, 7); g.fill();
    for (let i = 0; i < 10; i++) crayon("#f2b33a", 3, () => { const a = (i / 10) * 7; g.moveTo(214 + Math.cos(a) * 26, 38 + Math.sin(a) * 26); g.lineTo(214 + Math.cos(a) * 36, 38 + Math.sin(a) * 36); });
    g.fillStyle = "#e8566e"; g.beginPath(); g.moveTo(40, 52); g.bezierCurveTo(40, 36, 62, 36, 62, 52); g.bezierCurveTo(62, 64, 40, 74, 40, 80); g.bezierCurveTo(40, 74, 18, 64, 18, 52); g.bezierCurveTo(18, 36, 40, 36, 40, 52); g.fill();
    if (petName) { g.fillStyle = "#3a6ab0"; g.font = "700 20px 'Comic Sans MS', 'Chalkboard SE', cursive"; g.fillText(petName, 150, 120); }
  });
  const plaqueTex = canvasTex(256, 80, (g, w, h) => {   // the bed's name plaque
    g.fillStyle = "#e9d6b4"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#9a6a3a"; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = "#5a3a22"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `700 ${petName ? 38 : 30}px Georgia, 'Times New Roman', serif`; g.fillText(petName || "sweet dreams", w / 2, h / 2 + 2);
  });
  const chartTex = canvasTex(64, 512, (g, w, h) => {   // a growth chart: a painted ruler with marks
    g.fillStyle = "#f6efe0"; g.fillRect(0, 0, w, h);
    const cols = ["#e8566e", "#f2a03a", "#f6d35a", "#7dbb5e", "#5aa0d8", "#9a7ad8"];
    for (let i = 0; i < 6; i++) { g.fillStyle = cols[i]; g.fillRect(0, (i / 6) * h, 8, h / 6); }
    for (let i = 0; i <= 28; i++) { const y = h - (i / 28) * h; g.fillStyle = "#4a3a2a"; g.fillRect(8, y, i % 2 ? 12 : 22, 2); }
    g.fillStyle = "#4a3a2a"; g.font = "700 11px Georgia, serif"; for (let i = 2; i <= 14; i += 4) g.fillText(String(i * 10), 34, h - (i / 14) * h + 4);
  });
  const heartTex = canvasTex(64, 64, (g) => {
    g.fillStyle = "#ff6f8e"; g.beginPath(); g.moveTo(32, 22); g.bezierCurveTo(32, 8, 56, 8, 56, 26); g.bezierCurveTo(56, 40, 36, 50, 32, 58); g.bezierCurveTo(28, 50, 8, 40, 8, 26); g.bezierCurveTo(8, 8, 32, 8, 32, 22); g.fill();
    g.fillStyle = "rgba(255,255,255,.6)"; g.beginPath(); g.ellipse(20, 22, 5, 3, -0.6, 0, 7); g.fill();
  });
  const zTex = canvasTex(64, 64, (g) => { g.fillStyle = "#cfe0ff"; g.font = "700 46px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("z", 32, 34); });
  const ballTex = canvasTex(128, 64, (g, w, h) => {   // a soft ball: stripes and stars
    const cols = ["#f28fb0", "#f6d35a", "#8cc8ff", "#8fe3b4"];
    for (let i = 0; i < 8; i++) { g.fillStyle = cols[i % 4]; g.fillRect((i / 8) * w, 0, w / 8 + 1, h); }
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6);
  });

  /* --------------------------------------------------------- materials - */
  const add = THREE.AdditiveBlending;
  const CM = {
    floor: new THREE.MeshStandardMaterial({ map: boards, color: 0xc4ab8e, roughness: 0.55 }),
    wall: new THREE.MeshStandardMaterial({ map: wallTex, color: 0xe6cdb6, roughness: 0.92 }),
    ceil: new THREE.MeshStandardMaterial({ color: 0xdccab6, roughness: 0.97 }),
    trim: new THREE.MeshStandardMaterial({ color: 0xeee2d0, roughness: 0.5 }),
    rug: new THREE.MeshStandardMaterial({ map: shag, color: 0xecd8c2, roughness: 1 }),
    wicker: new THREE.MeshStandardMaterial({ map: wicker, roughness: 0.9, side: THREE.DoubleSide }),
    cushion: new THREE.MeshStandardMaterial({ color: 0xc9dbe6, roughness: 0.95 }),
    knit: new THREE.MeshStandardMaterial({ map: knit, roughness: 1 }),
    ceramic: new THREE.MeshStandardMaterial({ color: 0xf1ece2, roughness: 0.25 }),
    bowlBlue: new THREE.MeshStandardMaterial({ color: 0x7fa8c9, roughness: 0.3 }),
    water: new THREE.MeshStandardMaterial({ color: 0x9fd0ea, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.8 }),
    berry: new THREE.MeshStandardMaterial({ color: 0xd8443a, roughness: 0.25 }),
    mat: new THREE.MeshStandardMaterial({ color: 0xe7b9a2, roughness: 0.9 }),
    canvasTent: new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.95, side: THREE.DoubleSide }),
    pole: new THREE.MeshStandardMaterial({ color: 0xc8a070, roughness: 0.6 }),
    bunting: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide, vertexColors: true }),
    wood: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, vertexColors: true }),
    pot: new THREE.MeshStandardMaterial({ color: 0xd98a62, roughness: 0.8 }),
    leaf: M.leaf,
    frame: new THREE.MeshStandardMaterial({ color: 0xb98a5a, roughness: 0.5 }),
    drawing: new THREE.MeshStandardMaterial({ map: drawing, roughness: 0.9 }),
    plaque: new THREE.MeshStandardMaterial({ map: plaqueTex, roughness: 0.7 }),
    chart: new THREE.MeshStandardMaterial({ map: chartTex, roughness: 0.8 }),
    view: new THREE.MeshBasicMaterial({ map: viewTex }),
    curtain: new THREE.MeshStandardMaterial({ color: 0xf0c9b8, roughness: 0.95, side: THREE.DoubleSide }),
    brass: M.brass,
    paper: new THREE.MeshStandardMaterial({ color: 0xfff1dc, roughness: 0.9, emissive: 0xffc890, emissiveIntensity: 0.85 }),
    pool: new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffc080, transparent: true, opacity: 0.12, blending: add, depthWrite: false }),
    shade: new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }),
    sign: new THREE.MeshStandardMaterial({ map: signTex("J", "/lab/seam-room/j/"), roughness: 0.7 }),
  };

  /* ------------------------------------------------------------- shell - */
  S.add(quadG(RW, RD, 1, 2).rotateX(-Math.PI / 2).translate(CX, 0, CZ), CM.floor);
  S.add(quadG(RW, RD).rotateX(Math.PI / 2).translate(CX, R.h, CZ), CM.ceil);
  // walls: one texture over the full height; a piece from v0 up gets UVs that start there
  const wallPiece = (w, y0, y1, u0, place) => S.add(place(quadG(w, y1 - y0, 0.5, R.h, u0, y0).translate(0, (y0 + y1) / 2, 0)), CM.wall);
  wallPiece(RW, 0, R.h, 0, (g) => g.translate(CX, 0, R.z0));                                            // south
  wallPiece(RW, 0, R.h, 0, (g) => g.rotateY(Math.PI).translate(CX, 0, R.z1));                           // north
  const westAt = (z0, z1, y0, y1) => wallPiece(z1 - z0, y0, y1, z0, (g) => g.rotateY(Math.PI / 2).translate(R.x0, 0, (z0 + z1) / 2));
  westAt(R.z0, DOOR.z0, 0, R.h); westAt(DOOR.z1, R.z1, 0, R.h); westAt(DOOR.z0, DOOR.z1, DOOR.h, R.h);   // west, with the door opening
  const eastAt = (z0, z1, y0, y1) => wallPiece(z1 - z0, y0, y1, z0, (g) => g.rotateY(-Math.PI / 2).translate(R.x1, 0, (z0 + z1) / 2));
  eastAt(R.z0, WIN.z0, 0, R.h); eastAt(WIN.z1, R.z1, 0, R.h); eastAt(WIN.z0, WIN.z1, 0, WIN.y0); eastAt(WIN.z0, WIN.z1, WIN.y1, R.h);   // east, with the window
  // door casing (room side), baseboards, the chair rail, a small crown
  for (const z of [DOOR.z0 - 0.035, DOOR.z1 + 0.035]) S.add(boxG(0.02, DOOR.h + 0.07, 0.07, R.x0 + 0.01, (DOOR.h + 0.07) / 2, z), CM.trim);
  S.add(boxG(0.02, 0.07, DOOR.z1 - DOOR.z0 + 0.14, R.x0 + 0.01, DOOR.h + 0.035, (DOOR.z0 + DOOR.z1) / 2), CM.trim);
  const BB = 0.1;
  for (const [y, hh, d] of [[BB / 2, BB, 0.015], [WAIN, 0.04, 0.025]]) {
    S.add(boxG(RW, hh, d, CX, y, R.z0 + d / 2), CM.trim);
    S.add(boxG(RW, hh, d, CX, y, R.z1 - d / 2), CM.trim);
    for (const [z0, z1] of [[R.z0, DOOR.z0 - 0.07], [DOOR.z1 + 0.07, R.z1]]) S.add(boxG(d, hh, z1 - z0, R.x0 + d / 2, y, (z0 + z1) / 2), CM.trim);
    if (y < WIN.y0) S.add(boxG(d, hh, RD, R.x1 - d / 2, y, CZ), CM.trim);
    else for (const [z0, z1] of [[R.z0, WIN.z0 - 0.07], [WIN.z1 + 0.07, R.z1]]) S.add(boxG(d, hh, z1 - z0, R.x1 - d / 2, y, (z0 + z1) / 2), CM.trim);
  }
  const CR = 0.06;
  S.add(boxG(RW, CR, 0.03, CX, R.h - CR / 2, R.z0 + 0.015), CM.trim); S.add(boxG(RW, CR, 0.03, CX, R.h - CR / 2, R.z1 - 0.015), CM.trim);
  S.add(boxG(0.03, CR, RD, R.x0 + 0.015, R.h - CR / 2, CZ), CM.trim); S.add(boxG(0.03, CR, RD, R.x1 - 0.015, R.h - CR / 2, CZ), CM.trim);
  // PAGE J over the door
  S.add(quadG(0.38, 0.24).rotateY(Math.PI / 2).translate(R.x0 + 0.006, 2.33, (DOOR.z0 + DOOR.z1) / 2), CM.sign);
  S.add(boxG(0.012, 0.26, 0.4, R.x0 + 0.003, 2.33, (DOOR.z0 + DOOR.z1) / 2), CM.frame);

  /* ------------------------------------------------------------ the window - */
  {
    const WC = (WIN.z0 + WIN.z1) / 2, ww = WIN.z1 - WIN.z0, wh = WIN.y1 - WIN.y0, wy = (WIN.y0 + WIN.y1) / 2;
    S.add(quadG(4.4, 3.2).rotateY(-Math.PI / 2).translate(R.x1 + 1.0, wy + 0.15, WC), CM.view);
    for (const z of [WIN.z0 + 0.015, WIN.z1 - 0.015]) S.add(boxG(0.15, wh, 0.03, R.x1 + 0.075, wy, z), CM.trim);   // reveals
    S.add(boxG(0.15, 0.03, ww, R.x1 + 0.075, WIN.y1 - 0.015, WC), CM.trim);
    S.add(boxG(0.24, 0.04, ww + 0.14, R.x1 - 0.04, WIN.y0, WC), CM.trim);                                   // the sill
    for (const z of [WIN.z0 - 0.04, WIN.z1 + 0.04]) S.add(boxG(0.035, wh + 0.08, 0.08, R.x1 - 0.018, wy - 0.0, z), CM.trim);
    S.add(boxG(0.035, 0.09, ww + 0.16, R.x1 - 0.018, WIN.y1 + 0.045, WC), CM.trim);
    const xs = R.x1 + 0.1;   // sashes: stiles, rails, muntins
    for (const z of [WIN.z0 + 0.05, WIN.z1 - 0.05]) S.add(boxG(0.05, wh, 0.06, xs, wy, z), CM.trim);
    for (const y of [WIN.y0 + 0.06, wy, WIN.y1 - 0.04]) S.add(boxG(0.05, 0.06, ww, xs, y, WC), CM.trim);
    S.add(boxG(0.03, wh, 0.022, xs - 0.01, wy, WC), CM.trim);
    // curtains on a brass rod, gathered at the sides
    S.add(cylG(0.013, 0.013, ww + 0.9, 12, R.x1 - 0.09, WIN.y1 + 0.22, WC, Math.PI / 2), CM.brass);
    for (const s of [-1, 1]) {
      const cw = 0.42, chH = WIN.y1 + 0.22 - 0.12, g = new THREE.PlaneGeometry(cw, chH, 14, 1), p = g.attributes.position;
      for (let q = 0; q < p.count; q++) p.setZ(q, Math.sin((p.getX(q) / cw) * Math.PI * 7) * 0.03);
      g.computeVertexNormals();
      S.add(g.rotateY(-Math.PI / 2).translate(R.x1 - 0.09, chH / 2 + 0.12, WC + s * (ww / 2 + 0.2)), CM.curtain);
    }
    S.add(quadG(2.6, 2.2).rotateX(-Math.PI / 2).translate(R.x1 - 1.0, 0.004, WC), CM.pool);   // daylight on the floor
  }

  /* ------------------------------------------------ the rug, the lantern - */
  S.add(new THREE.CircleGeometry(1.75, 48).rotateX(-Math.PI / 2).translate(CX, 0.006, CZ), CM.rug);
  S.add(new THREE.TorusGeometry(1.75, 0.018, 6, 64).rotateX(Math.PI / 2).translate(CX, 0.01, CZ), CM.rug);
  {
    const LY = R.h - 0.62;
    S.add(cylG(0.004, 0.004, 0.4, 4, CX, R.h - 0.2, CZ), CM.pole);
    S.add(new THREE.SphereGeometry(0.26, 24, 16).scale(1, 0.92, 1).translate(CX, LY, CZ), CM.paper);
    for (let i = -3; i <= 3; i++) S.add(new THREE.TorusGeometry(0.26 * Math.cos(i * 0.36) + 0.002, 0.0025, 4, 32).rotateX(Math.PI / 2).translate(CX, LY + 0.24 * Math.sin(i * 0.36), CZ), CM.pole);   // its ribs
    S.add(quadG(4.2, 4.2).rotateX(-Math.PI / 2).translate(CX, 0.008, CZ), CM.pool);
    S.add(quadG(2.6, 2.6).rotateX(Math.PI / 2).translate(CX, R.h - 0.004, CZ), CM.pool);
    for (const [w, place] of [[RW, (g) => g.translate(CX, 1.7, R.z0 + 0.004)], [RW, (g) => g.rotateY(Math.PI).translate(CX, 1.7, R.z1 - 0.004)], [RD, (g) => g.rotateY(Math.PI / 2).translate(R.x0 + 0.004, 1.7, CZ)]]) S.add(place(quadG(w * 0.8, 1.6)), CM.pool);
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd8a8, transparent: true, opacity: 0.75, blending: add, depthWrite: false }));
  halo.scale.set(0.95, 0.95, 1); halo.position.set(CX, R.h - 0.62, CZ); halo.renderOrder = 3; scene.add(halo);
  // fairy lights in three swags along the north wall: one InstancedMesh of little bulbs
  const bulbs = [];
  for (let s = 0; s < 3; s++) {
    const x0 = R.x0 + 0.15 + s * (RW - 0.3) / 3, x1 = x0 + (RW - 0.3) / 3;
    for (let i = 0; i <= 18; i++) { const t = i / 18; bulbs.push([x0 + (x1 - x0) * t, R.h - 0.18 - Math.sin(t * Math.PI) * 0.32, R.z1 - 0.05]); }
  }
  const bulbIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), bulbs.length);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
  const BULB_COLS = [0xffe2a0, 0xffc0d0, 0xfff4d8, 0xc8e0ff];
  bulbs.forEach((b, i) => { bulbIM.setMatrixAt(i, mtx.makeTranslation(b[0], b[1], b[2])); bulbIM.setColorAt(i, col.setHex(BULB_COLS[i % 4])); });
  S.add(quadG(RW, 1.0).rotateY(Math.PI).translate(CX, R.h - 0.5, R.z1 - 0.004), CM.pool);
  for (let s = 0; s < 3; s++) {   // the wire between the bulbs
    const x0 = R.x0 + 0.15 + s * (RW - 0.3) / 3, x1 = x0 + (RW - 0.3) / 3, pts = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, R.h - 0.18 - Math.sin(t * Math.PI) * 0.32 + 0.012, R.z1 - 0.05)); }
    S.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.002, 4), CM.pole);
  }

  /* ------------------------------------------------------- the bed (nest) - */
  const BED = { x: 2.5, z: 22.2, r: 0.62 };
  {
    const prof = []; for (let i = 0; i <= 8; i++) { const t = i / 8; prof.push(new THREE.Vector2(BED.r - 0.06 + 0.06 * Math.sin(t * Math.PI / 2), t * 0.2)); }
    S.add(new THREE.LatheGeometry(prof, 32).translate(BED.x, 0, BED.z), CM.wicker);
    S.add(new THREE.TorusGeometry(BED.r, 0.05, 10, 36).rotateX(Math.PI / 2).translate(BED.x, 0.21, BED.z), CM.wicker);
    S.add(new THREE.CircleGeometry(BED.r - 0.06, 32).rotateX(-Math.PI / 2).translate(BED.x, 0.012, BED.z), CM.wicker);
    S.add(new THREE.SphereGeometry(BED.r - 0.07, 28, 12).scale(1, 0.2, 1).translate(BED.x, 0.06, BED.z), CM.cushion);
    // a knitted blanket draped over the back edge
    // a knitted blanket over the back of the cushion and down over the rim
    S.add(rb(0.62, 0.025, 0.34, 0.012).rotateX(-0.1).rotateY(0.2).translate(BED.x + 0.04, 0.11, BED.z + 0.2), CM.knit);
    S.add(rb(0.6, 0.22, 0.025, 0.012).rotateX(0.35).rotateY(0.2).translate(BED.x + 0.08, 0.13, BED.z + 0.42), CM.knit);
    // a little plush star
    const st = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 0.045 : 0.1; if (i) st.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else st.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    S.add(new THREE.ExtrudeGeometry(st, { depth: 0.04, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3 }).rotateX(-Math.PI / 2 + 0.2).translate(BED.x - 0.38, 0.27, BED.z - 0.25), new THREE.MeshStandardMaterial({ color: 0xf6d35a, roughness: 0.9 }));
    S.add(quadG(1.3, 1.3).rotateX(-Math.PI / 2).translate(BED.x, 0.003, BED.z), CM.shade);
    // the name plaque above it, on the north wall
    S.add(boxG(0.56, 0.2, 0.02, BED.x, 1.25, R.z1 - 0.01), CM.frame);
    S.add(quadG(0.52, 0.16).rotateY(Math.PI).translate(BED.x, 1.25, R.z1 - 0.021), CM.plaque);
    solid(BED.x - BED.r, BED.z - BED.r, BED.x + BED.r, BED.z + BED.r);
  }

  /* ------------------------------------------------------- the bowls - */
  const BOWL = { x: 0.15, z: 17.35 }, WATER = { x: 0.6, z: 17.3 };
  {
    S.add(rb(0.85, 0.012, 0.45, 0.006).translate((BOWL.x + WATER.x) / 2, 0.006, BOWL.z - 0.02), CM.mat);
    for (const [b, mat] of [[BOWL, CM.ceramic], [WATER, CM.bowlBlue]]) {
      const prof = [new THREE.Vector2(0.0, 0.012), new THREE.Vector2(0.09, 0.012), new THREE.Vector2(0.12, 0.07), new THREE.Vector2(0.135, 0.075), new THREE.Vector2(0.14, 0.07), new THREE.Vector2(0.11, 0.004), new THREE.Vector2(0.0, 0.004)];
      S.add(new THREE.LatheGeometry(prof, 28).translate(b.x, 0, b.z), mat);
    }
    S.add(new THREE.CircleGeometry(0.115, 24).rotateX(-Math.PI / 2).translate(WATER.x, 0.055, WATER.z), CM.water);
    const br = rnd(1411);
    for (let i = 0; i < 4; i++) S.add(new THREE.SphereGeometry(0.03, 10, 8).translate(BOWL.x + (br() - 0.5) * 0.1, 0.035, BOWL.z + (br() - 0.5) * 0.1), CM.berry);
  }
  const bowlHit = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.25, 12), new THREE.MeshBasicMaterial());
  bowlHit.position.set(BOWL.x, 0.1, BOWL.z); bowlHit.visible = false; scene.add(bowlHit);

  /* --------------------------------------------- toys, the teepee, the plant - */
  const vc = (g, hex) => { const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute("color", new THREE.Float32BufferAttribute(a, 3)); return g; };
  const colourParts = [];   // vertex-coloured pieces (blocks, rings, bunting): merged into one mesh
  const TP = { x: 3.2, z: 16.95, r: 0.55, h: 1.45 };
  {
    // the teepee: a five-sided canvas cone with a door flap open toward the room, poles crossing at the top
    const N = 5, cone = new THREE.ConeGeometry(TP.r, TP.h, N, 1, true, Math.PI * 0.2 + 0.0, Math.PI * 2 - Math.PI * 0.4);
    S.add(cone.rotateY(-Math.PI / 2 - 0.6).translate(TP.x, TP.h / 2, TP.z), CM.canvasTent);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + 0.3, bx = TP.x + Math.cos(a) * TP.r, bz = TP.z + Math.sin(a) * TP.r;
      const top = new THREE.Vector3(TP.x - Math.cos(a) * 0.1, TP.h + 0.22, TP.z - Math.sin(a) * 0.1), bot = new THREE.Vector3(bx, 0, bz);
      const len = top.distanceTo(bot), g = new THREE.CylinderGeometry(0.012, 0.014, len, 6).rotateX(Math.PI / 2);
      g.lookAt(new THREE.Vector3().subVectors(top, bot));
      S.add(g.translate((top.x + bot.x) / 2, (top.y + bot.y) / 2, (top.z + bot.z) / 2), CM.pole);
    }
    S.add(new THREE.CylinderGeometry(TP.r * 0.92, TP.r * 0.92, 0.04, 20).translate(TP.x, 0.02, TP.z), CM.cushion);
    // bunting across the front
    const flagCols = [0xf28fb0, 0xf6d35a, 0x8cc8ff, 0x8fe3b4, 0xc9a6ff];
    for (let i = 0; i < 5; i++) {
      const t = (i + 0.5) / 5, a = -Math.PI / 2 - 0.6 + (t - 0.5) * 1.5, fx = TP.x + Math.cos(a) * TP.r * 0.55, fz = TP.z - Math.sin(a) * TP.r * 0.55;
      const tri = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute([-0.045, 0, 0, 0.045, 0, 0, 0, -0.09, 0], 3));
      tri.computeVertexNormals(); tri.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
      colourParts.push([vc(tri.rotateY(-a - Math.PI / 2).translate(fx, 0.95, fz), flagCols[i]), CM.bunting]);
    }
    solid(TP.x - TP.r, TP.z - TP.r, R.x1, TP.z + TP.r);
  }
  const BL = { x: -0.62, z: 22.78 };
  {
    const cols = [0xe8566e, 0xf2a03a, 0xf6d35a, 0x7dbb5e, 0x5aa0d8, 0x9a7ad8], br = rnd(1413);
    const blocks = [[0, 0, 0], [0.13, 0, 0.02], [0.065, 0.12, 0.01], [-0.02, 0, 0.16], [0.24, 0, 0.18], [0.06, 0.24, 0.0]];
    blocks.forEach(([x, y, z], i) => colourParts.push([vc(boxG(0.11, 0.11, 0.11).rotateY((br() - 0.5) * 0.5).translate(BL.x + x, y + 0.055, BL.z + z), cols[i % cols.length]), CM.wood]));
    // the ring stacker beside them
    const RS = { x: -0.05, z: 22.98 };
    colourParts.push([vc(cylG(0.08, 0.09, 0.03, 20, RS.x, 0.015, RS.z), 0xc8a070), CM.wood]);
    colourParts.push([vc(cylG(0.012, 0.012, 0.28, 8, RS.x, 0.16, RS.z), 0xc8a070), CM.wood]);
    [0x5aa0d8, 0x7dbb5e, 0xf6d35a, 0xf2a03a, 0xe8566e].forEach((c, i) => colourParts.push([vc(new THREE.TorusGeometry(0.075 - i * 0.011, 0.022, 10, 24).rotateX(Math.PI / 2).translate(RS.x, 0.05 + i * 0.042, RS.z), c), CM.wood]));
    colourParts.push([vc(new THREE.SphereGeometry(0.03, 12, 8).translate(RS.x, 0.3, RS.z), 0xe8566e), CM.wood]);
    solid(BL.x - 0.12, BL.z - 0.12, RS.x + 0.12, R.z1);
  }
  const PL = { x: 3.5, z: 23.0 };
  {
    S.add(cylG(0.2, 0.15, 0.36, 20, PL.x, 0.18, PL.z), CM.pot);
    const pr = rnd(1415);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + pr(), tilt = 0.2 + pr() * 0.45, len = 0.55 + pr() * 0.45;
      const g = new THREE.SphereGeometry(0.07, 8, 6).scale(1, len / 0.14, 0.35);
      g.rotateX(tilt); g.rotateY(a); g.translate(PL.x + Math.sin(a) * 0.05, 0.36 + len * 0.42, PL.z + Math.cos(a) * 0.05);
      S.add(g, CM.leaf);
    }
    solid(PL.x - 0.22, PL.z - 0.22, R.x1, R.z1);
  }
  // the crayon drawing (north wall) and the growth chart (west wall)
  S.add(boxG(0.62, 0.48, 0.025, 0.55, 1.55, R.z1 - 0.0125), CM.frame);
  S.add(quadG(0.54, 0.4).rotateY(Math.PI).translate(0.55, 1.55, R.z1 - 0.027), CM.drawing);
  S.add(boxG(0.02, 1.5, 0.14, R.x0 + 0.01, 0.95, 21.9), CM.frame);
  S.add(quadG(0.12, 1.46).rotateY(Math.PI / 2).translate(R.x0 + 0.021, 0.95, 21.9), CM.chart);
  // the vertex-coloured pieces merge here (S.add keeps only position/normal/uv): one mesh per material
  for (const mat of [CM.wood, CM.bunting]) {
    const parts = colourParts.filter((p) => p[1] === mat).map(([g]) => { const n = g.index ? g.toNonIndexed() : g; if (!n.attributes.uv) n.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; });
    if (parts.length) { const m = new THREE.Mesh(mergeGeometries(parts, false), mat); m.castShadow = m.receiveShadow = false; scene.add(m); }
  }

  /* --------------------------------------------------------------- the ball - */
  const BALL = { r: 0.11, x: 0.7, z: 20.9, vx: 0, vz: 0 };
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL.r, 24, 16), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.55 }));
  ball.position.set(BALL.x, BALL.r, BALL.z); scene.add(ball);
  const ballShade = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34).rotateX(-Math.PI / 2), CM.shade);
  ballShade.position.set(BALL.x, 0.004, BALL.z); scene.add(ballShade);

  const meshes = S.flush(scene);
  bulbIM.castShadow = false; bulbIM.instanceMatrix.needsUpdate = true; bulbIM.instanceColor.needsUpdate = true; bulbIM.computeBoundingSphere(); scene.add(bulbIM);

  /* ============================================================== THE PET ==== */
  /* the pet lives in its own group at the middle of the room (its world is group-local: floor y 0, it wanders up to
     worldRadius from the middle); the room adds walls and furniture it bumps off, its bed, its bowl and the ball */
  const petRoot = new THREE.Group(); petRoot.name = "creature"; petRoot.position.set(CX, 0, CZ); scene.add(petRoot);
  const OPTS = { worldRadius: 2.85, position: { x: 0.4, z: 0.6 } };
  let pet = null;
  try { pet = createPet(petRoot, saved ? { ...OPTS, save: saved } : { ...OPTS, colour: "peach", cells: 26 }); }
  catch (e) { console.warn("seam-room creature: saved pet would not load, starting a fresh one", e); saved = null; pet = createPet(petRoot, { ...OPTS, colour: "peach", cells: 26 }); }
  pet.body.castShadow = false;
  const petShade = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), CM.shade.clone());
  petShade.material.opacity = 0.38; petShade.renderOrder = 1; scene.add(petShade);
  const L = (x, z) => ({ x: x - CX, z: z - CZ });   // world -> the pet's ground
  const bedL = L(BED.x, BED.z), bowlL = L(BOWL.x, BOWL.z);
  // walls and what it bumps off (group-local); the bed and the bowls are not in the way: it goes there on purpose
  const WALL = { x0: R.x0 - CX + 0.02, x1: R.x1 - CX - 0.02, z0: R.z0 - CZ + 0.02, z1: R.z1 - CZ - 0.02 };
  const OBST = [{ ...L(TP.x, TP.z), r: TP.r + 0.04 }, { ...L(BL.x + 0.1, BL.z + 0.08), r: 0.3 }, { ...L(PL.x, PL.z), r: 0.26 }, { ...L(-0.05, 22.98), r: 0.11 }];
  function keepIn() {
    // you are in its way only while it potters about; going to food or to bed it slips past you
    const w = world(), p = w && w.player, busy = pet.sim.state === "eat" || pet.sim.state === "follow";
    const pl = p && !busy && Math.abs(p.x - CX) < 4 && Math.abs(p.z - CZ) < 5 ? L(p.x, p.z) : null;
    for (const c of pet.sim.cells) {
      if (c.x < WALL.x0 + c.r) { c.x = WALL.x0 + c.r; if (c.vx < 0) c.vx *= -0.3; }
      if (c.x > WALL.x1 - c.r) { c.x = WALL.x1 - c.r; if (c.vx > 0) c.vx *= -0.3; }
      if (c.z < WALL.z0 + c.r) { c.z = WALL.z0 + c.r; if (c.vz < 0) c.vz *= -0.3; }
      if (c.z > WALL.z1 - c.r) { c.z = WALL.z1 - c.r; if (c.vz > 0) c.vz *= -0.3; }
      for (const o of pl ? OBST.concat([{ x: pl.x, z: pl.z, r: 0.3 }]) : OBST) {
        const dx = c.x - o.x, dz = c.z - o.z, d = Math.hypot(dx, dz), m = o.r + c.r;
        if (d < m && d > 1e-4) { c.x = o.x + (dx / d) * m; c.z = o.z + (dz / d) * m; const vn = (c.vx * dx + c.vz * dz) / d; if (vn < 0) { c.vx -= (dx / d) * vn * 1.3; c.vz -= (dz / d) * vn * 1.3; } }
      }
    }
  }

  /* -------------------------------------------- hearts, zzz (little sprites) - */
  const floaters = [];
  const heartMat = new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false });
  const zMat = new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false });
  for (let i = 0; i < 8; i++) { const s = new THREE.Sprite(i < 5 ? heartMat.clone() : zMat.clone()); s.visible = false; s.renderOrder = 4; scene.add(s); floaters.push({ s, t: 0, life: 0, vx: 0, vz: 0, kind: i < 5 ? "heart" : "z" }); }
  function puff(kind, n) {
    let made = 0;
    for (const f of floaters) {
      if (f.kind !== kind || f.life > 0) continue;
      const c = pet.center, top = c.y + pet.radius * 0.9;
      f.s.position.set(CX + c.x + (Math.random() - 0.5) * 0.3, top, CZ + c.z + (Math.random() - 0.5) * 0.3);
      f.vx = (Math.random() - 0.5) * 0.2; f.vz = (Math.random() - 0.5) * 0.2;
      f.life = kind === "heart" ? 1.3 : 2.2; f.t = 0; f.s.visible = true;
      if (++made >= n) break;
    }
  }

  /* ------------------------------------ taps: the pet, the bowl, the ball - */
  const bounces = [];   // [time left, strength]: the happy bounce after a tap
  function happy() {
    pet.poke();
    bounces.push([0.2, 3.3], [0.85, 2.5]);
    puff("heart", 3);
  }
  function feed() {
    if (pet.sim.foods.length >= pet.sim.o.maxFood) return false;
    pet.feed(bowlL.x + (Math.random() - 0.5) * 0.08, bowlL.z + (Math.random() - 0.5) * 0.08);
    return true;
  }
  function kick(fromX, fromZ) {
    const dx = BALL.x - fromX, dz = BALL.z - fromZ, d = Math.hypot(dx, dz) || 1;
    BALL.vx += (dx / d) * 2.4; BALL.vz += (dz / d) * 2.4;
  }
  const alive = () => !!scene.parent;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), lray = new THREE.Ray();
  const canvas = document.getElementById("gl");
  const inRoom = (x, z) => x > R.x0 - 0.05 && x < R.x1 + 0.05 && z > R.z0 - 0.05 && z < R.z1 + 0.05;
  const here = () => { const w = world(); return !!w && (w.zone === "j" || (w.player && inRoom(w.player.x, w.player.z))); };
  let down = null;
  const onDown = (ev) => { down = { x: ev.clientX, y: ev.clientY, t: performance.now(), moved: 0 }; };
  const onMove = (ev) => { if (down) down.moved = Math.max(down.moved, Math.hypot(ev.clientX - down.x, ev.clientY - down.y)); };
  const onUp = (ev) => {
    if (!alive()) return cleanup();
    const d = down; down = null;
    if (!d || d.moved > 10 || performance.now() - d.t > 450 || !here() || !scene.visible) return;
    const w = world(); if (!w || !w.camera) return;
    ndc.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, w.camera);
    lray.copy(ray.ray); lray.origin.sub(petRoot.position);
    const petDist = pet.hitTest(lray) ? lray.origin.distanceTo(pet.center) : Infinity;
    const bowlH = ray.intersectObject(bowlHit, false)[0], ballH = ray.intersectObject(ball, false)[0];
    const best = [[petDist, "pet"], [bowlH ? bowlH.distance : Infinity, "bowl"], [ballH ? ballH.distance : Infinity, "ball"]].sort((a, b) => a[0] - b[0])[0];
    if (best[0] > 9) return;
    if (best[1] === "pet") { happy(); if (!taps.pet++) log(`${petName || "the creature"} did a happy bounce`); }
    else if (best[1] === "bowl") { if (feed() && !taps.bowl++) log(`a berry for ${petName || "the creature"}`); }
    else { kick(w.camera.position.x, w.camera.position.z); }
  };
  const taps = { pet: 0, bowl: 0 };
  function save() {
    if (!saved) return;   // only the pet this phone already has; a room never hatches one
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(pet.save())); } catch (_) {}
  }
  const onPageHide = () => { if (alive()) save(); };
  function cleanup() {
    if (canvas) canvas.removeEventListener("pointerdown", onDown);
    removeEventListener("pointermove", onMove); removeEventListener("pointerup", onUp); removeEventListener("pagehide", onPageHide);
    save();
  }
  if (canvas) canvas.addEventListener("pointerdown", onDown);
  addEventListener("pointermove", onMove); addEventListener("pointerup", onUp); addEventListener("pagehide", onPageHide);

  /* ----------------------------------- the room you cannot see (closet.js's way) - */
  const root = scene.parent, OFF = 30, cut = { list: null, key: "" };
  function shellList(key, dd) {
    const out = [], bb = new THREE.Box3();
    if (!root) return out;
    for (const c of root.children) {
      if (c === scene || /^zone-/.test(c.name || "")) continue;
      const dm = /^door-(.+)$/.exec(c.name || "");
      if (dm) {
        const btw = (dd[dm[1]] && dd[dm[1]].data && dd[dm[1]].data.between) || [];
        if (!btw.includes("g") && !btw.includes("j") && !(key === "den" && btw.includes("d"))) out.push(c);
        continue;
      }
      let skip = false, n = 0;
      c.traverse((o) => {
        if (o.isLight || o.isSkinnedMesh || o.isBone || o.isSprite || o.isPoints || (o.userData && (o.userData.asset || o.userData.placeholder)) || (o.geometry && o.geometry.type === "RingGeometry")) skip = true;
        if (o.isMesh) n++;
      });
      if (skip || !n) continue;
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
  if (root) for (const c of root.children) if (c.userData && c.userData.creatureCut) { hideTree(c, false); delete c.userData.creatureCut; }
  function cullRoom() {
    const w = world(), cam = w && w.camera;
    if (!root || !cam) return;
    const p = cam.position, dd = (w && w.doors) || {}, open = (id) => !!dd[id] && dd[id].amt > 0.001;
    const inC = scene.visible && p.x > R.x0 + 0.05 && p.x < R.x1 + 0.1 && p.z > R.z0 - 0.1 && p.z < R.z1 + 0.1;
    const key = !inC ? "" : !(open("g-3") && open("d-back")) ? "shut" : !open("a-d") ? "den" : "";
    if (key === cut.key) return;
    if (cut.list) for (const c of cut.list) { hideTree(c, false); delete c.userData.creatureCut; }
    cut.list = key ? shellList(key, dd) : null; cut.key = key;
    if (cut.list) for (const c of cut.list) { hideTree(c, true); c.userData.creatureCut = true; }
  }

  /* --------------------------------------------------------------- tick - */
  let wasHere = false, saveT = 0, zT = 0, nightT = 0, bedtime = 0, frame = 0, clock = 0, bedTry = -1e9;
  const camL = new THREE.Vector3();
  function nightNow() { const h = new Date().getHours() + new Date().getMinutes() / 60; return h >= 21 || h < 6 ? 0.8 : h >= 19.5 ? 0.4 : 0; }
  pet.setNight(nightNow());
  function tick(dt) {
    if (!alive()) return cleanup();
    cullRoom();
    const isHere = here();
    if (isHere && !wasHere) log(petName ? `${petName} is here. Tap it for a happy bounce; tap the bowl to feed it` : "the creature is here. Tap it for a happy bounce; tap the bowl to feed it");
    if (!isHere && wasHere) save();
    wasHere = isHere;
    if (!scene.visible) return;   // nobody can see the room: it rests (no thinking, no cost)
    const w = world();
    frame++; clock += dt;
    if ((nightT -= dt) <= 0) { nightT = 60; pet.setNight(nightNow()); }
    // the happy bounce: two extra hops after a tap
    for (let i = bounces.length - 1; i >= 0; i--) {
      bounces[i][0] -= dt;
      if (bounces[i][0] <= 0) { for (const c of pet.sim.cells) c.vy += bounces[i][1]; bounces.splice(i, 1); if (bounces.length === 0) puff("heart", 2); }
    }
    if (w && w.camera) { camL.copy(w.camera.position).sub(petRoot.position); pet.facePerson({ x: camL.x, z: camL.z }); }
    keepIn();
    const ev = pet.update(dt);
    // sleepy: it walks to its bed first, then naps there
    const toBed = Math.hypot(pet.center.x - bedL.x, pet.center.z - bedL.z), inBed = pet.radius * 0.6 + 0.27;
    if (ev.includes("sleep") && !bedtime && toBed > inBed && clock - bedTry > 60) { bedtime = 10; bedTry = clock; pet.sim.wake(); pet.follow(bedL); }
    if (bedtime > 0) {
      bedtime -= dt;
      if (toBed < inBed || bedtime <= 0 || pet.sim.state !== "follow") { const st = pet.sim.state; pet.follow(null); bedtime = 0; if (st === "follow") pet.sim.setState("sleep"); }
    }
    if (pet.sim.state === "sleep" && (zT -= dt) <= 0) { zT = 1.3; puff("z", 1); }
    petShade.position.set(CX + pet.center.x, 0.0045, CZ + pet.center.z);
    petShade.scale.setScalar(pet.radius * 2.6);
    // the ball: rolls, slows, bounces off walls, the bed, the teepee, the pet and you
    const B = BALL;
    const pc = { x: CX + pet.center.x, z: CZ + pet.center.z, r: pet.radius * 0.95 };
    const pushers = [pc];
    if (w && w.player) pushers.push({ x: w.player.x, z: w.player.z, r: 0.28 });
    for (const p of pushers) {
      const dx = B.x - p.x, dz = B.z - p.z, d = Math.hypot(dx, dz), m = p.r + B.r;
      if (d < m && d > 1e-4) { B.x = p.x + (dx / d) * m; B.z = p.z + (dz / d) * m; const vn = B.vx * dx / d + B.vz * dz / d; if (vn < 0.6) { B.vx += (dx / d) * (0.6 - vn) * 1.4; B.vz += (dz / d) * (0.6 - vn) * 1.4; } }
    }
    for (const o of [{ x: TP.x, z: TP.z, r: TP.r }, { x: BED.x, z: BED.z, r: BED.r }, { x: PL.x, z: PL.z, r: 0.22 }, { x: BL.x + 0.1, z: BL.z + 0.08, r: 0.28 }]) {
      const dx = B.x - o.x, dz = B.z - o.z, d = Math.hypot(dx, dz), m = o.r + B.r;
      if (d < m && d > 1e-4) { B.x = o.x + (dx / d) * m; B.z = o.z + (dz / d) * m; const vn = B.vx * dx / d + B.vz * dz / d; if (vn < 0) { B.vx -= 1.7 * vn * dx / d; B.vz -= 1.7 * vn * dz / d; } }
    }
    B.x += B.vx * dt; B.z += B.vz * dt;
    if (B.x < R.x0 + B.r) { B.x = R.x0 + B.r; B.vx = Math.abs(B.vx) * 0.6; }
    if (B.x > R.x1 - B.r) { B.x = R.x1 - B.r; B.vx = -Math.abs(B.vx) * 0.6; }
    if (B.z < R.z0 + B.r) { B.z = R.z0 + B.r; B.vz = Math.abs(B.vz) * 0.6; }
    if (B.z > R.z1 - B.r) { B.z = R.z1 - B.r; B.vz = -Math.abs(B.vz) * 0.6; }
    const sp = Math.hypot(B.vx, B.vz), f = Math.max(0, 1 - dt * 0.9);
    B.vx *= f; B.vz *= f;
    if (sp > 1e-3) { q.setFromAxisAngle(v.set(B.vz / sp, 0, -B.vx / sp), sp * dt / B.r); ball.quaternion.premultiply(q); }
    ball.position.set(B.x, B.r, B.z); ballShade.position.set(B.x, 0.004, B.z);
    // hearts and z's drift up and fade
    for (const fl of floaters) {
      if (fl.life <= 0) continue;
      fl.t += dt; const k01 = fl.t / fl.life;
      if (k01 >= 1) { fl.life = 0; fl.s.visible = false; continue; }
      fl.s.position.x += fl.vx * dt; fl.s.position.z += fl.vz * dt; fl.s.position.y += dt * (fl.kind === "heart" ? 0.55 : 0.3);
      const s = (fl.kind === "heart" ? 0.16 : 0.13) * (0.6 + 0.4 * Math.min(1, k01 * 4));
      fl.s.scale.set(s, s, 1); fl.s.material.opacity = k01 < 0.7 ? 1 : 1 - (k01 - 0.7) / 0.3;
    }
    halo.material.opacity = 0.6 + 0.05 * Math.sin(frame * 0.02);
    if ((saveT += dt) > 15) { saveT = 0; if (isHere) save(); }
  }

  /* camera keep-outs: not into the teepee or the plant */
  const camBlocks = [[TP.x - TP.r, TP.z - TP.r, R.x1, TP.z + TP.r, 0, TP.h + 0.2], [PL.x - 0.25, PL.z - 0.25, R.x1, R.z1, 0, 1.4]];

  return {
    R, DOOR, tick, camBlocks, meshes, pet, ball, bowlHit, petRoot,
    get fromSave() { return !!saved; }, get name() { return petName; },
    happy, feed, kick, get roomHidden() { return cut.list ? cut.list.length : 0; },
  };
}
