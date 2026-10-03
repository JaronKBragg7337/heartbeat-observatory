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
import { personVisible } from './personVisibility.js';
import { bindActivation, guardSheetPress } from '../ui/activation.js';
import { landingOrder } from '../space/spaceSpec.js';
import { workerHTML, WAGES } from '../economy/dialogue.js';
import { TRADERS, QUESTS } from '../economy/catalog.js';   // VOICES
import { WORKER_CAST, voiceForName } from '../voice/cast.js';
import { WORKER_FALLBACK } from '../port/workerLines.js';

const CSS = `
#crew-ui { position: fixed; inset: 0; pointer-events: none; z-index: 68; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
.cbtn { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; pointer-events: auto; background: rgba(10,7,5,.7); backdrop-filter: blur(7px); color: #ffe2bd;
  border: 1px solid rgba(240,185,120,.6); border-radius: 12px; font: inherit; font-size: 12px; letter-spacing: .4px; min-height: 46px; padding: 8px 12px; text-align: left; line-height: 1.25; }
.cbtn:active, .cbtn.on { background: rgba(240,185,120,.3); }
.cbtn[disabled] { opacity: .45; }
#crew-talk { position: fixed; display: none; right: calc(14px + env(safe-area-inset-right, 0px)); bottom: calc(174px + env(safe-area-inset-bottom, 0px)); min-width: 116px; text-align: center !important; }
#crew-panel { position: fixed; display: none; pointer-events: auto; left: 50%; transform: translateX(-50%);
  bottom: calc(66px + env(safe-area-inset-bottom, 0px)); width: min(380px, calc(100vw - 24px)); max-height: min(calc(100vh - 150px), 560px); overflow-y: auto;
  background: rgba(14,10,7,.9); backdrop-filter: blur(10px); border: 1px solid rgba(240,185,120,.45); border-radius: 14px; padding: 10px 11px 11px; color: #ead9c6; font-size: 12px; line-height: 1.45; }
#crew-panel { touch-action: pan-y; overscroll-behavior: contain; }
#crew-panel .hd { position: sticky; top: -10px; background: #100c09; z-index: 1; display: flex; gap: 10px; align-items: center; margin-bottom: 8px; }
#crew-panel .hd img { width: 52px; height: 52px; border-radius: 10px; object-fit: cover; background: #2a211a; flex: none; }
#crew-panel .hd b { display: block; color: #ffd9ac; font-size: 14px; letter-spacing: .3px; }
#crew-panel .hd span { color: #a8917b; font-size: 11px; }
#crew-panel .x { margin-left: auto; align-self: flex-start; min-height: 44px; min-width: 44px; text-align: center; padding: 4px; }
#crew-panel p { margin: 0 0 8px; }
#crew-panel .say { color: #ffe9cf; background: rgba(240,185,120,.1); border-radius: 8px; padding: 6px 8px; margin: 0 0 8px; }
#crew-panel .col { display: flex; flex-direction: column; gap: 6px; }
#crew-panel .cbtn small { display: block; color: #a8917b; font-size: 10.5px; margin-top: 1px; }
#crew-panel .row2 { display: flex; gap: 6px; } #crew-panel .row2 .cbtn { flex: 1; text-align: center; }
#crew-panel .stat { color: #a8917b; font-size: 11px; margin: 0 0 8px; }
@media(max-width:520px){#crew-panel{top:68px;bottom:auto;max-height:calc(100dvh - 90px)} }
`;

export class CrewUI {
  /** @param crew CrewSystem, @param o { ship, walker, isTouch } */
  constructor(crew, o) {
    this.crew = crew; this.ship = o.ship; this.walker = o.walker; this.isTouch = !!o.isTouch;
    this.portPeople = o.portPeople || null; this.voice = o.voice || null;   // VOICES
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
    // ROUND7 tap loss: the tap used to re-pick who is nearest at the instant of the tap, so a thumb that was still on the move
    // (or a worker standing next to another) turned a visible button into a no-op. The tap now acts on who the button showed.
    bindActivation(this.btn,()=>{if(!this.target||this.btn.style.display==='none')this._accum=1,this.update(0);this.toggle();});
    guardSheetPress(this.panel);
    this.panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.panel.addEventListener('click', (e) => this._click(e));
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyT' && !e.repeat) { this.toggle(); }
      else if (e.code === 'Escape' && this.open) this.close();
    });
  }

  /** Metres from the player to a crew member or port worker (Infinity if they are not drawn). */
  _dist(m) {
    try {
      if (!personVisible(m.person)) return Infinity;
      const w = this.walker.worldPos;
      if (this.crew.members.get && this.crew.members.get(m.id) === m) { const p = this.crew.worldPosOf(m); return Math.hypot(p.x - w.x, p.y - w.y, p.z - w.z); }
      if (this.portPeople) { const l = this.portPeople.port.site.toLocal(w), g = m.person.group.position; return Math.hypot(l.x - g.x, l.y - g.y, l.z - g.z); }
    } catch { /* fall through */ }
    return Infinity;
  }

  /** A line a crew member says. The ship's own message line shows it on screen (crewSystem.say sends it there); here it is
   *  kept as the reply in the open conversation. */
  say(name, text) {
    this.reply = text; if (this.open) this._sig = '';
  }

  toggle() { if (this.open) this.close(); else if (this.target) this.openFor(this.target); }
  openFor(m) { this._voiced = ''; this.open = true; this.view = 'main'; this._sig = ''; this.reply = ''; this.target = m; this._draw(); }
  close() { this._voiced = ''; this.open = false; this.panel.style.display = 'none'; }

  /** Per frame: find who is within reach, show or hide the button, keep the panel honest. */
  update(dt) {
    this._accum += dt;
    if (this._accum < 0.2) return;
    this._accum = 0;
    let near = this.crew.nearest(this.walker.worldPos) || (!this.ship.aboard && this.portPeople?.nearest(this.walker.worldPos));
    // stay with the person the button is about while they are still close (up to 4.5 m, and not once someone else is clearly closer by 0.4 m), so walking past or a second person
    // nearby does not swap or drop the target under the thumb
    // an open conversation stays with the person you are talking to for as long as they are within reach (walking past someone else must not swap or close it)
    if (this.open && this.target && this._dist(this.target) < 4.5) near = this.target;
    else if (this.target && near !== this.target) { const d0 = this._dist(this.target); if (d0 < 4.5 && d0 <= (near ? this._dist(near) : Infinity) + 0.4) near = this.target; }
    if (this.open) {
      if (!near || near !== this.target) { this.close(); this.target = near; }
      else this._draw();
    } else this.target = near;
    const t = this.target;
    if (t && !this.open && t.person.loaded) {
      this.btn.style.display = 'block';
      const verb = t.status === 'candidate' ? 'Hire' : 'Talk';
      const label=`${verb}  ·  ${esc(t.name)}${this.isTouch ? '' : ' (T)'}<br><span style="color:#a8917b;font-size:10.5px">${esc(t.def.title)}</span>`;
      if(label!==this._buttonLabel){this.btn.innerHTML=label;this._buttonLabel=label;}
    } else this.btn.style.display = 'none';
  }

  /** VOICES: what the person says in the open panel is spoken once per view, from their body, in their voice. */
  _speakPanel(m) {
    const v = this.voice; if (!v || !this.open) return;
    const key = m.id + '|' + this.view; if (key === this._voiced) return; this._voiced = key;
    const o = { source: m.person?.group || null, channel: 'room' };
    if (m.status === 'worker') {
      const cast = WORKER_CAST[m.id]; if (!cast) return;
      const t = TRADERS[m.id], jobs = QUESTS.filter((q) => q.giver === m.id);
      if (this.view === 'answer') v.sayLine(t?.answer || (jobs[0] ? jobs[0].offer : WORKER_FALLBACK.answer), { ...o, voice: cast.voice });
      else if (this.view === 'main') {
        v.sayLine(t?.greeting || m.line, { ...o, voice: cast.voice });
        for (const q of jobs) v.sayLine(q.offer, { ...o, voice: cast.voice, queue: true });
      }
    } else if (m.status === 'candidate') {
      const id = voiceForName(m.name); if (id) v.sayLine(m.def.pitch, { ...o, voice: id });
    }
  }

  // ---- the panel ---------------------------------------------------------------------------------------------
  _signature(m) {
    const f = this.crew.ship.flight, o = this.crew.activeOrder();
    const tr = this.ship.space && this.ship.space.trip;
    const trTick = tr && tr.active ? `${tr.phase}|${tr.warp}|${tr.eff}|${Math.round(tr.progress.etaS / 10)}|${Math.round(tr.progress.distM / 2000)}` : '-';   // SPACE-FIX: redraw as the course moves on
    return [m.id, m.status, m.mode, m.seated, m.displaced, this.view, this.reply, this.crew.world?.state.economy.marks, o ? o.type : '-', this.crew.flyer() ? 1 : 0, f.landed ? 1 : 0, this.ship.aboard ? 1 : 0, this.ship.seat ? this.ship.seat.id : '-', trTick].join('|');
  }

  _draw() {
    if(this.panel.dataset.pressed)return;
    const m = this.target; if (!m) { this.close(); return; }
    const sig = this._signature(m);
    if (sig === this._sig && this.panel.style.display === 'block') return;
    this._sig = sig;
    this._speakPanel(m);
    const def = m.def, c = this.crew, ship = this.ship;
    const skill=m.status==='worker'?'':` · skill ${Math.round(def.skill*100)}%`;
    let h = `<div class="hd"><img src="/homes/people/${m.personId}.jpg" alt=""><div><b>${esc(m.name)}</b><span>${esc(def.title)}${skill}</span></div><button class="cbtn x" data-a="close">✕</button></div>`;
    if (this.reply) h += `<div class="say">${esc(this.reply)}</div>`;
    if (m.status === 'worker') {
      h += workerHTML(m,this.view,c.world?.state.economy||c.account);
    } else if (m.status === 'candidate') {
      h += `<p>${esc(def.pitch)}</p><p class="stat">Works at ${Math.round(def.skill * 100)}% of a good hand: about ${thinkDelay(def.skill).toFixed(1)} s to react, and a little off in the aim. Stays aboard until you say otherwise.</p>`;
      const wage=WAGES[m.def.id],fee=wage*4,balance=(c.world?.state.economy||c.account).marks;
      h += `<p class="stat">Signing fee ${fee} marks (${wage} credits). Wage ${fee} marks per Mars sol. Purse ${balance} marks. Unpaid crew leave at the next port.</p>`;
      const meeting=m.meetingState&&m.meetingState!=='waiting';
      h += `<div class="col"><button class="cbtn" data-a="${meeting?'meet':'hire'}" ${balance<fee?'disabled':''}>${meeting?'Meet':'Hire'} ${esc(m.name)} · ${fee} marks</button><button class="cbtn" data-a="close">Not now</button></div>`;
    } else {
      const isFlyer = c.flyer() === m;
      const atSeat = m.seated && !m.displaced;
      h += `<p class="stat">${esc(this._whatDoing(m))}</p>`;
      if ((def.seat === 'pilot' || def.seat === 'captain')) {
        if (!atSeat) h += `<p class="stat">${esc(m.name)} is not at the chair right now.</p>`;
        if (this.view === 'places') h += this._placesHTML();
        else {
          h += this._tripHTML();                                                   // SPACE-FIX: course status, time compression, cancel
          h += `<div class="col">`;
          for (const o of ORDERS) {
            const disabled = !c.flyer() || (o.id !== 'hold' && !ship.aboard);
            h += `<button class="cbtn" data-a="order" data-o="${o.id}" ${disabled ? 'disabled' : ''}>${esc(o.label)}<small>${esc(o.hint)}</small></button>`;
          }
          h += `</div>`;
        }
      } else if (def.seat === 'comms') {
        h += `<div class="col"><button class="cbtn" data-a="comms-report">Channel and account report</button></div>`;
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

  _seatName(id) { return { pilot: 'pilot seat', captain: "captain's chair", nav: 'navigation seat', comms:'comms seat', gun_dorsal: 'dorsal turret', gun_ventral: 'ventral turret' }[id] || 'seat'; }

  _whatDoing(m) {
    if (m.mode === 'boarding') return 'Coming aboard.';
    if (m.mode === 'walk') return 'Walking to their station.';
    if (m.mode === 'leaving') return 'Stepping off.';
    if (m.displaced) return 'Standing by: you have their seat.';
    const o = this.crew.activeOrder(), isFlyer = this.crew.flyer() === m;
    const trip = this.ship.space && this.ship.space.trip;
    if (isFlyer && trip && trip.active) return `Flying the course to ${trip.dest.name} (${trip.phase}).`;
    if (isFlyer && o) return { goto: `Flying to ${o.name || 'a place'}.`, return: 'Flying home.', hunt: 'Hunting raiders beyond neutral airspace.', roam: 'Roaming.', supply: 'On a supply run.', land: 'Landing.' }[o.type] || 'Holding.';
    return m.seated ? 'At their station.' : 'Aboard.';
  }

  // SPACE-FIX: while a course is under way, the pilot's panel shows each phase with its time left, the time compression buttons and Cancel course.
  _tripHTML() {
    const sp = this.ship.space, t = sp && sp.trip;
    if (!t || !t.active) return landingOrder(this.crew.activeOrder())?`<p class="stat">Pilot return / landing · speed ×${sp.warp}</p><div class="row2">${[1,5,20,60].map(w=>`<button class="cbtn" data-a="warp" data-w="${w}">×${w}</button>`).join('')}</div>`:'';
    const fmtT = (s) => (s >= 5400 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : s >= 120 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`);
    const ph = t.phases();
    let h = `<p class="stat">Course to ${esc(t.dest.name)}</p>`;
    h += ph.map((q) => `<p class="stat" style="margin:1px 0${q.state === 'now' ? ';color:#fff' : ''}">${q.state === 'done' ? '✓' : q.state === 'now' ? '▶' : '·'} ${esc(q.name)}: ${q.state === 'done' ? 'done' : fmtT(t.wallS(q))}</p>`).join('');
    h += `<p class="stat" style="margin:1px 0 6px">Whole trip: ${fmtT(ph.reduce((a, q) => a + t.wallS(q), 0))}${t.eff < t.warp ? ` · held to ×${t.eff} here (×1 for the last 400 m)` : ''}</p>`;
    if (t.active) {
      h += `<div class="row2" style="margin-bottom:6px">${[1, 5, 20, 60].map((w) => `<button class="cbtn" data-a="warp" data-w="${w}" ${t.warp === w ? 'style="border-color:#fff"' : ''}>×${w}</button>`).join('')}</div>`;
    }
    h += `<div class="col"><button class="cbtn" data-a="cancel-course">Cancel course<small>${t.phase === 'transit' ? 'Brakes to a stop where we are' : 'Holds here'}</small></button></div>`;
    return h;
  }

  _placesHTML() {
    let h = `<div class="col"><button class="cbtn" data-a="back">‹ Back</button>`;
    const fmtD = (m) => (m >= 1000 ? `${(m / 1000).toFixed(m > 10000 ? 0 : 1)} km` : `${Math.round(m)} m`);
    const fmtT = (s) => (s >= 5400 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : s >= 120 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`);
    const all = this.crew.places(), worlds = all.filter((p) => p.space), here = all.filter((p) => !p.space);
    if (worlds.length) {
      h += `<p class="stat" style="margin:6px 0 2px">Other worlds (the main drive)</p>`;
      for (const p of worlds) h += `<button class="cbtn" data-a="goto" data-p="${p.id}" ${p.ok ? '' : 'disabled'}>${esc(p.name)}<small>${p.ok ? `${fmtD(p.distM)} · about ${fmtT(p.etaS)}` : esc(p.reason || 'not available')}</small></button>`;
      h += `<p class="stat" style="margin:8px 0 2px">Here on Mars</p>`;
    }
    for (const p of here) h += `<button class="cbtn" data-a="goto" data-p="${p.id}" ${p.ok ? '' : 'disabled'}>${esc(p.name)}<small>${fmtD(p.distM)}${p.ok ? '' : ': too far for now (cruise is 40 m/s)'}</small></button>`;
    h += `</div>`;
    return h;
  }

  async _click(e) {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const m = this.target, a = b.dataset.a, c = this.crew;
    e.preventDefault();
    let r = null;
    switch (a) {
      case 'close': this.close(); return;
      case 'worker-question': this.view='answer';break;
      case 'worker-reply': this.view=m.id.startsWith('trader')||m.id==='depot-clerk'?'trade':'main';break;
      case 'worker-trade': this.view='trade';break;
      case 'worker-back': this.view='main';break;
      case 'purchase': case 'sale': case 'regolith-sale': case 'quest-accept': case 'buy-vehicle':
        r=c.world?.dispatch({type:a,trader:m.id,good:b.dataset.good,id:b.dataset.quest});
        if(r)this.reply=r.msg;break;
      case 'comms-report': {
        const e=c.world?.state.economy||c.account;
        this.reply=`Port channel clear. Account ${e.marks} marks. ${Object.values(e.quests).filter(q=>q.status==='active').length} accepted jobs. Wages are paid each Mars sol.`;
        c.say(m,this.reply);break;
      }
      case 'back': this.view = 'main'; break;
      case 'hire': r = await c.hire(m.id); if (r.ok) { this.close(); return; } break;
      case 'meet': r=c.world.dispatch({type:'meet',id:m.id});break;
      case 'dismiss': r = await c.dismiss(m.id); if (r.ok) { this.close(); return; } break;
      case 'seat': if (this.ship.takeSeat(m.def.seat)) { this.close(); return; } break;
      case 'order': {
        if (b.dataset.o === 'goto') { this.view = 'places'; break; }
        r = await c.order(b.dataset.o); if (r.ok) { this.close(); return; } break;
      }
      case 'goto': r = await c.order('goto', { id: b.dataset.p }); if (r.ok) { this.view = 'main'; this.close(); return; } break;
      case 'report': this.reply = c.report(m); break;
      case 'warp': if (this.ship.space) this.ship.space.setWarp(Number(b.dataset.w)); break;                                      // SPACE-FIX
      case 'cancel-course': if (this.ship.space) { const q = this.ship.space.cancel(); if (!q.ok) this.reply = q.msg; } break;     // SPACE-FIX
    }
    if (r && !r.ok) this.reply = r.msg;
    this._sig = ''; this._draw();
  }
}

function esc(s) { return String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }
