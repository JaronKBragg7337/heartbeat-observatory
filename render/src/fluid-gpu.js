// hb-render: GPU driver for the WebGPU fluid (src/fluid-gpu.wgsl). Fills particles on the CPU
// (same lattice as the JS solver), steps on the GPU, reads positions + wetness back into a plain
// Fluid object so surfacing / pool level / wetness export work unchanged.

import { Fluid, profileSDF } from './fluid.js';
import { m4 } from './mesh.js';

export async function runGPUFluid(device, opts) {
  const { cpu, steps, dt, container, groundFn, log, baseUrl } = opts;
  const src = await (await fetch(baseUrl + 'src/fluid-gpu.wgsl')).text();
  const mod = device.createShaderModule({ code: src });
  const ci = await mod.getCompilationInfo();
  for (const m of ci.messages) if (m.type === 'error') throw new Error(`fluid-gpu.wgsl:${m.lineNum}:${m.linePos} ${m.message}`);
  const names = ['predict', 'clearHeads', 'insert', 'lambdaPass', 'deltaPass', 'applyPass', 'velocityPass', 'finalizePass', 'soakFold', 'soakSpread', 'soakCopy'];
  // one explicit layout for every pass (auto layouts drop the bindings an entry point does not touch)
  const C = GPUShaderStage.COMPUTE;
  const bgl = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: C, buffer: { type: 'uniform' } },
    ...[1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13].map((b) => ({ binding: b, visibility: C, buffer: { type: 'storage' } })),
    { binding: 8, visibility: C, buffer: { type: 'read-only-storage' } },
    { binding: 9, visibility: C, buffer: { type: 'read-only-storage' } },
  ] });
  const layout = device.createPipelineLayout({ bindGroupLayouts: [bgl] });
  const pipes = {};
  for (const n of names) pipes[n] = device.createComputePipeline({ layout, compute: { module: mod, entryPoint: n } });

  const n = cpu.n;
  const cap = n; // no emitter on the GPU path (v0): all particles exist from the start
  const mk = (size, usage, label) => device.createBuffer({ size: Math.max(16, Math.ceil(size / 16) * 16), usage, label });
  const ST = GPUBufferUsage.STORAGE, CD = GPUBufferUsage.COPY_DST, CS = GPUBufferUsage.COPY_SRC;
  const posData = new Float32Array(cap * 4), velData = new Float32Array(cap * 4);
  for (let i = 0; i < n; i++) { posData.set([cpu.x[i * 3], cpu.x[i * 3 + 1], cpu.x[i * 3 + 2], 1], i * 4); velData.set([cpu.v[i * 3], cpu.v[i * 3 + 1], cpu.v[i * 3 + 2], 0], i * 4); }
  const posBuf = mk(cap * 16, ST | CD | CS, 'fpos'); device.queue.writeBuffer(posBuf, 0, posData);
  const velBuf = mk(cap * 16, ST | CD, 'fvel'); device.queue.writeBuffer(velBuf, 0, velData);
  const predBuf = mk(cap * 16, ST, 'fpred');
  const lamBuf = mk(cap * 4, ST, 'flam');
  const dpBuf = mk(cap * 16, ST, 'fdp');
  const tableBits = 21, tableSize = 1 << tableBits;
  const headBuf = mk(tableSize * 4, ST, 'fhead');
  const nxtBuf = mk(cap * 4, ST, 'fnxt');

  // ground height grid over the fluid domain
  const G = opts.groundRect || { x0: -0.3, z0: -0.5, size: 0.6, res: 512 };
  const gData = new Float32Array(G.res * G.res);
  for (let j = 0; j < G.res; j++) for (let i = 0; i < G.res; i++) gData[i + G.res * j] = groundFn(G.x0 + i / (G.res - 1) * G.size, G.z0 + j / (G.res - 1) * G.size);
  const groundBuf = mk(gData.byteLength, ST | CD, 'fground'); device.queue.writeBuffer(groundBuf, 0, gData);

  // bottle shell SDF grid (2D r,y)
  const prof = container.profile;
  const rMax = Math.max(...prof.map((p) => p[0])) + 0.01, ys = prof.map((p) => p[1]);
  const sdf = profileSDF(prof, rMax, Math.min(...ys) - 0.01, Math.max(...ys) + 0.01, 0.0003);
  const sdfBuf = mk(sdf.d.byteLength, ST | CD, 'fsdf'); device.queue.writeBuffer(sdfBuf, 0, sdf.d);

  // wetness
  const w = cpu.wet;
  const wres = w.res;
  const wetAdd = mk(wres * wres * 4, ST | CD, 'fwetAdd'); device.queue.writeBuffer(wetAdd, 0, new Uint32Array(wres * wres));
  const wetA = mk(wres * wres * 4, ST | CD | CS, 'fwetA'); device.queue.writeBuffer(wetA, 0, new Float32Array(wres * wres));
  const wetB = mk(wres * wres * 4, ST, 'fwetB');
  const counters = mk(16, ST | CD | CS, 'fcount'); device.queue.writeBuffer(counters, 0, new Uint32Array(4));
  const paramBuf = mk(256, GPUBufferUsage.UNIFORM | CD, 'fparams');

  const inv = m4.invertRigid(container.matrix), T = container.matrix;
  const aTotal = w.diffusion * dt / (w.cell * w.cell);
  const passes = Math.max(1, Math.ceil(aTotal / 0.2));
  const params = (step) => {
    const f = new Float32Array(64); const u = new Uint32Array(f.buffer);
    f.set([dt, cpu.h, cpu.rho0, cpu.s], 0);
    u.set([n, cpu.iters, tableSize - 1, step], 4);
    f.set([cpu.gravity[0], cpu.gravity[1], cpu.gravity[2], cpu.viscosity], 8);
    f.set([cpu.maxSpeed, cpu.friction, cpu.domain, cpu.scorrK], 12);
    f.set([G.x0, G.z0, G.size, G.res], 16);
    f.set([sdf.cell, sdf.yMin, sdf.nr, sdf.ny], 20);
    f.set([w.origin[0], w.origin[1], w.size, wres], 24);
    f.set([w.absorbRate, w.deposit, w.saturation, w.trail], 28);
    f.set([aTotal / passes, passes, cpu.scorrW, 0], 32);
    f.set([inv[0], inv[4], inv[8], 0], 36); f.set([inv[1], inv[5], inv[9], 0], 40); f.set([inv[2], inv[6], inv[10], 0], 44); f.set([inv[12], inv[13], inv[14], 0], 48);
    f.set([T[0], T[1], T[2], 0], 52); f.set([T[4], T[5], T[6], 0], 56); f.set([T[8], T[9], T[10], 0], 60);
    return f;
  };
  const bgAll = device.createBindGroup({ layout: bgl, entries: [
    { binding: 0, resource: { buffer: paramBuf } }, { binding: 1, resource: { buffer: posBuf } }, { binding: 2, resource: { buffer: velBuf } },
    { binding: 3, resource: { buffer: predBuf } }, { binding: 4, resource: { buffer: lamBuf } }, { binding: 5, resource: { buffer: dpBuf } },
    { binding: 6, resource: { buffer: headBuf } }, { binding: 7, resource: { buffer: nxtBuf } }, { binding: 8, resource: { buffer: groundBuf } },
    { binding: 9, resource: { buffer: sdfBuf } }, { binding: 10, resource: { buffer: wetAdd } }, { binding: 11, resource: { buffer: wetA } },
    { binding: 12, resource: { buffer: wetB } }, { binding: 13, resource: { buffer: counters } }] });
  const bg = Object.fromEntries(names.map((nm) => [nm, bgAll]));

  const wgP = Math.ceil(n / 256), wgT = Math.ceil(tableSize / 256), wgW = Math.ceil(wres * wres / 256);
  const t0 = performance.now();
  for (let s = 0; s < steps; s++) {
    device.queue.writeBuffer(paramBuf, 0, params(s));
    const enc = device.createCommandEncoder();
    const cp = enc.beginComputePass();
    const run = (nm, wg) => { cp.setPipeline(pipes[nm]); cp.setBindGroup(0, bg[nm]); cp.dispatchWorkgroups(wg); };
    run('predict', wgP); run('clearHeads', wgT); run('insert', wgP);
    for (let it = 0; it < cpu.iters; it++) { run('lambdaPass', wgP); run('deltaPass', wgP); run('applyPass', wgP); }
    run('velocityPass', wgP); run('finalizePass', wgP);
    run('soakFold', wgW);
    for (let k = 0; k < passes; k++) { run('soakSpread', wgW); run('soakCopy', wgW); }
    cp.end();
    device.queue.submit([enc.finish()]);
    if (s % 120 === 0) { await device.queue.onSubmittedWorkDone(); log(`gpu fluid step ${s}/${steps} t=${(s * dt).toFixed(3)}s (${((performance.now() - t0) / 1000).toFixed(1)}s)`); }
  }
  await device.queue.onSubmittedWorkDone();
  // read back
  const read = async (buf, bytes) => { const rb = mk(bytes, GPUBufferUsage.MAP_READ | CD, 'rb'); const e = device.createCommandEncoder(); e.copyBufferToBuffer(buf, 0, rb, 0, bytes); device.queue.submit([e.finish()]); await rb.mapAsync(GPUMapMode.READ); const a = rb.getMappedRange().slice(0); rb.unmap(); rb.destroy(); return a; };
  const pf = new Float32Array(await read(posBuf, cap * 16));
  const wf = new Float32Array(await read(wetA, wres * wres * 4));
  const cnt = new Uint32Array(await read(counters, 16));
  let alive = 0;
  for (let i = 0; i < n; i++) if (pf[i * 4 + 3] > 0.5) { cpu.x[alive * 3] = pf[i * 4]; cpu.x[alive * 3 + 1] = pf[i * 4 + 1]; cpu.x[alive * 3 + 2] = pf[i * 4 + 2]; alive++; }
  cpu.n = alive;
  cpu.wet.data.set(wf);
  cpu.absorbed = cnt[0];
  cpu.time = steps * dt;
  for (const b of [posBuf, velBuf, predBuf, lamBuf, dpBuf, headBuf, nxtBuf, groundBuf, sdfBuf, wetAdd, wetA, wetB, counters, paramBuf]) b.destroy();
  return { seconds: (performance.now() - t0) / 1000, particles: alive, initial: n, absorbed: cnt[0] };
}
