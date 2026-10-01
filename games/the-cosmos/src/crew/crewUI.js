// ============================================================================
// crewUI.js — the "Talk" button and the little conversation you have with a crew member: hire them, or give an order.
//
// OWNS: the DOM for talking (button, panel, the line a crew member says). DOES NOT OWN: what an order does (crewSystem.js).
//
// Same rule as the rest of the game's touch design: nothing sits on screen waiting. The Talk button appears only when a person
// is within arm's reach, the panel only when you press it, and it closes by itself when you walk away. Buttons are 46 px or
// taller. A crew member's reply appears as a line at the bottom of the screen and in the ship's log.
// ============================================================================

import { CREW_POSTS, ORDERS, thinkDelay } from './crewSpec.js';

const CSS = `
#crew-ui { position: fixed; inset: 0; pointer-events: none; z-index: 68; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
#crew-ui .cbtn { pointer-events: auto; background: rgba(10,7,5,.7); backdrop-filter: blur(7px); color: #ffe2bd;
  border: 1px solid rgba(240,185,120,.6); border-radius: 12px; font: inherit; font-size: 12px; letter-spacing: .4px; min-height: 46px; padding: 8px 12px; text-align: left; line-height: 1.25; }
#crew-ui .cbtn:active, #crew-ui .cbtn.on { background: rgba(240,185,120,.3); }
#crew-ui .cbtn[disabled] { opacity: .45; }
#crew-talk { position: fixed; display: none; right: calc(14px + env(safe-area-inset-right, 0px)); bottom: calc(174px + env(safe-area-inset-bottom, 0px)); min-width: 116px; text-align: center !important; }
#crew-panel { position: fixed; display: none; pointer-events: auto; left: 50%; transform: translateX(-50%);
  bottom: calc(66px + env(safe-area-inset-bottom, 0px)); width: min(380px, calc(100vw - 24px)); max-height: min(calc(100vh - 150px), 560px); overflow-y: auto;
  background: rgba(14,10,7,.9); backdrop-filter: blur(10px); border: 1px solid rgba(240,185,120,.45); border-radius: 14px; padding: 10px 11px 11px; color: #ead9c6; font-size: 12px; line-height: 1.45; }
#crew-panel .hd { display: flex; gap: 10px; align-items: center; margin-bottom: 8px; }
#crew-panel .hd img { width: 52px; height: 52px; border-radius: 10px; object-fit: cover; background: #2a211a; flex: none; }
#crew-panel .hd b { display: block; color: #ffd9ac; font-size: 14px; letter-spacing: .3px; }
#crew-panel .hd span { color: #a8917b; font-size: 11px; }
#crew-panel .x { margin-left: auto; align-self: flex-start; min-height: 36px; min-width: 36px; text-align: center; padding: 4px; }
#crew-panel p { margin: 0 0 8px; }
#crew-panel .say { color: #ffe9cf; background: rgba(240,185,120,.1); border-radius: 8px; padding: 6px 8px; margin: 0 0 8px; }
#crew-panel .col { display: flex; flex-direction: column; gap: 6px; }
#crew-panel .cbtn small { display: block; color: #a8917b; font-size: 10.5px; margin-top: 1px; }
#crew-panel .row2 { display: flex; gap: 6px; } #crew-panel .row2 .cbtn { flex: 1; text-align: center; }
#crew-panel .stat { color: #a8917b; font-size: 11px; margin: 0 0 8px; }
`;

export class CrewUI {
  /** @param crew CrewSystem, @param o { ship, walker, isTouch } */
  constructor(crew, o) {
    this.crew = crew; this.ship = o.ship; this.walker = o.walker; this.isTouch = !!o.isTouch;
    this.portPeople = o.portPeople || null;
    this.target = null; this.open = false; this.view = 'main'; this._sig = ''; this._accum = 0; this.reply = '';
    this._build();
    crew.onSay = (name, text) => this.say(name, text);
  }

  _build() {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const root = document.createElement('div'); root.id = 'crew-ui';
    root.innerHTML = `<button class="cbtn" id="crew-talk"></button><div id="crew-panel"></div>`;
    document.body.appendChild(root);
    this.btn = root.querySelector('#crew-talk'); this.panel = root.querySelector('#crew-panel');
    const press = (e) => { e.preventDefault(); e.stopPropagation(); };
    this.btn.addEventListener('pointerdown', press);
    this.btn.addEventListener('pointerup', (e) => { press(e); this.toggle(); });
    this.panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.panel.addEventListener('click', (e) => this._click(e));
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyT' && !e.repeat) { this.toggle(); }
      else if (e.code === 'Escape' && this.open) this.close();
    });
  }

  /** A line a crew member says. The ship's own message line shows it on screen (crewSystem.say sends it there); here it is
   *  kept as the reply in the open conversation. */
  say(name, text) {
    this.reply = text; if (this.open) this._sig = '';
  }

  toggle() { if (this.open) this.close(); else if (this.target) this.openFor(this.target); }
  openFor(m) { this.open = true; this.view = 'main'; this._sig = ''; this.reply = ''; this.target = m; this._draw(); }
  close() { this.open = false; this.panel.style.display = 'none'; }

  /** Per frame: find who is within reach, show or hide the button, keep the panel honest. */
  update(dt) {
    this._accum += dt;
    if (this._accum < 0.2) return;
    this._accum = 0;
    const near = this.crew.nearest(this.walker.worldPos) || (!this.ship.aboard && this.portPeople?.nearest(this.walker.worldPos));
    if (this.open) {
      if (!near || near !== this.target) { this.close(); this.target = near; }
      else this._draw();
    } else this.target = near;
    const t = this.target;
    if (t && !this.open && t.person.loaded) {
      this.btn.style.display = 'block';
      const verb = t.status === 'candidate' ? 'Hire' : 'Talk';
      this.btn.innerHTML = `${verb}  ·  ${esc(t.name)}${this.isTouch ? '' : ' (T)'}<br><span style="color:#a8917b;font-size:10.5px">${esc(t.def.title)}</span>`;
    } else this.btn.style.display = 'none';
  }

  // ---- the panel ---------------------------------------------------------------------------------------------
  _signature(m) {
    const f = this.crew.ship.flight, o = this.crew.activeOrder();
    return [m.id, m.status, m.mode, m.seated, m.displaced, this.view, this.reply, o ? o.type : '-', this.crew.flyer() ? 1 : 0, f.landed ? 1 : 0, this.ship.aboard ? 1 : 0, this.ship.seat ? this.ship.seat.id : '-'].join('|');
  }

  _draw() {
    const m = this.target; if (!m) { this.close(); return; }
    const sig = this._signature(m);
    if (sig === this._sig && this.panel.style.display === 'block') return;
    this._sig = sig;
    const def = m.def, c = this.crew, ship = this.ship;
    const skill=m.status==='worker'?'':` · skill ${Math.round(def.skill*100)}%`;
    let h = `<div class="hd"><img src="/homes/people/${m.personId}.jpg" alt=""><div><b>${esc(m.name)}</b><span>${esc(def.title)}${skill}</span></div><button class="cbtn x" data-a="close">✕</button></div>`;
    if (this.reply) h += `<div class="say">${esc(this.reply)}</div>`;
    if (m.status === 'worker') {
      h += `<p>${esc(m.line)}</p><button class="cbtn" data-a="close">Close</button>`;
    } else if (m.status === 'candidate') {
      h += `<p>${esc(def.pitch)}</p><p class="stat">Works at ${Math.round(def.skill * 100)}% of a good hand: about ${thinkDelay(def.skill).toFixed(1)} s to react, and a little off in the aim. Stays aboard until you say otherwise.</p>`;
      h += `<div class="col"><button class="cbtn" data-a="hire">Hire ${esc(m.name)}</button><button class="cbtn" data-a="close">Not now</button></div>`;
    } else {
      const isFlyer = c.flyer() === m;
      const atSeat = m.seated && !m.displaced;
      h += `<p class="stat">${esc(this._whatDoing(m))}</p>`;
      if ((def.seat === 'pilot' || def.seat === 'captain')) {
        if (!atSeat) h += `<p class="stat">${esc(m.name)} is not at the chair right now.</p>`;
        if (this.view === 'places') h += this._placesHTML();
        else {
          h += `<div class="col">`;
          for (const o of ORDERS) {
            const disabled = !c.flyer() || (o.id !== 'hold' && !ship.aboard);
            h += `<button class="cbtn" data-a="order" data-o="${o.id}" ${disabled ? 'disabled' : ''}>${esc(o.label)}<small>${esc(o.hint)}</small></button>`;
          }
          h += `</div>`;
        }
      } else if (def.seat === 'nav') {
        h += `<div class="col"><button class="cbtn" data-a="report">Report: where are we, what is around us<small>The navigator reads the scanner</small></button></div>`;
      }
      if (this.view !== 'places') {
        h += `<div class="row2" style="margin-top:8px">`;
        if (ship.aboard && !(ship.seat && ship.seat.id === def.seat)) h += `<button class="cbtn" data-a="seat">Take the ${esc(this._seatName(def.seat))}</button>`;
        h += `<button class="cbtn" data-a="dismiss">Dismiss</button></div>`;
      }
    }
    this.panel.innerHTML = h;
    this.panel.style.display = 'block';
  }

  _seatName(id) { return { pilot: 'pilot seat', captain: "captain's chair", nav: 'navigation seat', gun_dorsal: 'dorsal turret', gun_ventral: 'ventral turret' }[id] || 'seat'; }

  _whatDoing(m) {
    if (m.mode === 'boarding') return 'Coming aboard.';
    if (m.mode === 'walk') return 'Walking to their station.';
    if (m.mode === 'leaving') return 'Stepping off.';
    if (m.displaced) return 'Standing by: you have their seat.';
    const o = this.crew.activeOrder(), isFlyer = this.crew.flyer() === m;
    if (isFlyer && o) return { goto: `Flying to ${o.name || 'a place'}.`, return: 'Flying home.', hunt: 'Hunting raiders beyond neutral airspace.', roam: 'Roaming.', supply: 'On a supply run.', land: 'Landing.' }[o.type] || 'Holding.';
    return m.seated ? 'At their station.' : 'Aboard.';
  }

  _placesHTML() {
    let h = `<div class="col"><button class="cbtn" data-a="back">‹ Back</button>`;
    for (const p of this.crew.places()) {
      const d = p.distM >= 1000 ? `${(p.distM / 1000).toFixed(p.distM > 10000 ? 0 : 1)} km` : `${Math.round(p.distM)} m`;
      h += `<button class="cbtn" data-a="goto" data-p="${p.id}" ${p.ok ? '' : 'disabled'}>${esc(p.name)}<small>${d}${p.ok ? '' : ': too far for now (cruise is 40 m/s)'}</small></button>`;
    }
    h += `<button class="cbtn" disabled>Other worlds<small>No travel between worlds yet</small></button></div>`;
    return h;
  }

  _click(e) {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const m = this.target, a = b.dataset.a, c = this.crew;
    e.preventDefault();
    let r = null;
    switch (a) {
      case 'close': this.close(); return;
      case 'back': this.view = 'main'; break;
      case 'hire': r = c.hire(m.id); if (r.ok) { this.close(); return; } break;
      case 'dismiss': r = c.dismiss(m.id); if (r.ok) { this.close(); return; } break;
      case 'seat': if (this.ship.takeSeat(m.def.seat)) { this.close(); return; } break;
      case 'order': {
        if (b.dataset.o === 'goto') { this.view = 'places'; break; }
        r = c.order(b.dataset.o); if (r.ok) { this.close(); return; } break;
      }
      case 'goto': r = c.order('goto', { id: b.dataset.p }); if (r.ok) { this.view = 'main'; this.close(); return; } break;
      case 'report': this.reply = c.report(m); break;
    }
    if (r && !r.ok) this.reply = r.msg;
    this._sig = ''; this._draw();
  }
}

function esc(s) { return String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }
