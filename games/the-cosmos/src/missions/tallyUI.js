// ============================================================================
// missions/tallyUI.js - THE COUNT CARD: the one piece of screen a tally run needs (missions/freight.js, step kind `count`). When the player stands at a side's
// stock on a tally run, a small card asks what the tally hand asks ("How many crates stand on the three pallets?"), with a minus, a plus and "Sign the tally".
// The number is the player's own: they count by looking. The authority checks it against the world clock the yard is drawn from (server/missions.mjs
// count(), worlds/yardBook.js) and either pays, or says "look again".
//
// OWNS: the card and the number on it. DOES NOT OWN: the job (the server), the yard (worlds/_kit/sideYard.js), where the player stands (the walker).
// Works with a thumb (three buttons, 48 px tall), a mouse, and a gamepad (they are plain buttons: the focus ring of ui/gamepad.js finds them).
// COST: nothing per frame while no tally run is on; four checks a second while one is.
// ============================================================================
import { tallyOf, tallyWords, yardShipWords } from '../worlds/yardBook.js';
import { resolve, distanceTo } from './where.js';
import { worldTimeS } from '../space/clock.js';
import { bindActivation } from '../ui/activation.js';

const CSS = `
#tally-card { position: fixed; display: none; z-index: 69; pointer-events: auto; left: 50%; transform: translateX(-50%);
  bottom: calc(66px + env(safe-area-inset-bottom, 0px)); width: min(360px, calc(100vw - 24px)); box-sizing: border-box;
  background: rgba(14,10,7,.92); backdrop-filter: blur(10px); border: 1px solid rgba(240,185,120,.5); border-radius: 14px; padding: 10px 11px 11px;
  color: #ead9c6; font: 13px/1.45 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
#tally-card .th { color: #f0b978; font-weight: 600; letter-spacing: .5px; font-size: 12px; margin: 0 0 4px; }
#tally-card .ask { margin: 0 0 8px; color: #f6e3c8; }
#tally-card .row { display: flex; align-items: stretch; gap: 8px; margin: 0 0 8px; }
#tally-card .row .cbtn { flex: none; width: 56px; min-height: 52px; text-align: center; font-size: 24px; line-height: 1; padding: 0; }
#tally-card .num { flex: 1; display: flex; align-items: center; justify-content: center; text-align: center; min-height: 52px; border-radius: 12px;
  background: rgba(240,185,120,.1); color: #ffe9cf; font-size: 20px; font-weight: 600; }
#tally-card .sign { display: block; width: 100%; min-height: 50px; text-align: center; font-size: 14px; background: rgba(240,185,120,.22); border-color: rgba(240,185,120,.7); color: #ffd9ac; }
#tally-card .ship, #tally-card .msg { margin: 8px 0 0; font-size: 12px; color: #a8917b; }
#tally-card .msg { color: #ffd9ac; }
/* on a phone the card sits under the status card, like the Talk panel: the thumbstick and the action buttons keep the bottom of the screen */
@media(max-width:520px){ #tally-card { top: calc(var(--hud-bottom, 60px) + 8px); bottom: auto; } }
`;

export class TallyUI {
  /** o: { tracker (MissionTracker), walker, space, portSite, ship (shipSystem), request(action) -> Promise<{ ok, msg, wrong?, hand? }>, onToggle?() } */
  constructor(o) {
    Object.assign(this, o);
    this.key = null; this.n = 0; this.msg = ''; this.busy = false; this.shown = false; this._acc = 1; this._sig = '';
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const el = this.el = document.createElement('div'); el.id = 'tally-card'; el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'Tally');
    el.innerHTML = `<p class="th"></p><p class="ask"></p><div class="row"><button class="cbtn" data-a="less" aria-label="One fewer">&minus;</button><div class="num" role="status" aria-live="polite"></div><button class="cbtn" data-a="more" aria-label="One more">+</button></div><button class="cbtn sign" data-a="sign">Sign the tally</button><p class="ship"></p><p class="msg" role="status" aria-live="polite"></p>`;
    document.body.appendChild(el);
    this.q = { th: el.querySelector('.th'), ask: el.querySelector('.ask'), num: el.querySelector('.num'), ship: el.querySelector('.ship'), msg: el.querySelector('.msg'),
      less: el.querySelector('[data-a="less"]'), more: el.querySelector('[data-a="more"]'), sign: el.querySelector('[data-a="sign"]') };
    bindActivation(this.q.less, () => this.bump(-1));
    bindActivation(this.q.more, () => this.bump(1));
    bindActivation(this.q.sign, () => this.sign());
    for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation());       // a press on the card is not a look-around drag
  }

  /** The tally step the player is on and standing at, or null. */
  here() {
    const a = this.tracker.active(); if (!a || !a.step || a.step.k !== 'count') return null;
    const t = tallyOf(a.step.tally); if (!t || (this.ship && this.ship.aboard)) return null;
    const d = distanceTo(resolve(a.step.to), this.space.frameId, this.walker.worldPos, this.portSite);
    return d <= a.step.r ? { key: a.step.tally, t, id: a.m.id } : null;
  }
  tick(dt) {
    this._acc += dt; if (this._acc < 0.25) return; this._acc = 0;
    const h = this.here(), talk = document.getElementById('crew-panel'), covered = !!talk && talk.style.display === 'block';
    if (!h || covered) { if (this.shown) { this.shown = false; this.el.style.display = 'none'; this.onToggle?.(); } if (!h) { this.key = null; this.msg = ''; } return; }
    if (h.key !== this.key) { this.key = h.key; this.n = 0; this.msg = ''; }       // a new stand: the sheet starts empty
    this.t = h.t;
    this.draw();
  }
  bump(d) { if (!this.t || this.busy) return; this.n = Math.max(0, Math.min(this.t.max, this.n + d)); this.msg = ''; this.draw(); }
  async sign() {
    if (!this.t || this.busy) return;
    this.busy = true; this.draw();
    let r = null;
    try { r = await this.request({ type: 'mission-count', n: this.n }); } catch (e) { r = { ok: false, msg: 'The shared world did not answer. Try again.' }; }
    this.busy = false;
    // a newer client than the running game server: it does not know this action yet
    if (r && !r.ok && /Unsupported|Unknown action|no such/i.test(r.msg || '')) this.msg = 'The tally hand has no sheet for this yet. Try again in a little while.';
    else if (r && (r.wrong || !r.ok)) this.msg = r.hand || r.msg || 'Look again.';
    else this.msg = '';                                                            // right: the job moves on and the card goes with it
    this.draw();
  }
  draw() {
    const t = this.t, q = this.q; if (!t) return;
    const ship = yardShipWords(this.key, worldTimeS());
    const sig = [this.key, this.n, this.msg, ship, this.busy].join('|');
    if (!this.shown) { this.shown = true; this.el.style.display = 'block'; this.onToggle?.(); }
    if (sig === this._sig) return; this._sig = sig;
    q.th.textContent = `TALLY · ${t.place.replace(/^the /, '').replace(/^./, (c) => c.toUpperCase())}`;
    q.ask.textContent = t.ask;
    q.num.textContent = tallyWords(this.key, this.n);
    q.less.disabled = this.busy || this.n <= 0; q.more.disabled = this.busy || this.n >= t.max; q.sign.disabled = this.busy;
    q.sign.textContent = this.busy ? 'The hand is reading it…' : 'Sign the tally';
    q.ship.textContent = ship;
    q.msg.textContent = this.msg; q.msg.style.display = this.msg ? 'block' : 'none';
  }
  /** For tests: what the card shows. */
  status() { return { shown: this.shown, key: this.key, n: this.n, msg: this.msg, busy: this.busy, words: this.t ? tallyWords(this.key, this.n) : '' }; }
}
