// Heartbeat Rocket - physics (no drawing, no DOM). Shared by the game and by the tuning script.
// One flat plane: inverse-square gravity, thrust with fuel mass, drag that thins with height, stages,
// reentry heating. Small planet like Kerbal's: radius 600 km, surface gravity 9.81, air up to 70 km.
// Built by Claude (Opus 5.5) for Heartbeat Observatory. CC0.

export const R = 600000, G0 = 9.81, GM = G0 * R * R;
export const ATM_TOP = 70000, H_SCALE = 5600, RHO0 = 1.225;
export const PAD_H = 1.5, SITE_R = 14;
export const STEP = 1 / 120;
export const MAX_LEAN = Math.PI / 2;
export const CHUTE_CDA = 450, CHUTE_MAX_G = 6, SAFE_LAND = 14;
export const DEG = Math.PI / 180;

export const NOSES = {
  capsule: { name: 'Capsule', m: 900, cda: 1.3 },
  pointy:  { name: 'Pointy',  m: 860, cda: 1.0 },
};
export const TANKS = {
  short:   { name: 'Short',  fuel: 800,  dry: 180, h: 3.0 },
  medium:  { name: 'Medium', fuel: 3000, dry: 330, h: 5.6 },
  tall:    { name: 'Tall',   fuel: 7200, dry: 750, h: 9.6 },
  booster: { name: 'Booster', fuel: 7600, dry: 760, h: 9.6 },
};
export const ENGINES = {
  small:   { name: 'Small', thrust: 56000,  ispSL: 230, ispVac: 270, m: 450,  bellR: 0.72, bellH: 1.35 },
  big:     { name: 'Big',   thrust: 150000, ispSL: 265, ispVac: 310, m: 1300, bellR: 1.12, bellH: 2.15 },
  // the booster under a 2-stage rocket: three bells side by side
  booster: { name: 'Booster', thrust: 300000, ispSL: 262, ispVac: 292, m: 1900, bellR: 0.6, bellH: 1.5, cluster: 3 },
};
export const FINS_M = 120, FINS_CDA = 0.15;
export const SHIELD_M = 150;

// reentry heating, only while coming down: grows with speed above HEAT_V once the air is thick enough to
// matter. A fall from a plain trip to space is too slow to burn; coming home from going around is not.
export const HEAT_V = 1300, HEAT_SAFE = 0.3, HEAT_CAP = 6.0;

export function wrapA(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

// cfg: { nose, tank, engine, fins:bool, shield:bool, stages:1|2 }
export function newFlight(cfg) {
  const N = NOSES[cfg.nose];
  const stack = [];
  if (cfg.stages === 2) stack.push(makeStage('booster', 'booster', true));
  stack.push(makeStage(cfg.tank, cfg.engine, false));
  if (cfg.fins) stack[0].dry += FINS_M;
  return {
    x: 0, y: R + PAD_H, vx: 0, vy: 0, heading: 0,
    stages: stack, si: 0, payload: N.m + (cfg.shield ? SHIELD_M : 0),
    noseCda: N.cda, fins: !!cfg.fins, finsOn: !!cfg.fins, shield: !!cfg.shield,
    engineOn: true, ign: 0, lifted: false, t: 0, maxAlt: 0, chute: 0, chuteOn: false,
    outcome: null, leanLow: 0, wob: 0, alt: PAD_H, air: 1, q: 0, thr: 0,
    heat: 0, plasma: 0, peakFlux: 0, capsuleOnly: false, retro: false, needDrop: false,
    cut: false, wasOrbit: false, coastAssist: !!cfg.coastAssist, coasting: false, coastUsed: false, events: [],
    diy: !!cfg.diy,   // "do it yourself": no automatic engine stops; the rocket turns where you lean even with the engine off
  };
}
function makeStage(tank, engine, booster) {
  const T = TANKS[tank], E = ENGINES[engine];
  return { tank, engine, booster, eng: E, fuel: T.fuel, fuelMax: T.fuel, dry: T.dry + E.m, mdot: E.thrust / (E.ispVac * G0) };
}
export function stage(f) { return f.capsuleOnly ? null : f.stages[f.si]; }
export function mass(f) {
  let m = f.payload;
  if (!f.capsuleOnly) for (let i = f.si; i < f.stages.length; i++) m += f.stages[i].dry + f.stages[i].fuel;
  return m;
}
export function fuelLeft(f) { const s = stage(f); return s ? s.fuel : 0; }
export function hasMoreStages(f) { return !f.capsuleOnly && f.si < f.stages.length - 1; }

export function orbitInfo(f) {
  const r = Math.hypot(f.x, f.y), v2 = f.vx * f.vx + f.vy * f.vy;
  const E = 0.5 * v2 - GM / r, hm = f.x * f.vy - f.y * f.vx;
  if (E >= 0) return { escape: true, peri: 0, apo: Infinity };
  const a = -GM / (2 * E), e = Math.sqrt(Math.max(0, 1 + 2 * E * hm * hm / (GM * GM)));
  return { escape: false, peri: a * (1 - e) - R, apo: a * (1 + e) - R, a, e };
}
export function inOrbit(f) { if (f.alt < ATM_TOP) return false; const o = orbitInfo(f); return !o.escape && o.peri > ATM_TOP; }

// The exact free-fall path (a conic) from where the rocket is now, forward in time, until it meets the
// ground or goes all the way around. Returns { pts:[[x,y]...], hit:[x,y]|null, wraps:bool, escape:bool, dir:+1|-1 }.
export function conicPath(x, y, vx, vy, n = 360) {
  const r = Math.hypot(x, y), h = x * vy - y * vx;
  const dir = h >= 0 ? 1 : -1;     // +1: counter-clockwise (math angle growing)
  const out = { pts: [[x, y]], hit: null, wraps: false, escape: false, dir };
  if (Math.abs(h) < 1e-3) {         // straight up and down: just the vertical line to the apex and back
    const v2 = vx * vx + vy * vy, E = 0.5 * v2 - GM / r, vr = (x * vx + y * vy) / r;
    const ux = x / r, uy = y / r;
    const rTop = E < 0 ? -GM / E : R * 8;
    if (vr > 0) out.pts.push([ux * rTop, uy * rTop]);
    out.pts.push([ux * R, uy * R]); out.hit = [ux * R, uy * R];
    if (E >= 0) out.escape = true;
    return out;
  }
  const mu = GM, v2 = vx * vx + vy * vy, rv = x * vx + y * vy;
  const ex = ((v2 - mu / r) * x - rv * vx) / mu, ey = ((v2 - mu / r) * y - rv * vy) / mu;
  const e = Math.hypot(ex, ey), p = h * h / mu;
  const w = e > 1e-9 ? Math.atan2(ey, ex) : 0;
  const ang0 = Math.atan2(y, x);
  out.escape = e >= 1;
  // a short hop only sweeps a sliver of the circle: find where it lands, then sample that part finely
  let sweep = Math.PI * 2;
  for (let i = 1; i <= n; i++) {
    const th = ang0 + dir * (i / n) * Math.PI * 2 - w, den = 1 + e * Math.cos(th);
    if (den <= 1e-4 || p / den <= R) { sweep = Math.min(Math.PI * 2, (i / n) * Math.PI * 2); break; }
  }
  if (sweep < Math.PI * 2) n = Math.max(48, Math.round(160 * Math.min(1, sweep * 4)));
  let prev = [x, y], prevR = r;
  for (let i = 1; i <= n; i++) {
    const ang = ang0 + dir * (i / n) * sweep;
    const th = ang - w;
    const den = 1 + e * Math.cos(th);
    if (den <= 1e-4) { break; }
    const rr = p / den;
    if (rr > R * 9) { out.pts.push([Math.cos(ang) * R * 9, Math.sin(ang) * R * 9]); break; }
    const pt = [Math.cos(ang) * rr, Math.sin(ang) * rr];
    if (rr <= R) {
      // where between the last point and this one the path meets the ground
      const k = (prevR - R) / Math.max(1e-6, prevR - rr);
      const a2 = Math.atan2(prev[1], prev[0]) + dir * (1 / n) * sweep * k;
      out.hit = [Math.cos(a2) * R, Math.sin(a2) * R]; out.pts.push(out.hit);
      return out;
    }
    out.pts.push(pt); prev = pt; prevR = rr;
    if (i === n && sweep >= Math.PI * 2) out.wraps = true;
  }
  return out;
}

// The lean we would like a kid to hold, for the "lean now" hint. 0 = straight up, 1 = flat sideways.
// Straight up through the thick air, then lean over in steps; once the top of the path is above the
// air, lean all the way so the speed goes sideways.
export function suggestedLean(f) {
  const h = f.alt;
  if (f.coasting || (f.coastUsed && f.engineOn)) return 1;
  if (h < 9000) return 0;
  if (h < 20000) return 0.5;
  if (h < 35000) return 0.7;
  return 0.85;
}

// one fixed physics step. lean: slider -1..1. Pushes event names into f.events.
export function stepPhysics(f, dt, lean) {
  const r = Math.hypot(f.x, f.y), h = r - R, ux = f.x / r, uy = f.y / r;
  const phi = Math.atan2(f.x, f.y);
  const rho = h < ATM_TOP ? RHO0 * Math.exp(-h / H_SCALE) : 0, air = rho / RHO0;
  const v2 = f.vx * f.vx + f.vy * f.vy, v = Math.sqrt(v2), q = 0.5 * rho * v2;
  const m = mass(f);
  const st = stage(f);
  f.air = air; f.q = q;

  // without fins, the rocket wobbles when the air pushes hard on it
  const wAmp = (f.finsOn ? 0.12 : 1) * Math.min(9, q / 2500) * DEG;
  f.wob = wAmp * (0.7 * Math.sin(f.t * 2.3) + 0.3 * Math.sin(f.t * 5.3 + 1));

  const retroA = Math.atan2(-f.vx, -f.vy);
  let target = null, rate = 0;
  const wantsBurn = f.engineOn && st && st.fuel > 0;
  if (f.retro && wantsBurn) { target = retroA; rate = 40 * DEG; }
  else if (wantsBurn) { target = f.lifted ? phi + lean * MAX_LEAN + f.wob : phi; rate = 30 * DEG; }
  else if (f.chuteOn && v > 0.5) { target = retroA; rate = 120 * DEG * f.chute; }
  else if (f.capsuleOnly && v > 5) { target = retroA; rate = 25 * DEG; }   // heat shield first
  else if (f.diy && f.lifted && q < 30) { target = phi + lean * MAX_LEAN; rate = 30 * DEG; }   // do it yourself: point it before you burn
  else if (q > 30 && v > 5) { target = Math.atan2(f.vx, f.vy); rate = Math.min(50, q / 250) * DEG; }
  if (target !== null) { const dA = wrapA(target - f.heading), mx = rate * dt; f.heading += Math.max(-mx, Math.min(mx, dA)); }
  const aligned = !f.retro || Math.abs(wrapA(retroA - f.heading)) < 6 * DEG;
  const burning = wantsBurn && aligned;

  let ax = -GM * ux / (r * r), ay = -GM * uy / (r * r);
  f.thr = 0;
  if (burning) {
    f.ign = Math.min(1, f.ign + dt / 0.8);
    const isp = st.eng.ispSL * air + st.eng.ispVac * (1 - air);
    const thrust = st.mdot * isp * G0 * f.ign;
    f.thr = thrust;
    ax += thrust / m * Math.sin(f.heading); ay += thrust / m * Math.cos(f.heading);
    st.fuel -= st.mdot * f.ign * dt;
    if (f.lifted && h < 8000) f.leanLow = Math.max(f.leanLow, Math.abs(lean));
    if (st.fuel <= 0) {
      st.fuel = 0; f.engineOn = false;
      if (f.retro) { f.retro = false; f.events.push(inOrbitNow(f) ? 'retroNoFuel' : 'retroDone'); }
      else if (hasMoreStages(f)) { f.needDrop = true; f.events.push('stageEmpty'); }
      else f.events.push('burnout');
    }
  }
  if (rho > 0 && v > 0.01) {
    const aoa = wrapA(f.heading - Math.atan2(f.vx, f.vy));
    const s = Math.sin(aoa);
    const cda = f.capsuleOnly ? 1.6 : f.noseCda + (f.finsOn ? FINS_CDA : 0);
    let D = q * cda * (1 + (v > 30 && !f.capsuleOnly ? 1.5 * s * s : 0));
    let Dc = q * CHUTE_CDA * f.chute * f.chute; Dc = Math.min(Dc, m * G0 * CHUTE_MAX_G);
    D += Dc;
    ax -= D / m * f.vx / v; ay -= D / m * f.vy / v;
  }
  if (f.chuteOn) f.chute = Math.min(1, f.chute + dt / 2.5);

  // heating on the way down
  const vr = (f.vx * ux + f.vy * uy);
  const flux = (rho > 0 && vr < 0) ? Math.min(1, air / 2e-4) * Math.max(0, v - HEAT_V) / 1000 : 0;
  f.plasma = Math.max(0, Math.min(1, flux * 1.6));
  if (flux > f.peakFlux) f.peakFlux = flux;
  f.heat = Math.max(0, f.heat + (Math.max(0, flux - HEAT_SAFE) / HEAT_CAP - (flux > 0 ? 0 : 0.02)) * dt);
  if (f.heat >= 1 && !f.shield && !f.outcome) { f.outcome = 'toasty'; f.events.push('toasty'); }

  f.vx += ax * dt; f.vy += ay * dt;
  const nx = f.x + f.vx * dt, ny = f.y + f.vy * dt, nr = Math.hypot(nx, ny), nh = nr - R;
  const onPadSpot = Math.hypot(nx, ny - R) < SITE_R;
  const floor = (!f.lifted || onPadSpot) ? PAD_H : 0;
  if (nh <= floor) {
    const nux = nx / nr, nuy = ny / nr;
    if (!f.lifted) { f.vx = 0; f.vy = 0; f.x = nux * (R + PAD_H); f.y = nuy * (R + PAD_H); }
    else {
      f.x = nux * (R + floor); f.y = nuy * (R + floor);
      const sp = Math.hypot(f.vx, f.vy);
      f.engineWasOnAtHit = burning;
      f.vx = 0; f.vy = 0; f.engineOn = false; f.hit = sp;
      if (!f.outcome) { f.outcome = sp < SAFE_LAND ? 'landed' : 'crash'; f.events.push(f.outcome); }
      return;
    }
  } else { f.x = nx; f.y = ny; }
  if (nh > PAD_H + 3) f.lifted = true;
  f.t += dt;
  f.alt = nh;
  if (nh > f.maxAlt) f.maxAlt = nh;

  // the engine turns itself off once you are going all the way around (keeps the rest of the fuel)
  if (burning && !f.retro && !f.diy && nh > ATM_TOP * 0.6) {
    const o = orbitInfo(f);
    if (!o.escape && o.peri > ATM_TOP + 2000) { f.engineOn = false; f.cut = true; f.events.push('orbitCut'); }
  }
  // going for orbit: once the top of the path reaches space, the engine rests until the kid taps Burn at the top
  if (burning && f.coastAssist && !f.coastUsed && !f.retro && nh < ATM_TOP && Math.abs(lean) > 0.25) {
    const o = orbitInfo(f);
    if (o.escape || o.apo > ATM_TOP + 25000) { f.engineOn = false; f.coasting = true; f.coastUsed = true; f.events.push('coast'); }
  }
  // the come-home burn stops once the low point of the path is deep in the air
  if (burning && f.retro) {
    const o = orbitInfo(f);
    if (o.escape || o.peri < 30000) { f.engineOn = false; f.retro = false; f.events.push('retroDone'); }
  }
}
function inOrbitNow(f) { const o = orbitInfo(f); return !o.escape && o.peri > ATM_TOP; }

// drop the empty bottom stage; the base of the rocket moves up by that stage's height
export function dropStage(f, height) {
  if (!hasMoreStages(f)) return false;
  f.x += Math.sin(f.heading) * height; f.y += Math.cos(f.heading) * height;
  f.si++; f.needDrop = false; f.finsOn = false;
  f.engineOn = true; f.ign = 0;
  return true;
}
// let go of the last tank and engine; only the capsule (with its heat shield) comes home
export function separateCapsule(f, height) {
  if (f.capsuleOnly) return false;
  f.x += Math.sin(f.heading) * height; f.y += Math.cos(f.heading) * height;
  f.capsuleOnly = true; f.engineOn = false; f.finsOn = false; f.needDrop = false;
  return true;
}
// time to burn again at the top of the path
export function resumeBurn(f) {
  const s = stage(f);
  if (!s || s.fuel <= 0) return false;
  f.coasting = false; f.engineOn = true; f.ign = 0;
  return true;
}
export function startComeHome(f) {
  const s = stage(f);
  if (!s || s.fuel <= 0) return false;
  f.retro = true; f.engineOn = true; f.ign = 0;
  return true;
}
