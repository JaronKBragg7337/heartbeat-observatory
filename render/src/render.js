// hb-render: WebGPU driver. Uploads the built scene, runs progressive path-tracing passes,
// then denoise + tone map, and reads the image back as RGBA8.

import { v3 } from './mesh.js';

function f32ToF16(val) {
  const f = new Float32Array(1), u = new Uint32Array(f.buffer);
  f[0] = val;
  const x = u[0];
  const sign = (x >> 16) & 0x8000;
  let exp = ((x >> 23) & 0xff) - 127 + 15;
  let mant = x & 0x7fffff;
  if (exp <= 0) return sign;
  if (exp >= 31) return sign | 0x7c00;
  return sign | (exp << 10) | (mant >> 13);
}

async function fetchText(url) { return (await fetch(url)).text(); }

// box-filter mip chain for an RGBA8 image (power-of-two square)
function mipChain(img) {
  const levels = [{ width: img.width, height: img.height, data: new Uint8Array(img.data.buffer) }];
  let w = img.width, h = img.height, src = levels[0].data;
  while (w > 1 && h > 1) {
    const nw = w >> 1, nh = h >> 1, dst = new Uint8Array(nw * nh * 4);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) for (let c = 0; c < 4; c++) {
      const a = src[((2 * y) * w + 2 * x) * 4 + c], b = src[((2 * y) * w + 2 * x + 1) * 4 + c], cc = src[((2 * y + 1) * w + 2 * x) * 4 + c], d = src[((2 * y + 1) * w + 2 * x + 1) * 4 + c];
      dst[(y * nw + x) * 4 + c] = (a + b + cc + d + 2) >> 2;
    }
    levels.push({ width: nw, height: nh, data: dst });
    w = nw; h = nh; src = dst;
  }
  return levels;
}

export async function createRenderer(opts) {
  const { width, height, baseUrl = '' } = opts;
  if (!navigator.gpu) throw new Error('WebGPU not available in this browser');
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw new Error('no WebGPU adapter');
  const device = await adapter.requestDevice({ requiredLimits: {
    maxStorageBufferBindingSize: Math.min(adapter.limits.maxStorageBufferBindingSize, 512 * 1024 * 1024),
    maxBufferSize: Math.min(adapter.limits.maxBufferSize, 512 * 1024 * 1024),
    maxStorageBuffersPerShaderStage: Math.min(adapter.limits.maxStorageBuffersPerShaderStage, 16),
  } });
  const info = adapter.info || {};
  device.addEventListener('uncapturederror', (e) => console.error('[hb] WebGPU error: ' + e.error.message));
  device.lost.then((l) => { if (l.reason !== 'destroyed') console.error('[hb] WebGPU device lost: ' + l.message); });
  const tracerSrc = await fetchText(baseUrl + 'src/tracer.wgsl');
  const postSrc = await fetchText(baseUrl + 'src/post.wgsl');
  const tracerMod = device.createShaderModule({ code: tracerSrc });
  const postMod = device.createShaderModule({ code: postSrc });
  for (const [name, mod] of [['tracer', tracerMod], ['post', postMod]]) {
    const ci = await mod.getCompilationInfo();
    for (const m of ci.messages) if (m.type === 'error') throw new Error(`${name}.wgsl:${m.lineNum}:${m.linePos} ${m.message}`);
  }
  // explicit layouts: trace / photons / causticFinish share the same two bind groups
  const CS = GPUShaderStage.COMPUTE;
  const bgl0 = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: CS, buffer: { type: 'uniform' } },
    ...[1, 2, 3, 4, 5].map((b) => ({ binding: b, visibility: CS, buffer: { type: 'read-only-storage' } })),
    ...[6, 7, 8, 9].map((b) => ({ binding: b, visibility: CS, buffer: { type: 'storage' } })),
    { binding: 10, visibility: CS, buffer: { type: 'read-only-storage' } },
    { binding: 11, visibility: CS, buffer: { type: 'read-only-storage' } },
    { binding: 12, visibility: CS, buffer: { type: 'read-only-storage' } },
  ] });
  const bgl1 = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: CS, texture: { sampleType: 'unfilterable-float' } },
    { binding: 1, visibility: CS, buffer: { type: 'read-only-storage' } },
    { binding: 2, visibility: CS, buffer: { type: 'read-only-storage' } },
    { binding: 3, visibility: CS, texture: { sampleType: 'float', viewDimension: '2d-array' } },
    { binding: 4, visibility: CS, sampler: { type: 'filtering' } },
    { binding: 5, visibility: CS, texture: { sampleType: 'float' } },
    { binding: 6, visibility: CS, sampler: { type: 'filtering' } },
  ] });
  const traceLayout = device.createPipelineLayout({ bindGroupLayouts: [bgl0, bgl1] });
  const tracePipe = device.createComputePipeline({ layout: traceLayout, compute: { module: tracerMod, entryPoint: 'trace' } });
  const photonPipe = device.createComputePipeline({ layout: traceLayout, compute: { module: tracerMod, entryPoint: 'photons' } });
  const causticPipe = device.createComputePipeline({ layout: traceLayout, compute: { module: tracerMod, entryPoint: 'causticFinish' } });
  const preparePipe = device.createComputePipeline({ layout: 'auto', compute: { module: postMod, entryPoint: 'prepare' } });
  const atrousPipe = device.createComputePipeline({ layout: 'auto', compute: { module: postMod, entryPoint: 'atrous' } });
  const tonePipe = device.createComputePipeline({ layout: 'auto', compute: { module: postMod, entryPoint: 'tonemap' } });

  const npix = width * height;
  const mk = (size, usage, label) => device.createBuffer({ size: Math.max(16, Math.ceil(size / 16) * 16), usage, label });
  const accum = mk(npix * 16, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC, 'accum');
  const gbuf = mk(npix * 32, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC, 'gbuf');
  const pingA = mk(npix * 16, GPUBufferUsage.STORAGE, 'pingA');
  const pingB = mk(npix * 16, GPUBufferUsage.STORAGE, 'pingB');
  const outBuf = mk(npix * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC, 'out');
  const readBuf = mk(npix * 4, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST, 'read');
  const paramBuf = mk(176, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'params');
  const postParamBuf = mk(32, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'postParams');

  const R = { device, info, width, height, frame: 0, scene: null };

  R.setScene = (S) => {
    R.scene = S;
    const up = (data, usage, label) => { const b = mk(data.byteLength, usage | GPUBufferUsage.COPY_DST, label); device.queue.writeBuffer(b, 0, data); return b; };
    const ST = GPUBufferUsage.STORAGE;
    R.triBuf = up(S.bvh.pos, ST, 'tris');
    R.nrmBuf = up(S.bvh.nrm, ST, 'nrms');
    R.uvBuf = up(S.bvh.uv, ST, 'uvs');
    R.nodeBuf = up(S.bvh.nodes, ST, 'nodes');
    R.matBuf = up(S.matData, ST, 'mats');
    R.margBuf = up(S.cdf.marg, ST, 'envMarg');
    R.condBuf = up(S.cdf.cond, ST, 'envCond');
    R.lightBuf = up(S.lightData || new Float32Array(20), ST, 'lights');
    R.lightTrisBuf = up(S.lightTris || new Float32Array(9), ST, 'lightTris');
    R.lightCdfBuf = up(S.lightCdf || new Float32Array([1]), ST, 'lightCdf');
    // environment texture (rgba32float, loaded with textureLoad)
    R.envTex = device.createTexture({ size: [S.env.width, S.env.height], format: 'rgba32float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    device.queue.writeTexture({ texture: R.envTex }, S.env.data, { bytesPerRow: S.env.width * 16 }, [S.env.width, S.env.height]);
    // texture array with mips
    const layers = Math.max(1, S.images.length);
    const size = S.images.length ? S.images[0].width : 4;
    const mipCount = Math.floor(Math.log2(size)) + 1;
    R.texArr = device.createTexture({ size: [size, size, layers], format: 'rgba8unorm', mipLevelCount: mipCount, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    S.images.forEach((img, layer) => {
      const chain = mipChain(img);
      chain.forEach((lv, mip) => {
        device.queue.writeTexture({ texture: R.texArr, mipLevel: mip, origin: [0, 0, layer] }, lv.data, { bytesPerRow: lv.width * 4 }, [lv.width, lv.height, 1]);
      });
    });
    // wetness map (rgba16float, filterable)
    const wres = S.wetMap ? S.wetMap.res : 4;
    R.wetTex = device.createTexture({ size: [wres, wres], format: 'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    const wdata = new Uint16Array(wres * wres * 4);
    if (S.wetMap) for (let i = 0; i < wres * wres; i++) { const h = f32ToF16(S.wetMap.data[i]); wdata[i * 4] = h; wdata[i * 4 + 1] = h; wdata[i * 4 + 2] = h; wdata[i * 4 + 3] = f32ToF16(1); }
    device.queue.writeTexture({ texture: R.wetTex }, wdata, { bytesPerRow: wres * 8 }, [wres, wres]);
    R.sampRepeat = device.createSampler({ addressModeU: 'repeat', addressModeV: 'repeat', magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear' });
    R.sampClamp = device.createSampler({ addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', magFilter: 'linear', minFilter: 'linear' });

    // caustic photon map (xz grid over the region around the fluid)
    const cz = S.render.caustics || null;
    const cres = cz ? (cz.resolution ?? 512) : 4;
    R.causAcc = mk(cres * cres * 4, ST | GPUBufferUsage.COPY_DST, 'causAcc');
    R.causMap = mk(cres * cres * 4, ST | GPUBufferUsage.COPY_DST, 'causMap');
    device.queue.writeBuffer(R.causAcc, 0, new Uint32Array(cres * cres));
    device.queue.writeBuffer(R.causMap, 0, new Float32Array(cres * cres));
    R.caustics = cz ? { x0: cz.origin[0], z0: cz.origin[1], size: cz.size, res: cres, photonsPerPass: cz.photonsPerPass ?? 1048576, passes: cz.passes ?? 32, top: cz.top ?? 0.6 } : null;

    R.bg0 = device.createBindGroup({ layout: bgl0, entries: [
      { binding: 0, resource: { buffer: paramBuf } }, { binding: 1, resource: { buffer: R.triBuf } }, { binding: 2, resource: { buffer: R.nrmBuf } },
      { binding: 3, resource: { buffer: R.uvBuf } }, { binding: 4, resource: { buffer: R.nodeBuf } }, { binding: 5, resource: { buffer: R.matBuf } },
      { binding: 6, resource: { buffer: accum } }, { binding: 7, resource: { buffer: gbuf } },
      { binding: 8, resource: { buffer: R.causAcc } }, { binding: 9, resource: { buffer: R.causMap } },
      { binding: 10, resource: { buffer: R.lightBuf } }, { binding: 11, resource: { buffer: R.lightTrisBuf } }, { binding: 12, resource: { buffer: R.lightCdfBuf } }] });
    R.bg1 = device.createBindGroup({ layout: bgl1, entries: [
      { binding: 0, resource: R.envTex.createView() }, { binding: 1, resource: { buffer: R.margBuf } }, { binding: 2, resource: { buffer: R.condBuf } },
      { binding: 3, resource: R.texArr.createView({ dimension: '2d-array' }) }, { binding: 4, resource: R.sampRepeat },
      { binding: 5, resource: R.wetTex.createView() }, { binding: 6, resource: R.sampClamp }] });
    const postBG = (pipe, src, dst) => device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: postParamBuf } }, { binding: 1, resource: { buffer: accum } }, { binding: 2, resource: { buffer: gbuf } },
      { binding: 3, resource: { buffer: src } }, { binding: 4, resource: { buffer: dst } }, { binding: 5, resource: { buffer: outBuf } }] });
    R.bgPrepare = postBG(preparePipe, pingB, pingA);
    R.bgAtrousAB = postBG(atrousPipe, pingA, pingB);
    R.bgAtrousBA = postBG(atrousPipe, pingB, pingA);
    R.bgToneA = postBG(tonePipe, pingA, pingB);
    R.bgToneB = postBG(tonePipe, pingB, pingA);
    R.reset();
  };

  R.reset = () => {
    device.queue.writeBuffer(accum, 0, new Float32Array(npix * 4));
    device.queue.writeBuffer(gbuf, 0, new Float32Array(npix * 8));
    R.frame = 0;
  };

  R.writeParams = () => {
    const S = R.scene, cam = S.camera;
    const pos = cam.position, target = cam.target;
    const fwd = v3.norm(v3.sub(target, pos));
    const worldUp = cam.up || [0, 1, 0];
    const right = v3.norm(v3.cross(fwd, worldUp));
    const up = v3.cross(right, fwd);
    const fov = (cam.fov ?? 40) * Math.PI / 180;
    const tanHalf = Math.tan(fov / 2);
    const focus = cam.focusDistance ?? v3.len(v3.sub(target, pos));
    // lens radius from f-number: focal length (mm) from fov on a 36mm sensor
    const focalMm = cam.focalLength ?? (18 / tanHalf);
    const lensRadius = cam.fstop ? (focalMm / 1000) / (2 * cam.fstop) : 0;
    const maxB = S.render.maxBounces ?? 12;
    const f = new Float32Array(44);
    const u = new Uint32Array(f.buffer);
    const cz = R.caustics;
    f.set([S.lightCount || 0, (S.environment.sampleDirect ?? true) ? 1 : 0, S.render.rrStart ?? 4, S.render.clamp ?? 20], 40);
    f.set([cz ? cz.x0 : 0, cz ? cz.z0 : 0, cz ? cz.size : 1, cz ? cz.res : 4], 32);
    f.set([cz ? cz.photonsPerPass : 0, cz ? cz.size * cz.size : 0, 1000.0, cz ? cz.top : 1], 36);
    f.set([pos[0], pos[1], pos[2], tanHalf], 0);
    f.set([fwd[0], fwd[1], fwd[2], width / height], 4);
    f.set([right[0], right[1], right[2], lensRadius], 8);
    f.set([up[0], up[1], up[2], focus], 12);
    u.set([width, height, R.frame, maxB], 16);
    f.set([(S.environment.rotation ?? 0) * Math.PI / 180, S.environment.intensity ?? 1, S.env.width, S.env.height], 20);
    const wm = S.wetMap;
    f.set([wm ? wm.origin[0] : 0, wm ? wm.origin[1] : 0, wm ? wm.size : 1, S.render.wetnessGain ?? 2.0], 24);
    f.set([S.cdf.total, Math.pow(2, cam.exposure ?? 0), 2 * tanHalf / height, R.causticsReady ? 1 : 0], 28);
    device.queue.writeBuffer(paramBuf, 0, f);
  };

  // photon pass: build the caustic map before the camera passes
  R.buildCaustics = async () => {
    const cz = R.caustics; if (!cz) return null;
    const t0 = performance.now();
    R.causticsReady = false;
    for (let p = 0; p < cz.passes; p++) {
      R.frame = 1000 + p; R.writeParams();
      const enc = device.createCommandEncoder();
      const cp = enc.beginComputePass();
      cp.setPipeline(photonPipe); cp.setBindGroup(0, R.bg0); cp.setBindGroup(1, R.bg1);
      cp.dispatchWorkgroups(Math.ceil(cz.photonsPerPass / 256));
      cp.end();
      device.queue.submit([enc.finish()]);
    }
    const enc = device.createCommandEncoder();
    const cp = enc.beginComputePass();
    cp.setPipeline(causticPipe); cp.setBindGroup(0, R.bg0); cp.setBindGroup(1, R.bg1);
    cp.dispatchWorkgroups(Math.ceil(cz.res * cz.res / 256));
    cp.end();
    device.queue.submit([enc.finish()]);
    await device.queue.onSubmittedWorkDone();
    R.frame = 0;
    R.causticsReady = true;
    return { photons: cz.passes * cz.photonsPerPass, seconds: (performance.now() - t0) / 1000 };
  };

  // `count` samples per pixel. writeBuffer and submit are ordered on the queue, so each
  // dispatch sees its own frame index.
  R.pass = (count = 1) => {
    for (let i = 0; i < count; i++) {
      R.writeParams();
      const enc = device.createCommandEncoder();
      const cp = enc.beginComputePass();
      cp.setPipeline(tracePipe); cp.setBindGroup(0, R.bg0); cp.setBindGroup(1, R.bg1);
      cp.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
      cp.end();
      device.queue.submit([enc.finish()]);
      R.frame++;
    }
    return device.queue.onSubmittedWorkDone();
  };

  // debug: read back the raw accumulation buffer (rgb sums + sample count per pixel)
  R.readAccum = async () => {
    const rb = mk(npix * 16, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST, 'readAccum');
    const enc = device.createCommandEncoder();
    enc.copyBufferToBuffer(accum, 0, rb, 0, npix * 16);
    device.queue.submit([enc.finish()]);
    await rb.mapAsync(GPUMapMode.READ);
    const f = new Float32Array(rb.getMappedRange().slice(0));
    rb.unmap(); rb.destroy();
    return f;
  };

  // auto-exposure: read the accumulation after the first samples and return the EV that puts the
  // geometric-mean luminance near `target` (0.18 = a mid grey), clamped to +-4 EV. Sky pixels are
  // ignored (they would drag an interior's average up and leave the room dark).
  R.autoExposure = async (target = 0.18) => {
    const a = await R.readAccum();
    const g = new Float32Array(await (async () => { const rb = mk(npix * 32, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST, 'rbg'); const enc = device.createCommandEncoder(); enc.copyBufferToBuffer(gbuf, 0, rb, 0, npix * 32); device.queue.submit([enc.finish()]); await rb.mapAsync(GPUMapMode.READ); const f = rb.getMappedRange().slice(0); rb.unmap(); rb.destroy(); return f; })());
    let sum = 0, n = 0; const ls = [];
    for (let i = 0; i < npix; i += 7) {
      const c = a[i * 4 + 3]; if (c <= 0) continue;
      // gbuf rgb is a running SUM of albedo over the same c samples (w is just 1); sky writes albedo 1,1,1
      const alb = (g[i * 8] + g[i * 8 + 1] + g[i * 8 + 2]) / c;
      if (alb > 2.95) continue;
      const l = (0.2126 * a[i * 4] + 0.7152 * a[i * 4 + 1] + 0.0722 * a[i * 4 + 2]) / c;
      sum += Math.log(Math.max(l, 1e-4)); n++; ls.push(l);
    }
    if (n < 100) return 0;
    const mean = Math.exp(sum / n);
    let ev = Math.log2(target / mean);
    // keep the bright end in range: the 90th percentile should land at most around 1.0 before ACES
    ls.sort((x, y) => x - y);
    const p90 = ls[Math.floor(ls.length * 0.9)];
    if (p90 > 0) ev = Math.min(ev, Math.log2(1.0 / p90));
    return Math.max(-4, Math.min(4, ev));
  };

  // denoise (optional) + tonemap, returns RGBA8 pixels
  R.finish = async ({ denoise = true, iterations = 4, exposure = 0, sigmaColor = 0.25, sigmaNormal = 64, sigmaAlbedo = 0.15 } = {}) => {
    const wg = [Math.ceil(width / 8), Math.ceil(height / 8)];
    const setPP = (step, flags) => {
      const f = new Float32Array(8); const u = new Uint32Array(f.buffer);
      u.set([width, height, step, flags], 0);
      f.set([Math.pow(2, exposure), sigmaColor, sigmaNormal, sigmaAlbedo], 4);
      device.queue.writeBuffer(postParamBuf, 0, f);
    };
    const run = (pipe, bg) => { const enc = device.createCommandEncoder(); const cp = enc.beginComputePass(); cp.setPipeline(pipe); cp.setBindGroup(0, bg); cp.dispatchWorkgroups(wg[0], wg[1]); cp.end(); device.queue.submit([enc.finish()]); };
    let finalBG = R.bgToneA, flags = 0;
    if (denoise) {
      setPP(1, 0); run(preparePipe, R.bgPrepare); // -> pingA
      let inA = true;
      for (let i = 0; i < iterations; i++) {
        setPP(1 << i, 1); await device.queue.onSubmittedWorkDone();
        run(atrousPipe, inA ? R.bgAtrousAB : R.bgAtrousBA);
        inA = !inA;
      }
      finalBG = inA ? R.bgToneA : R.bgToneB; flags = 1;
    }
    setPP(1, flags); await device.queue.onSubmittedWorkDone();
    run(tonePipe, finalBG);
    const enc = device.createCommandEncoder();
    enc.copyBufferToBuffer(outBuf, 0, readBuf, 0, npix * 4);
    device.queue.submit([enc.finish()]);
    await readBuf.mapAsync(GPUMapMode.READ);
    const px = new Uint8ClampedArray(readBuf.getMappedRange().slice(0));
    readBuf.unmap();
    return px;
  };

  R.destroy = () => { try { device.destroy(); } catch (e) {} };
  return R;
}
