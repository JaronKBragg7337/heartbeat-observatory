// Test harness: a "kid" who taps what the game offers (Helpers on) or flies by the hints (Do it yourself).
import * as P from '../physics.js';
import * as M from '../missions.js';
const { R, ATM_TOP, STEP, orbitInfo, inOrbit, suggestedLean, dropStage, separateCapsule, resumeBurn, fuelLeft, bodyRel } = P;

export function makeFlight(cfg) {
  const f = P.newFlight({ nose: 'capsule', tank: 'tall', engine: 'big', fins: true, shield: true, stages: 3, legs: true, coastAssist: !cfg.diy, ...cfg });
  f.log = [];
  return f;
}
export function hooksFor(f, extra = {}) {
  return {
    drop: (g) => { if (g.needDrop) { dropStage(g, 10); g.log.push(['drop', g.t]); } },
    separate: (g) => { if (!g.capsuleOnly) { separateCapsule(g, 5); g.log.push(['sep', g.t]); } },
    release: (g) => { g.released = { x: g.x, y: g.y, vx: g.vx, vy: g.vy, T: g.T0 + g.t }; g.log.push(['release', g.t]); },
    docked: (g) => { g.docked = true; g.log.push(['docked', g.t]); },
    event: (g) => {
      for (const e of g.events) {
        g.log.push([e, Math.round(g.t)]);
        if (e === 'stageEmpty' && !g.diy) dropStage(g, 10);
        if (e === 'retroDone' && !g.diy) separateCapsule(g, 5);
      }
      g.events.length = 0;
    },
    ...extra,
  };
}
// run until pred(f) or outcome or tMax (game seconds); ctl(f) runs every `every` seconds and returns lean
export function run(f, { until, tMax = 1e6, dt = 0.05, ctl = null, hooks = null, warp = null }) {
  const H = hooks || hooksFor(f);
  let lean = 0, t0 = f.t, guard = 0;
  while (!f.outcome && f.t - t0 < tMax && guard++ < 2e6) {
    if (until && until(f)) return true;
    if (ctl) { const l = ctl(f); if (typeof l === 'number') lean = l; }
    // the game's own time speed: the helper's request, or auto speed far out, else small steps
    let sp = 1;
    if (f.ap && f.ap.warp) sp = f.ap.warp;
    else { const aw = M.autoWarp(f); if (aw) sp = aw; else if (P.coastLimit(f) > 0) sp = warp || 10; }
    M.advance(f, dt * sp, lean, H);
    autoChute(f);
  }
  return until ? !!until(f) : true;
}
export function autoChute(f) {
  if (f.diy) return;
  const vr = (f.x * f.vx + f.y * f.vy) / Math.hypot(f.x, f.y);
  if (!f.engineOn && !f.chuteOn && f.lifted && !f.inMoon && vr < 0 && f.alt < 5000) f.chuteOn = true;
}
// Helpers-on ascent: hold the slider on the green glow, tap Burn at the top, tap Drop stage
export function helperAscent(f) {
  let pressed = false;
  return run(f, { tMax: 1500, until: g => g.cut || (g.wasOrbitT = inOrbit(g) && !g.engineOn), ctl: g => {
    const vr = (g.x * g.vx + g.y * g.vy) / Math.hypot(g.x, g.y);
    if (g.coasting && fuelLeft(g) > 0 && (vr < 220 || g.alt > ATM_TOP + 20000) && !(vr < 0 && g.alt < ATM_TOP - 15000)) { resumeBurn(g); g.burnPressed = true; }
    if (g.coasting) return 1;
    return suggestedLean(g);
  } });
}
// Do-it-yourself ascent: same flying, but the kid stops the engine and burns at the top by themselves
export function diyAscent(f) {
  let phase = 'up';
  return run(f, { tMax: 1500, until: g => phase === 'done', ctl: g => {
    const o = orbitInfo(g), vr = (g.x * g.vx + g.y * g.vy) / Math.hypot(g.x, g.y);
    if (g.needDrop) dropStage(g, 10);
    if (phase === 'up') {
      if (!g.engineOn && fuelLeft(g) > 0 && !g.needDrop) { g.engineOn = true; g.ign = 0; }
      if (g.alt > 9000 && (o.escape || o.apo > ATM_TOP + 30000)) { g.engineOn = false; phase = 'coast'; }
      return suggestedLean(g);
    }
    if (phase === 'coast') { if (vr < 120 && g.alt > ATM_TOP) { phase = 'circ'; } return 1; }
    if (phase === 'circ') {
      if (!g.engineOn && !g.needDrop) { g.engineOn = true; g.ign = 0; }
      if (!o.escape && o.peri > ATM_TOP + 3000) { g.engineOn = false; phase = 'done'; }
      return 1;
    }
    return 1;
  } });
}
export const fmt = (f) => { const o = orbitInfo(f); const B = bodyRel(f); return `t=${f.t.toFixed(0)} alt=${(f.alt/1000).toFixed(1)}km balt=${(f.balt/1000).toFixed(1)}km inMoon=${f.inMoon} pe=${(o.peri/1000).toFixed(1)} apo=${(o.apo/1000).toFixed(0)} stage=${f.si} fuel=${fuelLeft(f).toFixed(0)} vrel=${Math.hypot(B.vx,B.vy).toFixed(0)} out=${f.outcome}`; };
export { P, M };
