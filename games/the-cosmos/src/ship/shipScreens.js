// ============================================================================
// shipScreens.js — the ship's displays. Every one shows something true.
//
// OWNS: the canvas textures on the in-world screens, the drawing routines that
//       fill them, and the terrain scanner that feeds the navigation map.
// DOES NOT OWN: the numbers. Every value drawn comes from the ship's telemetry
//       object; a screen never keeps its own copy of a fact.
//
// These are real lit surfaces in the world (MeshBasic, so they glow) AND the
// same drawing routines paint the larger DOM panels a seated crew member sees,
// because 1.2 m of screen at arm's length is not readable at 375 px wide.
// ============================================================================

import * as THREE from 'three';

const HAS_DOM = typeof document !== 'undefined';
const CYAN = '#5fd8ff', AMBER = '#ffb45a', GREEN = '#6dff9c', RED = '#ff5a4a', DIM = '#21454f', BG = '#04141b', WHITE = '#e6fbff';

const fmt = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '--');

function mono(g, px, weight = 500) { g.font = `${weight} ${px}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`; }

function frame(g, w, h, title, color = CYAN) {
  g.fillStyle = BG; g.fillRect(0, 0, w, h);
  // scanlines
  g.fillStyle = 'rgba(95,216,255,0.035)';
  for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
  g.strokeStyle = color; g.globalAlpha = 0.6; g.lineWidth = 2;
  g.strokeRect(3, 3, w - 6, h - 6); g.globalAlpha = 1;
  if (title) {
    mono(g, Math.max(10, h * 0.055), 700);
    g.fillStyle = color; g.textBaseline = 'top';
    g.fillText(title, 12, 9);
    g.fillStyle = 'rgba(95,216,255,0.28)';
    g.fillRect(10, 10 + h * 0.06, w - 20, 1);
  }
}

function bar(g, x, y, w, h, v, color, label, valueText) {
  g.fillStyle = 'rgba(95,216,255,0.12)'; g.fillRect(x, y, w, h);
  g.fillStyle = color; g.fillRect(x, y, Math.max(0, Math.min(1, v)) * w, h);
  g.strokeStyle = 'rgba(230,251,255,0.5)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (label) { g.fillStyle = WHITE; g.textBaseline = 'middle'; g.fillText(label, x + 6, y + h / 2 + 1); }
  if (valueText) { g.textAlign = 'right'; g.fillStyle = WHITE; g.fillText(valueText, x + w - 6, y + h / 2 + 1); g.textAlign = 'left'; }
}

// ---------------------------------------------------------------------------
// Drawing routines. (g, w, h, tel, t, ctx)
// ---------------------------------------------------------------------------
export const DRAW = {

  attitude(g, w, h, tel, t) {
    frame(g, w, h, 'ATTITUDE');
    const cx = w / 2, cy = h * 0.55, r = Math.min(w, h) * 0.34;
    g.save();
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
    g.translate(cx, cy); g.rotate(-(tel.roll || 0));
    const py = (tel.pitch || 0) * r * 2.2;
    g.fillStyle = '#1b6b99'; g.fillRect(-r * 2, -r * 2 + py, r * 4, r * 2);
    g.fillStyle = '#6b3d1f'; g.fillRect(-r * 2, py, r * 4, r * 2);
    g.strokeStyle = WHITE; g.lineWidth = 2; g.beginPath(); g.moveTo(-r * 2, py); g.lineTo(r * 2, py); g.stroke();
    for (let i = -3; i <= 3; i++) { if (!i) continue; g.beginPath(); g.moveTo(-r * 0.25, py + i * r * 0.28); g.lineTo(r * 0.25, py + i * r * 0.28); g.stroke(); }
    g.restore();
    g.strokeStyle = AMBER; g.lineWidth = 3; g.beginPath();
    g.moveTo(cx - r * 0.6, cy); g.lineTo(cx - r * 0.2, cy); g.moveTo(cx + r * 0.2, cy); g.lineTo(cx + r * 0.6, cy); g.stroke();
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.strokeStyle = CYAN; g.lineWidth = 2; g.stroke();
    mono(g, h * 0.075, 700); g.fillStyle = WHITE; g.textAlign = 'center';
    g.fillText(`HDG ${fmt(tel.heading, 0).padStart(3, '0')}`, cx, h * 0.12 + 6);
    g.textAlign = 'left';
  },

  flight(g, w, h, tel, t) {
    frame(g, w, h, 'FLIGHT');
    const s = h * 0.09;
    mono(g, s, 600);
    const rows = [
      ['GND SPD', fmt(tel.groundSpeed, 1), 'm/s'],
      ['VERT', (tel.vs >= 0 ? '+' : '') + fmt(tel.vs, 1), 'm/s'],
      ['RADAR ALT', fmt(Math.max(0, tel.agl), 1), 'm'],
      ['ELEV', fmt(tel.alt, 0), 'm'],
    ];
    let y = h * 0.2;
    for (const [a, b, c] of rows) {
      g.fillStyle = DIM; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(a, 14, y);
      mono(g, s * 1.5, 700); g.fillStyle = WHITE; g.textAlign = 'right'; g.fillText(b, w - 62, y - s * 0.2);
      mono(g, s * 0.8, 500); g.fillStyle = CYAN; g.textAlign = 'left'; g.fillText(c, w - 56, y + 2);
      mono(g, s, 600);
      y += s * 1.75;
    }
    // status strip
    const gear = tel.gear >= 0.99 ? 'GEAR DOWN' : tel.gear <= 0.01 ? 'GEAR UP' : 'GEAR MOVING';
    g.textAlign = 'left'; g.fillStyle = tel.gear >= 0.99 ? GREEN : AMBER; g.fillText(gear, 14, h - s * 1.9);
    g.fillStyle = tel.landed ? GREEN : CYAN; g.fillText(tel.landed ? 'LANDED' : 'AIRBORNE', w * 0.52, h - s * 1.9);
    mono(g, s * 0.85, 500);
    bar(g, 12, h - s * 0.95 - 4, w * 0.44, s * 0.85, tel.hull / 100, tel.hull > 40 ? GREEN : RED, 'HULL', fmt(tel.hull, 0) + '%');
    bar(g, w * 0.52, h - s * 0.95 - 4, w * 0.44 - 12, s * 0.85, tel.shieldMax ? tel.shield / tel.shieldMax : 0, CYAN, 'SHLD', fmt(tel.shield, 0));
  },

  systems(g, w, h, tel, t) {
    frame(g, w, h, 'SHIP SYSTEMS');
    const s = h * 0.075;
    mono(g, s, 600);
    const p = tel.power || { engines: 0, guns: 0, shields: 0 };
    let y = h * 0.2;
    for (const [k, v, col] of [['ENGINES', p.engines, AMBER], ['GUNS', p.guns, RED], ['SHIELDS', p.shields, CYAN]]) {
      bar(g, 12, y, w - 24, s * 1.25, v / 100, col, k, v + '%'); y += s * 1.6;
    }
    y += s * 0.3; g.textAlign = 'left'; g.textBaseline = 'top';
    const lines = [];
    lines.push([tel.canLift ? 'LIFT: ' + fmt(tel.liftMargin, 0) + ' kN spare' : 'LIFT: INSUFFICIENT', tel.canLift ? GREEN : RED]);
    lines.push([`THRUST ${fmt((tel.thrustUp || 0) / 1000, 0)} / ${fmt((tel.maxLift || 0) / 1000, 0)} kN`, WHITE]);
    lines.push([`MASS ${fmt((tel.massKg || 0) / 1000, 1)} t  WEIGHT ${fmt((tel.weightN || 0) / 1000, 0)} kN`, DIM]);
    for (const [txt, col] of lines) { g.fillStyle = col; g.fillText(txt, 14, y); y += s * 1.25; }
  },

  coords(g, w, h, tel, t) {
    frame(g, w, h, 'POSITION');
    const s = h * 0.085;
    g.textBaseline = 'top'; g.textAlign = 'left';
    mono(g, s * 1.15, 700); g.fillStyle = WHITE;
    const lat = tel.lat, lon = tel.lon;
    const nsew = (v, a, b) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? a : b}`;
    g.fillText(nsew(lat, 'N', 'S'), 14, h * 0.19);
    g.fillText(nsew(lon, 'E', 'W'), 14, h * 0.19 + s * 1.5);
    mono(g, s, 500); g.fillStyle = AMBER;
    g.fillText(`ALT ${fmt(tel.alt, 1)} m`, 14, h * 0.19 + s * 3.2);
    g.fillStyle = CYAN;
    g.fillText(`HDG ${fmt(tel.heading, 0)}°`, 14, h * 0.19 + s * 4.5);
    g.fillStyle = DIM; mono(g, s * 0.8, 500);
    g.fillText(tel.cell || '', 14, h * 0.19 + s * 5.9);
    g.fillText(tel.nearest || '', 14, h * 0.19 + s * 6.9);
  },

  map(g, w, h, tel, t, ctx) {
    frame(g, w, h, `TERRAIN  ${tel.mapRangeKm ? tel.mapRangeKm + ' km' : ''}`);
    const scan = ctx && ctx.scanner;
    const size = Math.min(w - 24, h - 40);
    const x0 = (w - size) / 2, y0 = h - size - 10;
    if (scan && scan.canvas) {
      g.imageSmoothingEnabled = true;
      g.drawImage(scan.canvas, x0, y0, size, size);
    }
    // range rings, north, ship
    g.strokeStyle = 'rgba(95,216,255,0.45)'; g.lineWidth = 1;
    const cx = x0 + size / 2, cy = y0 + size / 2;
    for (const f of [0.25, 0.5, 0.75, 1]) { g.beginPath(); g.arc(cx, cy, size / 2 * f, 0, Math.PI * 2); g.stroke(); }
    g.beginPath(); g.moveTo(cx, y0); g.lineTo(cx, y0 + size); g.moveTo(x0, cy); g.lineTo(x0 + size, cy); g.stroke();
    // ship arrow (heading up = north, rotated)
    const hd = ((tel.heading || 0) * Math.PI) / 180;
    g.save(); g.translate(cx, cy); g.rotate(hd);
    g.fillStyle = AMBER; g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 8); g.lineTo(0, 4); g.lineTo(-6, 8); g.closePath(); g.fill();
    g.restore();
    mono(g, 12, 700); g.fillStyle = WHITE; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('N', cx, y0 + 10);
    // blips
    if (tel.blips) for (const b of tel.blips) {
      const bx = cx + (b.e / (tel.mapRangeM || 1000)) * (size / 2), by = cy - (b.n / (tel.mapRangeM || 1000)) * (size / 2);
      if (Math.hypot(bx - cx, by - cy) > size / 2) continue;
      g.fillStyle = b.color || GREEN; g.fillRect(bx - 3, by - 3, 6, 6);
    }
    g.textAlign = 'left';
  },

  scan(g, w, h, tel, t) {
    frame(g, w, h, 'SCANNER');
    const cx = w / 2, cy = h * 0.56, r = Math.min(w, h) * 0.38;
    g.strokeStyle = 'rgba(109,255,156,0.5)'; g.lineWidth = 1;
    for (const f of [0.33, 0.66, 1]) { g.beginPath(); g.arc(cx, cy, r * f, 0, Math.PI * 2); g.stroke(); }
    g.beginPath(); g.moveTo(cx - r, cy); g.lineTo(cx + r, cy); g.moveTo(cx, cy - r); g.lineTo(cx, cy + r); g.stroke();
    const a = (t * 1.6) % (Math.PI * 2);
    const gr = g.createConicGradient ? g.createConicGradient(a - Math.PI / 2, cx, cy) : null;
    if (gr) {
      gr.addColorStop(0, 'rgba(109,255,156,0)'); gr.addColorStop(0.09, 'rgba(109,255,156,0.5)'); gr.addColorStop(0.1, 'rgba(109,255,156,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = GREEN; g.beginPath(); g.arc(cx, cy, 3, 0, Math.PI * 2); g.fill();
    if (tel.blips) for (const b of tel.blips.slice(0, 12)) {
      const rr = (Math.hypot(b.e, b.n) / (tel.scanRangeM || 2000)) * r;
      if (rr > r) continue;
      const ang = Math.atan2(b.e, b.n);
      g.fillStyle = b.color || AMBER;
      g.fillRect(cx + Math.sin(ang) * rr - 3, cy - Math.cos(ang) * rr - 3, 6, 6);
    }
    mono(g, h * 0.06, 500); g.fillStyle = DIM; g.textBaseline = 'top';
    g.fillText(`${tel.blips ? tel.blips.length : 0} CONTACTS  ${fmt((tel.scanRangeM || 2000) / 1000, 1)} km`, 12, h - h * 0.09);
  },

  log(g, w, h, tel, t) {
    frame(g, w, h, 'SHIP LOG');
    mono(g, h * 0.062, 500); g.textBaseline = 'top'; g.textAlign = 'left';
    const lines = tel.log || [];
    const n = Math.floor((h * 0.8) / (h * 0.075));
    let y = h * 0.16;
    for (const l of lines.slice(-n)) {
      g.fillStyle = DIM; g.fillText(l.t, 12, y);
      g.fillStyle = l.warn ? AMBER : WHITE; g.fillText(String(l.msg ?? '').slice(0, Math.floor((w - 100) / (h * 0.038))), 12 + h * 0.19, y);
      y += h * 0.075;
    }
  },

  signal(g, w, h, tel, t) {
    frame(g, w, h, 'COMMS');
    g.strokeStyle = CYAN; g.lineWidth = 1.5; g.beginPath();
    for (let x = 12; x < w - 12; x += 2) {
      const n = Math.sin(x * 0.11 + t * 7) * Math.sin(x * 0.037 - t * 3) * 0.5 + (Math.sin(x * 12.9 + t * 31) * 0.5) * 0.3;
      const y = h * 0.42 + n * h * 0.13;
      x === 12 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
    mono(g, h * 0.09, 700); g.fillStyle = tel.beacon ? GREEN : AMBER; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText(tel.beacon ? 'BEACON ACTIVE' : 'NO RELAY IN RANGE', 14, h * 0.68);
    mono(g, h * 0.058, 500); g.fillStyle = DIM;
    g.fillText('MARS HAS NO RELAY NETWORK', 14, h * 0.82);
  },

  power(g, w, h, tel, t) {
    frame(g, w, h, 'REACTOR ROUTING');
    const s = h * 0.075;
    mono(g, s, 600);
    const p = tel.power || { engines: 0, guns: 0, shields: 0 };
    let y = h * 0.2;
    for (const [k, v, col, sub] of [['ENGINES', p.engines, AMBER, 'lift + drive'], ['GUNS', p.guns, RED, 'rate of fire'], ['SHIELDS', p.shields, CYAN, 'absorb + recharge']]) {
      bar(g, 12, y, w - 24, s * 1.5, v / 100, col, k, v + '%');
      g.fillStyle = DIM; g.textAlign = 'left'; g.textBaseline = 'top'; mono(g, s * 0.7, 500); g.fillText(sub, 14, y + s * 1.55); mono(g, s, 600);
      y += s * 2.6;
    }
  },

  reactor(g, w, h, tel, t) {
    frame(g, w, h, 'CORE');
    const cx = w / 2, cy = h * 0.58, r = h * 0.28;
    const load = (tel.power ? (tel.power.engines + tel.power.guns + tel.power.shields) / 100 : 1);
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.0);
    const gr = g.createRadialGradient(cx, cy, 2, cx, cy, r);
    gr.addColorStop(0, 'rgba(230,251,255,1)'); gr.addColorStop(0.4, 'rgba(95,216,255,0.9)'); gr.addColorStop(1, 'rgba(95,216,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r * (0.8 + 0.12 * pulse), 0, Math.PI * 2); g.fill();
    g.strokeStyle = AMBER; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    mono(g, h * 0.07, 600); g.fillStyle = WHITE; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText(`OUTPUT ${fmt(load * 100, 0)}%`, 14, h * 0.17);
    g.fillStyle = DIM; g.fillText(`CORE ${fmt(2410 + 30 * pulse, 0)} K`, 14, h * 0.17 + h * 0.09);
  },

  reactorwall(g, w, h, tel, t) { DRAW.power(g, w, h, tel, t); },

  vitals(g, w, h, tel, t) {
    g.fillStyle = BG; g.fillRect(0, 0, w, h);
    g.strokeStyle = GREEN; g.lineWidth = 2; g.beginPath();
    for (let x = 0; x < w; x++) {
      const p = ((x / w) * 3 + t * 0.9) % 1;
      const y = h * 0.55 - (p > 0.4 && p < 0.44 ? h * 0.35 : p > 0.44 && p < 0.47 ? -h * 0.15 : 0) - Math.sin(p * 6.28) * h * 0.03;
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
    mono(g, h * 0.16, 700); g.fillStyle = GREEN; g.textBaseline = 'top'; g.fillText('72', 8, 6);
    g.fillStyle = CYAN; g.fillText('98%', w - h * 0.62, 6);
  },

  menu(g, w, h, tel, t) {
    frame(g, w, h, 'GALLEY');
    mono(g, h * 0.09, 500); g.fillStyle = WHITE; g.textBaseline = 'top'; g.textAlign = 'left';
    const lines = ['SOL ' + (tel.sol || 1207) + ' MENU', 'Lentil stew', 'Dried apple', 'Coffee - real', 'Water: 91% recycled'];
    lines.forEach((l, i) => { g.fillStyle = i ? WHITE : AMBER; g.fillText(l, 14, h * 0.2 + i * h * 0.15); });
  },

  vista(g, w, h, tel, t) {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#2a1d2b'); gr.addColorStop(0.55, '#c98a5a'); gr.addColorStop(0.56, '#8a4a2a'); gr.addColorStop(1, '#4a2416');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f7e6c8'; g.beginPath(); g.arc(w * 0.72, h * 0.32, h * 0.045, 0, 6.3); g.fill();
    g.fillStyle = '#6d3a22'; g.beginPath(); g.moveTo(0, h * 0.56);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, h * 0.56 - Math.abs(Math.sin(x * 0.02)) * h * 0.08 - Math.abs(Math.sin(x * 0.007)) * h * 0.06);
    g.lineTo(w, h * 0.6); g.lineTo(0, h * 0.6); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
  },

  schematic(g, w, h, tel, t) {
    g.fillStyle = '#0b2a3a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(160,220,255,0.35)'; g.lineWidth = 1;
    for (let x = 0; x < w; x += 20) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = WHITE; g.lineWidth = 2;
    g.strokeRect(w * 0.1, h * 0.35, w * 0.8, h * 0.3);
    g.beginPath(); g.moveTo(w * 0.1, h * 0.35); g.lineTo(w * 0.02, h * 0.5); g.lineTo(w * 0.1, h * 0.65); g.stroke();
    g.beginPath(); g.arc(w * 0.5, h * 0.5, h * 0.09, 0, 6.3); g.stroke();
    mono(g, h * 0.07, 600); g.fillStyle = WHITE; g.textBaseline = 'top'; g.fillText('MERIDIAN  SECTION A-A', 10, 8);
  },

  manifest(g, w, h, tel, t) {
    frame(g, w, h, 'CARGO');
    mono(g, h * 0.075, 500); g.textBaseline = 'top'; g.textAlign = 'left';
    const rows = ['CRATE A  survey kit', 'CRATE B  drill string', 'CRATE C  spares', 'DRUM x3  coolant', 'ROVER  Lark-6', 'RAMP  ' + (tel.rampState || 'raised')];
    rows.forEach((l, i) => { g.fillStyle = i === 5 ? AMBER : WHITE; g.fillText(l, 12, h * 0.19 + i * h * 0.12); });
  },

  ship(g, w, h, tel, t) {
    frame(g, w, h, 'HULL');
    // a side profile that is the ship: coloured by integrity
    const col = tel.hull > 70 ? GREEN : tel.hull > 35 ? AMBER : RED;
    g.strokeStyle = col; g.lineWidth = 2;
    g.beginPath(); g.moveTo(w * 0.1, h * 0.62); g.lineTo(w * 0.22, h * 0.5); g.lineTo(w * 0.3, h * 0.4); g.lineTo(w * 0.42, h * 0.4);
    g.lineTo(w * 0.5, h * 0.48); g.lineTo(w * 0.86, h * 0.48); g.lineTo(w * 0.9, h * 0.6); g.lineTo(w * 0.85, h * 0.72);
    g.lineTo(w * 0.22, h * 0.72); g.closePath(); g.stroke();
    mono(g, h * 0.1, 700); g.fillStyle = col; g.textBaseline = 'top'; g.fillText(fmt(tel.hull, 0) + '%', 14, h * 0.78);
  },

  ramp(g, w, h, tel, t) {
    frame(g, w, h, 'BOARDING RAMP');
    mono(g, h * 0.16, 700); g.fillStyle = tel.rampState === 'lowered' ? GREEN : AMBER; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText((tel.rampState || 'raised').toUpperCase(), w / 2, h * 0.55);
    g.textAlign = 'left';
  },

  airlock(g, w, h, tel, t) {
    frame(g, w, h, 'AIRLOCK');
    mono(g, h * 0.14, 700); g.fillStyle = AMBER; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText((tel.airlockState || 'inner open').toUpperCase(), w / 2, h * 0.55);
    g.textAlign = 'left';
  },

  idle(g, w, h, tel, t) {
    frame(g, w, h, 'STANDBY');
    mono(g, h * 0.09, 500); g.fillStyle = DIM; g.textBaseline = 'top';
    g.fillText(SCREEN_LABEL.ship, 14, h * 0.4);
  },
};

/** The ship's own name on its idle screens (set by ShipSystem when it builds; the Meridian by default). */
export const SCREEN_LABEL = { ship: 'MERIDIAN' };

const KIND_FOR = {
  pilot: ['attitude', 'flight', 'systems'], nav: ['coords', 'map', 'scan'], comms: ['log', 'signal'],
  engineer: ['power', 'reactor'], diag: ['systems', 'reactor'], airlock: ['airlock'], ramp: ['ramp'],
};

// ---------------------------------------------------------------------------
// The scanner: samples the ground around the ship into a hillshaded map.
// ---------------------------------------------------------------------------
export class TerrainScanner {
  constructor(ground, size = 64) {
    this.ground = ground;
    this.size = size;
    this.canvas = HAS_DOM ? Object.assign(document.createElement('canvas'), { width: size, height: size }) : null;
    this.data = new Float32Array(size * size);
    this.rangeM = 1000;
    this._row = size;
    this._pending = false;
    this._origin = null;
    this._frame = null;
    this.builtAt = null;
  }

  /** Begin a fresh scan centred on a world point. frame: {east,north,up} unit vectors. */
  request(pos, frame, rangeM) {
    this._origin = { x: pos.x, y: pos.y, z: pos.z };
    this._frame = frame; this.rangeM = rangeM;
    this._row = 0; this._pending = true;
  }

  /** Do a slice of the work; call every frame. */
  tick(rowsPerCall = 6) {
    if (!this._pending) return;
    const n = this.size, o = this._origin, f = this._frame;
    for (let k = 0; k < rowsPerCall && this._row < n; k++, this._row++) {
      const j = this._row;
      const north = ((n - 1 - j) / (n - 1) - 0.5) * this.rangeM * 2;
      for (let i = 0; i < n; i++) {
        const east = (i / (n - 1) - 0.5) * this.rangeM * 2;
        const x = o.x + f.east.x * east + f.north.x * north, y = o.y + f.east.y * east + f.north.y * north, z = o.z + f.east.z * east + f.north.z * north;
        const l = Math.hypot(x, y, z);
        const gr = this.ground(x / l, y / l, z / l);
        this.data[j * n + i] = gr === null || gr === undefined ? NaN : gr;
      }
    }
    if (this._row >= n) { this._pending = false; this.builtAt = { ...o }; this._paint(); }
  }

  _paint() {
    if (!this.canvas) return;
    const n = this.size, d = this.data;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < d.length; i++) { if (Number.isFinite(d[i])) { lo = Math.min(lo, d[i]); hi = Math.max(hi, d[i]); } }
    const span = Math.max(4, hi - lo);
    const g = this.canvas.getContext('2d');
    const img = g.createImageData(n, n);
    const cell = (this.rangeM * 2) / (n - 1);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const v = d[j * n + i];
      const k = (j * n + i) * 4;
      if (!Number.isFinite(v)) { img.data[k + 3] = 255; continue; }
      const t = (v - lo) / span;
      // hypsometric ramp: deep blue-green low, sand, rust high
      const r = 40 + 190 * t, gg = 90 + 80 * Math.sin(t * Math.PI), b = 130 - 90 * t;
      // hillshade from the north-west
      const ex = d[j * n + Math.min(n - 1, i + 1)] - d[j * n + Math.max(0, i - 1)];
      const ny = d[Math.max(0, j - 1) * n + i] - d[Math.min(n - 1, j + 1) * n + i];
      const sh = 1 + Math.max(-0.5, Math.min(0.5, (-ex + ny) / (cell * 2) * 1.2));
      img.data[k] = Math.min(255, r * sh); img.data[k + 1] = Math.min(255, gg * sh); img.data[k + 2] = Math.min(255, b * sh); img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    this.lo = lo; this.hi = hi;
  }
}

// ---------------------------------------------------------------------------
// One in-world screen
// ---------------------------------------------------------------------------
export class ShipScreens {
  constructor(opts = {}) {
    this.low = opts.tier === 'low';
    this.list = [];
    this.scanner = opts.scanner || null;
  }

  /**
   * @param spec { id, kind, w, h (metres), x,y,z, facing: 'x+'|'x-'|'z+'|'z-' | yaw radians }
   */
  create(spec, parent) {
    const pxPerM = this.low ? 260 : 440;
    const cw = Math.max(96, Math.round(spec.w * pxPerM)), ch = Math.max(64, Math.round(spec.h * pxPerM));
    let material, canvas = null, ctx = null, tex = null;
    if (HAS_DOM) {
      canvas = document.createElement('canvas'); canvas.width = cw; canvas.height = ch;
      ctx = canvas.getContext('2d');
      tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    } else material = new THREE.MeshBasicMaterial({ color: 0x0a2a36 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(spec.w, spec.h), material);
    mesh.position.set(spec.x, spec.y, spec.z);
    const yaw = typeof spec.facing === 'number' ? spec.facing
      : { 'z+': 0, 'x+': Math.PI / 2, 'z-': Math.PI, 'x-': -Math.PI / 2 }[spec.facing];
    mesh.rotation.y = yaw;
    if (spec.tilt) mesh.rotation.x = spec.tilt;
    mesh.name = 'screen:' + spec.id;
    parent.add(mesh);
    const s = { spec, mesh, canvas, ctx, tex, next: 0, kind: spec.kind, w: cw, h: ch, roomId: spec.room };
    this.list.push(s);
    return s;
  }

  /** Redraw the screens near the camera. */
  update(t, tel, camLocal, roomVisible) {
    if (!HAS_DOM) return;
    for (const s of this.list) {
      if (t < s.next) continue;
      if (roomVisible && s.roomId && !roomVisible(s.roomId)) continue;
      const p = s.mesh.position;
      const d = Math.hypot(p.x - camLocal.x, p.y - camLocal.y, p.z - camLocal.z);
      if (d > 20) continue;
      s.next = t + (d < 4 ? 0.09 : d < 9 ? 0.2 : 0.5);
      const fn = DRAW[s.kind] || DRAW.idle;
      const g = s.ctx;
      g.save();
      g.textAlign = 'left'; g.textBaseline = 'top';
      fn(g, s.w, s.h, tel, t, { scanner: this.scanner });
      g.restore();
      s.tex.needsUpdate = true;
    }
  }

  /** Paint a screen kind onto an arbitrary canvas (the DOM panels use this). */
  static paint(kind, canvas, tel, t, ctx) {
    const g = canvas.getContext('2d');
    g.save(); g.textAlign = 'left'; g.textBaseline = 'top';
    (DRAW[kind] || DRAW.idle)(g, canvas.width, canvas.height, tel, t, ctx || {});
    g.restore();
  }
}

export { KIND_FOR };
