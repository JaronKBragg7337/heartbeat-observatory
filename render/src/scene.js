// hb-render: scene language (JSON) -> renderable data. Runs in the browser.
// Builds geometry from the object list, runs the fluid to the requested time, extracts the
// water surface, bakes the sand wetness map, flattens everything, and builds the BVH.

import { m4, v3, lathe, bottle, sphere, box, heightfield, transformMesh, flattenMeshes, makeMesh, computeNormals } from './mesh.js';

// disc in the XZ plane facing -Y... built facing +Y then oriented with lookAlong(normal)
function discMesh(radius, seg) {
  const pos = [0, 0, 0], uv = [0.5, 0.5], idx = [];
  for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; pos.push(Math.cos(a) * radius, 0, Math.sin(a) * radius); uv.push(0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a)); }
  for (let i = 1; i <= seg; i++) idx.push(0, i + 1, i);
  const m = makeMesh(pos, new Array(pos.length).fill(0), uv, idx);
  for (let i = 0; i < pos.length / 3; i++) { m.nrm[i * 3 + 1] = 1; }
  return m;
}
// rotation matrix taking +Y to direction n
function lookAlong(n) {
  const y = v3.norm(n);
  const a = Math.abs(y[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
  const x = v3.norm(v3.cross(a, y)), z = v3.cross(x, y);
  return [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, 0, 0, 0, 1];
}
import { buildBVH } from './bvh.js';
import { Fluid, latheSolid, profileSDF } from './fluid.js';
import { marchingTetrahedra } from './mc.js';
import { parseHDR, buildEnvCDF } from './hdr.js';

const TEX_SIZE = 2048;

async function loadImage(url, size = TEX_SIZE) {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bmp, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size);
}

// bilinear sample of channel 0 of an ImageData with wrap-around, uv in texture repeats
function sampleGray(img, u, v) {
  const W = img.width, H = img.height;
  let fx = (u - Math.floor(u)) * W, fy = (v - Math.floor(v)) * H;
  const x0 = Math.floor(fx) % W, y0 = Math.floor(fy) % H, x1 = (x0 + 1) % W, y1 = (y0 + 1) % H;
  const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
  const d = img.data;
  const g = (x, y) => d[(y * W + x) * 4];
  return ((g(x0, y0) * (1 - tx) + g(x1, y0) * tx) * (1 - ty) + (g(x0, y1) * (1 - tx) + g(x1, y1) * tx) * ty) / 255;
}

// value noise for gentle dune undulation
function hash2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), tx = x - xi, ty = y - yi;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}

export async function buildScene(scene, opts = {}) {
  const log = opts.log || (() => {});
  const base = opts.baseUrl || '';
  const abs = (u) => (/^(https?:|blob:|data:)/.test(u) ? u : base + u);   // scene files may point at the web (CC0 CDN) or the package
  const t0 = performance.now();
  const stats = {};

  // ---------- materials ----------
  const matNames = Object.keys(scene.materials);
  const matIndex = Object.fromEntries(matNames.map((n, i) => [n, i]));
  const texLayers = []; // {url, kind}
  const layerOf = (url) => {
    if (!url) return -1;
    let i = texLayers.findIndex((t) => t.url === url);
    if (i < 0) { texLayers.push({ url }); i = texLayers.length - 1; }
    return i;
  };
  // material descriptors; models and lights append to this list, the GPU table is built at the end
  const MAT_FLOATS = 28;
  const matList = matNames.map((n) => ({ ...scene.materials[n], name: n }));
  const addMaterial = (m) => { matList.push(m); matNames.push(m.name); matIndex[m.name] = matList.length - 1; return matList.length - 1; };
  const packMaterial = (m, o, out) => {
    const c = m.baseColor || [1, 1, 1];
    out.set([c[0], c[1], c[2], layerOf(m.baseColorTexture)], o);
    out.set([m.roughness ?? 0.5, m.metallic ?? 0, m.ior ?? 1.5, m.transmission ?? 0], o + 4);
    // glTF packs roughness (G) + metallic (B) in one texture; our shader reads the flag in extra.x
    const mr = m.metallicRoughnessTexture;
    out.set([layerOf(mr || m.roughnessTexture), layerOf(m.normalTexture), m.uvScale ?? 1, m.wetness ? 1 : 0], o + 8);
    const e = m.emission || [0, 0, 0];
    out.set([e[0], e[1], e[2], m.normalStrength ?? 1], o + 12);
    const ab = m.absorption || [0, 0, 0];
    out.set([ab[0], ab[1], ab[2], m.grain ?? 0], o + 16);
    out.set([mr ? 1 : 0, m.alphaCutoff ?? 0, layerOf(m.emissiveTexture), (m.lightIndex ?? -1) + 1], o + 20);
    // sheen (fabric grazing glow), clearcoat (leather, varnished wood) + its roughness
    out.set([m.sheen ?? 0, m.sheenTint ?? 0.5, m.clearcoat ?? 0, m.clearcoatRoughness ?? 0.15], o + 24);
  };

  // ---------- environment ----------
  log('loading HDRI ' + scene.environment.hdri);
  const env = parseHDR(await (await fetch(abs(scene.environment.hdri))).arrayBuffer());
  const cdf = buildEnvCDF(env);
  stats.env = `${env.width}x${env.height}`;

  // ---------- objects ----------
  const meshes = [];
  const solids = [];           // for the fluid
  const named = {};
  let groundFn = () => 0;
  const dispCache = {};
  for (const ob of scene.objects) {
    // with onObjectError set (the "make anything" page), a broken object is reported and skipped
    if (opts.onObjectError) {
      try { await buildObject(ob); } catch (e) { log(`object ${ob.name} skipped: ${e.message}`); opts.onObjectError(ob.name, e); }
      continue;
    }
    await buildObject(ob);
  }
  async function buildObject(ob) {
    const T = m4.fromTRS(ob.position || [0, 0, 0], ob.rotation || [0, 0, 0], ob.scale || [1, 1, 1]);
    const mat = matIndex[ob.material];
    if (mat === undefined && ob.type !== 'model' && ob.type !== 'building' && !ob.materials) throw new Error('unknown material ' + ob.material + ' on ' + ob.name);
    let mesh = null;
    if (ob.type === 'heightfield') {
      let disp = null;
      if (ob.displacement && ob.displacement.texture) {
        if (!dispCache[ob.displacement.texture]) dispCache[ob.displacement.texture] = await loadImage(abs(ob.displacement.texture), 1024);
        disp = dispCache[ob.displacement.texture];
      }
      const size = ob.size || [2, 2];
      const rep = ob.uvRepeat ?? 1;
      const dScale = ob.displacement ? ob.displacement.scale ?? 0.01 : 0;
      const dunes = ob.dunes || null;    // {amplitude, scale}
      const bumps = ob.bumps || [];      // [{position:[x,z], radius, height}]
      const fade = ob.edgeFade ?? 0;
      const flat = ob.flat || null;      // {position:[x,z], radius, falloff, keep}: calm the surface where an object rests
      const rip = ob.ripples || null;    // {amplitude, wavelength, direction (deg)}: wind ripples
      const hf = (x, z) => {
        let h = 0;
        if (disp) h += (sampleGray(disp, (x / size[0] + 0.5) * rep * size[0], (z / size[1] + 0.5) * rep * size[1]) - 0.5) * dScale;
        if (dunes) h += (vnoise(x * dunes.scale, z * dunes.scale) - 0.5) * dunes.amplitude + (vnoise(x * dunes.scale * 3.1 + 7, z * dunes.scale * 3.1 + 3) - 0.5) * dunes.amplitude * 0.3;
        if (rip) {
          const wl = rip.wavelength ?? (rip.scale ? 1 / rip.scale : 0.07); rip.wavelength = wl;
          const a = (rip.direction ?? 30) * Math.PI / 180, u = x * Math.cos(a) + z * Math.sin(a), v = -x * Math.sin(a) + z * Math.cos(a);
          const wobble = (vnoise(u * 6 + 3, v * 1.5) - 0.5) * rip.wavelength * 1.2 + (vnoise(v * 2.5, u * 0.7) - 0.5) * rip.wavelength * 0.8;
          const ph = (u + wobble) / rip.wavelength * 2 * Math.PI;
          const asym = 0.5 + 0.5 * Math.sin(ph) + 0.18 * Math.sin(2 * ph); // sharper crests, shallow troughs
          h += asym * rip.amplitude * (0.6 + 0.4 * vnoise(x * 1.7 + 11, z * 1.7));
        }
        if (flat) {
          const d = Math.hypot(x - flat.position[0], z - flat.position[1]);
          const t = Math.min(1, Math.max(0, (d - flat.radius) / (flat.falloff || 0.1)));
          const s = t * t * (3 - 2 * t);
          h *= (flat.keep ?? 0.15) + (1 - (flat.keep ?? 0.15)) * s;
        }
        for (const b of bumps) { const d2 = (x - b.position[0]) ** 2 + (z - b.position[1]) ** 2; h += b.height * Math.exp(-d2 / (b.radius * b.radius)); }
        if (fade > 0) {
          const ex = Math.max(0, Math.abs(x) - (size[0] / 2 - fade)) / fade, ez = Math.max(0, Math.abs(z) - (size[1] / 2 - fade)) / fade;
          h *= Math.max(0, 1 - Math.max(ex, ez));
        }
        return Number.isFinite(h) ? h : 0;
      };
      mesh = heightfield(size, ob.segments || [200, 200], hf, rep);
      if (ob.ground) { const Tl = T; groundFn = (x, z) => hf(x - Tl[12], z - Tl[14]) + Tl[13]; }
    } else if (ob.type === 'plane') {
      const s = ob.size || [1, 1];
      mesh = makeMesh([-s[0] / 2, 0, -s[1] / 2, s[0] / 2, 0, -s[1] / 2, s[0] / 2, 0, s[1] / 2, -s[0] / 2, 0, s[1] / 2], [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
        [0, 0, (ob.uvRepeat ?? 1) * s[0], 0, (ob.uvRepeat ?? 1) * s[0], (ob.uvRepeat ?? 1) * s[1], 0, (ob.uvRepeat ?? 1) * s[1]], [0, 2, 1, 0, 3, 2]);
    } else if (ob.type === 'sphere') {
      mesh = sphere(ob.radius ?? 0.5, ob.segments ?? 64, ob.rings ?? 40);
    } else if (ob.type === 'box') {
      mesh = box(ob.size || [1, 1, 1]);
    } else if (ob.type === 'lathe') {
      mesh = lathe(ob.profile, ob.segments ?? 96);
      if (ob.collider) solids.push(latheSolid(ob.profile, T));
      named[ob.name] = { profile: ob.profile, matrix: T };
    } else if (ob.type === 'bottle') {
      const b = bottle(ob.params || {});
      mesh = b.mesh;
      const profile = b.profileOuter.concat(b.profileInner);
      solids.push(latheSolid(profile, T));
      // cavity polygon = inner wall closed along the axis; negative distance = inside the cavity
      const cavityPoly = b.profileInner.concat([[0, b.height]]);
      const cavity = profileSDF(cavityPoly, b.radius + 0.005, -0.005, b.height + 0.005, 0.0004);
      named[ob.name] = { ...b, profile, matrix: T, inv: m4.invertRigid(T), cavity };
    } else if (ob.type === 'mesh') {
      mesh = makeMesh(ob.vertices, ob.normals || new Array(ob.vertices.length).fill(0), ob.uvs || new Array(ob.vertices.length / 3 * 2).fill(0), ob.indices);
      if (!ob.normals) { const { computeNormals } = await import('./mesh.js'); computeNormals(mesh); }
    } else if (ob.type === 'bottle_fill') {
      return; // handled after the fluid runs (level can come from the simulation)
    } else if (ob.type === 'building') {
      // a facade assembled from a modular kit (src/assembler.js): floors, width in 3 m modules, features, seed
      const { loadGLTF } = await import('./gltf.js');
      const { assembleBuilding } = await import('./assembler.js');
      const src = /^(https?:|blob:|data:)/.test(ob.src) ? ob.src : base + ob.src;
      const kit = await loadGLTF(src, { log, files: ob.files || null });
      const localMat = kit.materials.map((m) => addMaterial({ ...m, ...((ob.materials && ob.materials[m.name]) || {}), name: ob.name + '/' + m.name }));
      const b = assembleBuilding(kit, { floors: ob.floors, width: ob.width, features: ob.features, seed: ob.seed });
      // center the facade on the object's x, face toward +z (rotation turns it)
      const shift = -b.widthMeters / 2 + (ob.cornerWidth || 0);
      for (const part of b.meshes) {
        for (let i = 0; i < part.mesh.pos.length; i += 3) part.mesh.pos[i] += shift;
        transformMesh(part.mesh, T);
        meshes.push({ mesh: part.mesh, materialId: localMat[part.material] ?? localMat[0], name: ob.name + ':' + part.name });
      }
      ob.assemblerReport = b.report.join('; ');
      log(`building ${ob.name}: ${b.meshes.length} placed pieces - ${ob.assemblerReport}`);
      return;
    } else if (['rock', 'tree', 'hull', 'cylinder', 'cone', 'room'].includes(ob.type)) {
      // procedural builders (src/procedural.js); multi-part builders map part names to scene materials
      const P = await import('./procedural.js');
      const partMat = (part) => { const n = (ob.materials && ob.materials[part]) || ob.material; const id = matIndex[n]; if (id === undefined) throw new Error(`object ${ob.name}: no material for part '${part}'`); return id; };
      let parts;
      if (ob.type === 'rock') parts = [{ mesh: P.rock(ob.size ?? 0.5, ob.seed ?? 1, ob.roughness ?? 0.35), material: null }];
      else if (ob.type === 'cylinder') parts = [{ mesh: P.cylinder(ob.radius ?? 0.5, ob.height ?? 1, ob.segments ?? 48, ob.closed ?? true), material: null }];
      else if (ob.type === 'cone') parts = [{ mesh: P.cone(ob.radius ?? 0.5, ob.height ?? 1, ob.segments ?? 48), material: null }];
      else if (ob.type === 'hull') parts = [{ mesh: P.hull(ob.length ?? 4, ob.width ?? 0.9, ob.depth ?? 0.4, ob.wall ?? 0.03), material: null }];
      else if (ob.type === 'tree') parts = P.tree(ob.height ?? 4, ob.kind ?? 'conifer', ob.seed ?? 1);
      else parts = P.room(ob.width ?? 4, ob.depth ?? 4, ob.height ?? 2.7, ob.wall ?? 0.1, ob.window || null);
      for (const part of parts) {
        if (part.offset) for (let i = 0; i < part.mesh.pos.length; i += 3) { part.mesh.pos[i] += part.offset[0]; part.mesh.pos[i + 1] += part.offset[1]; part.mesh.pos[i + 2] += part.offset[2]; }
        transformMesh(part.mesh, T);
        meshes.push({ mesh: part.mesh, materialId: part.material ? partMat(part.material) : mat, name: ob.name + (part.material ? ':' + part.material : '') });
      }
      log(`${ob.type} ${ob.name}: ${parts.length} part(s)`);
      return;
    } else if (ob.type === 'model') {
      // standard 3D file: glTF 2.0 / .glb or OBJ+MTL; its materials become scene materials
      const { loadGLTF, loadOBJ } = await import('./gltf.js');
      const src = /^(https?:|blob:|data:)/.test(ob.src) ? ob.src : base + ob.src;
      const model = /\.obj$/i.test(ob.src) ? await loadOBJ(src, { log }) : await loadGLTF(src, { log, files: ob.files || null, node: ob.node });
      const localMat = model.materials.map((m) => {
        const ov = (ob.materials && ob.materials[m.name]) || null;
        if (ob.material) return matIndex[ob.material];
        const desc = { ...m, ...(ov || {}), name: ob.name + '/' + m.name };
        if (ov && ov.baseColorTexture === null) delete desc.baseColorTexture;
        return addMaterial(desc);
      });
      for (const prim of model.meshes) {
        transformMesh(prim.mesh, T);
        meshes.push({ mesh: prim.mesh, materialId: localMat[prim.material], name: ob.name + ':' + prim.name });
      }
      log(`model ${ob.name}: ${model.meshes.length} primitives`);
      return;
    } else throw new Error('unknown object type ' + ob.type);
    transformMesh(mesh, T);
    meshes.push({ mesh, materialId: mat, name: ob.name });
    log(`object ${ob.name}: ${mesh.idx.length / 3} triangles`);
  }

  // ---------- drop to ground: nothing floats ----------
  // Every object that is not itself ground (and not marked rest:false) is lowered or lifted so its
  // lowest point rests on the highest support under its footprint: the ground function or any
  // earlier object's triangles (so a cup sits on a table, a car on the lot).
  const GROUND_TYPES = new Set(['heightfield', 'plane', 'room', 'bottle_fill', 'bottle']); // bottle: the fluid uses its matrix, so it stays put
  const objByName = Object.fromEntries((scene.objects || []).map((o) => [o.name, o]));
  const supportMeshes = [];
  const meshBBox = (m) => { const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < m.pos.length; i += 3) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], m.pos[i + a]); mx[a] = Math.max(mx[a], m.pos[i + a]); } return { mn, mx }; };
  const heightOnMesh = (m, bb, x, z, below) => {
    if (x < bb.mn[0] || x > bb.mx[0] || z < bb.mn[2] || z > bb.mx[2] || bb.mn[1] > below) return -Infinity;
    const p = m.pos, idx = m.idx; let best = -Infinity;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const ax = p[a], az = p[a + 2], bx = p[b], bz = p[b + 2], cx = p[c], cz = p[c + 2];
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-12) continue;
      const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, w = 1 - u - v;
      if (u < -1e-4 || v < -1e-4 || w < -1e-4) continue;
      const y = u * p[a + 1] + v * p[b + 1] + w * p[c + 1];
      if (y <= below && y > best) best = y;
    }
    return best;
  };
  let dropped = 0;
  const groupBy = {};
  for (const mm of meshes) { const key = mm.name.split(':')[0]; (groupBy[key] = groupBy[key] || []).push(mm); }
  for (const [name, group] of Object.entries(groupBy)) {
    const ob = objByName[name];
    // only scenes that ask for it (the writer sets scene.rest = true); hand-built scenes keep their exact placement
    const isGround = scene.rest !== true || !ob || GROUND_TYPES.has(ob.type) || ob.ground || ob.rest === false || /^light:/.test(name);
    if (isGround) { for (const mm of group) supportMeshes.push({ mesh: mm.mesh, bb: meshBBox(mm.mesh) }); continue; }
    const bbs = group.map((mm) => meshBBox(mm.mesh));
    const mn = [Math.min(...bbs.map((b) => b.mn[0])), Math.min(...bbs.map((b) => b.mn[1])), Math.min(...bbs.map((b) => b.mn[2]))];
    const mx = [Math.max(...bbs.map((b) => b.mx[0])), Math.max(...bbs.map((b) => b.mx[1])), Math.max(...bbs.map((b) => b.mx[2]))];
    const cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2, hx = (mx[0] - mn[0]) * 0.3, hz = (mx[2] - mn[2]) * 0.3;
    const samples = [[cx, cz], [cx - hx, cz - hz], [cx + hx, cz - hz], [cx - hx, cz + hz], [cx + hx, cz + hz]];
    const below = mn[1] + (mx[1] - mn[1]) * 0.5; // only supports that start below the object's middle count
    let support = -Infinity;
    for (const [x, z] of samples) {
      let h = groundFn(x, z);
      for (const s of supportMeshes) { const y = heightOnMesh(s.mesh, s.bb, x, z, below); if (y > h) h = y; }
      if (h > support) support = h;
    }
    const dy = support - mn[1];
    const limit = Math.max(0.6, (mx[1] - mn[1]) * 0.5); // something placed far above its support was meant to be there
    if (Number.isFinite(dy) && Math.abs(dy) > 1e-4 && (dy > 0 || -dy <= limit)) {
      for (const mm of group) for (let i = 1; i < mm.mesh.pos.length; i += 3) mm.mesh.pos[i] += dy;
      dropped++;
      if (Math.abs(dy) > 0.01) log(`rest: ${name} moved ${dy > 0 ? 'up' : 'down'} ${Math.abs(dy).toFixed(3)} m`);
    }
    for (const mm of group) supportMeshes.push({ mesh: mm.mesh, bb: meshBBox(mm.mesh) });
  }
  stats.dropped = dropped;

  // ---------- fluid ----------
  let wetMap = null, fluidStats = null;
  const fl = scene.fluid;
  if (fl) {
    const tf = performance.now();
    const fluid = new Fluid({ spacing: fl.spacing ?? 0.0025, ground: groundFn, solids, iterations: fl.iterations ?? 4, viscosity: fl.viscosity ?? 0.02, wetness: fl.sand ? { res: fl.sand.resolution ?? 256, origin: fl.sand.origin, size: fl.sand.size, absorbRate: fl.sand.absorbRate, deposit: fl.sand.deposit, diffusion: fl.sand.diffusion, saturation: fl.sand.saturation, trail: fl.sand.trail } : null, capacity: fl.capacity ?? 80000 });
    let container = null;
    if (fl.source && fl.source.object) {
      container = named[fl.source.object];
      if (!container) throw new Error('fluid source object not found: ' + fl.source.object);
      const level = fl.source.fillLevel;
      // fill the cavity: lattice points below the level and inside the inner wall by more than a radius
      const bb = fluidBounds(container);
      const count = fluid.fill(bb.min, bb.max, (x, y, z) => {
        if (y > level) return false;
        const l = m4.xformPoint(container.inv, [x, y, z]);
        if (l[1] < 0 || l[1] > container.neckTop) return false;
        const r = Math.hypot(l[0], l[2]);
        const [d] = container.cavity.sample(r, l[1]);
        return -d > fluid.s * 0.6;
      });
      log(`fluid: filled ${count} particles in ${fl.source.object}`);
    }
    if (fl.emitter) fluid.addEmitter({ start: 0, stop: 1e9, radius: 0.004, speed: 0.5, ...fl.emitter });
    const dt = fl.dt ?? 1 / 240;
    const steps = Math.round(scene.time / dt);
    let maxN = fluid.n;
    const useGPU = (fl.gpu ?? true) && opts.device && container && fluid.wet && !fl.emitter;
    if (useGPU) {
      const { runGPUFluid } = await import('./fluid-gpu.js');
      const r = await runGPUFluid(opts.device, { cpu: fluid, steps, dt, container, groundFn, log, baseUrl: base, groundRect: fl.groundRect });
      log(`gpu fluid: ${r.initial} -> ${r.particles} particles, ${r.absorbed} absorbed, ${r.seconds.toFixed(1)}s`);
      fluidStats = { solver: 'webgpu', particles: fluid.n, maxParticles: maxN, steps, absorbed: fluid.absorbed, seconds: (performance.now() - tf) / 1000 };
    } else {
      for (let i = 0; i < steps; i++) {
        fluid.step(dt);
        if (fluid.n > maxN) maxN = fluid.n;
        if (i % 60 === 0) log(`fluid t=${(fluid.time).toFixed(3)}s particles=${fluid.n} absorbed=${fluid.absorbed} maxSpeed=${(fluid.maxSpeedSeen || 0).toFixed(2)}`);
        if (opts.yield && i % 30 === 0) await opts.yield();
      }
      fluidStats = { solver: 'js', particles: fluid.n, maxParticles: maxN, steps, absorbed: fluid.absorbed, seconds: (performance.now() - tf) / 1000 };
    }
    log(`fluid done: ${JSON.stringify(fluidStats)}`);

    const waterMat = matIndex[fl.material];
    // surface of the free water (outside the container)
    let select = () => true;
    let level = null;
    const plug = 0.003; // the pool pokes a few mm past the lip so no flat cap shows inside the mouth
    const exitY = container ? container.height - 0.0006 + plug : 0; // pool (and plug) below it, free water above it
    if (container) {
      const inBottle = (i) => container && (m4.xformPoint(container.inv, [fluid.x[i * 3], fluid.x[i * 3 + 1], fluid.x[i * 3 + 2]])[1] < exitY);
      select = (i) => !inBottle(i);
      // stream spill guard: particles still inside the neck count as pool, not stream
      // water level inside the bottle at this moment = high percentile of the contained particles' height
      const ys = [];
      for (let i = 0; i < fluid.n; i++) if (inBottle(i)) ys.push(fluid.x[i * 3 + 1]);
      ys.sort((a, b) => a - b);
      level = ys.length ? ys[Math.floor(ys.length * 0.985)] + fluid.s * 0.3 : null;
    }
    const surf = fluid.surface(select, { radius: fl.surface?.radius ?? fluid.s * 2.2, cell: fl.surface?.cell ?? fluid.s * 0.5, iso: fl.surface?.iso ?? 0.3, ground: groundFn });
    if (surf) { meshes.push({ mesh: surf, materialId: waterMat, name: 'fluid-surface' }); log(`fluid surface: ${surf.idx.length / 3} triangles`); }
    // clean pool inside the container at the simulated level
    const fillOb = scene.objects.find((o) => o.type === 'bottle_fill');
    if (fillOb && container && level !== null) {
      const pool = poolMesh(container, level, fillOb.cell ?? 0.001, exitY);
      if (pool) { transformMesh(pool, m4.identity()); meshes.push({ mesh: pool, materialId: matIndex[fillOb.material], name: fillOb.name }); log(`pool: level ${level.toFixed(4)} m, ${pool.idx.length / 3} triangles`); }
    }
    if (fluid.wet) {
      wetMap = { data: fluid.wet.data, res: fluid.wet.res, origin: fluid.wet.origin, size: fluid.wet.size };
      let mx = 0, cnt = 0, sum = 0; for (const v of fluid.wet.data) { if (v > mx) mx = v; if (v > 0.2) cnt++; sum += v; }
      log('wetness map: max ' + mx.toFixed(2) + ', ' + cnt + ' cells > 0.2, total ' + sum.toFixed(1));
      fluidStats.wetMax = mx; fluidStats.wetCells = cnt;
    }
    stats.fluid = fluidStats;
  }

  // ---------- lights ----------
  // Light record (20 floats): p[xyz,type] u[xyz,radius] v[xyz,area] L[rgb,cosOuter] e[cosInner,matId,0,0]
  // types: 0 rect, 1 disc, 2 point, 3 spot, 4 portal (sky through an opening), 5 sphere
  const lightDefs = scene.lights || [];
  const lightData = new Float32Array(Math.max(1, lightDefs.length) * 20);
  const lightTriList = [];   // world-space triangles of mesh lights (xyz per corner)
  const lightCdfList = [];   // cumulative area per triangle, normalized per light
  const UNIT_PER_LUMEN = 1 / 1200; // rough: 1 radiance unit ~ 4000 cd/m^2 in Poly Haven sky units; power (lm) -> radiant intensity
  lightDefs.forEach((lt, li) => {
    const o = li * 20;
    const col = lt.color || [1, 1, 1];
    const typeId = { rect: 0, disc: 1, point: 2, spot: 3, portal: 4, sphere: 5, mesh: 6 }[lt.type];
    if (typeId === undefined) throw new Error('unknown light type ' + lt.type);
    if (typeId === 6) {
      // mesh light: every triangle of one model material becomes an emitter sampled by area
      const matName = lt.object + '/' + lt.material;
      const mid = matIndex[matName];
      if (mid === undefined) throw new Error('mesh light: material not found ' + matName);
      const first = lightTriList.length / 9;
      let total = 0; const areas = [];
      for (const mm of meshes) {
        if (mm.materialId !== mid) continue;
        const { pos, idx } = mm.mesh;
        for (let t = 0; t < idx.length; t += 3) {
          const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
          const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]], e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
          const ar = 0.5 * v3.len(v3.cross(e1, e2));
          if (ar <= 0) continue;
          lightTriList.push(pos[a], pos[a + 1], pos[a + 2], pos[b], pos[b + 1], pos[b + 2], pos[c], pos[c + 1], pos[c + 2]);
          total += ar; areas.push(ar);
        }
      }
      let acc = 0; for (const ar of areas) { acc += ar; lightCdfList.push(acc / total); }
      const L = lt.intensity ?? 10;
      const m = matList[mid];
      m.emission = [col[0] * L, col[1] * L, col[2] * L]; m.lightIndex = li;
      lightData.set([0, 0, 0, 6], o);
      lightData.set([0, 0, 0, first], o + 4);
      lightData.set([0, 0, 0, total], o + 8);
      lightData.set([col[0] * L, col[1] * L, col[2] * L, 0], o + 12);
      lightData.set([0, mid, areas.length, 0], o + 16);
      log(`mesh light ${lt.object}/${lt.material}: ${areas.length} triangles, area ${total.toFixed(4)} m^2`);
      return;
    }
    const p = lt.position || [0, 0, 0];
    let u = lt.u || [1, 0, 0], v = lt.v || [0, 0, 1], radius = lt.radius ?? 0.1, area = 0, n = lt.normal || [0, -1, 0];
    if (typeId === 0 || typeId === 4) { area = v3.len(v3.cross(u, v)); }
    if (typeId === 1) { area = Math.PI * radius * radius; }
    if (typeId === 5) { area = 4 * Math.PI * radius * radius; }
    // radiance from power: L = P / (pi * A) for a Lambertian emitter ; intensity I = P / (4 pi) for point lights
    let L;
    if (typeId === 2 || typeId === 3) L = lt.intensity ?? (lt.power ? lt.power * UNIT_PER_LUMEN / (4 * Math.PI) * 683 / 100 : 1);
    else if (typeId === 4) L = lt.intensity ?? 1;
    else L = lt.intensity ?? (lt.power ? lt.power * UNIT_PER_LUMEN * 683 / 100 / (Math.PI * Math.max(area, 1e-6)) : 1);
    const spotDir = v3.norm(lt.direction || [0, -1, 0]);
    const cosOuter = Math.cos((lt.coneAngle ?? 40) * Math.PI / 180), cosInner = Math.cos((lt.coneAngle ?? 40) * (1 - (lt.blend ?? 0.3)) * Math.PI / 180);
    lightData.set([p[0], p[1], p[2], typeId], o);
    if (typeId === 3) lightData.set([spotDir[0], spotDir[1], spotDir[2], radius], o + 4);
    else lightData.set([u[0], u[1], u[2], radius], o + 4);
    if (typeId === 1) lightData.set([n[0], n[1], n[2], area], o + 8);
    else lightData.set([v[0], v[1], v[2], area], o + 8);
    lightData.set([col[0] * L, col[1] * L, col[2] * L, cosOuter], o + 12);
    // emissive geometry so camera/BSDF rays can hit area lights (MIS); portals and deltas have none
    let geo = null;
    if (typeId === 0) geo = makeMesh([p[0], p[1], p[2], p[0] + u[0], p[1] + u[1], p[2] + u[2], p[0] + u[0] + v[0], p[1] + u[1] + v[1], p[2] + u[2] + v[2], p[0] + v[0], p[1] + v[1], p[2] + v[2]], new Array(12).fill(0), [0, 0, 1, 0, 1, 1, 0, 1], [0, 1, 2, 0, 2, 3]);
    if (typeId === 1) { const m = m4.mul(m4.translate(p), lookAlong(n)); geo = transformMesh(discMesh(radius, 48), m); }
    if (typeId === 5) geo = transformMesh(sphere(radius, 32, 20), m4.translate(p));
    let matId = -1;
    if (geo) {
      if (typeId === 0) computeNormals(geo);
      matId = addMaterial({ name: 'light:' + (lt.name || li), baseColor: [0, 0, 0], roughness: 1, emission: [col[0] * L, col[1] * L, col[2] * L], lightIndex: li });
      meshes.push({ mesh: geo, materialId: matId, name: 'light:' + (lt.name || li) });
    }
    lightData.set([cosInner, matId, 0, 0], o + 16);
  });
  stats.lights = lightDefs.length;

  // ---------- textures + material table (after models and lights added theirs) ----------
  const matData = new Float32Array(matList.length * MAT_FLOATS);
  matList.forEach((m, i) => packMaterial(m, i * MAT_FLOATS, matData));
  const images = [];
  for (const t of texLayers) {
    const url = /^(https?:|blob:|data:)/.test(t.url) ? t.url : base + t.url;
    log('loading texture ' + t.url.slice(0, 80));
    images.push(await loadImage(url));
  }

  // ---------- camera sanity: never a wall in the face, never outside the room ----------
  // Writer scenes (scene.rest) get a check: inside a room the eye goes to a back corner at 1.6 m looking at the
  // furniture; everywhere, if the first hit straight ahead is under 0.5 m or most of the frame hits one surface,
  // the camera is re-framed from the bounds of the main objects. Reported as "camera re-framed".
  if (scene.rest === true && scene.camera) {
    const cam = scene.camera;
    const groups = {};
    for (const mm of meshes) { const key = mm.name.split(':')[0]; (groups[key] = groups[key] || []).push(mm); }
    const bbOf = (list) => { const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (const mm of list) for (let i = 0; i < mm.mesh.pos.length; i += 3) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], mm.mesh.pos[i + a]); mx[a] = Math.max(mx[a], mm.mesh.pos[i + a]); } return { mn, mx }; };
    const mainNames = Object.keys(groups).filter((n) => { const o = objByName[n]; return o && !GROUND_TYPES.has(o.type) && !/^light:/.test(n) && o.type !== 'room'; });
    let main = mainNames.length ? bbOf(mainNames.flatMap((n) => groups[n])) : null;
    if (main && !main.mn.every(Number.isFinite)) main = null;   // a group with no vertices would poison the bounds
    const roomOb = (scene.objects || []).find((o) => o.type === 'room');
    // brute-force closest hit for a few probe rays (CPU, a few million triangle tests at most)
    const hit = (o, d) => {
      let best = Infinity, who = null;
      for (const mm of meshes) {
        const p = mm.mesh.pos, idx = mm.mesh.idx;
        for (let t = 0; t < idx.length; t += 3) {
          const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
          const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2], e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2];
          const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
          const det = e1x * px + e1y * py + e1z * pz; if (Math.abs(det) < 1e-12) continue;
          const inv = 1 / det, sx = o[0] - p[a], sy = o[1] - p[a + 1], sz = o[2] - p[a + 2];
          const u = (sx * px + sy * py + sz * pz) * inv; if (u < 0 || u > 1) continue;
          const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
          const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv; if (v < 0 || u + v > 1) continue;
          const tt = (e2x * qx + e2y * qy + e2z * qz) * inv; if (tt > 1e-4 && tt < best) { best = tt; who = mm.name.split(':')[0]; }
        }
      }
      return { t: best, who };
    };
    const look = (from, to) => { const f = v3.norm(v3.sub(to, from)); const r = v3.norm(v3.cross(f, [0, 1, 0])); const u = v3.cross(r, f); return { f, r, u }; };
    let reason = null;
    if (roomOb) {
      const c = roomOb.position || [0, 0, 0], w = roomOb.width ?? 4, d = roomOb.depth ?? 4, h = roomOb.height ?? 2.7;
      const inside = cam.position[0] > c[0] - w / 2 + 0.3 && cam.position[0] < c[0] + w / 2 - 0.3 && cam.position[2] > c[2] - d / 2 + 0.3 && cam.position[2] < c[2] + d / 2 - 0.3 && cam.position[1] > c[1] + 0.3 && cam.position[1] < c[1] + h - 0.2;
      if (!inside) reason = 'camera was outside the room';
    }
    if (!reason && (cam.position && cam.target)) {
      const { f, r, u } = look(cam.position, cam.target);
      const tanH = Math.tan((cam.fov ?? 50) * Math.PI / 360), aspect = (scene.render?.width || 16) / (scene.render?.height || 9);
      const hits = [];
      for (const [sx, sy] of [[0, 0], [-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6], [0, 0.6], [0, -0.6], [-0.6, 0], [0.6, 0]]) {
        const dir = v3.norm(v3.add(f, v3.add(v3.scale(r, sx * tanH * aspect), v3.scale(u, sy * tanH))));
        hits.push(hit(cam.position, dir));
      }
      if (hits[0].t < 0.5) reason = `first hit ${hits[0].t.toFixed(2)} m ahead (${hits[0].who})`;
      else { const counts = {}; for (const h of hits) if (h.who) counts[h.who] = (counts[h.who] || 0) + 1; const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]; if (top && top[1] >= 7 && !(objByName[top[0]] && GROUND_TYPES.has(objByName[top[0]].type))) reason = `${top[1]} of 9 probe rays hit ${top[0]}`; }
    }
    if (reason) {
      const target = main ? [(main.mn[0] + main.mx[0]) / 2, (main.mn[1] + main.mx[1]) / 2, (main.mn[2] + main.mx[2]) / 2] : (cam.target || [0, 1, 0]);
      if (roomOb) {
        const c = roomOb.position || [0, 0, 0], w = roomOb.width ?? 4, d = roomOb.depth ?? 4, h = roomOb.height ?? 2.7;
        const corners = [[c[0] - w / 2 + 0.4, c[2] - d / 2 + 0.4], [c[0] + w / 2 - 0.4, c[2] - d / 2 + 0.4], [c[0] - w / 2 + 0.4, c[2] + d / 2 - 0.4], [c[0] + w / 2 - 0.4, c[2] + d / 2 - 0.4]];
        const far = corners.sort((p, q) => Math.hypot(q[0] - target[0], q[1] - target[2]) - Math.hypot(p[0] - target[0], p[1] - target[2]))[0];
        cam.position = [far[0], Math.min(1.6, c[1] + h - 0.3), far[1]];
        cam.target = [target[0], Math.min(target[1], 1.2), target[2]];
        const ext = main ? Math.max(main.mx[0] - main.mn[0], main.mx[2] - main.mn[2]) : Math.max(w, d) * 0.6;
        const dist = Math.hypot(cam.position[0] - cam.target[0], cam.position[2] - cam.target[2]);
        cam.fov = Math.max(55, Math.min(80, 2 * Math.atan((ext * 0.6) / Math.max(dist, 0.5)) * 180 / Math.PI + 20));
        // interiors are lit by small bulbs and one window: a camera would open up; so does ours
        if ((cam.exposure ?? 0) < 2.0) cam.exposure = 2.0;
      } else {
        const ext = main ? Math.max(main.mx[0] - main.mn[0], main.mx[1] - main.mn[1], main.mx[2] - main.mn[2]) : 4;
        const fov = Math.max(40, Math.min(70, cam.fov ?? 50));
        const dist = (ext / 2) / Math.tan(fov * Math.PI / 360) * 1.3 + 0.5;
        let az = cam.position && cam.target ? Math.atan2(cam.position[2] - cam.target[2], cam.position[0] - cam.target[0]) : Math.PI / 4;
        if (!Number.isFinite(az)) az = Math.PI / 4;
        cam.position = [target[0] + Math.cos(az) * dist, Math.max(target[1] + ext * 0.25, 0.6), target[2] + Math.sin(az) * dist];
        cam.target = target; cam.fov = fov;
      }
      cam.focusDistance = Math.hypot(cam.position[0] - cam.target[0], cam.position[1] - cam.target[1], cam.position[2] - cam.target[2]);
      stats.cameraNote = `camera re-framed: ${reason}`;
      log(stats.cameraNote + ` -> eye ${cam.position.map((v) => v.toFixed(2)).join(',')} target ${cam.target.map((v) => v.toFixed(2)).join(',')} fov ${cam.fov.toFixed(0)}`);
    }
  }

  // ---------- flatten + BVH ----------
  const tb = performance.now();
  const flat = flattenMeshes(meshes);
  const bvh = buildBVH(flat);
  stats.triangles = flat.triCount; stats.bvhNodes = bvh.nodeCount; stats.bvhDepth = bvh.maxDepth;
  stats.bvhSeconds = (performance.now() - tb) / 1000;
  log(`BVH: ${flat.triCount} triangles, ${bvh.nodeCount} nodes, depth ${bvh.maxDepth}, ${stats.bvhSeconds.toFixed(2)}s`);
  stats.buildSeconds = (performance.now() - t0) / 1000;

  return { bvh, matData, images, env, cdf, wetMap, camera: scene.camera, environment: scene.environment, render: scene.render || {}, stats, groundFn, meshes, matNames, lightData, lightCount: lightDefs.length,
    lightTris: Float32Array.from(lightTriList.length ? lightTriList : new Array(9).fill(0)), lightCdf: Float32Array.from(lightCdfList.length ? lightCdfList : [1]) };
}

function fluidBounds(c) {
  // world-space bounding box of the container by transforming its local box corners
  const R = c.radius + 0.01, H = c.height + 0.01;
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const [x, y, z] of [[-R, -0.01, -R], [R, -0.01, -R], [R, -0.01, R], [-R, -0.01, R], [-R, H, -R], [R, H, -R], [R, H, R], [-R, H, R]]) {
    const p = m4.xformPoint(c.matrix, [x, y, z]);
    for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], p[a]); mx[a] = Math.max(mx[a], p[a]); }
  }
  return { min: mn, max: mx };
}

// Water pool inside a lathe container: field = min(cavity distance, level - y), meshed in world space.
function poolMesh(c, level, cell, exitY) {
  const bb = fluidBounds(c);
  bb.max[1] = Math.min(bb.max[1], level + 2 * cell);
  const gap = 0.0003; // tiny air gap so the water surface never coincides with the plastic
  const nx = Math.ceil((bb.max[0] - bb.min[0]) / cell) + 2, ny = Math.ceil((bb.max[1] - bb.min[1]) / cell) + 2, nz = Math.ceil((bb.max[2] - bb.min[2]) / cell) + 2;
  const field = new Float32Array(nx * ny * nz);
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const wx = bb.min[0] + x * cell, wy = bb.min[1] + y * cell, wz = bb.min[2] + z * cell;
    const l = m4.xformPoint(c.inv, [wx, wy, wz]);
    const r = Math.hypot(l[0], l[2]);
    let v;
    if (l[1] < 0.002 || l[1] > exitY || r > c.radius) v = -1;
    else if (l[1] > c.height - 0.0008) v = c.mouthInnerRadius - 0.0005 - r;   // plug past the lip
    else { const [d] = c.cavity.sample(r, l[1]); v = -d - gap; }
    field[x + nx * (y + ny * z)] = Math.min(v, level - wy);
  }
  const m = marchingTetrahedra(field, nx, ny, nz, bb.min, cell, 0);
  return m.idx.length ? m : null;
}
