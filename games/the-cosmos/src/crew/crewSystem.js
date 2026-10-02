// ============================================================================
// crewSystem.js — people you can hire, who then work the Meridian while you walk about it.
//
// OWNS: the five candidates waiting at Marineris Port, hiring, walking aboard (ground, ramp, stairs, ladders), sitting at a
//       station and doing the job (flying, gunnery, navigation), giving the seat up when the player wants it, and the orders
//       the player gives whoever is flying. DOES NOT OWN: the ship (shipSystem.js), flight physics (shipFlight.js), the
//       bolts (guns.js), what a person looks like (personRig.js), the dialog (crewUI.js).
//
// TWO FRAMES. Outside the ship a crew member is a point on the planet (f64 world metres, tracked by the floating origin, in the
// engine's world scene). Aboard they are a ShipWalker in the ship's own frame (the same collision the player's body uses) and a
// child of the ship's interior group, lit by the interior's lights. Boarding is the moment they step from one to the other,
// exactly at the foot of the lowered ramp, as the player does.
// ============================================================================

import * as THREE from 'three';
import { ShipWalker, shipIndexFor } from '../ship/shipWalker.js';

import { CREW_POSTS as ALL_POSTS, HIRE_SPOTS, HIRE_FACE, HIRE_BOARD, PLACES, MAX_TRIP_M, LINES, thinkDelay, aimErrorRad } from './crewSpec.js';
import { routeToSeat, RouteWalker } from './shipPath.js';
import { Autopilot, rng } from './autopilot.js';
import { GunnerAI } from './gunnerAI.js';
import { geodeticToCartesian } from '../world/geodesy.js';
import { initialEconomy, reduceEconomy } from '../economy/economy.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapPI = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const TALK_M = 3.0;
/** How high the seat pan is above the seat's floor mark, per seat: where a person's hips go. */
const PAN = { captain: 0.63, pilot: 0.47, nav: 0.57, comms: 0.57, engineer: 0.57, gun_dorsal: 0.44, gun_ventral: 0.44 };

export class CrewSystem {
  /**
   * @param o { engine, ship (ShipSystem), site (port site), people (PeopleLibrary), ground (dx,dy,dz)->radius, walker, tier, onSay(name, text) }
   */
  constructor(o) {
    this.engine = o.engine; this.ship = o.ship; this.site = o.site; this.people = o.people;
    this.ground = o.ground; this.walker = o.walker; this.tier = o.tier || 'high'; this.onSay = o.onSay || (() => {});
    this.playerLook = o.playerLook || null;
    this.members = new Map();
    this.time = 0;
    this.rand = rng((Date.now() & 0xffff) + 99);
    this.hiredAt = -1e9;
    this.kills = 0;
    this.board = null;
    this.world = o.world || null;
    this.account = initialEconomy();
  }

  // =========================================================================
  // BUILD
  // =========================================================================
  async build() {
    const roster = await this.people.roster();
    const have = new Set(roster.map((r) => r.id));
    // the player's own look is not a candidate: the pool shifts to the people who are left
    const posts = this.posts;
    const spare = roster.map((r) => r.id).filter((id) => !ALL_POSTS.some((p) => p.personId === id) && id !== this.playerLook);
    for (const def of posts) {
      let pid = def.personId;
      if (!have.has(pid) || pid === this.playerLook) pid = spare.shift() || pid;
      const file = (roster.find((r) => r.id === pid) || {}).file || pid + '.glb';
      const person = this.people.spawn(pid, file);
      const m = {
        def, id: def.id, name: def.name, personId: pid, person, status: 'candidate', place: 'ground', mode: 'idle',
        gpos: { x: 0, y: 0, z: 0 }, face: { x: 0, y: 0, z: 1 }, entry: null,
        sw: new ShipWalker(shipIndexFor(this.ship.def), this.ship.state), route: null, rw: null, seated: false, sitT: 0, displaced: false,
        walkSpeed: 1.55, waitNote: 0,
      };
      this.members.set(def.id, m);
      this._standAtHireSpot(m);
      person.ready.then(() => this._attachVisual(m));
      this._attachVisual(m);
    }
    this._buildBoard();
    return this;
  }

  _local(x, z) { // a port-local ground point as a world point on the surface
    const w = this.site.toWorld(x, 0.0, z), r = Math.hypot(w.x, w.y, w.z), g = this.ground(w.x / r, w.y / r, w.z / r);
    return { x: w.x / r * g, y: w.y / r * g, z: w.z / r * g };
  }

  _standAtHireSpot(m) {
    const s = HIRE_SPOTS[m.id];
    m.gpos = this._local(s.x, s.z);
    const t = this._local(HIRE_FACE.x, HIRE_FACE.z);
    m.face = this._tangent(m.gpos, { x: t.x - m.gpos.x, y: t.y - m.gpos.y, z: t.z - m.gpos.z });
    m.status = 'candidate'; m.place = 'ground'; m.mode = 'idle';
  }

  _up(p) { const l = Math.hypot(p.x, p.y, p.z) || 1; return { x: p.x / l, y: p.y / l, z: p.z / l }; }
  _tangent(p, d) {
    const u = this._up(p), k = d.x * u.x + d.y * u.y + d.z * u.z;
    const t = { x: d.x - u.x * k, y: d.y - u.y * k, z: d.z - u.z * k }, l = Math.hypot(t.x, t.y, t.z) || 1;
    return { x: t.x / l, y: t.y / l, z: t.z / l };
  }

  /** The person's group goes into whichever scene its frame belongs to. */
  _attachVisual(m) {
    const g = m.person.group;
    if (m.place === 'ground') {
      if (g.parent !== this.engine.scene) { g.removeFromParent(); this.engine.scene.add(g); }
      if (!m.entry) { m.entry = this.engine.track({ worldPos: { ...m.gpos }, object3d: g, quaternion: new THREE.Quaternion() }); }
    } else {
      if (m.entry) { this.engine.untrack(m.entry); m.entry = null; }
      const root = this.ship.interior && this.ship.interior.root;
      if (root && g.parent !== root) { g.removeFromParent(); root.add(g); }
      g.quaternion.identity();
    }
  }

  /** The hiring board: a lit sign on two posts, by the Meridian's ramp. */
  _buildBoard() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#17110d'; x.fillRect(0, 0, 512, 256);
    x.strokeStyle = '#e8a33d'; x.lineWidth = 8; x.strokeRect(10, 10, 492, 236);
    x.fillStyle = '#ffd9ac'; x.font = 'bold 54px sans-serif'; x.textAlign = 'center';
    x.fillText('CREW FOR HIRE', 256, 96);
    x.fillStyle = '#e8d5c2'; x.font = '30px sans-serif';
    x.fillText('Pilot · Captain · Navigator', 256, 150);
    x.fillText('Comms · Gunners · talk to hire', 256, 196);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const grp = new THREE.Group(); grp.name = 'crew-board';
    const post = new THREE.MeshStandardMaterial({ color: 0x59606a, roughness: 0.6, metalness: 0.7 });
    for (const sx of [-1.15, 1.15]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 2.6, 10), post); p.position.set(sx, 1.3, 0); p.castShadow = true; grp.add(p); }
    const face = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.25), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    face.position.set(0, 2.0, 0.04); grp.add(face);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.56, 1.31, 0.05), post); back.position.set(0, 2.0, -0.005); back.castShadow = true; grp.add(back);
    this.engine.scene.add(grp);
    const w = this._local(HIRE_BOARD.x, HIRE_BOARD.z);
    const u = this._up(w), toward = this._local(HIRE_FACE.x, HIRE_FACE.z);
    const f = this._tangent(w, { x: toward.x - w.x, y: toward.y - w.y, z: toward.z - w.z });
    const xa = new THREE.Vector3().crossVectors(new THREE.Vector3(u.x, u.y, u.z), new THREE.Vector3(f.x, f.y, f.z)).normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xa, new THREE.Vector3(u.x, u.y, u.z), new THREE.Vector3(f.x, f.y, f.z)));
    this.board = { group: grp, entry: this.engine.track({ worldPos: w, object3d: grp, quaternion: q }) };
  }

  // =========================================================================
  // THE PLAYER'S SIDE: who is near, hire, orders
  // =========================================================================
  /** World position of a member, wherever they are. */
  worldPosOf(m) {
    if (m.place === 'ground') return m.gpos;
    const loc = m.seated || m.mode === 'sit' ? this._seatPos(m) : { x: m.sw.x, y: m.sw.y, z: m.sw.z };
    return this.ship.flight.toWorld(loc, {});
  }
  _seatPos(m) { const s = this._seat(m); return { x: s.x, y: s.y + 0.8, z: s.z }; }
  _seat(m) { return this.ship.def.seats.find((s) => s.id === m.def.seat); }
  /** FLEET: the posts this ship has a seat for (a raider has no navigator, communications officer or ventral gunner to hire). */
  get posts() { return ALL_POSTS.filter((p) => this.ship.def.seats.some((s) => s.id === p.seat)); }

  /** The nearest member the player could talk to from where they stand (or sit). */
  nearest(playerWorld) {
    let best = null, bd = TALK_M;
    for (const m of this.members.values()) {
      if (!m.person.loaded) continue;
      const w = this.worldPosOf(m), d = Math.hypot(w.x - playerWorld.x, w.y - playerWorld.y, w.z - playerWorld.z);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  hiredList() { return [...this.members.values()].filter((m) => m.status === 'hired'); }
  seatedMember(seatId) { return [...this.members.values()].find((m) => m.status === 'hired' && m.def.seat === seatId && m.seated && !m.displaced) || null; }
  /** Who is flying: the pilot if they are in the chair, else the captain. */
  flyer() { return this.seatedMember('pilot') || this.seatedMember('captain'); }
  /** Who works the main guns: the captain, or whoever is flying when there is no captain. */
  mainGunner() { return this.seatedMember('captain') || this.seatedMember('pilot'); }

  say(m, text) { this.onSay(m.name, text); this.ship.note(`${m.name}: ${text}`); }

  /** Hire a candidate. Returns { ok, msg }. */
  hire(id, local = false) {
    if (this.world && !local) return this.world.dispatch({type:'hire',id});
    const m = this.members.get(id);
    if (!m || m.status !== 'candidate') return { ok: false, msg: 'Not available.' };
    const f = this.ship.flight;
    const near = Math.hypot(f.pos.x - m.gpos.x, f.pos.y - m.gpos.y, f.pos.z - m.gpos.z);
    if (!f.landed || near > 140) return { ok: false, msg: `${m.name}: Bring the Meridian down at the port first, and I will come aboard.` };
    let next;
    try { next = reduceEconomy(this.world ? this.world.state.economy : this.account, {type:'hire',id}); }
    catch(e) { return {ok:false,msg:e.message}; }
    if(this.world) this.world.state.economy=next; else this.account=next;
    m.status = 'hired'; m.mode = 'boarding'; m.route = null; m.seated = false; m.displaced = false;
    this.hiredAt = this.time;
    this.say(m, LINES.hired(m.name).replace(`${m.name}: `, ''));
    return { ok: true, msg: 'Hired.' };
  }

  /** Dismiss: they walk back off and wait at the port. Only while we are down at the port. */
  dismiss(id, local = false) {
    if(this.world && !local) return this.world.dispatch({type:'fire',id});
    const m = this.members.get(id);
    if (!m || m.status !== 'hired') return { ok: false, msg: 'Not aboard.' };
    const f = this.ship.flight, lp = this.site.toLocal(f.pos);
    if (!f.landed || Math.hypot(lp.x, lp.z) > 140) return { ok: false, msg: `${m.name}: I'll step off when we are down at the port.` };
    const next=reduceEconomy(this.world ? this.world.state.economy : this.account,{type:'fire',id});
    if(this.world)this.world.state.economy=next;else this.account=next;
    if (m.def.seat === 'pilot' || m.def.seat === 'captain') if (this.ap && this.flyer() === m) this.cancelOrder();
    if (this.ship.seat && this.ship.seat.id === m.def.seat) { /* the player is in it: nothing to do */ }
    m.dismissing = true; m.mode = 'leaving'; m.route = null; m.seated = false;
    this.say(m, 'Thanks, boss. I will be at the board.');
    return { ok: true, msg: 'Dismissed.' };
  }

  // =========================================================================
  // ORDERS
  // =========================================================================
  _ensureAP() {
    if (this.ap) return;
    const f = this.ship.flight;
    this.ap = new Autopilot(f, {
      ground: this.ground, drones: () => this.ship.drones || null, skill: 0.8, home: this._local(0, 0), seed: (this.rand() * 1e9) | 0,
      hasNav: () => !!this.seatedMember('nav'),
    });
    this.ap.setOrder({ type: 'hold' });
  }
  hasOrder() { return !!this.ap && this.ap.order.type !== 'hold'; }
  activeOrder() { return this.hasOrder() ? this.ap.order : null; }

  /** Everything the crew can be asked to fly to, with honest distances. */
  places() {
    const f = this.ship.flight, out = [];
    for (const p of PLACES) {
      const w = this._local(p.x, p.z), d = Math.hypot(w.x - f.pos.x, w.y - f.pos.y, w.z - f.pos.z);
      out.push({ id: p.id, name: p.name, distM: d, etaS: d / 36, ok: d <= MAX_TRIP_M, world: w, land: p.land, agl: p.agl });
    }
    for (const lm of this.ship.body.landmarks || []) {
      const c = geodeticToCartesian(this.ship.body, lm.lat, lm.lon, 0);
      const R = Math.hypot(c.x, c.y, c.z);
      const cos = (c.x * f.pos.x + c.y * f.pos.y + c.z * f.pos.z) / (R * Math.hypot(f.pos.x, f.pos.y, f.pos.z));
      const d = Math.acos(clamp(cos, -1, 1)) * this.ship.body.radiusMean;
      if (d < 500) continue;                                // it is where we already are
      out.push({ id: lm.id, name: lm.name, distM: d, etaS: d / 36, ok: d <= MAX_TRIP_M, world: null, land: false });
    }
    // Other worlds (src/space): the nav computer's own list, with its honest distances and flight times
    const sp = this.ship.space;
    if (sp) for (const d of sp.destinations()) out.push({ id: `sp:${d.id}`, name: d.name, distM: d.distM, etaS: d.etaS, ok: d.ok, world: null, land: false, space: true, reason: d.reason, blurb: d.blurb });
    return out;
  }

  /** The player gives an order to whoever is flying. `args` carries a place id for 'goto'. */
  order(type, args = {}) {
    const m = this.flyer();
    if (!m) return { ok: false, msg: 'Nobody is flying. Hire a pilot or a captain, or take the chair yourself.' };
    const f = this.ship.flight;
    if (type !== 'hold' && !this.ship.aboard) return { ok: false, msg: LINES.needYou(m.name) };
    this._ensureAP(); this.ap.skill = m.def.skill;
    let o = null, accept = '';
    switch (type) {
      case 'hold': o = { type: 'hold' }; accept = f.landed ? 'Holding on the ground.' : 'Holding here.'; break;
      case 'land': o = { type: 'land' }; accept = 'Setting her down.'; break;
      case 'return': o = { type: 'return' }; accept = 'Heading back to the pad.'; break;
      case 'roam': o = { type: 'roam' }; accept = 'Aye. A wander. I will call out what I see.'; break;
      case 'hunt': o = { type: 'hunt' }; accept = 'Hunting raiders. Mars is neutral, so we have to climb out of its airspace for that.'; break;
      case 'supply': o = { type: 'supply', depot: this._local(PLACES.find((p) => p.id === 'depot').x, PLACES.find((p) => p.id === 'depot').z) }; accept = 'Supply run to the depot and back.'; break;
      case 'goto': {
        if (String(args.id).startsWith('sp:') && this.ship.space) {
          // a course to another world: the nav computer plots it, the pilot says it and flies it (src/space/spaceTrip.js)
          const r = this.ship.space.engage(args.id.slice(3), { by: m.name });
          return r.ok ? { ok: true, msg: r.msg } : { ok: false, msg: `${m.name}: ${r.msg}` };
        }
        const pl = this.places().find((p) => p.id === args.id);
        if (!pl) return { ok: false, msg: 'Unknown place.' };
        if (!pl.ok || !pl.world) return { ok: false, msg: `${m.name}: ${pl.name} is ${this._fmtDist(pl.distM)} away. At cruise that is ${this._fmtEta(pl.etaS)}. We cannot make that trip yet.` };
        o = { type: 'goto', target: pl.world, land: pl.land, agl: pl.agl, name: pl.name }; accept = `Course set for ${pl.name}.`; break;
      }
      default: return { ok: false, msg: 'No such order.' };
    }
    // a small delay while they think it over, then they act
    this.pending = { o, t: this.time + thinkDelay(m.def.skill) * 0.6, m };
    this.say(m, accept);
    return { ok: true, msg: accept };
  }

  cancelOrder(msg) { if (this.ap) this.ap.setOrder({ type: 'hold' }); this.pending = null; if (msg) { const m = this.flyer(); if (m) this.say(m, msg); } }
  _fmtDist(d) { return d >= 1000 ? `${(d / 1000).toFixed(d > 10000 ? 0 : 1)} km` : `${Math.round(d)} m`; }
  _fmtEta(s) { return s > 5400 ? `${(s / 3600).toFixed(0)} hours` : s > 90 ? `${Math.round(s / 60)} minutes` : `${Math.round(s)} seconds`; }

  // =========================================================================
  // PER FRAME
  // =========================================================================
  /** Called by the ship before it steps the flight: the NPC pilot's hands. Returns controls or null. */
  pilotControls(dt) {
    if (this.pending && this.time >= this.pending.t) {
      const p = this.pending; this.pending = null;
      if (this.flyer()) { this._ensureAP(); this.ap.skill = this.flyer().def.skill; this.ap.setOrder(p.o); }
    }
    const m = this.flyer();
    if (!m || !this.ap) { if (this.hasOrder()) this.ap.setOrder({ type: 'hold' }); return null; }
    if (this.hasOrder() && this.ap.done) this.ap.order = { type: 'hold' };       // finished: no order any more
    if (!this.hasOrder()) { this._flushAP(m); return null; }
    const f = this.ship.flight;
    // The crew will not lift off until the player is aboard and the crew have found their stations.
    if (f.landed) {
      const walking = this.hiredList().some((x) => !x.seated && !x.displaced && x.mode !== 'standby' && x.mode !== 'leaving');
      if (!this.ship.aboard) { this.ap.setOrder({ type: 'hold' }); this.say(m, LINES.needYou(m.name).replace(`${m.name}: `, '')); return null; }
      if (walking && this.time - this.hiredAt < 40) { if (this.time - (this._settleSay || -99) > 12) { this._settleSay = this.time; this.say(m, LINES.settle(m.name).replace(`${m.name}: `, '')); } return null; }
    }
    this.ap.skill = m.def.skill;
    const c = this.ap.update(dt);
    this._flushAP(m);
    return c;
  }
  _flushAP(m) { for (const line of this.ap.drain()) this.say(/^(Nav|Pilot):/.test(line) ? this._navOr(m) : m, line.replace(/^(Nav|Pilot): /, '')); }
  _navOr(m) { return this.seatedMember('nav') || m; }

  /** Called every frame (after the flight has stepped and the person has moved). */
  update(dt) {
    this.time += dt;
    const ship = this.ship;
    for (const m of this.members.values()) {
      if (!m.person.loaded) continue;
      this._tickMember(m, dt);
      this._place(m, dt);
    }
    this._guns(dt);
    const comms=this.seatedMember('comms');
    if(comms && this.time-(comms.channelAt||0)>30) {
      comms.channelAt=this.time;
      const e=this.world?.state.economy || this.account;
      this.say(comms,`Channel watch: ${this.ship.drones?.neutral===false?'outside neutral airspace':'port frequency clear'}. Account ${e.marks} marks. ${Object.values(e.quests).filter(q=>q.status==='active').length} open jobs.`);
    }
  }

  _tickMember(m, dt) {
    const f = this.ship.flight;
    switch (m.mode) {
      case 'idle': this._idleAtPort(m, dt); break;
      case 'boarding': this._boarding(m, dt); break;
      case 'walk': this._walkRoute(m, dt); break;
      case 'sit': this._sitting(m, dt); break;
      case 'standby': { m.person.play('Idle'); break; }
      case 'leaving': this._leaving(m, dt); break;
      default: break;
    }
  }

  // ---- at the port ---------------------------------------------------------------------------------------
  _idleAtPort(m, dt) {
    m.person.play('Idle');
    // turn to the player when they are close, back to the board when they are not
    const p = this.walker.worldPos, d = Math.hypot(p.x - m.gpos.x, p.y - m.gpos.y, p.z - m.gpos.z);
    const toward = d < 9 ? p : this._local(HIRE_FACE.x, HIRE_FACE.z);
    const want = this._tangent(m.gpos, { x: toward.x - m.gpos.x, y: toward.y - m.gpos.y, z: toward.z - m.gpos.z });
    const k = Math.min(1, dt * 3);
    m.face = this._tangent(m.gpos, { x: m.face.x + (want.x - m.face.x) * k, y: m.face.y + (want.y - m.face.y) * k, z: m.face.z + (want.z - m.face.z) * k });
  }

  _rampTip() {
    const st = this.ship.state.ramps.cargo, r = this.ship.def.ramps.cargo, run = r.length * Math.cos(st.angle), along = run - 0.35;
    return { x: r.hinge.x, y: r.hinge.y - along * Math.tan(st.angle), z: r.hinge.z + along, foot: r.hinge.z + run + 0.9 };
  }

  _walkGround(m, target, dt, speed) {
    const p = m.gpos, d = { x: target.x - p.x, y: target.y - p.y, z: target.z - p.z };
    const t = this._tangent(p, d), u = this._up(p), k = d.x * u.x + d.y * u.y + d.z * u.z;
    const dist = Math.hypot(d.x - u.x * k, d.y - u.y * k, d.z - u.z * k);
    if (dist < 0.04) return dist;
    const step = Math.min(dist, speed * dt);
    p.x += t.x * step; p.y += t.y * step; p.z += t.z * step;
    const r = Math.hypot(p.x, p.y, p.z), g = this.ground(p.x / r, p.y / r, p.z / r);
    p.x *= g / r; p.y *= g / r; p.z *= g / r;
    const turn = Math.min(1, dt * 7);
    m.face = this._tangent(p, { x: m.face.x + (t.x - m.face.x) * turn, y: m.face.y + (t.y - m.face.y) * turn, z: m.face.z + (t.z - m.face.z) * turn });
    return dist - step;
  }

  _boarding(m, dt) {
    const ship = this.ship, st = ship.state.ramps.cargo, f = ship.flight;
    if (!st.lowered) {
      // the ramp is up: wait where we are, and say so now and then
      m.person.play('Idle');
      if (this.time - m.waitNote > 20) { m.waitNote = this.time; this.say(m, LINES.noRamp(m.name).replace(`${m.name}: `, '')); }
      return;
    }
    const tip = this._rampTip();
    const footW = f.toWorld({ x: tip.x, y: tip.y - 0.4, z: tip.foot }, {});
    const r = Math.hypot(footW.x, footW.y, footW.z), g = this.ground(footW.x / r, footW.y / r, footW.z / r);
    const foot = { x: footW.x / r * g, y: footW.y / r * g, z: footW.z / r * g };
    const left = this._walkGround(m, foot, dt, m.walkSpeed);
    m.person.play('Walk'); m.speedNow = m.walkSpeed;
    if (left < 0.25) {
      // the foot of the ramp: step from the planet onto the ship, as the player does
      m.sw.place(tip.x, tip.y, tip.z + 0.25, Math.PI);          // facing the bow, inboard
      m.sw.yaw = 0;
      const seat = this._seat(m);
      m.route = routeToSeat(m.sw, { x: tip.x, y: tip.y, z: tip.z }, seat);
      m.rw = null; m.place = 'ship'; m.mode = 'walk';
      this._attachVisual(m);
      if (!m.route) { m.mode = 'standby'; this.say(m, 'I cannot find a way to my station. I will wait here.'); }
    }
  }

  _walkRoute(m, dt) {
    const sw = m.sw;
    if (!m.rw || m.rw.route !== m.route) m.rw = new RouteWalker(sw, m.route, m.walkSpeed);
    if (m.rw.done) {
      // arrived: sit
      m.mode = m.mode === 'leaving' ? 'leaving' : 'sit'; m.sitT = 0; m.sitFrom = { x: sw.x, y: sw.y, z: sw.z, yaw: sw.yaw };
      return;
    }
    m.rw.step(dt);
    m.speedNow = m.rw.speed;
    m.person.play(m.rw.speed > 0.25 ? 'Walk' : 'Idle');
  }

  _sitting(m, dt) {
    const seat = this._seat(m);
    m.sitT = Math.min(1, m.sitT + dt / 0.55);
    if (m.sitT >= 1 && !m.seated) {
      m.seated = true; m.person.play('Sit', 0.15);
      if (m.def.seat === 'pilot' || m.def.seat === 'captain') this._ensureAP();
      if (this.seatedMember('pilot') || this.seatedMember('captain')) { /* ready */ }
    }
    if (m.sitT < 1) m.person.play('Sit', 0.2);
    m.speedNow = 0;
  }

  _leaving(m, dt) {
    const ship = this.ship;
    if (m.place === 'ship') {
      // from the seat or wherever, to the ramp and off: replan once
      if (!m.route) {
        const seat = this._seat(m), tip = this._rampTip();
        const from = m.seated ? this._standOff(m, seat) : { x: m.sw.x, y: m.sw.y, z: m.sw.z };
        m.sw.place(from.x, from.y, from.z, m.sw.yaw);
        m.seated = false; m.displaced = false;
        const back = routeToSeat(m.sw, from, { id: 'tip', x: tip.x, y: tip.y, z: tip.z + 0.5, yaw: 180, room: this.ship.roles.cargo });
        m.route = back || [{ type: 'walk', pts: [{ x: tip.x, y: tip.y, z: tip.z }] }];
        m.rw = null;
      }
      if (!m.rw || m.rw.route !== m.route) m.rw = new RouteWalker(m.sw, m.route, m.walkSpeed);
      if (!m.rw.done) { m.rw.step(dt); m.speedNow = m.rw.speed; m.person.play(m.rw.speed > 0.25 ? 'Walk' : 'Idle'); return; }
      // at the ramp tip: step down onto the apron
      const tip = this._rampTip(), w = ship.flight.toWorld({ x: tip.x, y: tip.y - 0.3, z: tip.foot }, {});
      const r = Math.hypot(w.x, w.y, w.z), g = this.ground(w.x / r, w.y / r, w.z / r);
      m.gpos = { x: w.x / r * g, y: w.y / r * g, z: w.z / r * g };
      m.place = 'ground'; m.route = null; this._attachVisual(m);
      return;
    }
    // on the ground: back to the hire spot
    const s = HIRE_SPOTS[m.id], tgt = this._local(s.x, s.z);
    const left = this._walkGround(m, tgt, dt, m.walkSpeed);
    m.person.play(left > 0.2 ? 'Walk' : 'Idle'); m.speedNow = m.walkSpeed;
    if (left < 0.2) { m.status = 'candidate'; m.mode = 'idle'; m.dismissing = false; }
  }
  _standOff(m, seat) {
    const sp = routeToSeat; // (no-op reference keeps the import used in one place)
    const yaw = seat.yaw * Math.PI / 180, fwd = { x: Math.sin(yaw), z: -Math.cos(yaw) };
    return { x: seat.x - fwd.x * 0.9, y: seat.y, z: seat.z - fwd.z * 0.9 };
  }

  // ---- the player takes (or gives back) a seat -----------------------------------------------------------
  /** The player sat down at a seat: whoever was there gets up. */
  onPlayerSit(seatId) {
    const m = [...this.members.values()].find((q) => q.status === 'hired' && q.def.seat === seatId && (q.seated || q.mode === 'sit'));
    if (!m) return;
    m.displaced = true; m.seated = false; m.mode = 'standby';
    const seat = this._seat(m);
    const yaw = seat.yaw * Math.PI / 180, fwd = { x: Math.sin(yaw), z: -Math.cos(yaw) }, rgt = { x: Math.cos(yaw), z: Math.sin(yaw) };
    // beside the seat, on a free spot
    m.sw.place(seat.x, seat.y, seat.z, yaw);
    for (const [a, b] of [[0.9, 0], [-0.9, 0], [0, 0.9], [0.6, 0.6], [-0.6, 0.6], [1.2, 0], [0, 1.3]]) {
      const x = seat.x - fwd.x * b + rgt.x * a, z = seat.z - fwd.z * b + rgt.z * a;
      const s = m.sw.canStand(x, seat.y, z);
      if (s) { m.sw.place(x, s.floor, z, Math.atan2(seat.x - x, -(seat.z - z))); break; }
    }
    if (m.def.seat === 'pilot' || m.def.seat === 'captain') {
      if (this.ap && !this.flyer()) { this.ap.setOrder({ type: 'hold' }); this.pending = null; }
    }
    this.say(m, 'All yours, boss.');
  }

  /** The player stood up: whoever was displaced goes back to the seat. */
  onPlayerStand(seatId) {
    const m = [...this.members.values()].find((q) => q.status === 'hired' && q.def.seat === seatId && q.displaced);
    if (!m) return;
    m.displaced = false;
    const seat = this._seat(m);
    m.route = routeToSeat(m.sw, { x: m.sw.x, y: m.sw.y, z: m.sw.z }, seat) || [];
    m.rw = null; m.mode = 'walk'; m.seated = false;
  }

  // ---- showing them ------------------------------------------------------------------------------------------
  _place(m, dt) {
    const g = m.person.group;
    if (m.place === 'ground') {
      if (!m.entry) return;
      Object.assign(m.entry.worldPos, m.gpos);
      const u = this._up(m.gpos), f = this._tangent(m.gpos, m.face);
      const xa = new THREE.Vector3().crossVectors(new THREE.Vector3(u.x, u.y, u.z), new THREE.Vector3(f.x, f.y, f.z)).normalize();
      m.entry.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xa, new THREE.Vector3(u.x, u.y, u.z), new THREE.Vector3(f.x, f.y, f.z)));
      g.visible = true;
      m.person.update(dt, m.mode === 'idle' ? 0 : (m.speedNow || m.walkSpeed));
      return;
    }
    // aboard: ship-local
    const seat = this._seat(m);
    if (m.mode === 'sit') {
      const t = m.sitT, e = t * t * (3 - 2 * t), pan = PAN[seat.id] || 0.5;
      let yaw = seat.yaw * Math.PI / 180;
      const a = this.ship.guns.aim;
      if (seat.id === 'gun_dorsal') yaw += a.dorsal.yaw; else if (seat.id === 'gun_ventral') yaw += a.ventral.yaw;
      const from = m.sitFrom || { x: seat.x, y: seat.y, z: seat.z, yaw };
      const bx = seat.x + Math.sin(yaw) * 0.04, bz = seat.z - Math.cos(yaw) * 0.04;
      g.position.set(from.x + (bx - from.x) * e, from.y + (seat.y + pan * e - from.y) * e, from.z + (bz - from.z) * e);
      g.rotation.set(0, Math.PI - (from.yaw + wrapPI(yaw - from.yaw) * e), 0);
      m.person.update(dt, 0);
      m.sw.x = seat.x; m.sw.y = seat.y; m.sw.z = seat.z;
    } else {
      g.position.set(m.sw.x, m.sw.y, m.sw.z);
      g.rotation.set(0, Math.PI - m.sw.yaw, 0);
      m.person.update(dt, m.speedNow || 0);
    }
  }

  /** Called once the ship has decided which rooms are drawn: hide the people in the ones that are not. */
  applyVisibility(set, interiorVisible) {
    for (const m of this.members.values()) {
      if (m.place !== 'ship') continue;
      const seat = this._seat(m);
      let room = (m.mode === 'sit') ? seat.room : m.sw.zoneRoom;
      if (room === 'stair_cargo' || room === 'ramp_cargo') room = this.ship.roles.cargo;
      const known = room && this.ship.interior.rooms.has(room);
      m.person.group.visible = interiorVisible && (!known || set.has(room));
    }
  }

  /** Ship-local positions of the crew who are on their feet, so a door opens for them as for the player. */
  actors() {
    const out = [];
    for (const m of this.members.values()) if (m.place === 'ship' && m.mode !== 'sit' && m.mode !== 'standby') out.push({ x: m.sw.x, y: m.sw.y, z: m.sw.z });
    return out;
  }

  // ---- guns ----------------------------------------------------------------------------------------------------------
  _guns(dt) {
    const ship = this.ship, D = ship.drones;
    const f = ship.flight;
    const manned = [];
    for (const m of this.members.values()) {
      if (m.status !== 'hired' || !m.seated || m.displaced) continue;
      if (m.def.seat === 'gun_dorsal') manned.push([m, 'dorsal']);
      if (m.def.seat === 'gun_ventral') manned.push([m, 'ventral']);
    }
    const mg = this.mainGunner();
    if (mg) manned.push([mg, 'main']);
    for (const [m, gun] of manned) {
      if (!m.gunners) m.gunners = {};
      const ai = m.gunners[gun] || (m.gunners[gun] = new GunnerAI({ guns: ship.guns, flight: f, gunId: gun, skill: m.def.skill, rand: this.rand }));
      ai.update(dt, D);
    }
  }

  /** The bolts' events came by: a drone going down is worth a word. */
  onGunEvents(events) {
    for (const e of events) {
      if (e.type === 'target_down' && /VEH/.test(e.id || '')) {
        this.kills++;
        const m = this.seatedMember('gun_dorsal') || this.seatedMember('gun_ventral') || this.mainGunner();
        if (m) this.say(m, this.kills % 3 === 0 ? 'That is another one down.' : 'Drone down.');
      }
    }
  }

  /** The navigator's report: where we are and what is around us, from the ship's own instruments. */
  report(m) {
    const f = this.ship.flight, D = this.ship.drones, g = f.geodetic;
    const alt = Math.round(f.agl), lines = [];
    lines.push(f.landed ? 'We are on the ground.' : `${alt} m above the ground, ${Math.round(f.groundSpeed)} m/s over it.`);
    if (g) lines.push(`Position ${Math.abs(g.lat).toFixed(2)}${g.lat < 0 ? 'S' : 'N'} ${Math.abs(g.lon).toFixed(2)}${g.lon < 0 ? 'W' : 'E'}.`);
    if (D) {
      if (D.neutral) lines.push('Inside Mars neutral airspace: no raiders, nothing firing.');
      else {
        const live = D.drones.filter((d) => d.state !== 'away' && d.state !== 'dead' && d.target.hp > 0);
        const near = live.map((d) => Math.hypot(d.pos.x - f.pos.x, d.pos.y - f.pos.y, d.pos.z - f.pos.z)).sort((a, b) => a - b)[0];
        lines.push(live.length ? `${live.length} raider${live.length > 1 ? 's' : ''} on the scope, nearest ${Math.round(near)} m.` : 'Outside the neutral line. The scope is clear for now.');
      }
    }
    lines.push(`Hull ${Math.round(f.hull)}%, shield ${Math.round(f.shield)} of ${Math.round(f.shieldMax)}.`);
    const t = this.ship.state && this.ship.state.ramps.cargo.lowered ? 'The ramp is down.' : 'The ramp is up.';
    lines.push(t);
    const text = lines.join(' ');
    this.say(m, text);
    return text;
  }

  // ---- dev / validator ------------------------------------------------------------------------------------------------
  snapshot() {
    return [...this.members.values()].map(m=>({id:m.id,status:m.status,place:m.place,mode:m.mode,
      gpos:{...m.gpos},face:{...m.face},seated:m.seated,sitT:m.sitT,sitFrom:m.sitFrom,
      displaced:m.displaced,dismissing:!!m.dismissing,sw:{x:m.sw.x,y:m.sw.y,z:m.sw.z,yaw:m.sw.yaw}}));
  }
  restore(records) {
    for(const r of records || []) {
      const m=this.members.get(r.id);if(!m)continue;
      for(const k of ['status','place','mode','gpos','face','seated','sitT','sitFrom','displaced','dismissing'])m[k]=r[k];
      m.sw.place(r.sw.x,r.sw.y,r.sw.z,r.sw.yaw);
      if(m.mode==='walk')m.route=routeToSeat(m.sw,r.sw,this._seat(m)) || [];
      if(m.mode==='sit' && !m.sitFrom)m.sitFrom={...r.sw};
      this._attachVisual(m);
    }
  }
  leaveIfUnpaid() {
    const e=this.world?.state.economy || this.account, f=this.ship.flight,p=this.site.toLocal(f.pos);
    if(!f.landed||Math.hypot(p.x,p.z)>140)return;
    for(const [id,c] of Object.entries(e.crew))if(c.unpaid&&!this.members.get(id)?.dismissing) {
      const m=this.members.get(id);const r=this.dismiss(id);
      if(r.ok)this.say(m,'My wage was unpaid. I am leaving at this port; a new contract needs a new signing fee.');
    }
  }
  /** Hire everybody and finish boarding at once (screenshots and tests). */
  debugCrewUp(ids) {
    for (const id of ids || this.posts.map((p) => p.id)) this.hire(id);
  }
}
