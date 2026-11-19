// ============================================================================
// port/desert.js - the working desert north of Marineris Port: a haul road, a borrow area, a solar field, an ice well with its heated
// line back to the fuel farm, a weather and survey mast, and the place the first crew set down. And the people who work out there.
//
// OWNS: decoration only. Nothing here collides, is saved, or is known to the server. Port-local metres (x east, z south: the port's
//   heading is 0), every piece stood on the REAL ground (world/field.js through the port's frame), sampled when it is built.
// DOES NOT OWN: the port (portSystem.js), its people (portPeople.js: the same library and suits are used, read-only), the ground.
//
// WHERE (port-local x, z): everything is north and north-east of the port, the one side with ground a wheel can cross (west is the canyon
//   wall, east are the players' pads, south is the ships' way in). Ships leave over it, 150 m and more up.
//   road    gate (90, -90) -> borrow area -> solar field -> well -> first landing (455, -1290); 1.6 km, marker posts every 50 m
//   borrow  (164, -222)    spoil tip, stockpiles, a parked excavator
//   solar   (317, -267)    rows of 2 x 4 m panels tilted north (the port is at 14 S), a brush cart working one row
//   well    (407, -638)    drill derrick, pump house, three insulated tanks, the heated line on trestles to the fuel farm (57, -70)
//   mast    (508, -719)    15 m weather and survey mast on the rise east of the well, guyed, a red lamp on top
//   landing (464, -1302)   the descent stage of the first crew, half buried, roped off, with a plaque
//
// THE GROUND IS ROUGH (ten metres of relief in fifty) and nothing here can cut or fill it: the field is the shared world's, and a walker's
// feet are on the field. So nothing is levelled. The road and the well's yard are laid on the ground a hand deep and follow it; every
// structure stands on its own footing, set to the ground under it, with piers that go metres down so no slope shows a gap beneath.
// (Past about 440 m the game draws its terrain from a much coarser grid; a far cluster can sit a little high or low on it until you come near.)
//
// COST: one merged mesh per cluster (borrow, solar, well, mast, landing), one for the road, one for everything strung along the road and
// the pipe, one for every lamp lens, one for the night glow, one for the signs, one for the two beacons, and two small moving parts.
// Four materials. No lights. Built one piece a frame the first time the camera is within about 4 km, drawn within 3 km, people within
// the port's own people range. Nothing is allocated in the per-frame path.
// ============================================================================
import * as THREE from 'three';
import { getBody } from '../world/bodies.js';
import { surfaceRadiusFast } from '../world/field.js';
import { worldTimeS } from '../space/clock.js';
import { dressForWorld } from '../crew/suitPolicy.js';
import { beatPose } from './portPeople.js';

const BUILD_M = 4000, DRAW_M = 3000, PI = Math.PI, ROAD_STEPS = 8;
const MARS_AIR = { atmosphere: { surfacePressure: 610 }, surfaceGravity: 3.72076 };

// ---- the survey (see the header; found by walking the field's heights, flattest ground first) --------------------------------------
export const SITES = {
  gate: { x: 90, z: -90 }, borrow: { x: 164, z: -222 }, solar: { x: 317, z: -267 }, well: { x: 407, z: -638, hw: 15, hd: 11 },
  mast: { x: 508, z: -719 }, landing: { x: 464, z: -1302 },
};
const ROAD = [[90, -90], [100, -175], [140, -210], [180, -205], [195, -260], [265, -330], [245, -405], [350, -470], [385, -465], [405, -500], [460, -505],
  [437, -540], [432, -598], [429, -640], [418, -672], [305, -835], [340, -1000], [400, -1035], [415, -1155], [390, -1220], [425, -1295], [455, -1290]];
const PIPE = [[391, -633], [70, -175], [62, -100], [60, -80.5]];

const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const C = {
  fill: lin(0x74412b), fillDark: lin(0x673826), rut: lin(0x5a3122), dust: lin(0x8a4e33), ground: lin(0x6e3320), spoil: lin(0x7a4a34), gravel: lin(0x80685a),
  steel: lin(0x7c7f83), dark: lin(0x33363a), white: lin(0xcfcbc2), foil: lin(0xb9b5a8), yellow: lin(0xb8912f), orange: lin(0xc8642a), red: lin(0x9a3324),
  panel: lin(0x121a2b), alu: lin(0x9a9c9e), rubber: lin(0x1c1c1e), concrete: lin(0x8b8479), glass: lin(0x1b2733), gold: lin(0x8f7a45), rock: lin(0x5a3324), crate: lin(0x6f7a5c),
};
const LAMP = { amber: [1, 0.62, 0.2], white: [1, 0.93, 0.8], red: [1, 0.12, 0.08], green: [0.3, 1, 0.5] };

/** A hash of two integers to [0, 1). */
function h01(n, salt) {
  let x = (Math.imul(n | 0, 0x9E3779B1) ^ Math.imul(salt + 1, 0x85EBCA6B)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7FEB352D); x ^= x >>> 15; x = Math.imul(x, 0x846CA68B); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
const sm = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// ---- a small geometry builder: vertex colours, flat faces, one buffer per cluster ----------------------------------------------------
class Geo {
  constructor(dust = 0.3) { this.p = []; this.n = []; this.c = []; this.uv = null; this.i = []; this.m = null; this.stack = []; this.dust = dust; this._v = new THREE.Vector3(); this._nm = new THREE.Vector3(); }
  push(m) { this.stack.push(this.m); this.m = this.m ? this.m.clone().multiply(m) : m.clone(); return this; }
  /** a frame at (x, y, z), turned `yaw` about up, then tipped `pitch` (about x) and `roll` (about z) */
  at(x, y, z, yaw = 0, pitch = 0, roll = 0) { return this.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ')), new THREE.Vector3(1, 1, 1))); }
  pop() { this.m = this.stack.pop(); return this; }
  vert(x, y, z, nx, ny, nz, col, dust = this.dust) {
    const v = this._v.set(x, y, z), n = this._nm.set(nx, ny, nz);
    if (this.m) { v.applyMatrix4(this.m); n.transformDirection(this.m); }
    // dust lies on whatever faces the sky
    const k = n.y > 0.25 ? dust * Math.min(1, (n.y - 0.25) * 1.6) : dust * 0.25, D = C.dust;
    this.p.push(v.x, v.y, v.z); this.n.push(n.x, n.y, n.z); this.c.push(col[0] + (D[0] - col[0]) * k, col[1] + (D[1] - col[1]) * k, col[2] + (D[2] - col[2]) * k);
    return this.p.length / 3 - 1;
  }
  /** a flat four-sided face a, b, c, d (in order round it); the normal follows the winding, the material is two-sided */
  quad(a, b, c, d, col, dust) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const i = this.vert(a[0], a[1], a[2], nx, ny, nz, col, dust); this.vert(b[0], b[1], b[2], nx, ny, nz, col, dust); this.vert(c[0], c[1], c[2], nx, ny, nz, col, dust); this.vert(d[0], d[1], d[2], nx, ny, nz, col, dust);
    this.i.push(i, i + 1, i + 2, i, i + 2, i + 3); return this;
  }
  /** as quad, but the face is turned to look up (for ground laid by its corners) */
  top(a, b, c, d, col, dust) { const ux = b[0] - a[0], uz = b[2] - a[2], vx = d[0] - a[0], vz = d[2] - a[2]; return uz * vx - ux * vz >= 0 ? this.quad(a, b, c, d, col, dust) : this.quad(a, d, c, b, col, dust); }
  tri(a, b, c, col, dust) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const i = this.vert(a[0], a[1], a[2], nx, ny, nz, col, dust); this.vert(b[0], b[1], b[2], nx, ny, nz, col, dust); this.vert(c[0], c[1], c[2], nx, ny, nz, col, dust);
    this.i.push(i, i + 1, i + 2); return this;
  }
  /** a box about (cx, cy, cz), turned `yaw` about up */
  box(cx, cy, cz, w, h, d, col, yaw = 0, dust) {
    const c = Math.cos(yaw), s = Math.sin(yaw), P = (x, y, z) => [cx + x * c + z * s, cy + y, cz - x * s + z * c], a = w / 2, b = h / 2, e = d / 2;
    const v = [P(-a, -b, -e), P(a, -b, -e), P(a, -b, e), P(-a, -b, e), P(-a, b, -e), P(a, b, -e), P(a, b, e), P(-a, b, e)];
    this.quad(v[7], v[6], v[5], v[4], col, dust); this.quad(v[0], v[1], v[2], v[3], col, dust);
    this.quad(v[3], v[2], v[6], v[7], col, dust); this.quad(v[1], v[0], v[4], v[5], col, dust);
    this.quad(v[2], v[1], v[5], v[6], col, dust); this.quad(v[0], v[3], v[7], v[4], col, dust); return this;
  }
  /** a square bar from a to b, `w` across and `h` deep */
  beam(a, b, w, h, col, dust) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1, tx = dx / L, ty = dy / L, tz = dz / L;
    let sx, sy, sz; if (Math.abs(ty) > 0.95) { sx = 1; sy = 0; sz = 0; } else { const l = Math.hypot(tz, tx); sx = tz / l; sy = 0; sz = -tx / l; }                // side = t x up
    const ux = sy * tz - sz * ty, uy = sz * tx - sx * tz, uz = sx * ty - sy * tx, hw = w / 2, hh = h / 2;
    const P = (o, s, u) => [o[0] + sx * s + ux * u, o[1] + sy * s + uy * u, o[2] + sz * s + uz * u];
    const v = [P(a, -hw, -hh), P(a, hw, -hh), P(a, hw, hh), P(a, -hw, hh), P(b, -hw, -hh), P(b, hw, -hh), P(b, hw, hh), P(b, -hw, hh)];
    this.quad(v[0], v[1], v[5], v[4], col, dust); this.quad(v[1], v[2], v[6], v[5], col, dust); this.quad(v[2], v[3], v[7], v[6], col, dust); this.quad(v[3], v[0], v[4], v[7], col, dust);
    this.quad(v[3], v[2], v[1], v[0], col, dust); this.quad(v[4], v[5], v[6], v[7], col, dust); return this;
  }
  /** a round bar from a to b (radius r at a, r2 at b), smooth round it */
  tube(a, b, r, seg, col, r2 = r, caps = false, dust) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1, tx = dx / L, ty = dy / L, tz = dz / L;
    let sx, sy, sz; if (Math.abs(ty) > 0.95) { sx = 1; sy = 0; sz = 0; } else { const l = Math.hypot(tz, tx); sx = tz / l; sy = 0; sz = -tx / l; }
    const ux = sy * tz - sz * ty, uy = sz * tx - sx * tz, uz = sx * ty - sy * tx, base = this.p.length / 3;
    for (let k = 0; k <= seg; k++) { const q = k / seg * 2 * PI, cs = Math.cos(q), sn = Math.sin(q), nx = sx * cs + ux * sn, ny = sy * cs + uy * sn, nz = sz * cs + uz * sn;
      this.vert(a[0] + nx * r, a[1] + ny * r, a[2] + nz * r, nx, ny, nz, col, dust); this.vert(b[0] + nx * r2, b[1] + ny * r2, b[2] + nz * r2, nx, ny, nz, col, dust); }
    for (let k = 0; k < seg; k++) { const i = base + k * 2; this.i.push(i, i + 1, i + 3, i, i + 3, i + 2); }
    if (caps) for (const [o, rr, sg] of [[a, r, -1], [b, r2, 1]]) { const c0 = this.vert(o[0], o[1], o[2], tx * sg, ty * sg, tz * sg, col, dust);
      for (let k = 0; k <= seg; k++) { const q = k / seg * 2 * PI, cs = Math.cos(q), sn = Math.sin(q); this.vert(o[0] + (sx * cs + ux * sn) * rr, o[1] + (sy * cs + uy * sn) * rr, o[2] + (sz * cs + uz * sn) * rr, tx * sg, ty * sg, tz * sg, col, dust); }
      for (let k = 0; k < seg; k++) this.i.push(c0, c0 + 1 + k, c0 + 2 + k); }
    return this;
  }
  /** a ball (or, squashed, a boulder) */
  ball(cx, cy, cz, r, col, seg = 8, sy = 1, dust) {
    const rings = Math.max(3, seg >> 1), base = this.p.length / 3;
    for (let j = 0; j <= rings; j++) { const v = j / rings * PI, y = Math.cos(v), rr = Math.sin(v);
      for (let k = 0; k <= seg; k++) { const q = k / seg * 2 * PI, nx = rr * Math.cos(q), nz = rr * Math.sin(q); this.vert(cx + nx * r, cy + y * r * sy, cz + nz * r, nx, y, nz, col, dust); } }
    for (let j = 0; j < rings; j++) for (let k = 0; k < seg; k++) { const i = base + j * (seg + 1) + k; this.i.push(i, i + seg + 1, i + seg + 2, i, i + seg + 2, i + 1); }
    return this;
  }
  /** a quad that carries a tile of the sign atlas (uv rectangle u0, v0, u1, v1) */
  sign(a, b, c, d, uv) {
    if (!this.uv) this.uv = [];
    const i = this.p.length / 3; this.quad(a, b, c, d, [1, 1, 1], 0);
    this.uv[i * 2] = uv[0]; this.uv[i * 2 + 1] = uv[1]; this.uv[i * 2 + 2] = uv[2]; this.uv[i * 2 + 3] = uv[1]; this.uv[i * 2 + 4] = uv[2]; this.uv[i * 2 + 5] = uv[3]; this.uv[i * 2 + 6] = uv[0]; this.uv[i * 2 + 7] = uv[3];
    return this;
  }
  get tris() { return this.i.length / 3; }
  mesh(material, name, o = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    if (this.uv) { for (let i = 0; i < this.p.length / 3 * 2; i++) if (this.uv[i] === undefined) this.uv[i] = 0; g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); }
    else g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    const m = new THREE.Mesh(g, material); m.name = 'port-desert:' + name; m.castShadow = !!o.cast; m.receiveShadow = !!o.receive; m.matrixAutoUpdate = false;
    return m;
  }
}

/** A night glow on the ground or round a lamp: additive, bright in the middle, nothing at the rim (the port's own trick, portSystem.js `pool`). */
function glowPool(H, x, y, z, r, col, n = 10) {
  for (let i = 0; i < n; i++) { const a0 = i / n * 2 * PI, a1 = (i + 1) / n * 2 * PI, b = H.p.length / 3;
    H.p.push(x, y, z, x + Math.cos(a0) * r, y, z + Math.sin(a0) * r, x + Math.cos(a1) * r, y, z + Math.sin(a1) * r); H.n.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    H.c.push(col[0], col[1], col[2], 0, 0, 0, 0, 0, 0); H.i.push(b, b + 2, b + 1); }
}
/** The glow round a lamp in dusty air: two upright discs crossed, bright at the lamp, nothing at the rim. */
function glowHalo(H, x, y, z, r, col, n = 8) {
  for (const [ax, az] of [[1, 0], [0, 1]]) for (let i = 0; i < n; i++) { const a0 = i / n * 2 * PI, a1 = (i + 1) / n * 2 * PI, b = H.p.length / 3;
    H.p.push(x, y, z, x + ax * Math.cos(a0) * r, y + Math.sin(a0) * r, z + az * Math.cos(a0) * r, x + ax * Math.cos(a1) * r, y + Math.sin(a1) * r, z + az * Math.cos(a1) * r); H.n.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    H.c.push(col[0], col[1], col[2], 0, 0, 0, 0, 0, 0); H.i.push(b, b + 1, b + 2); }
}

// ---- the signs: one small atlas, six boards ------------------------------------------------------------------------------------------
const SIGN_TEXT = [
  { key: 'plaque', bg: '#5b5d5e', fg: '#e9e4d6', lines: [['FIRST LANDING', 46], ['Descent stage of the survey lander KESTREL.', 22], ['Set down here on 14 March 2041, crew of four.', 22], ['They stayed 61 sols and walked to the rim and back.', 22], ['Left as it stands. Please do not climb on it.', 22], ['Marineris Port Authority, 2068', 18]] },
  { key: 'gate', bg: '#2f4a3a', fg: '#f1ead8', lines: [['HAUL ROAD', 54], ['Solar field  0.4 km', 28], ['Ice well  0.8 km', 28], ['First landing  1.6 km', 28], ['No lights past the well. Carry air for the walk back.', 19]] },
  { key: 'well', bg: '#243a52', fg: '#f1ead8', lines: [['WATER WORKS 1', 52], ['Ice well, 212 m', 30], ['Heated line to the fuel farm.', 24], ['Hot pipe. Gloves on.', 24]] },
  { key: 'solar', bg: '#243a52', fg: '#f1ead8', lines: [['SOLAR FIELD B', 52], ['The brush cart works the rows by itself.', 23], ['Stand clear of the rail.', 23]] },
  { key: 'borrow', bg: '#6a4a1c', fg: '#f6ecd0', lines: [['BORROW AREA 2', 52], ['Fill for the road and the pads.', 24], ['Tip here only.', 24]] },
  { key: 'mast', bg: '#243a52', fg: '#f1ead8', lines: [['MAST M-3', 56], ['Weather and survey.', 26], ['Guy wires. Mind your visor.', 24]] },
];
function signAtlas(low) {
  const W = low ? 512 : 1024, tw = W / 2, th = W / 4, c = document.createElement('canvas'); c.width = W; c.height = th * 3; const g = c.getContext('2d'), uv = {}, k = W / 1024;
  SIGN_TEXT.forEach((s, i) => { const x = (i % 2) * tw, y = Math.floor(i / 2) * th;
    g.fillStyle = s.bg; g.fillRect(x, y, tw, th); g.strokeStyle = s.fg; g.globalAlpha = 0.55; g.lineWidth = 4 * k; g.strokeRect(x + 8 * k, y + 8 * k, tw - 16 * k, th - 16 * k); g.globalAlpha = 1;
    g.fillStyle = s.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const total = s.lines.reduce((n, l) => n + l[1] * 1.45, 0); let yy = y + (th - total * k) / 2;
    for (const [text, px] of s.lines) { g.font = `${px === s.lines[0][1] ? '700' : '500'} ${px * k}px system-ui, "Segoe UI", Helvetica, Arial, sans-serif`; yy += px * 0.725 * k; g.fillText(text, x + tw / 2, yy, tw - 36 * k); yy += px * 0.725 * k; }
    // years of dust in the corners
    const gr = g.createLinearGradient(0, y, 0, y + th); gr.addColorStop(0, 'rgba(138,78,51,0.05)'); gr.addColorStop(1, 'rgba(138,78,51,0.42)'); g.fillStyle = gr; g.fillRect(x, y, tw, th);
    uv[s.key] = [x / W, 1 - (y + th) / c.height, (x + tw) / W, 1 - y / c.height]; });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = low ? 2 : 4;
  return { tex, uv };
}

export class PortDesert {
  /** port: the built PortSystem (its engine, site and tier are all that is used; the people come later, from port.people). */
  constructor(port) {
    this.port = port; this.engine = port.engine; this.site = port.site; this.low = port.tier === 'low';
    this.root = new THREE.Group(); this.root.name = 'port-desert'; this.root.visible = false;
    this.engine.scene.add(this.root);
    this.entry = this.engine.track({ worldPos: this.site.center, quaternion: port.quaternion, object3d: this.root });
    this.enabled = true; this.active = false; this.built = false; this.clusters = []; this.people = []; this.peopleState = 0; this.clock = 0;
    this.buildMs = { total: 0, max: 0, steps: 0 }; this._cam = { x: 0, y: 0, z: 0 };
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.06, side: THREE.DoubleSide });
    // The road and the yard lie a hand above the true ground, but the terrain a little way off is drawn from a coarser grid and would swallow them in every
    // hollow. Their depth is written 0.6 percent nearer (6 cm at 10 m, 1.2 m at 200 m): enough to stay on top of the middle-distance ground, nothing up close.
    this.groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
    const nearer = (k) => (sh) => { const chunk = THREE.ShaderChunk.logdepthbuf_fragment; if (chunk && chunk.includes('log2( vFragDepth )')) sh.fragmentShader = sh.fragmentShader.replace('#include <logdepthbuf_fragment>', chunk.replace('log2( vFragDepth )', `log2( vFragDepth * ${k} )`)); };
    this.groundMat.onBeforeCompile = nearer('0.994'); this.groundMat.customProgramCacheKey = () => 'desert-nearer-994';
    this.lampMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide });
    this.blinkMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false });
    this.hazeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, opacity: 0 });
    this.hazeMat.onBeforeCompile = nearer('0.99'); this.hazeMat.customProgramCacheKey = () => 'desert-nearer-990';
    this.L = new Geo(0); this.H = new Geo(0); this.S = new Geo(0); this.line = new Geo(0.22);      // lamp lenses, night glow, sign faces, and everything strung along the road and the pipe
    this.steps = [() => { this.atlas = signAtlas(this.low); }, () => this.roadPrep(), () => this.buildPipeline(), () => this.buildBorrow(), () => this.buildSolar(), () => this.buildWell(), () => this.buildMast(), () => this.buildLanding(), ...Array.from({ length: ROAD_STEPS }, () => () => this.roadChunk()), () => this.finish()];
    this._tick = (dt) => this.update(dt);
    this.engine.addUpdater(this._tick);
  }

  /** The real ground under a port-local point, as port-local height. No allocation. */
  gy(x, z) {
    const s = this.site, c = s.center, R = s.right, U = s.up, B = s.back, body = this._body || (this._body = getBody(s.bodyId));
    let wx = c.x + R.x * x + B.x * z, wy = c.y + R.y * x + B.y * z, wz = c.z + R.z * x + B.z * z;
    const l = Math.hypot(wx, wy, wz), k = surfaceRadiusFast(body, wx / l, wy / l, wz / l) / l;
    wx = wx * k - c.x; wy = wy * k - c.y; wz = wz * k - c.z;
    return wx * U.x + wy * U.y + wz * U.z;
  }
  /** highest and lowest ground in a box (2 m grid) */
  span(x, z, hw, hd, o = {}) { let mn = 1e9, mx = -1e9; for (let a = -hw; a <= hw + 0.01; a += 2) for (let b = -hd; b <= hd + 0.01; b += 2) { const y = this.gy(x + a, z + b); if (y < mn) mn = y; if (y > mx) mx = y; } o.min = mn; o.max = mx; return o; }
  /** yaw, pitch and roll that lay a machine `len` long and `wid` wide on the ground at (x, z) heading `yaw` */
  lie(x, z, yaw, len, wid) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const pitch = Math.atan2(this.gy(x + fx * len / 2, z + fz * len / 2) - this.gy(x - fx * len / 2, z - fz * len / 2), len);
    const roll = Math.atan2(this.gy(x + rx * wid / 2, z + rz * wid / 2) - this.gy(x - rx * wid / 2, z - rz * wid / 2), wid);
    return { y: this.gy(x, z), yaw, pitch, roll };
  }
  cluster(name, geo, x, z, mat = this.mat) { const m = geo.mesh(mat, name, { cast: !this.low && mat === this.mat, receive: true }); m.visible = true; this.root.add(m); const c = { name, mesh: m, x, z, tris: geo.tris }; this.clusters.push(c); return c; }

  /** A worked yard: compacted fill a hand deep, laid on the ground as it lies (see the road: nothing here may be built up under a walker's feet). */
  yard(g, cx, cz, hw, hd, cell = 1.5) {
    const nx = Math.ceil(2 * hw / cell), nz = Math.ceil(2 * hd / cell), Y = [];
    for (let j = 0; j <= nz; j++) { const row = []; for (let i = 0; i <= nx; i++) { const x = cx - hw + 2 * hw * i / nx, z = cz - hd + 2 * hd * j / nz, edge = i === 0 || j === 0 || i === nx || j === nz; row.push([x, this.gy(x, z) + (edge ? -0.5 : 0.09), z]); } Y.push(row); }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) g.top(Y[j][i], Y[j][i + 1], Y[j + 1][i + 1], Y[j + 1][i], (i + j) % 5 === 0 ? C.fillDark : C.fill, 0.15 + 0.25 * h01(i, j));
  }
  /** The highest ground under a footprint: what a slab or a set of feet must be set to. */
  high(x, z, hw, hd) { return Math.max(this.gy(x, z), this.gy(x - hw, z - hd), this.gy(x + hw, z - hd), this.gy(x - hw, z + hd), this.gy(x + hw, z + hd)); }
  /** A concrete plinth: its top a hand above the highest ground under it, its sides far enough down that no slope shows under it. Returns the top. */
  plinth(g, x, z, w, d, yaw = 0) { const top = this.high(x, z, w / 2, d / 2) + 0.14; g.box(x, top - 1.6, z, w, 3.2, d, C.concrete, yaw, 0.35); return top; }
  /** a heap of loose material sitting on the ground: `r` across the foot, `h` high, rounded, a little uneven */
  heap(g, cx, cz, r, h, col, seed, seg = 12) {
    const rings = 5, cy = this.gy(cx, cz), P = [], base = g.p.length / 3;
    for (let j = 0; j < rings; j++) { const t = j / rings, row = []; for (let k = 0; k < seg; k++) { const a = k / seg * 2 * PI, rr = r * (1 - t) * (0.84 + 0.32 * h01(seed + k, 3)), x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr, gy = this.gy(x, z);
        row.push([x, j === 0 ? gy - 0.5 : gy + (cy - gy) * t + h * (1 - (1 - t) * (1 - t)) * (0.9 + 0.2 * h01(seed + k * 7, j)), z]); } P.push(row); }
    const apex = [cx, cy + h * 0.98, cz], at = (j, k) => (j >= rings ? apex : P[j][((k % seg) + seg) % seg]);
    for (let j = 0; j < rings; j++) for (let k = 0; k < seg; k++) { const a = at(j, k - 1), b = at(j, k + 1), c = at(Math.max(0, j - 1), k), d = at(j + 1, k);
      let nx = (b[1] - a[1]) * (d[2] - c[2]) - (b[2] - a[2]) * (d[1] - c[1]), ny = (b[2] - a[2]) * (d[0] - c[0]) - (b[0] - a[0]) * (d[2] - c[2]), nz = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]); if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; } const l = Math.hypot(nx, ny, nz) || 1;
      g.vert(P[j][k][0], P[j][k][1], P[j][k][2], nx / l, ny / l, nz / l, col, 0.15 + 0.2 * h01(seed + k, j + 20)); }
    const top = g.vert(apex[0], apex[1], apex[2], 0, 1, 0, col, 0.3);
    for (let j = 0; j < rings - 1; j++) for (let k = 0; k < seg; k++) { const i0 = base + j * seg + k, i1 = base + j * seg + (k + 1) % seg; g.i.push(i0, i0 + seg, i1 + seg, i0, i1 + seg, i1); }
    for (let k = 0; k < seg; k++) g.i.push(base + (rings - 1) * seg + k, top, base + (rings - 1) * seg + (k + 1) % seg);
  }
  rocks(g, x, z, n, r, seed) { for (let i = 0; i < n; i++) { const a = h01(seed, i) * 2 * PI, d = r * Math.sqrt(h01(seed, i + 40)), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, s = 0.12 + 0.3 * h01(seed, i + 80); g.ball(px, this.gy(px, pz) + s * 0.25, pz, s, C.rock, 5, 0.6, 0.35); } }
  /** a cairn: stones piled by hand */
  cairn(g, x, z, seed) { const y = this.gy(x, z); let r = 0.34, h = 0; for (let i = 0; i < 5; i++) { const s = r * (0.9 + 0.2 * h01(seed, i)); g.ball(x + (h01(seed, i + 5) - 0.5) * 0.12, y + h + s * 0.45, z + (h01(seed, i + 9) - 0.5) * 0.12, s, C.rock, 5, 0.62, 0.3); h += s * 0.85; r *= 0.8; } }
  /** a claim stake: a thin post, a tag, a reflective band */
  stake(g, x, z, seed) { const y = this.gy(x, z), lean = (h01(seed, 1) - 0.5) * 0.16; g.beam([x, y - 0.6, z], [x + lean, y + 1.25, z + lean * 0.5], 0.035, 0.035, C.white, 0.2); g.box(x + lean + 0.09, y + 1.12, z + lean * 0.5, 0.18, 0.12, 0.012, C.orange, h01(seed, 2) * 3, 0.15);
    this.L.box(x + lean * 0.8, y + 0.98, z + lean * 0.4, 0.05, 0.05, 0.05, LAMP.amber); }
  /** a sign board on two posts, facing `yaw` (the way its face looks) */
  board(g, x, z, yaw, key, w = 1.7, h = 0.85, base = 1.1) {
    const y = this.gy(x, z), c = Math.cos(yaw), s = Math.sin(yaw), uv = this.atlas.uv[key];
    for (const e of [-1, 1]) g.beam([x + c * e * (w / 2 - 0.1), y - 1.2, z - s * e * (w / 2 - 0.1)], [x + c * e * (w / 2 - 0.1), y + base + h, z - s * e * (w / 2 - 0.1)], 0.07, 0.07, C.steel);
    g.box(x - s * 0.04, y + base + h / 2, z - c * 0.04, w, h, 0.03, C.dark, yaw, 0.1);
    const fx = x + s * 0.045 - s * 0.04 + s * 0.02, fz = z + c * 0.045 - c * 0.04 + c * 0.02, P = (e, v) => [fx + c * e * w / 2, y + base + v * h, fz - s * e * w / 2];
    this.S.sign(P(-1, 0), P(1, 0), P(1, 1), P(-1, 1), uv);
  }
  /** Lamp light lying on the ground at night: a glow that follows the ground, brightest under the lamp, nothing at the rim. */
  pool(x, z, r, col, n = 10) {
    const H = this.H, b = H.p.length / 3, up = 0.16; H.p.push(x, this.gy(x, z) + up, z); H.n.push(0, 1, 0); H.c.push(col[0], col[1], col[2]);
    for (const [f, k] of [[0.45, 0.5], [1, 0]]) for (let i = 0; i < n; i++) { const a = i / n * 2 * PI, px = x + Math.cos(a) * r * f, pz = z + Math.sin(a) * r * f; H.p.push(px, this.gy(px, pz) + up, pz); H.n.push(0, 1, 0); H.c.push(col[0] * k, col[1] * k, col[2] * k); }
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; H.i.push(b, b + 1 + i, b + 1 + j, b + 1 + i, b + 1 + n + i, b + 1 + n + j, b + 1 + i, b + 1 + n + j, b + 1 + j); }
  }
  /** a lamp on a post: a lens that reads lit, a halo and a pool on the ground at night (no light) */
  lampPost(g, x, y, z, h, col = LAMP.white, poolR = 9) {
    g.tube([x, y - 1.5, z], [x, y + h, z], 0.06, 6, C.steel, 0.045); g.box(x, y + h + 0.05, z, 0.5, 0.1, 0.26, C.dark);
    this.L.box(x, y + h - 0.02, z, 0.4, 0.05, 0.18, col); glowHalo(this.H, x, y + h - 0.1, z, 1.2, [col[0] * 0.17, col[1] * 0.17, col[2] * 0.17], 10); this.pool(x, z, poolR, [col[0] * 0.13, col[1] * 0.12, col[2] * 0.09]);
  }

  // ---- the road ------------------------------------------------------------------------------------------------------------------------
  // Laid ON the ground, a hand above it, following it across its width as well as along it: a player's feet are on the real ground (the
  // field), so a bed built up on fill would have them wading through it. Built over a few frames (it is the one long thing here).
  roadPrep() {
    const step = this.low ? 2.5 : 2, P = [];
    // the surveyed line, rounded (Catmull-Rom), every `step` metres
    for (let i = 0; i < ROAD.length - 1; i++) { const p0 = ROAD[Math.max(0, i - 1)], p1 = ROAD[i], p2 = ROAD[i + 1], p3 = ROAD[Math.min(ROAD.length - 1, i + 2)], n = Math.max(1, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t, q = [0, 0]; for (const a of [0, 1]) q[a] = 0.5 * (2 * p1[a] + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3); P.push(q); } }
    P.push(ROAD[ROAD.length - 1].slice());
    const N = P.length, px = new Float32Array(N), pz = new Float32Array(N), sAt = new Float32Array(N);
    for (let i = 0; i < N; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(N - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; px[i] = -(b[1] - a[1]) / l; pz[i] = (b[0] - a[0]) / l;
      sAt[i] = i ? sAt[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]) : 0; }
    this.roadLen = sAt[N - 1];
    this._road = { g: new Geo(0.25), P, px, pz, sAt, N, i: 0, prev: null, per: Math.ceil(N / ROAD_STEPS) };
  }
  roadChunk() {
    const R = this._road, { g, P, px, pz, N } = R, HW = 2.4, LIFT = 0.12;
    // cross-section: shoulder foot, edge, rut, crown, rut, edge, shoulder foot: every point on its own ground
    const X = [-HW - 1.5, -HW, -1.2, -0.72, 0.72, 1.2, HW, HW + 1.5], DY = [-0.85, LIFT - 0.04, LIFT, LIFT - 0.04, LIFT - 0.04, LIFT, LIFT - 0.04, -0.85], COL = [C.fillDark, C.fill, C.rut, C.fill, C.rut, C.fill, C.fillDark];
    const end = Math.min(N, R.i + R.per + 1);
    for (let i = R.i; i < end; i++) { const row = []; for (let k = 0; k < 8; k++) { const x = P[i][0] + px[i] * X[k], z = P[i][1] + pz[i] * X[k]; row.push([x, this.gy(x, z) + DY[k], z]); }
      if (R.prev) for (let k = 0; k < 7; k++) g.top(R.prev[k], R.prev[k + 1], row[k + 1], row[k], COL[k], k === 2 || k === 4 ? 0.05 : k === 0 || k === 6 ? 0.45 : 0.2 + 0.12 * h01(i, k));
      R.prev = row; }
    R.i = end; if (end < N) return;
    this.roadFinish();
  }
  roadFinish() {
    const { P, px, pz, sAt, N } = this._road, HW = 2.4, len = this.roadLen, g = this.line;
    const at = (s, o) => { let i = 0; while (i < N - 2 && sAt[i + 1] < s) i++; const f = Math.max(0, Math.min(1, (s - sAt[i]) / ((sAt[i + 1] - sAt[i]) || 1))); o.x = P[i][0] + (P[i + 1][0] - P[i][0]) * f; o.z = P[i][1] + (P[i + 1][1] - P[i][1]) * f; o.px = px[i]; o.pz = pz[i]; return o; };
    const o = {}; this.roadAt = (s) => at(s, {});
    // marker posts every 50 m, left and right by turns: white, a reflective band that glows faintly at night
    for (let s = 25, n = 0; s < len - 5; s += this.low ? 100 : 50, n++) { at(s, o); const side = n & 1 ? 1 : -1, x = o.x + o.px * side * (HW + 0.5), z = o.z + o.pz * side * (HW + 0.5), y = this.gy(x, z);
      g.box(x, y + 0.1, z, 0.09, 2.2, 0.09, C.white, Math.atan2(o.px, o.pz), 0.15); this.L.box(x, y + 1.02, z, 0.1, 0.16, 0.1, LAMP.amber); glowHalo(this.H, x, y + 1.02, z, 0.32, [0.2, 0.12, 0.04], 6); }
    // the gate: two tall posts with lamps, and the board
    { at(3, o); for (const side of [-1, 1]) { const x = o.x + o.px * side * (HW + 0.9), z = o.z + o.pz * side * (HW + 0.9), y = this.gy(x, z); g.tube([x, y - 1, z], [x, y + 2.6, z], 0.07, 6, C.yellow); for (let k = 0; k < 3; k++) g.tube([x, y + 0.5 + k * 0.7, z], [x, y + 0.75 + k * 0.7, z], 0.075, 6, C.dark);
        this.L.box(x, y + 2.68, z, 0.16, 0.14, 0.16, LAMP.amber); glowHalo(this.H, x, y + 2.68, z, 0.7, [0.22, 0.13, 0.05], 10); this.pool(x, z, 4, [0.09, 0.055, 0.02], 8); }
      at(14, o); this.board(g, o.x + o.px * (HW + 2.4), o.z + o.pz * (HW + 2.4), Math.atan2(-o.pz, o.px) - 0.35, 'gate', 2.2, 1.1, 1.2); }
    // cairns and claim stakes along the way, a few stones by the shoulders
    for (let s = 110, n = 0; s < len - 30; s += this.low ? 230 : 140, n++) { at(s, o); const side = n & 1 ? -1 : 1, d = 6 + 5 * h01(n, 3), x = o.x + o.px * side * d, z = o.z + o.pz * side * d;
      if (n % 3 === 1) this.cairn(g, x, z, n); else this.stake(g, x, z, n); this.rocks(g, o.x - o.px * side * 5, o.z - o.pz * side * 5, 3, 2.5, n + 50); }
    this.cluster('road', this._road.g, 300, -650, this.groundMat); this.cluster('line', g, 300, -650); this._road = null; this.line = null;
  }

  // ---- the heated line -----------------------------------------------------------------------------------------------------------------
  buildPipeline() {
    const g = this.line, SP = 10, pts = [], seg = this.low ? 5 : 7;
    for (let i = 0; i < PIPE.length - 1; i++) { const a = PIPE[i], b = PIPE[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / SP)); for (let k = 0; k < n; k++) pts.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
    pts.push(PIPE[PIPE.length - 1].slice());
    const N = pts.length, top = new Float32Array(N), gnd = new Float32Array(N);
    for (let i = 0; i < N; i++) { const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)]; gnd[i] = this.gy(p[0], p[1]);
      top[i] = Math.max(gnd[i], this.gy((p[0] + a[0]) / 2, (p[1] + a[1]) / 2), this.gy((p[0] + b[0]) / 2, (p[1] + b[1]) / 2), this.gy(p[0] * 0.75 + a[0] * 0.25, p[1] * 0.75 + a[1] * 0.25), this.gy(p[0] * 0.75 + b[0] * 0.25, p[1] * 0.75 + b[1] * 0.25)) + 1.0; }
    for (let pass = 0; pass < 2; pass++) for (let i = 1; i < N - 1; i++) top[i] = Math.max(top[i], (top[i - 1] + top[i + 1]) / 2 - 0.4);      // no sharp dips: a pipe does not bend like the ground
    for (let i = 0; i < N; i++) { const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, sx = -(b[1] - a[1]) / l, sz = (b[0] - a[0]) / l, y = top[i];
      // a trestle: two splayed legs deep into the ground, a saddle, and now and then the heat-trace box with its lamp
      for (const e of [-1, 1]) g.beam([p[0] + sx * e * 0.22, y - 0.2, p[1] + sz * e * 0.22], [p[0] + sx * e * (0.5 + (y - gnd[i]) * 0.12), gnd[i] - 2.5, p[1] + sz * e * (0.5 + (y - gnd[i]) * 0.12)], 0.08, 0.08, C.steel);
      g.beam([p[0] - sx * 0.34, y - 0.22, p[1] - sz * 0.34], [p[0] + sx * 0.34, y - 0.22, p[1] + sz * 0.34], 0.12, 0.08, C.steel);
      if (i % (this.low ? 10 : 5) === 2) { g.box(p[0] + sx * 0.3, y - 0.02, p[1] + sz * 0.3, 0.22, 0.3, 0.16, C.dark, Math.atan2(sx, sz)); this.L.box(p[0] + sx * 0.3, y + 0.16, p[1] + sz * 0.3, 0.07, 0.05, 0.07, LAMP.amber); glowHalo(this.H, p[0] + sx * 0.3, y + 0.16, p[1] + sz * 0.3, 0.28, [0.18, 0.11, 0.04], 6); }
      if (i < N - 1) { const q = pts[i + 1]; g.tube([p[0], y, p[1]], [q[0], top[i + 1], q[1]], 0.17, seg, i % 7 === 3 ? C.orange : C.foil); g.tube([p[0], y, p[1]], [p[0] + (q[0] - p[0]) * 0.03, y + (top[i + 1] - y) * 0.03, p[1] + (q[1] - p[1]) * 0.03], 0.2, seg, C.steel); } }
    // at the farm: down to a valve box against the tanks' north side
    { const e = pts[N - 1], y = top[N - 1]; g.tube([e[0], y, e[1]], [e[0], 0.5, e[1] + 1.6], 0.17, seg, C.foil); g.box(e[0], 0.45, e[1] + 2.4, 1.1, 0.9, 1.3, C.steel, 0, 0.3); g.tube([e[0] - 0.3, 0.9, e[1] + 2.4], [e[0] - 0.3, 1.25, e[1] + 2.4], 0.05, 6, C.red); g.tube([e[0] - 0.3, 1.25, e[1] + 2.25], [e[0] - 0.3, 1.25, e[1] + 2.55], 0.14, 8, C.red, 0.14, true);
      this.L.box(e[0] + 0.35, 0.93, e[1] + 2.4, 0.08, 0.06, 0.08, LAMP.green); }
    this.pipe = { pts, top, n: N };
  }

  // ---- the borrow area -----------------------------------------------------------------------------------------------------------------
  buildBorrow() {
    const S = SITES.borrow, g = new Geo(0.3);
    this.heap(g, S.x + 9, S.z - 7, 9, 4.2, C.spoil, 11, this.low ? 10 : 14); this.heap(g, S.x + 19, S.z + 2, 5.5, 2.3, C.spoil, 12, 10); this.heap(g, S.x - 2, S.z - 15, 4, 1.7, C.gravel, 13, 9); this.heap(g, S.x + 4, S.z + 9, 3.2, 1.3, C.gravel, 14, 9);
    this.rocks(g, S.x + 2, S.z - 2, this.low ? 8 : 16, 14, 31);
    // the excavator: tracks, a turning house with the cab on the left, boom, stick and a bucket resting on the ground
    { const x = S.x - 7, z = S.z + 3, f = this.lie(x, z, 2.2, 4.2, 2.8); g.at(x, f.y, z, f.yaw, f.pitch, f.roll);
      for (const e of [-1, 1]) { g.box(e * 1.25, 0.42, 0, 0.6, 0.66, 3.6, C.rubber, 0, 0.5); g.tube([e * 1.25 - 0.3, 0.42, -1.8], [e * 1.25 + 0.3, 0.42, -1.8], 0.42, 8, C.rubber, 0.42, true, 0.5); g.tube([e * 1.25 - 0.3, 0.42, 1.8], [e * 1.25 + 0.3, 0.42, 1.8], 0.42, 8, C.rubber, 0.42, true, 0.5);
        for (let k = -2; k <= 2; k++) g.tube([e * 1.56, 0.34, k * 0.75], [e * 1.6, 0.34, k * 0.75], 0.2, 6, C.steel, 0.2, true); }
      g.box(0, 0.62, 0, 2.0, 0.3, 2.6, C.dark); g.tube([0, 0.75, 0], [0, 1.0, 0], 0.7, 10, C.dark);
      g.at(0, 1.0, 0, -0.5);
      g.box(0, 0.62, 0.55, 2.5, 1.2, 3.3, C.yellow, 0, 0.35); g.box(0, 0.5, 2.0, 2.4, 0.9, 0.5, C.dark);                                   // house, counterweight
      g.box(-0.72, 1.5, -0.75, 1.0, 1.5, 1.3, C.yellow, 0, 0.3); g.box(-0.72, 1.62, -1.41, 0.86, 0.9, 0.02, C.glass, 0, 0.1); g.box(-1.225, 1.62, -0.75, 0.02, 0.9, 1.0, C.glass, 0, 0.1);   // cab
      g.box(0.62, 1.3, 0.4, 0.9, 0.16, 1.8, C.dark); for (let k = 0; k < 4; k++) g.box(0.62, 1.4, -0.3 + k * 0.45, 0.8, 0.03, 0.08, C.steel);
      const b0 = [0.35, 0.9, -1.0], b1 = [0.35, 3.9, -3.6], b2 = [0.35, 0.95, -5.6];
      g.beam(b0, b1, 0.34, 0.46, C.yellow, 0.3); g.beam(b1, b2, 0.26, 0.36, C.yellow, 0.3); g.tube([0.35, 1.0, -1.7], [0.35, 2.7, -2.75], 0.07, 6, C.alu); g.tube([0.35, 3.9, -3.2], [0.35, 3.0, -4.35], 0.06, 6, C.alu);
      g.tube([0.0, 3.9, -3.6], [0.7, 3.9, -3.6], 0.12, 6, C.dark, 0.12, true);
      g.box(0.35, 0.5, -5.75, 0.95, 0.75, 0.7, C.dark, 0, 0.5); for (let k = -1; k <= 1; k++) g.box(0.35 + k * 0.32, 0.12, -6.08, 0.1, 0.22, 0.14, C.steel);
      this.L.box(-0.72, 2.3, -0.75, 0.16, 0.08, 0.16, LAMP.amber);
      g.pop(); g.pop(); }
    // a tipping skip left by the heap, cones, the board
    { const x = S.x - 12, z = S.z - 9, f = this.lie(x, z, 0.9, 3, 1.8); g.at(x, f.y, z, f.yaw, f.pitch, f.roll); g.box(0, 0.75, 0, 1.7, 0.9, 2.6, C.orange, 0, 0.45); g.box(0, 1.16, 0, 1.5, 0.1, 2.4, C.spoil, 0, 0.6);
      for (const e of [-1, 1]) for (const zz of [-0.8, 0.8]) g.tube([e * 0.8, 0.3, zz], [e * 0.98, 0.3, zz], 0.3, 8, C.rubber, 0.3, true, 0.5); g.beam([0, 0.4, -1.3], [0, 0.3, -2.3], 0.08, 0.08, C.steel); g.pop(); }
    for (let k = 0; k < 4; k++) { const x = S.x - 4 + k * 2.3, z = S.z + 14 + (k & 1) * 0.5, y = this.gy(x, z); g.tube([x, y - 0.05, z], [x, y + 0.6, z], 0.17, 6, C.orange, 0.04); g.box(x, y + 0.02, z, 0.42, 0.05, 0.42, C.dark); this.L.box(x, y + 0.42, z, 0.19, 0.07, 0.19, LAMP.white); }
    this.board(g, S.x - 16, S.z + 12, -1.9, 'borrow');
    this.cluster('borrow', g, S.x, S.z);
  }

  // ---- the solar field -----------------------------------------------------------------------------------------------------------------
  buildSolar() {
    const S = SITES.solar, g = new Geo(0.3), rows = this.low ? 5 : 7, cols = this.low ? 9 : 14, PX = 4.6, PZ = 6, tilt = 15 * PI / 180, ct = Math.cos(tilt), st = Math.sin(tilt);
    const x0 = S.x - (cols - 1) * PX / 2, z0 = S.z - (rows - 1) * PZ / 2, heights = [];
    for (let r = 0; r < rows; r++) { const hs = new Float32Array(cols); heights.push(hs);
      for (let c = 0; c < cols; c++) { const x = x0 + c * PX, z = z0 + r * PZ, n = r * 31 + c, gy = Math.max(this.gy(x, z), this.gy(x - 1.6, z - 0.9), this.gy(x + 1.6, z - 0.9), this.gy(x - 1.6, z + 0.9), this.gy(x + 1.6, z + 0.9)), y = gy + 1.35; hs[c] = y;
        for (const e of [-1, 1]) { g.beam([x + e * 1.4, y - 0.05, z], [x + e * 1.4, gy - 2.6, z], 0.09, 0.09, C.steel); g.beam([x + e * 1.4, y - 0.1, z - 0.8], [x + e * 1.4, y - 0.1, z + 0.8], 0.06, 0.1, C.steel); }
        if (h01(n, 1) < 0.04) continue;                                                                                                       // a table waiting for its panel
        const stow = h01(n, 2) < 0.05 ? 0.02 : tilt, c2 = Math.cos(stow), s2 = Math.sin(stow), dust = 0.18 + 0.55 * h01(n, 3) * (r === 2 ? 0.35 : 1);
        g.at(x, y, z, 0, 0, 0); const P = (a, b, u) => [a, -b * s2 + u * c2, -b * c2 - u * s2 + 0];                                         // b: metres up the slope (north edge is the low one), u: off the glass
        // the low edge faces north (-z): the Sun stands in the north here
        const q = (b0, b1, a0, a1, u, col, d) => g.top(P(a0, b0, u), P(a1, b0, u), P(a1, b1, u), P(a0, b1, u), col, d);
        q(1, -1, -2, 2, 0.05, C.panel, dust); q(1, -1, -2, 2, 0, C.alu, 0.1);
        g.quad(P(-2, -1, 0), P(2, -1, 0), P(2, -1, 0.05), P(-2, -1, 0.05), C.alu, 0.1); g.quad(P(-2, 1, 0), P(2, 1, 0), P(2, 1, 0.05), P(-2, 1, 0.05), C.alu, 0.1);
        g.quad(P(-2, -1, 0), P(-2, 1, 0), P(-2, 1, 0.05), P(-2, -1, 0.05), C.alu, 0.1); g.quad(P(2, -1, 0), P(2, 1, 0), P(2, 1, 0.05), P(2, -1, 0.05), C.alu, 0.1);
        g.pop(); } }
    // the combiner house and its cable run toward the port, the board
    { const x = x0 - 6, z = z0 + (rows - 1) * PZ + 3, top = this.plinth(g, x, z, 3.6, 2.8); g.box(x, top + 1.05, z, 3.2, 2.1, 2.4, C.white, 0, 0.3); g.box(x, top + 2.15, z, 3.4, 0.1, 2.6, C.steel); g.box(x - 0.5, top + 1.0, z + 1.21, 0.9, 1.9, 0.03, C.steel, 0, 0.2);
      for (let k = 0; k < 3; k++) g.box(x + 1.61, top + 1.2, z - 0.7 + k * 0.7, 0.03, 0.5, 0.45, C.dark, 0, 0.2); this.L.box(x + 0.6, top + 1.75, z + 1.22, 0.08, 0.08, 0.03, LAMP.green);
      for (let r = 0; r < rows; r++) { const zz = z0 + r * PZ + 1.3, ya = this.gy(x0 - 2.6, zz), yb = this.gy(x0 - 2.6, zz + (r < rows - 1 ? PZ : 2)); g.beam([x0 - 2.6, ya + 0.12, zz], [x0 - 2.6, yb + 0.12, zz + (r < rows - 1 ? PZ : 2)], 0.3, 0.12, C.concrete, 0.4); }
      this.board(g, x0 - 9, z + 5.5, -2.5 + PI, 'solar'); }
    this.cluster('solar', g, S.x, S.z);
    // the brush cart: rides one row's top and bottom rails, sweeping; a separate small mesh that moves
    { const k = new Geo(0.35), r = Math.min(2, rows - 1);
      k.at(0, 0, 0, 0, 0, 0); const P = (a, b, u) => [a, -b * st + u * ct, -b * ct - u * st];
      k.beam(P(0, -1.12, 0.2), P(0, 1.12, 0.2), 0.5, 0.16, C.orange, 0.35); k.tube(P(-0.32, -1.02, 0.1), P(-0.32, 1.02, 0.1), 0.085, 6, C.white, 0.085, true, 0.5); k.tube(P(0.32, -1.02, 0.1), P(0.32, 1.02, 0.1), 0.085, 6, C.white, 0.085, true, 0.5);
      for (const b of [-1.12, 1.12]) { k.box(...P(0, b, 0.1), 0.8, 0.26, 0.2, C.dark); for (const a of [-0.3, 0.3]) k.tube(P(a, b, 0.0), P(a, b + Math.sign(b) * 0.1, 0.0), 0.09, 6, C.rubber, 0.09, true); }
      k.box(...P(0, 0, 0.38), 0.34, 0.2, 0.5, C.steel); k.pop();
      const m = k.mesh(this.mat, 'brush-cart', { cast: !this.low }); m.matrixAutoUpdate = true; this.root.add(m);
      this.cart = { mesh: m, x0: x0 - 1.2, x1: x0 + (cols - 1) * PX + 1.2, z: z0 + r * PZ, heights: heights[r], px: PX, xs: x0, cols }; }
    this.solar = { x0, z0, rows, cols, PX, PZ };
  }

  // ---- the ice well --------------------------------------------------------------------------------------------------------------------
  // The ground here falls two metres across the yard. Every piece stands on its own footing, set to the ground under it.
  buildWell() {
    const S = SITES.well, g = new Geo(0.28), seg = this.low ? 8 : 12, G = (x, z) => this.gy(S.x + x, S.z + z);
    this.yard(this._road.g, S.x, S.z, S.hw, S.hd, this.low ? 2 : 1.5);
    /** a pipe laid on sleepers along the ground from a to b (yard-local x, z), ends at the given heights */
    const run = (ax, az, ay, bx, bz, by, r) => { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 2.5)); let p = [S.x + ax, ay, S.z + az];
      for (let k = 1; k <= n; k++) { const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, q = [S.x + x, k === n ? by : G(x, z) + 0.42, S.z + z]; g.tube(p, q, r, 6, C.foil); if (k < n) g.box(q[0], q[1] - 0.5, q[2], 0.5, 0.7, 0.3, C.concrete, Math.atan2(bx - ax, bz - az)); p = q; } };
    // the derrick: a drill floor on a steel substructure, a tapering lattice tower, crown block, the string down the middle
    const dx = -7, dz = -2, F = 1.5, H = 13.2, db = this.high(S.x + dx, S.z + dz, 2, 2) + 0.1;
    { g.at(S.x + dx, db, S.z + dz);
      for (const ex of [-1, 1]) for (const ez of [-1, 1]) { g.beam([ex * 2, -0.1, ez * 2], [ex * 2, F, ez * 2], 0.18, 0.18, C.steel); g.box(ex * 2, -1.5, ez * 2, 0.7, 3.2, 0.7, C.concrete); }
      g.box(0, F + 0.06, 0, 4.4, 0.12, 4.4, C.dark, 0, 0.4);
      for (const [a, b] of [[-2, 2], [2, -2]]) { g.beam([a, 0.1, -2], [b, F - 0.1, -2], 0.08, 0.08, C.steel); g.beam([a, 0.1, 2], [b, F - 0.1, 2], 0.08, 0.08, C.steel); g.beam([-2, 0.1, a], [-2, F - 0.1, b], 0.08, 0.08, C.steel); }
      const leg = (ex, ez, t) => [ex * (1.7 - 1.15 * t), F + 0.12 + (H - F) * t, ez * (1.7 - 1.15 * t)], bays = this.low ? 4 : 6;
      for (const ex of [-1, 1]) for (const ez of [-1, 1]) g.beam(leg(ex, ez, 0), leg(ex, ez, 1), 0.14, 0.14, C.red, 0.3);
      for (let b = 0; b < bays; b++) { const t0 = b / bays, t1 = (b + 1) / bays; for (const [e0, e1] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) {
          g.beam(leg(e0[0], e0[1], t1), leg(e1[0], e1[1], t1), 0.07, 0.07, C.red, 0.3); g.beam(b & 1 ? leg(e0[0], e0[1], t0) : leg(e1[0], e1[1], t0), b & 1 ? leg(e1[0], e1[1], t1) : leg(e0[0], e0[1], t1), 0.05, 0.05, C.red, 0.3); } }
      g.box(0, H + 0.25, 0, 1.5, 0.3, 1.5, C.dark); g.tube([-0.5, H + 0.6, 0], [0.5, H + 0.6, 0], 0.32, 8, C.steel, 0.32, true);
      g.tube([0, -1.5, 0], [0, H - 2.2, 0], 0.075, 6, C.alu); g.box(0, H - 2.0, 0, 0.5, 0.7, 0.5, C.yellow); g.tube([0, H - 1.6, 0], [0, H + 0.4, 0], 0.02, 4, C.dark);
      g.tube([0, -1.5, 0], [0, 0.9, 0], 0.28, seg, C.red, 0.28, true); g.tube([-0.7, 0.55, 0], [0.7, 0.55, 0], 0.1, 6, C.red, 0.1, true); g.tube([0.5, 0.55, -0.25], [0.5, 0.55, 0.25], 0.16, 8, C.dark, 0.16, true);   // the well head and its valve
      for (let k = 0; k < 6; k++) g.box(2.5 + k * 0.32, F - 0.1 - k * 0.3, 1.2, 0.3, 0.05, 1.0, C.steel);                                    // steps down from the floor
      for (const e of [-1, 1]) g.beam([2.34, F, 1.2 + e * 0.5], [4.4, F - 2.2, 1.2 + e * 0.5], 0.05, 0.12, C.steel);
      for (const [a, b] of [[[-2.2, -2.2], [2.2, -2.2]], [[-2.2, -2.2], [-2.2, 2.2]], [[-2.2, 2.2], [2.2, 2.2]]]) { g.beam([a[0], F + 1.15, a[1]], [b[0], F + 1.15, b[1]], 0.05, 0.05, C.yellow); g.beam([a[0], F + 0.1, a[1]], [a[0], F + 1.15, a[1]], 0.05, 0.05, C.yellow); g.beam([b[0], F + 0.1, b[1]], [b[0], F + 1.15, b[1]], 0.05, 0.05, C.yellow); }
      g.tube([0, H + 0.4, 0], [0, H + 0.98, 0], 0.03, 5, C.dark); g.tube([1.2, F + 0.1, 1.2], [1.2, F + 3.2, 1.2], 0.03, 5, C.steel);
      g.pop();
      this.blinkAt = [[S.x + dx, db + H + 1.05, S.z + dz]];
      this.L.box(S.x + dx + 1.2, db + F + 3.2, S.z + dz + 1.2, 0.3, 0.12, 0.3, LAMP.white); glowHalo(this.H, S.x + dx + 1.2, db + F + 3.1, S.z + dz + 1.2, 1.0, [0.17, 0.16, 0.14], 10); glowPool(this.H, S.x + dx, db + F + 0.14, S.z + dz, 2.6, [0.3, 0.27, 0.22]); this.pool(S.x + dx + 3, S.z + dz + 3, 7, [0.09, 0.08, 0.06]); }
    // drill pipe on a rack
    { const rz = -7.6, rb = this.high(S.x + dx, S.z + rz, 3.2, 1) + 0.7; for (const zz of [-1, 1]) { for (const e of [-1, 1]) g.beam([S.x + dx + e * 3.2, rb - 3, S.z + rz + zz], [S.x + dx + e * 3.2, rb, S.z + rz + zz], 0.1, 0.1, C.steel); g.beam([S.x + dx - 3.4, rb, S.z + rz + zz], [S.x + dx + 3.4, rb, S.z + rz + zz], 0.1, 0.1, C.steel); }
      for (let k = 0; k < 7; k++) g.tube([S.x + dx - 3 + (k % 3) * 0.15, rb + 0.13, S.z + rz - 0.9 + k * 0.3], [S.x + dx + 3 + (k % 3) * 0.15, rb + 0.13, S.z + rz - 0.9 + k * 0.3], 0.075, 6, C.alu, 0.075, true); }
    // the pump and melt house: a heated cabin on its slab, a door, a lit window, a stack
    const hx = 2.5, hz = -6.5, hb = this.plinth(g, S.x + hx, S.z + hz, 6.4, 3.2);
    { g.at(S.x + hx, hb, S.z + hz); g.box(0, 1.3, 0, 6, 2.6, 2.8, C.white, 0, 0.3); g.box(0, 2.64, 0, 6.2, 0.08, 3.0, C.steel); g.box(-1.6, 1.0, 1.41, 1.0, 2.0, 0.03, C.orange, 0, 0.3); g.box(1.2, 1.6, 1.41, 1.1, 0.5, 0.03, C.glass, 0, 0.1);
      g.tube([2.2, 2.6, -0.6], [2.2, 4.2, -0.6], 0.14, 8, C.steel); g.box(-2.2, 2.9, 0, 1.0, 0.45, 1.0, C.steel); g.box(-1.6, -0.9, 2.1, 1.3, 2.0, 1.2, C.concrete, 0, 0.35); g.pop();
      this.L.box(S.x + hx + 1.2, hb + 1.6, S.z + hz + 1.43, 0.9, 0.34, 0.02, [1, 0.74, 0.4]); this.pool(S.x + hx + 1.2, S.z + hz + 3.4, 3.6, [0.13, 0.09, 0.045], 8); }
    run(dx + 0.7, dz, db + 0.55, hx - 3.0, hz + 0.6, hb + 0.6, 0.11);
    // three insulated tanks, each on its own two saddles; a level lamp on each end
    const tb = [];
    for (let k = 0; k < 3; k++) { const z = 0.2 + k * 3.5, x = 6.5, r = 1.35, b = this.high(S.x + x, S.z + z, 2.5, 1.2) + 0.55; tb.push(b); g.at(S.x + x, b, S.z + z);
      g.tube([-3.6, r, 0], [3.6, r, 0], r, seg, C.foil, r, false, 0.4); g.ball(-3.6, r, 0, r, C.foil, seg, 1, 0.4); g.ball(3.6, r, 0, r, C.foil, seg, 1, 0.4);
      for (const e of [-2.2, 2.2]) { g.box(e, -1.2, 0, 0.5, 3.2, 2.3, C.concrete); g.tube([e - 0.06, r, 0], [e + 0.06, r, 0], r + 0.03, seg, C.steel); }
      g.tube([-5, 0.0, 0], [-4.75, 0.9, 0], 0.1, 6, C.foil); g.box(1, 2 * r + 0.07, 0, 0.5, 0.14, 0.5, C.steel); g.pop();
      this.L.box(S.x + x - 3.9 - r * 0.72, b + r + 0.35, S.z + z, 0.03, 0.09, 0.09, k === 1 ? LAMP.amber : LAMP.green); }
    // the header along the tank ends, and the line that leaves west past its valve
    run(hx - 1, hz + 1.5, hb + 0.6, 1.5, 0.2, tb[0], 0.13); run(1.5, 0.2, tb[0], 1.5, 3.7, tb[1], 0.13); run(1.5, 3.7, tb[1], 1.5, 7.2, tb[2], 0.13);
    const vy = G(-12, 8.6) + 0.42, ey = G(-16, 5) + 0.42; run(1.5, 7.2, tb[2], 1.5, 8.6, G(1.5, 8.6) + 0.42, 0.17); run(1.5, 8.6, G(1.5, 8.6) + 0.42, -12, 8.6, vy, 0.17); run(-12, 8.6, vy, -16, 8.6, G(-16, 8.6) + 0.42, 0.17); run(-16, 8.6, G(-16, 8.6) + 0.42, -16, 5, ey, 0.17);
    g.box(S.x - 12, vy + 0.1, S.z + 8.6, 0.9, 1.0, 0.7, C.red, 0, 0.3); g.tube([S.x - 12, vy + 0.6, S.z + 8.6], [S.x - 12, vy + 1.0, S.z + 8.6], 0.04, 5, C.dark); g.tube([S.x - 12, vy + 1.0, S.z + 8.35], [S.x - 12, vy + 1.0, S.z + 8.85], 0.2, 8, C.red, 0.2, true);
    if (this.pipe) g.tube([S.x - 16, ey, S.z + 5], [this.pipe.pts[0][0], this.pipe.top[0], this.pipe.pts[0][1]], 0.17, 7, C.foil);      // up to its first trestle
    // yard clutter, each on the ground where it is: crates, drums, a cable reel; bollards along the road side
    { const c0 = this.high(S.x + 11, S.z - 8.5, 0.7, 0.6); g.box(S.x + 11, c0 + 0.3, S.z - 8.5, 1.4, 1.6, 1.2, C.crate, 0.2, 0.4); g.box(S.x + 11.1, c0 + 1.45, S.z - 8.4, 1.0, 0.7, 0.9, C.crate, 0.5, 0.4);
      const c1 = this.high(S.x + 12.6, S.z - 8.2, 0.6, 0.6); g.box(S.x + 12.6, c1 + 0.2, S.z - 8.2, 1.2, 1.4, 1.2, C.orange, -0.1, 0.4); const c2 = this.high(S.x - 13, S.z + 2, 0.8, 0.6); g.box(S.x - 13, c2 + 0.35, S.z + 2, 1.6, 1.7, 1.2, C.crate, 0.1, 0.4); }
    for (const [x, z] of [[9, -9.6], [9.7, -9.5], [9.3, -8.9]]) { const y = G(x, z); g.tube([S.x + x, y - 0.3, S.z + z], [S.x + x, y + 0.88, S.z + z], 0.29, 8, C.dark, 0.29, true, 0.4); }
    { const y = this.high(S.x - 12.1, S.z - 4.2, 0.4, 0.7); g.tube([S.x - 12.5, y + 0.72, S.z - 4.2], [S.x - 11.7, y + 0.72, S.z - 4.2], 0.75, 10, C.yellow, 0.75, true, 0.4); g.tube([S.x - 12.42, y + 0.72, S.z - 4.2], [S.x - 11.78, y + 0.72, S.z - 4.2], 0.5, 10, C.dark); }
    for (let k = 0; k < 5; k++) { const z = -9 + k * 4.5, y = G(14.6, z); g.tube([S.x + 14.6, y - 0.6, S.z + z], [S.x + 14.6, y + 0.9, S.z + z], 0.09, 6, C.yellow, 0.09, true); this.L.box(S.x + 14.6, y + 0.8, S.z + z, 0.2, 0.08, 0.2, LAMP.amber); }
    this.lampPost(g, S.x + 0.5, G(0.5, -1.5), S.z - 1.5, 6, LAMP.white, 11); this.lampPost(g, S.x - 12.5, G(-12.5, -10), S.z - 10, 5, LAMP.white, 8);
    this.board(g, S.x + 13.4, S.z + 9.8, 0.9, 'well', 1.9, 0.95, 1.15);
    this.wellHand = { x: S.x - 3.4, z: S.z + 1.4 };
    this.cluster('well', g, S.x, S.z);
  }

  // ---- the mast ------------------------------------------------------------------------------------------------------------------------
  buildMast() {
    const S = SITES.mast, g = new Geo(0.25), y = this.gy(S.x, S.z), H = 15;
    g.box(S.x, y - 1.3, S.z, 1.3, 3.2, 1.3, C.concrete, 0.3, 0.4);
    g.tube([S.x, y + 0.3, S.z], [S.x, y + 6, S.z], 0.11, 7, C.white, 0.09); g.tube([S.x, y + 6, S.z], [S.x, y + 11, S.z], 0.09, 7, C.red, 0.07, false, 0.2); g.tube([S.x, y + 11, S.z], [S.x, y + H, S.z], 0.07, 7, C.white, 0.05);
    // guys: three ways, two heights, anchored where the ground really is
    for (let k = 0; k < 3; k++) { const a = k * 2 * PI / 3 + 0.4, ax = S.x + Math.cos(a) * 9.5, az = S.z + Math.sin(a) * 9.5, ay = this.gy(ax, az);
      g.box(ax, ay - 0.7, az, 0.5, 1.6, 0.5, C.concrete, a, 0.4); for (const h of [8.5, 14.2]) g.tube([ax, ay + 0.15, az], [S.x, y + h, S.z], 0.016, 3, C.steel, 0.016, false, 0.1);
      const fx = S.x + Math.cos(a) * 3.2, fz = S.z + Math.sin(a) * 3.2, fy = ay + 0.3 + (y + 8.5 - ay - 0.3) * (1 - 3.2 / 9.5); g.box(fx, fy, fz, 0.05, 0.4, 0.3, C.orange, -a, 0.1);                 // a flag on each wire at head height
      this.L.box(ax, ay + 0.2, az, 0.12, 0.1, 0.12, LAMP.amber); }
    // instruments: a cross-arm with a vane and a sensor shield, a dish to the port, a small panel, the cabinet
    g.beam([S.x - 1.3, y + 10, S.z], [S.x + 1.3, y + 10, S.z], 0.05, 0.05, C.steel); g.box(S.x - 1.3, y + 10.25, S.z, 0.16, 0.4, 0.16, C.white); for (let k = 0; k < 4; k++) g.tube([S.x - 1.3, y + 9.75 + k * 0.1, S.z], [S.x - 1.3, y + 9.8 + k * 0.1, S.z], 0.15, 8, C.white, 0.11);
    g.tube([S.x + 1.3, y + 10, S.z], [S.x + 1.3, y + 10.5, S.z], 0.02, 4, C.steel); g.box(S.x + 1.3, y + 10.5, S.z + 0.25, 0.02, 0.22, 0.5, C.orange, 0.7, 0.1);
    g.tube([S.x - 0.15, y + 7, S.z + 0.25], [S.x - 0.3, y + 7.05, S.z + 0.5], 0.42, 10, C.white, 0.05, true);
    { const P = (a, b) => [S.x + a, y + 2.9 - b * 0.26, S.z - 0.35 - b * 0.96]; g.quad(P(-0.6, -0.45), P(0.6, -0.45), P(0.6, 0.45), P(-0.6, 0.45), C.panel, 0.3); g.beam([S.x, y + 2.9, S.z], [S.x, y + 2.9, S.z - 0.35], 0.05, 0.05, C.steel); }
    g.box(S.x + 0.55, y + 0.85, S.z + 0.2, 0.6, 1.2, 0.45, C.white, 0.3, 0.3); g.beam([S.x + 0.55, y - 0.5, S.z + 0.2], [S.x + 0.55, y + 0.3, S.z + 0.2], 0.3, 0.3, C.steel); this.L.box(S.x + 0.47, y + 1.2, S.z + 0.44, 0.06, 0.06, 0.03, LAMP.green); this.L.box(S.x, y + 3.6, S.z + 0.14, 0.2, 0.06, 0.1, LAMP.white); glowHalo(this.H, S.x, y + 3.55, S.z + 0.16, 0.7, [0.15, 0.14, 0.12], 10); this.pool(S.x + 0.3, S.z + 1.2, 4.5, [0.1, 0.09, 0.07], 8);
    this.blinkAt.push([S.x, y + H + 0.12, S.z]); g.tube([S.x, y + H, S.z], [S.x, y + H + 0.05, S.z], 0.07, 6, C.dark);
    // a survey tripod and its bench mark a few steps off, the board, stakes on the walk up from the well
    { const tx = S.x - 5.5, tz = S.z + 3.5, ty = this.gy(tx, tz); for (let k = 0; k < 3; k++) { const a = k * 2.094 + 0.3; g.beam([tx, ty + 1.45, tz], [tx + Math.cos(a) * 0.6, this.gy(tx + Math.cos(a) * 0.6, tz + Math.sin(a) * 0.6) - 0.1, tz + Math.sin(a) * 0.6], 0.04, 0.04, C.yellow); }
      g.box(tx, ty + 1.58, tz, 0.2, 0.24, 0.28, C.dark, 0.8); g.tube([tx, ty + 1.58, tz - 0.14], [tx, ty + 1.58, tz - 0.22], 0.05, 6, C.glass, 0.05, true);
      g.box(tx + 0.9, ty + 0.05, tz + 0.4, 0.3, 0.2, 0.3, C.concrete, 0.2, 0.3); this.L.box(tx + 0.9, ty + 0.16, tz + 0.4, 0.06, 0.03, 0.06, LAMP.amber);
      this.mastWalk = [[S.x + 1.1, S.z + 1.0], [tx + 0.9, tz - 0.8]]; }
    this.board(g, S.x - 3, S.z + 9, 2.6, 'mast', 1.5, 0.75);
    const W = SITES.well; for (let k = 1; k < (this.low ? 3 : 5); k++) { const t = k / (this.low ? 3 : 5), x = W.x + 18 + (S.x - W.x - 22) * t + (h01(k, 7) - 0.5) * 6, z = W.z - 8 + (S.z - W.z + 14) * t; if (k & 1) this.stake(g, x, z, 300 + k); else this.cairn(g, x, z, 300 + k); }
    this.cluster('mast', g, S.x, S.z);
    // the cups at the top turn: a separate small mesh
    { const k = new Geo(0.1); for (let i = 0; i < 3; i++) { const a = i * 2.094; k.beam([0, 0, 0], [Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3], 0.02, 0.02, C.steel); k.ball(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3, 0.07, C.dark, 6); } k.tube([0, -0.25, 0], [0, 0.03, 0], 0.02, 4, C.steel);
      const m = k.mesh(this.mat, 'mast-cups'); m.matrixAutoUpdate = true; m.position.set(S.x + 0.5, y + 10.55, S.z); this.root.add(m); this.cups = m; g.beam([S.x, y + 10.25, S.z], [S.x + 0.5, y + 10.25, S.z], 0.03, 0.03, C.steel); }
  }

  // ---- where the first crew set down -----------------------------------------------------------------------------------------------------
  buildLanding() {
    const S = SITES.landing, g = new Geo(0.5), y = this.gy(S.x, S.z), seg = this.low ? 8 : 10;
    // the descent stage: an eight-sided body in faded foil, four legs (two feet under the drift), four tanks, the empty ring the ascent stage left from
    g.at(S.x, y - 0.75, S.z, 0.5, 0.11, -0.06);
    { const R = 2.3, H0 = 1.0, H1 = 2.85, V = (k, yy, r = R) => { const a = k * PI / 4 + PI / 8; return [Math.cos(a) * r, yy, Math.sin(a) * r]; };
      for (let k = 0; k < 8; k++) { g.quad(V(k, H0), V(k + 1, H0), V(k + 1, H1), V(k, H1), k % 3 === 0 ? C.foil : C.gold, 0.35 + 0.25 * h01(k, 5)); g.tri(V(k, H1), V(k + 1, H1), [0, H1, 0], C.dark, 0.6); g.tri(V(k + 1, H0), V(k, H0), [0, H0 - 0.3, 0], C.dark, 0.2); }
      g.tube([0, H1, 0], [0, H1 + 0.22, 0], 1.25, seg, C.steel, 1.25); g.tube([0, H1 + 0.01, 0], [0, H1 + 0.02, 0], 1.0, seg, C.rubber, 1.0, true, 0.75);                       // the ring, scorched inside
      g.tube([0, H0 - 0.3, 0], [0, 0.1, 0], 0.5, seg, C.dark, 0.95);                                                                                                             // the engine bell, in the dust
      for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 4, cx = Math.cos(a), cz = Math.sin(a), foot = [cx * 4.1, 0.1, cz * 4.1];
        g.tube([cx * 2.2, H1 - 0.3, cz * 2.2], foot, 0.085, 6, C.alu); g.tube([cx * 2.1, H0 + 0.1, cz * 2.1], [cx * 3.4, 0.9, cz * 3.4], 0.05, 5, C.alu);
        g.tube([Math.cos(a - 0.5) * 2.2, H0 + 0.2, Math.sin(a - 0.5) * 2.2], [cx * 3.4, 0.9, cz * 3.4], 0.04, 5, C.alu); g.tube([Math.cos(a + 0.5) * 2.2, H0 + 0.2, Math.sin(a + 0.5) * 2.2], [cx * 3.4, 0.9, cz * 3.4], 0.04, 5, C.alu);
        g.tube([foot[0], 0, foot[2]], [foot[0], 0.16, foot[2]], 0.55, seg, C.gold, 0.45, true);
        const b = a + PI / 4; g.ball(Math.cos(b) * 1.75, H0 + 0.95, Math.sin(b) * 1.75, 0.82, C.white, seg, 1, 0.5); }
      for (let k = 0; k < 7; k++) g.box(Math.cos(PI / 4) * (2.35 + k * 0.26), H1 - 0.45 - k * 0.37, Math.sin(PI / 4) * (2.35 + k * 0.26), 0.5, 0.03, 0.06, C.alu, -PI / 4);      // the ladder down one leg
      g.tube([1.3, H1, -1.2], [1.6, H1 + 1.5, -1.5], 0.025, 4, C.alu); g.tube([1.6, H1 + 1.5, -1.5], [2.3, H1 + 1.7, -1.3], 0.02, 4, C.alu);                                    // a whip aerial, bent
      g.box(-1.5, H1 + 0.2, 0.8, 0.7, 0.4, 0.5, C.white, 0.4, 0.6); }
    g.pop();
    // the drift against its windward side, stones round it
    this.heap(g, S.x - 3.0, S.z + 1.6, 3.6, 1.15, C.ground, 21, 10); this.heap(g, S.x + 2.4, S.z + 3.2, 2.2, 0.6, C.ground, 22, 8); this.rocks(g, S.x, S.z, this.low ? 8 : 14, 9, 23);
    // roped off: posts and a line, open toward the road; reflective caps
    const R = 8.2, n = 12, rd = Math.atan2(-1290 + 1302, 455 - 464);                                                                           // the way to the end of the road
    let prev = null; for (let k = 0; k <= n; k++) { const a = rd + 0.42 + k / n * (2 * PI - 0.84), x = S.x + Math.cos(a) * R, z = S.z + Math.sin(a) * R, py = this.gy(x, z);
      g.tube([x, py - 0.6, z], [x, py + 0.95, z], 0.035, 5, C.white); this.L.box(x, py + 0.98, z, 0.08, 0.05, 0.08, LAMP.amber);
      if (prev) g.tube([prev[0], prev[1] + 0.85, prev[2]], [x, py + 0.85, z], 0.012, 3, C.orange, 0.012, false, 0.1); prev = [x, py, z]; }
    // the plaque, on a low pier by the gap, tipped back to be read
    { const d = 9.2, x = S.x + Math.cos(rd) * d, z = S.z + Math.sin(rd) * d, py = this.gy(x, z), fx = Math.cos(rd), fz = Math.sin(rd), sx = -fz, sz = fx, w = 1.3, h = 0.65, t = 0.5;
      g.box(x - fx * 0.05, py - 0.06, z - fz * 0.05, 0.9, 1.5, 0.5, C.concrete, Math.atan2(fx, fz), 0.4);
      const P = (e, v, o = 0) => [x + sx * e * w / 2 + fx * (0.2 - v * h * Math.sin(t)) + fx * o * Math.cos(t), py + 0.78 + v * h * Math.cos(t) + o * Math.sin(t), z + sz * e * w / 2 + fz * (0.2 - v * h * Math.sin(t)) + fz * o * Math.cos(t)];
      g.quad(P(-1.06, -0.06, -0.012), P(1.06, -0.06, -0.012), P(1.06, 1.06, -0.012), P(-1.06, 1.06, -0.012), C.steel, 0.2); this.S.sign(P(1, 0, 0.004), P(-1, 0, 0.004), P(-1, 1, 0.004), P(1, 1, 0.004), this.atlas.uv.plaque);
      g.box(x + fx * 0.6, py + 0.1, z + fz * 0.6, 0.3, 0.3, 0.14, C.dark, Math.atan2(fx, fz), 0.3); this.L.box(x + fx * 0.6, py + 0.27, z + fz * 0.6, 0.22, 0.05, 0.1, LAMP.white, Math.atan2(fx, fz)); this.pool(x + fx * 0.9, z + fz * 0.9, 2.4, [0.07, 0.065, 0.05], 8);
      this.plaqueAt = [x, z]; }
    // a cairn the crew built, and the staff of their flag (the cloth is long gone)
    this.cairn(g, S.x + 6.2, S.z - 9.5, 77); { const x = S.x - 5.5, z = S.z - 7, py = this.gy(x, z); g.tube([x, py - 0.5, z], [x + 0.12, py + 2.3, z], 0.022, 5, C.alu); g.beam([x + 0.12, py + 2.25, z], [x + 0.75, py + 2.25, z], 0.02, 0.02, C.alu); }
    this.cluster('landing', g, S.x, S.z);
  }

  finish() {
    const add = (geo, mat, name) => { if (!geo.p.length) return null; const m = geo.mesh(mat, name); m.frustumCulled = false; this.root.add(m); return m; };
    this.lamps = add(this.L, this.lampMat, 'lamps');
    this.haze = add(this.H, this.hazeMat, 'night-glow'); if (this.haze) this.haze.renderOrder = 2;
    this.signMat = new THREE.MeshStandardMaterial({ map: this.atlas.tex, roughness: 0.9, metalness: 0, emissive: 0xffffff, emissiveMap: this.atlas.tex, emissiveIntensity: 0.1, side: THREE.DoubleSide });
    this.signs = add(this.S, this.signMat, 'signs');
    // the red lamps that blink together: the derrick's crown and the mast's top (one small mesh)
    { const k = new Geo(0); for (const p of this.blinkAt) k.ball(p[0], p[1], p[2], 0.11, [1, 1, 1], 6); this.blink = add(k, this.blinkMat, 'beacons'); }
    this.L = this.H = this.S = null; this.built = true;
    let tris = 0; for (const c of this.clusters) tris += c.tris; this.tris = tris;
  }

  // ---- the people who work out here ------------------------------------------------------------------------------------------------------
  async buildPeople(lib) {
    this.peopleState = 1;
    try {
      const roster = await lib.roster(), cached = new Set(lib.cachedFiles()), pool = roster.filter((r) => cached.has(r.file));
      if (!pool.length) { this.peopleState = 3; return; }
      const W = SITES.well, So = this.solar, B = SITES.borrow, zA = So.z0 + 2.5 * So.PZ, xa = So.x0 - 1, xb = So.x0 + (So.cols - 1) * So.PX + 1;
      const jobs = [
        { id: 'well-hand', cloth: 0xd8d2c4, x: this.wellHand.x, z: this.wellHand.z, y: this.gy(this.wellHand.x, this.wellHand.z), yaw: -2.33 },                                // at the well head, on the bench
        { id: 'panel-hand', cloth: 0x67c4cf, beat: { pts: [[xa, zA], [xb, zA], [xb, zA + So.PZ], [xa, zA + So.PZ]], rest: [14, 9] } },          // walking the rows
        { id: 'mast-hand', cloth: 0xe5ac6c, beat: { pts: this.mastWalk, rest: [16, 22] } },                                                  // between the cabinet and the tripod
        { id: 'digger-hand', cloth: 0xb5694a, beat: { pts: [[B.x - 10.5, B.z + 5.5], [B.x - 13, B.z + 9.5]], rest: [25, 18] } },               // by the excavator
      ].slice(0, this.low ? 3 : 4);
      jobs.forEach((j, i) => { const model = pool[(i * 3 + 2) % pool.length], person = lib.spawn(model.id, model.file); dressForWorld(person, MARS_AIR, { cloth: j.cloth }, false);
        person.group.visible = false; this.root.add(person.group); if (!j.beat) { person.group.position.set(j.x, j.y + 0.02, j.z); person.group.rotation.y = j.yaw; person.play('Idle', 0); }
        this.people.push({ ...j, person, offset: i * 41, anim: j.beat ? '' : 'Idle', pose: { x: j.x || 0, z: j.z || 0, yaw: 0, moving: false } }); });
      await Promise.all(this.people.map((p) => p.person.ready));
      this.peopleState = 2;
    } catch (e) { console.warn('desert people failed to build', e); this.peopleState = 3; }
  }

  // ---- one frame -------------------------------------------------------------------------------------------------------------------------
  update(dt) {
    const eng = this.engine, st = this.site, c = st.center, cam = eng.cameraWorldPos, tr = this.port.traffic, op = tr && tr.ctx ? tr.ctx.opening : null;
    let on = this.enabled && eng.activeFrame === eng.rootFrame && !(op && (typeof op === 'function' ? op() : op)?.active);
    const L = this._cam;
    if (on) { const x = cam.x - c.x, y = cam.y - c.y, z = cam.z - c.z, R = st.right, U = st.up, B = st.back; L.x = x * R.x + y * R.y + z * R.z; L.y = x * U.x + y * U.y + z * U.z; L.z = x * B.x + y * B.y + z * B.z;
      on = Math.hypot(L.x - 300, L.y, L.z + 650) < BUILD_M + 800; }
    this.active = on;
    if (!on) { if (this.root.visible) this.root.visible = false; return; }
    if (!this.built) { const t0 = performance.now(); this.steps.shift()(); const ms = performance.now() - t0; this.buildMs.total += ms; this.buildMs.steps++; if (ms > this.buildMs.max) this.buildMs.max = ms; if (!this.built) return; }
    this.root.visible = true;
    let any = false; for (const k of this.clusters) { const v = Math.hypot(L.x - k.x, L.y, L.z - k.z) < DRAW_M + (k.name === 'road' || k.name === 'line' ? 700 : 0); if (k.mesh.visible !== v) k.mesh.visible = v; any = any || v; }
    if (this.lamps.visible !== any) { this.lamps.visible = any; this.signs.visible = any; this.cart.mesh.visible = any; this.cups.visible = any; }
    // night: the lenses come up, the glow pools with them; by day a lens is only a pale piece of glass
    const night = this.port.night || 0, now = worldTimeS(), k = 0.42 + 0.58 * night; if (this.lampMat.color.r !== k) this.lampMat.color.setScalar(k);
    if (this.haze) { const v = night > 0.02 && any; if (this.haze.visible !== v) this.haze.visible = v; this.hazeMat.opacity = night; }
    if (!any) { if (this.blink.visible) this.blink.visible = false; }
    else {
      const ph = now % 1.6, lit = ph < 0.12 || (ph > 0.3 && ph < 0.42); if (this.blink.visible !== lit) this.blink.visible = lit;
      // the brush cart: up the row and back at a walk's tenth, a pause at each end; pure in the clock, so everybody sees it in the same place
      const q = this.cart, span = q.x1 - q.x0, leg = span / 0.12 + 20, u = now % (2 * leg), d = u < leg ? Math.min(1, u * 0.12 / span) : 1 - Math.min(1, (u - leg) * 0.12 / span), x = q.x0 + span * d;
      const f = Math.max(0, Math.min(q.cols - 1, Math.round((x - q.xs) / q.px)));
      q.mesh.position.set(x, q.heights[f], q.z);
      this.cups.rotation.y = -now * 2.6;
    }
    // people: the same range the port draws its own at
    if (this.peopleState === 0) { const pp = this.port.people; if (pp && pp.library && pp.walkers) this.buildPeople(pp.library); }
    else if (this.peopleState === 2) {
      this.clock += dt; const range = this.low ? 56 : 120;
      for (const m of this.people) { const gp = m.person.group;
        if (m.beat) { const p = beatPose(m.beat, now + m.offset, m.pose), vis = Math.hypot(L.x - p.x, L.z - p.z) < range && Math.abs(L.y - gp.position.y) < range * 2;
          if (gp.visible !== vis) gp.visible = vis; if (!vis) continue;
          gp.position.set(p.x, this.gy(p.x, p.z) + 0.02, p.z);
          if (p.moving) { let d = p.yaw - gp.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); gp.rotation.y += d * Math.min(1, dt * 5); }
          const anim = p.moving ? 'Walk' : 'Idle'; if (anim !== m.anim) { m.anim = anim; m.person.play(anim, 0.3); }
          m.person.update(dt, p.moving ? 1.25 : 0);
        } else { const vis = Math.hypot(L.x - m.x, L.y - m.y, L.z - m.z) < range; if (gp.visible !== vis) gp.visible = vis; if (vis) m.person.update(dt); } }
    }
  }

  // ---- for tests and review shots (window.cosmos.port.desert) ----------------------------------------------------------------------------
  status() {
    let draws = 0; if (this.built) { for (const c of this.clusters) if (c.mesh.visible) draws++; draws += 5 + (this.haze && this.haze.visible ? 1 : 0); }
    return { active: this.active, built: this.built, phone: this.low, stepsLeft: this.steps.length, buildMs: { total: +this.buildMs.total.toFixed(1), max: +this.buildMs.max.toFixed(1) }, tris: this.tris || 0, drawCalls: draws,
      clusters: this.clusters.map((c) => ({ name: c.name, tris: c.tris, shown: c.mesh.visible })), roadM: Math.round(this.roadLen || 0),
      people: this.people.map((p) => ({ id: p.id, shown: p.person.group.visible, x: +p.person.group.position.x.toFixed(1), y: +p.person.group.position.y.toFixed(2), z: +p.person.group.position.z.toFixed(1), ground: +this.gy(p.person.group.position.x, p.person.group.position.z).toFixed(2), anim: p.anim })), peopleState: this.peopleState };
  }
}
