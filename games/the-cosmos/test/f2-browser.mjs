// F2 review shots and live checks, in a real browser (Chrome + SwiftShader): the port by day, at dusk and at night; the stars turning; Phobos and
// Deimos moving; the real game flown Mars -> Phobos -> Deimos -> Mars with the moons moving under it. Writes docs/qa/2026-10-03/f2/*.png and results.json.
//   node test/f2-browser.mjs [out-dir]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(join(homedir(), '.codex/runtime/unfinished-island/node_modules/') + 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const out = process.argv[2] || join(root, 'docs/qa/2026-10-03/f2/'); await mkdir(out, { recursive: true });
const port = 8396, srv = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore', cwd: root });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-gl=swiftshader', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = { shots: {}, errors: [] };
const only = process.env.F2_ONLY ? process.env.F2_ONLY.split(',') : null;
const want = (k) => !only || only.includes(k);
try {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => results.errors.push(String(e.message).slice(0, 300) + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).join(' | ')));
  p.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) results.errors.push('console: ' + m.text().slice(0, 300)); });
  await p.goto(`http://127.0.0.1:${port}/?dev=1&solo=1&opening=off&tier=low&sky=live`);
  await p.waitForFunction(() => window.cosmos?.space && cosmos.engine.frameCount >= 3, null, { timeout: 180000 });
  await p.evaluate(() => { cosmos.engine.stop(); });
  // run n frames of 1/30 s with the GPU draw switched off (the CPU work of a frame is all still done), then one drawn frame
  await p.evaluate(() => { window.__run = (n, dt = 1 / 30) => { const r = cosmos.engine.renderer, render = r.render; r.render = () => {}; for (let i = 0; i < n; i++) cosmos.step(dt); r.render = render; cosmos.step(0); }; });
  const run = (n, dt) => p.evaluate(([n, dt]) => window.__run(n, dt), [n, dt]);
  const shot = async (name, extra = {}) => { if (!(await p.evaluate(() => window.__keepFrame))) { await run(3); } await p.waitForTimeout(400); await p.screenshot({ path: join(out, name + '.png') }); results.shots[name] = { ...(await p.evaluate(() => { const s = cosmos.space, st = s.sky.state, sun = cosmos.engine.scene.children.find((c) => c.isDirectionalLight && c.castShadow); return { T: s.timeS(), elev: +st.elev.toFixed(1), vis: +st.vis.toFixed(2), day: +st.day.toFixed(2), sunI: sun ? +sun.intensity.toFixed(2) : null, flood: cosmos.port.flood ? cosmos.port.flood.map((l) => +l.intensity.toFixed(0)) : null, hud: s.hudLines().replace(/<[^>]+>/g, ' ').slice(0, 140) }; })), ...extra }; };
  const face = (target) => p.evaluate((t) => {                        // turn the walker to look at 'ship' | 'tower' | 'sky' | a Mars-axes direction
    const w = cosmos.walker, f = w.updateFrame(); let d;
    if (t === 'sky') { w.pitch = 0.9; return; }
    if (t === 'horizon') { w.pitch = 0.05; return; }
    d = t; const e = d.x * f.east.x + d.y * f.east.y + d.z * f.east.z, n = d.x * f.north.x + d.y * f.north.y + d.z * f.north.z, u = d.x * f.up.x + d.y * f.up.y + d.z * f.up.z;
    w.yaw = Math.atan2(e, n); w.pitch = Math.asin(Math.max(-1, Math.min(1, u / Math.hypot(d.x, d.y, d.z))));
  }, target);
  // an outside view of the ship (the player is aboard): a free camera `back` metres behind and `up` metres above her, looking at her
  const outside = (back, up, side = 0) => p.evaluate(([back, up, side]) => { const f = cosmos.ship.flight, q = f.quaternion; const fw = new (cosmos.ship.flight.quaternion.constructor)(); const l = Math.hypot(f.pos.x, f.pos.y, f.pos.z) || 1, u = { x: f.pos.x / l, y: f.pos.y / l, z: f.pos.z / l };
    const n = f.fwdH || { x: 1, y: 0, z: 0 }, r = f.rightH || { x: 0, y: 0, z: 1 };
    const eye = { x: f.pos.x - n.x * back + u.x * up + r.x * side, y: f.pos.y - n.y * back + u.y * up + r.y * side, z: f.pos.z - n.z * back + u.z * up + r.z * side };
    cosmos.freeCam.set(eye, { x: f.pos.x, y: f.pos.y, z: f.pos.z }); }, [back, up, side]);
  await p.evaluate(() => { window.__setT = (T) => { cosmos.setSkyShift(0); const base = cosmos.worldTimeS(); cosmos.setSkyShift(T - base); return cosmos.worldTimeS(); }; });
  const setT = (T) => p.evaluate((T) => window.__setT(T), T);
  const atSky = (name) => p.evaluate((name) => { cosmos.setSkyShift(0); const T = cosmos.worldTimeS(); cosmos.setSkyShift(cosmos.skyShiftFor(name, -14, -59.2, T)); return cosmos.worldTimeS(); }, name);

  // ---- 1. the port through a day ----------------------------------------------------------------------------------------------
  await p.evaluate(() => { const w = cosmos.walker, s = cosmos.port.site; Object.assign(w.worldPos, s.toWorld(-20, 0.02, 30)); w.yaw = s.heading + 0.5; w.pitch = 0.08; w.updateFrame(); });
  if (want('day')) {
    await atSky('noon'); await shot('01-port-noon');
    await atSky('morning'); await shot('02-port-morning');
    await atSky('sunset'); await shot('03-port-sunset');
    await atSky('dusk'); await shot('04-port-dusk');
    await p.evaluate(() => cosmos.setSkyShift(cosmos.worldTimeS() - cosmos.worldTimeS() + 0)); await atSky('night'); await shot('05-port-night');
    await face('sky'); await shot('06-night-sky-stars');
    await p.evaluate(() => { cosmos.walker.pitch = 0.05; });
    await atSky('dawn'); await shot('07-port-dawn');
  }
  // ---- 2. the sky really turns: the same patch of sky three hours apart -------------------------------------------------------------
  if (want('stars')) {
    const T = await atSky('night'); await face('sky'); await shot('08-stars-a');
    await setT(T + 3 * 3600); await shot('09-stars-three-hours-later');
  }
  // ---- 3. Phobos moving across the port's sky ------------------------------------------------------------------------------------------
  if (want('moons')) {
    await p.evaluate(() => cosmos.setSkyShift(0));
    const T0 = await p.evaluate(() => cosmos.worldTimeS());
    // a moment when Phobos is high over the port, in sunlight (not in Mars's shadow), with the Sun down or low: dusk
    const found = await p.evaluate(async (T0) => { const m = await import('./src/space/frames.js'), w = cosmos.walker.worldPos, f = cosmos.walker.updateFrame(); let best = null;
      for (let k = 0; k < 9000; k++) { const T = T0 + k * 60, c = m.worldKin('phobos', T).c, d = { x: c.x - w.x, y: c.y - w.y, z: c.z - w.z }, l = Math.hypot(d.x, d.y, d.z), el = Math.asin((d.x * f.up.x + d.y * f.up.y + d.z * f.up.z) / l) * 57.3;
        const s = m.sunDirFixed(T), along = c.x * s.x + c.y * s.y + c.z * s.z, miss = Math.hypot(c.x - along * s.x, c.y - along * s.y, c.z - along * s.z), lit = along > 0 || miss > 3.5e6, sunEl = m.sunAt(-14, -59.2, T).elevDeg;
        if (lit && sunEl < 8 && sunEl > -30 && el > 12 && (!best || el > best.el)) best = { k, el, sunEl }; } return best; }, T0);
    results.phobosPass = found;
    for (const [i, dt] of [[0, -1200], [1, 0], [2, 1200]]) {
      await setT(T0 + found.k * 60 + dt); await run(3);
      const d = await p.evaluate(async () => { const m = await import('./src/space/frames.js'), k = m.worldKin('phobos', cosmos.space.timeS()), w = cosmos.walker.worldPos; return { x: k.c.x - w.x, y: k.c.y - w.y, z: k.c.z - w.z }; });
      await face(d); await run(3);
      await p.evaluate(() => { const e = cosmos.engine, c = e.camera; c.fov = 4; c.updateProjectionMatrix(); e.renderer.render(e.scene, c); window.__keepFrame = true; });
      await shot(`10-phobos-over-the-port-${i}`, { dtS: dt, note: 'camera zoomed to a 4 degree field so Phobos (0.2 degrees across) can be seen' });

      await p.evaluate(() => { window.__keepFrame = false; });
      results.shots[`10-phobos-over-the-port-${i}`].phobos = await p.evaluate(async () => { const m = await import('./src/space/frames.js'), k = m.worldKin('phobos', cosmos.space.timeS()); return { speedKmS: +(Math.hypot(k.v.x, k.v.y, k.v.z) / 1000).toFixed(2) }; });
    }
  }
  // ---- 4. the game, flown: Mars -> Phobos -> Deimos -> port, in the browser, with the moons moving ------------------------------------------
  if (want('trips')) {
    await p.evaluate(() => cosmos.setSkyShift(0));
    await p.evaluate(() => { const sh = cosmos.ship, sp = cosmos.space; window.__sp = sp; });
    const board = await p.evaluate(() => { const sh = cosmos.ship; try { sh.boardAt(0, 1.1, -2, 0); } catch (e) { return String(e); } return { aboard: sh.aboard }; });
    results.board = board;
    const fly = async (dest) => {
      const r = await p.evaluate((dest) => { const sp = cosmos.space, f = cosmos.ship.flight; cosmos.ship.aboard = true; const T0 = sp.timeS(); const res = sp.engage(dest); if (res.ok) sp.setWarp(60); return { res, T0, frame: sp.frameId }; }, dest);
      if (!r.res.ok) return { dest, err: r.res.msg };
      let n = 0, lastPhase = '', phases = [], t0 = Date.now(), maxEpochLead = 0, shotsTaken = 0;
      while (n < 16000) {
        const st = await p.evaluate(() => { window.__run(40); const sp = cosmos.space, t = sp.trip; return { active: !!(t && t.active), phase: t ? t.phase : null, epochLead: sp.ship.flight.epochS == null ? 0 : sp.ship.flight.epochS - sp.worldTime(), frame: sp.frameId, landed: sp.ship.flight.landed, dist: t ? t.progress.distM : 0 }; });
        n += 40; maxEpochLead = Math.max(maxEpochLead, st.epochLead);
        if (st.phase && st.phase !== lastPhase) { lastPhase = st.phase; phases.push(st.phase); }
        if (st.phase === 'transit' && shotsTaken === 0 && n > 400) { await outside(90, 25, 25); await shot(`20-${dest}-in-transit`, { dest }); await p.evaluate(() => cosmos.freeCam.off()); shotsTaken = 1; }
        if (!st.active) break;
      }
      await p.evaluate(() => window.__run(240));
      const end = await p.evaluate(() => { const sp = cosmos.space, f = sp.ship.flight; return { frame: sp.frameId, landed: f.landed, speed: Math.hypot(f.vel.x, f.vel.y, f.vel.z), epochS: f.epochS, agl: f.agl }; });
      return { dest, phases, frames: n, maxEpochLeadMin: +(maxEpochLead / 60).toFixed(1), end, wallS: (Date.now() - t0) / 1000 };
    };
    results.trips = [];
    for (const d of ['phobos', 'deimos', 'phobos', 'ceres', 'port']) {
      const r = await fly(d); results.trips.push(r);
      if (r.end?.frame === 'phobos' || r.end?.frame === 'deimos' || r.end?.frame === 'ceres') { await outside(40, 14, 12); await shot(`21-landed-on-${r.end.frame}`, { dest: d }); await p.evaluate(() => cosmos.freeCam.off()); }
      if (r.end?.frame === 'phobos' && !results.marsFromPhobos) {
        // Mars in Phobos's sky: it is locked, so it hangs in the same place; the port side of it turns through day and night
        results.marsFromPhobos = await p.evaluate(() => { const e = cosmos.engine, f = cosmos.ship.flight, m = e.framePoint(e.rootFrame, e.activeFrame, { x: 0, y: 0, z: 0 }, {});
          const l = Math.hypot(f.pos.x, f.pos.y, f.pos.z), eye = { x: f.pos.x * (1 + 6 / l), y: f.pos.y * (1 + 6 / l), z: f.pos.z * (1 + 6 / l) }; cosmos.freeCam.set(eye, m);
          return { marsDirInPhobosFrame: m, upDotMars: (f.pos.x * m.x + f.pos.y * m.y + f.pos.z * m.z) / (l * Math.hypot(m.x, m.y, m.z)) }; });
        await shot('23-mars-from-phobos', { dest: d }); await p.evaluate(() => cosmos.freeCam.off());
      }
      if (r.end?.frame === 'mars') { await outside(60, 10, 10); await shot('22-back-at-the-port', { dest: d }); await p.evaluate(() => cosmos.freeCam.off()); }
    }
  }
  // ---- 5. what a frame costs --------------------------------------------------------------------------------------------------------
  if (want('cost')) {
    const cost = await p.evaluate(() => {
      const r = cosmos.engine.renderer, render = r.render; r.render = () => {};
      const time = (n) => { const t0 = performance.now(); for (let i = 0; i < n; i++) cosmos.step(1 / 60); return (performance.now() - t0) / n; };
      time(30); const day = time(120);
      cosmos.setSkyShift(cosmos.skyShiftFor('night', -14, -59.2, cosmos.worldTimeS())); time(30); const night = time(120);
      const t0 = performance.now(); for (let i = 0; i < 2000; i++) cosmos.space.updateFrames(); const upd = (performance.now() - t0) / 2000;
      r.render = render; return { dayMs: +day.toFixed(2), nightMs: +night.toFixed(2), updateFramesMs: +upd.toFixed(4) };
    });
    results.cost = cost;
  }
} catch (e) { results.errors.push('SCRIPT: ' + (e.stack || e.message)); }
finally {
  await writeFile(join(out, 'results.json'), JSON.stringify(results, null, 1));
  await browser.close(); srv.kill();
}
console.log(JSON.stringify(results, null, 1).slice(0, 6000));
process.exit(results.errors.length ? 1 : 0);
