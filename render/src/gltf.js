// hb-render: glTF 2.0 (.gltf + .bin + images, or .glb) loader. Pure JS, browser.
// Produces world-space (model-space) triangle meshes with normals + uvs and a material list in
// hb-render's own material format (metallic-roughness PBR, textures as image sources).

import { m4, v3, makeMesh, computeNormals } from './mesh.js';

const CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function quatToMat(q) {
  const [x, y, z, w] = q;
  return [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, 0, 0, 0, 1];
}

export async function loadGLTF(url, opts = {}) {
  const log = opts.log || (() => {});
  const base = url.substring(0, url.lastIndexOf('/') + 1);
  // optional file map: relative paths inside the glTF -> real URLs (Poly Haven's CDN keeps textures
  // in a different folder than the .gltf says)
  const files = opts.files || {};
  const resolve = (rel) => files[rel] || files[rel.replace(/^\.\//, '')] || (base + rel);
  const buf = await (await fetch(url)).arrayBuffer();
  let json, bin = null;
  const magic = new DataView(buf).getUint32(0, true);
  if (magic === 0x46546C67) { // 'glTF' binary
    const dv = new DataView(buf);
    let off = 12;
    while (off < buf.byteLength) {
      const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
      const chunk = buf.slice(off + 8, off + 8 + len);
      if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(chunk));
      else if (type === 0x004E4942) bin = chunk;
      off += 8 + len;
    }
  } else {
    json = JSON.parse(new TextDecoder().decode(buf));
  }
  // buffers
  const buffers = [];
  for (const b of json.buffers || []) {
    if (b.uri) {
      if (b.uri.startsWith('data:')) buffers.push(await (await fetch(b.uri)).arrayBuffer());
      else buffers.push(await (await fetch(resolve(b.uri))).arrayBuffer());
    } else buffers.push(bin);
  }
  const bufferView = (i) => {
    const bv = json.bufferViews[i];
    return { data: buffers[bv.buffer], offset: bv.byteOffset || 0, length: bv.byteLength, stride: bv.byteStride || 0 };
  };
  const accessor = (i) => {
    const a = json.accessors[i];
    const T = CT[a.componentType], n = NCOMP[a.type];
    const out = new (T === Float32Array ? Float32Array : (T === Uint32Array ? Uint32Array : Float32Array))(a.count * n);
    if (a.bufferView === undefined) return out;
    const bv = bufferView(a.bufferView);
    const elemSize = T.BYTES_PER_ELEMENT * n;
    const stride = bv.stride || elemSize;
    const dv = new DataView(bv.data);
    const start = bv.offset + (a.byteOffset || 0);
    const norm = a.normalized;
    for (let e = 0; e < a.count; e++) {
      for (let c = 0; c < n; c++) {
        const p = start + e * stride + c * T.BYTES_PER_ELEMENT;
        let v;
        switch (a.componentType) {
          case 5126: v = dv.getFloat32(p, true); break;
          case 5123: v = dv.getUint16(p, true); if (norm) v /= 65535; break;
          case 5125: v = dv.getUint32(p, true); break;
          case 5121: v = dv.getUint8(p); if (norm) v /= 255; break;
          case 5122: v = dv.getInt16(p, true); if (norm) v = Math.max(v / 32767, -1); break;
          case 5120: v = dv.getInt8(p); if (norm) v = Math.max(v / 127, -1); break;
        }
        out[e * n + c] = v;
      }
    }
    return out;
  };
  // images -> object URLs (fetchable by the texture loader)
  const imageUrls = [];
  for (const im of json.images || []) {
    if (im.uri) imageUrls.push(im.uri.startsWith('data:') ? im.uri : resolve(im.uri));
    else {
      const bv = bufferView(im.bufferView);
      const blob = new Blob([new Uint8Array(bv.data, bv.offset, bv.length)], { type: im.mimeType || 'image/png' });
      imageUrls.push(URL.createObjectURL(blob));
    }
  }
  const texUrl = (ti) => (ti === undefined ? null : imageUrls[json.textures[ti.index ?? ti].source]);
  // materials -> hb-render material descriptions
  const materials = (json.materials || []).map((m, i) => {
    const pbr = m.pbrMetallicRoughness || {};
    const bc = pbr.baseColorFactor || [1, 1, 1, 1];
    const ext = m.extensions || {};
    const out = {
      name: m.name || ('mat' + i),
      baseColor: [bc[0], bc[1], bc[2]],
      baseColorTexture: texUrl(pbr.baseColorTexture),
      metallic: pbr.metallicFactor ?? 1,
      roughness: pbr.roughnessFactor ?? 1,
      metallicRoughnessTexture: texUrl(pbr.metallicRoughnessTexture),
      normalTexture: texUrl(m.normalTexture),
      normalStrength: m.normalTexture ? (m.normalTexture.scale ?? 1) : 1,
      emission: m.emissiveFactor || [0, 0, 0],
      emissiveTexture: texUrl(m.emissiveTexture),
      alphaCutoff: m.alphaMode === 'MASK' ? (m.alphaCutoff ?? 0.5) : (m.alphaMode === 'BLEND' ? 0.5 : 0),
      doubleSided: !!m.doubleSided,
    };
    if (ext.KHR_materials_ior) out.ior = ext.KHR_materials_ior.ior;
    if (ext.KHR_materials_transmission) out.transmission = ext.KHR_materials_transmission.transmissionFactor ?? 0;
    if (ext.KHR_materials_emissive_strength) out.emission = out.emission.map((c) => c * ext.KHR_materials_emissive_strength.emissiveStrength);
    if (!pbr.metallicRoughnessTexture && pbr.metallicFactor === undefined) out.metallic = 0; // untextured, unspecified: treat as dielectric
    return out;
  });
  if (materials.length === 0) materials.push({ name: 'default', baseColor: [0.8, 0.8, 0.8], metallic: 0, roughness: 0.6 });

  // nodes -> meshes with world matrices
  const meshes = [];
  const visit = (ni, parent) => {
    const nd = json.nodes[ni];
    let local = m4.identity();
    if (nd.matrix) local = nd.matrix.slice();
    else {
      const t = nd.translation || [0, 0, 0], r = nd.rotation || [0, 0, 0, 1], s = nd.scale || [1, 1, 1];
      local = m4.mul(m4.translate(t), m4.mul(quatToMat(r), m4.scale(s)));
    }
    const world = m4.mul(parent, local);
    if (nd.mesh !== undefined) {
      for (const prim of json.meshes[nd.mesh].primitives) {
        if (prim.mode !== undefined && prim.mode !== 4) continue; // triangles only
        const pos = accessor(prim.attributes.POSITION);
        const n = pos.length / 3;
        const nrm = prim.attributes.NORMAL !== undefined ? accessor(prim.attributes.NORMAL) : null;
        const uv = prim.attributes.TEXCOORD_0 !== undefined ? accessor(prim.attributes.TEXCOORD_0) : new Float32Array(n * 2);
        let idx;
        if (prim.indices !== undefined) idx = Uint32Array.from(accessor(prim.indices));
        else { idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i; }
        const mesh = makeMesh(pos, nrm || new Float32Array(n * 3), uv, idx);
        // transform to model space (normals: rotation part, renormalized)
        for (let i = 0; i < n; i++) {
          const p = m4.xformPoint(world, [mesh.pos[i * 3], mesh.pos[i * 3 + 1], mesh.pos[i * 3 + 2]]);
          mesh.pos[i * 3] = p[0]; mesh.pos[i * 3 + 1] = p[1]; mesh.pos[i * 3 + 2] = p[2];
          if (nrm) { const d = v3.norm(m4.xformDir(world, [mesh.nrm[i * 3], mesh.nrm[i * 3 + 1], mesh.nrm[i * 3 + 2]])); mesh.nrm[i * 3] = d[0]; mesh.nrm[i * 3 + 1] = d[1]; mesh.nrm[i * 3 + 2] = d[2]; }
        }
        if (!nrm) computeNormals(mesh);
        meshes.push({ mesh, material: prim.material ?? 0, name: nd.name || ('node' + ni) });
      }
    }
    for (const c of nd.children || []) visit(c, world);
  };
  const scene = json.scenes ? json.scenes[json.scene || 0] : { nodes: json.nodes.map((_, i) => i) };
  for (const ni of scene.nodes) visit(ni, m4.identity());
  let tris = 0; for (const m of meshes) tris += m.mesh.idx.length / 3;
  log(`glTF ${url.split('/').pop()}: ${meshes.length} primitives, ${tris} triangles, ${materials.length} materials`);
  return { meshes, materials };
}

// ---------- OBJ + MTL ----------
export async function loadOBJ(url, opts = {}) {
  const log = opts.log || (() => {});
  const base = url.substring(0, url.lastIndexOf('/') + 1);
  const text = await (await fetch(url)).text();
  const P = [], N = [], T = [];
  const materials = [{ name: 'default', baseColor: [0.8, 0.8, 0.8], metallic: 0, roughness: 0.6 }];
  const matIndex = { default: 0 };
  const groups = new Map(); // material index -> {pos,nrm,uv,idx, cache}
  let cur = 0;
  const parseMTL = async (name) => {
    let mtl; try { mtl = await (await fetch(base + name)).text(); } catch (e) { return; }
    let m = null;
    for (const raw of mtl.split('\n')) {
      const l = raw.trim(); if (!l || l[0] === '#') continue;
      const p = l.split(/\s+/);
      if (p[0] === 'newmtl') { m = { name: p[1], baseColor: [0.8, 0.8, 0.8], metallic: 0, roughness: 0.6 }; matIndex[p[1]] = materials.length; materials.push(m); }
      else if (!m) continue;
      else if (p[0] === 'Kd') m.baseColor = [+p[1], +p[2], +p[3]];
      else if (p[0] === 'Ke') m.emission = [+p[1], +p[2], +p[3]];
      else if (p[0] === 'Ns') m.roughness = Math.sqrt(2 / (+p[1] + 2));
      else if (p[0] === 'Ni') m.ior = +p[1];
      else if (p[0] === 'd' && +p[1] < 1) m.transmission = 1 - (+p[1]);
      else if (p[0] === 'map_Kd') m.baseColorTexture = base + p[p.length - 1];
      else if (p[0] === 'map_bump' || p[0] === 'bump') m.normalTexture = base + p[p.length - 1];
      else if (p[0] === 'map_Pr') m.roughnessTexture = base + p[p.length - 1];
    }
  };
  const getGroup = () => { if (!groups.has(cur)) groups.set(cur, { pos: [], nrm: [], uv: [], idx: [], cache: new Map() }); return groups.get(cur); };
  const lines = text.split('\n');
  for (const raw of lines) {
    const l = raw.trim(); if (!l || l[0] === '#') continue;
    const p = l.split(/\s+/);
    if (p[0] === 'v') P.push(+p[1], +p[2], +p[3]);
    else if (p[0] === 'vn') N.push(+p[1], +p[2], +p[3]);
    else if (p[0] === 'vt') T.push(+p[1], 1 - (+p[2]));
    else if (p[0] === 'mtllib') await parseMTL(p[1]);
    else if (p[0] === 'usemtl') cur = matIndex[p[1]] ?? 0;
    else if (p[0] === 'f') {
      const g = getGroup();
      const vi = [];
      for (let k = 1; k < p.length; k++) {
        const key = p[k];
        let v = g.cache.get(key);
        if (v === undefined) {
          const [a, b, c] = key.split('/').map((s) => (s === '' || s === undefined ? 0 : parseInt(s)));
          const ia = (a < 0 ? P.length / 3 + a : a - 1), ib = b ? (b < 0 ? T.length / 2 + b : b - 1) : -1, ic = c ? (c < 0 ? N.length / 3 + c : c - 1) : -1;
          g.pos.push(P[ia * 3], P[ia * 3 + 1], P[ia * 3 + 2]);
          g.uv.push(ib >= 0 ? T[ib * 2] : 0, ib >= 0 ? T[ib * 2 + 1] : 0);
          g.nrm.push(ic >= 0 ? N[ic * 3] : 0, ic >= 0 ? N[ic * 3 + 1] : 0, ic >= 0 ? N[ic * 3 + 2] : 0);
          v = g.pos.length / 3 - 1; g.cache.set(key, v);
        }
        vi.push(v);
      }
      for (let k = 1; k + 1 < vi.length; k++) g.idx.push(vi[0], vi[k], vi[k + 1]);
    }
  }
  const meshes = [];
  for (const [mi, g] of groups) {
    const mesh = makeMesh(g.pos, g.nrm, g.uv, g.idx);
    if (N.length === 0) computeNormals(mesh);
    meshes.push({ mesh, material: mi, name: materials[mi].name });
  }
  let tris = 0; for (const m of meshes) tris += m.mesh.idx.length / 3;
  log(`OBJ ${url.split('/').pop()}: ${meshes.length} groups, ${tris} triangles, ${materials.length} materials`);
  return { meshes, materials };
}
