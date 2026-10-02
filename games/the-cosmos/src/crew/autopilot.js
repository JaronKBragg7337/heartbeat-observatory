// ============================================================================
// autopilot.js — an NPC pilot's hands. Pure: it reads the ship's flight state and writes the same three numbers a person's
// stick would (fwd, lift, yaw, each -1..1). It has no more authority than a seated pilot: the flight computer
// still limits sink rate, thrust and turn rate, and every order is a plan the pilot flies, not a teleport.
//
// ORDERS (steps are run in sequence; each reports what the pilot says):
//   hold     hover where we are (or sit tight if landed)
//   land     set down here
//   goto     fly to a point over the ground, optionally land on it
//   hunt     climb out beyond Mars's neutral airspace, close on hostile drones, break off if the hull is going
//   roam     wander the country at low level with the navigator calling out what is below
//   supply   goto the depot apron, land, load, goto the pad, land
//
// SMALL DELAYS: the pilot works from what they saw `think` seconds ago, and steers a little short of perfect.
// ============================================================================

import { NEUTRAL_AIRSPACE_M, NEUTRAL_REENTRY_M } from '../ship/guns.js';
import { thinkDelay, throttleOf } from './crewSpec.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

/** Mulberry32, so a roam is a reproducible wander in the validator and a different one every run in the game. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const HUNT_ALT_M = NEUTRAL_AIRSPACE_M + 250;       // metres above the ground to work the raiders from
export const CRUISE_AGL_M = 110;
export const CLEARANCE_M = 45;

export class Autopilot {
  /**
   * @param flight  ShipBody
   * @param o { ground:(dx,dy,dz)=>radius, drones:()=>DroneSystem|null, skill, home:{x,y,z} world point of the home pad,
   *            seed, hasNav:()=>bool }
   */
  constructor(flight, o) {
    this.f = flight; this.ground = o.ground; this.getDrones = o.drones || (() => null);
    this.skill = o.skill ?? 0.8; this.home = o.home; this.hasNav = o.hasNav || (() => false);
    this.rand = rng(o.seed ?? 12345);
    this.order = { type: 'hold' }; this.steps = []; this.step = { k: 'hold' };
    this.t = 0; this.say = [];
    this.out = { fwd: 0, lift: 0, yaw: 0 };
    this._think = 0; this._seen = null; this._lastCall = {};
  }

  /** Report something in the pilot's own words (the crew system turns these into ship-log lines). */
  speak(text, key) {
    if (key) { if (this.t - (this._lastCall[key] ?? -99) < 25) return; this._lastCall[key] = this.t; }
    this.say.push(text);
  }
  drain() { const s = this.say; this.say = []; return s; }

  setOrder(o) {
    this.order = o; this.steps = []; this.step = null; this._seen = null; this._think = 0;
    switch (o.type) {
      case 'hold': this.steps = [{ k: 'hold' }]; break;
      case 'land': this.steps = [{ k: 'land' }]; break;
      case 'goto': this.steps = [{ k: 'goto', target: o.target, land: !!o.land, agl: o.agl, name: o.name }]; break;
      case 'return': this.steps = [{ k: 'goto', target: this.home, land: true, name: 'the pad' }]; break;
      case 'hunt': this.steps = [{ k: 'hunt' }]; break;
      case 'roam': this.steps = [{ k: 'roam' }]; break;
      case 'follow': this.steps = [{ k: 'follow' }]; break;
      case 'supply':
        this.steps = [
          { k: 'goto', target: o.depot, land: true, name: 'the depot apron' },
          { k: 'wait', s: 18, say: 'Loading stores. Food, water, bolts.' },
          { k: 'goto', target: this.home, land: true, name: 'the pad' },
          { k: 'done', say: 'Supplies are aboard and stowed.' }];
        break;
      default: this.steps = [{ k: 'hold' }];
    }
    this._next();
  }

  _next() {
    this.step = this.steps.shift() || { k: 'hold' };
    this.step.t0 = this.t; this.step.phase = null;
    if (this.step.k === 'done') { this.speak(this.step.say); this.step = { k: 'hold', t0: this.t, phase: null }; }
  }

  get done() { return this.step.k === 'hold' && this.steps.length === 0; }

  // ---- geometry ------------------------------------------------------------------------------------
  _r(p) { return Math.hypot(p.x, p.y, p.z); }
  _groundAt(p) { const r = this._r(p) || 1; const g = this.ground(p.x / r, p.y / r, p.z / r); return g == null ? r - 1e4 : g; }
  /** Bearing error to a world point, radians, + = target is to the right; and horizontal distance. */
  _toward(p) {
    const f = this.f, d = { x: p.x - f.pos.x, y: p.y - f.pos.y, z: p.z - f.pos.z };
    const vu = dot(d, f.up);
    const h = { x: d.x - f.up.x * vu, y: d.y - f.up.y * vu, z: d.z - f.up.z * vu };
    return { err: Math.atan2(dot(h, f.rightH), dot(h, f.fwdH)), dist: Math.hypot(h.x, h.y, h.z), up: vu };
  }
  /** The terrain-following altitude: radius to hold so that ground within `lookM` ahead is cleared by CLEARANCE_M. */
  _followRadius(agl, lookM = 500) {
    const f = this.f, here = this._groundAt(f.pos);
    let need = here + agl;
    for (const d of [60, 140, 260, lookM]) {
      const p = { x: f.pos.x + f.fwdH.x * d, y: f.pos.y + f.fwdH.y * d, z: f.pos.z + f.fwdH.z * d };
      need = Math.max(need, this._groundAt(p) + CLEARANCE_M);
    }
    return need;
  }
  _liftTo(R) { return clamp((R - this._r(this.f.pos)) / 18, -1, 1); }
  _unit(p) { const l = Math.hypot(p.x, p.y, p.z) || 1; return { x: p.x / l, y: p.y / l, z: p.z / l }; }

  // ---- the stick -----------------------------------------------------------------------------------
  /** Advance one frame. Returns the controls to write (the same object every time). */
  update(dt) {
    this.t += dt;
    const c = this.out, thr = throttleOf(this.skill);
    c.fwd = 0; c.lift = 0; c.yaw = 0;
    this._think -= dt;
    const st = this.step || { k: 'hold' };
    switch (st.k) {
      case 'hold': break;
      case 'land': this._land(c); break;
      case 'goto': this._goto(c, st, thr); break;
      case 'wait':
        if (this.t - st.t0 >= st.s) this._next();
        else if (st.say && !st.said) { st.said = true; this.speak(st.say); }
        break;
      case 'hunt': this._hunt(c, st, thr); break;
      case 'roam': this._roam(c, st, thr); break;
      case 'follow': this._follow(c); break;
      default: break;
    }
    return c;
  }

  /**
   * A formation slot on another ship's flight: 75 m behind its nose (−fwdH) and 28 m to starboard (+rightH).
   * rightH is forward × up, the ship's own right. `speed` is that ship's horizontal speed, which the stick matches.
   */
  followSlot(tf) {
    const behind = 75, side = 28;
    return {
      pos: {
        x: tf.pos.x - tf.fwdH.x * behind + tf.rightH.x * side,
        y: tf.pos.y - tf.fwdH.y * behind + tf.rightH.y * side,
        z: tf.pos.z - tf.fwdH.z * behind + tf.rightH.z * side,
      },
      speed: tf.groundSpeed || 0,
    };
  }

  /** Close until the slot is near, brake if we overshoot, otherwise match the target's speed. The caller sets `_slot` each frame. */
  _follow(c) {
    const slot = this._slot;
    if (!slot) return;
    const tw = this._toward(slot.pos), dist = tw.dist;
    const sp = this.f.groundSpeed;
    const align = clamp(1 - Math.abs(tw.err) / 0.9, 0, 1);
    c.yaw = clamp(tw.err * 1.6, -1, 1);
    if (dist > 40) c.fwd = clamp(0.4 + dist / 180, 0.4, 1) * Math.max(align, 0.35);
    else if (dist < 18) c.fwd = sp > 1.5 ? -clamp(sp / 16, 0.15, 0.85) : 0;
    else c.fwd = clamp((slot.speed - sp) / 14, -0.55, 0.75);
    c.lift = this._liftTo(this._r(slot.pos));
  }

  _land(c) {
    const f = this.f;
    if (f.landed) { this.speak('Down and holding.'); this._next(); return; }
    c.lift = -1;     // the flight computer limits the sink rate from the stopping distance: it cannot be a crash
  }

  _goto(c, st, thr) {
    const f = this.f, tg = st.target;
    if (!st.phase) st.phase = f.landed ? 'lift' : 'cruise';
    const tw = this._toward(tg), cruiseAgl = st.agl ?? CRUISE_AGL_M;
    if (st.phase === 'lift') {
      c.lift = 1;
      if (f.agl > 40) st.phase = 'cruise';
      return;
    }
    const r = this._r(f.pos);
    const dist = tw.dist;
    const approach = st.land ? 70 : 14;
    if (dist < approach || st.phase === 'final') {
      st.phase = 'final';
      const sp = f.groundSpeed, align = clamp(1 - Math.abs(tw.err) / 0.7, 0, 1);
      const over = st.land ? dist < 7 : dist < 14;
      if (!over) {
        // creep onto the spot: slower as it nears, level (a landing is made from directly above)
        c.yaw = clamp(tw.err * 1.4, -0.8, 0.8);
        c.fwd = clamp(dist / 70, 0.07, 0.4) * align * (sp > 14 ? 0.3 : 1) - (sp > 16 && dist < 40 ? 0.3 : 0);
        c.lift = this._liftTo(Math.max(this._r(f.pos), this._followRadius(30, 120)));
        return;
      }
      c.fwd = sp > 1.2 ? -clamp(sp / 14, 0, 1) * 0.5 : 0;
      if (st.land) {
        c.lift = f.landed ? 0 : (sp > 4 ? 0 : -1);
        if (f.landed) { this.speak(st.name ? `Down at ${st.name}.` : 'Down.'); this._next(); }
      } else {
        c.lift = this._liftTo(this._groundAt(tg) + cruiseAgl);
        if (sp < 1.5) { this.speak(st.name ? `On station over ${st.name}.` : 'On station.'); this._next(); }
      }
      return;
    }
    // cruise: turn first, then go; slow for the turn and for the last 150 m
    const align = clamp(1 - Math.abs(tw.err) / 0.9, 0, 1);
    c.yaw = clamp(tw.err * 1.4, -1, 1) * Math.min(1, 0.5 + thr);
    const R = this._followRadius(cruiseAgl);
    c.lift = this._liftTo(R);
    const high = r - this._groundAt(f.pos) > 30;
    c.fwd = high ? thr * align * clamp(dist / 160, 0.12, 1) * (c.lift > 0.5 ? 0.45 : 1) : 0;
    if (R - r > 60) c.fwd *= 0.3;           // a hill bigger than the lift can climb: slow down so the ship does not fly into it
  }

  // ---- hunt: out beyond Mars's neutral airspace ---------------------------------------------------------
  _hunt(c, st, thr) {
    const f = this.f, D = this.getDrones();
    const ground = this._groundAt(f.pos), r = this._r(f.pos), agl = r - ground;
    if (!st.phase) {
      st.phase = 'climb';
      this.speak(`Mars airspace is neutral: nothing here to shoot. Climbing to ${Math.round(HUNT_ALT_M)} metres to find the raiders.`);
    }
    // hull in trouble: break off and come back under the neutral line
    if (st.phase !== 'break' && f.hull < 35) { st.phase = 'break'; this.speak(`Hull's at ${Math.round(f.hull)} percent. Breaking off, going down to neutral airspace.`); }
    if (st.phase === 'break') {
      c.lift = -0.8;
      if (D && D.neutral && agl < NEUTRAL_REENTRY_M - 150) { this.speak('We are under the neutral line. Holding here. Say the word and we go home.'); this._next(); }
      else if (agl < 30 || f.landed) this._next();
      return;
    }
    const minR = ground + HUNT_ALT_M;
    if (st.phase === 'climb') {
      c.lift = 1;
      if (r >= minR - 40) {
        c.lift = this._liftTo(minR + 60);
        if (D && !D.neutral) { st.phase = 'engage'; this.speak('We are beyond the neutral line. Watching for contacts.'); }
      }
      return;
    }
    // engage: act on what was seen `think` seconds ago
    if (this._think <= 0 || !this._seen) {
      this._think = thinkDelay(this.skill);
      let best = null, bd = 1e12;
      if (D && !D.neutral) for (const d of D.drones) {
        if (d.state === 'away' || d.state === 'dead' || d.target.hp <= 0) continue;
        const dd = Math.hypot(d.pos.x - f.pos.x, d.pos.y - f.pos.y, d.pos.z - f.pos.z);
        if (dd < bd) { bd = dd; best = d; }
      }
      this._seen = best ? { pos: { ...best.pos }, vel: { ...best.vel }, dist: bd, id: best.id } : null;
    }
    if (D && D.neutral) { c.lift = 1; return; }          // drifted under the line: climb back out
    const s = this._seen;
    if (!s) {
      c.lift = this._liftTo(minR + 60); c.yaw = 0.12;     // a slow turn, looking
      this.speak('No contacts on the scope. Waiting.', 'wait');
      return;
    }
    // lead the target a little and close to where the main guns bear, at about 300 m
    const k = s.dist / 260 + this._think * 0.2;
    const lead = { x: s.pos.x + s.vel.x * k, y: s.pos.y + s.vel.y * k, z: s.pos.z + s.vel.z * k };
    const tw = this._toward(lead);
    c.yaw = clamp(tw.err * 1.6, -1, 1) * Math.min(1, 0.55 + thr * 0.5);
    const align = clamp(1 - Math.abs(tw.err) / 1.1, 0, 1);
    c.fwd = clamp((s.dist - 300) / 220, -0.35, 0.85) * thr * (s.dist > 300 ? align : 1);
    c.lift = this._liftTo(clamp(this._r(lead), minR, minR + 400));   // match the raider's height, never below the hostile floor
    this.speak(`Contact at ${Math.round(s.dist)} metres. Engaging.`, 'contact');
  }

  // ---- roam ---------------------------------------------------------------------------------------------------
  _roam(c, st, thr) {
    const f = this.f;
    if (!st.phase) { st.phase = 'go'; st.legs = 0; st.wp = null; this.speak('Roaming. I will keep low and look around.'); }
    if (!st.wp || this._toward(st.wp).dist < 60) {
      // a fresh waypoint 1.5-5 km from home, on a bearing of its own
      const up = this._unit(f.pos), ref = Math.abs(up.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
      let ex = up.y * ref.z - up.z * ref.y, ey = up.z * ref.x - up.x * ref.z, ez = up.x * ref.y - up.y * ref.x;
      const el = Math.hypot(ex, ey, ez); ex /= el; ey /= el; ez /= el;
      const nx = up.y * ez - up.z * ey, ny = up.z * ex - up.x * ez, nz = up.x * ey - up.y * ex;
      const br = this.rand() * Math.PI * 2, d = 1500 + this.rand() * 3500, h = this.home;
      const p = { x: h.x + (ex * Math.cos(br) + nx * Math.sin(br)) * d, y: h.y + (ey * Math.cos(br) + ny * Math.sin(br)) * d, z: h.z + (ez * Math.cos(br) + nz * Math.sin(br)) * d };
      const g = this._groundAt(p), pr = this._r(p);
      st.wp = { x: p.x / pr * g, y: p.y / pr * g, z: p.z / pr * g };
      st.legs++;
      if (st.legs > 1) this.speak('New heading. Let us see what is over there.');
    }
    const tw = this._toward(st.wp);
    if (f.landed) { c.lift = 1; return; }
    const R = this._followRadius(80 + (st.legs % 3) * 40, 700);
    c.lift = this._liftTo(R);
    c.yaw = clamp(tw.err * 1.3, -1, 1) * 0.8;
    const high = this._r(f.pos) - this._groundAt(f.pos) > 25;
    c.fwd = high ? thr * 0.7 * clamp(1 - Math.abs(tw.err) / 1.0, 0, 1) * (R - this._r(f.pos) > 50 ? 0.3 : 1) : 0;
    this._callOuts(st);
  }

  /** The navigator's eyes: what the ground ahead is doing. Called only while roaming. */
  _callOuts(st) {
    if (this.t - (st.lastLook ?? -9) < 4) return;
    st.lastLook = this.t;
    const f = this.f, here = this._groundAt(f.pos);
    const at = (d, side) => this._groundAt({ x: f.pos.x + f.fwdH.x * d + f.rightH.x * side, y: f.pos.y + f.fwdH.y * d + f.rightH.y * side, z: f.pos.z + f.fwdH.z * d + f.rightH.z * side });
    const ahead = at(400, 0), left = at(250, -300), right = at(250, 300);
    const who = this.hasNav() ? 'Nav' : 'Pilot';
    if (ahead - here > 80) this.speak(`${who}: a ridge ahead, about ${Math.round(ahead - here)} metres above us.`, 'ridge');
    else if (here - ahead > 90) this.speak(`${who}: ground falls away ahead, ${Math.round(here - ahead)} metres down. A basin or a canyon.`, 'drop');
    else if (here - Math.min(left, right) > 110) this.speak(`${who}: a deep cut to the ${left < right ? 'left' : 'right'}, ${Math.round(here - Math.min(left, right))} metres down.`, 'cut');
    else if (Math.max(left, right) - here > 110) this.speak(`${who}: high ground to the ${left > right ? 'left' : 'right'}.`, 'high');
  }
}
