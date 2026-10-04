// ============================================================================
// ships/_liner/flights.js — the departure board's rows. looks-r1.
//
// One shared canvas for every board on a liner. The rows are ships the game
// already flies: the liner, the convoy that holds station beside it, and the
// descent ship on Pad 01. No class registry is listed as a flight, and no
// convoy ship is given a destination it does not have.
//
// There is no published timetable. The clock column is a stable fold of the
// registry id, so the same ship always shows the same time.
// ============================================================================

import * as THREE from 'three';
import { OPENING_CONVOY } from '../transport/convoy.js';
import { LINER, KESTREL } from '../../opening/script.js';

// script.js: the liner is inbound to Mars and lands on Apron A.
// dialogue.js: "cleared to land on Apron A", "Touchdown at Marineris Port".
// KESTREL.spot is Pad 01. Which world it then flies is the player's choice, so the board does not name one.
const LINER_TO = 'Marineris Port';
const LINER_STATUS = 'APRON A';

function clock(registry) {
  let h = 2166136261;
  for (let i = 0; i < registry.length; i++) h = Math.imul(h ^ registry.charCodeAt(i), 16777619);
  const hh = 6 + ((h >>> 0) % 14);
  const mm = (h >>> 8) % 60;
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

function companyStatus(type) {
  if (type === 'escort') return 'ESCORT';
  if (type === 'bulker') return 'BULKER';
  return 'IN COMPANY';
}

export function boardRows() {
  const beside = 'WITH ' + LINER.registry;
  const rows = [{ time: clock(LINER.registry), ship: LINER.name, reg: LINER.registry, to: LINER_TO, status: LINER_STATUS }];
  for (const e of OPENING_CONVOY) {
    rows.push({ time: clock(e.registry), ship: e.name, reg: e.registry, to: beside, status: companyStatus(e.type) });
  }
  rows.push({ time: clock(KESTREL.registry), ship: KESTREL.name, reg: KESTREL.registry, to: 'Pad 01', status: 'ON PAD' });
  return rows;
}

const COL = { time: 28, ship: 128, reg: 560, to: 730, status: 900 };
let shared = null;

function paintBoard(g, w, h) {
  g.fillStyle = '#07141c';
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(95,216,255,0.05)';
  for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
  g.strokeStyle = '#5fd8ff';
  g.lineWidth = 4;
  g.strokeRect(8, 8, w - 16, h - 16);
  g.font = '700 22px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  g.fillStyle = '#5fd8ff';
  g.textBaseline = 'top';
  g.fillText('DEPARTURES', 28, 22);
  g.font = '600 16px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  g.fillStyle = '#8fb8c4';
  const headY = 58;
  g.fillText('TIME', COL.time, headY);
  g.fillText('SHIP', COL.ship, headY);
  g.fillText('REG', COL.reg, headY);
  g.fillText('TO', COL.to, headY);
  g.fillText('STATUS', COL.status, headY);
  g.fillStyle = 'rgba(95,216,255,0.35)';
  g.fillRect(24, 82, w - 48, 2);
  const rows = boardRows();
  const step = Math.min(48, (h - 110) / rows.length);
  rows.forEach((r, i) => {
    const y = 96 + i * step;
    const onPad = r.status === 'APRON A' || r.status === 'ON PAD';
    g.font = '500 18px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    g.fillStyle = '#d7f4ff';
    g.fillText(r.time, COL.time, y);
    g.fillText(r.ship, COL.ship, y);
    g.fillText(r.reg, COL.reg, y);
    g.fillText(r.to, COL.to, y);
    g.fillStyle = onPad ? '#6dff9c' : '#ffb45a';
    g.fillText(r.status, COL.status, y);
  });
}

/** One material shared by every board. Null where there is no canvas (the board stays a dark bezel). */
export function boardMaterial() {
  if (typeof document === 'undefined') return null;
  if (shared) return shared;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  paintBoard(canvas.getContext('2d'), canvas.width, canvas.height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  shared = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  return shared;
}
