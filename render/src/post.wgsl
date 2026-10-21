// hb-render post: edge-aware a-trous wavelet denoise (guided by first-hit albedo + normal),
// then exposure + ACES filmic tone map + sRGB encode into packed RGBA8.

struct PostParams {
  size: vec4u,   // width, height, stepSize, flags (1 = denoise this pass)
  k: vec4f,      // exposure, sigmaColor, sigmaNormal, sigmaAlbedo
};
@group(0) @binding(0) var<uniform> Q: PostParams;
@group(0) @binding(1) var<storage, read> accum: array<vec4f>;
@group(0) @binding(2) var<storage, read> gbuf: array<vec4f>;
@group(0) @binding(3) var<storage, read> src: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> dst: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> outRGBA: array<u32>;

// accum -> radiance (divide by sample count), demodulate albedo so the filter works on lighting
@compute @workgroup_size(8, 8)
fn prepare(@builtin(global_invocation_id) gid: vec3u) {
  _ = src[0]; _ = outRGBA[0]; // keep every binding in the auto layout
  let W = Q.size.x; let H = Q.size.y;
  if (gid.x >= W || gid.y >= H) { return; }
  let i = gid.y * W + gid.x;
  let a = accum[i];
  let c = a.rgb / max(a.w, 1.0);
  let alb = gbuf[i * 2u].rgb / max(gbuf[i * 2u].w, 1.0);
  dst[i] = vec4f(c / max(alb, vec3f(0.02)), 1.0);
}

const KER = array<f32, 5>(1.0 / 16.0, 1.0 / 4.0, 3.0 / 8.0, 1.0 / 4.0, 1.0 / 16.0);

@compute @workgroup_size(8, 8)
fn atrous(@builtin(global_invocation_id) gid: vec3u) {
  _ = outRGBA[0];
  let W = Q.size.x; let H = Q.size.y;
  if (gid.x >= W || gid.y >= H) { return; }
  let i = gid.y * W + gid.x;
  let step = i32(Q.size.z);
  let c0 = src[i].rgb;
  let n0 = normalize(gbuf[i * 2u + 1u].xyz + vec3f(1e-6));
  let a0 = gbuf[i * 2u].rgb / max(gbuf[i * 2u].w, 1.0);
  let spp = max(accum[i].w, 1.0);
  // less filtering as more samples arrive
  let sigC = Q.k.y * sqrt(64.0 / spp);
  var sum = vec3f(0.0); var wsum = 0.0;
  for (var dy = -2; dy <= 2; dy++) {
    for (var dx = -2; dx <= 2; dx++) {
      let x = i32(gid.x) + dx * step; let y = i32(gid.y) + dy * step;
      if (x < 0 || y < 0 || x >= i32(W) || y >= i32(H)) { continue; }
      let j = u32(y) * W + u32(x);
      let c = src[j].rgb;
      let n = normalize(gbuf[j * 2u + 1u].xyz + vec3f(1e-6));
      let a = gbuf[j * 2u].rgb / max(gbuf[j * 2u].w, 1.0);
      let dc = c - c0; let wc = exp(-dot(dc, dc) / (sigC * sigC + 1e-6));
      let wn = pow(max(dot(n, n0), 0.0), Q.k.z);
      let da = a - a0; let wa = exp(-dot(da, da) / (Q.k.w * Q.k.w + 1e-6));
      let w = KER[dx + 2] * KER[dy + 2] * wc * wn * wa;
      sum += c * w; wsum += w;
    }
  }
  dst[i] = vec4f(sum / max(wsum, 1e-6), 1.0);
}

fn aces(x: vec3f) -> vec3f {
  let a = 2.51; let b = 0.03; let c = 2.43; let d = 0.59; let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3f(0.0), vec3f(1.0));
}
fn linearToSrgb(c: vec3f) -> vec3f {
  let lo = c * 12.92;
  let hi = 1.055 * pow(c, vec3f(1.0 / 2.4)) - 0.055;
  return select(hi, lo, c <= vec3f(0.0031308));
}

@compute @workgroup_size(8, 8)
fn tonemap(@builtin(global_invocation_id) gid: vec3u) {
  _ = dst[0];
  let W = Q.size.x; let H = Q.size.y;
  if (gid.x >= W || gid.y >= H) { return; }
  let i = gid.y * W + gid.x;
  var c: vec3f;
  if ((Q.size.w & 1u) == 1u) {
    let alb = gbuf[i * 2u].rgb / max(gbuf[i * 2u].w, 1.0);
    c = src[i].rgb * max(alb, vec3f(0.02));
  } else {
    let a = accum[i];
    c = a.rgb / max(a.w, 1.0);
  }
  c = aces(c * Q.k.x);
  let s = linearToSrgb(c);
  let r = u32(clamp(s.r, 0.0, 1.0) * 255.0 + 0.5);
  let g = u32(clamp(s.g, 0.0, 1.0) * 255.0 + 0.5);
  let b = u32(clamp(s.b, 0.0, 1.0) * 255.0 + 0.5);
  outRGBA[i] = r | (g << 8u) | (b << 16u) | (255u << 24u);
}
