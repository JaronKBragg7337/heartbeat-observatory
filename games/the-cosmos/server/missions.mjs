// ============================================================================
// server/missions.mjs - the jobs and stories (src/missions/catalog.js), held and checked by the authority. Also the hiring desks of the worlds that are not
// Mars (src/missions/desk.js). BIBLE-v3 sections 10.2, 12, 13.2, 17: no approve button, no hand-in button; a step finishes when the world says it did.
//
// WHAT IS KEPT (in the world record, state.missions; the browser is sent only its own player's entry):
//   missions[playerId] = { active: null | { id, step, at, carry: null | { label }, s: {} }, done: { missionId: { at, option } }, flags: { missionId: optionId },
//                          log: [ { n, t, who, text, kind } ] (the last twelve lines the story said to this player), n: the last line's number }
//
// RULES, checked before anything changes (the authority rolls the whole action back on a refusal; a retried action id returns its first receipt):
//   * taking a job: you are on that job's world, you are standing at the giver (on foot), the job is unlocked, you are on no other job. A faction job needs the
//     faction, or is the faction's OATH job (the first of its thread): finished in the open, the oath joins you (or switches you) to that faction.
//   * steps: go (be there), land (the ship is down there), haul (the hold has it), give (hand over what the hold, the supplies or the hopper hold, mass books kept),
//     hire (the crew grows), choose (an option ends the job). Nothing is trusted from the browser except which option was picked.
//   * pay: credits to the flagship's account at the last step. Faction jobs move the world's balance and home strength (F4) and the player's standing (F5).
// COST: nothing here runs per tick for players with no job. step() checks each online player on a job twice a second.
// ============================================================================
import { MISSIONS, missionById, unlocked } from '../src/missions/catalog.js';
import { resolve, distanceTo, worldIdOfFrame, personById } from '../src/missions/where.js';
import { handsOf, deskOfFrame, handByKey } from '../src/missions/desk.js';
import { worldById } from '../src/roles/seats.js';
import { factionOfPlayer } from '../src/roles/holders.js';
import * as B from '../src/roles/balance.js';
import { takeMatter, lotKg } from '../src/economy/shops.js';
import { WAGES, SOL_SECONDS } from '../src/economy/catalog.js';
import { shipDef } from '../src/ships/registry.js';
import { GROUND_MATS } from '../src/missions/catalog.js';

const SCALE = 2 ** 96;
const big = (v) => BigInt(v * SCALE);
const sumBig = (lots, key) => lots.reduce((s, l) => s + big(l[key]), 0n);
const yes = (msg, extra = {}) => ({ ok: true, msg, ...extra });
const live = (c) => !String(c.status || '').startsWith('leaving');
export const MISSION_CFG = { stepS: 0.5, talkReach: 7, deskReach: 7, shipNearM: 900, portNearM: 600 };

/** Take `kg` of dug ground (any of `mats`) out of a hopper's lots. Splits the last lot; every part keeps its mix; the exact mass and volume come back so the books stay balanced. */
export function takeFromHopper(lots, mats, kg) {
  const ok = (l) => (l.parts && l.parts.length ? l.parts : [{ materialId: l.materialId }]).every((q) => mats.includes(q.materialId));
  const have = lots.filter(ok).reduce((s, l) => s + l.massKg, 0);
  if (have + 1e-6 < kg) return null;
  const remaining = structuredClone(lots), taken = []; let need = kg, n = 0;
  for (let i = 0; i < remaining.length && need > 1e-9; i++) {
    const l = remaining[i]; if (!ok(l)) continue;
    if (l.massKg <= need + 1e-9) { need -= l.massKg; taken.push(l); remaining.splice(i--, 1); continue; }
    const mass = need, ratio = mass / l.massKg, part = structuredClone(l);
    part.massKg = mass;
    for (const k of ['solidVolumeM3', 'looseVolumeM3']) if (k in l) { part[k] = l[k] * ratio; l[k] -= part[k]; }
    if (l.parts) { part.parts = l.parts.map((q) => ({ ...q, massKg: q.massKg * ratio, volumeM3: q.volumeM3 * ratio })); l.parts = l.parts.map((q, j) => ({ ...q, massKg: q.massKg - part.parts[j].massKg, volumeM3: q.volumeM3 - part.parts[j].volumeM3 })); }
    l.massKg -= mass; part.lotId = `${l.lotId || 'lot'}:job${++n}`; taken.push(part); need = 0;
  }
  return { remaining, taken, massExact: sumBig(lots, 'massKg') - sumBig(remaining, 'massKg'), volumeExact: sumBig(lots, 'solidVolumeM3') - sumBig(remaining, 'solidVolumeM3') };
}

export class MissionDirector {
  constructor(auth, cfg = {}) { this.auth = auth; this.cfg = { ...MISSION_CFG, ...cfg }; this.acc = 0; }
  get all() { return this.auth.state.missions; }
  get clock() { return this.auth.state.clock; }
  get roles() { return this.auth.roles; }
  ensureAll() { this.auth.state.missions = this.auth.state.missions || {}; }
  of(pid) { return (this.all[pid] ||= { active: null, done: {}, flags: {}, log: [], n: 0 }); }
  removePlayer(id) { delete this.all[id]; }
  say(pid, who, text, kind = 'story') {
    const r = this.of(pid); r.n++;
    r.log.push({ n: r.n, t: Math.round(this.clock), who, text, kind });
    if (r.log.length > 12) r.log.splice(0, r.log.length - 12);
  }
  flagship(p) { return this.auth.state.ships[p.shipId]; }
  sim(p) { const s = this.flagship(p); return s ? this.auth.sims.get(s.id) : null; }

  act(p, a) {
    switch (a.type) {
      case 'mission-accept': return this.accept(p, a);
      case 'mission-choose': return this.choose(p, a);
      case 'mission-drop': return this.drop(p);
      case 'desk-hire': return this.deskHire(p, a);
      default: throw Error('Unsupported job action: ' + a.type);
    }
  }

  // ---- taking a job ----------------------------------------------------------------------------------------------------------------------------------
  accept(p, a) {
    const m = missionById(a.id); if (!m) throw Error('There is no such job.');
    const r = this.of(p.id);
    if (r.active) throw Error(`You are already on a job: ${missionById(r.active.id)?.title || 'one'}. Finish it or drop it first.`);
    if (r.done[m.id]) throw Error('You have done that one.');
    if (!unlocked(m, r.done)) throw Error('Not yet: other jobs come first.');
    if (worldIdOfFrame(p.frameId) !== m.world) throw Error(`That job is on ${worldById(m.world)?.name || 'another world'}.`);
    if (p.aboardShipId) throw Error('Step off the ship and walk over to them first.');
    const giver = resolve(m.giver);
    if (distanceTo(giver, p.frameId, p.pose.worldPos, this.auth.site) > this.cfg.talkReach) throw Error('Walk over to them first.');
    const mem = factionOfPlayer(this.roles.roles, p.id);
    if (m.faction && mem && mem !== m.faction && !m.oath) throw Error(`You wear ${mem}'s badge. ${m.faction} gives its jobs to its own. Take their oath job first.`);
    r.active = { id: m.id, step: 0, at: Math.round(this.clock), carry: m.carry ? { label: m.carry } : null, s: {} };
    this.enter(p, r.active, m.steps[0]);
    this.say(p.id, giver.name || 'Them', m.take || 'Good.', 'accept');
    return yes(`${m.title}. ${m.steps[0].text}`, { mission: m.id });
  }
  drop(p) {
    const r = this.of(p.id); if (!r.active) throw Error('You are on no job.');
    const m = missionById(r.active.id); r.active = null;
    this.say(p.id, 'Job', `You dropped "${m?.title || 'the job'}". Whoever gave it to you will be there when you want it again.`, 'drop');
    return yes('Job dropped.');
  }

  // ---- steps -----------------------------------------------------------------------------------------------------------------------------------------
  /** A step has just become the current one: note what it measures against (a hire is a hand more than the crew had when it began). */
  enter(p, a, st) { const ship = this.flagship(p); a.s = {}; if (st && st.k === 'hire') a.s.base = (ship?.crew || []).filter(live).length; }
  /** One check of the player's current step. true when it is done (the caller moves on). */
  check(p, m, st, a) {
    const auth = this.auth, pos = p.pose.worldPos, frame = p.frameId, ship = this.flagship(p), sim = this.sim(p);
    const near = (to, r) => distanceTo(resolve(to), frame, pos, auth.site) <= r;
    switch (st.k) {
      case 'go':
        if (!near(st.to, st.r)) return false;
        if (st.carry) a.carry = { label: st.carry };
        if (st.drop) a.carry = null;
        return true;
      case 'land': {
        if (!sim || !sim.flight.landed || sim.frameId !== st.frame) return false;
        if (st.near === 'port') { const l = auth.site.toLocal(sim.flight.pos); if (Math.hypot(l.x, l.z) > this.cfg.portNearM) return false; }
        return true;
      }
      case 'haul': return !!ship && (ship.hold[st.item] || 0) + 1e-6 >= st.kg;
      case 'hire': {
        const n = (ship?.crew || []).filter(live).length;
        if (a.s.base === undefined) a.s.base = n;
        return n >= a.s.base + (st.n || 1);
      }
      case 'give': return this.give(p, m, st, a, near(st.to, st.r));
      case 'choose': return false;
      default: return false;
    }
  }
  /** Hand over what the step asks for, if the player is there and has it. Changes nothing and returns false otherwise. */
  give(p, m, st, a, there) {
    if (!there) return false;
    const ship = this.flagship(p), sim = this.sim(p), e = ship.economy;
    if (st.from === 'supply') {
      if ((e.inventory[st.item] || 0) < st.n) return false;
      e.inventory[st.item] -= st.n; return true;
    }
    if (st.from === 'hold') {
      if (!sim || !sim.flight.landed || sim.frameId !== p.frameId) return false;
      const d = Math.hypot(sim.flight.pos.x - p.pose.worldPos.x, sim.flight.pos.y - p.pose.worldPos.y, sim.flight.pos.z - p.pose.worldPos.z);
      if (d > this.cfg.shipNearM) return false;
      if ((ship.hold[st.item] || 0) + 1e-6 < st.kg) return false;
      ship.holdLots = ship.holdLots || [];
      if (lotKg(ship.holdLots, st.item) > 0) {              // matter dug on the ground: the exact lots go to the one who asked, the books stay balanced
        if (lotKg(ship.holdLots, st.item) + 1e-6 < st.kg) return false;
        const t = takeMatter(ship.holdLots, st.item, st.kg, 'job');
        ship.holdLots = t.remaining;
        e.depotLots = e.depotLots || []; e.depotLots.push(...t.taken);
        e.exportedMassExact = String(BigInt(e.exportedMassExact || '0') + t.massExact);
        e.exportedVolumeExact = String(BigInt(e.exportedVolumeExact || '0') + t.volumeExact);
      }
      ship.hold[st.item] = Math.max(0, (ship.hold[st.item] || 0) - st.kg);
      return true;
    }
    if (st.from === 'hopper') {
      const mats = GROUND_MATS[st.mats] || [st.mats];
      const t = takeFromHopper(p.carried || [], mats, st.kg);
      if (!t) return false;
      p.carried = t.remaining;
      e.questLots = e.questLots || []; e.questLots.push(...t.taken);
      e.exportedMassExact = String(BigInt(e.exportedMassExact || '0') + t.massExact);
      e.exportedVolumeExact = String(BigInt(e.exportedVolumeExact || '0') + t.volumeExact);
      return true;
    }
    return false;
  }

  /** Move a player's job along as far as the world lets it. */
  progress(p) {
    const r = this.all[p.id], a = r && r.active; if (!a) return;
    const m = missionById(a.id); if (!m) { r.active = null; return; }
    for (let guard = 0; r.active && guard < 8; guard++) {
      const st = m.steps[a.step];
      if (!st) { this.finish(p, m, null); return; }
      if (!this.check(p, m, st, a)) return;
      if (st.beat) this.say(p.id, 'Story', st.beat, 'beat');
      a.step++;
      if (a.step >= m.steps.length) { this.finish(p, m, null); return; }
      this.enter(p, a, m.steps[a.step]);
      if (m.steps[a.step].k === 'choose') { this.say(p.id, 'Job', m.steps[a.step].text, 'next'); return; }
      this.say(p.id, 'Job', m.steps[a.step].text, 'next');
    }
  }
  choose(p, a) {
    const r = this.of(p.id), act = r.active; if (!act) throw Error('You are on no job.');
    const m = missionById(act.id), st = m.steps[act.step];
    if (!st || st.k !== 'choose') throw Error('Nothing is asking you anything right now.');
    if (p.aboardShipId) throw Error('Step off the ship and walk over to them first.');
    if (distanceTo(resolve(st.to), p.frameId, p.pose.worldPos, this.auth.site) > st.r + 2) throw Error('Walk over to them first.');
    const o = st.options.find((q) => q.id === a.option); if (!o) throw Error('That is not one of the answers.');
    this.finish(p, m, o);
    return yes(o.beat, { mission: m.id, option: o.id });
  }

  /** The last step is done: pay, move the world's meters, remember the story. */
  finish(p, m, opt) {
    const r = this.of(p.id), ship = this.flagship(p), o = opt || {}, w = worldById(m.world), roles = this.roles;
    const credits = o.pay ?? m.pay, side = o.side ?? m.side, size = o.size ?? m.size ?? 1;
    this.auth.award(ship, credits);
    if (m.oath && m.faction && factionOfPlayer(roles.roles, p.id) !== m.faction) { try { roles.joinFaction(p, { faction: m.faction }); } catch { /* already with them */ } }
    const mine = factionOfPlayer(roles.roles, p.id), h = roles.homes[m.world];
    if (h && w && side !== 'port') {
      if (side === 'home' && mine && w.factions.includes(mine)) B.applyJob(h, 'home', m.trade || 'wealth', size);
      else if (side === 'joint') B.applyJob(h, 'joint', m.trade || 'wealth', size);
      if (o.rep) for (const [f, n] of Object.entries(o.rep)) roles._addRep(p.id, f, n);
      else if (side === 'home' && mine) roles._addRep(p.id, mine, 2 * size);
      else if (side === 'joint') for (const f of w.factions) roles._addRep(p.id, f, 1 * size);
    }
    if (m.build && h) { h.built = h.built || {}; h.built[m.build.key] = (h.built[m.build.key] || 0) + m.build.kg; }       // a thing left standing for everyone to see (src/missions/props.js)
    roles._progress(p.id, size);
    r.done[m.id] = { at: Math.round(this.clock), option: o.id || null };
    if (o.flag) r.flags[m.id] = o.flag;
    r.active = null;
    if (o.beat) this.say(p.id, 'Story', o.beat, 'beat');
    this.say(p.id, personById(m.giver)?.name || 'Them', m.done, 'done');
    this.say(p.id, 'Pay', `${m.title}: ${credits} credits paid.`, 'pay');
  }

  // ---- time ------------------------------------------------------------------------------------------------------------------------------------------
  step(dt, { catchUp = false } = {}) {
    if (catchUp) return;
    this.acc += dt; if (this.acc < this.cfg.stepS) return;
    this.acc = 0;
    for (const [pid, r] of Object.entries(this.all)) {
      if (!r.active || !this.auth.sessions.has(pid)) continue;
      const p = this.auth.state.players[pid]; if (!p || (p.opening && !p.opening.complete)) continue;
      this.progress(p);
    }
  }

  // ---- the hiring desks ------------------------------------------------------------------------------------------------------------------------------
  /** Who is on a desk's list right now: the hands nobody holds. */
  freeHands(deskId) {
    const held = new Set(Object.values(this.auth.state.pool).filter((c) => c.deskKey && c.shipId && !c.retired && this.auth.state.ships[c.shipId]).map((c) => c.deskKey));
    return handsOf(deskId).filter((h) => !held.has(h.key));
  }
  deskHire(p, a) {
    const desk = deskOfFrame(p.frameId); if (!desk) throw Error('There is no hiring desk here: the Crew Hall at Marineris Port is the hall for Mars.');
    if (p.aboardShipId) throw Error('Step off the ship and walk to the desk first.');
    if (distanceTo(resolve(desk.person), p.frameId, p.pose.worldPos, this.auth.site) > this.cfg.deskReach) throw Error('Walk over to the desk first.');
    const s = this.flagship(p); this.auth.owner(p, s);
    const sim = this.auth.sims.get(s.id);
    if (!sim || !sim.flight.landed || sim.frameId !== p.frameId) throw Error('Your ship has to be landed here for a hand to come aboard.');
    if (Math.hypot(sim.flight.pos.x - p.pose.worldPos.x, sim.flight.pos.y - p.pose.worldPos.y, sim.flight.pos.z - p.pose.worldPos.z) > this.cfg.shipNearM) throw Error('Your ship has to be landed at the settlement.');
    const hand = handByKey(a.key); if (!hand || hand.desk !== desk.id) throw Error('Nobody by that name is on this list.');
    if (!this.freeHands(desk.id).some((h) => h.key === hand.key)) throw Error('Someone else already hired them.');
    const def = shipDef(s.type), post = def.crewPosts.find((c) => c.id === hand.role), seat = post && def.seats.find((q) => q.id === post.seat);
    if (!seat) throw Error(`A ${def.class} has no station for a ${hand.role}.`);
    if (s.crew.some((c) => c.role === hand.role && live(c))) throw Error('That post is already filled.');
    const fee = WAGES[hand.role] * 4;
    if (s.economy.marks < fee) throw Error(`Signing fee is ${fee} marks. You cannot afford it yet.`);
    s.economy.marks -= fee; s.economy.payrollMarks += fee;
    const st = this.auth.state, id = 'hand-' + (++st.poolSeq), wage = WAGES[hand.role];
    st.pool[id] = { id, role: hand.role, name: hand.name, personId: hand.personId, skill: hand.skill, wageCredits: wage, shipId: s.id, status: 'hired', position: { x: 0, y: 0, z: 0 }, refillAt: st.clock, deskKey: hand.key };
    s.crew.push({ id, role: hand.role, name: hand.name, personId: hand.personId, skill: hand.skill, wageCredits: wage, status: 'aboard', nextPay: st.clock + SOL_SECONDS, unpaid: false, seatPose: { ...seat }, groundRoute: [] });
    s.economy.crew[hand.role] = { nextPay: st.clock + SOL_SECONDS, unpaid: false };
    return yes(`${hand.name} signs on as your ${hand.role} (${fee} marks) and comes aboard.`, { id });
  }
}
