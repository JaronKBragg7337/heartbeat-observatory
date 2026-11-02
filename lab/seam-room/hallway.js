/* ============================================================================
   hallway.js - Page G, the long hallway behind the media room's back door
   ---------------------------------------------------------------------------
   Jaron, from inside the room (page D, 11/1): "Can you make the room by the
   computer a long hallway? That can be a page with many doors in it."
   The media room's far-wall door (d-back, right of the desk) opens into a
   hallway that runs north: inside x -4.45..-1.45, z 9.7..49.7 (3 x 40 m),
   2.9 m high. Built into the SAME scene (one world, no portal).
   TEN closed doors along it, alternating east and west walls, each a different
   wood or paint, each with a big brass number plate ("1" .. "10", COMING
   SOON) and a projecting number blade you can read down the hall. They are
   zones.json "future" doors g-1 .. g-10: a tap rattles one. When zones.json
   makes one "kind": "door", room.js hangs the real leaf and calls openDoor()
   here, which hides that decoration and cuts the opening in the wall while
   the room runs (no reload), then paints the real leaf the same colour.
   Oak boards, a long runner, cream panelled wainscot, striped paper above,
   crown, ten flush ceiling lights, framed paintings with picture lights, a
   console with a lamp, and a window at the far end with a bench and a plant.
   Phone budget: every static part is merged per material, the doors, their
   frames, plates and blades and the picture frames are InstancedMeshes,
   nothing casts shadows and there is NO new light (fixtures glow, soft light
   pools are additive decals). Rooms you cannot see are not drawn: room.js
   culls zones by open doors (world.culls).
   ========================================================================== */
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/* the ten doors: g-N, which wall (e = x -1.45, w = x -4.45), centre z, colour, what it is. zones.json has the same. */
export const HALL_DOORS = [
  { n: 1, side: "e", z: 13.0, color: 0xb98450, finish: "oak" },
  { n: 2, side: "w", z: 16.5, color: 0x93322b, finish: "barn red paint" },
  { n: 3, side: "e", z: 20.0, color: 0x6b432a, finish: "walnut" },
  { n: 4, side: "w", z: 23.5, color: 0x30476a, finish: "navy paint" },
  { n: 5, side: "e", z: 27.0, color: 0x96503a, finish: "cherry" },
  { n: 6, side: "w", z: 30.5, color: 0x80977a, finish: "sage green paint" },
  { n: 7, side: "e", z: 34.0, color: 0xdcbb8a, finish: "maple" },
  { n: 8, side: "w", z: 37.5, color: 0xcc9a33, finish: "mustard paint" },
  { n: 9, side: "e", z: 41.0, color: 0x34302d, finish: "charcoal paint" },
  { n: 10, side: "w", z: 44.5, color: 0x3d8789, finish: "teal paint" },
];

export function buildHallway(k) {
  const { THREE, scene, M, canvasTex, rnd, solids, signTex } = k;
  const H = { x0: -4.45, x1: -1.45, z0: 9.7, z1: 49.7, h: 2.9 };
  const HW = H.x1 - H.x0, HL = H.z1 - H.z0, CX = (H.x0 + H.x1) / 2;
  const BACK = { x0: -3.41, x1: -2.49, h: 2.05 };       // d-back, the door from the media room (south wall)
  const DW = 0.92, DH = 2.05, LW = DW - 0.04;           // door opening, leaf width
  const WAIN = 0.95;                                    // wainscot height
  const WIN = { u0: 0.75, u1: 2.25, y1: 2.45 };         // window in the north wall (u from x1 toward -x): x -2.2..-3.7, sill at WAIN
  const solid = (a, b, c, d) => solids.push([a, b, c, d]);
  const world = () => k.world || window.__seam || null;
  const log = (t) => {
    if (typeof k.log === "function") return k.log(t);
    const lines = window.__seamLog; if (!lines) return;
    const d = new Date(); lines.push(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} ${t}`);
    while (lines.length > 5) lines.shift();
    const box = document.getElementById("seamLog");
    if (box) box.innerHTML = lines.map((l) => `<div>${String(l).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))}</div>`).join("");
  };

  /* ------------------------------------------------- merge per material - */
  function buckets() {
    const map = new Map();
    return {
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
          const m = new THREE.Mesh(g, b.mat); m.receiveShadow = !b.mat.transparent; m.castShadow = false;
          if (b.mat.transparent) m.renderOrder = 2;
          into.add(m); out.push(m);
        }
        map.clear();
        return out;
      },
    };
  }
  const S = buckets();   // static parts, built once
  const boxG = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x || 0, y || 0, z || 0);
  const cylG = (r1, r2, h, seg, x, y, z, rx, rz) => { const g = new THREE.CylinderGeometry(r1, r2, h, seg || 16); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); return g.translate(x || 0, y || 0, z || 0); };
  /* a flat rectangle with UVs in metres / tile */
  function quadG(w, h, tu, tv, u0, v0) {
    const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
    if (tu) for (let i = 0; i < uv.count; i++) uv.setXY(i, ((u0 || 0) + uv.getX(i) * w) / tu, ((v0 || 0) + uv.getY(i) * h) / (tv || tu));
    return g;
  }
  const at = (geo, m) => geo.applyMatrix4(m);
  function mergeLocal(parts) { const gs = parts.map((g) => (g.index ? g.toNonIndexed() : g)); for (const g of gs) for (const n of Object.keys(g.attributes)) if (n !== "position" && n !== "normal" && n !== "uv") g.deleteAttribute(n); return mergeGeometries(gs, false); }

  /* ---------------------------------------------------------- textures - */
  // white-oak boards along the hall (z), 125 mm wide, staggered butt joints. One repeat = 2 m across x 4 m along.
  const boards = canvasTex(512, 1024, (g, w, h) => {
    const r = rnd(901), n = 16, bw = w / n;
    for (let i = 0; i < n; i++) {
      let y = -r() * 400;
      while (y < h) {
        const len = 180 + r() * 420, t = (r() - 0.5) * 26;
        g.fillStyle = `rgb(${168 + t},${128 + t * 0.85},${86 + t * 0.6})`; g.fillRect(i * bw, y, bw, len);
        for (let q = 0; q < 7; q++) {
          g.strokeStyle = `rgba(${70 + r() * 30},${44 + r() * 16},20,${0.06 + r() * 0.08})`; g.lineWidth = 0.6 + r();
          const x = i * bw + r() * bw; g.beginPath(); g.moveTo(x, y);
          g.bezierCurveTo(x + (r() - 0.5) * 4, y + len * 0.3, x + (r() - 0.5) * 4, y + len * 0.7, x + (r() - 0.5) * 3, y + len); g.stroke();
        }
        g.fillStyle = "rgba(40,24,10,.5)"; g.fillRect(i * bw, y, bw, 2);
        y += len;
      }
      g.fillStyle = "rgba(40,24,10,.45)"; g.fillRect(i * bw, 0, 1.5, h);
    }
  }, [HW / 2, HL / 4]);
  const floorMat = new THREE.MeshStandardMaterial({ map: boards, color: 0xb09276, roughness: 0.42 });   // tinted down: the room's sun reaches in here

  // a wool runner: burgundy field, navy + gold borders along both edges, a repeating lozenge medallion. 1 m wide x 2 m a repeat.
  const runnerTex = canvasTex(256, 512, (g, w, h) => {
    const r = rnd(911);
    g.fillStyle = "#6e1f22"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "20,6,8" : "150,60,50"},${0.05 + r() * 0.08})`; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
    for (const [x0, ww, c] of [[0, 30, "#1d2a44"], [30, 6, "#d1a54a"], [42, 4, "#d1a54a"]]) { g.fillStyle = c; g.fillRect(x0, 0, ww, h); g.fillRect(w - x0 - ww, 0, ww, h); }
    g.fillStyle = "#d1a54a";   // little gold dashes in the navy band
    for (let y = 8; y < h; y += 24) { g.fillRect(12, y, 6, 10); g.fillRect(w - 18, y, 6, 10); }
    // the medallion: a gold lozenge with a navy centre, twice per repeat
    for (const cy of [h * 0.25, h * 0.75]) {
      g.save(); g.translate(w / 2, cy);
      g.fillStyle = "#c79a43"; g.beginPath(); g.moveTo(0, -95); g.lineTo(62, 0); g.lineTo(0, 95); g.lineTo(-62, 0); g.closePath(); g.fill();
      g.fillStyle = "#6e1f22"; g.beginPath(); g.moveTo(0, -80); g.lineTo(50, 0); g.lineTo(0, 80); g.lineTo(-50, 0); g.closePath(); g.fill();
      g.fillStyle = "#1d2a44"; g.beginPath(); g.moveTo(0, -48); g.lineTo(30, 0); g.lineTo(0, 48); g.lineTo(-30, 0); g.closePath(); g.fill();
      g.fillStyle = "#e4c27a"; g.beginPath(); g.arc(0, 0, 9, 0, 7); g.fill();
      g.restore();
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) { g.fillStyle = "#c79a43"; g.beginPath(); g.arc(w / 2 + sx * 66, cy + sy * 92, 6, 0, 7); g.fill(); }
    }
  }, [1, 1]);
  const runnerMat = new THREE.MeshStandardMaterial({ map: runnerTex, roughness: 0.98 });

  // striped paper above the wainscot (0.5 m a repeat)
  const paperTex = canvasTex(256, 256, (g, w, h) => {
    const r = rnd(921);
    g.fillStyle = "#b9b29a"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { g.fillStyle = "#aea78d"; g.fillRect(i * 64 + 32, 0, 32, h); g.fillStyle = "rgba(240,232,210,.35)"; g.fillRect(i * 64 + 31, 0, 1.5, h); }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "255,250,235" : "90,80,60"},${0.03 + r() * 0.04})`; g.fillRect(r() * w, r() * h, 2, 2); }
  }, [1, 1]);
  const paperMat = new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.9 });

  // painted panel wainscot: one recessed panel per 0.6 m, 0.95 m tall
  const wainTex = canvasTex(256, 400, (g, w, h) => {
    g.fillStyle = "#ece4d2"; g.fillRect(0, 0, w, h);
    const m = 34, x0 = m, y0 = 46, x1 = w - m, y1 = h - 62;
    g.fillStyle = "#e4dbc8"; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.lineWidth = 5;
    g.strokeStyle = "rgba(120,104,80,.55)"; g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0, y0); g.lineTo(x1, y0); g.stroke();   // top + left bevel in shade
    g.strokeStyle = "rgba(255,252,244,.9)"; g.beginPath(); g.moveTo(x1, y0); g.lineTo(x1, y1); g.lineTo(x0, y1); g.stroke();   // bottom + right catch light
    g.lineWidth = 2; g.strokeStyle = "rgba(120,104,80,.35)"; g.strokeRect(x0 + 10, y0 + 10, x1 - x0 - 20, y1 - y0 - 20);
    g.fillStyle = "rgba(120,104,80,.25)"; g.fillRect(0, 0, 1.5, h);   // the seam between stiles
  }, [1, 1]);
  const wainMat = new THREE.MeshStandardMaterial({ map: wainTex, roughness: 0.55 });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf1ebdf, roughness: 0.95 });

  // the door leaves: a light grain the instance colour tints (wood or paint)
  const grain = canvasTex(128, 512, (g, w, h) => {
    const r = rnd(931);
    g.fillStyle = "#f2ece2"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = `rgba(110,80,50,${0.05 + r() * 0.1})`; g.lineWidth = 0.6 + r() * 1.4;
      const x = r() * w; g.beginPath(); g.moveTo(x, 0);
      g.bezierCurveTo(x + (r() - 0.5) * 14, h * 0.33, x + (r() - 0.5) * 14, h * 0.66, x + (r() - 0.5) * 8, h); g.stroke();
    }
  });
  const leafMat = new THREE.MeshStandardMaterial({ map: grain, roughness: 0.5 });
  const W = {   // materials of the hall's own
    walnut: new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.5 }),
    gilt: new THREE.MeshStandardMaterial({ color: 0xc9a050, roughness: 0.35, metalness: 0.75 }),
    mat: new THREE.MeshStandardMaterial({ color: 0xf3eee2, roughness: 0.9 }),
    cushion: new THREE.MeshStandardMaterial({ color: 0x31465e, roughness: 0.95 }),
    curtain: new THREE.MeshStandardMaterial({ color: 0xb79c7c, roughness: 0.95, side: THREE.DoubleSide }),
    pot: new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.8 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xfff1d8 }),
    shade: new THREE.MeshStandardMaterial({ color: 0xf3e2c0, roughness: 0.9, emissive: 0xffd49a, emissiveIntensity: 0.8 }),
  };

  // number plates: ONE atlas, 5 x 2 cells of 256 x 320: a brass plate with a big number, COMING SOON, g-N
  const plateTex = canvasTex(1280, 640, (g) => {
    for (const d of HALL_DOORS) {
      const i = d.n - 1, ox = (i % 5) * 256, oy = Math.floor(i / 5) * 320;
      g.save(); g.translate(ox, oy);
      const gr = g.createLinearGradient(0, 0, 256, 320); gr.addColorStop(0, "#e2c374"); gr.addColorStop(0.5, "#c49a45"); gr.addColorStop(1, "#a37a2e");
      g.fillStyle = gr; g.fillRect(0, 0, 256, 320);
      g.strokeStyle = "#3a2810"; g.lineWidth = 7; g.strokeRect(12, 12, 232, 296);
      g.strokeStyle = "rgba(255,240,200,.6)"; g.lineWidth = 2; g.strokeRect(20, 20, 216, 280);
      g.fillStyle = "#24180a"; g.textAlign = "center"; g.textBaseline = "alphabetic";
      g.font = `700 ${d.n >= 10 ? 150 : 190}px Georgia, 'Times New Roman', serif`; g.fillText(String(d.n), 128, 200);
      g.font = "800 27px Georgia, serif"; g.fillText("COMING SOON", 128, 252);
      g.font = "19px ui-monospace, Menlo, Consolas, monospace"; g.fillStyle = "#3e2c12"; g.fillText(`next page · g-${d.n}`, 128, 284);
      g.restore();
    }
  });
  plateTex.anisotropy = 8;
  /* the plate material reads its cell from a per-instance attribute (aCell = the cell's corner in the atlas) */
  const plateMat = new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.4, metalness: 0.35 });
  plateMat.onBeforeCompile = (sh) => {
    sh.vertexShader = "attribute vec2 aCell;\n" + sh.vertexShader.replace("#include <uv_vertex>",
      "#include <uv_vertex>\n#ifdef USE_MAP\n\tvMapUv = vMapUv * vec2(0.2, 0.5) + aCell;\n#endif");
  };
  plateMat.customProgramCacheKey = () => "seam-hall-plate";
  const cellOf = (n) => [((n - 1) % 5) * 0.2, Math.floor((n - 1) / 5) === 0 ? 0.5 : 0];

  // ten paintings in one atlas (4 x 3 cells of 300 x 200)
  const artTex = canvasTex(1200, 600, (g) => {
    const P = [
      { sky: ["#f6c79a", "#f2e2c4"], hills: ["#8a9a6a", "#65774c", "#3f5235"], sun: "#fff1c8", sunY: 0.42 },
      { sky: ["#7fb2dc", "#d8e8f0"], sea: "#3e6f8e", sun: null, boat: true },
      { sky: ["#3c4f7a", "#e59a6a"], mountains: ["#5b5f7c", "#3b3e57"], sun: "#ffcf8a", sunY: 0.55 },
      { abstract: ["#b5482f", "#e0b25c", "#2f3b55"] },
      { sky: ["#9cc4e4", "#eef3ea"], hills: ["#b9b26a", "#8f9a4e"], trees: true },
      { sky: ["#141d36", "#3a4a72"], hills: ["#27304a", "#161c30"], moon: true },
      { sky: ["#a9cde8", "#f4efe2"], sea: "#4f8aa0", cliff: true },
      { sky: ["#f0b27a", "#f7e3c3"], mesa: true },
      { sky: ["#b8d0c8", "#e8eee4"], forest: true },
      { abstract: ["#3d6e70", "#d7c9a8", "#9a3a2c"], stripes: true },
    ];
    P.forEach((p, i) => {
      const ox = (i % 4) * 300, oy = Math.floor(i / 4) * 200, w = 300, h = 200, r = rnd(951 + i * 7);
      g.save(); g.beginPath(); g.rect(ox, oy, w, h); g.clip(); g.translate(ox, oy);
      if (p.abstract) {
        const [a, b, c] = p.abstract;
        g.fillStyle = b; g.fillRect(0, 0, w, h);
        if (p.stripes) { for (let s = 0; s < 6; s++) { g.fillStyle = [a, c, b][s % 3]; g.globalAlpha = 0.85; g.fillRect(20 + s * 45, 18 + (s % 2) * 10, 30, h - 40 - (s % 2) * 20); } g.globalAlpha = 1; }
        else { g.fillStyle = a; g.fillRect(24, 20, w - 48, 80); g.fillStyle = c; g.fillRect(24, 112, w - 48, 66); }
      } else {
        const sk = g.createLinearGradient(0, 0, 0, h * 0.7); sk.addColorStop(0, p.sky[0]); sk.addColorStop(1, p.sky[1]);
        g.fillStyle = sk; g.fillRect(0, 0, w, h);
        if (p.sun) { g.fillStyle = p.sun; g.globalAlpha = 0.9; g.beginPath(); g.arc(w * 0.7, h * p.sunY, 18, 0, 7); g.fill(); g.globalAlpha = 1; }
        if (p.moon) { g.fillStyle = "#f2ecd6"; g.beginPath(); g.arc(w * 0.25, h * 0.25, 14, 0, 7); g.fill(); for (let s = 0; s < 40; s++) { g.fillStyle = "rgba(255,255,240,.8)"; g.fillRect(r() * w, r() * h * 0.5, 1.5, 1.5); } }
        for (let c = 0; c < 5; c++) { g.fillStyle = "rgba(255,255,255,.25)"; g.beginPath(); g.ellipse(r() * w, 20 + r() * 50, 30 + r() * 30, 7 + r() * 5, 0, 0, 7); g.fill(); }
        const ridge = (y0, amp, col, seed) => { const q = rnd(seed); g.fillStyle = col; g.beginPath(); g.moveTo(0, h); g.lineTo(0, y0); for (let x = 0; x <= w; x += 20) g.lineTo(x, y0 - Math.sin(x * 0.02 + seed) * amp - q() * amp * 0.4); g.lineTo(w, h); g.closePath(); g.fill(); };
        if (p.hills) p.hills.forEach((c, j) => ridge(h * (0.55 + j * 0.13), 14 - j * 3, c, 7 + j * 3 + i));
        if (p.mountains) { p.mountains.forEach((c, j) => { g.fillStyle = c; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 30) g.lineTo(x, h * (0.45 + j * 0.15) - (x % 60 === 0 ? 40 - j * 12 : 0) - r() * 10); g.lineTo(w, h); g.closePath(); g.fill(); }); }
        if (p.sea) { g.fillStyle = p.sea; g.fillRect(0, h * 0.6, w, h * 0.4); for (let s = 0; s < 60; s++) { g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(r() * w, h * 0.62 + r() * h * 0.36, 8 + r() * 10, 1.5); } }
        if (p.boat) { g.fillStyle = "#5a3a24"; g.fillRect(w * 0.4, h * 0.56, 30, 6); g.fillStyle = "#f4efe2"; g.beginPath(); g.moveTo(w * 0.4 + 14, h * 0.56); g.lineTo(w * 0.4 + 14, h * 0.36); g.lineTo(w * 0.4 + 30, h * 0.56); g.fill(); }
        if (p.cliff) { g.fillStyle = "#8a7a5a"; g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.35); g.lineTo(w * 0.3, h * 0.4); g.lineTo(w * 0.42, h); g.fill(); g.fillStyle = "#6f8a4a"; g.fillRect(0, h * 0.33, w * 0.3, 8); }
        if (p.mesa) { g.fillStyle = "#c98a5a"; g.fillRect(0, h * 0.7, w, h * 0.3); g.fillStyle = "#a6603e"; g.beginPath(); g.moveTo(w * 0.15, h * 0.72); g.lineTo(w * 0.22, h * 0.42); g.lineTo(w * 0.5, h * 0.42); g.lineTo(w * 0.56, h * 0.72); g.fill(); }
        if (p.trees || p.forest) {
          const n = p.forest ? 26 : 7;
          for (let t = 0; t < n; t++) { const x = r() * w, y = h * (p.forest ? 0.55 + r() * 0.4 : 0.62 + r() * 0.15), s = p.forest ? 14 + r() * 16 : 10 + r() * 8;
            g.fillStyle = p.forest ? `rgb(${40 + r() * 30},${70 + r() * 40},${45 + r() * 20})` : "#4a6a3a"; g.beginPath(); g.moveTo(x, y - s * 2.2); g.lineTo(x + s * 0.7, y); g.lineTo(x - s * 0.7, y); g.fill(); }
        }
      }
      for (let s = 0; s < 1400; s++) { g.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "0,0,0"},${0.03 + r() * 0.04})`; g.fillRect(r() * w, r() * h, 2 + r() * 3, 1.5); }   // brush texture
      g.restore();
    });
  });
  const artMat = new THREE.MeshStandardMaterial({ map: artTex, roughness: 0.7 });

  // soft light pools (additive decals: the ceiling lights "light" the floor and walls without a real light)
  const poolTex = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,255,255,.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, color: 0xffd9a8, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
  const viewTex = canvasTex(512, 384, (g, w, h) => {   // what you see out of the far window: sky, clouds, a tree line, a lawn
    const r = rnd(971);
    const sk = g.createLinearGradient(0, 0, 0, h * 0.62); sk.addColorStop(0, "#7fb0dc"); sk.addColorStop(1, "#dbe8ee");
    g.fillStyle = sk; g.fillRect(0, 0, w, h);
    for (let c = 0; c < 9; c++) { g.fillStyle = "rgba(255,255,255,.55)"; const x = r() * w, y = 30 + r() * 120; for (let b = 0; b < 5; b++) { g.beginPath(); g.arc(x + b * 14, y + (r() - 0.5) * 8, 12 + r() * 10, 0, 7); g.fill(); } }
    for (let x = -10; x < w + 10; x += 9) { const tH = 50 + r() * 60; g.fillStyle = `rgb(${50 + r() * 25},${82 + r() * 30},${48 + r() * 18})`; g.beginPath(); g.ellipse(x, h * 0.62 - tH * 0.45, 16 + r() * 10, tH * 0.55, 0, 0, 7); g.fill(); }
    const lawn = g.createLinearGradient(0, h * 0.6, 0, h); lawn.addColorStop(0, "#7d9a52"); lawn.addColorStop(1, "#5d7a3a");
    g.fillStyle = lawn; g.fillRect(0, h * 0.6, w, h * 0.4);
    for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "40,60,20" : "170,190,110"},.25)`; g.fillRect(r() * w, h * 0.6 + r() * h * 0.4, 1.5, 3); }
  });
  const viewMat = new THREE.MeshBasicMaterial({ map: viewTex });

  /* ------------------------------------------------------------- walls - */
  /* each wall: `at` places wall-local (u along it, v up, +z into the hall); u(x or z) gives a world point's u.
     holes: openings (a door that is real, the window); gaps: where trim breaks (every door, real or future) */
  const ry = (a) => new THREE.Matrix4().makeRotationY(a);
  const WALLS = {
    w: { len: HL, at: new THREE.Matrix4().makeTranslation(H.x0, 0, H.z1).multiply(ry(Math.PI / 2)), u: (z) => H.z1 - z, holes: [] },
    e: { len: HL, at: new THREE.Matrix4().makeTranslation(H.x1, 0, H.z0).multiply(ry(-Math.PI / 2)), u: (z) => z - H.z0, holes: [] },
    s: { len: HW, at: new THREE.Matrix4().makeTranslation(H.x0, 0, H.z0), u: (x) => x - H.x0, holes: [{ u0: BACK.x0 - H.x0, u1: BACK.x1 - H.x0, v1: BACK.h, door: true, casing: true }] },
    n: { len: HW, at: new THREE.Matrix4().makeTranslation(H.x1, 0, H.z1).multiply(ry(Math.PI)), u: (x) => H.x1 - x, holes: [{ u0: WIN.u0, u1: WIN.u1, v1: WIN.y1, win: true }] },
  };
  /* the doors (decoration until real): frame matrix F (local +x along the wall, +z into the hall) */
  const FD = HALL_DOORS.map((d, i) => {
    const west = d.side === "w", x = west ? H.x0 : H.x1;
    const F = new THREE.Matrix4().makeTranslation(x, 0, d.z).multiply(ry(west ? Math.PI / 2 : -Math.PI / 2));
    return { ...d, i, id: `g-${d.n}`, x, F, rattle: 0, open: false };
  });
  for (const f of FD) { const w = WALLS[f.side], a = w.u(f.z - DW / 2), b = w.u(f.z + DW / 2); f.gap = { u0: Math.min(a, b), u1: Math.max(a, b) }; }

  let wallGroup = null;
  function buildWalls() {
    if (wallGroup) { scene.remove(wallGroup); wallGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    wallGroup = new THREE.Group(); wallGroup.name = "hall-walls"; scene.add(wallGroup);
    const B = buckets();
    for (const [side, w] of Object.entries(WALLS)) {
      const put = (geo, mat) => B.add(at(geo, w.at), mat);
      const quad = (u0, u1, v0, v1, mat, dz, tu, tv) => { if (u1 - u0 > 1e-3 && v1 - v0 > 1e-3) put(quadG(u1 - u0, v1 - v0, tu, tv, u0, v0).translate((u0 + u1) / 2, (v0 + v1) / 2, dz || 0), mat); };
      const holes = w.holes.slice().sort((a, b) => a.u0 - b.u0);
      const doorHoles = holes.filter((o) => o.door);
      // paper: WAIN..h, notched where a hole is (doors and the window reach up from the wainscot line)
      let u = 0;
      for (const o of holes) { quad(u, o.u0, WAIN, H.h, paperMat, 0, 0.5); quad(o.u0, o.u1, o.v1, H.h, paperMat, 0, 0.5); u = o.u1; }
      quad(u, w.len, WAIN, H.h, paperMat, 0, 0.5);
      // wainscot 0..WAIN, 12 mm proud, cut only at real door openings
      u = 0;
      for (const o of doorHoles) { quad(u, o.u0, 0, WAIN, wainMat, 0.012, 0.6, WAIN); u = o.u1; }
      quad(u, w.len, 0, WAIN, wainMat, 0.012, 0.6, WAIN);
      // trim: baseboard + chair rail broken at every door (real or future); crown all along
      const gaps = doorHoles.map((o) => ({ u0: o.u0, u1: o.u1 })).concat(FD.filter((f) => f.side === side).map((f) => f.gap)).sort((a, b) => a.u0 - b.u0);
      u = 0;
      for (const gp of gaps.concat([{ u0: w.len + 0.07, u1: w.len }])) {
        const e = gp.u0 - 0.07;
        if (e - u > 0.02) {
          put(boxG(e - u, 0.14, 0.02, (u + e) / 2, 0.07, 0.01), M.trim);
          put(boxG(e - u, 0.05, 0.035, (u + e) / 2, WAIN, 0.018), M.trim);
        }
        u = gp.u1 + 0.07;
      }
      put(boxG(w.len, 0.09, 0.06, w.len / 2, H.h - 0.045, 0.03), M.trim);
      put(boxG(w.len, 0.03, 0.09, w.len / 2, H.h - 0.1, 0.045), M.trim);
      // a real door's opening: jamb linings through the 15 cm wall + an oak threshold (a side door: room.js hangs the
      // leaf with its frame on the hall side); d-back gets a casing on the hall side (its linings + frame are den.js's)
      for (const o of doorHoles) {
        if (o.linings) {
          for (const uu of [o.u0 + 0.015, o.u1 - 0.015]) put(boxG(0.03, o.v1, 0.15, uu, o.v1 / 2, -0.075), M.trim);
          put(boxG(o.u1 - o.u0, 0.03, 0.15, (o.u0 + o.u1) / 2, o.v1 - 0.015, -0.075), M.trim);
          put(boxG(o.u1 - o.u0, 0.012, 0.19, (o.u0 + o.u1) / 2, 0.006, -0.075), M.oak);
        }
        if (o.casing) {
          put(boxG(o.u1 - o.u0 + 0.16, 0.08, 0.04, (o.u0 + o.u1) / 2, o.v1 + 0.04, 0.02), M.trim);
          for (const uu of [o.u0 - 0.04, o.u1 + 0.04]) put(boxG(0.08, o.v1 + 0.08, 0.04, uu, (o.v1 + 0.08) / 2, 0.02), M.trim);
        }
      }
    }
    return B.flush(wallGroup);
  }
  buildWalls();

  /* ------------------------------------------------------- floor, ceiling - */
  S.add(quadG(HW, HL).rotateX(-Math.PI / 2).translate(CX, 0, (H.z0 + H.z1) / 2), floorMat);
  S.add(quadG(HW, HL).rotateX(Math.PI / 2).translate(CX, H.h, (H.z0 + H.z1) / 2), ceilMat);
  const RUN = { w: 1.0, z0: 10.5, z1: 48.9 };
  S.add(quadG(RUN.w, RUN.z1 - RUN.z0, 1, 2).rotateX(-Math.PI / 2).translate(CX, 0.008, (RUN.z0 + RUN.z1) / 2), runnerMat);
  for (const z of [RUN.z0, RUN.z1]) S.add(boxG(RUN.w, 0.01, 0.05, CX, 0.005, z), W.mat);   // the bound ends
  for (const x of [CX - RUN.w / 2, CX + RUN.w / 2]) S.add(boxG(0.012, 0.009, RUN.z1 - RUN.z0, x, 0.0045, (RUN.z0 + RUN.z1) / 2), runnerMat);   // edge thickness

  /* ------------------------------------------- the doors (instanced) - */
  // the leaf, in its own frame: hinge at the origin, x along the leaf, y up, z toward the hall. Body + two raised panels.
  const leafGeo = mergeLocal([boxG(LW, 2.03, 0.04, LW / 2, 1.015, 0), boxG(LW - 0.28, 0.72, 0.014, LW / 2, 0.56, 0.026), boxG(LW - 0.28, 0.78, 0.014, LW / 2, 1.52, 0.026)]);
  const hwGeo = mergeLocal([cylG(0.028, 0.024, 0.055, 16, LW - 0.08, 1.0, 0.05, Math.PI / 2), cylG(0.038, 0.038, 0.008, 20, LW - 0.08, 1.0, 0.024, Math.PI / 2),
    ...[0.25, 1.0, 1.8].map((y) => cylG(0.011, 0.011, 0.09, 10, 0, y, 0.022))]);
  const plateGeo = new THREE.PlaneGeometry(0.3, 0.375).translate(LW / 2, 1.52, 0.035);
  const casingGeo = mergeLocal([boxG(DW + 0.16, 0.08, 0.05, 0, DH + 0.04, 0.025), boxG(0.08, DH + 0.08, 0.05, -(DW / 2 + 0.04), (DH + 0.08) / 2, 0.025), boxG(0.08, DH + 0.08, 0.05, DW / 2 + 0.04, (DH + 0.08) / 2, 0.025)]);
  // the number blade above each door, standing out from the wall so you can read it down the hall (two faces)
  const bladeGeo = mergeLocal([new THREE.PlaneGeometry(0.26, 0.325).rotateY(Math.PI / 2).translate(0.008, 2.43, 0.21), new THREE.PlaneGeometry(0.26, 0.325).rotateY(-Math.PI / 2).translate(-0.008, 2.43, 0.21)]);
  const N = FD.length;
  const inst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.receiveShadow = true; m.castShadow = false; scene.add(m); return m; };
  const leafIM = inst(leafGeo, leafMat, N), hwIM = inst(hwGeo, M.brass, N), plateIM = inst(plateGeo, plateMat, N), casingIM = inst(casingGeo, M.trim, N), bladeIM = inst(bladeGeo, plateMat, N);
  leafIM.name = "hall-doors";
  const plateCells = new Float32Array(N * 2);
  FD.forEach((f, i) => { const c = cellOf(f.n); plateCells[i * 2] = c[0]; plateCells[i * 2 + 1] = c[1]; });
  plateGeo.setAttribute("aCell", new THREE.InstancedBufferAttribute(plateCells, 2));
  bladeGeo.setAttribute("aCell", new THREE.InstancedBufferAttribute(plateCells.slice(), 2));
  const HINGE = new THREE.Matrix4().makeTranslation(-DW / 2 + 0.02, 0, 0.024), RY = new THREE.Matrix4(), L = new THREE.Matrix4(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const col = new THREE.Color();
  function placeLeaf(f, r) {
    if (f.open) { for (const m of [leafIM, hwIM, plateIM]) m.setMatrixAt(f.i, ZERO); }
    else { L.copy(f.F).multiply(HINGE).multiply(RY.makeRotationY(r)); for (const m of [leafIM, hwIM, plateIM]) m.setMatrixAt(f.i, L); }
    leafIM.instanceMatrix.needsUpdate = hwIM.instanceMatrix.needsUpdate = plateIM.instanceMatrix.needsUpdate = true;
  }
  for (const f of FD) {
    placeLeaf(f, 0);
    casingIM.setMatrixAt(f.i, f.F); bladeIM.setMatrixAt(f.i, f.F);
    leafIM.setColorAt(f.i, col.setHex(f.color));
    // the blade's walnut edge and its brass bracket (static: the number stays when the door becomes real)
    S.add(at(boxG(0.012, 0.335, 0.27, 0, 2.43, 0.21), f.F), W.walnut);
    S.add(at(cylG(0.008, 0.008, 0.35, 8, 0, 2.62, 0.175, Math.PI / 2), f.F), M.brass);
  }
  for (const m of [leafIM, hwIM, plateIM, casingIM, bladeIM]) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
  leafIM.instanceColor.needsUpdate = true;

  /* -------------------------------------------- pictures + their lights - */
  // one painting on the wall across from every door
  const PICS = FD.map((f, i) => ({ side: f.side === "e" ? "w" : "e", z: f.z, cell: i }));
  const PW = 0.9, PH = 0.68, PY = 1.62;
  const frameGeo = mergeLocal([boxG(PW, 0.055, 0.035, 0, PH / 2 - 0.0275, 0.0175), boxG(PW, 0.055, 0.035, 0, -PH / 2 + 0.0275, 0.0175),
    boxG(0.055, PH - 0.11, 0.035, PW / 2 - 0.0275, 0, 0.0175), boxG(0.055, PH - 0.11, 0.035, -PW / 2 + 0.0275, 0, 0.0175)]);
  const frameIM = inst(frameGeo, W.gilt, PICS.length);
  PICS.forEach((p, i) => {
    const west = p.side === "w", Pm = new THREE.Matrix4().makeTranslation(west ? H.x0 : H.x1, PY, p.z).multiply(ry(west ? Math.PI / 2 : -Math.PI / 2));
    frameIM.setMatrixAt(i, Pm);
    frameIM.setColorAt(i, col.setHex(i % 3 === 2 ? 0x2a2522 : 0xffffff));   // a few black frames among the gilt
    S.add(at(quadG(PW - 0.1, PH - 0.1).translate(0, 0, 0.012), Pm), W.mat);
    const g = quadG(0.62, 0.413), uv = g.attributes.uv, cu = (p.cell % 4) / 4, cv = 1 - (Math.floor(p.cell / 4) + 1) / 3;
    for (let q = 0; q < uv.count; q++) uv.setXY(q, cu + uv.getX(q) / 4, cv + uv.getY(q) / 3);
    S.add(at(g.translate(0, 0, 0.014), Pm), artMat);
    // a brass picture light over it: arm, bar, a glowing strip, and the light it throws on the canvas
    S.add(at(cylG(0.01, 0.01, 0.13, 8, 0, PH / 2 + 0.12, 0.065, Math.PI / 2), Pm), M.brass);
    S.add(at(cylG(0.028, 0.028, 0.5, 16, 0, PH / 2 + 0.12, 0.13, 0, Math.PI / 2), Pm), M.brass);
    S.add(at(boxG(0.46, 0.01, 0.025, 0, PH / 2 + 0.095, 0.13), Pm), W.glow);
    S.add(at(quadG(1.3, 1.1).translate(0, 0.12, 0.02), Pm), poolMat);
  });
  frameIM.instanceMatrix.needsUpdate = true; frameIM.instanceColor.needsUpdate = true; frameIM.computeBoundingSphere();

  /* ------------------------------------------- ceiling lights + pools - */
  for (let i = 0; i < 10; i++) {
    const z = 11.5 + i * 4;
    S.add(cylG(0.2, 0.2, 0.03, 28, CX, H.h - 0.015, z), M.brass);
    S.add(new THREE.SphereGeometry(0.17, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1, 0.55, 1).translate(CX, H.h - 0.03, z), W.glow);
    S.add(quadG(2.6, 2.6).rotateX(-Math.PI / 2).translate(CX, 0.013, z), poolMat);                     // on the floor
    S.add(quadG(2.4, 1.7).rotateY(Math.PI / 2).translate(H.x0 + 0.004, H.h - 0.75, z), poolMat);       // the walls' upper wash
    S.add(quadG(2.4, 1.7).rotateY(-Math.PI / 2).translate(H.x1 - 0.004, H.h - 0.75, z), poolMat);
  }

  /* --------------------------------------- the doorway from the media room - */
  S.add(boxG(BACK.x1 - BACK.x0, 0.012, 0.2, (BACK.x0 + BACK.x1) / 2, 0.006, H.z0 - 0.075), M.oak);   // threshold through the wall

  /* ------------------------------------------- the window at the far end - */
  {
    const n = WALLS.n, put = (geo, mat) => S.add(at(geo, n.at), mat);
    const u0 = WIN.u0, u1 = WIN.u1, v0 = WAIN, v1 = WIN.y1, uc = (u0 + u1) / 2, ww = u1 - u0, wh = v1 - v0;
    put(quadG(4.2, 3.2).translate(uc, (v0 + v1) / 2 + 0.1, -0.9), viewMat);                        // the view, out beyond the wall
    for (const uu of [u0 + 0.015, u1 - 0.015]) put(boxG(0.03, wh, 0.15, uu, (v0 + v1) / 2, -0.075), M.trim);   // reveals
    put(boxG(ww, 0.03, 0.15, uc, v1 - 0.015, -0.075), M.trim);
    put(boxG(ww + 0.12, 0.04, 0.22, uc, v0 - 0.0, -0.04), M.trim);                                  // the stool (sill)
    for (const uu of [u0 - 0.04, u1 + 0.04]) put(boxG(0.08, wh + 0.08, 0.035, uu, (v0 + v1 + 0.08) / 2 - 0.04, 0.018), M.trim);   // casing
    put(boxG(ww + 0.16, 0.09, 0.035, uc, v1 + 0.045, 0.018), M.trim);
    // two sashes (6 over 6): stiles, rails, muntins
    const zs = -0.1;
    for (const uu of [u0 + 0.05, u1 - 0.05]) put(boxG(0.06, wh, 0.05, uu, (v0 + v1) / 2, zs), M.trim);
    for (const vv of [v0 + 0.06, (v0 + v1) / 2, v1 - 0.04]) put(boxG(ww, 0.06, 0.05, uc, vv, zs), M.trim);
    for (const f of [1 / 3, 2 / 3]) put(boxG(0.022, wh, 0.03, u0 + ww * f, (v0 + v1) / 2, zs + 0.01), M.trim);
    for (const f of [0.25, 0.75]) put(boxG(ww, 0.022, 0.03, uc, v0 + wh * f, zs + 0.01), M.trim);
    // curtains on a brass rod, gathered at the sides (a wavy cloth)
    put(cylG(0.014, 0.014, ww + 0.9, 12, uc, v1 + 0.2, 0.09, 0, Math.PI / 2), M.brass);
    for (const sx of [-1, 1]) {
      const cw = 0.42, chH = v1 + 0.2 - 0.06, g = new THREE.PlaneGeometry(cw, chH, 14, 1), p = g.attributes.position;
      for (let q = 0; q < p.count; q++) p.setZ(q, Math.sin((p.getX(q) / cw) * Math.PI * 7) * 0.03);
      g.computeVertexNormals();
      put(g.translate(uc + sx * (ww / 2 + 0.2), chH / 2 + 0.06, 0.09), W.curtain);
    }
    // a walnut bench under the window, with a cushion
    const bw = 1.2;   // local z = into the hall
    put(boxG(bw, 0.05, 0.42, uc, 0.45, 0.25), W.walnut);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(boxG(0.05, 0.43, 0.05, uc + sx * (bw / 2 - 0.06), 0.215, 0.25 + sz * 0.15), W.walnut);
    put(boxG(bw - 0.08, 0.07, 0.38, uc, 0.51, 0.25), W.cushion);
    solid(H.x1 - (uc + bw / 2) - 0.05, H.z1 - 0.5, H.x1 - (uc - bw / 2) + 0.05, H.z1);
    // a tall plant in the corner (u near the west end = len)
    const pu = HW - 0.3;
    put(cylG(0.2, 0.15, 0.42, 20, pu, 0.21, 0.3), W.pot);
    const pr = rnd(981);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + pr(), tilt = 0.15 + pr() * 0.4, len = 0.7 + pr() * 0.6;
      const g = new THREE.SphereGeometry(0.06, 8, 6).scale(1, len / 0.12, 0.35);
      g.rotateX(tilt); g.rotateY(a); g.translate(pu + Math.sin(a) * 0.05, 0.42 + len * 0.45, 0.3 + Math.cos(a) * 0.05);
      put(g, M.leaf);
    }
    solid(H.x0, H.z1 - 0.55, H.x0 + 0.55, H.z1);
  }

  /* ---------------------------------- a console + lamp, the PAGE G sign - */
  {
    const z0 = 10.3, z1 = 11.6, zc = (z0 + z1) / 2, x = H.x1 - 0.19;
    S.add(boxG(0.36, 0.04, z1 - z0, x, 0.8, zc), W.walnut);
    S.add(boxG(0.3, 0.12, z1 - z0 - 0.08, x, 0.72, zc), W.walnut);
    for (const zz of [z0 + 0.04, z1 - 0.04]) for (const dx of [-0.14, 0.14]) S.add(boxG(0.035, 0.78, 0.035, x + dx, 0.39, zz), W.walnut);
    S.add(boxG(0.3, 0.025, z1 - z0 - 0.08, x, 0.16, zc), W.walnut);
    S.add(cylG(0.07, 0.09, 0.32, 20, x, 0.98, z0 + 0.3), W.pot);                     // lamp base
    S.add(cylG(0.13, 0.18, 0.22, 24, x, 1.26, z0 + 0.3), W.shade);                  // its glowing shade
    S.add(quadG(1.4, 1.2).rotateY(-Math.PI / 2).translate(H.x1 - 0.004, 1.35, z0 + 0.3), poolMat);   // the lamp's glow on the wall
    S.add(boxG(0.22, 0.03, 0.3, x, 0.835, zc + 0.25), W.cushion);                   // a book
    solid(H.x1 - 0.42, z0 - 0.05, H.x1, z1 + 0.05);
    // PAGE G, on the west wall by the way in (like A..F's signs)
    const SG = new THREE.Matrix4().makeTranslation(H.x0 + 0.03, 1.65, 10.95).multiply(ry(Math.PI / 2));
    S.add(at(boxG(1.12, 0.74, 0.04), SG), W.walnut);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.625), new THREE.MeshStandardMaterial({ map: signTex("G", "/lab/seam-room/g/"), roughness: 0.8 }));
    face.applyMatrix4(SG); face.translateZ(0.022); face.receiveShadow = true; scene.add(face);
    S.add(at(cylG(0.02, 0.03, 0.18, 12, 0, 0.47, 0.08, Math.PI / 2), SG), M.brass);
  }
  const meshes = S.flush(scene);

  /* ------------------------------------- taps: a future door rattles - */
  const alive = () => !!scene.parent;   // false once this zone is hot-swapped out
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const canvas = document.getElementById("gl");
  let down = null;
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 }; };
  const onMove = (e) => { if (down) down.moved = Math.max(down.moved, Math.hypot(e.clientX - down.x, e.clientY - down.y)); };
  const onUp = (e) => {
    if (!alive()) return cleanup();
    const d = down; down = null;
    if (!d || d.moved > 10 || performance.now() - d.t > 400 || !scene.visible) return;
    const w = world(); if (!w || !w.camera) return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, w.camera);
    const hits = ray.intersectObjects([leafIM, plateIM, hwIM], false).filter((h) => h.instanceId != null && !FD[h.instanceId].open && h.distance < 10);
    if (hits.length) rattle(FD[hits[0].instanceId].id);
  };
  function cleanup() {
    if (canvas) canvas.removeEventListener("pointerdown", onDown);
    removeEventListener("pointermove", onMove); removeEventListener("pointerup", onUp);
  }
  if (canvas) canvas.addEventListener("pointerdown", onDown);
  addEventListener("pointermove", onMove); addEventListener("pointerup", onUp);
  function rattle(id) {
    const f = FD.find((q) => q.id === id); if (!f || f.open) return false;
    f.rattle = 0.45; log(`door ${f.n} (${id}): coming soon (a future page)`);
    return true;
  }

  /* a real leaf (room.js makeDoor) gets this door's own colour: room.js only knows oak / walnut / maple / white */
  const paints = new Map();
  function paintReal(f) {
    const w = world(), dr = w && w.doors && w.doors[f.id];
    if (!dr || !dr.leaf) return;
    let mat = paints.get(f.id);
    if (!mat) { mat = new THREE.MeshStandardMaterial({ map: grain, color: f.color, roughness: 0.5 }); paints.set(f.id, mat); }
    dr.leaf.traverse((o) => { if (o.isMesh && o.material !== M.brass) o.material = mat; });
  }

  /* ------------------------------------------- the room you cannot see - */
  /* room.js culls zone groups by open doors, but always draws the room itself (A and B). Looking back down the hall
     all of it is in view behind two walls (~330 draw calls). While the camera is in the hall and the way to A (this
     hall's door d-back AND A's door a-d) is not open, the room's static pieces are hidden, and so are the doors you
     cannot see (with d-back shut: every door but the hall's; with it open: every door but the hall's and the media
     room's). They come back as soon as the camera leaves or both doors open. Lights, people, name tags, the log/chair
     and its halo are never touched. Hidden pieces are marked, so a hot-swapped hallway (or one built later) puts
     them back. */
  const root = scene.parent;
  const shellCut = { list: null, key: "" };
  if (root) for (const c of root.children) if (c.userData && c.userData.hallHidden) { c.visible = true; delete c.userData.hallHidden; }
  function roomShell(key, dd) {
    const out = [], bb = new THREE.Box3();
    for (const c of root.children) {
      if (c === scene || !c.visible || /^zone-/.test(c.name || "")) continue;
      const dm = /^door-(.+)$/.exec(c.name || "");
      if (dm) {   // a door: hidden unless it is the hall's own, or (d-back open) one of the media room's
        const btw = (dd[dm[1]] && dd[dm[1]].data && dd[dm[1]].data.between) || [];
        if (!btw.includes("g") && !(key === "den" && btw.includes("d"))) out.push(c);
        continue;
      }
      let skip = false, meshes = 0;
      c.traverse((o) => {
        if (o.isLight || o.isSkinnedMesh || o.isBone || o.isSprite || o.isPoints || (o.userData && (o.userData.asset || o.userData.placeholder)) || (o.geometry && o.geometry.type === "RingGeometry")) skip = true;   // never people, tags, the log/chair or its halo
        if (o.isMesh) meshes++;
      });
      if (skip || !meshes) continue;
      bb.setFromObject(c);
      if (bb.isEmpty() || bb.min.x < -6.4 || bb.max.x > 6.4 || bb.min.z < -4.4 || bb.max.z > 4.4) continue;
      out.push(c);
    }
    return out;
  }
  function cullRoom() {
    const w = world(), cam = w && w.camera;
    if (!root || !cam) return;
    const p = cam.position, dd = (w && w.doors) || {}, open = (id) => !!dd[id] && dd[id].amt > 0.001;
    const inHall = p.x > H.x0 - 0.2 && p.x < H.x1 + 0.2 && p.z > H.z0 - 0.05 && p.z < H.z1 + 0.5;
    const key = !inHall || !scene.visible ? "" : !open("d-back") ? "shut" : !open("a-d") ? "den" : "";
    if (key === shellCut.key) return;
    if (shellCut.list) for (const o of shellCut.list) { o.visible = true; delete o.userData.hallHidden; }
    shellCut.list = key ? roomShell(key, dd) : null; shellCut.key = key;
    if (shellCut.list) for (const o of shellCut.list) { o.visible = false; o.userData.hallHidden = true; }
  }

  /* --------------------------------------------------------------- tick - */
  function tick(dt) {
    cullRoom();
    for (const f of FD) {
      if (f.rattle <= 0) continue;
      f.rattle = Math.max(0, f.rattle - dt);
      placeLeaf(f, f.rattle > 0 ? -Math.sin(f.rattle * 40) * 0.025 * (f.rattle / 0.45) : 0);   // locked: it gives a little, then stops
    }
  }

  return {
    H, BACK, doors: FD, meshes, tick, rattle, get roomHidden() { return shellCut.list ? shellCut.list.length : 0; },
    get wallMeshes() { return wallGroup ? wallGroup.children.length : 0; },
    /* the front of door N (where the AI or a test stands): 0.8 m into the hall, facing it */
    spotFor(id) { const f = FD.find((q) => q.id === id || String(q.n) === String(id)); if (!f) return null; return { x: f.x + (f.side === "w" ? 0.8 : -0.8), z: f.z }; },
    /* a future door became a real page (zones.json "kind": "door"): hide its coming-soon leaf, cut the opening in its
       wall (with linings and a threshold), paint the real leaf room.js hung. Works while the room runs. */
    openDoor(id, d) {
      const f = FD.find((q) => q.id === id);
      if (!f) return false;
      if (!f.open) {
        const p = (d && d.plane) || {}, h = (d && d.h) || DH, w = WALLS[f.side];
        const z0 = p.minZ != null ? p.minZ : f.z - DW / 2, z1 = p.maxZ != null ? p.maxZ : f.z + DW / 2;
        const a = w.u(z0), b = w.u(z1);
        w.holes.push({ u0: Math.min(a, b), u1: Math.max(a, b), v1: h, door: true, linings: true, id });
        f.open = true; f.rattle = 0;
        placeLeaf(f, 0);
        casingIM.setMatrixAt(f.i, ZERO); casingIM.instanceMatrix.needsUpdate = true;
        for (const m of [leafIM, hwIM, plateIM, casingIM]) m.computeBoundingSphere();
        buildWalls();
      }
      paintReal(f);
      return true;
    },
  };
}
