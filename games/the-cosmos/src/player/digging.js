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

import { density, normalAt, raycast, surfaceRadiusFast } from '../world/field.js';

const CARRY_EARTH_KGF = 400;            // powered hauling cart, not an unassisted backpack
const EARTH_G = 9.80665;                 // CODATA standard gravity

/**
 * THE TOOLS. Sizes are real things a person or a machine carries.
 *   Hand spade   r 0.09 m  ->   3 L   (about 4.6 kg of regolith)   detail, corners, steps
 *   Shovel       r 0.17 m  ->  21 L   (about 31 kg)                the everyday bite
 *   Bucket       r 0.70 m  -> 1.44 m3 (about 2-4 t)                 an excavator's bite: 1.4 m across, a hole
 *                                                                  you can stand and turn in, a tunnel you can walk
 * The hand tools load a powered hauling cart: 400 kgf rated weight, ~1054 kg on Mars.
 * The excavator loads a 48 t hopper. These are assisted transport capacities, not human lifting strength.
 */
export function makeTools(body) {
  const hands = CARRY_EARTH_KGF * EARTH_G / body.surfaceGravity;
  return [
    { id: 'spade',  name: 'Hand spade', radius: 0.09, reachM: 3.2, capacityKg: hands, carrier: 'Hauling cart' },
    { id: 'shovel', name: 'Shovel',     radius: 0.17, reachM: 3.6, capacityKg: hands, carrier: 'Hauling cart' },
    { id: 'bucket', name: 'Excavator bucket', radius: 0.70, reachM: 6.5, capacityKg: 48000, carrier: 'Hopper', machine: true },
  ];
}

const len3 = (v) => Math.hypot(v.x, v.y, v.z);
const unit = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };

export class Digger {
  constructor(body, edits, walker) {
    this.body = body; this.edits = edits; this.walker = walker;
    this.tools = makeTools(body);
    this.toolIdx = 1;
    this.canPlaceSpoil = null;          // world-point exclusion supplied by port/ship
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
    const remaining = tl.capacityKg - this.carriedMass();
    const full = `${tl.carrier} full · Drop all (R) or one load (Q)`;
    if (remaining <= 0) return { ok: false, msg: full };
    const hit = this.digTarget();
    if (!hit) return { ok: false, msg: 'Nothing in reach' };
    const c = this.biteCentre(hit, tl.radius);
    const lot = this.edits.carve({ x: c.x, y: c.y, z: c.z, r: tl.radius, maxMassKg: remaining });
    if (!lot) return { ok: false, msg: this.edits.lastRefusal || 'Cannot cut this' };
    this.carried.push(lot);
    return { ok: true, msg: `+${lot.massKg.toFixed(1)} kg ${lot.materialName}`, lot, centre: c };
  }

  /** The ground point under p (looking down the local up axis), or null. */
  groundBelowPoint(p, up, from = 4, drop = 12, local = false) {
    // A player with a large hopper can be well below the rim before pouring.
    // Start ABOVE the original ground beside the shaft, rather than inside solid rock.
    const l = len3(p), r = surfaceRadiusFast(this.body, p.x / l, p.y / l, p.z / l, 3, { ignoreEdits: true });
    if (!local) from = Math.max(from, r - l + 4);
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
  _surfaceDumpPlan(lot, anchor = this.walker.worldPos) {
    const w = this.walker, edits = this.edits;
    const wp = anchor, up = unit(wp);
    const V = lot.solidVolumeM3;
    const tanT = Math.tan(edits.repose);
    const rNew = Math.cbrt((3 * V) / (Math.PI * tanT)) + 0.14 + 0.1;   // a poured heap, rounded tip included
    const growth = (pile) => pile.radiusM * Math.cbrt(1 + V / Math.max(pile.volumeM3, 1e-4));
    // A heap that has grown to this radius is full: the next load starts another one beside it. (A heap is a pile of
    // many loads for a reason of cost as well as of look: pouring onto a big one touches every lattice point of it.)
    const FULL_HEAP_M = 2.1;
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
      if (pile && growth(pile) <= FULL_HEAP_M && this._planClear({x:pile.x,y:pile.y,z:pile.z,up:pile.up,r:growth(pile)})) return { x: pile.x, y: pile.y, z: pile.z, up: pile.up, pile, r: growth(pile) };
      const plan={ x: gp.x, y: gp.y, z: gp.z, up, pile: null, r: rNew };
      return this._planClear(plan)?plan:null;
    }

    // Horizontal direction from the hole toward the player.
    let hx = wp.x - site.x, hy = wp.y - site.y, hz = wp.z - site.z;
    const along = hx * up.x + hy * up.y + hz * up.z;
    hx -= up.x * along; hy -= up.y * along; hz -= up.z * along;
    let hl = Math.hypot(hx, hy, hz);
    if (hl < 0.05) { hx = f.north.x; hy = f.north.y; hz = f.north.z; hl = 1; }
    hx /= hl; hy /= hl; hz /= hl;
    const cross = { x: up.y * hz - up.z * hy, y: up.z * hx - up.x * hz, z: up.x * hy - up.y * hx };

    for (let k = 0; k < 12; k++) {
      const ang = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.6;       // 0, +34, -34, +69 ... degrees
      const c = Math.cos(ang), s = Math.sin(ang);
      const d = { x: hx * c + cross.x * s, y: hy * c + cross.y * s, z: hz * c + cross.z * s };
      const dist = site.radiusM + 0.4 + rNew;
      const gp = this.groundBelowPoint({ x: site.x + d.x * dist, y: site.y + d.y * dist, z: site.z + d.z * dist }, up);
      if (!gp) continue;
      let pile = edits.pileNear(gp.x, gp.y, gp.z, 0.6);
      if (pile && growth(pile) > FULL_HEAP_M) continue;          // that heap is full: try round the hole
      const centre = pile ? { x: pile.x, y: pile.y, z: pile.z } : gp;
      const r = pile ? growth(pile) : rNew;
      const plan = { x: centre.x, y: centre.y, z: centre.z, up, pile, r };
      if (!this._planClear(plan)) continue;
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
    return null;
  }

  _pointClear(p) {
    return !this.canPlaceSpoil || this.canPlaceSpoil(p.x,p.y,p.z);
  }
  _planClear(plan) {
    // Conservative footprint, including slope runout. Actual lattice writes are checked too.
    if(!this._pointClear(plan))return false;
    const f=this.walker.updateFrame(),r=plan.r*1.7+.3;
    for(let d=Math.max(.15,r/8);d<=r+.001;d+=Math.max(.15,r/8))for(let k=0;k<32;k++) {
      const a=k*Math.PI/16, ca=Math.cos(a)*d,sa=Math.sin(a)*d;
      const p={x:plan.x+f.east.x*ca+f.north.x*sa,y:plan.y+f.east.y*ca+f.north.y*sa,z:plan.z+f.east.z*ca+f.north.z*sa};
      if(!this._pointClear(p))return false;
    }
    return true;
  }
  dumpPlan(lot, skipLocal = false) {
    const w=this.walker,wp=w.worldPos,up=unit(wp),f=w.updateFrame();
    const original=surfaceRadiusFast(this.body,up.x,up.y,up.z,3,{ignoreEdits:true});
    const underground=original-len3(wp)>.6;
    if(!underground)return this._surfaceDumpPlan(lot);
    const r=Math.cbrt(3*lot.solidVolumeM3/(Math.PI*Math.tan(this.edits.repose)))+.24;
    // Keep the drop at this floor, beside the boots. Never start above the tunnel roof.
    if(!skipLocal)for(let k=0;k<8;k++) {
      const a=w.yaw+k*Math.PI/4,d=Math.max(.9,Math.min(2,r+.5));
      const p={x:wp.x+(f.north.x*Math.cos(a)+f.east.x*Math.sin(a))*d,
        y:wp.y+(f.north.y*Math.cos(a)+f.east.y*Math.sin(a))*d,
        z:wp.z+(f.north.z*Math.cos(a)+f.east.z*Math.sin(a))*d};
      const gp=this.groundBelowPoint(p,up,.25,1.2,true);
      if(!gp)continue;
      const pile=this.edits.pileNear(gp.x,gp.y,gp.z,.2);
      const centre=pile||gp;
      const radius=pile?pile.radiusM*Math.cbrt(1+lot.solidVolumeM3/Math.max(pile.volumeM3,1e-4)):r;
      const plan={x:centre.x,y:centre.y,z:centre.z,up,pile,r:radius,local:true};
      if(!this._planClear(plan))continue;
      // A floor whose centre is on this level, with enough clear cone room above it.
      // Refuse a huge load here rather than letting the pour find disconnected roof surfaces.
      const h=radius*Math.tan(this.edits.repose)+.3;
      let room=true;
      for(let j=0;j<24&&room;j++)for(let t=.15;t<=h;t+=.15) {
        const a=j*Math.PI/12,rad=Math.max(0,radius*(1-t/h));
        const q={x:plan.x+up.x*t+f.east.x*Math.cos(a)*rad+f.north.x*Math.sin(a)*rad,
          y:plan.y+up.y*t+f.east.y*Math.cos(a)*rad+f.north.y*Math.sin(a)*rad,
          z:plan.z+up.z*t+f.east.z*Math.cos(a)*rad+f.north.z*Math.sin(a)*rad};
        if(density(this.body,q.x,q.y,q.z)<.02){room=false;break;}
      }
      if(room)return plan;
    }
    // Find a real opening cut through the original surface, nearest to the player.
    const mouths=[],digs=this.edits.edits.filter(e=>e.type==='dig');
    // Trace the joined cuts back to this excavation, so an unrelated old pit is not a mouth.
    const nearest=digs.reduce((a,e)=>{
      const d=q=>Math.hypot(q.x-wp.x,q.y-wp.y,q.z-wp.z)-q.radius;
      return !a||d(e)<d(a)?e:a;
    },null);
    if(!nearest||Math.hypot(nearest.x-wp.x,nearest.y-wp.y,nearest.z-wp.z)-nearest.radius>9)return null;
    const connected=nearest?[nearest]:[],seen=new Set(connected);
    for(let i=0;i<connected.length;i++)for(const e of digs) {
      const q=connected[i];
      if(!seen.has(e)&&Math.hypot(e.x-q.x,e.y-q.y,e.z-q.z)<=e.radius+q.radius+.1) {
        seen.add(e);connected.push(e);
      }
    }
    for(const e of connected) {
      const u=unit(e),sr=surfaceRadiusFast(this.body,u.x,u.y,u.z,3,{ignoreEdits:true});
      if(Math.abs(sr-len3(e))>e.radius+.15)continue;
      const p={x:u.x*sr,y:u.y*sr,z:u.z*sr};
      if(density(this.body,p.x-u.x*.12,p.y-u.y*.12,p.z-u.z*.12)<=0)continue;
      mouths.push({p,radius:e.radius,d:Math.hypot(p.x-wp.x,p.y-wp.y,p.z-wp.z)});
    }
    mouths.sort((a,b)=>a.d-b.d);
    for(const m of mouths) {
      // Search outward from this opening itself, not a bounding sphere round the whole tunnel.
      for(let ring=0;ring<5;ring++)for(let k=0;k<24;k++) {
        const a=k*Math.PI/12,dist=m.radius+r+.5+ring*.5;
        const p={x:m.p.x+(f.east.x*Math.cos(a)+f.north.x*Math.sin(a))*dist,
          y:m.p.y+(f.east.y*Math.cos(a)+f.north.y*Math.sin(a))*dist,
          z:m.p.z+(f.east.z*Math.cos(a)+f.north.z*Math.sin(a))*dist};
        const gp=this.groundBelowPoint(p,up);
        if(!gp||len3(gp)<len3(m.p)-.4)continue;
        const plan={...gp,up,pile:null,r,mouth:m.p};
        if(this._planClear(plan))return plan;
      }
    }
    return null;
  }

  /** Combine the inventory without changing its composition, mass or volume. */
  combinedLoad() {
    if (!this.carried.length) return null;
    const parts = new Map();
    for (const lot of this.carried) for (const p of lot.parts) {
      const q = parts.get(p.materialId) || { materialId: p.materialId, volumeM3: 0, massKg: 0 };
      q.volumeM3 += p.volumeM3; q.massKg += p.massKg; parts.set(p.materialId, q);
    }
    const dominant = this.carried.reduce((a, b) => a.massKg > b.massKg ? a : b);
    return { ...dominant, lotId: this.carried.map(l => l.lotId).join('+'),
      massKg: this.carriedMass(), solidVolumeM3: this.carriedVolume(),
      looseVolumeM3: this.carried.reduce((s, l) => s + l.looseVolumeM3, 0), parts: [...parts.values()], sourceLots: this.carried.slice() };
  }

  dumpAll() { return this.dump(true); }

  dump(all = false) {
    if (!this.carried.length) return { ok: false, msg: 'Carrying nothing' };
    const lot = all ? this.combinedLoad() : this.carried[this.carried.length - 1];
    let plan = this.dumpPlan(lot);
    if (!plan) return { ok: false, msg: 'No clear room here or by the mouth; keep the load' };
    const pour=p=>this.edits.deposit(lot,p.x,p.y,p.z,{up:p.up,pile:p.pile,local:p.local,canPlace:this.canPlaceSpoil});
    let res=pour(plan);
    if(!res&&plan.local) {plan=this.dumpPlan(lot,true);if(plan)res=pour(plan);}
    if (!res) return { ok: false, msg: 'No clear room here or by the mouth; keep the load' };
    if (all) this.carried.length = 0; else this.carried.pop();
    const left = this.carried.length;
    return { ok: true, msg: `dropped ${lot.massKg.toFixed(1)} kg${left ? ` · ${left} left` : ''}`, pile: res.pile, plan };
  }
}
