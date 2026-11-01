// Heartbeat Rocket - physics (no drawing, no DOM). Shared by the game and by the tuning script.
// One flat plane: inverse-square gravity, thrust with fuel mass, drag that thins with height, stages,
// reentry heating. Our own small planet: radius 640 km, surface gravity 9.81 (the same pull as on Earth),
// air up to 80 km, so going all the way around takes about 2.3 km/s.
// Built by Claude (Opus 5.5) for Heartbeat Observatory. CC0.

export const R = 640000, G0 = 9.81, GM = G0 * R * R;
export const ATM_TOP = 80000, H_SCALE = 6400, RHO0 = 1.225;   // the air thins by e every 6.4 km
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
  heavy:   { name: 'Heavy', fuel: 31000, dry: 2600, h: 17 },
};
export const ENGINES = {
  small:   { name: 'Small', thrust: 56000,  ispSL: 236, ispVac: 280, m: 450,  bellR: 0.72, bellH: 1.35 },
  big:     { name: 'Big',   thrust: 150000, ispSL: 272, ispVac: 322, m: 1300, bellR: 1.12, bellH: 2.15 },
  // the booster under a 2-stage rocket: three bells side by side
  booster: { name: 'Booster', thrust: 300000, ispSL: 268, ispVac: 304, m: 1900, bellR: 0.6, bellH: 1.5, cluster: 3 },
  // the giant third stage at the very bottom: five bells
  heavy:   { name: 'Heavy', thrust: 900000, ispSL: 274, ispVac: 312, m: 3800, bellR: 0.55, bellH: 1.6, cluster: 5 },
};
export const FINS_M = 120, FINS_CDA = 0.15;
export const SHIELD_M = 150;

export const LEGS_M = 140;
// what can ride on top instead of the capsule (inside a pointed fairing)
export const PAYLOADS = {
  weather:   { name: 'Weather sat', m: 650 },
  relay:     { name: 'Relay sat',   m: 560 },
  telescope: { name: 'Telescope',   m: 900 },
  module:    { name: 'Station part', m: 1400 },
};
export const FAIRING_CDA = 0.95;
// the capsule's own small come-home rockets (real capsules carried a pack like this): enough push to slow down out
// of orbit even when the big tank is empty, so going all the way around is never a dead end. Their fuel is part
// of the capsule's weight, so it changes nothing else.
export const PACK_FUEL = 80, PACK_THRUST = 5000, PACK_ISP = 230;

// ---- the Moon, our own small one with real rules: radius 220 km, surface gravity 1.63 (a sixth of the
// planet's, like our real Moon), 12,600 km from the planet's centre, going around once every ~39 hours, clockwise (the same way a
// rocket that leans right goes around). It always shows the planet the same face (tidally locked).
// Patched conics: inside the Moon's sphere of influence only the Moon's pull bends the path (relative to the
// Moon); outside it only the planet's does.
export const MOON_R = 220000, MOON_G = 1.63, MOON_GM = MOON_G * MOON_R * MOON_R, MOON_A = 12600000;
export const MOON_N = Math.sqrt(GM / (MOON_A * MOON_A * MOON_A));
export const MOON_DIR = -1;
export const MOON_SOI = MOON_A * Math.pow(MOON_GM / GM, 0.4);
export const MOON_TH0 = 2.6;
export const MOON_SPIN = MOON_DIR * MOON_N;
export const MOON_SAFE = 7, MOON_TIP = 14, MOON_TILT = 30 * Math.PI / 180;
export function moonAngle(T) { return MOON_TH0 + MOON_DIR * MOON_N * T; }
export function moonPos(T) { const a = moonAngle(T); return [MOON_A * Math.cos(a), MOON_A * Math.sin(a)]; }
export function moonVel(T) { const a = moonAngle(T), w = MOON_DIR * MOON_N * MOON_A; return [-w * Math.sin(a), w * Math.cos(a)]; }
export function inMoonSOI(x, y, T) { const m = moonPos(T); return Math.hypot(x - m[0], y - m[1]) < MOON_SOI; }
// acceleration from gravity at (x, y) at world time T
export function gravAt(x, y, T, inMoon) {
  if (!inMoon) { const r2 = x * x + y * y, r = Math.sqrt(r2), k = -GM / (r2 * r); return [k * x, k * y]; }
  const a = moonAngle(T), mx = MOON_A * Math.cos(a), my = MOON_A * Math.sin(a);
  const dx = x - mx, dy = y - my, d2 = dx * dx + dy * dy, d = Math.sqrt(d2), k = -MOON_GM / (d2 * d), n2 = MOON_N * MOON_N;
  return [k * dx - n2 * mx, k * dy - n2 * my];   // + the Moon's own fall around the planet, so relative motion is a clean conic
}
// position and velocity relative to the body whose pull you are in
export function bodyRel(f) {
  const T = f.T0 + f.t;
  if (!f.inMoon) return { rx: f.x, ry: f.y, vx: f.vx, vy: f.vy, gm: GM, rad: R, cx: 0, cy: 0, cvx: 0, cvy: 0, moon: false };
  const m = moonPos(T), v = moonVel(T);
  return { rx: f.x - m[0], ry: f.y - m[1], vx: f.vx - v[0], vy: f.vy - v[1], gm: MOON_GM, rad: MOON_R, cx: m[0], cy: m[1], cvx: v[0], cvy: v[1], moon: true };
}
export function orbitOf(rx, ry, vx, vy, gm, rad) {
  const r = Math.hypot(rx, ry), v2 = vx * vx + vy * vy;
  const E = 0.5 * v2 - gm / r, hm = rx * vy - ry * vx;
  const e = Math.sqrt(Math.max(0, 1 + 2 * E * hm * hm / (gm * gm)));
  if (E >= 0) { const p = hm * hm / gm; return { escape: true, peri: p / (1 + e) - rad, apo: Infinity, e, h: hm }; }
  const a = -gm / (2 * E);
  return { escape: false, peri: a * (1 - e) - rad, apo: a * (1 + e) - rad, a, e, h: hm };
}
export function bodyOrbit(f) { const b = bodyRel(f); return orbitOf(b.rx, b.ry, b.vx, b.vy, b.gm, b.rad); }

// reentry heating, only while coming down: grows with speed above HEAT_V once the air is thick enough to
// matter. A fall from a plain trip to space is too slow to burn; coming home from going around is not.
export const HEAT_V = 1300, HEAT_SAFE = 0.3, HEAT_CAP = 6.0;

export function wrapA(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

// cfg: { nose, tank, engine, fins:bool, shield:bool, stages:1|2|3, legs:bool, payload:null|kind, T0:world time }
export function newFlight(cfg) {
  const P = cfg.payload ? PAYLOADS[cfg.payload] : null;
  const N = P ? { m: P.m, cda: FAIRING_CDA } : NOSES[cfg.nose];
  const stack = [];
  if (cfg.stages === 3) stack.push(makeStage('heavy', 'heavy', true));
  if (cfg.stages >= 2) stack.push(makeStage('booster', 'booster', true));
  stack.push(makeStage(cfg.tank, cfg.engine, false));
  if (cfg.fins) stack[0].dry += FINS_M;
  if (cfg.legs) stack[stack.length - 1].dry += LEGS_M;
  return {
    x: 0, y: R + PAD_H, vx: 0, vy: 0, heading: 0,
    stages: stack, si: 0, payload: N.m + (cfg.shield && !P ? SHIELD_M : 0),
    payloadKind: P ? cfg.payload : null, payloadM: P ? P.m : 0, legs: !!cfg.legs, noCapsule: !!P,
    T0: cfg.T0 || 0, inMoon: false, onMoon: null, moonVisited: false, moonLanded: false, balt: PAD_H,
    throttle: 1, steer: null, ap: null,
    noseCda: N.cda, fins: !!cfg.fins, finsOn: !!cfg.fins, shield: !!cfg.shield,
    engineOn: true, ign: 0, lifted: false, t: 0, maxAlt: 0, chute: 0, chuteOn: false,
    outcome: null, leanLow: 0, wob: 0, alt: PAD_H, air: 1, q: 0, thr: 0,
    heat: 0, plasma: 0, peakFlux: 0, capsuleOnly: false, retro: false, needDrop: false,
    pack: P ? 0 : PACK_FUEL, packOn: false, packWait: false, packSawUp: false,
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
  let m = Math.max(1, f.payload);
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

// one fixed physics step. lean: slider -1..1 (0 = straight up from whatever you stand on). Pushes event names
// into f.events. Optional: f.steer (a heading the helper wants), f.throttle (0..1, only the helper uses it).
export function stepPhysics(f, dt, lean) {
  const T = f.T0 + f.t;
  if (f.onMoon) { if (holdOnMoon(f, dt, T)) return; }
  const r = Math.hypot(f.x, f.y), h = r - R, ux = f.x / r, uy = f.y / r;
  const B = bodyRel(f);
  const rb = Math.hypot(B.rx, B.ry);
  const phi = Math.atan2(B.rx, B.ry);              // "straight up" from the body you are near
  const rho = h < ATM_TOP ? RHO0 * Math.exp(-h / H_SCALE) : 0, air = rho / RHO0;
  const v2 = f.vx * f.vx + f.vy * f.vy, v = Math.sqrt(v2), q = 0.5 * rho * v2;
  const m = mass(f);
  const st = stage(f);
  f.air = air; f.q = q;

  // without fins, the rocket wobbles when the air pushes hard on it
  const wAmp = (f.finsOn ? 0.12 : 1) * Math.min(9, q / 2500) * DEG;
  f.wob = wAmp * (0.7 * Math.sin(f.t * 2.3) + 0.3 * Math.sin(f.t * 5.3 + 1));

  const retroA = Math.atan2(-B.vx, -B.vy);
  let target = null, rate = 0;
  const thrOk = f.throttle > 0;
  const wantsBurn = f.engineOn && (f.packOn ? f.pack > 0 : !!(st && st.fuel > 0));
  if (f.steer !== null && f.steer !== undefined) { target = f.steer; rate = 45 * DEG; }
  else if (f.retro && wantsBurn) { target = retroA; rate = 40 * DEG; }
  else if (wantsBurn) { target = f.lifted ? phi + lean * MAX_LEAN + f.wob : phi; rate = 30 * DEG; }
  else if (f.chuteOn && v > 0.5) { target = retroA; rate = 120 * DEG * f.chute; }
  else if (f.capsuleOnly && v > 5) { target = retroA; rate = 25 * DEG; }   // heat shield first
  else if (f.diy && f.lifted && q < 30) { target = phi + lean * MAX_LEAN; rate = 30 * DEG; }   // do it yourself: point it before you burn
  else if (q > 30 && v > 5) { target = Math.atan2(f.vx, f.vy); rate = Math.min(50, q / 250) * DEG; }
  if (target !== null) { const dA = wrapA(target - f.heading), mx = rate * dt; f.heading += Math.max(-mx, Math.min(mx, dA)); }
  const aligned = !f.retro || Math.abs(wrapA(retroA - f.heading)) < 6 * DEG;
  const burning = wantsBurn && aligned && thrOk;

  const gr = gravAt(f.x, f.y, T, f.inMoon);
  let ax = gr[0], ay = gr[1];
  f.thr = 0;
  if (burning) {
    f.ign = Math.min(1, f.ign + dt / 0.8);
    const k = f.ign * Math.min(1, f.throttle);
    if (f.packOn) {   // the capsule's come-home rockets
      const thrust = PACK_THRUST * k, used = Math.min(f.pack, PACK_THRUST / (PACK_ISP * G0) * k * dt);
      f.thr = thrust;
      ax += thrust / m * Math.sin(f.heading); ay += thrust / m * Math.cos(f.heading);
      f.pack -= used; f.payload -= used;
      if (f.pack <= 1e-6) {
        f.pack = 0; f.engineOn = false; f.packOn = false;
        if (f.retro) { f.retro = false; f.events.push(inOrbitNow(f) ? 'retroNoFuel' : 'retroDone'); }
      }
    } else {
    const isp = st.eng.ispSL * air + st.eng.ispVac * (1 - air);
    const thrust = st.mdot * isp * G0 * k;
    f.thr = thrust;
    ax += thrust / m * Math.sin(f.heading); ay += thrust / m * Math.cos(f.heading);
    st.fuel -= st.mdot * k * dt;
    if (f.lifted && h < 8000) f.leanLow = Math.max(f.leanLow, Math.abs(lean));
    if (st.fuel <= 0) {
      st.fuel = 0; f.engineOn = false;
      if (f.retro) { f.retro = false; f.events.push(inOrbitNow(f) ? 'retroNoFuel' : 'retroDone'); }
      else if (hasMoreStages(f)) { f.needDrop = true; f.events.push('stageEmpty'); }
      else f.events.push('burnout');
    }
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
  if (f.inMoon) {
    // touching the Moon
    const T2 = T + dt, mp = moonPos(T2), rx = nx - mp[0], ry = ny - mp[1], d = Math.hypot(rx, ry);
    if (d - MOON_R <= 0) { touchMoon(f, rx, ry, d, T2, burning); f.t += dt; return; }
    f.x = nx; f.y = ny;
  } else {
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
  }
  if (nh > PAD_H + 3) f.lifted = true;
  f.t += dt;
  f.alt = nh;
  if (nh > f.maxAlt) f.maxAlt = nh;
  afterMove(f);

  // the engine turns itself off once you are going all the way around (keeps the rest of the fuel)
  if (burning && !f.retro && !f.diy && !f.ap && !f.inMoon && nh > ATM_TOP * 0.6 && nh < ATM_TOP * 3) {
    const o = orbitInfo(f);
    if (!o.escape && o.peri > ATM_TOP + 2000) { f.engineOn = false; f.cut = true; f.events.push('orbitCut'); }
  }
  // going for orbit: once the top of the path reaches space, the engine rests until the kid taps Burn at the top
  if (burning && f.coastAssist && !f.coastUsed && !f.retro && !f.ap && nh < ATM_TOP && Math.abs(lean) > 0.25) {
    const o = orbitInfo(f);
    if (o.escape || o.apo > ATM_TOP + 25000) { f.engineOn = false; f.coasting = true; f.coastUsed = true; f.events.push('coast'); }
  }
  // the come-home burn stops once the low point of the path is deep in the air
  if (burning && f.retro) {
    const o = orbitInfo(f);
    if (o.escape || o.peri < 30000) { f.engineOn = false; f.retro = false; f.packOn = false; f.events.push('retroDone'); }
  }
}
// after every move: which body's pull are we in, and how high above it
function afterMove(f) {
  const T = f.T0 + f.t;
  const nowIn = inMoonSOI(f.x, f.y, T);
  if (nowIn !== f.inMoon) { f.inMoon = nowIn; f.events.push(nowIn ? 'soiIn' : 'soiOut'); if (nowIn) f.moonVisited = true; }
  if (f.inMoon) { const m = moonPos(T); f.balt = Math.hypot(f.x - m[0], f.y - m[1]) - MOON_R; }
  else f.balt = f.alt;
  // waiting to fire the capsule's come-home rockets at the top of the path
  if (f.packWait) {
    const vr = f.x * f.vx + f.y * f.vy;
    if (vr > 0) f.packSawUp = true;
    else if (f.packSawUp || f.inMoon) firePack(f);
  }
}
function surfaceVel(rx, ry, T) { const mv = moonVel(T); return [mv[0] - MOON_SPIN * ry, mv[1] + MOON_SPIN * rx]; }
function touchMoon(f, rx, ry, d, T, burning) {
  const sv = surfaceVel(rx, ry, T);
  const sp = Math.hypot(f.vx - sv[0], f.vy - sv[1]);
  const up = Math.atan2(rx, ry), tilt = Math.abs(wrapA(f.heading - up));
  const mp = moonPos(T), ux = rx / d, uy = ry / d;
  f.x = mp[0] + ux * MOON_R; f.y = mp[1] + uy * MOON_R;
  f.vx = sv[0]; f.vy = sv[1]; f.hit = sp; f.engineWasOnAtHit = burning; f.balt = 0;
  if (f.outcome) return;
  if (f.legs && sp < MOON_SAFE && tilt < MOON_TILT) {
    f.onMoon = { a: Math.atan2(ry, rx) - moonAngle(T) };
    f.engineOn = false; f.heading = up; f.moonLanded = true; f.landSpeed = sp;
    f.events.push('moonLanded');
  } else if (sp < MOON_TIP) {
    f.engineOn = false; f.outcome = 'tipped'; f.tiltAt = tilt; f.events.push('tipped');
  } else { f.engineOn = false; f.outcome = 'crash'; f.events.push('crash'); }
}
// standing on the Moon: ride along with its surface until the engine pushes harder than the Moon pulls
function holdOnMoon(f, dt, T) {
  const st = stage(f);
  const a = moonAngle(T) + f.onMoon.a, ux = Math.cos(a), uy = Math.sin(a);
  const mp = moonPos(T);
  const up = Math.atan2(ux, uy);
  if (f.engineOn && st && st.fuel > 0 && f.throttle > 0) {
    const thrust = st.mdot * st.eng.ispVac * G0 * Math.min(1, f.throttle);
    if (thrust / mass(f) > MOON_G * 1.02) { f.onMoon = null; f.events.push('moonLiftoff'); f.x = mp[0] + ux * (MOON_R + 0.3); f.y = mp[1] + uy * (MOON_R + 0.3); return false; }
  }
  f.heading = up;
  f.x = mp[0] + ux * MOON_R; f.y = mp[1] + uy * MOON_R;
  const sv = surfaceVel(ux * MOON_R, uy * MOON_R, T); f.vx = sv[0]; f.vy = sv[1];
  f.thr = 0; f.t += dt; f.alt = Math.hypot(f.x, f.y) - R; f.balt = 0; f.air = 0; f.q = 0; f.plasma = 0;
  return true;
}

// Coasting with the engine off in empty space: one bigger step (RK4), same gravity as stepPhysics. Used when
// time runs fast (trips to the Moon take hours). The caller keeps steps small near the ground and the air.
export function coastStep(f, h) {
  const T = f.T0 + f.t, inM = f.inMoon;
  const acc = (x, y, t) => gravAt(x, y, t, inM);
  const x0 = f.x, y0 = f.y, vx0 = f.vx, vy0 = f.vy;
  const a1 = acc(x0, y0, T);
  const a2 = acc(x0 + vx0 * h / 2, y0 + vy0 * h / 2, T + h / 2);
  const v2x = vx0 + a1[0] * h / 2, v2y = vy0 + a1[1] * h / 2;
  const a3 = acc(x0 + v2x * h / 2, y0 + v2y * h / 2, T + h / 2);
  const v3x = vx0 + a2[0] * h / 2, v3y = vy0 + a2[1] * h / 2;
  const a4 = acc(x0 + v3x * h, y0 + v3y * h, T + h);
  const v4x = vx0 + a3[0] * h, v4y = vy0 + a3[1] * h;
  f.x = x0 + h / 6 * (vx0 + 2 * v2x + 2 * v3x + v4x);
  f.y = y0 + h / 6 * (vy0 + 2 * v2y + 2 * v3y + v4y);
  f.vx = vx0 + h / 6 * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]);
  f.vy = vy0 + h / 6 * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]);
  f.t += h; f.alt = Math.hypot(f.x, f.y) - R; if (f.alt > f.maxAlt) f.maxAlt = f.alt;
  f.thr = 0; f.air = 0; f.q = 0; f.plasma = 0; f.heat = Math.max(0, f.heat - 0.02 * h);
  if (f.ign > 0) f.ign = 0;
  afterMove(f);
  if (f.inMoon && f.balt < 0) { const m = moonPos(f.T0 + f.t); const rx = f.x - m[0], ry = f.y - m[1]; touchMoon(f, rx, ry, Math.hypot(rx, ry), f.T0 + f.t, false); }
}
// The biggest safe coast step from here (seconds), or 0 if we should use small steps.
export function coastLimit(f) {
  if (!f.lifted || f.onMoon || f.chuteOn || f.outcome) return 0;
  if (f.engineOn && ((stage(f) && stage(f).fuel > 0) || (f.packOn && f.pack > 0)) && f.throttle > 0) return 0;
  if (f.alt < ATM_TOP + 500) return 0;
  const B = bodyRel(f), rb = Math.hypot(B.rx, B.ry);
  const alt = rb - B.rad;
  if (alt < 2500) return 0;
  let h = 0.006 * Math.sqrt(rb * rb * rb / B.gm);
  const vr = (B.rx * B.vx + B.ry * B.vy) / rb;
  if (vr < 0) h = Math.min(h, (alt - 2000) / -vr * 0.5);
  if (!f.inMoon) {
    const vrp = vr;
    if (vrp < 0) h = Math.min(h, (f.alt - ATM_TOP) / -vrp * 0.5);
    // don't jump deep into the Moon's pull in one step
    const m = moonPos(f.T0 + f.t), dm = Math.hypot(f.x - m[0], f.y - m[1]) - MOON_SOI;
    h = Math.min(h, Math.max(5, dm / 3000));
  }
  return Math.max(0, Math.min(h, 120));
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
  if (f.capsuleOnly || f.noCapsule) return false;   // a satellite flight has no capsule to bring home
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
  if (s && s.fuel > 0) { f.retro = true; f.engineOn = true; f.ign = 0; f.packOn = false; return true; }
  if (!canUsePack(f)) return false;
  // a small push does the most at the top of the path: on a stretched orbit, wait for the top, then fire
  const o = orbitInfo(f);
  if (!o.escape && o.apo - o.peri > 60000) { f.packWait = true; f.packSawUp = false; f.events.push('packWait'); return true; }
  firePack(f);
  return true;
}
function firePack(f) { f.packWait = false; f.retro = true; f.engineOn = true; f.ign = 0; f.packOn = true; f.events.push('packFire'); }
// the tank is empty, but the capsule's come-home rockets can still slow it down (only near the planet, not the Moon)
export function canUsePack(f) { return !f.noCapsule && !f.payloadKind && f.pack > 0 && !f.packOn && !f.packWait && !f.inMoon && !f.onMoon && fuelLeft(f) <= 0; }
