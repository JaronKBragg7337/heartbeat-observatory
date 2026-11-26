// ============================================================================
// fightHud.js - FIGHTVIEW: what a pilot or gunner needs to SEE in a fight: who is shooting at us, where they are, where to aim.
//
// OWNS: a screen overlay (one canvas) while you sit at a flying or gun seat with a hostile near: a bracket on every raider and escort
//       drone on screen (bigger and brighter for the one you are aimed at, with its name, range, hull and shield), an arrow at the screen
//       edge for every hostile off screen, the lead mark (where to put the crosshair so a bolt that takes time to fly meets it), a short
//       hit flash on the bracket when the authority's numbers say our shots landed, and the gun reticle's place on screen (the true aim
//       point at the target's range, so in the outside view it sits exactly where the bolts go). It also tells the ship when a hostile is
//       near the aim line (ship.fightFrame), which lifts the outside camera so the target clears our own hull (shipSystem _placeCamera).
// DOES NOT OWN: any game state (it reads the snapshot, the fleet view and the local drones), the aim itself (the guns fire along the
//       camera's forward, as before: ship.aimWorldDir), or where the buttons sit (it keeps every mark clear of them).
// ============================================================================

import { shipDef } from '../ships/registry.js';
import { DISABLED_HULL } from '../ships/raider/stats.js';
import { CONVERGE_M } from './guns.js';

const CSS = `#fight-hud{position:fixed;inset:0;width:100%;height:100%;z-index:64;pointer-events:none;display:none}`;
const HOSTILE = new Set(['engage', 'patrol', 'return']);
const COL = { raider: '#ff6a4d', drone: '#ffb067', disabled: '#9fffc2', abandoned: '#c8c8c8', lead: '#ffe07a', hit: '#ffffff' };
const FONT = '600 11px ui-monospace,"SF Mono",Menlo,Consolas,monospace';
const SHOW_M = 4500;              // hostiles further than this are not drawn
const FRAME_ON = 0.32, FRAME_OFF = 0.5, FRAME_RANGE_M = 1900;   // the camera lift: a hostile this close to the aim line, inside gun range
const fmtD = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class FightHUD {
  /** @param o { ship, engine, mp: () => MultiplayerView | null } */
  constructor({ ship, engine, mp }) {
    this.ship = ship; this.engine = engine; this.mp = mp || (() => null);
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const cv = document.createElement('canvas'); cv.id = 'fight-hud'; document.body.appendChild(cv);
    this.cv = cv; this.g = cv.getContext('2d');
    this.seen = new Map();        // contact id -> { total, max, hitT }
    this.avoid = []; this._avoidAt = -1; this.drawn = false; this.framing = false;
    this.aimedId = null; this.state = { contacts: 0, aimed: null, framing: false };     // (dev read-out: cosmos.fightHud.state)
    this._p = {}; this._v = {};
  }

  /** Seated where a fight is fought: the pilot's or captain's chair, or a gun. */
  _seated() {
    const s = this.ship.seat; if (!s || !this.ship.aboard) return false;
    return s.id === 'captain' || s.id === 'pilot' || !!(this.ship.def && this.ship.def.seatGun && this.ship.def.seatGun[s.id]);
  }

  /** Everything that can shoot at us (and a beaten raider, so you can find it to board), positions in the ACTIVE frame. */
  contacts() {
    const out = [], eng = this.engine, AF = eng.activeFrame, mp = this.mp(), fv = mp && mp.fleetView, snap = mp && mp.world && mp.world.snapshot;
    if (fv && snap) {
      for (const s of Object.values(snap.ships)) {
        if (!s.npc || !s.pose) continue;
        const v = fv.views.get(s.id); if (!v || !v.root.visible) continue;
        const F = v.entry.frame || eng.rootFrame, pos = eng.framePoint(F, AF, v.entry.worldPos, {}), vel = eng.frameDir(F, AF, s.pose.vel, {});
        const st = s.npc.state, env = (v.def && v.def.envelope) || { width: 18, depth: 37, height: 9 };
        out.push({ id: s.id, kind: HOSTILE.has(st) ? 'raider' : st === 'disabled' ? 'disabled' : 'abandoned', hostile: HOSTILE.has(st), name: s.npc.name || 'Raider',
          pos, vel, hull: s.pose.hull, shield: s.pose.shield || 0, shieldBase: (v.def && v.def.phys && v.def.phys.shieldBase) || 240, r: Math.max(env.width, env.depth) * 0.5 });
        for (const d of (s.npc.escorts && s.npc.escorts.drones) || []) {
          if (d.state === 'dead' || d.state === 'away') continue;
          const e = fv.escorts.get(d.id); if (!e || !e.mesh.visible) continue;
          const EF = e.entry.frame || eng.rootFrame;
          out.push({ id: d.id, kind: 'drone', hostile: true, name: 'Escort drone', pos: eng.framePoint(EF, AF, e.entry.worldPos, {}), vel: eng.frameDir(EF, AF, d.vel || { x: 0, y: 0, z: 0 }, {}),
            hull: d.maxHp ? (100 * d.hp) / d.maxHp : null, shield: 0, r: 3.2 });
        }
      }
    }
    // offline (no shared world): the ship's own raider drones
    const D = this.ship.drones;
    if (!(mp && mp.world && mp.world.remote) && D && D.drones) for (const d of D.drones) {
      if (d.state === 'away' || d.state === 'dead' || !d.target || d.target.hp <= 0) continue;
      out.push({ id: 'local:' + d.id, kind: 'drone', hostile: true, name: 'Raider drone', pos: d.pos, vel: d.vel, hull: (100 * d.target.hp) / d.target.maxHp, shield: 0, r: 3.2 });
    }
    return out;
  }

  /** The rectangles a mark must stay clear of: every button and panel on screen (measured four times a second). */
  _avoidRects(now) {
    if (now - this._avoidAt < 250) return this.avoid;
    this._avoidAt = now;
    const list = [];
    for (const el of document.querySelectorAll('button,[role=button],#hud,#ff-bar,#ship-panel,#ship-hint,#fly-bar')) {
      if (el.closest('#key-pad,#settings-panel:not(.open)')) continue;
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) continue;
      let ok = true;
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) { if (n.hidden) { ok = false; break; } const c = getComputedStyle(n); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0) { ok = false; break; } }
      if (ok) list.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    }
    const hud = document.getElementById('hud'); this.topY = hud ? Math.max(0, hud.getBoundingClientRect().bottom) : 0;
    this.avoid = list; return list;
  }

  update(dt) {
    const ship = this.ship, eng = this.engine, cam = eng.camera, now = performance.now();
    const on = ship.ready && this._seated();
    const ret = document.getElementById('ship-reticle');
    let list = on ? this.contacts() : [];
    const me = ship.flight, gunId = on && ship.def && ship.def.seatGun ? ship.def.seatGun[ship.seat.id] : null;
    const eye = on ? me.toWorld(ship.eyeLocal, this._p) : null;
    const aim = on ? ship.aimWorldDir() : null;
    const G = gunId && ship.guns && ship.guns.GUNS[gunId], speed = G ? G.speed : 0;
    // range, lead and the angle off the aim line, for each
    let aimed = null, best = 1e9, frameNear = 1e9;
    for (const c of list) {
      const rx = c.pos.x - eye.x, ry = c.pos.y - eye.y, rz = c.pos.z - eye.z; c.d = Math.hypot(rx, ry, rz);
      if (c.hostile && speed) {
        const vx = c.vel.x - me.vel.x, vy = c.vel.y - me.vel.y, vz = c.vel.z - me.vel.z;
        let t = c.d / speed; for (let i = 0; i < 4; i++) t = Math.hypot(rx + vx * t, ry + vy * t, rz + vz * t) / speed;
        c.lead = t * speed <= (G.range || 1800) ? { x: c.pos.x + vx * t, y: c.pos.y + vy * t, z: c.pos.z + vz * t } : null;
      } else c.lead = null;
      const q = c.lead || c.pos, qx = q.x - eye.x, qy = q.y - eye.y, qz = q.z - eye.z, ql = Math.hypot(qx, qy, qz) || 1;
      c.off = Math.acos(clamp((qx * aim.x + qy * aim.y + qz * aim.z) / ql, -1, 1));
      if (c.d > SHOW_M) continue;
      // the one we are aimed at: nearest the aim line, measured from its edge (a raider's hull is wider than a drone's), raiders first
      const score = c.off - Math.atan2(c.r, Math.max(1, c.d)) + (c.kind === 'drone' ? 0.03 : 0);
      if (c.off < 0.6 && score < best) { best = score; aimed = c; }
      if (c.hostile && c.d < FRAME_RANGE_M) { const pl = c.d || 1, o = Math.acos(clamp((rx * aim.x + ry * aim.y + rz * aim.z) / pl, -1, 1)); frameNear = Math.min(frameNear, Math.min(o, c.off)); }
      // a hit: the authority's numbers fell since the last look
      const tot = (c.hull ?? 0) + (c.shield ?? 0), s = this.seen.get(c.id);
      if (s) { if (c.hostile && tot < s.total - 0.5) s.hitT = 0.45; s.total = tot; s.max = Math.max(s.max, c.shield || 0); s.at = now; }
      else this.seen.set(c.id, { total: tot, max: Math.max(c.shield || 0, c.shieldBase || 0), hitT: 0, at: now });
    }
    list = list.filter((c) => c.d <= SHOW_M);
    for (const [id, s] of this.seen) { s.hitT = Math.max(0, s.hitT - dt); if (now - s.at > 20000) this.seen.delete(id); }
    // the camera lift (shipSystem eases it in and out)
    this.framing = this.framing ? frameNear < FRAME_OFF : frameNear < FRAME_ON;
    ship.fightFrame = on && this.framing ? 1 : 0;
    // the reticle where the bolts really go: the aim line from the gunner's eye, at the target's range (or where the guns converge)
    if (ret) {
      if (on && gunId && ret.style.display !== 'none') {
        const D = aimed ? clamp((aimed.lead ? Math.hypot(aimed.lead.x - eye.x, aimed.lead.y - eye.y, aimed.lead.z - eye.z) : aimed.d), 60, 4000) : CONVERGE_M;
        const s = this._proj({ x: eye.x + aim.x * D, y: eye.y + aim.y * D, z: eye.z + aim.z * D });
        if (s.front) { ret.style.left = s.x.toFixed(1) + 'px'; ret.style.top = s.y.toFixed(1) + 'px'; this.retXY = s; }
      } else if (ret.style.left) { ret.style.left = ''; ret.style.top = ''; this.retXY = null; }
    }
    this.aimedId = aimed ? aimed.id : null;
    this.state = { contacts: list.length, aimed: aimed ? { id: aimed.id, name: aimed.name, d: Math.round(aimed.d), off: +aimed.off.toFixed(3), hull: aimed.hull != null ? Math.round(aimed.hull) : null } : null, framing: this.framing };
    if (!list.length) { if (this.drawn) { this.g.setTransform(1, 0, 0, 1, 0, 0); this.g.clearRect(0, 0, this.cv.width, this.cv.height); this.cv.style.display = 'none'; this.drawn = false; } return; }
    this._draw(list, aimed, now, !!gunId);
  }

  /** A point (active frame) -> CSS pixels; front = in front of the camera. */
  _proj(p) {
    const eng = this.engine, cam = eng.camera, c = eng.cameraWorldPos, v = this._v;
    const x = p.x - c.x, y = p.y - c.y, z = p.z - c.z, q = cam.quaternion;
    // rotate by the inverse of the camera's turn
    const qx = -q.x, qy = -q.y, qz = -q.z, qw = q.w;
    const ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
    v.x = ix * qw + iw * -qx + iy * -qz - iz * -qy; v.y = iy * qw + iw * -qy + iz * -qx - ix * -qz; v.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    const W = innerWidth, H = innerHeight, tanY = Math.tan((cam.fov * Math.PI) / 360), tanX = tanY * (cam.aspect || W / H);
    const front = v.z < -0.5, k = front ? 1 / -v.z : 0;
    return { front, x: front ? ((v.x * k) / tanX + 1) / 2 * W : 0, y: front ? (1 - (v.y * k) / tanY) / 2 * H : 0, cx: v.x, cy: v.y, depth: -v.z, pxPerM: front ? (k / tanY) * H / 2 : 0 };
  }

  _draw(list, aimed, now, armed) {
    const cv = this.cv, g = this.g, W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    cv.style.display = 'block'; this.drawn = true;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const avoid = this._avoidRects(now);
    // the box marks may use: under the status box, inside the sides and the bottom
    const L = 18, R = W - 18, T = Math.max(18, (this.topY || 0) + 8), B = H - 18;
    const inAvoid = (x, y, m = 8) => avoid.find((r) => x > r.left - m && x < r.right + m && y > r.top - m && y < r.bottom + m);
    const edge = (s) => {               // an arrow on the box's edge pointing the way, kept beside any button it would sit under
      const cx = (L + R) / 2, cy = (T + B) / 2;
      const ang0 = s.front ? Math.atan2(s.y - cy, s.x - cx) : Math.atan2(-s.cy, s.cx);
      let x = s.front ? s.x : cx + Math.cos(ang0) * 1e4, y = s.front ? s.y : cy + Math.sin(ang0) * 1e4;
      const k = Math.max(Math.abs(x - cx) / ((R - L) / 2), Math.abs(y - cy) / ((B - T) / 2), 1); x = cx + (x - cx) / k; y = cy + (y - cy) / k;
      let a = Math.atan2(y - cy, x - cx);
      const r = inAvoid(x, y, 14);
      if (r) {
        const c = [[r.left - 20, y], [r.right + 20, y], [x, r.top - 20], [x, r.bottom + 20]].filter(([qx, qy]) => qx >= L && qx <= R && qy >= T && qy <= B && !inAvoid(qx, qy, 10))
          .sort((u, v) => Math.hypot(u[0] - x, u[1] - y) - Math.hypot(v[0] - x, v[1] - y))[0];
        if (c) { const tx = s.front ? s.x : x + Math.cos(a) * 100, ty = s.front ? s.y : y + Math.sin(a) * 100; x = c[0]; y = c[1]; a = Math.atan2(ty - y, tx - x); }
      }
      return { x, y, a };
    };
    g.font = FONT; g.lineCap = 'round'; this._placed = [];
    // the one we are aimed at first (its label gets the best place), then far to near
    list.sort((a, b) => (b === aimed) - (a === aimed) || b.d - a.d);
    for (const c of list) {
      const s = this._proj(c.pos), col = COL[c.kind], isAim = c === aimed, hit = (this.seen.get(c.id) || {}).hitT || 0;
      const onScreen = s.front && s.x >= L && s.x <= R && s.y >= T && s.y <= B && !inAvoid(s.x, s.y, 6);
      if (!onScreen) {
        if (!c.hostile && c.d > 700) continue;                 // a beaten raider far off screen is not worth an arrow
        const e = edge(s);
        g.save(); g.translate(e.x, e.y); g.rotate(e.a); g.fillStyle = col; g.strokeStyle = 'rgba(10,6,4,.8)'; g.lineWidth = 1.5;
        const z = c.kind === 'drone' ? 0.75 : 1; g.beginPath(); g.moveTo(12 * z, 0); g.lineTo(-7 * z, -8 * z); g.lineTo(-3 * z, 0); g.lineTo(-7 * z, 8 * z); g.closePath(); g.stroke(); g.fill(); g.restore();
        if (c.kind !== 'drone') this._text(g, `${c.name.toUpperCase()} ${fmtD(c.d)}`, e.x, e.y, col, avoid, L, R, T, B, 14, true);
        continue;
      }
      // the bracket: four corners round the hull as it looks from here (never smaller than a thumb can see)
      const half = clamp(c.r * s.pxPerM * 1.15, c.kind === 'drone' ? 9 : 14, 140) + (hit ? 6 * (hit / 0.45) : 0), arm = Math.max(5, half * 0.42);
      g.strokeStyle = hit ? COL.hit : col; g.lineWidth = isAim ? 2.5 : 1.6; g.globalAlpha = isAim || c.kind !== 'drone' ? 1 : 0.85;
      g.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const x = s.x + sx * half, y = s.y + sy * half; g.moveTo(x, y - sy * arm); g.lineTo(x, y); g.lineTo(x - sx * arm, y); }
      g.stroke(); g.globalAlpha = 1;
      if (hit) { g.font = '700 11px ui-monospace,Menlo,Consolas,monospace'; g.fillStyle = COL.hit; g.textAlign = 'center'; g.fillText('HIT', s.x, s.y - half - 6); g.textAlign = 'left'; g.font = FONT; }
      // the lead mark: where the crosshair goes so a bolt meets it
      if (armed && c.lead && (isAim || (c.kind === 'raider' && c.d < 1300))) {
        const l = this._proj(c.lead);
        if (l.front && Math.hypot(l.x - s.x, l.y - s.y) > 3 && !inAvoid(l.x, l.y, 4)) {
          g.strokeStyle = COL.lead; g.globalAlpha = isAim ? 0.9 : 0.55; g.lineWidth = 1; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(l.x, l.y); g.stroke(); g.setLineDash([]);
          g.lineWidth = isAim ? 2 : 1.4; g.beginPath(); g.arc(l.x, l.y, isAim ? 7 : 5, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(l.x, l.y, 1.6, 0, Math.PI * 2); g.fillStyle = COL.lead; g.fill(); g.globalAlpha = 1;
        }
      }
      // the label: name, range, hull and shield for the one we are aimed at; a short tag for a raider that is not
      if (isAim || c.kind !== 'drone') {
        const sv = this.seen.get(c.id), sp = sv && sv.max > 0 ? Math.round((100 * (c.shield || 0)) / sv.max) : null;
        const lines = c.kind === 'disabled' ? [c.name.toUpperCase() + ' · SURRENDERED', `${fmtD(c.d)} · board from World / crew`]
          : c.kind === 'abandoned' ? [c.name.toUpperCase() + ' · ABANDONED', fmtD(c.d)]
          : isAim ? [`${c.name.toUpperCase()}  ${fmtD(c.d)}`, c.hull != null ? `HULL ${Math.round(c.hull)}%${c.kind === 'raider' ? ` · SHIELD ${sp ?? 0}%` : ''}` : '']
          : [`${c.name.toUpperCase()} ${fmtD(c.d)}`];
        if (isAim && c.kind === 'raider' && c.hull != null) lines.push(`surrenders at ${DISABLED_HULL}%`);
        this._block(g, lines.filter(Boolean), s.x, s.y, half, col, avoid, L, R, T, B, isAim);
      }
    }
  }

  /** A few lines of text beside a bracket: right of it, else left, above or below; never on a button or off the screen. */
  _block(g, lines, x, y, half, col, avoid, L, R, T, B, big) {
    g.font = FONT; const lh = 14, w = Math.max(...lines.map((t) => g.measureText(t).width)) + 8, h = lines.length * lh + 4;
    const spots = [[x + half + 8, y - h / 2], [x - half - 8 - w, y - h / 2], [x - w / 2, y - half - 8 - h], [x - w / 2, y + half + 8]];
    const hits = (r, bx, by) => bx < r.right + 4 && bx + w > r.left - 4 && by < r.bottom + 4 && by + h > r.top - 4;
    const free = (bx, by) => bx >= L - 10 && bx + w <= R + 10 && by >= T - 6 && by + h <= B + 6 && !avoid.some((r) => hits(r, bx, by)) && !this._placed.some((r) => hits(r, bx, by));
    const at = spots.find(([bx, by]) => free(bx, by)); if (!at) return;
    const [bx, by] = at; this._placed.push({ left: bx, top: by, right: bx + w, bottom: by + h });
    g.fillStyle = 'rgba(14,6,4,.66)'; g.fillRect(bx, by, w, h);
    lines.forEach((t, i) => { g.fillStyle = i === 0 ? col : big ? '#ffe9d8' : '#e8d6c8'; g.fillText(t, bx + 4, by + 13 + i * lh); });
  }

  _text(g, t, x, y, col, avoid, L, R, T, B, gap) {
    g.font = FONT; const w = g.measureText(t).width + 8, h = 16;
    const right = x < (L + R) / 2;
    for (const [bx, by] of [[right ? x + gap : x - gap - w, y - h / 2], [right ? x - gap - w : x + gap, y - h / 2], [x - w / 2, y + gap], [x - w / 2, y - gap - h]]) {
      if (bx < L - 10 || bx + w > R + 10 || by < T - 6 || by + h > B + 6) continue;
      if ([...avoid, ...this._placed].some((r) => bx < r.right + 4 && bx + w > r.left - 4 && by < r.bottom + 4 && by + h > r.top - 4)) continue;
      this._placed.push({ left: bx, top: by, right: bx + w, bottom: by + h }); g.fillStyle = 'rgba(14,6,4,.66)'; g.fillRect(bx, by, w, h); g.fillStyle = col; g.fillText(t, bx + 4, by + 12); return;
    }
  }
}
