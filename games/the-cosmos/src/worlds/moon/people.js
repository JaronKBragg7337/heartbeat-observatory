// ============================================================================
// worlds/moon/people.js - the people of the Moon's settlements: the same Loft people the Mars port and the crew use (cached GLBs, one skinned rig each),
// dressed by F0's faction style (the uniform for their role; a duty helmet where they stand outdoors) and standing where cast.js puts them. They are the Talk
// targets: a person has the shape of a port worker ({ id, name, def: { title }, person, status: 'worker' }) so the Talk button (crewUI.js) treats them the same
// way; `talk` draws the panel, `act` handles its buttons, `speech` says what is spoken when each view opens (every line has a voice clip).
//
// SEAT PEOPLE: a body that holds an F5 seat shows the seat's NPC (name, temperament, voice, lines: roles/npcs.js). The server keeps only the humans, so the
// body does not change when a player takes the post; the buttons say what the seat is and ask for it (`role-take`).
// ============================================================================
import { personVisible } from '../../crew/personVisibility.js';
import { Person } from '../../crew/personRig.js';
import { factionLook, factionStyle } from '../../factions/registry.js';
import { npcFor, lineFor, TEMPERAMENTS } from '../../roles/npcs.js';
import { seatById } from '../../roles/seats.js';
import { GOODS } from '../../economy/catalog.js';
import { frameToOutpost } from './place.js';
import { layoutOf } from './layout.js';
import { ICE_PRICE, SHOPS, ICE_ITEM } from './trade.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FACE = { south: 0, east: Math.PI / 2, north: Math.PI, west: -Math.PI / 2 };
const BODIES = { f: ['ada', 'zuri', 'sunita'], m: ['isaiah', 'jorge', 'aoi'] };
const hash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return Math.abs(h); };

/** What a person is, resolved: seat people from F5, custom people as written. */
export function resolvePerson(p) {
  if (!p.seat) return { ...p, seatTitle: null };
  const seat = seatById(p.seat), npc = npcFor(p.seat), T = TEMPERAMENTS[npc.temperament];
  return { ...p, name: npc.name, voice: npc.voice, body: p.body || BODIES[T.gender][hash(p.seat) % 3],
    line: lineFor(p.seat, 'greet').text, answer: lineFor(p.seat, 'job').text,
    question: seat.tier === 'top' ? 'What do you do here?' : 'What is your job like?', reply: 'Understood.',
    tradeLine: lineFor(p.seat, 'job').text, seatInfo: { id: seat.id, tier: seat.tier, title: seat.title, asshole: npc.asshole, temperament: npc.temperament } };
}

export class MoonPeople {
  constructor(o) { this.root = o.root; this.library = o.people; this.space = o.space; this.pi = o.pi; this.worldId = o.worldId; this.members = []; this.built = false; this.layout = layoutOf(o.worldId); }

  async build() {
    if (this.built || !this.library) return this;
    this.built = true;
    const roster = await this.library.roster();
    let seq = 0;
    for (const raw of this.layout.PEOPLE) {
      const w = resolvePerson(raw), r = roster.find((q) => q.id === w.body) || roster[0];
      const person = r ? this.library.spawn(r.id, r.file) : new Person(w.body);
      person.group.position.set(w.x, 0.02, w.z);
      person.group.rotation.y = FACE[w.face] ?? 0;
      person.play('Idle', 0);
      const look = { ...factionLook(w.faction, seq++, w.role), personId: w.body };
      if (w.helmet) { const st = factionStyle(w.faction); Object.assign(look, { helmet: true, shell: look.shell ?? st.palette.primary, helmetTrim: st.palette.accent, visorTint: look.visorTint ?? 0x20262e, visorOpacity: look.visorOpacity ?? 0.7 }); }
      person.dress(look);
      this.root.add(person.group);
      this.members.push({ ...w, personId: w.body, y: 0, status: 'worker', def: { title: w.title }, person, line: w.line, world: true,
        talk: (view, e) => this._talk(w, view, e), act: (a, ds, ui) => this._act(w, a, ds, ui),
        speech: (view) => this._speech(w, view),
        worldDist: (worldPos) => { const p = frameToOutpost(this.pi, worldPos); return Math.hypot(p.x - w.x, p.y, p.z - w.z); } });
    }
    await Promise.all(this.members.map((m) => m.person.ready));
    return this;
  }
  tick(dt, worldPos) {
    if (!this.built || !worldPos) return;
    const p = frameToOutpost(this.pi, worldPos), range = this.library && this.library.phone ? 90 : 160;
    for (const m of this.members) {
      m.person.group.visible = m.far ? Math.hypot(p.x - m.x, p.z - m.z) < 70 : Math.hypot(p.x - m.x, p.z - m.z) < range;
      if (m.person.group.visible) m.person.update(dt);
    }
  }
  nearest(worldPos) {
    const p = frameToOutpost(this.pi, worldPos);
    let best = null, dist = 3;
    for (const m of this.members) { const d = Math.hypot(p.x - m.x, p.y, p.z - m.z); if (d < dist && personVisible(m.person)) { best = m; dist = d; } }
    return best;
  }

  /** The lines spoken when a view opens, from the person's own mouth. */
  _speech(w, view) {
    if (view === 'answer') return w.answer ? [{ voice: w.voice, text: w.answer }] : [];
    if (view === 'trade') return w.tradeLine ? [{ voice: w.voice, text: w.tradeLine }] : [];
    return w.line ? [{ voice: w.voice, text: w.line }] : [];
  }

  /** The Talk panel's body. view: 'main' | 'answer' | 'trade'. e: the economy record. */
  _talk(w, view, e) {
    const asshole = w.seatInfo && w.seatInfo.asshole ? ' <span class="stat">(an asshole, by the book)</span>' : '';
    let h = view === 'answer' ? `<p class="stat">${esc(w.title)}${asshole}</p><div class="col">` : `<p>${esc(w.line)}</p><div class="col">`;
    if (view === 'answer') {
      h += `<div class="say">${esc(w.answer)}</div><button class="cbtn" data-a="worker-reply">${esc(w.reply)}</button>`;
      if (w.seatInfo && w.seatInfo.tier !== 'top') h += `<button class="cbtn" data-a="seat-take">Ask for the ${esc(w.seatInfo.title.toLowerCase())} post</button>`;
      if (w.seatInfo && w.seatInfo.tier === 'top') h += `<button class="cbtn" data-a="seat-talk">Hear the ${esc(w.seatInfo.title.toLowerCase())} out</button>`;
    } else if (view === 'trade' && w.trade && w.trade.startsWith('ice')) {
      const price = ICE_PRICE[w.trade], kg = (e.hold && e.hold[ICE_ITEM]) || 0, t = Math.floor(kg / 1000 + 1e-9);
      h += `<p class="stat">Purse ${e.marks} marks · ${w.trade === 'ice-hub' ? "the hub's water office" : "Fortis's own ice dock"} pays ${price} marks a tonne</p>`;
      h += `<p>Lunar ice in the hold: ${(kg / 1000).toFixed(2)} t${w.trade === 'ice-dock' ? ` · the hub pays ${ICE_PRICE['ice-hub']} (a short hop, no lane fee)` : ''}</p>`;
      h += `<button class="cbtn" data-a="m-sell-ice" data-t="1" ${t < 1 ? 'disabled' : ''}>Sell 1 tonne · ${price} marks</button>`;
      if (t > 1) h += `<button class="cbtn" data-a="m-sell-ice" data-t="${t}">Sell all ${t} t · ${t * price} marks</button>`;
      h += `<p class="stat">Dig the pale, hard ground in the permanent shadows round Shackleton, stow it in the ship's hold, and bring her down at a landing with a buyer. Whole tonnes only.</p>`;
      h += `<button class="cbtn" data-a="worker-back">Back to conversation</button>`;
    } else if (view === 'trade' && w.trade && w.trade.startsWith('shop:')) {
      const id = w.trade.slice(5), row = SHOPS[id], inv = e.inventory || {};
      h += `<p class="stat">Purse ${e.marks} marks · ${esc(w.title)}</p>`;
      for (const [g, price] of Object.entries(row.sells)) h += `<p>${esc(GOODS[g].name)} · you have ${inv[g] || 0} · they sell at ${price} marks</p><div class="row2"><button class="cbtn" data-a="m-buy" data-good="${g}" data-n="1" ${e.marks < price ? 'disabled' : ''}>Buy 1 · ${price}</button><button class="cbtn" data-a="m-buy" data-good="${g}" data-n="5" ${e.marks < price * 5 ? 'disabled' : ''}>Buy 5 · ${price * 5}</button></div>`;
      for (const [g, price] of Object.entries(row.buys)) { const have = inv[g] || 0; h += `<p>${esc(GOODS[g].name)} · you have ${have} · Mars shelf ${GOODS[g].buy} marks · they pay ${price}</p><div class="row2"><button class="cbtn" data-a="m-sell" data-good="${g}" data-n="1" ${have < 1 ? 'disabled' : ''}>Sell 1 · ${price}</button><button class="cbtn" data-a="m-sell" data-good="${g}" data-n="${have}" ${have < 2 ? 'disabled' : ''}>Sell all ${have} · ${have * price}</button></div>`; }
      h += `<button class="cbtn" data-a="worker-back">Back to conversation</button>`;
    } else {
      h += `<button class="cbtn" data-a="worker-question">${esc(w.question)}</button>`;
      if (w.trade) h += `<button class="cbtn" data-a="worker-trade">${w.trade.startsWith('ice') ? 'I have ice to sell' : 'Show me what you buy and sell'}</button>`;
      if (w.join) h += `<button class="cbtn" data-a="moon-join" data-f="${w.join}">Join ${esc(factionStyle(w.join).name)}</button>`;
    }
    return h + `<button class="cbtn" data-a="close">Goodbye</button></div>`;
  }

  /** A button in that panel. Returns { ok, msg } (or null for one that is not ours). */
  async _act(w, a, ds, ui) {
    const world = ui.crew && ui.crew.world;
    if (!world) return { ok: false, msg: 'No ledger to write to.' };
    if (a === 'm-sell-ice') return world.dispatch({ type: 'moon-trade', op: 'sell-ice', where: w.trade, worker: w.id, tonnes: Number(ds.t) });
    if (a === 'm-sell') return world.dispatch({ type: 'moon-trade', op: 'sell', worker: w.id, good: ds.good, n: Number(ds.n) });
    if (a === 'm-buy') return world.dispatch({ type: 'moon-trade', op: 'buy', worker: w.id, good: ds.good, n: Number(ds.n) });
    if (a === 'moon-join') return world.dispatch({ type: 'faction-join', faction: ds.f });
    if (a === 'seat-take') return world.dispatch({ type: 'role-take', seat: w.seatInfo.id });
    if (a === 'seat-talk') return world.dispatch({ type: 'role-talk', seat: w.seatInfo.id });
    return null;
  }
}
