// hb-render: Position Based Fluids on the GPU (WGSL). Same model as src/fluid.js, many more particles.
// Neighbors: hashed grid with per-cell linked lists (atomics), rebuilt every step.
// Collisions: ground height grid (bilinear) + one lathe shell as a 2D (r,y) signed distance grid.
// Sand soak: absorbed drops add their volume into a fixed-point wetness map (atomics); the map
// then spreads with the same capillary rule as the JS version.

struct FP {
  dt: f32, h: f32, rho0: f32, spacing: f32,
  n: u32, iters: u32, tableMask: u32, step: u32,
  gravity: vec4f,                 // xyz, w = viscosity
  limits: vec4f,                  // maxSpeed, friction, domain, tensileK
  groundRect: vec4f,              // x0, z0, size, res
  bottleGrid: vec4f,              // cell, yMin, nr, ny
  wet: vec4f,                     // x0, z0, size, res
  soak: vec4f,                    // absorbRate, deposit, saturation, trail
  soak2: vec4f,                   // diffusion a (per pass), passes, scorrW, unused
  inv0: vec4f, inv1: vec4f, inv2: vec4f, inv3: vec4f,   // bottle world->local (columns)
  fwd0: vec4f, fwd1: vec4f, fwd2: vec4f,                // bottle local->world rotation (columns)
};

@group(0) @binding(0) var<uniform> P: FP;
@group(0) @binding(1) var<storage, read_write> pos: array<vec4f>;    // xyz, w: 1 alive / 0 dead
@group(0) @binding(2) var<storage, read_write> vel: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> pred: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> lam: array<f32>;
@group(0) @binding(5) var<storage, read_write> dp: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> head: array<atomic<i32>>;
@group(0) @binding(7) var<storage, read_write> nxt: array<i32>;
@group(0) @binding(8) var<storage, read> ground: array<f32>;
@group(0) @binding(9) var<storage, read> bottleSDF: array<f32>;
@group(0) @binding(10) var<storage, read_write> wetAdd: array<atomic<u32>>;
@group(0) @binding(11) var<storage, read_write> wetA: array<f32>;
@group(0) @binding(12) var<storage, read_write> wetB: array<f32>;
@group(0) @binding(13) var<storage, read_write> counters: array<atomic<u32>>; // 0: absorbed

const PI = 3.14159265;
const WET_SCALE = 65536.0;

fn W(q: f32) -> f32 { if (q >= 1.0) { return 0.0; } let t = 1.0 - q * q; return (315.0 / (64.0 * PI)) * t * t * t; }
fn dWdq(q: f32) -> f32 { if (q >= 1.0) { return 0.0; } let t = 1.0 - q; return -(45.0 / PI) * t * t; }

fn hashCell(c: vec3i) -> u32 {
  let h = (u32(c.x) * 73856093u) ^ (u32(c.y) * 19349663u) ^ (u32(c.z) * 83492791u);
  return h & P.tableMask;
}
fn cellOf(p: vec3f) -> vec3i { return vec3i(floor(p / P.h)); }

fn rnd(i: u32, k: u32) -> f32 {
  var s = i * 747796405u + P.step * 2891336453u + k * 1181783497u + 1u;
  s = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  s = (s >> 22u) ^ s;
  return f32(s) * (1.0 / 4294967296.0);
}

fn groundH(x: f32, z: f32) -> f32 {
  let res = i32(P.groundRect.w);
  let fx = clamp((x - P.groundRect.x) / P.groundRect.z * f32(res - 1), 0.0, f32(res) - 1.001);
  let fz = clamp((z - P.groundRect.y) / P.groundRect.z * f32(res - 1), 0.0, f32(res) - 1.001);
  let ix = i32(fx); let iz = i32(fz); let tx = fx - f32(ix); let tz = fz - f32(iz);
  let a = ground[ix + res * iz]; let b = ground[ix + 1 + res * iz]; let c = ground[ix + res * (iz + 1)]; let d = ground[ix + 1 + res * (iz + 1)];
  return mix(mix(a, b, tx), mix(c, d, tx), tz);
}

// bottle shell distance (negative inside the plastic) + world-space outward gradient
fn bottleQuery(p: vec3f) -> vec4f {
  let l = vec3f(dot(P.inv0.xyz, p) + P.inv3.x, dot(P.inv1.xyz, p) + P.inv3.y, dot(P.inv2.xyz, p) + P.inv3.z);
  let r = length(l.xz);
  let cell = P.bottleGrid.x; let nr = i32(P.bottleGrid.z); let ny = i32(P.bottleGrid.w);
  let fx = clamp(r / cell, 0.0, f32(nr) - 1.001); let fy = clamp((l.y - P.bottleGrid.y) / cell, 0.0, f32(ny) - 1.001);
  let i = i32(fx); let j = i32(fy); let tx = fx - f32(i); let ty = fy - f32(j);
  let d00 = bottleSDF[i + nr * j]; let d10 = bottleSDF[i + 1 + nr * j]; let d01 = bottleSDF[i + nr * (j + 1)]; let d11 = bottleSDF[i + 1 + nr * (j + 1)];
  let v = mix(mix(d00, d10, tx), mix(d01, d11, tx), ty);
  let gr = mix(d10 - d00, d11 - d01, ty) / cell;
  let gy = mix(d01 - d00, d11 - d10, tx) / cell;
  let cr = select(1.0, l.x / r, r > 1e-9); let sr = select(0.0, l.z / r, r > 1e-9);
  let gl = vec3f(gr * cr, gy, gr * sr);
  let g = P.fwd0.xyz * gl.x + P.fwd1.xyz * gl.y + P.fwd2.xyz * gl.z;
  return vec4f(normalize(g + vec3f(1e-9)), v);
}

fn collide(pIn: vec3f) -> vec3f {
  var p = pIn;
  let r = P.spacing * 0.5;
  let q = bottleQuery(p);
  if (q.w < r) { p += q.xyz * (r - q.w); }
  let g = groundH(p.x, p.z);
  if (p.y < g + r) { p.y = g + r; }
  return p;
}

@compute @workgroup_size(256)
fn predict(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x; if (i >= P.n) { return; }
  if (pos[i].w < 0.5) { pred[i] = vec4f(1e6, 1e6, 1e6, 0.0); return; }
  var v = vel[i].xyz + P.gravity.xyz * P.dt;
  var p = pos[i].xyz + v * P.dt;
  p = collide(p);
  pred[i] = vec4f(p, 1.0);
  vel[i] = vec4f(v, 0.0);
}

@compute @workgroup_size(256)
fn clearHeads(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x; if (i > P.tableMask) { return; }
  atomicStore(&head[i], -1);
}

@compute @workgroup_size(256)
fn insert(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x; if (i >= P.n) { return; }
  if (pred[i].w < 0.5) { nxt[i] = -1; return; }
  let k = hashCell(cellOf(pred[i].xyz));
  nxt[i] = atomicExchange(&head[k], i32(i));
}

@compute @workgroup_size(256)
fn lambdaPass(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x; if (i >= P.n) { return; }
  if (pred[i].w < 0.5) { lam[i] = 0.0; return; }
  let p = pred[i].xyz;
  let c = cellOf(p);
  var rho = W(0.0); var g = vec3f(0.0); var sum2 = 0.0;
  for (var dz = -1; dz <= 1; dz++) { for (var dy = -1; dy <= 1; dy++) { for (var dx = -1; dx <= 1; dx++) {
    var j = atomicLoad(&head[hashCell(c + vec3i(dx, dy, dz))]);
    var guard = 0;
    while (j >= 0 && guard < 512) {
      guard++;
      if (u32(j) != i) {
        let e = p - pred[j].xyz;
        let d2 = dot(e, e);
        if (d2 < P.h * P.h) {
          let q = sqrt(d2) / P.h;
          rho += W(q);
          if (q > 1e-6) {
            let dw = dWdq(q) / (q * P.h);
            let cg = dw * e / P.rho0;
            g += cg; sum2 += dot(cg, cg);
          }
        }
      }
      j = nxt[j];
    }
  }}}
  sum2 += dot(g, g);
  let C = max(rho / P.rho0 - 1.0, 0.0);
  lam[i] = -C / (sum2 + 1.0);
}

@compute @workgroup_size(256)
fn deltaPass(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x; if (i >= P.n) { return; }
  if (pred[i].w < 0.5) { dp[i] = vec4f(0.0); return; }
  let p = pred[i].xyz; let li = lam[i];
  let c = cellOf(p);
  var acc = vec3f(0.0);
  for (var dz = -1; dz <= 1; dz++) { for (var dy = -1; dy <= 1; dy++) { for (var dx = -1; dx <= 1; dx++) {
    var j = atomicLoad(&head[hashCell(c + vec3i(dx, dy, dz))]);
    var guard = 0;
    while (j >= 0 && guard < 512) {
      guard++;
      if (u32(j) != i) {
        let e = p - pred[j].xyz;
        let d2 = dot(e, e);
        if (d2 < P.h * P.h && d2 > 1e-14) {
          let q = sqrt(d2) / P.h;
          let sc = -P.limits.w * pow(W(q) / P.soak2.z, 4.0);
          let dw = dWdq(q) / (q * P.h);
          acc += (li + lam[j] + sc) * dw / P.rho0 * e;
        }
      }
      j = nxt[j];
    }
  }}}
  dp[i] = vec4f(acc * P.h, 0.0);
}

@compute @workgroup_size(256)
fn applyPass(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x; if (i >= P.n) { return; }
  if (pred[i].w < 0.5) { return; }
  var p = pred[i].xyz + dp[i].xyz;
  p = collide(p);
  pred[i] = vec4f(p, 1.0);
}

// velocities + XSPH viscosity (reads vel of neighbors from the previous step's velocities stored in vel)
@compute @workgroup_size(256)
fn velocityPass(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x; if (i >= P.n) { return; }
  if (pred[i].w < 0.5) { return; }
  let p = pred[i].xyz;
  var v = (p - pos[i].xyz) / P.dt;
  // XSPH over neighbors' raw velocities (their (pred - pos)/dt)
  let c = cellOf(p);
  var acc = vec3f(0.0);
  for (var dz = -1; dz <= 1; dz++) { for (var dy = -1; dy <= 1; dy++) { for (var dx = -1; dx <= 1; dx++) {
    var j = atomicLoad(&head[hashCell(c + vec3i(dx, dy, dz))]);
    var guard = 0;
    while (j >= 0 && guard < 512) {
      guard++;
      if (u32(j) != i) {
        let e = p - pred[j].xyz;
        let d2 = dot(e, e);
        if (d2 < P.h * P.h) {
          let vj = (pred[j].xyz - pos[j].xyz) / P.dt;
          acc += (vj - v) * W(sqrt(d2) / P.h) / P.rho0;
        }
      }
      j = nxt[j];
    }
  }}}
  v += P.gravity.w * acc * 4.0;
  dp[i] = vec4f(v, 0.0);
}

@compute @workgroup_size(256)
fn finalizePass(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x; if (i >= P.n) { return; }
  if (pos[i].w < 0.5) { return; }
  var p = pred[i].xyz;
  var v = dp[i].xyz;
  let gh = groundH(p.x, p.z);
  var alive = 1.0;
  if (p.y < gh + P.spacing * 0.9) {
    v = vec3f(v.x * (1.0 - P.limits.y), select(v.y, v.y * 0.2, v.y < 0.0), v.z * (1.0 - P.limits.y));
    // sand soak
    let res = i32(P.wet.w);
    let fx = (p.x - P.wet.x) / P.wet.z * f32(res); let fz = (p.z - P.wet.y) / P.wet.z * f32(res);
    let cx = i32(floor(fx)); let cz = i32(floor(fz));
    if (cx >= 1 && cz >= 1 && cx < res - 1 && cz < res - 1) {
      let local = wetA[cx + res * cz];
      let rate = P.soak.x * max(0.15, 1.0 - local / P.soak.z);
      let sp = length(v.xz);
      if (sp > 0.02) { atomicAdd(&wetAdd[cx + res * cz], u32(P.soak.w * P.dt * sp * WET_SCALE)); }
      if (rnd(i, 7u) < rate * P.dt) {
        alive = 0.0;
        atomicAdd(&counters[0], 1u);
        for (var dz = -1; dz <= 1; dz++) { for (var dx = -1; dx <= 1; dx++) {
          let wgt = select(0.075, 0.4, dx == 0 && dz == 0);
          atomicAdd(&wetAdd[(cx + dx) + res * (cz + dz)], u32(P.soak.y * wgt * WET_SCALE));
        }}
      }
    }
  }
  let sp = length(v);
  if (sp > P.limits.x) { v *= P.limits.x / sp; }
  if (max(abs(p.x), max(abs(p.y), abs(p.z))) > P.limits.z) { alive = 0.0; }
  if (alive < 0.5) { p = vec3f(1e6); }
  pos[i] = vec4f(p, alive);
  vel[i] = vec4f(v, 0.0);
}

// wet map: fold in this step's atomic additions, then one capillary spread pass A -> B
@compute @workgroup_size(256)
fn soakFold(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x; let res = u32(P.wet.w); if (i >= res * res) { return; }
  let add = f32(atomicExchange(&wetAdd[i], 0u)) / WET_SCALE;
  wetA[i] = wetA[i] + add;
}

// gather form of the capillary flux (each cell computes its own net exchange with 4 neighbors)
fn fluxTo(c: f32, d: f32, a: f32) -> f32 {
  let s = min(1.0, (c + d) * 0.5 / P.soak.z);
  let perm = 0.15 + 0.85 * s * s;
  return a * perm * (c - d);
}
@compute @workgroup_size(256)
fn soakSpread(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x; let res = u32(P.wet.w); if (i >= res * res) { return; }
  let x = i % res; let z = i / res;
  let c = wetA[i];
  if (x == 0u || z == 0u || x == res - 1u || z == res - 1u) { wetB[i] = c; return; }
  let a = P.soak2.x;
  var v = c;
  v -= fluxTo(c, wetA[i - 1u], a); v -= fluxTo(c, wetA[i + 1u], a);
  v -= fluxTo(c, wetA[i - res], a); v -= fluxTo(c, wetA[i + res], a);
  wetB[i] = max(v, 0.0);
}
@compute @workgroup_size(256)
fn soakCopy(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x; let res = u32(P.wet.w); if (i >= res * res) { return; }
  wetA[i] = wetB[i];
}
