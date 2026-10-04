// ============================================================================
// worlds/ceres/people.js — the people of Occator Works: the same Loft people the Mars port and the crew use (cached GLBs, one skinned rig
// each), dressed for work in a vacuum (a duty helmet, hi-vis cloth), standing where layout.js puts them. They are the Talk targets on Ceres:
// the foreman buys ore, the supply desk buys supplies, the others tell you what the place is.
// A person here has the same shape as a port worker ({ id, name, def: { title }, person, status: 'worker' }) so the Talk button (crewUI.js) treats
// them the same way; the two extra members (`talk`, `act`) draw the panel and handle its buttons.
// ============================================================================

import { WORKERS, outpostToFrame, frameToOutpost } from './layout.js';
import { personVisible } from '../../crew/personVisibility.js';
import { Person } from '../../crew/personRig.js';
import { MATTER, ORE_ITEM, SALT_ITEM, SUPPLY_PAY } from './trade.js';
import { GOODS } from '../../economy/catalog.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LOOKS = { foreman: 0xd9772b, supply: 0xc9b04a, 'pad-marshal': 0xe6a020, 'lane-clerk': 0x3f6f9a, 'greenhaven-rep': 0x5fbf6a, 'shift-boss': 0xd9772b, driller: 0xd9772b, welder: 0x7a5a3a };

export class OutpostPeople {
  constructor(o) { this.root = o.root; this.library = o.people; this.space = o.space; this.pi = o.pi; this.members = []; this.built = false; }

  async build() {
    if (this.built || !this.library) return this;
    this.built = true;
    const roster = await this.library.roster();
    for (const w of WORKERS) {
      const r = roster.find((q) => q.id === w.personId) || roster[0];
      const person = r ? this.library.spawn(r.id, r.file) : new Person(w.personId);
      person.group.position.set(w.x, w.pose === 'seated' ? 0.5 : 0.02, w.z);
      person.group.rotation.y = { south: 0, east: Math.PI / 2, north: Math.PI, west: -Math.PI / 2 }[w.face] || 0;
      person.play(w.pose === 'seated' ? 'Sit' : 'Idle', 0);
      person.dress({ personId: w.personId, cloth: LOOKS[w.id] ?? 0xd9772b, helmet: true, visorTint: 0x3a2a14, visorOpacity: 0.55 });
      this.root.add(person.group);
      this.members.push({ ...w, y: 0, status: 'worker', def: { title: w.title }, person, line: w.line, world: true,
        talk: (view, e) => this._talk(w, view, e), act: (a, ds, ui) => this._act(w, a, ds, ui),
        worldDist: (worldPos) => { const p = frameToOutpost(this.pi, worldPos); return Math.hypot(p.x - w.x, p.y, p.z - w.z); } });
    }
    await Promise.all(this.members.map((m) => m.person.ready));
    return this;
  }
  tick(dt, worldPos) {
    if (!this.built || !worldPos) return;
    const p = frameToOutpost(this.pi, worldPos), range = this.library && this.library.phone ? 90 : 160;
    for (const m of this.members) {
      m.person.group.visible = Math.hypot(p.x - m.x, p.z - m.z) < range;
      if (m.person.group.visible) m.person.update(dt);
    }
  }
  nearest(worldPos) {
    const p = frameToOutpost(this.pi, worldPos);
    let best = null, dist = 3;
    for (const m of this.members) { const d = Math.hypot(p.x - m.x, p.y, p.z - m.z); if (d < dist && personVisible(m.person)) { best = m; dist = d; } }
    return best;
  }

  /** The Talk panel's body for a worker. view: 'main' | 'answer' | 'trade'. e: the economy record. */
  _talk(w, view, e) {
    let h = `<p>${esc(w.line)}</p><div class="col">`;
    if (view === 'answer') {
      h += `<div class="say">${esc(w.answer)}</div><button class="cbtn" data-a="worker-reply">${esc(w.reply)}</button>`;
    } else if (view === 'trade' && w.trade === 'ore') {
      h += `<p class="stat">Purse ${e.marks} marks · the foundry weighs whole tonnes from the ship's hold; the Marineris depot pays more</p>`;
      for (const item of [ORE_ITEM, SALT_ITEM]) {
        const row = MATTER[item], kg = (e.hold && e.hold[item]) || 0, t = Math.floor(kg / 1000 + 1e-9);
        h += `<p>${esc(row.name)} in the hold: ${(kg / 1000).toFixed(2)} t · here ${row.works} marks a tonne · Marineris ${row.marineris}</p>`;
        h += `<button class="cbtn" data-a="w2-sell" data-item="${item}" data-t="1" ${t < 1 ? 'disabled' : ''}>Sell 1 tonne · ${row.works} marks</button>`;
        if (t > 1) h += `<button class="cbtn" data-a="w2-sell" data-item="${item}" data-t="${t}">Sell all ${t} t · ${t * row.works} marks</button>`;
      }
      h += `<p class="stat">Dig ore (rust-red seams and outcrops) and salt (the white ground), stow it in the ship's hold, and bring her to the Works. Whole tonnes only.</p>`;
      h += `<button class="cbtn" data-a="worker-back">Back to conversation</button>`;
    } else if (view === 'trade' && w.trade === 'supply') {
      h += `<p class="stat">Purse ${e.marks} marks · the desk pays about twice Mars's shelf price</p>`;
      for (const [id, pay] of Object.entries(SUPPLY_PAY)) {
        const have = (e.inventory && e.inventory[id]) || 0;
        h += `<p>${esc(GOODS[id].name)} · you have ${have} · Mars shelf ${GOODS[id].buy} marks</p><div class="row2">`;
        h += `<button class="cbtn" data-a="w2-sell-supply" data-good="${id}" data-n="1" ${have < 1 ? 'disabled' : ''}>Sell 1 · ${pay} marks</button>`;
        h += `<button class="cbtn" data-a="w2-sell-supply" data-good="${id}" data-n="${have}" ${have < 2 ? 'disabled' : ''}>Sell all ${have} · ${have * pay}</button></div>`;
      }
      h += `<button class="cbtn" data-a="worker-back">Back to conversation</button>`;
    } else {
      h += `<button class="cbtn" data-a="worker-question">${esc(w.question)}</button>`;
      if (w.trade) h += `<button class="cbtn" data-a="worker-trade">${w.trade === 'ore' ? 'I have ore or salt to sell' : 'Show me what you buy'}</button>`;
    }
    return h + `<button class="cbtn" data-a="close">Goodbye</button></div>`;
  }

  /** A button in that panel. Returns { ok, msg }. */
  async _act(w, a, ds, ui) {
    const world = ui.crew && ui.crew.world;
    if (!world) return { ok: false, msg: 'No ledger to write to.' };
    if (a === 'w2-sell') return world.dispatch({ type: 'world2-sale', kind: 'matter', item: ds.item, where: 'ceres', worker: w.id, tonnes: Number(ds.t) });
    if (a === 'w2-sell-supply') return world.dispatch({ type: 'world2-sale', kind: 'supply', where: 'ceres', worker: w.id, good: ds.good, n: Number(ds.n) });
    return null;
  }
}
