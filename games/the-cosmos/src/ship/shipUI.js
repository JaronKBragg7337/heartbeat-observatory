// ============================================================================
// shipUI.js — the controls that appear when you sit down, and vanish when you
// stand up.
//
// OWNS: the DOM overlays for the stations: hold-buttons (lift, sink, fire), the
//       station panels (navigation map, engineering power routing, comms log),
//       the gun reticle, and the desktop key hints.
// DOES NOT OWN: what any control DOES. Every button calls into the ship, which
//       asks shipStations.js whether the person is allowed to. A button that is
//       on screen but for the wrong seat would simply be refused.
//
// Same rule as the rest of the game's touch design: nothing sits on screen
// waiting to be used. Standing in a corridor there is no UI at all; sitting at
// the pilot seat you get exactly the buttons a pilot needs, sized for a thumb.
// ============================================================================

import { ShipScreens } from './shipScreens.js';
import { SHIP_PHYS } from './shipSpec.js';

const CSS = `
#ship-ui { position: fixed; inset: 0; pointer-events: none; z-index: 65; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
#ship-ui .sbtn {
  pointer-events: auto; position: fixed; display: none; user-select: none; -webkit-user-select: none; touch-action: none;
  background: rgba(10,7,5,.66); backdrop-filter: blur(7px);
  border: 1px solid rgba(95,216,255,.45); color: #bfefff;
  border-radius: 12px; font: inherit; font-size: 12px; letter-spacing: .5px;
  min-width: 78px; min-height: 52px; padding: 8px 12px; text-align: center; line-height: 1.25;
}
#ship-ui .sbtn:active, #ship-ui .sbtn.held { background: rgba(95,216,255,.28); }
#ship-ui .sbtn.fire { border-color: rgba(255,120,90,.7); color: #ffd6c9; min-width: 96px; min-height: 64px; font-size: 14px; }
#ship-ui .sbtn.fire:active, #ship-ui .sbtn.fire.held { background: rgba(255,90,60,.4); }
#btn-lift { right: calc(14px + env(safe-area-inset-right, 0px)); bottom: calc(150px + env(safe-area-inset-bottom, 0px)); }
#btn-sink { right: calc(14px + env(safe-area-inset-right, 0px)); bottom: calc(84px + env(safe-area-inset-bottom, 0px)); }
#btn-fire { right: calc(106px + env(safe-area-inset-right, 0px)); bottom: calc(84px + env(safe-area-inset-bottom, 0px)); }
#ship-reticle { position: fixed; left: 50%; top: 50%; width: 46px; height: 46px; margin: -23px 0 0 -23px; display: none; pointer-events: none; }
#ship-reticle i { position: absolute; background: rgba(255,214,120,.9); }
#ship-reticle i:nth-child(1) { left: 21px; top: 0; width: 2px; height: 14px; }
#ship-reticle i:nth-child(2) { left: 21px; bottom: 0; width: 2px; height: 14px; }
#ship-reticle i:nth-child(3) { top: 21px; left: 0; height: 2px; width: 14px; }
#ship-reticle i:nth-child(4) { top: 21px; right: 0; height: 2px; width: 14px; }
#ship-reticle b { position: absolute; left: 20px; top: 20px; width: 4px; height: 4px; border-radius: 50%; background: rgba(255,214,120,.95); }
#ship-panel {
  position: fixed; left: calc(10px + env(safe-area-inset-left, 0px)); bottom: calc(66px + env(safe-area-inset-bottom, 0px));
  width: min(300px, calc(100vw - 210px)); min-width: 176px;
  background: rgba(4,20,27,.86); backdrop-filter: blur(9px);
  border: 1px solid rgba(95,216,255,.4); border-radius: 12px; padding: 9px 10px; color: #d8f6ff;
  font-size: 11px; line-height: 1.5; display: none; pointer-events: auto; max-height: 46vh; overflow: hidden;
}
#ship-panel h3 { margin: 0 0 6px; font-size: 10px; letter-spacing: 2px; color: #5fd8ff; font-weight: 600; }
#ship-panel canvas { width: 100%; height: auto; display: block; border-radius: 8px; }
#ship-panel .row { display: flex; align-items: center; gap: 6px; margin: 5px 0; }
#ship-panel .row span.n { width: 66px; color: #9cd8e8; font-size: 10px; }
#ship-panel .bar { flex: 1; height: 16px; background: rgba(95,216,255,.12); border-radius: 4px; position: relative; overflow: hidden; }
#ship-panel .bar i { position: absolute; left: 0; top: 0; bottom: 0; }
#ship-panel .bar u { position: absolute; right: 5px; top: 0; line-height: 16px; text-decoration: none; font-size: 10px; color: #fff; }
#ship-panel .pm { pointer-events: auto; width: 40px; height: 40px; font: inherit; font-size: 18px; border-radius: 10px;
  background: rgba(95,216,255,.14); border: 1px solid rgba(95,216,255,.5); color: #d8f6ff; padding: 0; }
#ship-panel .pm:active { background: rgba(95,216,255,.4); }
#ship-panel .chips { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 6px; }
#ship-panel .chip { pointer-events: auto; flex: 1 1 auto; min-height: 36px; font: inherit; font-size: 10px; border-radius: 8px;
  background: rgba(95,216,255,.10); border: 1px solid rgba(95,216,255,.4); color: #d8f6ff; padding: 4px 6px; }
#ship-panel .chip:active { background: rgba(95,216,255,.4); }
#ship-panel .log div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#ship-panel .log .w { color: #ffb45a; }
#ship-panel .dim { color: #6fa3b3; }
#ship-hint { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(10px + env(safe-area-inset-bottom, 0px)); font-size: 10px; color: #a9d8e6;
  background: rgba(4,20,27,.6); border-radius: 8px; padding: 5px 10px; display: none; pointer-events: none; white-space: nowrap; }
#ship-toast { position: fixed; left: 50%; top: calc(64px + env(safe-area-inset-top, 0px)); transform: translateX(-50%); max-width: 84vw;
  font-size: 11px; color: #ffe9c9; background: rgba(10,7,5,.7); border: 1px solid rgba(240,185,120,.35); border-radius: 8px; padding: 6px 10px;
  opacity: 0; transition: opacity .25s; pointer-events: none; text-align: center; }
#ship-toast.on { opacity: 1; }
@media (max-width: 520px) {
  /* On a phone the thumbs own the bottom of the screen. The station panel sits at the top,
     under the status box, so it never covers LIFT, SINK, FIRE or Stand. */
  #ship-panel { width: calc(100vw - 20px); top: calc(88px + env(safe-area-inset-top, 0px)); bottom: auto; left: 10px; max-height: 40vh; }
  #ship-panel canvas { max-height: 24vh; width: auto; margin: 0 auto; }
  #ship-hint { display: none !important; }
}
`;

export class ShipUI {
  constructor(ship, opts = {}) {
    this.ship = ship;
    this.isTouch = !!opts.isTouch;
    this.fire = false;
    this.acc = 0;
    this.lastLogCount = 0;
    this.toastT = 0;
    this.seatId = null;

    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const root = document.createElement('div'); root.id = 'ship-ui';
    root.innerHTML = `
      <button class="sbtn" id="btn-lift">LIFT ▲</button>
      <button class="sbtn" id="btn-sink">SINK ▼</button>
      <button class="sbtn fire" id="btn-fire">FIRE</button>
      <div id="ship-reticle"><i></i><i></i><i></i><i></i><b></b></div>
      <div id="ship-panel"></div>
      <div id="ship-hint"></div>
      <div id="ship-toast"></div>`;
    document.body.appendChild(root);
    this.root = root;
    this.btnLift = root.querySelector('#btn-lift');
    this.btnSink = root.querySelector('#btn-sink');
    this.btnFire = root.querySelector('#btn-fire');
    this.reticle = root.querySelector('#ship-reticle');
    this.panel = root.querySelector('#ship-panel');
    this.hint = root.querySelector('#ship-hint');
    this.toast = root.querySelector('#ship-toast');

    const hold = (el, on, off) => {
      const down = (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add('held'); try { el.setPointerCapture(e.pointerId); } catch { /* ok */ } on(); };
      const up = (e) => { e.preventDefault(); e.stopPropagation(); el.classList.remove('held'); off(); };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', () => { el.classList.remove('held'); off(); });
    };
    hold(this.btnLift, () => { ship.uiLift = 1; }, () => { if (ship.uiLift > 0) ship.uiLift = 0; });
    hold(this.btnSink, () => { ship.uiLift = -1; }, () => { if (ship.uiLift < 0) ship.uiLift = 0; });
    hold(this.btnFire, () => { ship.fireHeld = true; }, () => { ship.fireHeld = false; });

    // Mouse fire on desktop: a click while the pointer is captured.
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0 && document.pointerLockElement && ship.seat) ship.fireHeld = true;
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) ship.fireHeld = false; });

    // a sound switch in the settings panel
    const sp = document.getElementById('settings-panel');
    if (sp && ship.audio) {
      const row = document.createElement('div'); row.className = 'set-row';
      row.innerHTML = '<label for="set-shipsound">Ship sound<span class="hint">Engines, guns, doors. Starts on your first touch.</span></label><input type="checkbox" id="set-shipsound">';
      sp.insertBefore(row, sp.querySelector('#btn-copy-coord'));
      const cb = row.querySelector('input'); cb.checked = ship.audio.on;
      cb.addEventListener('change', () => ship.audio.setOn(cb.checked));
    }
    this.panelKind = null;
    this.mapCanvas = null;
    ship.onStationChange = () => { this._rebuildPanel(); };
  }

  _showHint(text) { this.hint.textContent = text; this.hint.style.display = text && !this.isTouch ? 'block' : 'none'; }

  _rebuildPanel() {
    const s = this.ship.seat;
    const id = s ? s.id : null;
    this.seatId = id;
    const P = this.panel;
    P.innerHTML = '';
    this.mapCanvas = null;
    this.btnLift.style.display = this.btnSink.style.display = 'none';
    this.btnFire.style.display = 'none';
    this.reticle.style.display = 'none';
    this.ship.uiLift = 0; this.ship.fireHeld = false;
    if (!s) { P.style.display = 'none'; this._showHint(''); return; }

    const flying = id === 'captain' || id === 'pilot';
    const gun = id === 'captain' || id === 'gun_dorsal' || id === 'gun_ventral';
    if (flying) { this.btnLift.style.display = this.btnSink.style.display = 'block'; }
    if (gun) { this.btnFire.style.display = 'block'; this.reticle.style.display = 'block'; }

    let hint = 'E stand';
    if (id === 'captain') hint = 'W/S thrust · A/D turn · Space up · C down · click or F fire · mouse aims · E stand';
    else if (id === 'pilot') hint = 'W/S thrust · A/D turn · Space up · C down · E stand';
    else if (id === 'gun_dorsal' || id === 'gun_ventral') hint = 'mouse aims · click or F fire · E stand';
    else if (id === 'engineer') hint = 'route power with the panel · E stand';
    else if (id === 'nav') hint = 'range button cycles the map · E stand';
    else if (id === 'comms') hint = 'E stand';
    this._showHint(hint);

    if (flying) {
      P.style.display = 'block';
      P.innerHTML = `<h3>${s.name.toUpperCase()}</h3><div id="fl-read"></div><div class="chips"><button class="chip" id="chip-ramp">Ramp</button></div>`;
      P.querySelector('#chip-ramp').onclick = () => { if (this.ship.stations.mayOperateRamp()) this.ship.toggleRamp('cargo'); };
    } else if (id === 'nav') {
      P.style.display = 'block';
      P.innerHTML = `<h3>NAVIGATION</h3><canvas id="nav-map" width="240" height="180"></canvas><div id="nav-read" class="dim"></div><div class="chips"><button class="chip" id="chip-range">Range</button></div>`;
      this.mapCanvas = P.querySelector('#nav-map');
      P.querySelector('#chip-range').onclick = () => { this.ship.stations.scanRange(this.ship.stations.scanRangeIdx + 1); this.ship.scanner.builtAt = null; };
    } else if (id === 'engineer') {
      P.style.display = 'block';
      const row = (k, n, col) => `<div class="row"><span class="n">${n}</span><button class="pm" data-k="${k}" data-d="-5">−</button><div class="bar"><i style="background:${col}" id="pb-${k}"></i><u id="pt-${k}"></u></div><button class="pm" data-k="${k}" data-d="5">+</button></div>`;
      P.innerHTML = `<h3>REACTOR ROUTING</h3>${row('engines', 'ENGINES', '#ffb45a')}${row('guns', 'GUNS', '#ff6a55')}${row('shields', 'SHIELDS', '#5fd8ff')}` +
        `<div class="chips"><button class="chip" data-p="balanced">Balanced</button><button class="chip" data-p="engines">Engines</button><button class="chip" data-p="guns">Guns</button><button class="chip" data-p="shields">Shields</button></div><div id="eng-read" class="dim"></div>`;
      P.querySelectorAll('.pm').forEach((b) => { b.onclick = () => { const k = b.dataset.k; this.ship.stations.power(k, this.ship.flight.power[k] + Number(b.dataset.d)); }; });
      const presets = { balanced: [40, 30, 30], engines: [60, 20, 20], guns: [25, 55, 20], shields: [25, 20, 55] };
      P.querySelectorAll('.chip').forEach((b) => {
        b.onclick = () => {
          const v = presets[b.dataset.p];
          this.ship.stations.powerSplit(v[0], v[1], v[2]);
        };
      });
    } else if (id === 'comms') {
      P.style.display = 'block';
      P.innerHTML = `<h3>COMMUNICATIONS</h3><div class="log" id="comm-log"></div><div class="dim" id="comm-sig"></div><div class="chips"><button class="chip" id="chip-beacon">Beacon</button></div>`;
      P.querySelector('#chip-beacon').onclick = () => { this.ship.stations.transmitBeacon(!this.ship.stations.beacon); };
    } else {
      P.style.display = 'none';
    }
  }

  update(dt) {
    const ship = this.ship;
    if (!ship.ready) return;
    // a seat change made by the ship itself (teleport, validator)
    const id = ship.seat ? ship.seat.id : null;
    if (id !== this.seatId) this._rebuildPanel();

    this.acc += dt;
    // toast for new log lines
    const log = ship.stations.log;
    if (log.length !== this.lastLogCount) {
      const last = log[log.length - 1];
      if (last) { this.toast.textContent = last.msg; this.toast.classList.add('on'); this.toastT = 3.2; }
      this.lastLogCount = log.length;
    }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.toast.classList.remove('on'); }

    if (this.acc < 0.12) return;
    this.acc = 0;
    const tel = ship.tel;
    const P = this.panel;
    if (!ship.seat) return;
    const f = ship.flight;
    if (this.seatId === 'captain' || this.seatId === 'pilot') {
      const el = P.querySelector('#fl-read');
      if (el) el.innerHTML =
        `SPD <b>${f.groundSpeed.toFixed(0)}</b> m/s &nbsp; ALT <b>${Math.max(0, f.agl).toFixed(0)}</b> m &nbsp; VS <b>${f.verticalSpeed >= 0 ? '+' : ''}${f.verticalSpeed.toFixed(1)}</b><br>` +
        `<span class="dim">${f.landed ? 'LANDED · ' : ''}gear ${f.gearPos > 0.99 ? 'down' : f.gearPos < 0.01 ? 'up' : 'moving'} · engines ${f.power.engines}%${f.canLiftOff() ? '' : ' · <span style="color:#ff6a55">CANNOT LIFT</span>'}</span>` +
        (this.seatId === 'captain' ? `<br><span class="dim">guns ${f.power.guns}% · shield ${f.shield.toFixed(0)}/${f.shieldMax.toFixed(0)}</span>` : '');
    } else if (this.seatId === 'nav' && this.mapCanvas) {
      const c = this.mapCanvas;
      ShipScreens.paint('map', c, tel, ship.time, { scanner: ship.scanner });
      const r = P.querySelector('#nav-read');
      r.innerHTML = `${Math.abs(tel.lat).toFixed(4)}° ${tel.lat >= 0 ? 'N' : 'S'} · ${Math.abs(tel.lon).toFixed(4)}° ${tel.lon >= 0 ? 'E' : 'W'}<br>elev ${tel.alt.toFixed(1)} m · hdg ${tel.heading.toFixed(0)}°<br>${tel.nearest || ''}`;
    } else if (this.seatId === 'engineer') {
      for (const k of ['engines', 'guns', 'shields']) {
        const b = P.querySelector('#pb-' + k), t = P.querySelector('#pt-' + k);
        if (b) b.style.width = f.power[k] + '%';
        if (t) t.textContent = f.power[k] + '%';
      }
      const r = P.querySelector('#eng-read');
      if (r) r.innerHTML = `lift ${(f.maxLiftN / 1000).toFixed(0)} kN vs weight ${(f.weightN() / 1000).toFixed(0)} kN · ${f.canLiftOff() ? 'can lift' : '<span style="color:#ff6a55">cannot lift</span>'}<br>shield cap ${f.shieldMax.toFixed(0)} · gun rate ×${(0.35 + 0.65 * f.gunFactor).toFixed(2)}`;
    } else if (this.seatId === 'comms') {
      const lg = P.querySelector('#comm-log');
      if (lg) lg.innerHTML = ship.stations.log.slice(-7).map((l) => `<div class="${l.warn ? 'w' : ''}"><span class="dim">${fmtT(l.t)}</span> ${l.msg}</div>`).join('');
      const sg = P.querySelector('#comm-sig');
      if (sg) sg.textContent = ship.stations.beacon ? 'Beacon on. No relay in range.' : 'No relay in range. Mars has no network.';
    }
  }
}

const fmtT = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
