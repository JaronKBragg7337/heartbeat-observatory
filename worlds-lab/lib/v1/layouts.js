// WORLDS LAB · lib v1 · layouts.js — terrains and map layouts.
// Each terrain returns { groundHeight, build(scene) } so a world can hand the
// height function to createWorld and then add the matching ground mesh.
// Plus layout helpers: ring plazas, street grids, boardwalks, paths.
// LIB FREEZE LAW: v1 files are frozen once worlds ship on them. Improvements go in lib/v2/.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";
import { grassTexture, sandTexture, snowTexture, waterTexture, asphaltTexture, paverTexture, plankTexture, mulberry32 } from "./textures.js";

const M = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.95, metalness: 0 }, extra));

// ---- tiny value-noise FBM (seeded, allocation-free) ----
function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 144665) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return (((h ^ (h >> 16)) >>> 0) / 4294967296);
}
function smooth(t) { return t * t * (3 - 2 * t); }
function vnoise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = smooth(x - ix), fz = smooth(z - iz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fz;
}
export function fbm(x, z, seed, octaves) {
  let v = 0, amp = 0.5, f = 1;
  const n = octaves || 3;
  for (let i = 0; i < n; i++) { v += vnoise(x * f, z * f, seed + i * 31) * amp; amp *= 0.5; f *= 2.1; }
  return v; // ~0..1
}

function makeGroundMesh(size, seg, groundHeight, colorFn, map) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = colorFn ? new Float32Array(pos.count * 3) : null;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = groundHeight(x, z);
    pos.setY(i, h);
    if (colors) {
      colorFn(x, z, h, c);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
  }
  geo.computeVertexNormals();
  if (colors) geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = colors
    ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })
    : new THREE.MeshStandardMaterial({ map, roughness: 0.95 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

// ---------- terrains ----------
export function flatland(opts) {
  const o = opts || {};
  const groundHeight = () => 0;
  return {
    groundHeight,
    build(scene) {
      const mesh = makeGroundMesh(o.size || 320, 16, groundHeight, null, o.map || grassTexture({ color: o.color || "#5f8f4e" }));
      scene.add(mesh);
      return mesh;
    },
  };
}

export function rollingHills(opts) {
  const o = opts || {};
  const seed = o.seed || 7337, amp = o.amp || 5, clearR = o.clearRadius || 16;
  const groundHeight = (x, z) => {
    const base = (fbm(x * 0.018, z * 0.018, seed, 3) - 0.5) * 2 * amp;
    const d = Math.hypot(x - (o.clearX || 0), z - (o.clearZ || 0));
    const k = smooth(Math.min(1, Math.max(0, (d - clearR) / 18)));
    return base * k;
  };
  return {
    groundHeight,
    build(scene) {
      const g1 = o.grass || "#5f8f4e", g2 = o.rock || "#8d8d86";
      const mesh = makeGroundMesh(o.size || 340, 72, groundHeight, (x, z, h, c) => {
        const t = Math.min(1, Math.max(0, h / amp));
        c.set(g1).lerp(new THREE.Color(g2), Math.max(0, t - 0.45) * 1.4);
        const v = 0.92 + fbm(x * 0.2, z * 0.2, seed + 9, 2) * 0.16;
        c.multiplyScalar(v);
      });
      scene.add(mesh);
      return mesh;
    },
  };
}

export function island(opts) {
  const o = opts || {};
  const seed = o.seed || 4242, R = o.r || 70, amp = o.amp || 6;
  const groundHeight = (x, z) => {
    const d = Math.hypot(x, z);
    const rim = smooth(Math.min(1, Math.max(0, (R - d) / (R * 0.55))));
    const hills = (fbm(x * 0.02, z * 0.02, seed, 3) - 0.35) * amp;
    return Math.max(-1.6, rim * (1.2 + Math.max(0, hills)) - 1.6 + rim * 1.6);
  };
  return {
    groundHeight, R,
    build(scene) {
      const sandC = new THREE.Color(o.sand || "#d9c08c");
      const grassC = new THREE.Color(o.grass || "#5f9f52");
      const mesh = makeGroundMesh(o.size || 360, 80, groundHeight, (x, z, h, c) => {
        if (h < 0.55) c.copy(sandC); else c.copy(grassC);
        c.multiplyScalar(0.9 + fbm(x * 0.3, z * 0.3, seed + 5, 2) * 0.2);
      });
      scene.add(mesh);
      // the sea: one big animated plane at y = -0.55
      const seaMat = new THREE.MeshStandardMaterial({ map: waterTexture({}), transparent: true, opacity: 0.93, roughness: 0.25 });
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), seaMat);
      sea.rotation.x = -Math.PI / 2; sea.position.y = -0.55;
      scene.add(sea);
      this.sea = sea; this.seaMat = seaMat;
      return mesh;
    },
    animateSea(kit) {
      const mat = this.seaMat;
      if (!mat) return;
      kit.addUpdate((dt, t) => { mat.map.offset.x = t * 0.008; mat.map.offset.y = Math.sin(t * 0.18) * 0.03; });
    },
  };
}

export function canyon(opts) {
  const o = opts || {};
  const seed = o.seed || 5151, amp = o.amp || 11, floorHalf = o.floorHalf || 12;
  const groundHeight = (x, z) => {
    // a walkable canyon floor along z, ridged walls on both sides
    const wall = smooth(Math.min(1, Math.max(0, (Math.abs(x) - floorHalf) / 26)));
    const ridge = Math.abs(fbm(x * 0.03, z * 0.03, seed, 3) - 0.5) * 2;
    return wall * (amp * 0.55 + ridge * amp) + (fbm(x * 0.06, z * 0.06, seed + 3, 2) - 0.5) * 0.8;
  };
  return {
    groundHeight,
    build(scene) {
      const low = new THREE.Color(o.floor || "#c8995e");
      const high = new THREE.Color(o.rock || "#a8553a");
      const mesh = makeGroundMesh(o.size || 360, 80, groundHeight, (x, z, h, c) => {
        c.copy(low).lerp(high, Math.min(1, h / amp));
        c.multiplyScalar(0.88 + fbm(x * 0.25, z * 0.25, seed + 8, 2) * 0.22);
      });
      scene.add(mesh);
      return mesh;
    },
  };
}

export function dunes(opts) {
  const o = opts || {};
  const seed = o.seed || 6066, amp = o.amp || 3.4;
  const groundHeight = (x, z) =>
    (Math.sin(x * 0.05 + Math.sin(z * 0.04) * 1.6) * 0.5 + 0.5) * amp * (0.5 + fbm(x * 0.02, z * 0.02, seed, 2) * 0.7);
  return {
    groundHeight,
    build(scene) {
      const mesh = makeGroundMesh(o.size || 340, 70, groundHeight, null, sandTexture({ repeat: [14, 14] }));
      scene.add(mesh);
      return mesh;
    },
  };
}

export function snowfield(opts) {
  const o = opts || {};
  const seed = o.seed || 9090, amp = o.amp || 3.2;
  const groundHeight = (x, z) => (fbm(x * 0.02, z * 0.02, seed, 3) - 0.45) * 2 * amp;
  return {
    groundHeight,
    build(scene) {
      const mesh = makeGroundMesh(o.size || 340, 70, groundHeight, null, snowTexture({ repeat: [12, 12] }));
      scene.add(mesh);
      return mesh;
    },
  };
}

export function craterField(opts) {
  const o = opts || {};
  const seed = o.seed || 3434;
  const rnd = mulberry32(seed);
  const craters = [];
  for (let i = 0; i < (o.craters || 9); i++) {
    craters.push({ x: (rnd() - 0.5) * 220, z: (rnd() - 0.5) * 220, r: 6 + rnd() * 14 });
  }
  const groundHeight = (x, z) => {
    let h = (fbm(x * 0.025, z * 0.025, seed, 3) - 0.5) * 3;
    for (let i = 0; i < craters.length; i++) {
      const c = craters[i];
      const d = Math.hypot(x - c.x, z - c.z) / c.r;
      if (d < 1.4) {
        const bowl = Math.max(-1, (d * d - 1)) * (c.r * 0.16);
        const rim = Math.max(0, 1 - Math.abs(d - 1) * 4) * (c.r * 0.07);
        h += bowl + rim;
      }
    }
    return h;
  };
  return {
    groundHeight,
    build(scene) {
      const base = new THREE.Color(o.color || "#b0563c");
      const mesh = makeGroundMesh(o.size || 340, 80, groundHeight, (x, z, h, c) => {
        c.copy(base).multiplyScalar(0.82 + fbm(x * 0.2, z * 0.2, seed + 4, 2) * 0.3);
      });
      scene.add(mesh);
      return mesh;
    },
  };
}

// ---------- layout pieces (placed slightly above the terrain) ----------
export function ringPlaza(kit, x, z, r) {
  const gy = kit.groundHeight(x, z);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshStandardMaterial({ map: paverTexture({ repeat: [r, r] }), roughness: 0.95 }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(x, gy + 0.045, z);
  kit.scene.add(disc);
  return disc;
}

export function roadStrip(kit, x1, z1, x2, z2, width, dash) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const mat = new THREE.MeshStandardMaterial({ map: asphaltTexture({ dash: dash !== false, repeat: [1, Math.max(1, Math.round(len / 7))] }), roughness: 0.98 });
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(width || 4, len), mat);
  strip.rotation.x = -Math.PI / 2;
  const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
  strip.position.set(mx, kit.groundHeight(mx, mz) + 0.04, mz);
  strip.rotation.z = Math.atan2(x2 - x1, z2 - z1);
  kit.scene.add(strip);
  return strip;
}

// a straight street grid; returns building lot centers around the blocks
export function gridStreets(kit, o) {
  const n = o.n || 3, m = o.m || 3, s = o.spacing || 18;
  const cx = o.x || 0, cz = o.z || 0;
  const w = (n - 1) * s, d = (m - 1) * s;
  for (let i = 0; i < n; i++) roadStrip(kit, cx - w / 2 + i * s, cz - d / 2 - s / 2, cx - w / 2 + i * s, cz + d / 2 + s / 2, 3.6);
  for (let j = 0; j < m; j++) roadStrip(kit, cx - w / 2 - s / 2, cz - d / 2 + j * s, cx + w / 2 + s / 2, cz - d / 2 + j * s, 3.6);
  const lots = [];
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < m - 1; j++) {
    lots.push({ x: cx - w / 2 + i * s + s / 2, z: cz - d / 2 + j * s + s / 2 });
  }
  return lots;
}

export function boardwalk(kit, x, z, len, rot, width) {
  const mat = new THREE.MeshStandardMaterial({ map: plankTexture({ wood: "#a8835c", repeat: [2, Math.max(2, Math.round(len / 3)) ] }), roughness: 0.95 });
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(width || 3, len), mat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(x, kit.groundHeight(x, z) + 0.12, z);
  deck.rotation.z = rot || 0;
  kit.scene.add(deck);
  return deck;
}

export function dirtPath(kit, points, width) {
  // a chain of flat strips following the terrain — cheap and readable
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, z1] = points[i], [x2, z2] = points[i + 1];
    const len = Math.hypot(x2 - x1, z2 - z1) + 0.6;
    const mat = M(0x9a8462, { roughness: 1 });
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(width || 2.2, len), mat);
    strip.rotation.x = -Math.PI / 2;
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
    strip.position.set(mx, kit.groundHeight(mx, mz) + 0.05, mz);
    strip.rotation.z = Math.atan2(x2 - x1, z2 - z1);
    kit.scene.add(strip);
  }
}
