// Bots that play each mode. The tests use them to prove every mode can be won (and lost); ?director=1 uses them too.
// Each bot is (game) -> { think(input) } that writes a world-space input every step. No positions are hard-coded:
// everything comes from the layout.
import { makePath } from './world.js';

const hyp = Math.hypot;
function steerTo(input, from, tx, tz, run) {
  const dx = tx - from.x, dz = tz - from.z, d = hyp(dx, dz);
  if (d < 1e-3) { input.mx = input.mz = 0; } else { const k = Math.min(1, d / 0.4); input.mx = (dx / d) * k; input.mz = (dz / d) * k; }
  input.run = !!run; input.fx = d > 1e-3 ? dx / d : 0; input.fz = d > 1e-3 ? dz / d : 1;
  return d;
}
function pathSteer(g, path, state, tx, tz, run, input, every = 0.4) {
  state.replan -= 1 / 60;
  if (state.replan <= 0 || hyp(state.tx - tx, state.tz - tz) > 2) {
    g.nav.findPath(g.player.x, g.player.z, tx, tz, path); path.i = 0; state.replan = every; state.tx = tx; state.tz = tz;
  }
  while (path.i < path.n - 1 && hyp(path.pts[path.i].x - g.player.x, path.pts[path.i].z - g.player.z) < 0.6) path.i++;
  const p = path.n ? path.pts[Math.min(path.i, path.n - 1)] : { x: tx, z: tz };
  return steerTo(input, g.player, p.x, p.z, run);
}

export function idleBot() { return { think(input) { input.mx = input.mz = 0; input.run = false; input.action = false; } }; }

// Find: it listens for the gobble and walks to it (it cheats a little: it always knows where the gobble came from).
export function findBot(g) {
  const path = makePath(), st = { replan: 0, tx: 1e9, tz: 1e9 };
  let heardX = null, heardZ = null;
  return {
    think(input) {
      input.action = false;
      for (const e of g.events) if (e.type === 'gobble' || e.type === 'slip') { heardX = e.x; heardZ = e.z; }
      if (g.turkey.state === 'slip' || heardX === null) { if (heardX === null) { input.mx = input.mz = 0; return; } }
      const tx = g.turkey.state === 'slip' ? g.turkey.x : heardX, tz = g.turkey.state === 'slip' ? g.turkey.z : heardZ;
      const d = pathSteer(g, path, st, tx, tz, true, input);
      if (hyp(g.turkey.x - g.player.x, g.turkey.z - g.player.z) < 2.6) input.action = true;
      if (d < 0.8) { heardX = g.turkey.x; heardZ = g.turkey.z; }
    },
  };
}

// Hunted, fleeing: runs laps around the farmhouse, always keeping the house between itself and the turkey.
export function huntedFleeBot(g) {
  const L = g.layout;
  const ids = ['farmhouse', 'porch'];
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  const boxes = g.world.boxes.filter((b) => ids.includes(b.id));
  const use = boxes.length ? boxes : [g.world.boxes.slice().sort((a, b) => b.hw * b.hd - a.hw * a.hd)[0]];
  for (const b of use) { const e = Math.abs(b.hw * b.c) + Math.abs(b.hd * b.s), f = Math.abs(b.hw * b.s) + Math.abs(b.hd * b.c); minX = Math.min(minX, b.x - e); maxX = Math.max(maxX, b.x + e); minZ = Math.min(minZ, b.z - f); maxZ = Math.max(maxZ, b.z + f); }
  const m = 3.4, a = L.arena;
  const corners = [
    { x: Math.max(a.minX + 1, minX - m), z: Math.max(a.minZ + 1, minZ - m) }, { x: Math.min(a.maxX - 1, maxX + m), z: Math.max(a.minZ + 1, minZ - m) },
    { x: Math.min(a.maxX - 1, maxX + m), z: Math.min(a.maxZ - 1, maxZ + m) }, { x: Math.max(a.minX + 1, minX - m), z: Math.min(a.maxZ - 1, maxZ + m) },
  ];
  const path = makePath(), st = { replan: 0, tx: 1e9, tz: 1e9 };
  let target = -1;
  const T = g.turkey, P = g.player;
  function score(c) { return hyp(c.x - T.x, c.z - T.z) - hyp(c.x - P.x, c.z - P.z); }
  return {
    corners,
    think(input) {
      input.action = false;
      if (target < 0) { let bs = -1e9; corners.forEach((c, i) => { const s = score(c); if (s > bs) { bs = s; target = i; } }); }
      const c = corners[target];
      if (hyp(c.x - P.x, c.z - P.z) < 1.4) {
        const n1 = corners[(target + 1) % 4], n2 = corners[(target + 3) % 4];
        target = hyp(n1.x - T.x, n1.z - T.z) >= hyp(n2.x - T.x, n2.z - T.z) ? (target + 1) % 4 : (target + 3) % 4;
      }
      const dT = hyp(T.x - P.x, T.z - P.z);
      const run = dT < 7.5 && !P.exhausted;
      pathSteer(g, path, st, corners[target].x, corners[target].z, run, input, 0.5);
      // sidestep a charge: once it is coming, step across its line
      if (T.state === 'charge' || T.state === 'windup') {
        const sx = -T.cdz || -Math.cos(T.heading), sz = T.cdx || Math.sin(T.heading);
        const side = ((P.x - T.x) * sx + (P.z - T.z) * sz) >= 0 ? 1 : -1;
        input.mx = input.mx * 0.4 + sx * side * 0.9; input.mz = input.mz * 0.4 + sz * side * 0.9; input.run = P.stamina > 0.02;
      }
    },
  };
}

// Hunt, winning: walks in calmly, circles to the turkey's exit side, then sprints and dives.
export function huntWinBot(g) {
  const path = makePath(), st = { replan: 0, tx: 1e9, tz: 1e9 };
  const T = g.turkey, P = g.player, exits = g.layout.exits;
  return {
    think(input) {
      input.action = false;
      if (g.dive.t > 0 || g.dive.down > 0) { input.mx = input.mz = 0; return; }
      let e = T.exit;
      if (!e) { let bd = 1e9; for (const x of exits) { const d = hyp(x.x - T.x, x.z - T.z); if (d < bd) { bd = d; e = x; } } }
      const d = hyp(T.x - P.x, T.z - P.z);
      // stand between the turkey and its way out
      const ex = e.x - T.x, ez = e.z - T.z, el = Math.max(1e-3, hyp(ex, ez));
      const k = Math.min(3.5, el * 0.5);
      let tx = T.x + (ex / el) * k, tz = T.z + (ez / el) * k;
      if (d < 4.5) { tx = T.x + T.vx * 0.3; tz = T.z + T.vz * 0.3; }
      pathSteer(g, path, st, tx, tz, d < 13 && P.stamina > 0.05, input, 0.25);
      if (d < 2.3) {
        const lx = T.x + T.vx * 0.15 - P.x, lz = T.z + T.vz * 0.15 - P.z, l = Math.max(1e-3, hyp(lx, lz));
        input.mx = lx / l; input.mz = lz / l; input.action = true;
      }
    },
  };
}

// Escape: crosses the yard to the south gate, then waits at each lane for a clear gap, and takes the ford stones.
export function escapeBot(g) {
  const L = g.layout, esc = L.escape, P = g.player, TPr = P.P.r;
  const path = makePath(), st = { replan: 0, tx: 1e9, tz: 1e9 };
  const gate = L.exits.find((e) => e.id === 'south_gate') || { x: 0, z: L.arena.maxZ };
  const creek = esc.lanes.find((l) => l.kind === 'creek');
  let stone = 0, committed = -1, atFord = false;
  function safe(lane) {
    const v = P.P.run, su = g.speedUp();
    for (const sub of g.lanes[g.cleared].subs) {
      const t0 = (sub.z - sub.w / 2 - TPr - P.z) / v - 0.15, t1 = (sub.z + sub.w / 2 + TPr - P.z) / v + 0.25;
      for (const veh of sub.list) {
        const sp = sub.dir * sub.speed * su;
        for (let t = Math.max(0, t0); t <= t1; t += 0.05) {
          if (Math.abs(veh.x + sp * t - P.x) < veh.l / 2 + TPr + 0.7) return false;
        }
      }
    }
    return true;
  }
  return {
    think(input) {
      input.action = false;
      if (g.phase !== 'play') { input.mx = input.mz = 0; return; }
      if (P.z < 0.6) {                                   // the yard
        if (P.z > gate.z - 2.5 && Math.abs(P.x - gate.x) < 2) steerTo(input, P, gate.x, gate.z + 2, true);
        else pathSteer(g, path, st, gate.x, gate.z - 1.2, true, input, 0.4);
        return;
      }
      const next = esc.lanes[g.cleared];
      if (!next) { steerTo(input, P, P.x, P.z + 3, true); return; }
      if (next.kind === 'creek') {
        const stones = creek.stones;
        if (P.z < next.z0 - 0.2) { stone = 0; if (!atFord) { if (steerTo(input, P, stones[0].x, next.z0 - 1.0, true) < 0.4) atFord = true; return; } }
        if (stone < stones.length) {
          const s = stones[stone];
          if (steerTo(input, P, s.x, s.z, true) < 0.3) stone++;
        } else steerTo(input, P, stones[stones.length - 1].x, next.z1 + 1.2, true);
        return;
      }
      atFord = false;
      const wait = next.z0 - 1.2;
      if (committed === g.cleared) { steerTo(input, P, P.x, next.z1 + 1.5, true); if (P.z < wait - 0.5) committed = -1; return; }
      if (P.z < wait - 0.3) { steerTo(input, P, P.x, wait, true); return; }
      if (safe(next)) { committed = g.cleared; steerTo(input, P, P.x, next.z1 + 1.5, true); }
      else { input.mx = input.mz = 0; }
    },
  };
}
