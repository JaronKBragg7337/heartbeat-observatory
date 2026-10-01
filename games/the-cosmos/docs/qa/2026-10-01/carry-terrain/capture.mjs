// Local browser review: node docs/qa/2026-10-01/carry-terrain/capture.mjs
// The before PNGs/JSON were captured from the original source, before editing.
import { createRequire } from 'node:module';
const require = createRequire('file:///C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/');
const { chromium } = require('playwright');
import { writeFileSync, mkdirSync } from 'node:fs';
const stage = process.argv[2] || 'after';
if (stage !== 'after') throw Error('The original before capture is preserved; this script refreshes after and paired comparisons only.');
const dir = new URL('./', import.meta.url);
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 750, height: 470 }, deviceScaleFactor: 1 });
const h = { browser, page };
const errors = [];
h.page.on('pageerror', e => errors.push(String(e)));
const results = [];
try {
  await page.goto('http://localhost:8393/?tier=low');
  await page.waitForFunction(() => window.cosmos?.engine, null, { timeout: 120000 });
  await page.waitForLoadState('networkidle');
  await h.page.evaluate(() => cosmos.engine.stop());
  for (const height of [120, 1000]) {
    const setup = await h.page.evaluate(async height => {
      const c = cosmos;
      const { localFrame } = await import('/src/world/geodesy.js');
      const f = localFrame(-14, -59.2), p = c.patch.worldPos;
      const add = (p, u, a) => ({ x: p.x + u.x * a, y: p.y + u.y * a, z: p.z + u.z * a });
      const eye = add(p, f.up, height);
      c.freeCam.set(eye, add(add(eye, f.north, 20000), f.up, -1400));
      if (c.horizonView) c.horizonView(height);
      for (let i = 0; i < 5; i++) c.step();
      return { content: document.body.innerText.slice(0, 400), depthBits: c.depthBits };
    }, height);
    const stats = await h.page.evaluate(() => {
      const c = cosmos, r = c.engine.renderer;
      r.info.autoReset = false;
      const samples = [], completed = [], gl = r.getContext(), pixel = new Uint8Array(4);
      for (let i = 0; i < 5; i++) { c.step(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); }
      let triangles, calls;
      for (let i = 0; i < 15; i++) {
        r.info.reset();
        r.getContext().finish();
        const t = performance.now(); c.step();
        samples.push(performance.now() - t);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); completed.push(performance.now() - t);
        ({ triangles, calls } = r.info.render);
      }
      r.info.autoReset = true;
      samples.sort((a, b) => a - b);
      completed.sort((a, b) => a - b);
      return { triangles, calls, medianStepMs: samples[7], p95StepMs: samples[14],
        terrainTriangles: [c.patch, c.nearPatch, ...(c.farPatches || [])].reduce((s, p) => s + p.geo.index.count / 3, 0) + 16128,
        completedMedianMs: completed[7], completedP95Ms: completed[14],
        farBuildMs: (c.farPatches || []).map(p => p.lastBuildMs), ledger: c.ledger() };
    });
    await h.page.screenshot({ path: new URL(`${stage}-${height}.png`, dir).pathname.replace(/^\/(\w:)/, '$1') });
    results.push({ height, ...setup, ...stats });
    console.log(stage, height, JSON.stringify(stats));
    if (stage === 'after') {
      const paired = await page.evaluate(height => {
        const c = cosmos, r = c.engine.renderer;
        const measure = before => {
          c.horizonView(height, { before });
          if (before) {
            // Restore original mid geometry and omit the newly added edge skirts for the comparison.
            c.patch.geo.attributes.position.array.set(c.patch._basePos);
            c.patch.geo.attributes.position.needsUpdate = true;
            c.patch.geo.setDrawRange(0, c.patch.geo.index.count - c.patch._edge.length * 6);
          } else { c.patch.geo.setDrawRange(0, Infinity); }
          const gl = r.getContext(), pixel = new Uint8Array(4);
          for (let i = 0; i < 5; i++) { c.step(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); }
          r.info.autoReset = false;
          const times = [];
          for (let i = 0; i < 15; i++) {
            r.info.reset(); r.getContext().finish();
            const t = performance.now(); c.step(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
            times.push(performance.now() - t);
          }
          const { triangles, calls } = r.info.render;
          r.info.autoReset = true; times.sort((a, b) => a - b);
          return { triangles, calls, completedMedianMs: times[7], completedP95Ms: times[14] };
        };
        const before = measure(true), after = measure(false);
        return { before, after, note: 'Matched assets and logarithmic depth in both states. Before omits new terrain tiers/skirts, restores original mid positions and original fog. Timed step + synchronous pixel readback on SwiftShader; not phone hardware.' };
      }, height);
      results[results.length - 1].paired = paired;
      console.log('paired', height, JSON.stringify(paired));
    }
  }
  writeFileSync(new URL(`${stage}.json`, dir), JSON.stringify({ stage, renderer: 'headless Edge Chromium / SwiftShader, 750x470, DPR 1, low tier; step CPU time and completed software frame with synchronous pixel readback; not phone hardware', results, errors }, null, 2));
} finally { await h.browser.close(); }
