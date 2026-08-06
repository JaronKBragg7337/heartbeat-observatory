/* ============================================================================
   core.js — math, WebGL device, shading model, mesh upload, culling
   No dependencies. Namespace: window.TOWN (T)
   ========================================================================== */
(function () {
"use strict";
const T = (window.TOWN = window.TOWN || {});

/* ---------------------------------------------------------------- RNG ---- */
T.rng = function (seed) {
  let s = (seed >>> 0) || 88675123;
  return function () {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
};
T.pick = (r, arr) => arr[Math.min(arr.length - 1, (r() * arr.length) | 0)];
T.rr = (r, a, b) => a + r() * (b - a);
T.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
T.lerp = (a, b, t) => a + (b - a) * t;

/* --------------------------------------------------------------- mat4 ---- */
const m4 = (T.m4 = {
  create() { return new Float32Array(16); },
  ident(o) { o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o; },
  persp(o, fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy * 0.5); o.fill(0);
    o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = (2 * f * n) / (n - f);
    return o;
  },
  ortho(o, l, r, b, t, n, f) {
    o.fill(0);
    o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n); o[15] = 1;
    o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n);
    return o;
  },
  mul(o, a, b) {
    for (let c = 0; c < 4; c++) {
      const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
      o[c * 4 + 0] = a[0] * b0 + a[4] * b1 + a[8]  * b2 + a[12] * b3;
      o[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9]  * b2 + a[13] * b3;
      o[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
      o[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
    return o;
  },
  lookAt(o, ex, ey, ez, cx, cy, cz, ux, uy, uz) {
    let zx = ex - cx, zy = ey - cy, zz = ez - cz;
    let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx;
    l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
    o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
    o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * ex + xy * ey + xz * ez);
    o[13] = -(yx * ex + yy * ey + yz * ez);
    o[14] = -(zx * ex + zy * ey + zz * ez);
    o[15] = 1;
    return o;
  },
});

/* ------------------------------------------------------------ frustum ---- */
T.frustum = function (vp, out) {
  const p = out || new Float32Array(24);
  for (let i = 0; i < 3; i++) {
    // left/right, bottom/top, near/far from rows of the view-projection
    for (let s = 0; s < 2; s++) {
      const sg = s ? -1 : 1, o = (i * 2 + s) * 4;
      p[o]     = vp[3]  + sg * vp[i];
      p[o + 1] = vp[7]  + sg * vp[4 + i];
      p[o + 2] = vp[11] + sg * vp[8 + i];
      p[o + 3] = vp[15] + sg * vp[12 + i];
      const l = Math.hypot(p[o], p[o + 1], p[o + 2]) || 1;
      p[o] /= l; p[o + 1] /= l; p[o + 2] /= l; p[o + 3] /= l;
    }
  }
  return p;
};
T.aabbVisible = function (p, b) { // b = [minx,miny,minz,maxx,maxy,maxz]
  for (let i = 0; i < 6; i++) {
    const o = i * 4, nx = p[o], ny = p[o + 1], nz = p[o + 2];
    const x = nx > 0 ? b[3] : b[0], y = ny > 0 ? b[4] : b[1], z = nz > 0 ? b[5] : b[2];
    if (nx * x + ny * y + nz * z + p[o + 3] < 0) return false;
  }
  return true;
};

/* ============================================================== device === */
const GL = (T.GL = {
  gl: null, canvas: null, w: 1, h: 1, dpr: 1, isGL2: false,
  drawCalls: 0, tris: 0,

  init(canvas) {
    this.canvas = canvas;
    const opts = { antialias: true, alpha: false, depth: true, stencil: false,
                   powerPreference: "high-performance", preserveDrawingBuffer: true };
    let gl = canvas.getContext("webgl2", opts);
    this.isGL2 = !!gl;
    if (!gl) {
      gl = canvas.getContext("webgl", opts) || canvas.getContext("experimental-webgl", opts);
      if (!gl) throw new Error("WebGL unavailable");
      this.extUint = gl.getExtension("OES_element_index_uint");
      gl.getExtension("OES_standard_derivatives");
    }
    this.gl = gl;
    this.aniso = gl.getExtension("EXT_texture_filter_anisotropic") ||
                 gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
    this.maxAniso = this.aniso ? gl.getParameter(this.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1;
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0.55, 0.68, 0.82, 1);
    this.resize();
    return gl;
  },

  resize() {
    const c = this.canvas;
    // cap DPR on phones so a 3x panel doesn't melt the GPU
    const raw = window.devicePixelRatio || 1;
    const dpr = Math.min(raw, T.mobile ? 2 : 2);
    const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (w === this.w && h === this.h && dpr === this.dpr) return false;
    this.dpr = dpr; this.w = c.width = w; this.h = c.height = h;
    this.gl.viewport(0, 0, w, h);
    return true;
  },
});

/* ------------------------------------------------------------ program ---- */
function compile(gl, type, src, name) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(name + ": " + gl.getShaderInfoLog(s) + "\n" + src);
  return s;
}
T.Program = function (vs, fs, name) {
  const gl = GL.gl, p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs, name + ".vs"));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs, name + ".fs"));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(name + ": " + gl.getProgramInfoLog(p));
  this.p = p; this.u = {}; this.a = {};
  const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < nu; i++) { const n = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, ""); this.u[n] = gl.getUniformLocation(p, n); }
  const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < na; i++) { const n = gl.getActiveAttrib(p, i).name; this.a[n] = gl.getAttribLocation(p, n); }
  this.use = () => { gl.useProgram(p); return this; };
};

/* ============================================================== shading ==
   One forward PBR pass. Cook-Torrance GGX + Smith-Schlick, hemispheric
   ambient, height fog, ACES-ish tonemap, sRGB out. Texture alpha carries a
   per-texel roughness modulation (uAlphaMode 0) or foliage coverage (mode 1).
   ======================================================================== */
const VS = `
precision highp float;
attribute vec3 aPos; attribute vec3 aNor; attribute vec2 aUV; attribute vec4 aCol;
uniform mat4 uVP, uModel; uniform vec3 uCam, uTint; uniform vec2 uFog;
varying vec3 vW, vN, vC; varying vec2 vUV; varying float vAO, vFog;
void main(){
  vec4 wp = uModel * vec4(aPos, 1.0);
  vW = wp.xyz; vN = mat3(uModel) * aNor; vUV = aUV; vC = aCol.rgb * uTint; vAO = aCol.a;
  float d = length(vW - uCam);
  vFog = clamp((d - uFog.x) / max(uFog.y - uFog.x, 1.0), 0.0, 1.0);
  gl_Position = uVP * wp;
}`;

const FS = `
precision highp float;
varying vec3 vW, vN, vC; varying vec2 vUV; varying float vAO, vFog;
uniform sampler2D uTex;
uniform vec3 uSunDir, uSunCol, uSkyCol, uGndCol, uFogCol, uCam;
uniform float uRough, uMetal, uAlphaMode, uEmit, uOpacity, uDecal;
uniform vec4 uLamps[8];       // xyz = position, w = radius (0 = off)
uniform vec3 uLampCol;

void main(){
  vec4 t = texture2D(uTex, vUV);
  if (uAlphaMode > 0.5 && t.a < 0.5) discard;
  if (uDecal > 0.5) {
    // multiply decal: the texture IS the modulation, never shade it
    gl_FragColor = vec4(mix(t.rgb, vec3(1.0), vFog * 0.9), 1.0);
    return;
  }
  vec3 albedo = t.rgb * t.rgb * vC * vC;                    // approx sRGB->linear
  float rough = clamp(uRough * (uAlphaMode > 0.5 ? 1.0 : (0.55 + 0.9 * t.a)), 0.045, 1.0);

  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vW);
  if (dot(N, V) < 0.0 && uAlphaMode > 0.5) N = -N;          // two-sided foliage
  vec3 L = uSunDir, H = normalize(L + V);
  float NdL = max(dot(N, L), 0.0), NdV = max(dot(N, V), 1e-4);
  float NdH = max(dot(N, H), 0.0), VdH = max(dot(V, H), 0.0);

  vec3 F0 = mix(vec3(0.04), albedo, uMetal);
  float a = rough * rough, a2 = a * a;
  float dn = NdH * NdH * (a2 - 1.0) + 1.0;
  float D = a2 / (3.14159265 * dn * dn);
  float k = (rough + 1.0) * (rough + 1.0) * 0.125;
  float G = (NdL / (NdL * (1.0 - k) + k)) * (NdV / (NdV * (1.0 - k) + k));
  vec3  F = F0 + (1.0 - F0) * pow(1.0 - VdH, 5.0);
  vec3 spec = (D * G) * F / (4.0 * NdL * NdV + 1e-4) * NdL;
  vec3 kd = (1.0 - F) * (1.0 - uMetal);

  vec3 col = (kd * albedo / 3.14159265 * NdL + spec) * uSunCol;

  float hemi = 0.5 + 0.5 * N.y;
  vec3 amb = mix(uGndCol, uSkyCol, hemi) * vAO;
  col += albedo * amb;
  // cheap spec ambient so glass and metal don't read flat
  col += F0 * uSkyCol * (1.0 - rough) * vAO * 0.6;

  for (int i = 0; i < 8; i++) {
    if (uLamps[i].w <= 0.0) continue;
    vec3 d = uLamps[i].xyz - vW;
    float dist = length(d);
    float att = max(0.0, 1.0 - dist / uLamps[i].w); att *= att;
    // half-lambert: a ceiling fixture still puts light on the ceiling
    float nl = dot(N, d / max(dist, 0.001)) * 0.5 + 0.5;
    col += albedo * uLampCol * att * nl * nl;
  }

  col += albedo * uEmit;
  col = mix(col, uFogCol, vFog);
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);   // ACES fit
  gl_FragColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(0.4545)), uOpacity);
}`;

/* flat-colour shader for the inspection layer (lines / boxes) */
const LVS = `precision highp float; attribute vec3 aPos; attribute vec4 aCol;
uniform mat4 uVP; varying vec4 vC; void main(){ vC = aCol; gl_Position = uVP * vec4(aPos,1.0); }`;
const LFS = `precision highp float; varying vec4 vC; uniform float uAlpha;
void main(){ gl_FragColor = vec4(vC.rgb, vC.a * uAlpha); }`;

/* sky dome gradient */
const SVS = `precision highp float; attribute vec3 aPos; uniform mat4 uVP; uniform vec3 uCam;
varying vec3 vD; void main(){ vD = aPos; vec4 p = uVP * vec4(aPos * 900.0 + uCam, 1.0); gl_Position = p.xyww; }`;
const SFS = `precision highp float; varying vec3 vD;
uniform vec3 uSkyCol, uHorizCol, uSunDir, uSunCol;
void main(){
  vec3 d = normalize(vD);
  float h = clamp(d.y * 1.6 + 0.06, 0.0, 1.0);
  vec3 c = mix(uHorizCol, uSkyCol, pow(h, 0.62));
  float s = max(dot(d, uSunDir), 0.0);
  c += uSunCol * (pow(s, 220.0) * 6.0 + pow(s, 8.0) * 0.16);
  c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
  gl_FragColor = vec4(pow(clamp(c, 0.0, 1.0), vec3(0.4545)), 1.0);
}`;

T.shaders = { VS, FS, LVS, LFS, SVS, SFS };

/* ============================================================== meshes === */
/* A Mesh is one interleaved VBO + IBO with per-material index ranges.
   Vertex: pos3 nor3 uv2 col4  =  12 floats = 48 bytes                       */
const STRIDE = 48;

T.Mesh = function (buckets) {
  const gl = GL.gl;
  let nv = 0, ni = 0;
  for (const b of buckets) { nv += b.pos.length / 3; ni += b.idx.length; }
  this.groups = []; this.vertCount = nv; this.indexCount = ni;
  this.bounds = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  if (!ni) { this.empty = true; return; }

  const vdata = new Float32Array(nv * 12);
  const use32 = nv > 65535;
  if (use32 && !GL.isGL2 && !GL.extUint) console.warn("32-bit indices unsupported");
  const idata = use32 ? new Uint32Array(ni) : new Uint16Array(ni);
  this.idxType = use32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
  const isz = use32 ? 4 : 2;

  let vo = 0, io = 0, base = 0;
  for (const b of buckets) {
    const n = b.pos.length / 3;
    for (let i = 0; i < n; i++) {
      const x = b.pos[i * 3], y = b.pos[i * 3 + 1], z = b.pos[i * 3 + 2];
      if (x < this.bounds[0]) this.bounds[0] = x; if (y < this.bounds[1]) this.bounds[1] = y;
      if (z < this.bounds[2]) this.bounds[2] = z; if (x > this.bounds[3]) this.bounds[3] = x;
      if (y > this.bounds[4]) this.bounds[4] = y; if (z > this.bounds[5]) this.bounds[5] = z;
      const o = vo + i * 12;
      vdata[o] = x; vdata[o + 1] = y; vdata[o + 2] = z;
      vdata[o + 3] = b.nor[i * 3]; vdata[o + 4] = b.nor[i * 3 + 1]; vdata[o + 5] = b.nor[i * 3 + 2];
      vdata[o + 6] = b.uv[i * 2]; vdata[o + 7] = b.uv[i * 2 + 1];
      vdata[o + 8] = b.col[i * 4]; vdata[o + 9] = b.col[i * 4 + 1];
      vdata[o + 10] = b.col[i * 4 + 2]; vdata[o + 11] = b.col[i * 4 + 3];
    }
    for (let i = 0; i < b.idx.length; i++) idata[io + i] = b.idx[i] + base;
    this.groups.push({ mat: b.mat, offset: io * isz, count: b.idx.length });
    vo += n * 12; io += b.idx.length; base += n;
  }

  this.vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vdata, gl.STATIC_DRAW);
  this.ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idata, gl.STATIC_DRAW);
  this.bytes = vdata.byteLength + idata.byteLength;
};

T.Mesh.prototype.bind = function (prog) {
  const gl = GL.gl;
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
  const a = prog.a;
  gl.enableVertexAttribArray(a.aPos); gl.vertexAttribPointer(a.aPos, 3, gl.FLOAT, false, STRIDE, 0);
  gl.enableVertexAttribArray(a.aNor); gl.vertexAttribPointer(a.aNor, 3, gl.FLOAT, false, STRIDE, 12);
  gl.enableVertexAttribArray(a.aUV);  gl.vertexAttribPointer(a.aUV,  2, gl.FLOAT, false, STRIDE, 24);
  gl.enableVertexAttribArray(a.aCol); gl.vertexAttribPointer(a.aCol, 4, gl.FLOAT, false, STRIDE, 32);
};

T.Mesh.prototype.free = function () {
  const gl = GL.gl;
  if (this.vbo) gl.deleteBuffer(this.vbo);
  if (this.ibo) gl.deleteBuffer(this.ibo);
  this.vbo = this.ibo = null; this.empty = true;
};

/* ------------------------------------------------------- dynamic lines --- */
T.LineBatch = function () {
  const gl = GL.gl;
  this.vbo = gl.createBuffer(); this.data = []; this.count = 0;
  this.clear = function () { this.data.length = 0; this.count = 0; };
  this.line = function (x0, y0, z0, x1, y1, z1, c) {
    this.data.push(x0, y0, z0, c[0], c[1], c[2], c[3], x1, y1, z1, c[0], c[1], c[2], c[3]);
    this.count += 2;
  };
  this.box = function (b, c) {
    const [a0, a1, a2, a3, a4, a5] = b;
    const P = [[a0,a1,a2],[a3,a1,a2],[a3,a1,a5],[a0,a1,a5],[a0,a4,a2],[a3,a4,a2],[a3,a4,a5],[a0,a4,a5]];
    const E = [0,1,1,2,2,3,3,0, 4,5,5,6,6,7,7,4, 0,4,1,5,2,6,3,7];
    for (let i = 0; i < E.length; i += 2) this.line(...P[E[i]], ...P[E[i + 1]], c);
  };
  this.upload = function () {
    if (!this.count) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.data), gl.DYNAMIC_DRAW);
  };
  this.draw = function (prog) {
    if (!this.count) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(prog.a.aPos); gl.vertexAttribPointer(prog.a.aPos, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(prog.a.aCol); gl.vertexAttribPointer(prog.a.aCol, 4, gl.FLOAT, false, 28, 12);
    gl.drawArrays(gl.LINES, 0, this.count);
    GL.drawCalls++;
  };
};

T.mobile = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent) ||
           (navigator.maxTouchPoints > 1 && !/Windows NT/.test(navigator.userAgent));

/* quality dial — one place that decides how much geometry the town costs */
T.Q = {
  bevel: true,          // chamfer exposed edges (44 tris vs 12 per box)
  bevelMin: 0.05,       // don't chamfer anything smaller than this
  foliage: 3,           // cross-cards per tree canopy
  bookStep: 0.036,      // shelf fill density
  detailDist: 105,      // tertiary-detail draw distance
  interiorDist: 46,
};
if (T.mobile) Object.assign(T.Q, { bevel: false, foliage: 2, bookStep: 0.06, detailDist: 70, interiorDist: 38 });
/* let it be forced from the URL: ?q=high / ?q=low */
{
  const q = new URLSearchParams(location.search).get("q");
  if (q === "low") Object.assign(T.Q, { bevel: false, foliage: 2, bookStep: 0.07, detailDist: 55, interiorDist: 34 });
  if (q === "high") Object.assign(T.Q, { bevel: true, foliage: 3, bookStep: 0.036, detailDist: 140, interiorDist: 55 });
}
})();
