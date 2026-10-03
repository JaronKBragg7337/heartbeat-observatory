import { buildInterior, buildSeats } from '../ship/shipInterior.js';
// ============================================================================
// world-state/fleetView.js - the other ships of the shared world, as you see them: raiders and their escorts, other players' hulls,
// the fleet's bolts, the shipyard kiosk at the port, and the fleet section of the World / crew panel.
//
// OWNS: building a remote ship's exterior from its definition (src/ships/visuals.js), posing it from what the server says (gear, ramps,
//       guns, engine glow, smoke), the people seated at a raider's stations, escort drones, the label over a raider, and the panel
//       buttons for buying a ship, making one your flagship and claiming a disabled or abandoned raider.
// DOES NOT OWN: any of the state (server/authority.mjs holds it; this only reads the snapshot), or how a ship is built or flies.
//
// Ship poses use the shared 100 ms interpolation buffer and bounded prediction;
// crew ride the same displayed hull transform. Bolts and escorts retain their
// existing short age-based prediction.
// ============================================================================

import * as THREE from 'three';
import { shipPresence } from './shipPresence.js';
import { shipDef } from '../ships/registry.js';
import { visualsFor } from '../ships/visuals.js';
import { SHIPYARD, forSale } from '../ships/shipyard.js';
import { CLAIM_REACH_M } from '../ships/raider/stats.js';
import { buildDroneMesh } from '../ship/shipFx.js';
import { poseRamp } from '../ship/shipSystem.js';

const IDENT = new THREE.Quaternion();
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function textSprite(text, w = 640, h = 80, fg = '#ffe0ab', bg = '#17120cdd') {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }));
  s.userData = { c, tex, w, h, fg, bg, text: null };
  s.scale.set(w / 100, h / 100, 1);
  setText(s, text);
  return s;
}
function setText(s, text, fg) {
  const u = s.userData;
  if (u.text === text && (!fg || fg === u.fg)) return;
  u.text = text; if (fg) u.fg = fg;
  const x = u.c.getContext('2d');
  x.clearRect(0, 0, u.w, u.h);
  x.fillStyle = u.bg; x.fillRect(0, 0, u.w, u.h);
  x.fillStyle = u.fg; x.font = `${Math.round(u.h * 0.42)}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, u.w / 2, u.h / 2, u.w - 20);
  u.tex.needsUpdate = true;
}

/** What a raider's state is called on its label and in the panel. */
export const STATE_TEXT = {
  patrol: 'RAIDER', engage: 'RAIDER - ATTACKING', return: 'RAIDER - BROKE OFF',
  disabled: 'DISABLED - crew surrendered', abandoned: 'ABANDONED',
};

export class FleetView {
  constructor(mp) {
    this.mp = mp;
    this.views = new Map();        // ship id -> { root, entry, ext, def, label }
    this.escorts = new Map();      // escort id -> { mesh, entry }
    this.snapAt = performance.now();
    this.cull = 1400;              // beyond this a ship's label and crew are not worth drawing
    this._smoke = 0;
    this.buildKiosk();
  }

  get engine() { return this.mp.engine; }
  get ship() { return this.mp.ship; }
  get space() { return this.mp.space; }
  /** Called each time a new snapshot arrives. */
  onSnapshot() { this.snapAt = performance.now(); }
  age() { return Math.min(0.3, (performance.now() - this.snapAt) / 1000); }
  frameOf(id) { return id === 'mars' ? this.engine.rootFrame : this.space.moonWorld(id).frame; }

  // -------------------------------------------------------------------------
  // THE SHIPYARD KIOSK: a counter and a lit board by the hiring board, with a scale model of what is for sale.
  // -------------------------------------------------------------------------
  buildKiosk() {
    const mp = this.mp, g = new THREE.Group(); g.name = 'shipyard-kiosk';
    const Y = SHIPYARD, mat = new THREE.MeshStandardMaterial({ color: 0x4d443a, roughness: 0.8 }), accent = new THREE.MeshStandardMaterial({ color: 0xb02a22, roughness: 0.6 });
    const add = (m, x, y, z, w, h, d) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
    add(mat, 0, 0.55, 0, 3.2, 1.1, 0.9);                    // the counter
    add(accent, 0, 1.12, 0, 3.3, 0.06, 1.0);
    for (const x of [-1.5, 1.5]) add(mat, x, 1.6, -0.4, 0.12, 3.2, 0.12);               // posts
    add(mat, 0, 3.15, -0.4, 3.4, 0.14, 0.3);                  // header
    const sign = textSprite(`${Y.name.toUpperCase()}`, 768, 96, '#ffd9a0', '#241914f2'); sign.position.set(0, 3.55, -0.3); sign.scale.set(3.3, 0.41, 1); g.add(sign);
    const rows = forSale();
    this.board = textSprite(rows.map((r) => `${r.name} ${r.priceCredits} cr`).join('  |  ') || 'Nothing for sale', 768, 80, '#bfe8ff', '#142029f2');
    this.board.position.set(0, 2.55, -0.3); this.board.scale.set(2.5, 0.26, 1); g.add(this.board);
    // a scale model of each class on the counter
    let i = 0;
    for (const r of rows) {
      try {
        const V = visualsFor(r.type), def = shipDef(r.type);
        const ext = V.buildExterior(def.layout, this.ship.matsExt, { tier: 'low', def, remote: true });
        ext.root.scale.setScalar(0.045); ext.root.position.set(-0.8 + i * 1.4, 1.15, 0); ext.root.rotation.y = Math.PI * 0.9;
        V.applyNeutralPose(ext);
        for (const e of ext.engines) e.outer.visible = e.core.visible = false;                       // a model on a counter is not burning
        for (const p of ext.liftPods) p.mesh.visible = p.core.visible = false;
        g.add(ext.root); i++;
      } catch (e) { console.warn('kiosk model failed', r.type, e); }
    }
    g.position.set(Y.spot.x, 0, Y.spot.z);
    g.rotation.y = Math.PI * 0.35;
    mp.hallRoot.add(g);
    this.kiosk = g;
  }

  // -------------------------------------------------------------------------
  // A remote ship's view
  // -------------------------------------------------------------------------
  makeView(ship) {
    const t0 = performance.now();
    const def = shipDef(ship.type), V = visualsFor(ship.type);
    const name = ship.npc ? ship.npc.name : null;
    const dec = typeof document !== 'undefined' ? V.decalTexture(THREE, def, name || undefined, def.registryId) : null;     // the boat's own name, never the one this client flies
    const mats = this.ship.matsExt;
    const ext = V.buildExterior(def.layout, mats, {
      tier: this.ship.tier, def, remote: true,
      decal: dec ? new THREE.MeshBasicMaterial({ map: dec, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }) : null,
    });
    V.applyNeutralPose(ext);
    ext.root.name = 'ship:' + ship.id;
    ext.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    this.engine.scene.add(ext.root);
    const entry = this.engine.track({ worldPos: { ...ship.pose.pos }, object3d: ext.root, quaternion: new THREE.Quaternion() });
    const v = { root: ext.root, entry, ext, def, label: null, smoke: 0, buildMs: 0 };
    if (ship.npc) { v.label = textSprite(name, 640, 80); v.label.visible = false; this.engine.scene.add(v.label); v.labelEntry = this.engine.track({ worldPos: { ...ship.pose.pos }, object3d: v.label, quaternion: IDENT }); }
    v.buildMs = performance.now() - t0;
    this.views.set(ship.id, v);
    return v;
  }

  /** Posing an exterior from the server's record: gear, ramps, guns, engine glow. Pure presentation. */
  pose(v, ship) {
    const f = ship.pose, ext = v.ext, def = v.def, G = def.gear;
    const gear = f.gearPos ?? 1;
    ext.legs.forEach((leg) => {
      const len = Math.max(0.35, G.nominal * gear + 0.35 * (1 - gear));
      leg.foot.position.y = -len; leg.piston.scale.y = len + 0.2; leg.piston.position.y = 0.2;
    });
    for (const key of ['cargo', 'airlock']) {
      const r = ship.state && ship.state.ramps && ship.state.ramps[key]; if (!r || !ext.ramps[key]) continue;
      poseRamp(ext.ramps[key], def.ramps[key], key, r.progress ?? (r.lowered ? 1 : 0), r.angle ?? 0.5);
    }
    const A = ship.combat && ship.combat.aim;
    if (A) {
      if (A.main && ext.guns.main) for (const m of ext.guns.main) m.group.rotation.set(A.main.pitch, -A.main.yaw, 0, 'YXZ');
      for (const id of ['dorsal', 'ventral']) if (A[id] && ext.guns[id]) { ext.guns[id].yaw.rotation.y = -A[id].yaw; ext.guns[id].pitch.rotation.x = A[id].pitch; }
    }
    // engine glow follows the speed it is making; the lift pods burn while it is off the ground
    const sp = Math.hypot(f.vel.x, f.vel.y, f.vel.z), k = Math.min(1, sp / Math.max(1, def.phys.cruiseSpeed));
    const air = !f.landed;
    for (const e of ext.engines) {
      e.outer.visible = e.core.visible = air;
      const kk = Math.max(0.1, k);
      e.outer.scale.set(0.8 + 0.5 * kk, 0.8 + 0.5 * kk, 0.4 + 1.6 * kk); e.outer.material.opacity = 0.15 + 0.6 * kk;
      e.core.scale.set(0.8 + 0.4 * kk, 0.8 + 0.4 * kk, 0.4 + 1.5 * kk); e.core.material.opacity = 0.2 + 0.7 * kk;
    }
    for (const p of ext.liftPods) { p.mesh.visible = p.core.visible = air; p.mesh.scale.set(0.6, 0.7, 0.6); p.core.scale.set(0.6, 0.7, 0.6); p.mesh.material.opacity = 0.35; p.core.material.opacity = 0.45; }
    // a dead drive does not burn
    if (ship.npc && (ship.npc.state === 'disabled' || ship.npc.state === 'abandoned')) for (const e of ext.engines) e.outer.visible = e.core.visible = false;
  }

  smoke(v, ship, dt) {
    const f = ship.pose, fx = this.ship.fx;
    if (!fx || !fx.dust || ship.frameId !== this.space.frameId || f.hull > 55) return;
    v.smoke += dt * (f.hull < 35 ? 14 : 6);
    const sp = v.def.hull.combat.centre, n = Math.floor(v.smoke); v.smoke -= n;
    for (let i = 0; i < Math.min(2, n); i++) {
      const w = new THREE.Vector3(sp.x + (Math.random() - 0.5) * 3, sp.y + 1.5, sp.z + 2 + Math.random() * 3).applyQuaternion(new THREE.Quaternion().fromArray(f.quaternion));
      const pos = { x: f.pos.x + w.x, y: f.pos.y + w.y, z: f.pos.z + w.z }, l = Math.hypot(pos.x, pos.y, pos.z) || 1, up = { x: pos.x / l, y: pos.y / l, z: pos.z / l };
      fx.dust.emit({ ...pos, vx: f.vel.x * 0.9 + (Math.random() - 0.5) * 2, vy: f.vel.y * 0.9 + (Math.random() - 0.5) * 2, vz: f.vel.z * 0.9 + (Math.random() - 0.5) * 2,
        life: 3 + Math.random() * 2, size0: 1.2, size1: 5 + Math.random() * 4, c0: [0.16, 0.15, 0.14], c1: [0.28, 0.26, 0.24], alpha: 0.55, drag: 0.4, grav: 0, up });
    }
  }

  // -------------------------------------------------------------------------
  // Each frame
  // -------------------------------------------------------------------------
  update(dt, snapshot, activeId) {
    const age = this.age(), mine = this.mp.world.playerId, cam = this.engine.cameraWorldPos;
    const extra = [];
    const seenShips = new Set(), seenEsc = new Set();
    for (const ship of Object.values(snapshot.ships)) {
      const sameFrame = ship.frameId === this.space.frameId;
      const v0 = this.views.get(ship.id);
      if (ship.id === activeId) { if (v0) v0.root.visible = false; if (v0 && v0.label) v0.label.visible = false; continue; }
      const presence=shipPresence(ship,snapshot);
      if(!presence){if(v0){v0.root.visible=false;if(v0.label)v0.label.visible=false;}continue;}
      seenShips.add(ship.id);
      const v = v0 || this.makeView(ship);
      if(!ship.npc&&!v.label){v.label=textSprite('',640,80);this.engine.scene.add(v.label);
        v.labelEntry=this.engine.track({worldPos:{...ship.pose.pos},object3d:v.label,quaternion:IDENT});}
      const f = ship.pose, frame = this.frameOf(ship.frameId);
      const rendered = this.mp.shipPose(ship), pos = rendered.pos;
      Object.assign(v.entry.worldPos, pos); v.entry.quaternion.fromArray(rendered.quaternion); v.entry.frame = frame;
      v.root.visible = sameFrame;
      // An interior is only ever seen through a ramp, hatch or window, so it is built and drawn within ~50 m (it stays built, hidden, beyond 65 m: no flicker at the edge).
      const dCam=sameFrame?dist(pos,cam):1e9,near=dCam<(v.interior&&v.interior.root.visible?65:50);
      if(near&&!v.interior){v.interior=buildInterior({...v.def.layout,custom:visualsFor(ship.type).custom},this.ship.matsInt,{tier:'low'});buildSeats(v.def.layout,this.ship.matsInt,v.interior);v.root.add(v.interior.root);}
      if(v.interior){v.interior.root.visible=near;for(const d of v.interior.doors)d.group.visible=d.def.gate==='airlock_outer'?!ship.state.airlock.outerOpen:d.def.gate==='airlock_inner'?!ship.state.airlock.innerOpen:false;}
      if (sameFrame) {
        // Posing (legs, ramps, guns, engine glow) rewrites dozens of transforms; a hull that is not changing keeps the pose it has.
        const r0=ship.state?.ramps,sig=ship.npc||ship.combat?.aim?null:`${f.gearPos}|${f.landed}|${Math.round(Math.hypot(f.vel.x,f.vel.y,f.vel.z))}|${r0?.cargo?.progress}|${r0?.cargo?.angle}|${r0?.airlock?.progress}|${r0?.airlock?.angle}`;
        if(sig===null||sig!==v.poseSig){v.poseSig=sig;this.pose(v,ship);}
        this.smoke(v,ship,dt);}
      // the label: what it is and how it is doing, for as long as it is near enough to read
      if (v.label) {
        const d = dCam;
        v.label.visible = d < this.cull;
        if (v.label.visible) {
          const n = ship.npc;
          // The view was built while this hull was a raider. Once a player owns it, the label would read n.state and throw.
          if (!n) {setText(v.label,`${snapshot.players[ship.owner]?.name||'Owner'} · ${presence==='parked'?'PARKED · owner offline':'CONNECTED'}`);
            const up=new THREE.Vector3(pos.x,pos.y,pos.z).normalize();Object.assign(v.labelEntry.worldPos,{x:pos.x+up.x*11,y:pos.y+up.y*11,z:pos.z+up.z*11});v.labelEntry.frame=frame;}
          else { const st = STATE_TEXT[n.state] || n.state;
          setText(v.label, `${n.name} - ${st}${n.state === 'engage' || n.state === 'patrol' || n.state === 'return' ? ` - hull ${Math.round(f.hull)}%` : ''}`, n.state === 'disabled' ? '#9fffc2' : n.state === 'abandoned' ? '#c8c8c8' : '#ffb0a0');
          const up = new THREE.Vector3(pos.x, pos.y, pos.z).normalize();
          Object.assign(v.labelEntry.worldPos, { x: pos.x + up.x * 11, y: pos.y + up.y * 11, z: pos.z + up.z * 11 }); v.labelEntry.frame = frame;
          v.label.scale.setScalar(Math.max(1, d / 160));
          }
        }
      }
      // fire: this ship's bolts (a raider's, or another player's) and its escorts' shots, carried forward by the age of the snapshot
      if (sameFrame && ship.combat) for (const b of ship.combat.bolts || []) extra.push({ x: b.x + b.vx * age, y: b.y + b.vy * age, z: b.z + b.vz * age, vx: b.vx, vy: b.vy, vz: b.vz, gun: 'enemy', power: 0.9 });
      if (ship.npc && ship.npc.escorts) {
        for (const b of ship.npc.escorts.shots || []) if (sameFrame) extra.push({ x: b.x + b.vx * age, y: b.y + b.vy * age, z: b.z + b.vz * age, vx: b.vx, vy: b.vy, vz: b.vz, gun: 'enemy', power: 0.9 });
        for (const d of ship.npc.escorts.drones || []) {
          seenEsc.add(d.id);
          let e = this.escorts.get(d.id);
          if (!e) { const mesh = buildDroneMesh(); this.engine.scene.add(mesh); e = { mesh, entry: this.engine.track({ worldPos: { ...d.pos }, object3d: mesh, quaternion: new THREE.Quaternion() }) }; this.escorts.set(d.id, e); }
          const alive = d.state !== 'dead' && d.state !== 'away' && sameFrame;
          e.mesh.visible = alive; e.entry.frame = frame;
          if (!alive) continue;
          Object.assign(e.entry.worldPos, { x: d.pos.x + d.vel.x * age, y: d.pos.y + d.vel.y * age, z: d.pos.z + d.vel.z * age });
          const up = new THREE.Vector3(d.pos.x, d.pos.y, d.pos.z).normalize(), fwd = new THREE.Vector3(d.vel.x, d.vel.y, d.vel.z).projectOnPlane(up);
          if (fwd.lengthSq() < 1e-4) fwd.set(1, 0, 0).projectOnPlane(up);
          fwd.normalize();
          e.entry.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(fwd, up).normalize(), up, fwd.clone().negate()));
          e.mesh.userData.spin(dt);
          const pulse = 1.3 + 0.9 * Math.sin(performance.now() * (d.state === 'attack' ? 0.012 : 0.003));
          e.mesh.userData.eye.color.setRGB(pulse, 0.012 * pulse, 0.008 * pulse);
        }
      }
    }
    this.feedback(snapshot, activeId, dt);
    for (const [id, v] of this.views) if (!seenShips.has(id) && snapshot.ships[id] === undefined) { this.engine.scene.remove(v.root); this.engine.untrack(v.entry); if (v.label) { this.engine.scene.remove(v.label); this.engine.untrack(v.labelEntry); } this.views.delete(id); }
    for (const [id, e] of this.escorts) if (!seenEsc.has(id)) { this.engine.scene.remove(e.mesh); this.engine.untrack(e.entry); this.escorts.delete(id); }
    this.ship.extraBolts = extra;
  }

  /**
   * What the pilot should feel and read: a raider that turns on you, one that goes down, and every hit on your own shield or hull
   * (the shield ripples from the side the nearest enemy is on, the cockpit shakes, the hit is heard). The server sends state, not events,
   * so a hit is a fall in the numbers between two snapshots.
   */
  feedback(snapshot, activeId, dt) {
    const act = snapshot.ships[activeId], sys = this.ship; if (!act) return;
    for (const s of Object.values(snapshot.ships)) {
      if (!s.npc) continue;
      const was = this.seen && this.seen.get(s.id), st = s.npc.state;
      if (was !== undefined && was !== st && s.frameId === act.frameId && dist(s.pose.pos, act.pose.pos) < 5000) {
        if (st === 'engage' && s.npc.targetId === activeId) sys.note(`${s.npc.name} is attacking us.`, true);
        else if (st === 'return' && was === 'engage') sys.note(`${s.npc.name} has broken off.`);
        else if (st === 'disabled') sys.note(`${s.npc.name} is disabled: its crew have surrendered. Bring your ship within ${CLAIM_REACH_M} m and open World / crew to board it, or to send a prize crew.`);
        else if (st === 'abandoned') sys.note(`${s.npc.name} has been abandoned. Bring your ship within ${CLAIM_REACH_M} m and open World / crew to claim it.`);
      }
      (this.seen || (this.seen = new Map())).set(s.id, st);
    }
    const sh = act.pose.shield, hu = act.pose.hull;
    if (this._lastShip === activeId && (sh < this._lastShield - 0.5 || hu < this._lastHull - 0.05)) {
      // the side it came from: the nearest raider or escort of this frame, in ship-local axes
      let best = null, bd = 1e12;
      const consider = (p) => { const d = dist(p, act.pose.pos); if (d < bd) { bd = d; best = p; } };
      for (const s of Object.values(snapshot.ships)) if (s.npc && s.frameId === act.frameId) { consider(s.pose.pos); for (const d of (s.npc.escorts && s.npc.escorts.drones) || []) if (d.state === 'attack') consider(d.pos); }
      const u = sys.shield && sys.shield.material.uniforms;
      if (u) {
        const sc = this.ship.visuals.shield.scale;
        if (best) { const l = sys.flight.toLocal(best, {}), m = Math.hypot(l.x, l.y, l.z) || 1; u.uHit.value.set(l.x / m / sc[0] * 10, l.y / m / sc[1] * 10, l.z / m / sc[2] * 10); }
        u.uColor.value.set(sh > 1 ? 0.25 : 1.0, sh > 1 ? 0.75 : 0.3, sh > 1 ? 1.0 : 0.2);
        sys.shieldFlash = 1;
      }
      sys.hitShake = 0.35 + (hu < this._lastHull ? 0.3 : 0);
      if (sys.audio) sys.audio.hit(Math.max(0, this._lastShield - sh));
    }
    this._lastShip = activeId; this._lastShield = sh; this._lastHull = hu;
  }

  /** The people at a raider's stations (they are not in the hiring pool). Adds their ids to `seen` so the caller shows them. */
  crew(dt, snapshot, seen) {
    const cam = this.engine.cameraWorldPos;
    for (const ship of Object.values(snapshot.ships)) {
      if (!ship.npc && ship.type === 'meridian') continue;
      const f = this.mp.shipPose(ship), def = shipDef(ship.type);
      const near = ship.frameId === this.space.frameId && dist(f.pos, cam) < Math.min(this.cull, 700);
      const q = new THREE.Quaternion().fromArray(f.quaternion);
      for (const c of ship.crew || []) {
        if (snapshot.pool && snapshot.pool[c.id]) continue;            // hired crew are drawn with the pool
        if (!near) continue;
        seen.add(c.id);
        const b = this.mp.body(c.id, c.personId, c.name, c.look);
        const seat = c.seatPose || def.seats.find((s) => s.id === def.crewPosts.find((r) => r.id === c.role)?.seat);
        if (!seat) continue;
        const sitting = c.status === 'aboard';
        const loc = sitting ? seat : { x: seat.x, y: seat.y, z: seat.z + 0.9 };
        const v = new THREE.Vector3(loc.x, loc.y, loc.z).applyQuaternion(q);
        const pos = { x: f.pos.x + v.x, y: f.pos.y + v.y, z: f.pos.z + v.z };
        const qq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI - (seat.yaw || 0) * Math.PI / 180));
        this.mp.placeBody(b, pos, qq, ship.frameId, sitting ? 'Sit' : 'Idle', dt);
      }
    }
  }

  // -------------------------------------------------------------------------
  // THE PANEL
  // -------------------------------------------------------------------------
  /** Fleet section of the World / crew panel. `text(t)` adds a line, `btn(label, action)` a button that sends the action. */
  panel(snapshot, me, text, btn) {
    const mine = Object.values(snapshot.ships).filter((s) => s.owner === me.id);
    text(`Your fleet (${mine.length}): ` + mine.map((s) => `${shipDef(s.type).class}${s.id === me.shipId ? ' [flagship]' : ''} pad ${s.pad ? s.pad.number : '?'}`).join(', '));
    const flag = snapshot.ships[me.shipId];
    if (flag && flag.escort && flag.id !== me.aboardShipId) text(`Your ${shipDef(flag.type).class} is ${flag.escort.mode === 'follow' ? 'following this ship' : 'holding station'}.`);
    if (!me.aboardShipId) for (const s of mine) if (s.id !== me.shipId && s.pose.landed && s.frameId === 'mars') btn(`Make ${shipDef(s.type).class} (pad ${s.pad.number}) my flagship`, { type: 'set-flagship', shipId: s.id });
    // the shipyard
    const rows = forSale();
    if (rows.length) {
      text(`${SHIPYARD.name}: walk to the kiosk by the hiring board, south-west of the Meridian's pad.`);
      for (const r of rows) btn(`Buy a ${r.name}: ${r.priceCredits} cr`, { type: 'buy-ship', shipType: r.type });
    }
    // raiders near enough to matter
    const aboard = me.aboardShipId && snapshot.ships[me.aboardShipId];
    const here = aboard ? aboard.pose.pos : null;
    for (const s of Object.values(snapshot.ships)) {
      if (!s.npc || !here || s.frameId !== aboard.frameId) continue;
      const d = dist(s.pose.pos, here); if (d > 4000) continue;
      const st = s.npc.state;
      text(`${s.npc.name}: ${STATE_TEXT[st] || st}, ${Math.round(d)} m, hull ${Math.round(s.pose.hull)}%`);
      if (st === 'disabled' || st === 'abandoned') {
        if (d <= CLAIM_REACH_M) {
          btn(st === 'disabled' ? `Prize crew brings ${s.npc.name} home` : `Claim ${s.npc.name}`, { type: 'claim-ship', shipId: s.id });
          btn(`Board ${s.npc.name}, my ship holds`, { type: 'board-prize', shipId: s.id, ownShip: 'hold' });
          btn(`Board ${s.npc.name}, my ship follows`, { type: 'board-prize', shipId: s.id, ownShip: 'follow' });
        }
        else text(`Bring your ship within ${CLAIM_REACH_M} m to take it.`);
      }
    }
  }
}
