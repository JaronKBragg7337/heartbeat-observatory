// ============================================================================
// digging.js — what a person with a tool does to the ground.
//
// OWNS: the tools, where a bite lands, what you are carrying, and where a load
//       is put down.
// DOES NOT OWN: the ground (field.js / edits.js) or the body (walker.js). It
//       asks the first where the surface is, tells the second what changed, and
//       reads the third for where the eyes are and which way they point.
//
// Pure of the scene graph so the validator can play a whole dig-and-dump shift
// in Node against the real field.
// ============================================================================

import { density, normalAt, raycast } from '../world/field.js';

const CARRY_EARTH_KGF = 40;
const EARTH_G = 9.80665;                 // CODATA standard gravity

/**
 * THE TOOLS. Sizes are real things a person or a machine carries.
 *   Hand spade   r 0.09 m  ->   3 L   (about 4.6 kg of regolith)   detail, corners, steps
 *   Shovel       r 0.17 m  ->  21 L   (about 31 kg)                the everyday bite
 *   Bucket       r 0.70 m  -> 1.44 m3 (about 2-4 t)                 an excavator's bite: 1.4 m across, a hole
 *                                                                  you can stand and turn in, a tunnel you can walk
 * What you can carry is a WEIGHT limit, so it belongs to the body you are standing on: 40 kg is
 * a heavy ordinary load on Earth, the same pull on Mars is 105 kg of rock. The bucket belongs to
 * a machine and has a machine's bed.
 */
export function makeTools(body) {
  const hands = CARRY_EARTH_KGF * EARTH_G / body.surfaceGravity;
  return [
    { id: 'spade',  name: 'Hand spade', radius: 0.09, reachM: 3.2, capacityKg: hands },
    { id: 'shovel', name: 'Shovel',     radius: 0.17, reachM: 3.6, capacityKg: hands },
    { id: 'bucket', name: 'Excavator bucket', radius: 0.70, reachM: 6.5, capacityKg: 12000, machine: true },
  ];
}

const len3 = (v) => Math.hypot(v.x, v.y, v.z);
const unit = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };

export class Digger {
  constructor(body, edits, walker) {
    this.body = body; this.edits = edits; this.walker = walker;
    this.tools = makeTools(body);
    this.toolIdx = 1;
    this.carried = [];                   // lots in hand, each a real object
  }
  get tool() { return this.tools[this.toolIdx]; }
  setTool(i) { this.toolIdx = ((i % this.tools.length) + this.tools.length) % this.tools.length; return this.tool; }
  carriedMass() { return this.carried.reduce((a, l) => a + l.massKg, 0); }
  carriedVolume() { return this.carried.reduce((a, l) => a + l.solidVolumeM3, 0); }

  /** The look direction in world axes. */
  lookDir() {
    const w = this.walker, f = w.updateFrame();
    const cy = Math.cos(w.yaw), sy = Math.sin(w.yaw), cp = Math.cos(w.pitch), sp = Math.sin(w.pitch);
    return {
      x: f.north.x * cy * cp + f.east.x * sy * cp + f.up.x * sp,
      y: f.north.y * cy * cp + f.east.y * sy * cp + f.up.y * sp,
      z: f.north.z * cy * cp + f.east.z * sy * cp + f.up.z * sp,
    };
  }

  /**
   * Where you are looking, on the ground, within reach: the first place the look ray meets solid
   * field. Down, sideways or up: whatever is in front of you is what you can dig. (It used to be the
   * DRAWN heightfield, which stopped being the truth the moment the ground was dug.)
   * Returns { point, normal, dir, dist } or null.
   */
  digTarget(reach = this.tool.reachM) {
    const body = this.body, dir = this.lookDir(), e = this.walker.eyeWorldPos({});
    let prevT = 0;
    for (let t = 0.12; t <= reach + 1e-9; t += 0.05) {
      if (density(body, e.x + dir.x * t, e.y + dir.y * t, e.z + dir.z * t) < 0) {
        let lo = prevT, hi = t;
        for (let i = 0; i < 12; i++) {
          const m = (lo + hi) / 2;
          if (density(body, e.x + dir.x * m, e.y + dir.y * m, e.z + dir.z * m) < 0) hi = m; else lo = m;
        }
        const p = { x: e.x + dir.x * hi, y: e.y + dir.y * hi, z: e.z + dir.z * hi };
        return { point: p, normal: normalAt(body, p.x, p.y, p.z, 0.12), dir, dist: hi };
      }
      prevT = t;
    }
    return null;
  }

  /** Centre of the bite: a little way into the material, along the way you are looking. */
  biteCentre(hit, r) {
    const k = r * 0.5;
    return { x: hit.point.x + hit.dir.x * k, y: hit.point.y + hit.dir.y * k, z: hit.point.z + hit.dir.z * k };
  }

  dig() {
    const tl = this.tool;
    if (this.carriedMass() >= tl.capacityKg) return { ok: false, msg: tl.machine ? 'Bucket bed full' : 'Hands full' };
    const hit = this.digTarget();
    if (!hit) return { ok: false, msg: 'Nothing in reach' };
    const c = this.biteCentre(hit, tl.radius);
    const lot = this.edits.dig(c.x, c.y, c.z, tl.radius);
    if (!lot) return { ok: false, msg: this.edits.lastRefusal || 'Cannot cut this' };
    this.carried.push(lot);
    return { ok: true, msg: `+${lot.massKg.toFixed(1)} kg ${lot.materialName}`, lot, centre: c };
  }

  /** The ground point under p (looking down the local up axis), or null. */
  groundBelowPoint(p, up, from = 4, drop = 12) {
    const hits = raycast(this.body, p.x + up.x * from, p.y + up.y * from, p.z + up.z * from,
      -up.x, -up.y, -up.z, from + drop, { firstOnly: true, minStep: 0.05 });
    const h = hits.find((q) => q.kind === 'enter');
    return h ? h.point : null;
  }

  /**
   * Where a shovelful lands and what it lands on.
   *
   * NOT where you are aiming: you are aiming at the hole, and dropping there refills it (measured:
   * dig to 1.26 m, drop the load, the hole is 0.40 m: a third of the work kept). The spoil goes beside
   * the hole, on the side you stand, clear of the rim by the heap's own radius. The next load comes to
   * the SAME heap while it still clears the hole, so it grows outward as one mound; when it would
   * reach the rim, the next heap starts further round the hole instead. Nothing ever lands on the
   * hole, and nothing is stacked into a pillar: edits.deposit() pours it at the angle of repose onto
   * whatever is there.
   */
  dumpPlan(lot) {
    const w = this.walker, edits = this.edits;
    const wp = w.worldPos, up = unit(wp);
    const V = lot.solidVolumeM3;
    const tanT = Math.tan(edits.repose);
    const rNew = Math.cbrt((3 * V) / (Math.PI * tanT)) + 0.14 + 0.1;   // a poured heap, rounded tip included
    const growth = (pile) => pile.radiusM * Math.cbrt(1 + V / Math.max(pile.volumeM3, 1e-4));
    const site = edits.siteNear(wp.x, wp.y, wp.z, 9);
    const f = w.updateFrame();

    if (!site) {
      // Nothing dug close by: put it down where you are looking, or just ahead of you.
      const hit = this.digTarget(5.5);
      let gp = hit ? hit.point : null;
      if (!gp) {
        const fx = f.north.x * Math.cos(w.yaw) + f.east.x * Math.sin(w.yaw);
        const fy = f.north.y * Math.cos(w.yaw) + f.east.y * Math.sin(w.yaw);
        const fz = f.north.z * Math.cos(w.yaw) + f.east.z * Math.sin(w.yaw);
        gp = this.groundBelowPoint({ x: wp.x + fx * 1.8, y: wp.y + fy * 1.8, z: wp.z + fz * 1.8 }, up);
      }
      if (!gp) return null;
      const pile = edits.pileNear(gp.x, gp.y, gp.z, 0.5);
      if (pile) return { x: pile.x, y: pile.y, z: pile.z, up: pile.up, pile, r: growth(pile) };
      return { x: gp.x, y: gp.y, z: gp.z, up, pile: null, r: rNew };
    }

    // Horizontal direction from the hole toward the player.
    let hx = wp.x - site.x, hy = wp.y - site.y, hz = wp.z - site.z;
    const along = hx * up.x + hy * up.y + hz * up.z;
    hx -= up.x * along; hy -= up.y * along; hz -= up.z * along;
    let hl = Math.hypot(hx, hy, hz);
    if (hl < 0.05) { hx = f.north.x; hy = f.north.y; hz = f.north.z; hl = 1; }
    hx /= hl; hy /= hl; hz /= hl;
    const cross = { x: up.y * hz - up.z * hy, y: up.z * hx - up.x * hz, z: up.x * hy - up.y * hx };

    let first = null;
    for (let k = 0; k < 12; k++) {
      const ang = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.6;       // 0, +34, -34, +69 ... degrees
      const c = Math.cos(ang), s = Math.sin(ang);
      const d = { x: hx * c + cross.x * s, y: hy * c + cross.y * s, z: hz * c + cross.z * s };
      const dist = site.radiusM + 0.4 + rNew;
      const gp = this.groundBelowPoint({ x: site.x + d.x * dist, y: site.y + d.y * dist, z: site.z + d.z * dist }, up);
      if (!gp) continue;
      const pile = edits.pileNear(gp.x, gp.y, gp.z, 0.6);
      const centre = pile ? { x: pile.x, y: pile.y, z: pile.z } : gp;
      const r = pile ? growth(pile) : rNew;
      const plan = { x: centre.x, y: centre.y, z: centre.z, up, pile, r };
      if (!first) first = plan;
      // Clear of the hole by the heap's own radius? A heap poured on a slope runs further downhill than
      // up, so measure it toward the hole: wider if the hole is downhill of it.
      let ox = centre.x - site.x, oy = centre.y - site.y, oz = centre.z - site.z;
      const oa = ox * up.x + oy * up.y + oz * up.z;
      ox -= up.x * oa; oy -= up.y * oa; oz -= up.z * oa;
      const oh = Math.hypot(ox, oy, oz) || 1;
      const probe = this.groundBelowPoint({ x: centre.x - (ox / oh) * 1.2, y: centre.y - (oy / oh) * 1.2, z: centre.z - (oz / oh) * 1.2 }, up);
      let tanBeta = 0;
      if (probe) tanBeta = Math.max(-0.5, Math.min(0.6, (len3(centre) - len3(probe)) / 1.2));
      const spread = 1 / Math.max(0.3, 1 - tanBeta / tanT);
      if (oh - r * spread >= site.radiusM + 0.2) return plan;
    }
    return first;
  }

  dump() {
    if (!this.carried.length) return { ok: false, msg: 'Carrying nothing' };
    const lot = this.carried[this.carried.length - 1];
    const plan = this.dumpPlan(lot);
    if (!plan) return { ok: false, msg: 'No ground to put it on' };
    const res = this.edits.deposit(lot, plan.x, plan.y, plan.z, { up: plan.up, pile: plan.pile });
    if (!res) return { ok: false, msg: 'No ground to put it on' };
    this.carried.pop();
    const left = this.carried.length;
    return { ok: true, msg: `dropped ${lot.massKg.toFixed(1)} kg${left ? ` · ${left} left` : ''}`, pile: res.pile, plan };
  }
}
