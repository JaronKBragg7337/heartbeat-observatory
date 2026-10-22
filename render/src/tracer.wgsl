// hb-render v0 path tracer. WebGPU compute, WGSL. One sample per pixel per dispatch, progressive.
// BVH over triangles, GGX microfacet BRDF, rough dielectrics (water, PET) with exact Fresnel,
// HDRI environment light with importance sampling + MIS, thin-lens depth of field.

struct Params {
  camPos: vec4f,    // xyz, w = tan(fov/2)
  camFwd: vec4f,    // xyz, w = aspect
  camRight: vec4f,  // xyz, w = lens radius
  camUp: vec4f,     // xyz, w = focus distance
  size: vec4u,      // width, height, frame, maxBounces
  env: vec4f,       // rotation (rad), intensity, envW, envH
  wet: vec4f,       // x0, z0, size, gain
  misc: vec4f,      // envTotal, exposure, pixel angle, caustics enabled (1)
  caus: vec4f,      // caustic map x0, z0, size, res
  caus2: vec4f,     // photons per pass, emitter rect area, fixed-point scale, emitter height
  lt: vec4f,        // light count, env direct sampling (1/0), russian roulette start bounce, luminance clamp
};

struct Material {
  base: vec4f,   // rgb base color, w = albedo texture layer (-1 = none)
  phys: vec4f,   // roughness, metallic, ior, transmission
  tex: vec4f,    // roughness layer, normal layer, uv scale, wetness enabled
  emit: vec4f,   // emission rgb, w = normal map strength
  absorb: vec4f, // absorption per meter (rgb) inside a transmissive medium, w = grain
  extra: vec4f,  // metallic-roughness packed texture (1), alpha cutoff, emissive texture layer, light index + 1
  extra2: vec4f, // sheen, sheen tint, clearcoat, clearcoat roughness
};

// Light: p[xyz,type] u[xyz,radius] v[xyz,area] L[rgb,cosOuter] e[cosInner,matId,0,0]
// type 0 rect, 1 disc, 2 point, 3 spot, 4 portal (sky through an opening), 5 sphere
struct Light { p: vec4f, u: vec4f, v: vec4f, L: vec4f, e: vec4f };

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> tris: array<vec4f>;
@group(0) @binding(2) var<storage, read> nrms: array<vec4f>;
@group(0) @binding(3) var<storage, read> uvs: array<vec2f>;
@group(0) @binding(4) var<storage, read> nodes: array<vec4f>;
@group(0) @binding(5) var<storage, read> mats: array<Material>;
@group(0) @binding(6) var<storage, read_write> accum: array<vec4f>;
@group(0) @binding(7) var<storage, read_write> gbuf: array<vec4f>;
@group(0) @binding(8) var<storage, read_write> causAcc: array<atomic<u32>>;  // photon deposits (fixed point)
@group(0) @binding(9) var<storage, read_write> causMap: array<f32>;          // caustic irradiance on the sand
@group(0) @binding(10) var<storage, read> lights: array<Light>;
@group(0) @binding(11) var<storage, read> lightTris: array<f32>;   // mesh-light triangles, 9 floats each
@group(0) @binding(12) var<storage, read> lightCdf: array<f32>;    // cumulative area per triangle (per light, 0..1)

@group(1) @binding(0) var envTex: texture_2d<f32>;
@group(1) @binding(1) var<storage, read> envMarg: array<f32>;
@group(1) @binding(2) var<storage, read> envCond: array<f32>;
@group(1) @binding(3) var texArr: texture_2d_array<f32>;
@group(1) @binding(4) var sampRepeat: sampler;
@group(1) @binding(5) var wetTex: texture_2d<f32>;
@group(1) @binding(6) var sampClamp: sampler;

const PI = 3.14159265358979;
const INV_PI = 0.31830988618;
const EPS = 1e-4;

// ---------------- random numbers (PCG) ----------------
var<private> rngState: u32;
fn pcg() -> u32 {
  let s = rngState * 747796405u + 2891336453u;
  let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  rngState = s;
  return (w >> 22u) ^ w;
}
fn rnd() -> f32 { return f32(pcg()) * (1.0 / 4294967296.0); }

// ---------------- geometry ----------------
struct Hit { t: f32, tri: i32, u: f32, v: f32 };

fn hitBox(bmin: vec3f, bmax: vec3f, ro: vec3f, inv: vec3f, tmax: f32) -> f32 {
  let t0 = (bmin - ro) * inv;
  let t1 = (bmax - ro) * inv;
  let tmin3 = min(t0, t1);
  let tmax3 = max(t0, t1);
  let tn = max(max(tmin3.x, tmin3.y), max(tmin3.z, 0.0));
  let tf = min(min(tmax3.x, tmax3.y), min(tmax3.z, tmax));
  return select(1e30, tn, tf >= tn);
}

fn hitTri(i: u32, ro: vec3f, rd: vec3f, tmax: f32) -> vec3f {
  let v0 = tris[i * 3u].xyz;
  let e1 = tris[i * 3u + 1u].xyz - v0;
  let e2 = tris[i * 3u + 2u].xyz - v0;
  let p = cross(rd, e2);
  let det = dot(e1, p);
  if (abs(det) < 1e-12) { return vec3f(-1.0); }
  let inv = 1.0 / det;
  let s = ro - v0;
  let u = dot(s, p) * inv;
  if (u < 0.0 || u > 1.0) { return vec3f(-1.0); }
  let q = cross(s, e1);
  let v = dot(rd, q) * inv;
  if (v < 0.0 || u + v > 1.0) { return vec3f(-1.0); }
  let t = dot(e2, q) * inv;
  if (t <= EPS || t >= tmax) { return vec3f(-1.0); }
  return vec3f(t, u, v);
}

fn traverse(ro: vec3f, rd: vec3f, tmaxIn: f32) -> Hit {
  var h: Hit;
  h.t = tmaxIn; h.tri = -1; h.u = 0.0; h.v = 0.0;
  let inv = 1.0 / rd;
  var stack: array<u32, 48>;
  var sp = 0u;
  var node = 0u;
  loop {
    let n0 = nodes[node * 2u];
    let n1 = nodes[node * 2u + 1u];
    let count = bitcast<u32>(n1.w);
    if (count > 0u) {
      let first = bitcast<u32>(n0.w);
      for (var i = first; i < first + count; i++) {
        let r = hitTri(i, ro, rd, h.t);
        if (r.x > 0.0) {
          // alpha cutout (leaves, grilles): sample the base texture's alpha and skip see-through hits
          let M = mats[i32(tris[i * 3u].w)];
          if (M.extra.y > 0.0 && M.base.w >= 0.0) {
            let w = 1.0 - r.y - r.z;
            let uv = (uvs[i * 3u] * w + uvs[i * 3u + 1u] * r.y + uvs[i * 3u + 2u] * r.z) * M.tex.z;
            if (textureSampleLevel(texArr, sampRepeat, uv, i32(M.base.w), 0.0).a < M.extra.y) { continue; }
          }
          h.t = r.x; h.tri = i32(i); h.u = r.y; h.v = r.z;
        }
      }
      if (sp == 0u) { break; }
      sp--; node = stack[sp];
      continue;
    }
    let left = bitcast<u32>(n0.w);
    let l0 = nodes[left * 2u]; let l1 = nodes[left * 2u + 1u];
    let r0 = nodes[(left + 1u) * 2u]; let r1 = nodes[(left + 1u) * 2u + 1u];
    var tl = hitBox(l0.xyz, l1.xyz, ro, inv, h.t);
    var tr = hitBox(r0.xyz, r1.xyz, ro, inv, h.t);
    var near = left; var far = left + 1u;
    if (tr < tl) { let tmp = tl; tl = tr; tr = tmp; near = left + 1u; far = left; }
    if (tl >= 1e30) {
      if (sp == 0u) { break; }
      sp--; node = stack[sp];
    } else {
      node = near;
      if (tr < 1e30) { stack[sp] = far; sp++; }
    }
  }
  return h;
}

// ---------------- environment ----------------
fn dirToUV(d: vec3f) -> vec2f {
  var u = 0.5 + atan2(d.z, d.x) * (0.5 / PI) + P.env.x * (0.5 / PI);
  u = fract(u);
  let v = acos(clamp(d.y, -1.0, 1.0)) / PI;
  return vec2f(u, v);
}
fn uvToDir(uv: vec2f) -> vec3f {
  let phi = (uv.x - 0.5) * 2.0 * PI - P.env.x;
  let theta = uv.y * PI;
  let st = sin(theta);
  return vec3f(cos(phi) * st, cos(theta), sin(phi) * st);
}
fn envFetch(uv: vec2f) -> vec3f {
  let W = i32(P.env.z); let H = i32(P.env.w);
  let fx = uv.x * f32(W) - 0.5; let fy = uv.y * f32(H) - 0.5;
  let x0 = i32(floor(fx)); let y0 = i32(floor(fy));
  let tx = fx - f32(x0); let ty = fy - f32(y0);
  let xa = (x0 + W) % W; let xb = (x0 + 1 + W) % W;
  let ya = clamp(y0, 0, H - 1); let yb = clamp(y0 + 1, 0, H - 1);
  let c00 = textureLoad(envTex, vec2i(xa, ya), 0).rgb;
  let c10 = textureLoad(envTex, vec2i(xb, ya), 0).rgb;
  let c01 = textureLoad(envTex, vec2i(xa, yb), 0).rgb;
  let c11 = textureLoad(envTex, vec2i(xb, yb), 0).rgb;
  return mix(mix(c00, c10, tx), mix(c01, c11, tx), ty);
}
fn envRadiance(d: vec3f) -> vec3f { return envFetch(dirToUV(d)) * P.env.y; }
fn lum(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }
// pdf (solid angle) of the env importance sampler for direction d
fn envPdf(d: vec3f) -> f32 {
  let W = i32(P.env.z); let H = i32(P.env.w);
  let uv = dirToUV(d);
  let x = clamp(i32(uv.x * f32(W)), 0, W - 1);
  let y = clamp(i32(uv.y * f32(H)), 0, H - 1);
  let sinT = sin(PI * (f32(y) + 0.5) / f32(H));
  let w = lum(textureLoad(envTex, vec2i(x, y), 0).rgb) * sinT + 1e-6;
  let pdfUV = w / P.misc.x * f32(W) * f32(H);
  return pdfUV / (2.0 * PI * PI * max(sinT, 1e-4));
}
// find i in [0,n) with cdf[i] <= xi < cdf[i+1]
fn searchMarg(xi: f32, n: u32) -> u32 {
  var lo = 0u; var hi = n;
  while (hi - lo > 1u) { let mid = (lo + hi) / 2u; if (envMarg[mid] <= xi) { lo = mid; } else { hi = mid; } }
  return lo;
}
fn searchCond(base: u32, xi: f32, n: u32) -> u32 {
  var lo = 0u; var hi = n;
  while (hi - lo > 1u) { let mid = (lo + hi) / 2u; if (envCond[base + mid] <= xi) { lo = mid; } else { hi = mid; } }
  return lo;
}
struct EnvSample { dir: vec3f, L: vec3f, pdf: f32 };
fn sampleEnv() -> EnvSample {
  let W = u32(P.env.z); let H = u32(P.env.w);
  let y = searchMarg(rnd(), H);
  let x = searchCond(y * (W + 1u), rnd(), W);
  // interpolate inside the texel
  let my0 = envMarg[y]; let my1 = envMarg[y + 1u];
  let cx0 = envCond[y * (W + 1u) + x]; let cx1 = envCond[y * (W + 1u) + x + 1u];
  let fy = (f32(y) + rnd()) / f32(H);
  let fx = (f32(x) + rnd()) / f32(W);
  let uv = vec2f(fx, fy);
  var s: EnvSample;
  s.dir = uvToDir(uv);
  let sinT = sin(PI * (f32(y) + 0.5) / f32(H));
  let w = lum(textureLoad(envTex, vec2i(i32(x), i32(y)), 0).rgb) * sinT + 1e-6;
  s.pdf = (w / P.misc.x * f32(W) * f32(H)) / (2.0 * PI * PI * max(sinT, 1e-4));
  s.L = envFetch(uv) * P.env.y;
  return s;
}

// ---------------- shading helpers ----------------
fn basis(n: vec3f) -> mat3x3f {
  let s = select(-1.0, 1.0, n.z >= 0.0);
  let a = -1.0 / (s + n.z);
  let b = n.x * n.y * a;
  let t = vec3f(1.0 + s * n.x * n.x * a, s * b, -s * n.x);
  let bt = vec3f(b, s + n.y * n.y * a, -n.y);
  return mat3x3f(t, bt, n);
}
fn ggxD(a: f32, nm: f32) -> f32 {
  let a2 = a * a;
  let d = nm * nm * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d);
}
fn smithG1(a: f32, nv: f32) -> f32 {
  let a2 = a * a;
  return 2.0 * nv / (nv + sqrt(a2 + (1.0 - a2) * nv * nv));
}
// Heitz 2018 VNDF sampling, local space (z up), wo.z > 0
fn sampleVNDF(wo: vec3f, a: f32, u1: f32, u2: f32) -> vec3f {
  let vh = normalize(vec3f(a * wo.x, a * wo.y, wo.z));
  let lensq = vh.x * vh.x + vh.y * vh.y;
  let T1 = select(vec3f(1.0, 0.0, 0.0), vec3f(-vh.y, vh.x, 0.0) / sqrt(lensq), lensq > 0.0);
  let T2 = cross(vh, T1);
  let r = sqrt(u1);
  let phi = 2.0 * PI * u2;
  let t1 = r * cos(phi);
  var t2 = r * sin(phi);
  let s = 0.5 * (1.0 + vh.z);
  t2 = (1.0 - s) * sqrt(max(0.0, 1.0 - t1 * t1)) + s * t2;
  let nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * vh;
  return normalize(vec3f(a * nh.x, a * nh.y, max(0.0, nh.z)));
}
fn fresnelDielectric(cosI_: f32, eta: f32) -> f32 {
  // eta = n_t / n_i ; cosI on the incident side
  let cosI = clamp(cosI_, 0.0, 1.0);
  let sinT2 = (1.0 - cosI * cosI) / (eta * eta);
  if (sinT2 >= 1.0) { return 1.0; }
  let cosT = sqrt(1.0 - sinT2);
  let rs = (cosI - eta * cosT) / (cosI + eta * cosT);
  let rp = (eta * cosI - cosT) / (eta * cosI + cosT);
  return 0.5 * (rs * rs + rp * rp);
}
fn cosineHemisphere(u1: f32, u2: f32) -> vec3f {
  let r = sqrt(u1); let phi = 2.0 * PI * u2;
  return vec3f(r * cos(phi), r * sin(phi), sqrt(max(0.0, 1.0 - u1)));
}
fn concentricDisk(u1: f32, u2: f32) -> vec2f {
  let a = 2.0 * u1 - 1.0; let b = 2.0 * u2 - 1.0;
  if (a == 0.0 && b == 0.0) { return vec2f(0.0); }
  var r: f32; var phi: f32;
  if (abs(a) > abs(b)) { r = a; phi = (PI / 4.0) * (b / a); } else { r = b; phi = (PI / 2.0) - (PI / 4.0) * (a / b); }
  return vec2f(r * cos(phi), r * sin(phi));
}
fn srgbToLinear(c: vec3f) -> vec3f {
  return pow(max(c, vec3f(0.0)), vec3f(2.2));
}

// Surface description at a hit
struct Surf {
  p: vec3f, ng: vec3f, ns: vec3f, albedo: vec3f, rough: f32, metallic: f32, ior: f32, transmission: f32,
  emission: vec3f, absorb: vec3f, matId: i32, f0: f32,
  sheen: f32, sheenTint: f32, cc: f32, ccRough: f32
};

fn surfaceAt(h: Hit, ro: vec3f, rd: vec3f) -> Surf {
  var s: Surf;
  let t = u32(h.tri);
  let p0 = tris[t * 3u]; let p1 = tris[t * 3u + 1u].xyz; let p2 = tris[t * 3u + 2u].xyz;
  let m = i32(p0.w);
  s.matId = m;
  let M = mats[m];
  let w = 1.0 - h.u - h.v;
  s.p = ro + rd * h.t;
  var ng = normalize(cross(p1 - p0.xyz, p2 - p0.xyz));
  var ns = normalize(nrms[t * 3u].xyz * w + nrms[t * 3u + 1u].xyz * h.u + nrms[t * 3u + 2u].xyz * h.v);
  // make shading normal consistent with geometric normal
  if (dot(ns, ng) < 0.0) { ng = -ng; }
  let uv0 = uvs[t * 3u]; let uv1 = uvs[t * 3u + 1u]; let uv2 = uvs[t * 3u + 2u];
  let uv = (uv0 * w + uv1 * h.u + uv2 * h.v) * M.tex.z;
  var albedo = M.base.rgb;
  var rough = M.phys.x;
  // texture LOD from the pixel footprint at this distance
  let foot = h.t * P.misc.z / max(abs(dot(ng, rd)), 0.2);
  let lod = log2(max(foot * M.tex.z * 2048.0, 1.0));
  if (M.base.w >= 0.0) {
    albedo *= srgbToLinear(textureSampleLevel(texArr, sampRepeat, uv, i32(M.base.w), lod).rgb);
  }
  var metallic = M.phys.y;
  if (M.tex.x >= 0.0) {
    let mr = textureSampleLevel(texArr, sampRepeat, uv, i32(M.tex.x), lod);
    if (M.extra.x > 0.5) { rough *= mr.g; metallic *= mr.b; }   // glTF packing: G roughness, B metallic
    else { rough *= mr.r; }
  }
  var emission = M.emit.rgb;
  if (M.extra.z >= 0.0) { emission *= srgbToLinear(textureSampleLevel(texArr, sampRepeat, uv, i32(M.extra.z), lod).rgb); }
  var wet = 0.0;
  if (M.tex.w > 0.5) {
    let wuv = (s.p.xz - P.wet.xy) / P.wet.z;
    if (wuv.x > 0.0 && wuv.x < 1.0 && wuv.y > 0.0 && wuv.y < 1.0) {
      // saturating response: a little water already darkens sand a lot
      wet = 1.0 - exp(-textureSampleLevel(wetTex, sampClamp, wuv, 0.0).r * P.wet.w);
    }
  }
  if (M.tex.y >= 0.0) {
    // tangent frame from the triangle's uv parametrisation
    let e1 = p1 - p0.xyz; let e2 = p2 - p0.xyz;
    let d1 = uv1 - uv0; let d2 = uv2 - uv0;
    let det = d1.x * d2.y - d2.x * d1.y;
    var T = (e1 * d2.y - e2 * d1.y);
    var B = (e2 * d1.x - e1 * d2.x);
    T = T - ns * dot(ns, T);
    B = B - ns * dot(ns, B);
    if (abs(det) > 1e-12 && dot(T, T) > 1e-20 && dot(B, B) > 1e-20) {
      T = normalize(T * sign(det));
      B = normalize(B * sign(det));
      var nm = textureSampleLevel(texArr, sampRepeat, uv, i32(M.tex.y), lod).rgb * 2.0 - 1.0;
      let strength = M.emit.w * (1.0 - 0.6 * wet); // wet sand: grains packed flat, less bumpy
      nm = normalize(vec3f(nm.xy * strength, nm.z));
      // grain micro-detail: per-0.35 mm cell random tilt, fading out where a pixel covers many grains
      let grain = M.absorb.w * clamp(1.0 - lod * 0.5, 0.0, 1.0) * (1.0 - 0.5 * wet);
      if (grain > 0.0) {
        let cellId = vec3i(floor(s.p / 0.00035));
        let hsh = (u32(cellId.x) * 73856093u) ^ (u32(cellId.y) * 19349663u) ^ (u32(cellId.z) * 83492791u);
        let r1 = f32((hsh * 747796405u + 2891336453u) >> 8u) * (1.0 / 16777216.0);
        let r2 = f32((hsh * 1664525u + 1013904223u) >> 8u) * (1.0 / 16777216.0);
        nm = normalize(nm + vec3f((r1 - 0.5) * grain, (r2 - 0.5) * grain, 0.0));
      }
      ns = normalize(T * nm.x + B * nm.y + ns * nm.z);
      if (dot(ns, ng) < 0.05) { ns = normalize(ns - ng * (dot(ns, ng) - 0.05)); }
    }
  }
  // wetness: water fills the pores -> darker (less multiple scattering escapes) and glossier
  albedo *= mix(1.0, 0.25, wet);
  rough = mix(rough, 0.35, wet);
  s.f0 = mix(0.04, 0.02, wet); // a thin water film reflects less than a dry grain surface
  s.ng = ng; s.ns = ns; s.albedo = albedo; s.rough = clamp(rough, 0.02, 1.0);
  s.metallic = metallic; s.ior = M.phys.z; s.transmission = M.phys.w;
  s.emission = emission; s.absorb = M.absorb.rgb;
  s.sheen = M.extra2.x; s.sheenTint = M.extra2.y; s.cc = M.extra2.z; s.ccRough = max(M.extra2.w, 0.03);
  return s;
}

// opaque BSDF eval in local frame (wo.z>0, wi.z>0): returns f, and pdf of sampling wi
struct Eval { f: vec3f, pdf: f32 };
fn evalOpaque(s: Surf, wo: vec3f, wi: vec3f, pSpec: f32, pCC: f32) -> Eval {
  var e: Eval; e.f = vec3f(0.0); e.pdf = 0.0;
  if (wo.z <= 0.0 || wi.z <= 0.0) { return e; }
  let a = max(s.rough * s.rough, 0.001);
  let hv = normalize(wo + wi);
  let F0 = mix(vec3f(s.f0), s.albedo, s.metallic);
  let voh = max(dot(wo, hv), 0.0);
  let F = F0 + (1.0 - F0) * pow(1.0 - voh, 5.0);
  let D = ggxD(a, hv.z);
  let G = smithG1(a, wo.z) * smithG1(a, wi.z);
  let spec = D * G * F / (4.0 * wo.z * wi.z);
  let diff = s.albedo * INV_PI * (1.0 - s.metallic) * (1.0 - F0);
  e.f = diff + spec;
  // sheen: fabric fibres catch light at grazing angles (Disney-style, tinted toward the albedo)
  if (s.sheen > 0.0) {
    let tint = mix(vec3f(1.0), s.albedo / max(lum(s.albedo), 1e-3), s.sheenTint);
    e.f += s.sheen * tint * pow(1.0 - voh, 5.0) * INV_PI * (1.0 - s.metallic);
  }
  // clearcoat: a thin glossy varnish layer (leather, lacquered wood) with its own roughness
  var pdfCC = 0.0;
  if (s.cc > 0.0) {
    let ac = s.ccRough * s.ccRough;
    let Dc = ggxD(ac, hv.z);
    let Gc = smithG1(ac, wo.z) * smithG1(ac, wi.z);
    let Fc = 0.04 + 0.96 * pow(1.0 - voh, 5.0);
    e.f += vec3f(s.cc * Dc * Gc * Fc / (4.0 * wo.z * wi.z));
    pdfCC = smithG1(ac, wo.z) * Dc / (4.0 * wo.z);
  }
  let pdfSpec = smithG1(a, wo.z) * D / (4.0 * wo.z);
  e.pdf = (1.0 - pSpec - pCC) * wi.z * INV_PI + pSpec * pdfSpec + pCC * pdfCC;
  return e;
}

fn offsetRay(p: vec3f, n: vec3f, dir: vec3f) -> vec3f {
  let side = select(-1.0, 1.0, dot(dir, n) > 0.0);
  return p + n * side * 2e-4;
}

// shadow ray with transparency through transmissive surfaces (a cheap stand-in for caustics)
fn shadowTransmittance(roIn: vec3f, rd: vec3f) -> vec3f { return shadowTransmittanceTo(roIn, rd, 1e30); }
fn shadowTransmittanceTo(roIn: vec3f, rd: vec3f, maxDist: f32) -> vec3f {
  var ro = roIn;
  var tr = vec3f(1.0);
  var remaining = maxDist;
  for (var k = 0; k < 8; k++) {
    let h = traverse(ro, rd, remaining);
    if (h.tri < 0) { return tr; }
    remaining -= h.t;
    let t = u32(h.tri);
    let m = i32(tris[t * 3u].w);
    let M = mats[m];
    if (M.phys.w <= 0.0) { return vec3f(0.0); }
    // with the photon map on, glass and water block shadow rays for real: focused light comes from photons
    if (P.misc.w > 0.5) { return vec3f(0.0); }
    let p = ro + rd * h.t;
    let p0 = tris[t * 3u].xyz; let p1 = tris[t * 3u + 1u].xyz; let p2 = tris[t * 3u + 2u].xyz;
    let ng = normalize(cross(p1 - p0, p2 - p0));
    let c = abs(dot(ng, rd));
    // Fresnel loss at the interface + a little extra for roughness scattering
    let F = fresnelDielectric(c, M.phys.z);
    tr *= (1.0 - F) * (1.0 - 0.3 * M.phys.x) * M.base.rgb;
    // absorption through the medium when exiting is handled approximately by distance between interfaces
    if (dot(rd, ng) > 0.0) { tr *= exp(-M.absorb.rgb * h.t); }
    if (max(tr.x, max(tr.y, tr.z)) < 0.01) { return vec3f(0.0); }
    ro = p + rd * 1e-4;
  }
  return tr;
}

// NaN or Inf test via the bit pattern (NaN != NaN may be folded away by the compiler)
fn isBad(x: f32) -> bool { return (bitcast<u32>(x) & 0x7fffffffu) >= 0x7f800000u; }

// caustic irradiance (W/m^2 in HDRI units) landing at world point p, bilinear from the photon map
fn causticAt(p: vec3f) -> f32 {
  if (P.misc.w < 0.5) { return 0.0; }
  let res = i32(P.caus.w);
  let fx = (p.x - P.caus.x) / P.caus.z * f32(res) - 0.5;
  let fz = (p.z - P.caus.y) / P.caus.z * f32(res) - 0.5;
  if (fx < 0.0 || fz < 0.0 || fx >= f32(res - 1) || fz >= f32(res - 1)) { return 0.0; }
  let x0 = i32(fx); let z0 = i32(fz); let tx = fx - f32(x0); let tz = fz - f32(z0);
  let a = causMap[x0 + res * z0]; let b = causMap[x0 + 1 + res * z0];
  let c = causMap[x0 + res * (z0 + 1)]; let d = causMap[x0 + 1 + res * (z0 + 1)];
  return mix(mix(a, b, tx), mix(c, d, tx), tz);
}

// ---------------- explicit lights: next event estimation ----------------
struct LightSample { dir: vec3f, dist: f32, L: vec3f, pdf: f32, delta: bool };

fn sampleLight(li: u32, p: vec3f) -> LightSample {
  var s: LightSample; s.pdf = 0.0; s.delta = false; s.L = vec3f(0.0); s.dist = 1e30; s.dir = vec3f(0.0, 1.0, 0.0);
  let lt = lights[li];
  let ty = i32(lt.p.w);
  if (ty == 2 || ty == 3) {
    let d = lt.p.xyz - p; let d2 = max(dot(d, d), 1e-8); let dist = sqrt(d2);
    s.dir = d / dist; s.dist = dist - 1e-4; s.delta = true; s.pdf = 1.0;
    var I = lt.L.rgb / d2;
    if (ty == 3) {
      let c = dot(-s.dir, lt.u.xyz);
      I *= smoothstep(lt.L.w, lt.e.x, c);
    }
    s.L = I;
    return s;
  }
  if (ty == 4) {
    // portal: importance-sample the sky (finds the sun), keep only directions that pass the opening
    let es = sampleEnv();
    if (es.pdf <= 0.0 || portalPdf(p, es.dir) <= 0.0) { return s; }
    s.dir = es.dir; s.L = es.L * lt.L.x; s.pdf = es.pdf; s.dist = 1e30;
    return s;
  }
  var q: vec3f; var n: vec3f; var area = lt.v.w;
  if (ty == 6) {
    // mesh light: pick a triangle by area (binary search on the cdf), then a uniform point on it
    let first = u32(lt.u.w); let count = u32(lt.e.z);
    let xi = rnd();
    var lo = 0u; var hi = count;
    while (hi - lo > 1u) { let mid = (lo + hi) / 2u; if (lightCdf[first + mid - 1u] <= xi) { lo = mid; } else { hi = mid; } }
    let t = (first + lo) * 9u;
    let a = vec3f(lightTris[t], lightTris[t + 1u], lightTris[t + 2u]);
    let b = vec3f(lightTris[t + 3u], lightTris[t + 4u], lightTris[t + 5u]);
    let c = vec3f(lightTris[t + 6u], lightTris[t + 7u], lightTris[t + 8u]);
    let r1 = sqrt(rnd()); let r2 = rnd();
    q = a * (1.0 - r1) + b * (r1 * (1.0 - r2)) + c * (r1 * r2);
    n = normalize(cross(b - a, c - a));
  } else if (ty == 0) {
    q = lt.p.xyz + lt.u.xyz * rnd() + lt.v.xyz * rnd();
    n = normalize(cross(lt.u.xyz, lt.v.xyz));
  } else if (ty == 1) {
    n = normalize(lt.v.xyz);
    let B = basis(n);
    let dsk = concentricDisk(rnd(), rnd()) * lt.u.w;
    q = lt.p.xyz + B * vec3f(dsk, 0.0);
  } else { // sphere
    let z = 1.0 - 2.0 * rnd(); let r = sqrt(max(0.0, 1.0 - z * z)); let ph = 2.0 * PI * rnd();
    n = vec3f(r * cos(ph), z, r * sin(ph));
    q = lt.p.xyz + n * lt.u.w;
  }
  let d = q - p; let d2 = max(dot(d, d), 1e-8); let dist = sqrt(d2);
  s.dir = d / dist; s.dist = dist - 2e-4;
  var cosL = dot(n, -s.dir);
  if (ty == 5) { if (cosL <= 0.0) { return s; } } else { cosL = abs(cosL); }
  if (cosL < 1e-4) { return s; }
  s.pdf = d2 / (cosL * area);
  if (ty == 4) { s.L = envRadiance(s.dir) * lt.L.x; } else { s.L = lt.L.rgb; }
  return s;
}

// pdf (solid angle) that the light sampler would have produced direction `dir` from `p` for an
// area light hit at distance `dist` with surface normal `n` (used for MIS on BSDF-sampled hits)
fn lightPdfArea(li: u32, dist: f32, cosL: f32) -> f32 {
  let lt = lights[li];
  return dist * dist / (max(abs(cosL), 1e-4) * lt.v.w);
}

// does a ray from p along dir pass through a portal light? returns its pdf (0 if none)
fn portalPdf(p: vec3f, dir: vec3f) -> f32 {
  let n = u32(P.lt.x);
  for (var i = 0u; i < n; i++) {
    let lt = lights[i];
    if (i32(lt.p.w) != 4) { continue; }
    let nrm = normalize(cross(lt.u.xyz, lt.v.xyz));
    let denom = dot(dir, nrm);
    if (abs(denom) < 1e-6) { continue; }
    let t = dot(lt.p.xyz - p, nrm) / denom;
    if (t <= 0.0) { continue; }
    let q = p + dir * t - lt.p.xyz;
    let uu = dot(q, lt.u.xyz) / dot(lt.u.xyz, lt.u.xyz);
    let vv = dot(q, lt.v.xyz) / dot(lt.v.xyz, lt.v.xyz);
    if (uu < 0.0 || uu > 1.0 || vv < 0.0 || vv > 1.0) { continue; }
    return t * t / (abs(denom) * lt.v.w);
  }
  return 0.0;
}

// ---------------- photon pass: light from the sky/sun through glass + water onto the sand ----------------
@compute @workgroup_size(256)
fn photons(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= u32(P.caus2.x)) { return; }
  rngState = i * 2654435761u + P.size.z * 97531u + 7u;
  rngState = pcg();
  // direction from the environment (importance sampled: mostly the sun), photon travels the other way
  let es = sampleEnv();
  if (es.pdf <= 0.0 || es.dir.y <= 0.02) { return; }
  let rd0 = -es.dir;
  // emitter: a horizontal rectangle above the caustic region
  let x = P.caus.x + rnd() * P.caus.z;
  let z = P.caus.y + rnd() * P.caus.z;
  let top = P.caus2.w;
  var ro = vec3f(x, top, z);
  // photon power: L * cos(theta) * A / (pdf * N) ; cos(theta) = |dir.y| for a horizontal emitter
  var flux = es.L * es.dir.y * P.caus2.y / (es.pdf * P.caus2.x);
  var rd = rd0;
  var inside = false;
  var specularHits = 0;
  for (var bounce = 0; bounce < 16; bounce++) {
    let h = traverse(ro, rd, 1e30);
    if (h.tri < 0) { return; }
    let s = surfaceAt(h, ro, rd);
    if (inside) { flux *= exp(-s.absorb * h.t); }
    if (s.transmission <= 0.0) {
      // a diffuse receiver: deposit only if the photon was bent by glass/water at least once
      if (specularHits == 0) { return; }
      let res = i32(P.caus.w);
      let fx = (s.p.x - P.caus.x) / P.caus.z * f32(res);
      let fz = (s.p.z - P.caus.y) / P.caus.z * f32(res);
      let cx = i32(floor(fx)); let cz = i32(floor(fz));
      if (cx < 0 || cz < 0 || cx >= res || cz >= res) { return; }
      let cellArea = (P.caus.z / f32(res)) * (P.caus.z / f32(res));
      let e = lum(flux) / cellArea;           // irradiance contribution (luminance; the map is scalar)
      let fixed = u32(clamp(e * P.caus2.z, 0.0, 4.0e9));
      atomicAdd(&causAcc[cx + res * cz], fixed);
      return;
    }
    // dielectric interaction, same model as the camera path
    let wo = -rd;
    var n = s.ns;
    let entering = dot(rd, s.ng) < 0.0;
    if (!entering) { n = -n; }
    let a = max(s.rough * s.rough, 0.0005);
    let B = basis(n);
    let woL = transpose(B) * wo;
    var m = vec3f(0.0, 0.0, 1.0);
    if (s.rough > 0.015) { m = sampleVNDF(woL, a, rnd(), rnd()); }
    let eta = select(1.0 / s.ior, s.ior, entering);
    let cosI = dot(woL, m);
    let F = fresnelDielectric(cosI, eta);
    var wiL: vec3f;
    if (rnd() < F) {
      wiL = reflect(-woL, m);
      if (wiL.z <= 0.0) { return; }
    } else {
      let etaI = 1.0 / eta;
      let k = 1.0 - etaI * etaI * (1.0 - cosI * cosI);
      if (k < 0.0) { wiL = reflect(-woL, m); } else {
        wiL = normalize(-woL * etaI + m * (etaI * cosI - sqrt(k)));
        if (wiL.z >= 0.0) { return; }
        flux *= s.albedo;
        inside = entering;
      }
    }
    if (s.rough > 0.015) { flux *= smithG1(a, abs(wiL.z)); }
    let wi = B * wiL;
    specularHits++;
    ro = offsetRay(s.p, s.ng, wi);
    rd = wi;
  }
}

// fixed point -> float map with a small blur (photon noise), run once after all photon passes
@compute @workgroup_size(256)
fn causticFinish(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x; let res = u32(P.caus.w);
  if (i >= res * res) { return; }
  let x = i32(i % res); let z = i32(i / res);
  var sum = 0.0; var wsum = 0.0;
  for (var dz = -2; dz <= 2; dz++) { for (var dx = -2; dx <= 2; dx++) {
    let xx = x + dx; let zz = z + dz;
    if (xx < 0 || zz < 0 || xx >= i32(res) || zz >= i32(res)) { continue; }
    let w = exp(-f32(dx * dx + dz * dz) / 2.5);
    sum += f32(atomicLoad(&causAcc[u32(xx) + res * u32(zz)])) * w; wsum += w;
  }}
  causMap[i] = sum / wsum / P.caus2.z;
}

@compute @workgroup_size(8, 8)
fn trace(@builtin(global_invocation_id) gid: vec3u) {
  let W = P.size.x; let H = P.size.y;
  if (gid.x >= W || gid.y >= H) { return; }
  let pix = gid.y * W + gid.x;
  let frame = P.size.z;
  rngState = pix * 9781u + frame * 6271u + 1u;
  rngState = pcg();

  // camera ray with pixel jitter and thin lens
  let jx = rnd(); let jy = rnd();
  let ndcX = ((f32(gid.x) + jx) / f32(W) * 2.0 - 1.0) * P.camPos.w * P.camFwd.w;
  let ndcY = (1.0 - (f32(gid.y) + jy) / f32(H) * 2.0) * P.camPos.w;
  var rd = normalize(P.camFwd.xyz + P.camRight.xyz * ndcX + P.camUp.xyz * ndcY);
  var ro = P.camPos.xyz;
  if (P.camRight.w > 0.0) {
    let focusT = P.camUp.w / dot(rd, P.camFwd.xyz);
    let fp = ro + rd * focusT;
    let lens = concentricDisk(rnd(), rnd()) * P.camRight.w;
    ro = ro + P.camRight.xyz * lens.x + P.camUp.xyz * lens.y;
    rd = normalize(fp - ro);
  }

  var L = vec3f(0.0);
  var Ldirect = vec3f(0.0);   // what the first hit contributes (direct light + emission + sky seen straight)
  var lastBounce = 0;
  var tp = vec3f(1.0);
  var lastPdf = 0.0;
  var specular = true;
  var gAlbedo = vec3f(0.0); var gNormal = vec3f(0.0); var gWritten = false;
  let maxB = i32(P.size.w);
  var inside = false;
  var diffuseSeen = false;
  var throughGlass = false;
  let useCaustics = P.misc.w > 0.5;

  for (var bounce = 0; bounce < maxB; bounce++) {
    lastBounce = bounce;
    if (bounce == 1) { Ldirect = L; }
    let h = traverse(ro, rd, 1e30);
    if (h.tri < 0) {
      let Le = envRadiance(rd);
      var w = 1.0;
      if (!specular) {
        // MIS against whichever strategy could have produced this direction: env sampling or a portal
        let pdfSel = 1.0 / max(P.lt.x + P.lt.y, 1.0);
        var pe = 0.0;
        if (P.lt.y > 0.5) { pe = envPdf(rd) * pdfSel; }
        else if (portalPdf(ro, rd) > 0.0) { pe = envPdf(rd) * pdfSel; } // portals sample the sky through the opening
        w = lastPdf * lastPdf / (lastPdf * lastPdf + pe * pe);
      }
      // diffuse -> glass/water -> sky paths are what the photon map already holds: skip them here.
      // Without a photon map, direct light through glass comes from NEE (shadow rays pass glass
      // with a Fresnel loss), so the same paths are dropped to avoid double counting + fireflies.
      if (specular && diffuseSeen && (useCaustics || throughGlass)) { w = 0.0; }
      L += tp * Le * w;
      if (!gWritten) { gAlbedo = vec3f(1.0); gNormal = -rd; gWritten = true; }
      break;
    }
    var s = surfaceAt(h, ro, rd);
    if (inside) { tp *= exp(-s.absorb * h.t); }
    // opaque surfaces: the geometric normal always faces the ray, whatever the mesh winding
    if (s.transmission <= 0.0 && dot(rd, s.ng) > 0.0) { s.ng = -s.ng; s.ns = -s.ns; }
    {
      // emissive surface: area lights carry a light index and get MIS against the light sampler
      var we = 1.0;
      let lix = mats[s.matId].extra.w;
      if (lix > 0.5 && !specular) {
        let pdfSel = 1.0 / max(P.lt.x + P.lt.y, 1.0);
        let pl = lightPdfArea(u32(lix - 1.0), h.t, dot(s.ng, rd)) * pdfSel;
        we = lastPdf * lastPdf / (lastPdf * lastPdf + pl * pl);
      }
      L += tp * s.emission * we;
    }
    let wo = -rd;
    var n = s.ns;
    let entering = dot(rd, s.ng) < 0.0;
    if (!entering) { n = -n; }

    if (s.transmission > 0.0) {
      // rough dielectric
      if (!gWritten) { gAlbedo = vec3f(1.0); gNormal = s.ns; gWritten = true; }
      let a = max(s.rough * s.rough, 0.0005);
      let B = basis(n);
      let woL = transpose(B) * wo;
      var m = vec3f(0.0, 0.0, 1.0);
      if (s.rough > 0.015) { m = sampleVNDF(woL, a, rnd(), rnd()); }
      let eta = select(1.0 / s.ior, s.ior, entering); // n_t / n_i
      let cosI = dot(woL, m);
      let F = fresnelDielectric(cosI, eta);
      var wiL: vec3f;
      var weight = vec3f(1.0);
      if (rnd() < F) {
        wiL = reflect(-woL, m);
        if (wiL.z <= 0.0) { break; }
      } else {
        let etaI = 1.0 / eta; // ratio n_i/n_t for refract()
        let k = 1.0 - etaI * etaI * (1.0 - cosI * cosI);
        if (k < 0.0) { wiL = reflect(-woL, m); } else {
          wiL = normalize(-woL * etaI + m * (etaI * cosI - sqrt(k)));
          if (wiL.z >= 0.0) { break; }
          weight *= s.albedo;
          inside = entering;
        }
      }
      if (s.rough > 0.015) { weight *= smithG1(a, abs(wiL.z)); }
      let wi = B * wiL;
      tp *= weight;
      specular = true;
      if (diffuseSeen) { throughGlass = true; }
      ro = offsetRay(s.p, s.ng, wi);
      rd = wi;
    } else {
      // opaque: diffuse + GGX
      if (!gWritten) { gAlbedo = s.albedo; gNormal = s.ns; gWritten = true; }
      let B = basis(n);
      let woL = transpose(B) * wo;
      if (woL.z <= 0.0) { break; }
      // focused light from the photon map (sun through the bottle and the water)
      if (useCaustics) { L += tp * s.albedo * INV_PI * causticAt(s.p) * (1.0 - s.metallic); }
      diffuseSeen = true;
      let F0 = mix(vec3f(0.04), s.albedo, s.metallic);
      let pCC = select(0.0, 0.2 * clamp(s.cc, 0.0, 1.0), s.cc > 0.0);
      let pSpec = clamp(mix(0.12, 0.55, 1.0 - s.rough) + s.metallic, 0.05, 1.0 - pCC);
      // next event estimation: pick one strategy uniformly among the explicit lights and (if enabled) the sky
      let nStrat = P.lt.x + P.lt.y;
      if (nStrat > 0.5) {
        let pdfSel = 1.0 / nStrat;
        let k = min(u32(rnd() * nStrat), u32(nStrat) - 1u);
        var ldir: vec3f; var lL: vec3f; var lpdf: f32; var ldist = 1e30; var delta = false;
        if (k < u32(P.lt.x)) {
          let ls = sampleLight(k, s.p);
          ldir = ls.dir; lL = ls.L; lpdf = ls.pdf; ldist = ls.dist; delta = ls.delta;
        } else {
          let es = sampleEnv();
          ldir = es.dir; lL = es.L; lpdf = es.pdf;
        }
        let wiEL = transpose(B) * ldir;
        if (lpdf > 0.0 && wiEL.z > 0.0 && dot(ldir, s.ng) > 0.0) {
          let ev = evalOpaque(s, woL, wiEL, pSpec, pCC);
          if (ev.pdf > 0.0) {
            let tr = shadowTransmittanceTo(offsetRay(s.p, s.ng, ldir), ldir, ldist);
            if (max(tr.x, max(tr.y, tr.z)) > 0.0) {
              let pl = lpdf * pdfSel;
              var w = 1.0;
              if (!delta) { w = pl * pl / (pl * pl + ev.pdf * ev.pdf); }
              L += tp * lL * tr * ev.f * wiEL.z / pl * w;
            }
          }
        }
      }
      // sample the BSDF
      var wiL: vec3f;
      let uLobe = rnd();
      if (uLobe < pCC) {
        let ac = s.ccRough * s.ccRough;
        let m = sampleVNDF(woL, ac, rnd(), rnd());
        wiL = reflect(-woL, m);
      } else if (uLobe < pCC + pSpec) {
        let a = max(s.rough * s.rough, 0.001);
        let m = sampleVNDF(woL, a, rnd(), rnd());
        wiL = reflect(-woL, m);
      } else {
        wiL = cosineHemisphere(rnd(), rnd());
      }
      if (wiL.z <= 0.0) { break; }
      let ev = evalOpaque(s, woL, wiL, pSpec, pCC);
      if (ev.pdf <= 0.0) { break; }
      let wi = B * wiL;
      if (dot(wi, s.ng) <= 0.0) { break; }
      tp *= ev.f * wiL.z / ev.pdf;
      lastPdf = ev.pdf;
      specular = false;
      ro = offsetRay(s.p, s.ng, wi);
      rd = wi;
    }
    // russian roulette (starts at render.rrStart; earlier = faster and noisier)
    if (f32(bounce) >= P.lt.z) {
      let q = clamp(max(tp.x, max(tp.y, tp.z)), 0.05, 0.95);
      if (rnd() > q) { break; }
      tp /= q;
    }
  }
  // clamp fireflies a little (per-sample luminance clamp)
  // fireflies: the whole sample is clamped at render.clamp, and what arrived through bounces (indirect light)
  // is clamped harder at a quarter of that - a lone bright bounce is noise, not light
  if (lastBounce == 0) { Ldirect = L; }
  let indirect = L - Ldirect;
  let li = lum(indirect);
  if (li > P.lt.w * 0.25) { L = Ldirect + indirect * (P.lt.w * 0.25 / li); }
  let lm = lum(L);
  if (lm > P.lt.w) { L *= P.lt.w / lm; }
  // NaN/Inf guard (a single bad sample would otherwise spread through the denoiser)
  if (isBad(L.x) || isBad(L.y) || isBad(L.z)) { L = vec3f(0.0); }
  if (isBad(gNormal.x) || isBad(gNormal.y) || isBad(gNormal.z)) { gNormal = vec3f(0.0, 1.0, 0.0); }
  if (isBad(gAlbedo.x) || isBad(gAlbedo.y) || isBad(gAlbedo.z)) { gAlbedo = vec3f(0.5); }
  let prev = accum[pix];
  accum[pix] = vec4f(prev.rgb + L, prev.w + 1.0);
  let gp = gbuf[pix * 2u]; let gn = gbuf[pix * 2u + 1u];
  gbuf[pix * 2u] = vec4f(gp.rgb + gAlbedo, 1.0);
  gbuf[pix * 2u + 1u] = vec4f(gn.xyz + gNormal, 1.0);
}
