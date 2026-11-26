// ============================================================================
// freeflightUI.js — FREEFLIGHT: the flight HUD that makes manual flight playable on a phone.
//
// OWNS: the free-flight bar (the on/off switch, assist, target, throttle, jets, time compression) and the sky overlay (velocity
//       vector, retrograde, the target marker with distance / closing speed / ETA, the nose, and the predicted path), plus the
//       text lines the ship's HUD box shows (speed, height, orbit, fuel, delta-v).
// DOES NOT OWN: the physics (freeflight.js), where the buttons sit on a phone (ui/phoneLayout.js docks #ff-bar in the bottom row),
//       and the LIFT / SINK buttons (ship/shipUI.js): in free flight they read THRUST and BRAKE.
//
// One thumb: the left half of the screen is the stick (turns the ship; with RCS on, slides it). THRUST is held, BRAKE turns the ship
// retrograde on its own and burns the speed away. The bar is only on screen while you sit at the pilot or captain seat.
// ============================================================================

import * as THREE from 'three';
import { FREE } from './spaceSpec.js';
import { ASSISTS, TARGETS, BODIES, predictPath } from './freeflight.js';
import { bindActivation, guardSheetPress } from '../ui/activation.js';

const CSS = `
#ff-bar{position:fixed;left:50%;transform:translateX(-50%);width:min(540px,calc(100vw - 440px));min-width:320px;bottom:48px;z-index:71;display:block;padding:6px;background:#04141be8;border:1px solid #5fd8ff66;border-radius:12px;
  color:#d8f6ff;font:11px ui-monospace,"SF Mono",Menlo,Consolas,monospace;touch-action:manipulation}
#ff-bar .ffrow{display:flex;gap:5px;margin:3px 0;flex-wrap:nowrap}
#ff-bar button{flex:1 1 0;min-width:0;min-height:44px;margin:0;padding:4px 3px;background:#12333f;color:#d8f6ff;border:1px solid #5fd8ff66;border-radius:8px;font:inherit;font-size:11px;line-height:1.2}
#ff-bar button.on{background:#1f6f86;border-color:#8fe8ff}
#ff-bar button.warn{border-color:#ff9f6a;color:#ffd8c2}
#ff-bar button:active{background:#2a8aa6}
#ff-bar .ffnote{padding:2px 4px;color:#8fc8d8}
#ff-bar .ffrow[hidden],#ff-bar .ffnote[hidden],#ff-bar[hidden]{display:none!important}
#ff-bar .warpc{display:none}
/* a phone on its side has no height to spare: one row, the compression is one button that steps through the choices */
@media (max-height:480px) and (orientation:landscape){#ff-bar{display:flex;flex-wrap:nowrap;gap:5px;padding:4px}#ff-bar[hidden]{display:none!important}#ff-bar .ffrow:not([hidden]){display:contents}#ff-bar .ffnote{display:none!important}#ff-bar [data-a=warp]{display:none}#ff-bar .warpc{display:block}}
#ff-bar .fftip{font-size:11px;color:#ffe1bb;background:#3a2a14;border:1px solid #ba936a;border-radius:8px;padding:5px 8px;margin-bottom:5px;text-align:center}#ff-bar .fftip[hidden]{display:none!important}
#ff-overlay{position:fixed;inset:0;width:100%;height:100%;z-index:64;pointer-events:none;display:none}
@media (max-width:520px){#ff-bar{left:12px;right:12px;width:auto;transform:none;bottom:112px;font-size:10px}#ff-bar button{font-size:10px;padding:2px}}
/* FREEFLIGHT VIEW (phone, html.ff-fly while she flies): the status box folds to the two lines a pilot reads (a tap opens everything, the pilot
   strip and World / Controls with it), the flying buttons gather in the bottom-right corner where the right thumb is, the bar is two short rows,
   and the left of the screen is the stick. The sky, the ship and the markers own the middle. */
#hud-ff{display:none}
html.ff-fly #hud-ff{display:block;pointer-events:auto;cursor:pointer;-webkit-user-select:none;user-select:none;font:600 11px/1.5 ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:#d8f6ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:33px}
html.ff-fly #hud-ff .w{color:#ff8a73}html.ff-fly #hud-ff .d{color:#8fc8d8;font-weight:400}
html.ff-fly #hud-ff .more{float:right;margin-left:10px;color:#5fd8ff}
html.ff-fly.ff-open #hud-ff{border-bottom:1px solid rgba(95,216,255,.3);margin-bottom:6px;padding-bottom:4px}
html.ff-fly:not(.ff-open) #hud{padding:5px 10px;background:rgba(4,20,27,.72);border-color:rgba(95,216,255,.35);max-width:calc(100vw - 106px)}
html.ff-fly:not(.ff-open) #hud>:not(#hud-ff){display:none!important}
html.ff-fly:not(.ff-open) #ship-panel{display:none!important}
html.ff-fly:not(.ff-open) #phone-ui #dock-left{visibility:hidden}
html.ff-fly #phone-ui #dock-right{flex-direction:row-reverse;flex-wrap:wrap-reverse;align-content:flex-start;justify-content:flex-start;width:180px}
html.ff-fly #phone-ui #dock-right>.dk{min-width:86px!important;width:86px;max-width:86px;order:9!important}
html.ff-fly #phone-ui #dock-right>#btn-lift{order:0!important}html.ff-fly #phone-ui #dock-right>#btn-sink{order:1!important}
html.ff-fly #phone-ui #dock-right>#btn-boost{order:2!important}html.ff-fly #phone-ui #dock-right>#btn-fire{order:3!important}html.ff-fly #phone-ui #dock-right>#btn-action{order:4!important}
@media (orientation:portrait){
  html.ff-fly #ff-bar{display:flex;flex-wrap:wrap;gap:5px;padding:5px}html.ff-fly #ff-bar[hidden]{display:none!important}
  html.ff-fly #ff-bar .ffrow:not([hidden]){display:contents}html.ff-fly #ff-bar .ffnote,html.ff-fly #ff-bar .warpc{display:none!important}
  html.ff-fly #ff-bar button{flex:1 1 calc(25% - 5px);min-height:40px}
  html.ff-fly #ff-bar [data-a=rcs],html.ff-fly #ff-bar [data-a=warp]{flex-basis:calc(16.6% - 5px)}
  html.ff-fly #ff-bar.armed [data-a=toggle],html.ff-fly #ff-bar .fftip{flex-basis:100%;margin:0}
}
@media (max-height:520px) and (orientation:landscape){html.ff-fly #fly-bar{left:auto;right:calc(98px + env(safe-area-inset-right,0px));transform:none}}
`;
const fmtD = (m) => (!Number.isFinite(m) ? '—' : Math.abs(m) >= 1e7 ? `${(m / 1000).toFixed(0)} km` : Math.abs(m) >= 1e5 ? `${(m / 1000).toFixed(0)} km` : Math.abs(m) >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
const fmtV = (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(2)} km/s` : `${Math.round(v)} m/s`);
export const fmtT = (s) => (!Number.isFinite(s) ? '—' : s >= 5400 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} m` : s >= 120 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`);
const FFHINT = 'W/S pitch · A/D turn · Q/E roll · Space thrust · C brake · J L I K U O jets · V view · P free flight off · X stand';
const ASSIST_LABEL = { off: 'OFF', prograde: 'PROGRADE', retro: 'RETRO', target: 'TARGET' };
const THROTTLES = [0.25, 0.5, 1];

const _q = new THREE.Quaternion(), _d = new THREE.Vector3();

/** The free-flight read-outs as plain lines [{ text, hot }]: speed, height, orbit, target, fuel. The overlay draws them; the validator reads them. */
export function ffTextLines(ff) {
  if (!ff.active) return [];
  const t = ff.telemetry(), tg = t.target, lines = [];
  lines.push({ hot: true, text: `SPD ${fmtV(t.speed)} · ${t.nearName} ${fmtD(t.alt)} up${t.closing > 0.5 ? ` · falling ${fmtV(t.closing)}` : t.closing < -0.5 ? ` · rising ${fmtV(-t.closing)}` : ''}${t.eff > 1 ? ` · ×${t.eff}` : ''}` });
  lines.push({ text: t.bound ? `orbit ${t.ref}: Pe ${fmtD(t.periM)} · Ap ${fmtD(t.apoM)} · ${fmtT(t.periodS)}` : `escaping ${t.ref}` });
  lines.push({ text: `→ ${tg.name} ${fmtD(tg.surfaceM)} · ${tg.closing >= 0 ? 'closing' : 'leaving'} ${fmtV(Math.abs(tg.closing))} · rel ${fmtV(tg.relSpeed ?? 0)} · ETA ${fmtT(tg.etaS)}` });
  lines.push({ hot: t.fuel < 0.15, text: `FUEL ${Math.round(t.fuel * 100)}% · Δv ${fmtV(t.dvLeft)}${t.inAir ? ' · IN MARS AIR, drive cut' : ''}` });
  return lines;
}
/** What the ship's HUD box adds: nothing. The bar says it is armed and the sky overlay carries the read-outs, so the box (and the status strip under it) stay as they were. */
export function ffHudLines() { return ''; }

export class FreeFlightUI {
  constructor(space) {
    this.space = space; this.acc = 0; this._sig = ''; this._pathAt = -9; this.path = null;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const bar = document.createElement('div'); bar.id = 'ff-bar'; bar.hidden = true; document.body.appendChild(bar);
    this.bar = bar; guardSheetPress(bar);
    bar.addEventListener('pointerdown', (e) => e.stopPropagation());
    const cv = document.createElement('canvas'); cv.id = 'ff-overlay'; document.body.appendChild(cv);
    this.cv = cv; this.ctx = cv.getContext('2d');
    this._build();
    // FREEFLIGHT keys: P arms / disarms free flight from the pilot or captain seat; X stands up while the ship is flying (E is roll then).
    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.code === 'KeyP' && this._seated() && !(this.space.trip && this.space.trip.active)) this.space.ffCommand({ enabled: !this.ff.enabled });
      else if (e.code === 'KeyX' && this.ship.seat) this.ship.interact();
    });
  }

  /** True while the pilot is flying: E must roll, never stand. Parked and not armed, E stands as before. */
  eIsRoll() {
    const f = this.ship.flight;
    return this._seated() && (this.ff.enabled || this.ff.active || !(f && f.landed));
  }

  get ff() { return this.space.ff; }
  get ship() { return this.space.ship; }
  _seated() { const s = this.ship.seat; return !!s && ['pilot', 'captain'].includes(s.id) && this.ship.aboard; }

  _build() {
    const bar = this.bar, mk = (a, txt, extra = '') => `<button data-a="${a}" ${extra}>${txt}</button>`;
    bar.innerHTML = `<div class="ffnote" id="ff-note"></div><div class="fftip" id="ff-tip" hidden></div>
      <div class="ffrow" id="ff-row1">${mk('toggle', 'FREE FLIGHT')}${mk('assist', 'ASSIST')}${mk('target', 'TARGET')}</div>
      <div class="ffrow" id="ff-row2">${mk('thr', 'THR')}${mk('rcs', 'RCS')}</div>
      <div class="ffrow" id="ff-warps">${FREE.warps.map((w) => mk('warp', '×' + w, `data-w="${w}"`)).join('')}${mk('warpc', '×1', 'class="warpc"')}</div>`;
    for (const b of bar.querySelectorAll('button')) bindActivation(b, () => this._press(b));
    this.els = { note: bar.querySelector('#ff-note'), tip: bar.querySelector('#ff-tip'), row1: bar.querySelector('#ff-row1'), row2: bar.querySelector('#ff-row2'), warps: bar.querySelector('#ff-warps'),
      toggle: bar.querySelector('[data-a=toggle]'), assist: bar.querySelector('[data-a=assist]'), target: bar.querySelector('[data-a=target]'),
      thr: bar.querySelector('[data-a=thr]'), rcs: bar.querySelector('[data-a=rcs]'), warpc: bar.querySelector('[data-a=warpc]') };
  }

  _press(b) {
    const sp = this.space, ff = this.ff, a = b.dataset.a;
    if (a === 'toggle') sp.ffCommand({ enabled: !ff.enabled });
    else if (a === 'assist') sp.ffCommand({ assist: ASSISTS[(ASSISTS.indexOf(ff.assist) + 1) % ASSISTS.length] });
    else if (a === 'target') sp.ffCommand({ target: TARGETS[(TARGETS.indexOf(ff.target) + 1) % TARGETS.length] });
    else if (a === 'thr') { const i = THROTTLES.findIndex((t) => Math.abs(t - ff.throttle) < 0.01); sp.ffCommand({ throttle: THROTTLES[(i + 1) % THROTTLES.length] }); }
    else if (a === 'rcs') this.ship.ffRcs = !this.ship.ffRcs;
    else if (a === 'warp') sp.ffCommand({ warp: Number(b.dataset.w) });
    else if (a === 'warpc') sp.ffCommand({ warp: FREE.warps[(FREE.warps.indexOf(ff.warp) + 1) % FREE.warps.length] });
    this._sig = '';
  }

  update(dt) {
    const ff = this.ff, seated = this._seated(), show = seated && !(this.space.trip && this.space.trip.active);
    this.bar.hidden = !show;
    if (ff.enabled) { try { localStorage.setItem('cosmos.ffUsed', '1'); } catch { /* private mode: the tip just keeps showing */ } this._used = true; }
    if (this._used === undefined) { try { this._used = localStorage.getItem('cosmos.ffUsed') === '1'; } catch { this._used = false; } }
    if (this.els.tip) {
      const showTip = show && !this._used && !ff.enabled && !ff.active;
      this.els.tip.hidden = !showTip;
      if (showTip && !this.els.tip.textContent) this.els.tip.textContent = window.matchMedia && matchMedia('(pointer: coarse)').matches
        ? 'Free flight: tap FREE FLIGHT below, then hold LIFT to climb out of the air.'
        : 'Free flight: press P (or click FREE FLIGHT), then hold Space to climb out of the air.';
    }
    const overlay = show && ff.active;
    this.cv.style.display = overlay ? 'block' : 'none';
    // THRUST and BRAKE: the same two buttons that read LIFT and SINK on the ground
    const lift = document.getElementById('btn-lift'), sink = document.getElementById('btn-sink');
    const want = ff.active && seated ? ['THRUST ▲', 'BRAKE ▼'] : ['LIFT ▲', 'SINK ▼'];
    if (lift && lift.textContent !== want[0]) { lift.textContent = want[0]; sink.textContent = want[1]; }
    const hint = document.getElementById('ship-hint');                  // the desktop key hint says what the keys do now
    if (hint) { if ((ff.active || ff.enabled) && seated) { if (this._hint0 === undefined) this._hint0 = hint.textContent; hint.textContent = ff.active ? FFHINT : this._hint0.replace('E stand', 'X stand · E rolls'); } else if (this._hint0 !== undefined) { hint.textContent = this._hint0; this._hint0 = undefined; } }
    // FREEFLIGHT VIEW: on a phone, while she flies (armed, in free flight, or off the ground at the stick), the compact flight layout (CSS above)
    const root = document.documentElement, fly = show && root.classList.contains('phone-ui') && this.eIsRoll();
    if (fly !== this._fly) { this._fly = fly; root.classList.toggle('ff-fly', fly); if (!fly) root.classList.remove('ff-open'); this._miniSig = ''; }
    this.bar.classList.toggle('armed', ff.enabled && !ff.active);
    if (fly) { this.miniAcc = (this.miniAcc || 0) + dt; if (this.miniAcc >= 0.25 || !this._miniSig) { this.miniAcc = 0; this._mini(); } }
    if (!show) return;
    this.acc += dt;
    if (this.acc >= 0.25) { this.acc = 0; this._draw(); }
    if (overlay) { const t0 = performance.now(); this._overlay(dt); const ms = performance.now() - t0, st = this.stat || (this.stat = { n: 0, ms: 0, max: 0 }); st.n++; st.ms += ms; if (ms > st.max) st.max = ms; }   // (dev read-out: cosmos.space.ffUI.stat)
  }

  _draw() {
    const ff = this.ff, sp = this.space, e = this.els, rcs = !!this.ship.ffRcs;
    const sig = [ff.enabled, ff.active, ff.assist, ff.target, ff.throttle, ff.warp, ff.eff, rcs].join('|');
    if (sig === this._sig) return; this._sig = sig;
    e.toggle.textContent = ff.enabled ? (ff.active ? 'FREE FLIGHT · ON' : 'ARMED · tap to cancel') : 'FREE FLIGHT';
    e.toggle.classList.toggle('on', ff.enabled);
    for (const b of [e.assist, e.target]) b.hidden = !ff.active;
    e.row2.hidden = !ff.active; e.warps.hidden = !ff.enabled;   // an armed ship climbs under compression too
    e.warpc.textContent = '×' + ff.warp + (ff.eff < ff.warp ? ' (×' + ff.eff + ')' : '');
    e.assist.textContent = 'ASSIST ' + ASSIST_LABEL[ff.assist]; e.assist.classList.toggle('on', ff.assist !== 'off');
    e.target.textContent = '→ ' + BODIES[ff.target].name.toUpperCase();
    e.thr.textContent = 'THR ' + Math.round(ff.throttle * 100) + '%';
    e.rcs.textContent = rcs ? 'RCS · SLIDE' : 'RCS · TURN'; e.rcs.classList.toggle('on', rcs);
    for (const b of e.warps.querySelectorAll('button')) { const w = Number(b.dataset.w); b.classList.toggle('on', w === ff.warp); b.classList.toggle('warn', w === ff.warp && ff.eff < w); b.setAttribute('aria-pressed', String(w === ff.warp)); }
    e.note.textContent = ff.active ? '' : (ff.enabled ? 'Armed: climb above the air and she is yours.' : '');
    e.note.hidden = !e.note.textContent;
  }

  // ---- FREEFLIGHT VIEW: the folded status box on a phone -----------------------------------------------------------------------
  /** The two lines that stand in for the status box while she flies: speed, height, climb or sink, and the target (or what the stick
   *  flight is doing). A tap opens the whole box, the pilot strip and the free-flight read-outs; another tap folds them again. */
  _mini() {
    let el = document.getElementById('hud-ff');
    const hud = document.getElementById('hud');
    if (!el) {
      if (!hud) return;
      el = document.createElement('div'); el.id = 'hud-ff'; el.setAttribute('role', 'button'); el.setAttribute('aria-label', 'Flight read-out. Tap for the whole status.');
      hud.prepend(el);
      for (const ev of ['pointerdown', 'touchstart']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });     // a press here is not a look-around drag
      bindActivation(el, () => { document.documentElement.classList.toggle('ff-open'); this._miniSig = ''; this._mini(); });
    } else if (el.parentElement !== hud && hud) hud.prepend(el);
    const ff = this.ff, f = this.ship.flight, open = document.documentElement.classList.contains('ff-open');
    const vert = (v) => (Math.abs(v) < 0.5 ? 'level' : (v > 0 ? '▲' : '▼') + fmtV(Math.abs(v)));
    let l1, l2;
    if (ff.active) {
      const t = ff.telemetry(), tg = t.target;
      l1 = `SPD ${fmtV(t.speed)} · ALT ${fmtD(t.alt)} · ${vert(t.vertical)}`;
      l2 = t.inAir ? `<span class="w">In the air: the drive will not light</span>${t.eff > 1 ? ' · ×' + t.eff : ''}`
        : `→ ${tg.name.toUpperCase()} ${fmtD(tg.surfaceM)}${tg.etaS < 1e7 ? ' · ETA ' + fmtT(tg.etaS) : tg.closing < 0 ? ' · leaving' : ''}${t.eff > 1 ? ' · ×' + t.eff : ''}` +
          (t.fuel < 0.15 ? ` · <span class="w">FUEL ${Math.round(t.fuel * 100)}%</span>` : '');
    } else {
      const why = f.canLiftOff && !f.canLiftOff() ? (this.ship.liftBlockReason?.() || "Can't lift: route more power to the engines.") : '';
      l1 = `SPD ${fmtV(f.speed || 0)} · ALT ${fmtD(Math.max(0, f.agl || 0))} · ${vert(f.verticalSpeed || 0)}`;
      l2 = why ? `<span class="w">${why}</span>` : ff.enabled ? 'ARMED · free flight above the air'
        : `<span class="d">${this.ship.flightMode === 'assist' ? 'ASSIST' : 'NEWTONIAN'}${this.ship.landAssist ? ' · LANDING' : ''} · gear ${f.gearPos > 0.99 ? 'down' : f.gearPos < 0.01 ? 'up' : 'moving'}</span>`;
    }
    const html = `${l1}<br><span class="more">${open ? '▴' : '▾'}</span>${l2}`;
    if (html !== this._miniSig) { this._miniSig = html; el.innerHTML = html; }
  }

  // ---- the sky overlay ------------------------------------------------------------------------------------------------------
  _overlay() {
    const ff = this.ff, cv = this.cv, eng = this.space.engine, cam = eng.camera;
    const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = this.ctx; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    cam.updateMatrixWorld(); cam.getWorldQuaternion(_q); _q.invert();
    const camS = eng.cameraIn(eng.rootFrame, this._cam || (this._cam = {})), tanY = Math.tan((cam.fov * Math.PI / 180) / 2), tanX = tanY * (cam.aspect || W / H);
    const proj = (dx, dy, dz) => {               // a direction in the Mars frame -> screen
      _d.set(dx, dy, dz).applyQuaternion(_q);
      const front = _d.z < 0, k = front ? 1 / -_d.z : 0;
      return { front, x: front ? (_d.x * k / tanX + 1) / 2 * W : 0, y: front ? (1 - _d.y * k / tanY) / 2 * H : 0, cx: _d.x, cy: _d.y };
    };
    // the sky the markers may use: under the read-outs, above the bar, inside the sides (a clamped marker stays where a thumb is not)
    const hudB = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--strip-bottom')) || parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hud-bottom')) || 64, phone = document.documentElement.classList.contains('phone-ui');
    // FREEFLIGHT VIEW: folded (a phone in flight), the read-outs are the status box's two lines and are not drawn here. The view chip and the
    // flying buttons are kept clear: a marker that would sit under one becomes an edge arrow beside it, pointing at where it really is.
    const root = document.documentElement, folded = root.classList.contains('ff-fly') && !root.classList.contains('ff-open');
    const fbEl = document.getElementById('fly-bar'), fr = fbEl && getComputedStyle(fbEl).display !== 'none' ? fbEl.getBoundingClientRect() : null, chip = fr && fr.height > 0 ? fr : null;
    const avoid = chip ? [chip] : [];
    if (phone) { const dr = document.getElementById('dock-right'), r = dr && dr.getBoundingClientRect(); if (r && r.height > 0) avoid.push(r); }
    const barTop = this.bar.getBoundingClientRect().top || H, textH = folded ? 0 : 4 * 15 + 8;
    let y0 = hudB + (phone ? 8 : 6);
    if (!folded && chip && chip.left < W / 2 && chip.top < H / 2) y0 = Math.max(y0, chip.bottom + 6);       // the read-outs start under the view chip
    const L = 22, Rr = W - 22, T = y0 + textH + 6, Bm = Math.max(T + 80, Math.min(H - 20, barTop - 14));
    const edge = (p) => {                         // clamp to that box; the arrow points the way
      const cx = (L + Rr) / 2, cyy = (T + Bm) / 2, ang = Math.atan2(-p.cy, p.cx);
      let x = p.front ? p.x : cx + Math.cos(ang) * 1e4, y = p.front ? p.y : cyy + Math.sin(ang) * 1e4, off = !p.front;
      if (x < L || x > Rr || y < T || y > Bm) { off = true; const s = Math.max(Math.abs(x - cx) / ((Rr - L) / 2), Math.abs(y - cyy) / ((Bm - T) / 2)); x = cx + (x - cx) / s; y = cyy + (y - cyy) / s; }
      let a = Math.atan2(y - cyy, x - cx), side = null;
      for (const r of avoid) {
        const m = 12; if (x < r.left - m || x > r.right + m || y < r.top - m || y > r.bottom + m) continue;
        const tx = p.front ? p.x : x, ty = p.front ? p.y : y;
        const c = [[r.left - m - 4, y], [r.right + m + 4, y], [x, r.top - m - 4], [x, r.bottom + m + 4]].filter(([qx, qy]) => qx >= L && qx <= Rr && qy >= T && qy <= Bm)
          .sort((u, v) => Math.hypot(u[0] - x, u[1] - y) - Math.hypot(v[0] - x, v[1] - y))[0];
        if (!c) continue;
        x = c[0]; y = c[1]; off = true; a = Math.hypot(tx - x, ty - y) > 2 ? Math.atan2(ty - y, tx - x) : a;
        side = x < r.left ? 'left' : x > r.right ? 'right' : null;            // its label goes on the side away from the button
      }
      return { x, y, off, ang: a, side };
    };
    // the read-outs
    g.font = '600 11px ui-monospace,"SF Mono",Menlo,Consolas,monospace'; g.textAlign = 'left';
    if (!folded) ffTextLines(ff).forEach((l, i) => { const x = 12, y = y0 + 12 + i * 15, w = g.measureText(l.text).width; g.fillStyle = 'rgba(2,12,16,.62)'; g.fillRect(x - 5, y - 11, Math.min(w, W - 24) + 10, 15); g.fillStyle = l.hot ? '#ffd78a' : '#cfeaf2'; g.fillText(l.text, x, y, W - 24); });
    const t = ff.telemetry();
    // the predicted path, re-flown a few times a second (it costs a hundred gravity evaluations)
    const now = performance.now();
    if (!this.path || now - this._pathAt > 400) {
      this._pathAt = now;
      const per = t.bound && Number.isFinite(t.periodS) ? Math.min(t.periodS * 1.02, 6 * 3600) : 3000;
      this.path = predictPath(ff.shipS(), ff.f.vel, { n: 140, horizonS: t.nearId !== 'mars' ? 1800 : per, T: ff.timeS() });
    }
    const pts = this.path.points;
    g.lineWidth = 2; g.strokeStyle = 'rgba(120,230,255,.75)'; g.setLineDash([8, 6]);
    g.beginPath(); let pen = false;
    for (const p of pts) {
      const s = proj(p.x - camS.x, p.y - camS.y, p.z - camS.z);
      if (s.front && Math.abs(s.x - W / 2) < W * 3 && Math.abs(s.y - H / 2) < H * 3) { if (!pen) { g.moveTo(s.x, s.y); pen = true; } else g.lineTo(s.x, s.y); } else pen = false;
    }
    g.stroke(); g.setLineDash([]);
    if (this.path.hit) {
      const hb = BODIES[this.path.hit.body], hp = pts[pts.length - 1];
      if (hp) { const s = proj(hp.x - camS.x, hp.y - camS.y, hp.z - camS.z); if (s.front) { g.strokeStyle = '#ff8a5a'; g.lineWidth = 2; g.strokeRect(s.x - 7, s.y - 7, 14, 14); this._label(g, `IMPACT ${hb.name} in ${fmtT(this.path.hit.t)}`, s.x + 10, s.y - 10, '#ffb08a'); } }
    }
    // the nose, prograde, retrograde
    const nose = _d.set(0, 0, -1).applyQuaternion(ff.f.quaternion);
    this._mark(g, edge(proj(nose.x * 1e6, nose.y * 1e6, nose.z * 1e6)), 'nose', '#e8ffe8');
    if (t.prograde) {
      const p = t.prograde, ps = edge(proj(p.x * 1e6, p.y * 1e6, p.z * 1e6)), rs = edge(proj(-p.x * 1e6, -p.y * 1e6, -p.z * 1e6));
      this._mark(g, ps, 'prograde', '#7dff9c'); this._mark(g, rs, 'retro', '#ffb26b');
    }
    // the target: where it is, how far, how fast it is coming, how long
    const tg = t.target, tb = BODIES[tg.id], tc = ff._kin(tb).c, s = edge(proj(tc.x - camS.x, tc.y - camS.y, tc.z - camS.z));
    if (tg.dir && tb.id !== 'mars') this._mark(g, edge(proj(tg.dir.x * 1e6, tg.dir.y * 1e6, tg.dir.z * 1e6)), 'retro', '#9cf1ff');     // the intercept: where it will be when she gets there (the TARGET assist steers for it)
    this._mark(g, s, 'target', '#5fd8ff', `${tb.name.toUpperCase()}  ${fmtD(tg.surfaceM)}  ${tg.closing >= 0 ? '▼' : '▲'}${fmtV(Math.abs(tg.closing))}  ${tg.etaS < 1e7 ? 'ETA ' + fmtT(tg.etaS) : ''}`);
  }

  _label(g, txt, x, y, col) { g.font = '600 11px ui-monospace,Menlo,Consolas,monospace'; g.fillStyle = 'rgba(2,12,16,.7)'; const w = g.measureText(txt).width; g.fillRect(x - 3, y - 11, w + 6, 15); g.fillStyle = col; g.fillText(txt, x, y); }
  _mark(g, s, kind, col, label = '') {
    g.save(); g.translate(s.x, s.y); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2;
    if (s.off) {                                         // off screen: an arrow on the edge pointing the way
      g.rotate(s.ang); g.beginPath(); g.moveTo(10, 0); g.lineTo(-6, -7); g.lineTo(-6, 7); g.closePath(); g.fill(); g.rotate(-s.ang);
      if (kind === 'target') { const lt = s.side ? s.side === 'left' : s.x > innerWidth / 2; g.font = '600 10px ui-monospace,Menlo,Consolas,monospace'; g.fillStyle = col; g.textAlign = lt ? 'right' : 'left'; g.fillText(label.split('  ')[0], lt ? -14 : 14, 4); g.textAlign = 'left'; }
      g.restore(); return;
    }
    if (kind === 'prograde') { g.beginPath(); g.arc(0, 0, 9, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, 2, 0, 7); g.fill(); for (const a of [0, 1.5708, 3.1416]) { g.beginPath(); g.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); g.lineTo(Math.cos(a) * 15, Math.sin(a) * 15); g.stroke(); } }
    else if (kind === 'retro') { g.beginPath(); g.arc(0, 0, 9, 0, 7); g.stroke(); g.beginPath(); g.moveTo(-5, -5); g.lineTo(5, 5); g.moveTo(5, -5); g.lineTo(-5, 5); g.stroke(); }
    else if (kind === 'nose') { g.beginPath(); g.moveTo(-8, 0); g.lineTo(-3, 0); g.moveTo(8, 0); g.lineTo(3, 0); g.moveTo(0, -8); g.lineTo(0, -3); g.moveTo(0, 8); g.lineTo(0, 3); g.stroke(); }
    else if (kind === 'target') { g.beginPath(); g.moveTo(0, -11); g.lineTo(11, 0); g.lineTo(0, 11); g.lineTo(-11, 0); g.closePath(); g.stroke(); g.font = '600 11px ui-monospace,Menlo,Consolas,monospace'; const lw = g.measureText(label).width + 6; this._label(g, label, s.x + lw + 20 > innerWidth ? -lw - 8 : 14, 4, col); }
    g.restore();
  }
}
