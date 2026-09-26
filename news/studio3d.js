// Heartbeat News - the 3D newsroom inside the TV.
//
// Units are metres; the studio grid's origin is the centre of the anchor desk's footprint on the floor, +Z toward the
// cameras. Real measurements used (MEASURED = from a published spec; CHOSEN = picked to look right):
//   Anchor desk top 0.80 m (MEASURED: broadcast desks run 30-32 in / 0.76-0.81 m, taller than office desks so seated
//   anchors sit higher on camera). LED wall cabinets 0.50 x 0.50 m (MEASURED: the standard 500 x 500 mm cabinet),
//   wall 14 x 6 cabinets = 7.0 x 3.0 m. Anchor chair seat 0.56 m (CHOSEN, a tall anchor chair). Seated shoulder
//   ~0.56 m above the seat and eye ~0.80 m above the seat (MEASURED, adult anthropometry tables, rounded).
//   Truss 0.29 m box truss (MEASURED: the common 12 in box truss). Studio grid 1 m.
// Everything here is built in code (procedural). Per 3D-STANDARDS, procedural parts are placeholders until swapped for
// sourced models, and the debug layer says so beside each asset ID.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { Reflector } from "three/addons/objects/Reflector.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const DESK_H = 0.80, SEAT_H = 0.56;
const DESK_R = 4.0, DESK_CZ = -3.6, DESK_DEPTH = 0.62, DESK_HALF_W = 1.5;
const WALL_Z = -3.3, WALL_W = 7.0, WALL_H = 3.0, WALL_Y0 = 0.45;
const ANCHOR_X = 0.62, ANCHOR_Z = -0.45;

// ---- small helpers -------------------------------------------------------------------------------------------------
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }
function tex(c, { srgb = true, repeat = null, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso;
  return t;
}
// Value noise, a few octaves: used for roughness variation, skin, fabric, and wear so no surface is one flat value.
function noiseField(w, h, seed, scales = [64, 16, 4], weights = [0.55, 0.3, 0.15]) {
  const r = rng(seed), out = new Float32Array(w * h);
  scales.forEach((sc, k) => {
    const gw = Math.ceil(w / sc) + 2, gh = Math.ceil(h / sc) + 2, g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = r();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const fx = x / sc, fy = y / sc, ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
      out[y * w + x] += weights[k] * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
    }
  });
  return out;
}
function greyCanvas(w, h, fn) {
  const [c, g] = canvas(w, h), img = g.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { const v = Math.max(0, Math.min(255, fn(i) * 255)); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  return c;
}
function between(mesh, a, b) {
  const d = b.clone().sub(a);
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
  return mesh;
}
class ArcXZ extends THREE.Curve {
  constructor(r, cz, y, a0, a1) { super(); Object.assign(this, { r, cz, y, a0, a1 }); }
  getPoint(t, o = new THREE.Vector3()) { const a = this.a0 + (this.a1 - this.a0) * t; return o.set(this.r * Math.sin(a), this.y, this.cz + this.r * Math.cos(a)); }
}

// The channel mark: a heartbeat trace through a rounded square. Drawn the same on the wall, desk and mugs.
export function drawLogo(g, x, y, s, { red = "#e11d2e", navy = "#0b1f4d", white = "#ffffff", text = true } = {}) {
  g.save(); g.translate(x, y);
  const r = s * 0.18;
  g.fillStyle = navy; g.beginPath(); g.roundRect ? g.roundRect(0, 0, s, s, r) : g.rect(0, 0, s, s); g.fill();
  g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = s * 0.035; g.stroke();
  g.strokeStyle = red; g.lineWidth = s * 0.07; g.lineJoin = "round"; g.lineCap = "round";
  g.beginPath();
  const m = s * 0.5;
  [[0.08, 0.66], [0.3, 0.66], [0.38, 0.54], [0.47, 0.87], [0.58, 0.45], [0.66, 0.66], [0.92, 0.66]].forEach(([u, v], i) => (i ? g.lineTo(u * s, v * s) : g.moveTo(u * s, v * s)));
  g.stroke();
  if (text) {
    g.fillStyle = white; g.font = `800 ${s * 0.3}px "Barlow Condensed", "Arial Narrow", Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.fillText("HBN", m, s * 0.36);
  }
  g.restore();
}

function wrapText(g, text, maxW) {
  const words = String(text).split(/\s+/), lines = []; let line = "";
  for (const w of words) { const t = line ? line + " " + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}

const THEMES = {
  breaking: { a: "#5a0710", b: "#1a0206", accent: "#ff2436", kicker: "#e11d2e" },
  weather: { a: "#06394a", b: "#021520", accent: "#35d0ff", kicker: "#0a8fc2" },
  sports: { a: "#0b3a1c", b: "#03140a", accent: "#4be37f", kicker: "#119a45" },
  open: { a: "#0e2a6b", b: "#030a1f", accent: "#ff2e3f", kicker: "#e11d2e" },
  close: { a: "#0e2a6b", b: "#030a1f", accent: "#ff2e3f", kicker: "#e11d2e" },
  story: { a: "#0c2560", b: "#020818", accent: "#47a3ff", kicker: "#1552d6" },
  wire: { a: "#1b1f2e", b: "#05060b", accent: "#ffb020", kicker: "#c77a00" },
  ad: { a: "#3a1b5c", b: "#0c0518", accent: "#ffcf4a", kicker: "#b8860b" }
};

// ---- the newsroom ---------------------------------------------------------------------------------------------------
export function createNewsroom(canvasEl, opts = {}) {
  const q = opts.quality || { tier: "desktop", allowShadows: true, allowBloom: true, maxPixelRatio: 2 };
  const high = q.tier === "desktop";
  const lite = q.tier === "mobile-lite";
  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: !lite, powerPreference: "high-performance", alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.maxPixelRatio || 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = !!q.allowShadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03060c);
  scene.fog = new THREE.Fog(0x03060c, 14, 34);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;

  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 80);
  const assets = [];
  function reg(obj, id, name, note = "procedural placeholder") { obj.userData.asset = { id, name, note }; assets.push(obj); return obj; }
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // ---- shared materials ----
  const texSize = lite ? 256 : 512;
  const brushed = tex(greyCanvas(texSize, texSize, (() => { const n = noiseField(texSize, texSize, 7, [texSize, 32, 2], [0.3, 0.3, 0.4]); return (i) => 0.28 + 0.22 * n[i] + 0.12 * Math.sin((i % texSize) * 0.9 + n[i] * 3); })()), { srgb: false, repeat: [2, 2], aniso });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde3, metalness: 1, roughness: 0.22, roughnessMap: brushed });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1b1f26, metalness: 0.85, roughness: 0.42, roughnessMap: brushed });
  const blackGloss = new THREE.MeshStandardMaterial({ color: 0x07090d, metalness: 0.2, roughness: 0.18 });
  const blackMatte = new THREE.MeshStandardMaterial({ color: 0x0c0e12, metalness: 0.1, roughness: 0.8 });

  // ---- floor: polished epoxy tiles, roughness varied per tile and by wear, plus a mirror under it on desktop ----
  {
    const N = lite ? 512 : 1024, [c, g] = canvas(N, N), r = rng(11);
    g.fillStyle = "#0a0e16"; g.fillRect(0, 0, N, N);
    const T = N / 4;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const v = 10 + r() * 6; g.fillStyle = `rgb(${v},${v + 3},${v + 9})`; g.fillRect(x * T + 2, y * T + 2, T - 4, T - 4); }
    g.strokeStyle = "#020305"; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * T, 0); g.lineTo(i * T, N); g.stroke(); g.beginPath(); g.moveTo(0, i * T); g.lineTo(N, i * T); g.stroke(); }
    const nf = noiseField(N, N, 5, [N / 2, N / 8, 8], [0.5, 0.3, 0.2]);
    const rough = tex(greyCanvas(N, N, (i) => 0.12 + 0.35 * nf[i] + ((i % N) % T < 4 || ((i / N) | 0) % T < 4 ? 0.4 : 0)), { srgb: false, repeat: [10, 10], aniso });
    const map = tex(c, { repeat: [10, 10], aniso });
    const floorMat = new THREE.MeshStandardMaterial({ map, roughnessMap: rough, roughness: 1, metalness: 0.15, transparent: high, opacity: high ? 0.86 : 1 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(48, 48), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    scene.add(reg(floor, "NR-FLR-01", "Studio floor, 1.2 m epoxy tiles"));
    if (high) {
      const mirror = new Reflector(new THREE.PlaneGeometry(48, 48), { textureWidth: 1024, textureHeight: 1024, color: 0x6a7280 });
      mirror.rotation.x = -Math.PI / 2; mirror.position.y = -0.002; scene.add(mirror);
    }
    // Floor LED rings under the desk (a real set uses recessed LED tape in a routed channel).
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x2f7dff, toneMapped: false });
    [4.35, 4.55].forEach((rr, i) => {
      const ring = new THREE.Mesh(new THREE.TubeGeometry(new ArcXZ(rr, DESK_CZ, 0.004, -0.5, 0.5), 96, i ? 0.006 : 0.012, 6), i ? new THREE.MeshBasicMaterial({ color: 0xe11d2e, toneMapped: false }) : ringMat);
      scene.add(reg(ring, "NR-FLR-0" + (2 + i), "Floor LED channel " + (i + 1), "procedural"));
    });
  }

  // ---- anchor desk ----
  const desk = new THREE.Group(); scene.add(reg(desk, "NR-DSK-01", "Anchor desk, 3.0 m curved, top 0.80 m"));
  const deskA = Math.asin(DESK_HALF_W / DESK_R);
  let deskLed;
  {
    // Top slab: white solid-surface with a slight sheen; bevelled edge so it catches the key light.
    const shape = new THREE.Shape();
    const rIn = DESK_R - DESK_DEPTH, steps = 48;
    for (let i = 0; i <= steps; i++) { const a = -deskA + (2 * deskA * i) / steps; shape[i ? "lineTo" : "moveTo"](DESK_R * Math.sin(a), -(DESK_CZ + DESK_R * Math.cos(a))); }
    for (let i = steps; i >= 0; i--) { const a = -deskA + (2 * deskA * i) / steps; shape.lineTo(rIn * Math.sin(a), -(DESK_CZ + rIn * Math.cos(a))); }
    const topGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.01, bevelSegments: 3, curveSegments: 4 });
    topGeo.rotateX(-Math.PI / 2);
    const topRough = tex(greyCanvas(256, 256, (() => { const n = noiseField(256, 256, 21); return (i) => 0.18 + 0.2 * n[i]; })()), { srgb: false, repeat: [3, 1] });
    const top = new THREE.Mesh(topGeo, new THREE.MeshPhysicalMaterial({ color: 0xeef0f2, roughness: 1, roughnessMap: topRough, clearcoat: 0.6, clearcoatRoughness: 0.12 }));
    top.position.y = DESK_H - 0.043; top.castShadow = top.receiveShadow = true; desk.add(top);
    // Glass inlay strip along the front edge.
    const glass = new THREE.Mesh(new THREE.TubeGeometry(new ArcXZ(DESK_R - 0.05, DESK_CZ, DESK_H + 0.004, -deskA + 0.02, deskA - 0.02), 96, 0.004, 4), new THREE.MeshBasicMaterial({ color: 0x9fd0ff, toneMapped: false }));
    desk.add(glass);
    // Front fascia: dark gloss shell, an LED screen band, and chrome rails.
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(DESK_R - 0.012, DESK_R - 0.012, DESK_H - 0.06, 96, 1, true, -deskA, 2 * deskA), blackGloss);
    shell.position.set(0, (DESK_H - 0.06) / 2 + 0.02, DESK_CZ); desk.add(shell);
    const [lc, lg] = canvas(2048, 256);
    const grad = lg.createLinearGradient(0, 0, 0, 256); grad.addColorStop(0, "#07163e"); grad.addColorStop(0.5, "#0d2c7a"); grad.addColorStop(1, "#061233");
    lg.fillStyle = grad; lg.fillRect(0, 0, 2048, 256);
    for (let x = 0; x < 2048; x += 8) { lg.fillStyle = `rgba(120,170,255,${0.05 + 0.05 * Math.sin(x * 0.05)})`; lg.fillRect(x, 0, 1, 256); }
    lg.fillStyle = "rgba(0,0,0,0.35)"; for (let y = 0; y < 256; y += 4) lg.fillRect(0, y, 2048, 1); // LED pixel rows
    lg.font = '800 118px "Barlow Condensed", "Arial Narrow", Arial, sans-serif'; lg.textBaseline = "middle";
    const lockW = 190 + lg.measureText("HEARTBEAT NEWS").width, x0 = (2048 - lockW) / 2;
    drawLogo(lg, x0, 43, 170);
    lg.fillStyle = "#fff"; lg.fillText("HEARTBEAT", x0 + 190, 134); lg.fillStyle = "#ff3445"; lg.fillText("NEWS", x0 + 190 + lg.measureText("HEARTBEAT ").width, 134);
    // Red rule each side of the lockup.
    lg.fillStyle = "#e11d2e"; lg.fillRect(60, 126, x0 - 110, 8); lg.fillRect(x0 + lockW + 50, 126, 2048 - (x0 + lockW + 50) - 60, 8);
    const ledTex = tex(lc, { repeat: [1, 1], aniso }); ledTex.wrapS = THREE.RepeatWrapping;
    deskLed = new THREE.Mesh(new THREE.CylinderGeometry(DESK_R - 0.004, DESK_R - 0.004, 0.36, 96, 1, true, -deskA + 0.06, 2 * deskA - 0.12), new THREE.MeshBasicMaterial({ map: ledTex, toneMapped: false }));
    deskLed.position.set(0, 0.44, DESK_CZ); desk.add(reg(deskLed, "NR-DSK-02", "Desk LED fascia, 0.36 m band", "procedural"));
    [[DESK_H - 0.055, 0.012], [0.62, 0.006], [0.26, 0.006], [0.06, 0.016]].forEach(([y, t]) => {
      const rail = new THREE.Mesh(new THREE.TubeGeometry(new ArcXZ(DESK_R + 0.004, DESK_CZ, y, -deskA, deskA), 96, t, 8), chrome);
      desk.add(rail);
    });
    // End caps and a recessed plinth so it reads as assembled, not one extruded blob.
    [-1, 1].forEach((s) => {
      const a = s * deskA;
      const cap = new THREE.Mesh(new RoundedBoxGeometry(0.05, DESK_H - 0.05, DESK_DEPTH + 0.02, 3, 0.012), darkMetal);
      cap.position.set((DESK_R - DESK_DEPTH / 2) * Math.sin(a), (DESK_H - 0.05) / 2, DESK_CZ + (DESK_R - DESK_DEPTH / 2) * Math.cos(a));
      cap.rotation.y = a; desk.add(cap);
    });
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(DESK_R - 0.08, DESK_R - 0.08, 0.05, 96, 1, true, -deskA, 2 * deskA), new THREE.MeshBasicMaterial({ color: 0x1f5fff, toneMapped: false }));
    plinth.position.set(0, 0.025, DESK_CZ); desk.add(plinth);
    desk.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }

  // ---- props on the desk ----
  function deskFrontZ(x, inset = 0) { return DESK_CZ + Math.sqrt((DESK_R - inset) ** 2 - x * x); }
  {
    const paper = new THREE.MeshStandardMaterial({ color: 0xf4f4ef, roughness: 0.9 });
    [[-0.52, 0.06], [0.7, -0.08]].forEach(([x, rot], i) => {
      for (let k = 0; k < 3; k++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.216, 0.0012, 0.279), paper); // US Letter, MEASURED 8.5 x 11 in
        p.position.set(x + k * 0.004, DESK_H + 0.002 + k * 0.0012, deskFrontZ(x, 0.34) + k * 0.003); p.rotation.y = rot + k * 0.03; p.receiveShadow = true;
        scene.add(i === 0 && k === 0 ? reg(p, "NR-PRP-01", "Script pages, US Letter") : p);
      }
    });
    // Tablet (10.9 in class, MEASURED 248 x 179 x 6 mm).
    const tab = new THREE.Mesh(new RoundedBoxGeometry(0.179, 0.006, 0.248, 2, 0.008), blackGloss);
    tab.position.set(-0.86, DESK_H + 0.004, deskFrontZ(-0.86, 0.36)); tab.rotation.y = 0.25; scene.add(reg(tab, "NR-PRP-02", "Tablet, 248 x 179 mm"));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.228), new THREE.MeshBasicMaterial({ color: 0x173a7a, toneMapped: false }));
    scr.rotation.x = -Math.PI / 2; scr.position.y = 0.0035; tab.add(scr);
    // Mugs (MEASURED: 11 oz mug, 82 mm across, 95 mm tall) with the channel mark.
    const [mc, mg] = canvas(512, 256); mg.fillStyle = "#f6f6f6"; mg.fillRect(0, 0, 512, 256); drawLogo(mg, 190, 60, 130);
    const mugMat = new THREE.MeshPhysicalMaterial({ map: tex(mc), roughness: 0.25, clearcoat: 0.8 });
    [[-1.02, 0.42], [1.02, -0.3]].forEach(([x, ry], i) => {
      const mug = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.039, 0.095, 32, 1, true), mugMat); body.position.y = 0.0475; mug.add(body);
      const base = new THREE.Mesh(new THREE.CircleGeometry(0.039, 24), mugMat); base.rotation.x = -Math.PI / 2; base.position.y = 0.001; mug.add(base);
      const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.038, 24), new THREE.MeshStandardMaterial({ color: 0x2a160b, roughness: 0.15 })); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.08; mug.add(coffee);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 8, 16, Math.PI), mugMat); handle.rotation.z = -Math.PI / 2; handle.position.set(0.041, 0.05, 0); mug.add(handle);
      mug.position.set(x, DESK_H, deskFrontZ(x, 0.4)); mug.rotation.y = ry; mug.traverse((o) => { o.castShadow = true; });
      scene.add(reg(mug, "NR-PRP-0" + (3 + i), "Mug, 11 oz"));
    });
    // Pen.
    const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.14, 10), darkMetal); pen.rotation.z = Math.PI / 2; pen.rotation.y = 0.5;
    pen.position.set(0.5, DESK_H + 0.005, deskFrontZ(0.5, 0.3)); scene.add(pen);
  }

  // ---- chairs (tall anchor chairs; mostly hidden, the backs frame the anchors) ----
  function chair(x) {
    const g = new THREE.Group();
    const leather = new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.55, metalness: 0.05 });
    const seat = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.09, 0.48, 3, 0.03), leather); seat.position.y = SEAT_H - 0.045; g.add(seat);
    const back = new THREE.Mesh(new RoundedBoxGeometry(0.48, 0.62, 0.08, 3, 0.035), leather); back.position.set(0, SEAT_H + 0.36, -0.24); back.rotation.x = -0.12; g.add(back);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, SEAT_H - 0.1, 12), chrome); post.position.y = (SEAT_H - 0.1) / 2 + 0.05; g.add(post);
    for (let i = 0; i < 5; i++) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.34), chrome); const a = (i / 5) * Math.PI * 2; leg.position.set(Math.sin(a) * 0.17, 0.05, Math.cos(a) * 0.17); leg.rotation.y = a; g.add(leg); }
    g.position.set(x, 0, ANCHOR_Z - 0.02);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  scene.add(reg(chair(-ANCHOR_X), "NR-CHR-01", "Anchor chair, seat 0.56 m"));
  scene.add(reg(chair(ANCHOR_X), "NR-CHR-02", "Anchor chair, seat 0.56 m"));

  // ---- the LED video wall ----
  const wallW = high ? 2048 : 1024, wallH = Math.round(wallW * (WALL_H / WALL_W));
  const [wallC, wallG] = canvas(wallW, wallH);
  const wallTex = tex(wallC, { aniso });
  const [blurC, blurG] = canvas(wallW, wallH), wallBlurTex = tex(blurC, { aniso });
  const [smallC, smallG] = canvas(Math.round(wallW / 10), Math.round(wallH / 10));
  const [midC, midG] = canvas(Math.round(wallW / 4), Math.round(wallH / 4));
  let wallMat = null;
  let wallGraphic = null;
  {
    wallMat = new THREE.MeshBasicMaterial({ map: wallTex, toneMapped: false });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, WALL_H), wallMat);
    wall.position.set(0, WALL_Y0 + WALL_H / 2, WALL_Z); scene.add(reg(wall, "NR-WAL-01", "LED wall, 14 x 6 cabinets of 0.5 m"));
    // Frame: a black aluminium surround with a chrome reveal.
    const fr = [[WALL_W + 0.16, 0.08, 0, WALL_H / 2 + 0.04], [WALL_W + 0.16, 0.08, 0, -WALL_H / 2 - 0.04], [0.08, WALL_H, -WALL_W / 2 - 0.04, 0], [0.08, WALL_H, WALL_W / 2 + 0.04, 0]];
    fr.forEach(([w, h, x, y]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), darkMetal); b.position.set(x, WALL_Y0 + WALL_H / 2 + y, WALL_Z - 0.05); scene.add(b); });
    const base = new THREE.Mesh(new THREE.BoxGeometry(WALL_W + 0.3, WALL_Y0, 0.4), blackMatte); base.position.set(0, WALL_Y0 / 2, WALL_Z - 0.1); scene.add(base);
    const baseStrip = new THREE.Mesh(new THREE.BoxGeometry(WALL_W + 0.3, 0.012, 0.01), new THREE.MeshBasicMaterial({ color: 0x2f7dff, toneMapped: false })); baseStrip.position.set(0, WALL_Y0 - 0.03, WALL_Z + 0.105); scene.add(baseStrip);
    // A light sweep that crosses the wall every few seconds (the "shine" pass broadcast walls run).
    const [sc, sg] = canvas(256, 16); const sgr = sg.createLinearGradient(0, 0, 256, 0);
    sgr.addColorStop(0, "rgba(255,255,255,0)"); sgr.addColorStop(0.5, "rgba(255,255,255,0.16)"); sgr.addColorStop(1, "rgba(255,255,255,0)"); sg.fillStyle = sgr; sg.fillRect(0, 0, 256, 16);
    const sweepTex = tex(sc); sweepTex.wrapS = THREE.RepeatWrapping; sweepTex.repeat.set(0.35, 1);
    const sweep = new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, WALL_H), new THREE.MeshBasicMaterial({ map: sweepTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    sweep.position.set(0, WALL_Y0 + WALL_H / 2, WALL_Z + 0.004); scene.add(sweep);
    wallGraphic = { sweepTex };
  }

  // House commercials: the page's camera shot fills the wall and the view drifts across it (a slow camera move).
  const adImages = new Map();
  let wallSeg = null, adPan = null, reelIdx = 0, reelSegId = null;
  function adImage(src) {
    let im = adImages.get(src);
    if (!im) {
      im = new Image(); im.decoding = "async";
      im.onload = () => { const gr = wallSeg && wallSeg.graphic; if (gr && (gr.image === src || (gr.images && gr.images[reelIdx % gr.images.length] === src))) drawWall(wallSeg); };
      im.src = src; adImages.set(src, im);
    }
    return im.complete && im.naturalWidth ? im : null;
  }
  function drawWall(seg) {
    const g = wallG, W = wallW, H = wallH, u = W / 2048;
    wallSeg = seg;
    // a reel (graphic.images) flips through several photos; a single spot uses graphic.image
    const reel = seg && seg.kind === "ad" && seg.graphic && seg.graphic.images && seg.graphic.images.length ? seg.graphic.images : null;
    if (reel) { if (reelSegId !== seg.id) { reelSegId = seg.id; reelIdx = 0; } reel.forEach((src) => adImage(src)); }
    const src = reel ? reel[reelIdx % reel.length] : (seg && seg.kind === "ad" && seg.graphic && seg.graphic.image) || null;
    const shot = src ? adImage(src) : null;
    if (shot) {
      const s = Math.max(W / shot.naturalWidth, H / shot.naturalHeight);
      const dw = shot.naturalWidth * s, dh = shot.naturalHeight * s;
      g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
      g.drawImage(shot, (W - dw) / 2, (H - dh) / 2, dw, dh);
      const shade = g.createLinearGradient(0, H * 0.62, 0, H); shade.addColorStop(0, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(0,0,0,0.72)");
      g.fillStyle = shade; g.fillRect(0, 0, W, H);
      const font = (w, sz) => `${w} ${sz * u}px "Barlow Condensed", "Arial Narrow", Arial, sans-serif`;
      const kicker = String(seg.graphic.kicker || "COMMERCIAL").toUpperCase();
      g.font = font(800, 58); const kw = g.measureText(kicker).width + 60 * u;
      g.fillStyle = THEMES.ad.kicker; g.fillRect(90 * u, H - 250 * u, kw, 84 * u);
      g.fillStyle = "#fff"; g.textBaseline = "middle"; g.fillText(kicker, 120 * u, H - 208 * u);
      g.font = font(800, 104); g.fillText(String(seg.graphic.title || "").toUpperCase(), 90 * u, H - 100 * u);
      drawLogo(g, W - 250 * u, 48 * u, 160 * u);
      wallTex.repeat.set(0.84, 0.84); adPan = { t0: performance.now(), reel: !!reel };
      wallTex.needsUpdate = true;
      midG.drawImage(wallC, 0, 0, midC.width, midC.height); smallG.drawImage(midC, 0, 0, smallC.width, smallC.height);
      blurG.drawImage(smallC, 0, 0, wallW, wallH); wallBlurTex.needsUpdate = true;
      return;
    }
    if (adPan) { adPan = null; wallTex.repeat.set(1, 1); wallTex.offset.set(0, 0); }
    const th = THEMES[seg && seg.kind] || THEMES.story;
    const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, th.a); bg.addColorStop(1, th.b);
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // Background texture: soft radial glow and fine diagonal lines.
    const rg = g.createRadialGradient(W * 0.5, H * 0.25, 10, W * 0.5, H * 0.25, W * 0.6); rg.addColorStop(0, "rgba(255,255,255,0.14)"); rg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(255,255,255,0.035)"; g.lineWidth = 2 * u; for (let x = -H; x < W; x += 28 * u) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.stroke(); }
    // Dotted globe watermark, lower centre (behind the anchors).
    g.fillStyle = "rgba(255,255,255,0.07)";
    for (let la = -80; la <= 80; la += 8) for (let lo = 0; lo < 360; lo += 8) { const a = (lo * Math.PI) / 180, b = (la * Math.PI) / 180; const z = Math.cos(b) * Math.cos(a); if (z < 0) continue; g.beginPath(); g.arc(W * 0.5 + Math.cos(b) * Math.sin(a) * 300 * u, H * 0.74 - Math.sin(b) * 300 * u, 3 * u, 0, 7); g.fill(); }
    const graphic = (seg && seg.graphic) || {};
    const font = (w, s) => `${w} ${s * u}px "Barlow Condensed", "Arial Narrow", Arial, sans-serif`;
    // Kicker tab and title across the top (above the anchors' heads in every shot).
    const kicker = (graphic.kicker || (seg && seg.category) || "HEARTBEAT NEWS").toUpperCase();
    g.font = font(800, 58); const kw = g.measureText(kicker).width + 60 * u;
    g.fillStyle = th.kicker; g.fillRect(90 * u, 62 * u, kw, 84 * u);
    g.fillStyle = "#fff"; g.textBaseline = "middle"; g.fillText(kicker, 120 * u, 106 * u);
    drawLogo(g, W - 250 * u, 48 * u, 160 * u);
    g.font = font(800, 118); g.fillStyle = "#fff";
    const titleLines = wrapText(g, (graphic.title || (seg && seg.headline) || "").toUpperCase(), W - 480 * u).slice(0, 2);
    titleLines.forEach((l, i) => g.fillText(l, 90 * u, 238 * u + i * 118 * u));
    g.fillStyle = th.accent; g.fillRect(90 * u, 300 * u + (titleLines.length - 1) * 118 * u, 220 * u, 8 * u);
    // Stat tiles on the left, bullets on the right: the sides stay visible beside the anchors.
    const stats = (graphic.stats || []).slice(0, 4);
    stats.forEach((s, i) => {
      const x = 90 * u, y = (430 + i * 105) * u;
      g.fillStyle = "rgba(0,0,0,0.38)"; g.fillRect(x, y, 560 * u, 92 * u);
      g.fillStyle = th.accent; g.fillRect(x, y, 8 * u, 92 * u);
      g.fillStyle = "rgba(255,255,255,0.7)"; g.font = font(600, 34); g.fillText(String(s.label).toUpperCase(), x + 28 * u, y + 28 * u);
      g.fillStyle = "#fff"; g.font = font(800, 50); g.fillText(String(s.value), x + 28 * u, y + 66 * u);
    });
    const bullets = (graphic.bullets || []).slice(0, 4);
    g.font = font(600, 40);
    let by = 440 * u;
    bullets.forEach((b) => {
      const lines = wrapText(g, b, 560 * u).slice(0, 2);
      g.fillStyle = th.accent; g.fillRect(W - 700 * u, by - 10 * u, 16 * u, 16 * u);
      g.fillStyle = "#fff"; lines.forEach((l, i) => g.fillText(l, W - 665 * u, by + i * 46 * u));
      by += (lines.length * 46 + 34) * u;
    });
    // LED cabinet seams and per-cabinet colour variance: real walls never match perfectly.
    const r = rng(3), cw = W / 14, ch = H / 6;
    for (let y = 0; y < 6; y++) for (let x = 0; x < 14; x++) { const v = r(); g.fillStyle = v > 0.5 ? `rgba(255,255,255,${(v - 0.5) * 0.05})` : `rgba(0,0,0,${(0.5 - v) * 0.08})`; g.fillRect(x * cw, y * ch, cw, ch); }
    g.fillStyle = "rgba(0,0,0,0.55)";
    for (let x = 1; x < 14; x++) g.fillRect(x * cw - u, 0, 2 * u, H);
    for (let y = 1; y < 6; y++) g.fillRect(0, y * ch - u, W, 2 * u);
    wallTex.needsUpdate = true;
    // Out-of-focus copy: downsample twice and scale back up (works on every browser, no canvas filter needed).
    midG.imageSmoothingEnabled = smallG.imageSmoothingEnabled = blurG.imageSmoothingEnabled = true;
    midG.drawImage(wallC, 0, 0, midC.width, midC.height);
    smallG.drawImage(midC, 0, 0, smallC.width, smallC.height);
    blurG.drawImage(smallC, 0, 0, wallW, wallH);
    blurG.fillStyle = "rgba(0,0,0,0.18)"; blurG.fillRect(0, 0, wallW, wallH);
    wallBlurTex.needsUpdate = true;
  }

  // ---- side monitors: world clocks (left) and the channel mark (right) ----
  const sideW = 384, sideH = 640;
  const [clockC, clockG] = canvas(sideW, sideH), clockTex = tex(clockC);
  const [markC, markG] = canvas(sideW, sideH), markTex = tex(markC);
  {
    const g = markG; const gr = g.createLinearGradient(0, 0, 0, sideH); gr.addColorStop(0, "#0d2c7a"); gr.addColorStop(1, "#030a1f");
    g.fillStyle = gr; g.fillRect(0, 0, sideW, sideH); drawLogo(g, 72, 150, 240);
    g.fillStyle = "#fff"; g.font = '800 64px "Barlow Condensed", Arial, sans-serif'; g.textAlign = "center"; g.fillText("HEARTBEAT", sideW / 2, 470); g.fillStyle = "#ff3445"; g.fillText("NEWS", sideW / 2, 535);
    [[-4.25, -0.62], [4.25, 0.62]].forEach(([x, ry], i) => {
      const grp = new THREE.Group();
      const bezel = new THREE.Mesh(new RoundedBoxGeometry(1.34, 2.14, 0.07, 3, 0.02), darkMetal); grp.add(bezel);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.26, 2.06), new THREE.MeshBasicMaterial({ map: i ? markTex : clockTex, toneMapped: false })); screen.position.z = 0.036; grp.add(screen);
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), darkMetal); stand.position.y = -1.5; grp.add(stand);
      grp.position.set(x, 1.95, -2.35); grp.rotation.y = ry; scene.add(reg(grp, "NR-MON-0" + (i + 1), i ? "Portrait monitor, channel mark" : "Portrait monitor, world clocks"));
    });
  }
  let lastClockMin = -1;
  function drawClocks(now) {
    const g = clockG, W = sideW, H = sideH;
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#0a1f55"); gr.addColorStop(1, "#020816");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.textAlign = "left"; g.fillStyle = "#ff3445"; g.fillRect(28, 34, 10, 52); g.fillStyle = "#fff"; g.font = '800 46px "Barlow Condensed", Arial, sans-serif'; g.textBaseline = "middle"; g.fillText("WORLD TIME", 52, 62);
    const zones = [["FORT WAYNE", "America/Indiana/Indianapolis"], ["WASHINGTON", "America/New_York"], ["LONDON", "Europe/London"], ["BEIJING", "Asia/Shanghai"], ["HONOLULU", "Pacific/Honolulu"]];
    zones.forEach(([name, tz], i) => {
      const y = 150 + i * 98;
      let t = "--:--"; try { t = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(now); } catch (e) {}
      g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(24, y - 38, W - 48, 80);
      g.fillStyle = "rgba(255,255,255,0.75)"; g.font = '600 30px "Barlow Condensed", Arial, sans-serif'; g.fillText(name, 44, y - 12);
      g.fillStyle = "#fff"; g.font = '800 44px "Barlow Condensed", Arial, sans-serif'; g.fillText(t, 44, y + 22);
    });
    clockTex.needsUpdate = true;
  }

  // ---- hologram globe on a plinth, set left ----
  const globe = new THREE.Group();
  {
    const pts = [], R = 0.5;
    for (let la = -84; la <= 84; la += 6) { const n = Math.max(6, Math.round(60 * Math.cos((la * Math.PI) / 180))); for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, b = (la * Math.PI) / 180; pts.push(R * Math.cos(b) * Math.sin(a), R * Math.sin(b), R * Math.cos(b) * Math.cos(a)); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    globe.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x5fb0ff, size: 0.018, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })));
    [0, 1, 2].forEach((i) => { const ring = new THREE.Mesh(new THREE.TorusGeometry(R * (1.12 + i * 0.07), 0.003, 6, 96), new THREE.MeshBasicMaterial({ color: i === 1 ? 0xff3445 : 0x5fb0ff, transparent: true, opacity: 0.7, toneMapped: false })); ring.rotation.x = Math.PI / 2 + i * 0.35; ring.rotation.y = i * 0.6; globe.add(ring); });
    globe.position.set(-3.1, 1.75, -1.75);
    scene.add(reg(globe, "NR-GLB-01", "Hologram globe, 1.0 m"));
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 1.0, 40), darkMetal); plinth.position.set(-3.1, 0.5, -1.75); scene.add(plinth);
    const glow = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.008, 6, 64), new THREE.MeshBasicMaterial({ color: 0x5fb0ff, toneMapped: false })); glow.rotation.x = Math.PI / 2; glow.position.set(-3.1, 1.0, -1.75); scene.add(glow);
  }

  // ---- back of set: pillars with LED strips, and a night skyline far behind ----
  {
    [-4.0, 4.0].forEach((x, i) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 0.6), blackMatte); p.position.set(x, 2.5, WALL_Z - 0.3); scene.add(reg(p, "NR-PIL-0" + (i + 1), "Set pillar, 0.6 m"));
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.03, 4.6, 0.01), new THREE.MeshBasicMaterial({ color: i ? 0xe11d2e : 0x2f7dff, toneMapped: false })); s.position.set(x + (i ? -0.2 : 0.2), 2.5, WALL_Z + 0.006); scene.add(s);
    });
    const SW = 2048, SH = 512, [c, g] = canvas(SW, SH), r = rng(99);
    const sky = g.createLinearGradient(0, 0, 0, SH); sky.addColorStop(0, "#02040b"); sky.addColorStop(0.6, "#0a1333"); sky.addColorStop(1, "#281a3a");
    g.fillStyle = sky; g.fillRect(0, 0, SW, SH);
    for (let layer = 0; layer < 2; layer++) {
      let x = 0;
      while (x < SW) {
        const w = 40 + r() * 110, h = (layer ? 120 : 200) + r() * (layer ? 180 : 260), y = SH - h;
        g.fillStyle = layer ? "#070a14" : "#0c1122"; g.fillRect(x, y, w, h);
        for (let wy = y + 10; wy < SH - 6; wy += 12) for (let wx = x + 6; wx < x + w - 6; wx += 10) if (r() < 0.32) { g.fillStyle = r() < 0.8 ? "rgba(255,214,150,0.75)" : "rgba(170,210,255,0.8)"; g.fillRect(wx, wy, 5, 6); }
        if (r() < 0.25) { g.fillStyle = "#ff2b2b"; g.fillRect(x + w / 2 - 2, y - 6, 4, 4); }
        x += w + r() * 14;
      }
    }
    const skyline = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 7, 64, 1, true, Math.PI - 1.1, 2.2), new THREE.MeshBasicMaterial({ map: tex(c), side: THREE.BackSide, toneMapped: false, color: 0x8890a0 }));
    skyline.position.set(0, 3.2, 2); scene.add(reg(skyline, "NR-SKY-01", "Skyline backdrop, 14 m radius", "procedural backdrop"));
  }

  // ---- lighting truss and fixtures ----
  const lightMat = new THREE.MeshStandardMaterial({ color: 0x15171c, metalness: 0.6, roughness: 0.5 });
  {
    const T = 0.29, trussY = 4.6, chord = new THREE.CylinderGeometry(0.024, 0.024, 1, 8), lace = new THREE.CylinderGeometry(0.009, 0.009, 1, 6);
    const lines = [];
    [-0.8, 2.2].forEach((z) => {
      const x0 = -5, x1 = 5;
      const corners = [[0, 0], [T, 0], [0, T], [T, T]];
      corners.forEach(([dy, dz]) => lines.push([V(x0, trussY + dy, z + dz), V(x1, trussY + dy, z + dz), 0]));
      for (let x = x0; x < x1; x += T) {
        lines.push([V(x, trussY, z), V(x + T, trussY + T, z), 1], [V(x, trussY, z + T), V(x + T, trussY + T, z + T), 1]);
        lines.push([V(x, trussY, z), V(x + T, trussY, z + T), 1], [V(x, trussY + T, z), V(x + T, trussY + T, z + T), 1]);
        lines.push([V(x, trussY, z), V(x, trussY + T, z), 1], [V(x, trussY, z + T), V(x, trussY + T, z + T), 1]);
      }
    });
    const chords = lines.filter((l) => !l[2]), laces = lines.filter((l) => l[2]);
    const m = new THREE.Matrix4(), dummy = new THREE.Object3D();
    [[chords, chord, chrome], [laces, lace, chrome]].forEach(([set, geo, mat]) => {
      const im = new THREE.InstancedMesh(geo, mat, set.length);
      set.forEach(([a, b], i) => { between(dummy, a, b); dummy.scale.set(1, a.distanceTo(b), 1); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
      scene.add(im);
    });
    void m;
    // Fresnel fixtures: body, lens, barn doors and yoke, hung from the front truss and aimed at the desk.
    const fixtures = [[-2.2, 2.35], [-0.9, 2.35], [0.9, 2.35], [2.2, 2.35], [-1.6, -0.65], [1.6, -0.65], [0, -0.65], [-3.2, 2.35], [3.2, 2.35]];
    fixtures.forEach(([x, z], i) => {
      const f = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.3, 20), lightMat); body.rotation.x = Math.PI / 2; f.add(body);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), new THREE.MeshBasicMaterial({ color: 0xfff4e0, toneMapped: false })); lens.position.z = 0.151; f.add(lens);
      for (let k = 0; k < 4; k++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.004, 0.12), lightMat); d.position.z = 0.2; d.rotation.z = (k * Math.PI) / 2; d.translateY(0.12); d.rotation.x += k % 2 ? 0 : 0.5; f.add(d); }
      const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.01, 6, 16, Math.PI), darkMetal); yoke.rotation.y = Math.PI / 2; f.add(yoke);
      f.position.set(x, 4.3, z + 0.15); f.lookAt(x * 0.3, 1.2, -0.4);
      scene.add(i === 0 ? reg(f, "NR-LGT-01", "Fresnel fixture, 0.26 m lens (x9)") : f);
      // Faint haze cone so the beams read on camera, like a studio running a hazer.
      if (!lite && i < 7) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xbfd4ff, transparent: true, opacity: 0.028, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
        cone.position.set(0, 0, 1.7); cone.rotation.x = -Math.PI / 2; f.add(cone);
      }
    });
  }

  // ---- lights ----
  scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x0a0c10, 0.35));
  const key = new THREE.SpotLight(0xfff1e0, 44, 16, 0.5, 0.65, 1.4); key.position.set(0.2, 4.3, 3.6); key.target.position.set(0, 1.2, -0.45);
  if (q.allowShadows) { key.castShadow = true; key.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.camera.near = 1; key.shadow.camera.far = 12; }
  scene.add(key, key.target);
  [[-2.6, 0x9cc4ff], [2.6, 0xffd9b0]].forEach(([x, c]) => { const f = new THREE.SpotLight(c, 13, 14, 0.6, 0.8, 1.4); f.position.set(x, 3.2, 3.0); f.target.position.set(x * 0.15, 1.2, -0.45); scene.add(f, f.target); });
  [[-1.2, 0x7fb2ff], [1.2, 0xcfe0ff]].forEach(([x, c]) => { const b = new THREE.SpotLight(c, 26, 10, 0.45, 0.7, 1.4); b.position.set(x, 4.2, -2.4); b.target.position.set(x * 0.5, 1.3, -0.45); scene.add(b, b.target); });
  const wallSpill = new THREE.PointLight(0x3d6cff, 5, 7, 1.6); wallSpill.position.set(0, 2.0, -2.6); scene.add(wallSpill);

  // ---- anchors ----------------------------------------------------------------------------------------------------
  function scratchMap(seed, base, amount) {
    const N = lite ? 256 : 512, n = noiseField(N, N, seed, [N / 4, 24, 4], [0.5, 0.3, 0.2]), r = rng(seed + 1);
    const c = greyCanvas(N, N, (i) => base + amount * (n[i] - 0.5));
    const g = c.getContext("2d"); g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 1;
    for (let i = 0; i < 90; i++) { const x = r() * N, y = r() * N, a = r() * Math.PI, l = 6 + r() * 28; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    return tex(c, { srgb: false, aniso });
  }

  function arm(side, mats, fingers) {
    // side: -1 = anchor's right (screen left), +1 = anchor's left. Shoulder, elbow resting at the desk's back edge, wrist on the desk.
    const S = V(side * 0.235, 1.06, -0.01), E = V(side * 0.275, 0.86, 0.14), W = V(side * 0.19, 0.845, 0.4);
    const g = new THREE.Group();
    const upper = between(new THREE.Mesh(new THREE.CapsuleGeometry(mats.upperR, S.distanceTo(E), 6, 14), mats.sleeve), S, E); g.add(upper);
    const elbow = new THREE.Group(); elbow.position.copy(E); g.add(elbow);
    if (mats.joint) { const j = new THREE.Mesh(new THREE.SphereGeometry(mats.upperR * 1.08, 16, 12), mats.joint); elbow.add(j); }
    const rel = W.clone().sub(E);
    const fore = between(new THREE.Mesh(new THREE.CapsuleGeometry(mats.foreR, rel.length(), 6, 14), mats.sleeve), V(0, 0, 0), rel); elbow.add(fore);
    const hand = new THREE.Group(); hand.position.copy(rel); hand.rotation.y = -side * 0.35; elbow.add(hand);
    if (mats.cuff) { const cuff = new THREE.Mesh(new THREE.CylinderGeometry(mats.foreR * 1.05, mats.foreR * 1.05, 0.02, 14), mats.cuff); cuff.rotation.x = Math.PI / 2; cuff.position.z = -0.02; hand.add(cuff); }
    const palm = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.024, 0.08, 2, 0.01), mats.hand); palm.position.set(0, -0.005, 0.045); hand.add(palm);
    fingers.forEach(([x, len, ang], k) => {
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(mats.fingerR, len, 4, 8), mats.hand);
      f.rotation.x = Math.PI / 2 - 0.25; f.rotation.y = ang; f.position.set(x, -0.012, 0.085 + len / 2); hand.add(f);
      if (mats.knuckle && k < 4) { const kn = new THREE.Mesh(new THREE.SphereGeometry(mats.fingerR * 1.25, 8, 6), mats.knuckle); kn.position.set(x, -0.006, 0.085); hand.add(kn); }
    });
    return { group: g, elbow };
  }

  function buildVex() {
    const grp = new THREE.Group(); grp.position.set(-ANCHOR_X, 0, ANCHOR_Z);
    const [dc, dg] = canvas(512, 512);
    const paint = new THREE.MeshStandardMaterial({ color: 0xd6dbe1, metalness: 0.35, roughness: 1, roughnessMap: scratchMap(31, 0.36, 0.3) });
    const trim = new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.85, roughness: 0.38, roughnessMap: brushed });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x4fe3ff, toneMapped: false });
    // Chest decal sheet: serial, channel mark, hazard chevrons, panel seams and rivets.
    dg.fillStyle = "#d6dbe1"; dg.fillRect(0, 0, 512, 512);
    dg.strokeStyle = "rgba(20,24,30,0.55)"; dg.lineWidth = 3; dg.strokeRect(24, 24, 464, 464); dg.beginPath(); dg.moveTo(256, 24); dg.lineTo(256, 150); dg.stroke();
    dg.fillStyle = "#2a2f36"; for (let i = 0; i < 12; i++) { dg.beginPath(); dg.arc(40 + (i % 6) * 86, i < 6 ? 40 : 472, 5, 0, 7); dg.fill(); }
    dg.font = '800 54px "Barlow Condensed", Arial, sans-serif'; dg.fillStyle = "#1a1e24"; dg.fillText("VX-01", 320, 440);
    drawLogo(dg, 60, 350, 100, { text: true });
    for (let i = 0; i < 6; i++) { dg.fillStyle = i % 2 ? "#1a1e24" : "#f2b400"; dg.beginPath(); dg.moveTo(300 + i * 30, 470); dg.lineTo(330 + i * 30, 470); dg.lineTo(310 + i * 30, 500); dg.lineTo(280 + i * 30, 500); dg.fill(); }
    const decal = tex(dc, { aniso });
    const chestMat = paint.clone(); chestMat.map = decal;

    // Torso and abdomen: separate plates over a darker frame, so it reads as assembled.
    const frame = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.5, 0.21, 3, 0.05), trim); frame.position.y = 0.87; grp.add(frame);
    const torso = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.3, 0.24, 4, 0.06), paint); torso.position.y = 0.97; grp.add(torso);
    const chest = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.2, 0.03, 3, 0.012), chestMat); chest.position.set(0, 0.98, 0.118); chest.rotation.x = -0.04; grp.add(chest);
    for (let i = 0; i < 3; i++) { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.15 - i * 0.008, 0.15 - i * 0.008, 0.045, 24), i % 2 ? trim : paint); band.scale.z = 0.7; band.position.y = 0.8 - i * 0.052; grp.add(band); }
    // Suit-style lapels and a red tie plate: he is an anchor.
    [-1, 1].forEach((s) => { const lap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.012), trim); lap.position.set(s * 0.075, 1.0, 0.123); lap.rotation.z = s * 0.38; grp.add(lap); });
    const tieShape = new THREE.Shape(); tieShape.moveTo(-0.018, 0); tieShape.lineTo(0.018, 0); tieShape.lineTo(0.03, -0.17); tieShape.lineTo(0, -0.2); tieShape.lineTo(-0.03, -0.17); tieShape.lineTo(-0.018, 0);
    const tieMat = new THREE.MeshStandardMaterial({ color: 0xc21f2e, metalness: 0.3, roughness: 0.35 });
    const tie = new THREE.Mesh(new THREE.ExtrudeGeometry(tieShape, { depth: 0.008, bevelEnabled: false }), tieMat); tie.position.set(0, 1.105, 0.13); grp.add(tie);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.01, 24), eyeMat.clone()); core.rotation.x = Math.PI / 2; core.position.set(0.09, 1.03, 0.136); grp.add(core);
    const coreRing = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.006, 8, 24), chrome); coreRing.position.set(0.09, 1.03, 0.137); grp.add(coreRing);
    // Shoulders: ball joints under painted caps, bolted.
    [-1, 1].forEach((s) => {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), trim); ball.position.set(s * 0.225, 1.07, 0); grp.add(ball);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.082, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), paint); cap.position.set(s * 0.23, 1.075, 0); cap.rotation.z = -s * 0.5; grp.add(cap);
      for (let k = 0; k < 3; k++) { const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.006, 8), chrome); bolt.position.set(s * (0.2 + k * 0.02), 1.13 - k * 0.012, 0.05); bolt.rotation.x = Math.PI / 2; grp.add(bolt); }
    });
    const arms = [-1, 1].map((s) => arm(s, { sleeve: paint, joint: trim, hand: trim, knuckle: chrome, upperR: 0.042, foreR: 0.038, fingerR: 0.0085 }, [[-0.024, 0.05, 0.05], [-0.004, 0.056, 0], [0.016, 0.052, -0.04], [0.036, 0.034, -0.5 * s]]));
    arms.forEach((a) => grp.add(a.group));
    // Neck: a jointed column with two exposed pistons.
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.045, 0.1, 18), trim); neck.position.y = 1.17; grp.add(neck);
    [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.11, 8), chrome); p.position.set(s * 0.05, 1.18, 0.01); p.rotation.z = s * 0.15; grp.add(p); });
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 8, 24), chrome); collar.rotation.x = Math.PI / 2; collar.position.y = 1.13; grp.add(collar);

    const head = new THREE.Group(); head.position.set(0, 1.22, 0); head.rotation.order = "YXZ"; grp.add(head);
    const skull = new THREE.Mesh(new RoundedBoxGeometry(0.23, 0.25, 0.23, 5, 0.06), paint); skull.position.y = 0.14; head.add(skull);
    const crown = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.03, 0.2, 3, 0.012), trim); crown.position.y = 0.268; head.add(crown);
    const visor = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.2, 0.03, 4, 0.03), new THREE.MeshPhysicalMaterial({ color: 0x030507, roughness: 0.06, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03 }));
    visor.position.set(0, 0.13, 0.106); head.add(visor);
    const eyes = [-1, 1].map((s) => { const e = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.024, 0.006, 2, 0.008), eyeMat); e.position.set(s * 0.046, 0.165, 0.123); head.add(e); return e; });
    const brows = [-1, 1].map((s) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.005, 0.004), eyeMat); b.position.set(s * 0.046, 0.196, 0.123); b.material = eyeMat; head.add(b); return b; });
    const bars = [];
    for (let i = 0; i < 11; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.0065, 1, 0.004), eyeMat); b.position.set(-0.05 + i * 0.01, 0.075, 0.123); b.scale.y = 0.004; head.add(b); bars.push(b); }
    [-1, 1].forEach((s) => {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 24), trim); pod.rotation.z = Math.PI / 2; pod.position.set(s * 0.128, 0.15, 0); head.add(pod);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 6, 24), eyeMat); ring.rotation.y = Math.PI / 2; ring.position.set(s * 0.147, 0.15, 0); head.add(ring);
      for (let k = 0; k < 3; k++) { const vent = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.004, 0.05), blackMatte); vent.position.set(s * 0.147, 0.135 + k * 0.012, 0); head.add(vent); }
    });
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.12, 6), chrome); ant.position.set(-0.13, 0.24, -0.02); head.add(ant);
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xff2030, toneMapped: false });
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), tipMat); tip.position.set(-0.13, 0.305, -0.02); head.add(tip);
    const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.02, 8), blackMatte); mic.position.set(-0.07, 1.06, 0.14); grp.add(mic);
    grp.traverse((o) => { if (o.isMesh && o.material !== eyeMat) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(reg(grp, "NR-ANC-01", "AI Robot Vex (seated, head centre 1.36 m)"));
    return {
      who: "vex", grp, head, eyes, brows, bars, core, tip, arms, torso,
      mats: { paint, trim, eyeMat, tieMat, chestMat },
      setLook(l) {
        if (l.body) { paint.color.set(l.body); chestMat.color.set(l.body).multiplyScalar(1.02); }
        if (l.trim) trim.color.set(l.trim);
        if (l.eyes) { eyeMat.color.set(l.eyes); core.material.color.set(l.eyes); }
        if (l.tie) tieMat.color.set(l.tie);
      }
    };
  }

  // Joe's head: a sphere pushed into the classic big-cranium, narrow-chin alien shape.
  const JOE_R = 0.13;
  function joeDeform(v) {
    const n = v.clone().normalize();
    let x = v.x, y = v.y * 1.16, z = v.z;
    if (n.y < 0) { const t = Math.pow(-n.y, 1.25); x *= 1 - 0.5 * t; z *= 1 - 0.3 * t; y *= 1.08; }
    else { x *= 1.07 + 0.05 * n.y; z *= 1.04; y *= 1.02; }
    if (n.z < 0) z *= 1.1;
    return new THREE.Vector3(x, y, z);
  }
  function joeFrontZ(yRel) {
    // Surface depth at the face centre for a given height from the head centre (bisection on the deform).
    let best = 0, bd = 1e9;
    for (let a = -Math.PI / 2; a <= Math.PI / 2; a += 0.004) { const p = joeDeform(V(0, JOE_R * Math.sin(a), JOE_R * Math.cos(a))); const d = Math.abs(p.y - yRel); if (d < bd) { bd = d; best = p.z; } }
    return best;
  }

  function buildJoe() {
    const grp = new THREE.Group(); grp.position.set(ANCHOR_X, 0, ANCHOR_Z);
    const N = lite ? 256 : 512, n = noiseField(N, N, 77, [N / 3, 20, 3], [0.5, 0.3, 0.2]);
    const [sc, sg] = canvas(N, N); const img = sg.createImageData(N, N);
    for (let i = 0; i < N * N; i++) { const v = 0.88 + 0.2 * n[i]; img.data[i * 4] = 255 * v * 0.96; img.data[i * 4 + 1] = 255 * v; img.data[i * 4 + 2] = 255 * v * 0.94; img.data[i * 4 + 3] = 255; }
    sg.putImageData(img, 0, 0);
    const bump = tex(greyCanvas(N, N, (i) => n[i]), { srgb: false, aniso });
    const skin = new THREE.MeshPhysicalMaterial({ color: 0x7fa37a, map: tex(sc, { aniso }), roughness: 0.5, bumpMap: bump, bumpScale: 0.6, sheen: 0.5, sheenColor: new THREE.Color(0xd8f0d0), sheenRoughness: 0.5, clearcoat: 0.12, clearcoatRoughness: 0.4 });
    const fab = noiseField(N, N, 12, [8, 2], [0.6, 0.4]);
    const weave = tex(greyCanvas(N, N, (i) => 0.75 + 0.2 * fab[i] + 0.05 * (((i % N) + ((i / N) | 0)) % 4 < 2 ? 1 : 0)), { srgb: false, repeat: [4, 4], aniso });
    const suit = new THREE.MeshPhysicalMaterial({ color: 0x1e2533, roughness: 1, roughnessMap: weave, sheen: 0.35, sheenColor: new THREE.Color(0x2c3856), sheenRoughness: 0.7 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0xeef1f5, roughness: 0.7 });
    const tieMat = new THREE.MeshPhysicalMaterial({ color: 0x1f4fae, roughness: 0.35, sheen: 0.6, sheenColor: new THREE.Color(0x8fb0ff) });

    // Suit torso: a lathe profile squashed front-to-back, shoulder pads, lapels, shirt, tie, pocket square.
    const prof = [[0.15, 0.6], [0.175, 0.72], [0.185, 0.9], [0.19, 1.02], [0.17, 1.09], [0.1, 1.13], [0.05, 1.15]].map(([r, y]) => new THREE.Vector2(r, y));
    const torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), suit); torso.scale.set(1.22, 1, 0.62); grp.add(torso);
    [-1, 1].forEach((s) => { const pad = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 14), suit); pad.scale.set(1.1, 0.75, 0.95); pad.position.set(s * 0.2, 1.075, 0); grp.add(pad); });
    const shirtV = new THREE.Shape(); shirtV.moveTo(-0.065, 0); shirtV.lineTo(0.065, 0); shirtV.lineTo(0, -0.19); shirtV.lineTo(-0.065, 0);
    const shirtM = new THREE.Mesh(new THREE.ExtrudeGeometry(shirtV, { depth: 0.004, bevelEnabled: false }), shirt); shirtM.position.set(0, 1.12, 0.112); shirtM.rotation.x = -0.12; grp.add(shirtM);
    [-1, 1].forEach((s) => {
      const lap = new THREE.Shape(); lap.moveTo(0, 0); lap.lineTo(s * 0.06, 0.005); lap.lineTo(s * 0.085, -0.07); lap.lineTo(s * 0.055, -0.08); lap.lineTo(s * 0.01, -0.2); lap.lineTo(0, -0.2);
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(lap, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 }), suit); m.position.set(s * 0.06, 1.12, 0.113); m.rotation.x = -0.12; grp.add(m);
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.006), shirt); col.position.set(s * 0.028, 1.128, 0.118); col.rotation.z = s * 0.6; grp.add(col);
    });
    const tieShape = new THREE.Shape(); tieShape.moveTo(-0.014, 0); tieShape.lineTo(0.014, 0); tieShape.lineTo(0.026, -0.17); tieShape.lineTo(0, -0.195); tieShape.lineTo(-0.026, -0.17); tieShape.lineTo(-0.014, 0);
    const tie = new THREE.Mesh(new THREE.ExtrudeGeometry(tieShape, { depth: 0.008, bevelEnabled: false }), tieMat); tie.position.set(0, 1.105, 0.117); tie.rotation.x = -0.12; grp.add(tie);
    const knot = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.026, 0.014, 2, 0.006), tieMat); knot.position.set(0, 1.115, 0.12); grp.add(knot);
    const sq = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.018, 0.006), new THREE.MeshStandardMaterial({ color: 0xe11d2e, roughness: 0.6 })); sq.position.set(0.105, 1.03, 0.11); sq.rotation.y = 0.3; grp.add(sq);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.003, 16), chrome); pin.rotation.x = Math.PI / 2; pin.position.set(-0.105, 1.045, 0.114); grp.add(pin);
    const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.02, 8), blackMatte); mic.position.set(-0.07, 1.07, 0.123); grp.add(mic);
    const arms = [-1, 1].map((s) => arm(s, { sleeve: suit, hand: skin, cuff: shirt, upperR: 0.05, foreR: 0.045, fingerR: 0.0075 }, [[-0.02, 0.085, 0.08], [0.0, 0.095, 0], [0.02, 0.085, -0.08]]));
    arms.forEach((a) => grp.add(a.group));
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.11, 18), skin); neck.position.set(0, 1.18, -0.01); grp.add(neck);

    const head = new THREE.Group(); head.position.set(0, 1.21, -0.01); head.rotation.order = "YXZ"; grp.add(head);
    const HY = 0.15; // head centre above the pivot
    const sGeo = new THREE.SphereGeometry(JOE_R, lite ? 40 : 64, lite ? 30 : 48);
    const pos = sGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const p = joeDeform(V(pos.getX(i), pos.getY(i), pos.getZ(i))); pos.setXYZ(i, p.x, p.y, p.z); }
    sGeo.computeVertexNormals();
    const skull = new THREE.Mesh(sGeo, skin); skull.position.y = HY; head.add(skull);
    const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x07090b, roughness: 0.05, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.2 });
    const lidMat = skin;
    const eyes = [-1, 1].map((s) => {
      const yRel = 0.0, x = s * 0.05;
      const z = joeFrontZ(yRel) * Math.cos(Math.asin(Math.min(0.9, Math.abs(x) / (JOE_R * 1.1)))) - 0.004;
      const eg = new THREE.Group(); eg.position.set(x, HY + yRel, z); eg.rotation.set(0, s * 0.42, s * 0.42); head.add(eg);
      const e = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), eyeMat); e.scale.set(0.043, 0.023, 0.016); eg.add(e);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.0038, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); glint.position.set(-s * 0.012, 0.008, 0.013); eg.add(glint);
      const lid = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lidMat); lid.scale.set(0.046, 0.025, 0.019); lid.rotation.x = -1.6; eg.add(lid);
      return { g: eg, e, glint, lid, s };
    });
    [-1, 1].forEach((s) => { const n2 = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: 0x33412f, roughness: 0.8 })); n2.scale.set(0.0035, 0.0065, 0.003); n2.position.set(s * 0.008, HY - 0.05, joeFrontZ(-0.05) + 0.001); head.add(n2); });
    const mouthZ = joeFrontZ(-0.09);
    const mouth = new THREE.Group(); mouth.position.set(0, HY - 0.09, mouthZ - 0.002); head.add(mouth);
    const cavity = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshStandardMaterial({ color: 0x1a0708, roughness: 0.9 })); cavity.scale.set(0.02, 0.002, 0.006); mouth.add(cavity);
    const lipMat = new THREE.MeshPhysicalMaterial({ color: 0x6f8f6b, roughness: 0.4, sheen: 0.4, sheenColor: new THREE.Color(0xcfe8c8) });
    const upperLip = new THREE.Mesh(new THREE.CapsuleGeometry(0.0034, 0.034, 4, 8), lipMat); upperLip.rotation.z = Math.PI / 2; upperLip.position.set(0, 0.003, 0.002); mouth.add(upperLip);
    const lowerLip = new THREE.Mesh(new THREE.CapsuleGeometry(0.0038, 0.03, 4, 8), lipMat); lowerLip.rotation.z = Math.PI / 2; lowerLip.position.set(0, -0.003, 0.002); mouth.add(lowerLip);
    const chin = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), skin); chin.scale.set(0.02, 0.012, 0.007); chin.position.set(0, -0.022, -0.008); mouth.add(chin);
    grp.traverse((o) => { if (o.isMesh && !o.material.isMeshBasicMaterial) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(reg(grp, "NR-ANC-02", "Alien Joe (seated, head centre 1.36 m)"));
    return {
      who: "joe", grp, head, eyes, mouth, cavity, upperLip, lowerLip, chin, arms, torso,
      mats: { skin, suit, tieMat, eyeMat, lipMat },
      setLook(l) {
        if (l.skin) { skin.color.set(l.skin); lipMat.color.set(l.skin).multiplyScalar(0.8); }
        if (l.eyes) eyeMat.color.set(l.eyes);
        if (l.suit) suit.color.set(l.suit);
        if (l.tie) tieMat.color.set(l.tie);
      }
    };
  }

  const vex = buildVex(), joe = buildJoe();
  const anchors = { vex, joe };
  const anim = {};
  for (const a of [vex, joe]) anim[a.who] = { yaw: 0, pitch: 0, roll: 0, blinkAt: 1 + Math.random() * 3, blink: 0, sacc: V(0, 0, 0), saccAt: 0, gesture: 0, gestureAt: 2 + Math.random() * 3, level: 0, ph: Math.random() * 10 };

  // ---- cameras / shots ----
  const headPos = { vex: V(-ANCHOR_X, 1.37, ANCHOR_Z), joe: V(ANCHOR_X, 1.37, ANCHOR_Z) };
  const SHOTS = {
    wide: { pos: V(0, 2.05, 7.6), look: V(0, 1.35, -1.3), fov: 38, drift: V(0.5, 0.0, -0.4) },
    crane: { pos: V(-2.6, 3.9, 8.8), look: V(0, 1.2, -1), fov: 36, drift: V(2.6, -1.6, -1.6) },
    two: { pos: V(0, 1.46, 3.7), look: V(0, 1.2, -0.45), fov: 28, drift: V(0.12, 0, -0.3) },
    vex: { pos: V(-0.3, 1.4, 1.95), look: V(-ANCHOR_X, 1.25, ANCHOR_Z), fov: 20, drift: V(0.02, 0, -0.14) },
    joe: { pos: V(0.3, 1.4, 1.95), look: V(ANCHOR_X, 1.25, ANCHOR_Z), fov: 20, drift: V(-0.02, 0, -0.14) },
    vexX: { pos: V(0.75, 1.36, 1.85), look: V(-ANCHOR_X, 1.26, ANCHOR_Z), fov: 23, drift: V(-0.05, 0, -0.08) },
    joeX: { pos: V(-0.75, 1.36, 1.85), look: V(ANCHOR_X, 1.26, ANCHOR_Z), fov: 23, drift: V(0.05, 0, -0.08) },
    wall: { pos: V(2.6, 1.7, 3.3), look: V(-0.9, 1.65, -2.2), fov: 40, drift: V(-0.3, 0, -0.2) }
  };
  let shot = { name: "wide", t0: 0, dur: 12 };
  let camOverride = null;
  const SINGLES = new Set(["vex", "joe", "vexX", "joeX"]);
  function setShot(name, t, dur = 10) {
    if (!SHOTS[name]) name = "two";
    shot = { name, t0: t, dur: Math.max(3, dur) };
    const m = SINGLES.has(name) ? wallBlurTex : wallTex;
    if (wallMat.map !== m) { wallMat.map = m; wallMat.needsUpdate = true; }
  }
  function applyCamera(t) {
    if (camOverride) return;
    const s = SHOTS[shot.name], k = Math.min(1, (t - shot.t0) / (shot.dur + 4));
    const e = k * k * (3 - 2 * k);
    camera.position.copy(s.pos).addScaledVector(s.drift, e);
    camera.fov = s.fov;
    camera.updateProjectionMatrix();
    // A pedestal camera's tiny float: a few millimetres, so the frame never looks frozen.
    camera.position.x += Math.sin(t * 0.7) * 0.003; camera.position.y += Math.sin(t * 0.53 + 1) * 0.002;
    camera.lookAt(s.look);
  }

  // ---- per-frame animation ----
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
  let talker = null;
  function animateAnchor(a, st, t, dt, level, speaking) {
    const A = anim[a.who];
    A.level = level;
    // Where to look: the camera when talking to it on a single, the co-host when the co-host talks, otherwise the lens.
    const other = a.who === "vex" ? "joe" : "vex";
    let target;
    if (talker === other) target = headPos[other];
    else target = camera.position;
    a.head.getWorldPosition(tmpV);
    const d = target.clone().sub(tmpV);
    let yaw = Math.atan2(d.x, d.z), pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z));
    yaw = Math.max(-0.75, Math.min(0.75, yaw)); pitch = Math.max(-0.3, Math.min(0.3, pitch));
    yaw += Math.sin(t * 0.31 + A.ph) * 0.025 + Math.sin(t * 0.13 + A.ph * 2) * 0.02;
    pitch += Math.sin(t * 0.23 + A.ph) * 0.015;
    if (speaking) { pitch += Math.sin(t * 5.2 + A.ph) * 0.025 * level + level * 0.02; yaw += Math.sin(t * 1.7 + A.ph) * 0.02; }
    const k = 1 - Math.exp(-dt * (speaking ? 5 : 3));
    A.yaw += (yaw - A.yaw) * k; A.pitch += (pitch - A.pitch) * k;
    A.roll += ((speaking ? Math.sin(t * 0.9 + A.ph) * 0.04 : Math.sin(t * 0.4) * 0.015) - A.roll) * k;
    a.head.rotation.set(A.pitch, A.yaw, A.roll);
    // Blink every 2-6 s, 140 ms, sometimes a double.
    if (t > A.blinkAt) { A.blink = 1; A.blinkAt = t + 2 + Math.random() * 4 + (Math.random() < 0.15 ? -1.7 : 0); }
    A.blink = Math.max(0, A.blink - dt / 0.14);
    const lid = A.blink > 0 ? Math.sin(A.blink * Math.PI) : 0;
    if (t > A.saccAt) { A.sacc.set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 1.2, 0); A.saccAt = t + 0.6 + Math.random() * 2.2; }
    // Hands: an occasional small gesture while speaking.
    if (speaking && t > A.gestureAt) { A.gesture = 1; A.gestureAt = t + 3 + Math.random() * 4; }
    A.gesture = Math.max(0, A.gesture - dt / 1.6);
    const gz = Math.sin(A.gesture * Math.PI);
    a.arms[a.who === "vex" ? 1 : 0].elbow.rotation.x = -0.28 * gz;
    a.arms[a.who === "vex" ? 0 : 1].elbow.rotation.x = -0.05 * Math.max(0, Math.sin(t * 0.4 + A.ph));
    a.torso.scale.y = 1 + Math.sin(t * 1.5 + A.ph) * 0.006;
    if (a.who === "vex") {
      a.eyes.forEach((e, i) => { e.scale.y = Math.max(0.08, 1 - lid); e.position.x = (i ? 1 : -1) * 0.046 + A.sacc.x * 0.004; e.position.y = 0.165 + A.sacc.y * 0.003; });
      a.brows.forEach((b, i) => { b.position.y = 0.196 + level * 0.006; b.rotation.z = (i ? -1 : 1) * level * 0.12; });
      a.bars.forEach((b, i) => { const prof = Math.pow(Math.cos(((i - 5) / 5.5) * Math.PI / 2), 0.8); b.scale.y = 0.004 + level * 0.036 * prof * (0.65 + 0.35 * Math.sin(t * 23 + i * 1.7)); });
      a.core.material.color.copy(a.mats.eyeMat.color).multiplyScalar(0.6 + level * 1.4);
      a.tip.material.color.setHex(Math.sin(t * 3) > 0.6 ? 0xff2030 : 0x400508);
    } else {
      a.eyes.forEach((e) => { e.lid.rotation.x = -1.6 + lid * 3.15; e.glint.position.x = -e.s * 0.012 + A.sacc.x * 0.003; e.glint.position.y = 0.008 + A.sacc.y * 0.002; });
      a.cavity.scale.y = 0.002 + level * 0.011; a.cavity.scale.x = 0.02 - level * 0.004;
      a.lowerLip.position.y = -0.003 - level * 0.011; a.chin.position.y = -0.022 - level * 0.006;
      a.upperLip.position.y = 0.003 + level * 0.0015;
    }
  }

  // ---- post ----
  let composer = null, bloom = null;
  // Glow pass is opt-in (?bloom=1): on this set it washed the picture out, and the LEDs read fine without it.
  if (q.bloom === true) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(512, 288), 0.16, 0.3, 0.97);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  // ---- debug layer: grid + asset ID bubbles ----
  const grid = new THREE.GridHelper(20, 20, 0x5fb0ff, 0x224466); grid.position.y = 0.003; grid.visible = false; scene.add(grid);
  let debugEl = null, debugOn = false;
  function setDebug(on, el) { debugOn = !!on; grid.visible = debugOn; debugEl = el || debugEl; if (debugEl) { debugEl.hidden = !debugOn; if (!debugOn) debugEl.innerHTML = ""; } }
  function drawDebug(w, h) {
    if (!debugOn || !debugEl) return;
    const html = [];
    for (const a of assets) {
      a.getWorldPosition(tmpV); const p = tmpV.clone().project(camera);
      if (p.z > 1 || p.x < -1.1 || p.x > 1.1 || p.y < -1.1 || p.y > 1.1) continue;
      const info = a.userData.asset;
      html.push(`<div class="dbg" style="left:${((p.x + 1) / 2) * 100}%;top:${((1 - p.y) / 2) * 100}%"><b>${info.id}</b> ${info.name}<br>x ${tmpV.x.toFixed(2)} y ${tmpV.y.toFixed(2)} z ${tmpV.z.toFixed(2)} m · ${info.note}</div>`);
    }
    debugEl.innerHTML = html.join("");
    void w; void h; void tmpQ;
  }

  // ---- public ----
  let W = 0, H = 0;
  function resize(w, h) {
    W = Math.max(1, w | 0); H = Math.max(1, h | 0);
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    if (composer) { composer.setSize(W, H); composer.setPixelRatio(renderer.getPixelRatio()); }
  }
  let lastWallSweep = 0;
  function frame(t, dt, st) {
    talker = st.talker || null;
    animateAnchor(vex, st, t, dt, st.levels.vex || 0, talker === "vex");
    animateAnchor(joe, st, t, dt, st.levels.joe || 0, talker === "joe");
    globe.rotation.y = t * 0.18;
    wallGraphic.sweepTex.offset.x = -((t * 0.12) % 3) + 1.2;
    if (adPan) {
      // slow camera drift over the page: left to right and a little down, easing, over ~14 s
      const p = Math.min(1, (performance.now() - adPan.t0) / (adPan.reel ? 4200 : 14000)), e = p * p * (3 - 2 * p);
      wallTex.offset.set(0.16 * e, 0.16 * (1 - e * 0.6));
      if (adPan.reel && p >= 1 && wallSeg) { reelIdx += 1; drawWall(wallSeg); }   // next game in the reel
    }
    const now = new Date();
    if (now.getMinutes() !== lastClockMin) { lastClockMin = now.getMinutes(); drawClocks(now); }
    applyCamera(t);
    if (composer) composer.render(); else renderer.render(scene, camera);
    drawDebug(W, H);
    void lastWallSweep;
  }

  drawWall({ kind: "open", graphic: { kicker: "HEARTBEAT NEWS", title: "Tonight's news", bullets: [] } });
  drawClocks(new Date());

  return {
    renderer, scene, camera, anchors, SHOTS,
    resize, frame, setShot,
    setWall: (seg) => drawWall(seg),
    redrawText: () => { drawClocks(new Date()); },
    setLook: (who, look) => anchors[who] && anchors[who].setLook(look || {}),
    setDebug,
    setCameraOverride: (fn) => { camOverride = fn; },
    assets
  };
}
