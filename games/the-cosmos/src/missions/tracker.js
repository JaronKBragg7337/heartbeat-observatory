// ============================================================================
// missions/tracker.js - the browser's side of the jobs (catalog.js, server/missions.mjs): it reads the shared world's snapshot, says the story's new lines as
// they arrive (the ship's message line), writes the plain NEXT line, and points the goal arrow at the place the current step asks for. It owns no state that
// matters: the server holds the job, a refresh puts you back on it. A shared world only (a solo world has no jobs).
// ============================================================================
import { missionById, MISSIONS, unlocked } from './catalog.js';
import { resolve, toWorldPos, worldIdOfFrame, personById } from './where.js';
import { DESKS, deskOfFrame } from './desk.js';
import { GoalHint } from '../ui/goalHint.js';
import { syncProps } from './props.js';

export class MissionTracker {
  /** o: { world, space, portSite, engine, note(text, important) } */
  constructor(o) { Object.assign(this, o); this.hint = new GoalHint(o.engine); this.seen = null; }
  rec() { const w = this.world; if (!w.remote || !w.snapshot) return null; return (w.snapshot.missions || {})[w.playerId] || null; }
  me() { const w = this.world; return w.remote && w.snapshot ? w.snapshot.players[w.playerId] : null; }
  active() { const r = this.rec(); if (!r || !r.active) return null; const m = missionById(r.active.id); return m ? { m, step: m.steps[r.active.step], index: r.active.step, carry: r.active.carry } : null; }

  /** Per frame: the story's new lines (never replayed after a refresh), and the arrow. `quiet`: a drained lifeboat has its own arrow. */
  tick(dt, quiet = false) {
    const r = this.rec(), p = this.me();
    this._pt = (this._pt || 0) + dt; if (this._pt > 1 && this.world.snapshot) { this._pt = 0; try { syncProps(this.space, this.world.snapshot); } catch (e) { if (!this._pe) { this._pe = 1; console.error('mission props', e); } } }       // what the jobs have built, for everyone
    if (r) {
      if (this.seen === null) this.seen = r.n;                              // the first look after a load: whatever is already said stays said
      for (const l of r.log) if (l.n > this.seen) { if (l.kind !== 'next') this.note(l.kind === 'pay' ? l.text : l.text, l.kind !== 'accept'); this.seen = Math.max(this.seen, l.n); }
      this.seen = Math.max(this.seen, r.n);
    }
    let goal = null;
    const a = this.active();
    if (!quiet && a && a.step && p && !(p.opening && !p.opening.complete) && !this.shipSystem?.aboard) {
      const place = this._target(a.step);
      if (place && place.frame === this.space.frameId) { const target = toWorldPos(place, this.portSite); if (target) goal = { id: a.m.id + a.index, label: a.step.text, target, reach: Math.max(8, (a.step.r || 8) * 0.8), onPlanet: true }; }
    }
    this.hint.update(dt, goal);
  }
  /** The place a step points at, resolved, or null (a landing, a haul and a hire point nowhere). */
  _target(step) {
    if (step.k === 'go' || step.k === 'choose') return resolve(step.to);
    if (step.k === 'give' && step.to) return resolve(step.to);
    return null;
  }

  /** The plain next step for the status card: { text } or null. world: this player's current world id. */
  nextGoal(ship) {
    const r = this.rec(), p = this.me(); if (!r || !p) return null;
    const a = this.active();
    if (a) {
      const carry = a.carry ? ` You are carrying ${a.carry.label}.` : '';
      return { text: `${a.m.title}: ${a.step.text}${carry}` };
    }
    const here = worldIdOfFrame(this.space.frameId);
    const open = MISSIONS.filter((m) => m.world === here && !r.done[m.id] && unlocked(m, r.done));
    if (!open.length) return null;
    const mine = (this.world.snapshot.roles && this.world.snapshot.roles.members || {})[this.world.playerId];
    const m = open.find((x) => !x.faction || x.faction === mine) || open.find((x) => x.oath) || open[0], who = personById(m.giver);
    return { text: `Work: ${who ? who.title + ' ' + who.name.replace(/^(Sergeant|Doctor|Commander|Quartermaster|Dock Master) /, '') : 'a person here'} has a job: "${m.title}". Walk up, tap Talk, then "Is there paid work for me?".` };
  }
  /** The hiring desk of the world the player stands on, or null (Mars has its Crew Hall). */
  deskHere() { return deskOfFrame(this.space.frameId); }
  /** The World / crew sheet: the current job, its steps, and a way to drop it. text(t), btn(label, action). */
  panel(text, btn) {
    const r = this.rec(); if (!r) return;
    const a = this.active();
    if (a) {
      text(`Job: ${a.m.title}${a.m.faction ? ` (${a.m.faction})` : ''}. ${a.m.brief}`);
      a.m.steps.forEach((st, i) => text(`${i < a.index ? '✓' : i === a.index ? '▶' : '·'} ${st.text}`));
      if (a.carry) text(`You are carrying ${a.carry.label}.`);
      btn('Drop this job', { type: 'mission-drop' });
    } else text('Jobs: no job right now. People with work say so in the Talk panel ("Is there paid work for me?").');
    const n = Object.keys(r.done).length; if (n) text(`Jobs done: ${n}. ${Object.entries(r.flags).map(([k, v]) => `${k}: ${v}`).join(' · ')}`.trim());
    const d = this.deskHere();
    if (d) text(`Hiring: ${personById(d.person)?.name || 'the dispatcher'} at ${d.name} has hands for hire (Talk, then "Hands for hire"). Your ship has to be landed here.`);
  }
}
