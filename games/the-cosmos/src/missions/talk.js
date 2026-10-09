// ============================================================================
// missions/talk.js - what a person says about work in the Talk panel (crewUI.js draws the panel; this file writes the part about jobs and hands for hire).
// Three pieces, all pure strings from the shared world's snapshot (no state of its own):
//   entry(person)   the buttons added under the person's ordinary conversation: "Is there paid work?", the answer a job asks of you, "Hands for hire".
//   view(person)    the 'work' view (the job they offer: what it is, what it pays, "I'll take it") and the 'hire' view (the desk's list).
//   voice(person)   the lines spoken when a view opens (the same text, from the person's own mouth when they have a voice).
// There is no approve screen: the job is the person's offer and your answer, the steps finish by arriving (src/missions/catalog.js).
// ============================================================================
import { offeredBy, missionById, payWords, stepsOf } from './catalog.js';
import { worldIdOfFrame } from './where.js';
import { deskOfPerson, handsOf } from './desk.js';
import { WAGES } from '../economy/catalog.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rec = (snap, pid) => (snap && snap.missions && snap.missions[pid]) || { active: null, done: {}, flags: {}, log: [], n: 0 };

/** The step the player is on, if it is a question put to this person. */
function askedOf(personId, r) {
  const a = r.active; if (!a) return null;
  const m = missionById(a.id), st = m && m.steps[a.step];
  return st && st.k === 'choose' && st.to === personId ? { m, st } : null;
}
/** Hands at this person's desk that nobody holds (the snapshot's pool carries who is hired). */
export function freeHandsOf(deskId, snap) {
  const ships = (snap && snap.ships) || {};
  const held = new Set(Object.values((snap && snap.pool) || {}).filter((c) => c.deskKey && c.shipId && !c.retired && ships[c.shipId]).map((c) => c.deskKey));
  return handsOf(deskId).filter((h) => !held.has(h.key));
}

/** { kind: 'ask' | 'offer' | 'busy' | null } what this person means for the player's jobs right now. */
export function standing(personId, snap, pid, frameId) {
  const r = rec(snap, pid), world = worldIdOfFrame(frameId);
  if (askedOf(personId, r)) return { kind: 'ask' };
  if (r.active) return { kind: 'busy', mission: missionById(r.active.id) };
  const offers = offeredBy(personId, world, r.done);
  return offers.length ? { kind: 'offer', offers } : { kind: null };
}

/** Buttons under the ordinary conversation (the main view). */
export function entry(personId, snap, pid, frameId) {
  const r = rec(snap, pid), s = standing(personId, snap, pid, frameId);
  let h = '';
  if (s.kind === 'ask') {
    const { st } = askedOf(personId, r);
    h += `<p class="say">${esc(st.ask)}</p>` + st.options.map((o) => `<button class="cbtn" data-a="mission-choose" data-o="${esc(o.id)}">${esc(o.label)}</button>`).join('');
  } else if (s.kind === 'offer') h += `<button class="cbtn" data-a="mission-ask">Is there paid work for me?<small>${esc(s.offers[0].title)}</small></button>`;
  else if (s.kind === 'busy' && s.mission) h += `<p class="stat">You are on a job: ${esc(s.mission.title)}. The World / crew sheet has the rest.</p>`;
  if (deskOfPerson(personId)) h += `<button class="cbtn" data-a="mission-hires">Hands for hire<small>Sign a hand on at this desk; they come aboard your landed ship</small></button>`;
  return h ? `<div class="col" style="margin-top:8px">${h}</div>` : '';
}

/** The 'work' and 'hire' views. Returns '' for any other view. */
export function view(personId, name, v, snap, pid, frameId) {
  const r = rec(snap, pid);
  if (v === 'work') {
    const s = standing(personId, snap, pid, frameId);
    let h = `<p class="stat">${esc(name)}</p><div class="col">`;
    if (s.kind === 'offer') {
      const m = s.offers[0];
      h += `<div class="say">${esc(m.pitch)}</div><p class="stat">${esc(m.title)} · ${esc(payWords(m))}</p>`;
      if (m.faction) h += `<p class="stat">${m.oath ? `This is ${esc(m.faction)}'s oath job: done in the open, it joins you to them.` : `A ${esc(m.faction)} job.`}</p>`;
      h += `<p class="stat">${esc(stepsOf(m)[0].text)}</p>`;
      h += `<button class="cbtn" data-a="mission-accept" data-m="${esc(m.id)}">I'll take it</button>`;
    } else if (s.kind === 'busy') h += `<div class="say">You already have work: ${esc(s.mission ? s.mission.title : 'a job')}. Finish it, or drop it in the World / crew sheet.</div>`;
    else h += `<div class="say">Nothing for you right now. Come back after you have done what you have been given.</div>`;
    return h + `<button class="cbtn" data-a="worker-back">Back to conversation</button><button class="cbtn" data-a="close">Goodbye</button></div>`;
  }
  if (v === 'hire') {
    const d = deskOfPerson(personId); if (!d) return '';
    const sh = snap && snap.ships && snap.players && snap.players[pid] && snap.ships[snap.players[pid].shipId];
    const have = new Set(((sh && sh.crew) || []).map((c) => c.role)), marks = sh ? sh.economy.marks : 0;
    let h = `<p class="stat">${esc(d.name)} · hands for hire · purse ${marks} marks</p><div class="col">`;
    const free = freeHandsOf(d.id, snap);
    if (!free.length) h += `<div class="say">Nobody on the list today: everyone is signed to a ship.</div>`;
    for (const x of free) {
      const fee = WAGES[x.role] * 4;
      h += `<p><b>${esc(x.name)}</b> · ${esc(x.role.replace('_', ' '))} · ${Math.round(x.skill * 100)}% · ${fee} marks signing, then ${fee} per Mars sol<br><span class="stat">${esc(x.pitch)}</span></p>`;
      h += `<button class="cbtn" data-a="desk-hire" data-k="${esc(x.key)}" ${have.has(x.role) || marks < fee ? 'disabled' : ''}>${have.has(x.role) ? `You already have a ${esc(x.role.replace('_', ' '))}` : `Hire ${esc(x.name)} · ${fee} marks`}</button>`;
    }
    return h + `<button class="cbtn" data-a="worker-back">Back to conversation</button><button class="cbtn" data-a="close">Goodbye</button></div>`;
  }
  return '';
}

/** What is said when a view opens: [{ text }] (the caller adds the voice). */
export function lines(personId, v, snap, pid, frameId) {
  if (v !== 'work') return [];
  const s = standing(personId, snap, pid, frameId);
  return s.kind === 'offer' ? [{ text: s.offers[0].pitch }] : [];
}
