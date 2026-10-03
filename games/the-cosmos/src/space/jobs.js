// ============================================================================
// jobs.js — reasons to leave Mars. Three, from the bibles' faucets (missions, salvage, mining, bounties, trade):
//
//   1. SURVEY (played end to end): the Marineris Survey Office pays a standing bounty on core samples from Phobos. Fly to the
//      Stickney East survey pad, walk (or hop) to the marked sites, take a sample at each, fly home, land at the port: paid.
//      No accept button, no hand-in button: take samples and land, and the office pays. The samples are real lots cut from the
//      real ground with a spade bite, and they ride in the ship's hold as matter.
//   2. RESOURCES only found off Mars: dig the hydrated-clay pockets under the Stickney ejecta (and plain Phobos regolith), stow
//      what the hopper holds in the ship, and the hold keeps it as cargo for the port's depot to buy (economy hook: addCargo).
//      A distress beacon on the survey band leads to a drifting cargo module on Phobos: salvage it for alloy and a claim payment.
//   3. RAIDERS: outside Mars's neutral airspace the drones attack; each one shot down pays a bounty (hook: award).
//
// OWNS: the sample sites, their markers on Phobos, the hold, and what is paid when. DOES NOT OWN: money: it calls
// space.hooks.award / addCargo / removeCargo, and the economy builder wires those to the real ledger.
// ============================================================================

import * as THREE from 'three';
import { makeMoon } from './moonField.js';
import { buildSampleBeacon, buildCargoModule } from './hardware.js';

export const SAMPLE_PAY_CREDITS = 300;
export const SAMPLE_MAX = 3;
export const SAMPLE_REACH_M = 4.5;
export const STOW_REACH_M = 38;
export const SALVAGE_KG = 1800, SALVAGE_CREDITS = 150, SALVAGE_REACH_M = 6;

export const MAT_ITEM = { 'MAT-PHOBOS-CLAY': 'phobos-hydrated-clay', 'MAT-PHOBOS-REGOLITH': 'phobos-regolith', 'MAT-PHOBOS-RUBBLE': 'phobos-rubble',
  'MAT-DEIMOS-REGOLITH': 'deimos-regolith', 'MAT-DEIMOS-RUBBLE': 'deimos-rubble' };

export class SpaceJobs {
  constructor(space) {
    this.space = space;
    this.taken = new Set();          // site ids sampled this contract
    this.hold = [];                  // lots stowed aboard (matter is conserved: they were cut from the ground)
    this.samplesAboard = 0;          // core samples in canisters, not yet delivered
    this.markers = null;
    this.paidTotal = 0;
    this.salvaged = false;
    this.beaconHeard = false;
    this.nearest = null;
  }

  // ---- the world side: markers on Phobos -------------------------------------------------------------------------------
  _ensureMarkers() {
    const w = this.space.worlds.get('phobos');
    if (this.markers || !w || !w.built) return;
    const body = w.body, frame = w.frame, engine = this.space.engine;
    this.markers = { group: [], sites: new Map() };
    const mkMat = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, fog: false });
    const place = (obj, p, up) => {
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(up.x, up.y, up.z));
      engine.scene.add(obj);
      engine.track({ worldPos: { x: p.x, y: p.y, z: p.z }, object3d: obj, quaternion: q, frame });
    };
    const upAt = (p) => { const l = Math.hypot(p.x, p.y, p.z); return { x: p.x / l, y: p.y / l, z: p.z / l }; };
    const low = this.space.tier === 'low';
    for (const s of body.sampleSites) {
      const built = buildSampleBeacon({ low, id: s.id });
      place(built.group, s.point, upAt(s.point));
      this.markers.sites.set(s.id, { lamp: built.lamp, halo: built.halo, group: built.group });
    }
    // the drifting cargo module: plated hardware, a dogged door, a broken stripe, a lamp that blinks until it is claimed
    if (body.derelict) {
      const built = buildCargoModule({ low });
      place(built.group, body.derelict.point, body.derelict.up);
      // seat it on the slope it came down on: the group's axes are the tangent frame at the derelict, +Y up
      {
        const dl = body.derelict, q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dl.up.x, dl.up.y, dl.up.z));
        const v = new THREE.Vector3();
        built.settle((x, z) => {
          v.set(x, 0, z).applyQuaternion(q);
          const px = dl.point.x + v.x, py = dl.point.y + v.y, pz = dl.point.z + v.z, l = Math.hypot(px, py, pz) || 1, R = body.surfaceRadius(px / l, py / l, pz / l);
          return (px / l * R - dl.point.x) * dl.up.x + (py / l * R - dl.point.y) * dl.up.y + (pz / l * R - dl.point.z) * dl.up.z;
        });
      }
      this.markers.derelict = { group: built.group, lamp: built.lamp };
    }
    // the landing pad: a painted disc with four corner lights (it is a real graded plane in the field: moonField's pad)
    const pi = body.padInfo, c = document.createElement('canvas'); c.width = c.height = 1024;
    const g2 = c.getContext('2d');
    g2.fillStyle = '#58554f'; g2.fillRect(0, 0, 1024, 1024);
    // fine neutral grit (no coloured specks: close up the eye sees every texel), then the markings
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 26000; i++) { const v = 70 + Math.floor(rnd() * 34); g2.fillStyle = `rgba(${v},${v - 2},${v - 5},0.38)`; const sz = 1 + Math.floor(rnd() * 2); g2.fillRect(Math.floor(rnd() * 1024), Math.floor(rnd() * 1024), sz, sz); }
    g2.strokeStyle = '#e8b53a'; g2.lineWidth = 22; g2.beginPath(); g2.arc(512, 512, 428, 0, Math.PI * 2); g2.stroke();
    g2.lineWidth = 11; g2.beginPath(); g2.arc(512, 512, 380, 0, Math.PI * 2); g2.stroke();
    g2.fillStyle = '#e8b53a'; g2.font = 'bold 140px sans-serif'; g2.textAlign = 'center'; g2.fillText('STICKNEY', 512, 490); g2.fillText('EAST', 512, 640);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const R = 31;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 72), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.03;
    const pad = new THREE.Group(); pad.name = 'landing-pad:phobos'; pad.add(disc);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4, lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.0, 8), mkMat(0xffd070));
      lamp.position.set(Math.cos(a) * (R - 1.5), 0.5, Math.sin(a) * (R - 1.5)); pad.add(lamp);
    }
    place(pad, pi.point, pi.up);
    this.markers.pad = pad;
  }

  get sites() { const w = this.space.worlds.get('phobos'); return w ? w.body.sampleSites : []; }

  // ---- per frame -------------------------------------------------------------------------------------------------------
  update(dt) {
    this._ensureMarkers();
    if (this.markers) {
      const t = this.space.engine.timeSec;
      for (const [id, m] of this.markers.sites) {
        const done = this.taken.has(id);
        m.lamp.material.color.setHex(done ? 0x62ff8a : 0x42d9ff);
        m.halo.material.color.setHex(done ? 0x62ff8a : 0x42d9ff);
        m.halo.material.opacity = done ? 0.25 : 0.4 + 0.25 * Math.sin(t * 3);
      }
    }
    if (this.markers && this.markers.derelict) { const t = this.space.engine.timeSec; this.markers.derelict.lamp.visible = !this.salvaged && Math.sin(t * 4) > -0.2; }
    // nearest site still to do, for the readout
    this.nearest = null;
    if (this.space.frameId === 'phobos') {
      const wp = this.space.walker.worldPos, ship = this.space.ship;
      const p = ship.aboard ? ship.flight.pos : wp;
      let best = null;
      for (const s of this.sites) {
        if (this.taken.has(s.id)) continue;
        const d = Math.hypot(s.point.x - p.x, s.point.y - p.y, s.point.z - p.z);
        if (!best || d < best.d) best = { d, site: s };
      }
      this.nearest = best;
    }
  }

  // ---- what the contextual button offers on foot -----------------------------------------------------------------------
  /** { label, run } or null: Take a core sample at a marker, or stow the hopper in the ship. */
  contextAction(rampOffered = false) {
    const sp = this.space;
    if (sp.frameId !== 'phobos' || sp.ship.aboard) return null;
    const w = sp.walker.worldPos;
    for (const s of this.sites) {
      if (this.taken.has(s.id)) continue;
      if (Math.hypot(s.point.x - w.x, s.point.y - w.y, s.point.z - w.z) <= SAMPLE_REACH_M) return { label: `Take core sample (${this.taken.size + 1}/${SAMPLE_MAX})`, run: () => this.takeSample(s) };
    }
    const dl = sp.worlds.get('phobos').body.derelict;
    if (dl && !this.salvaged && Math.hypot(dl.point.x - w.x, dl.point.y - w.y, dl.point.z - w.z) <= SALVAGE_REACH_M) return { label: 'Salvage the cargo module', run: () => this.salvage() };
    const carried = sp.digger.carried;
    if (carried.length && !rampOffered) {
      const loc = sp.ship.flight.toLocal(w, {});
      if (Math.hypot(loc.x, loc.z) < STOW_REACH_M && loc.y < 12) {
        const kg = carried.reduce((a, l) => a + l.massKg, 0);
        return { label: `Stow ${kg >= 1000 ? (kg / 1000).toFixed(1) + ' t' : Math.round(kg) + ' kg'} in the hold`, run: () => this.stow() };
      }
    }
    return null;
  }

  takeSample(s) {
    const sp = this.space, w = sp.worlds.get('phobos'), E = w.edits;
    if (this.taken.has(s.id)) return { ok: false, msg: 'Already sampled.' };
    const p = s.point, l = Math.hypot(p.x, p.y, p.z), up = { x: p.x / l, y: p.y / l, z: p.z / l }, r = 0.09;
    const lot = E.carve({ x: p.x - up.x * r * 0.5, y: p.y - up.y * r * 0.5, z: p.z - up.z * r * 0.5, r, maxMassKg: 50 });
    if (!lot) return { ok: false, msg: E.lastRefusal || 'Cannot sample here.' };
    lot.isSample = true;
    this.hold.push(lot);
    this.taken.add(s.id);
    this.samplesAboard++;
    sp.hooks.addCargo('phobos-core-sample', lot.massKg, { site: s.id, material: lot.materialName });
    sp.say(`Core sample ${this.taken.size} of ${SAMPLE_MAX} sealed (${lot.massKg.toFixed(1)} kg of ${lot.materialName}).`);
    if (this.taken.size >= SAMPLE_MAX) sp.say('That is all three. Take them home to the Survey Office at Marineris Port.');
    return { ok: true, msg: `Sample ${this.taken.size}/${SAMPLE_MAX}`, lot };
  }

  /** The drifting module: its cargo comes aboard and the claim is paid (once). */
  salvage() {
    const sp = this.space;
    if (this.salvaged) return { ok: false, msg: 'Already claimed.' };
    this.salvaged = true;
    sp.hooks.addCargo('salvage-alloy', SALVAGE_KG, { source: 'cargo module, Phobos' });
    sp.hooks.award(SALVAGE_CREDITS, 'salvage claim: drifting cargo module, Phobos');
    this.paidTotal += SALVAGE_CREDITS;
    sp.say(`Salvaged: ${(SALVAGE_KG / 1000).toFixed(1)} t of alloy plate from the racks. Claim paid: ${SALVAGE_CREDITS} credits.`);
    return { ok: true, msg: 'Salvaged.' };
  }

  /** Move what the hopper holds into the ship: matter stays matter (the lots are kept), the cargo hook is told. */
  stow() {
    const sp = this.space, carried = sp.digger.carried;
    if (!carried.length) return { ok: false, msg: 'Nothing in the hopper.' };
    const byItem = new Map();
    for (const lot of carried.splice(0, carried.length)) {
      this.hold.push(lot);
      for (const p of lot.parts || [{ materialId: lot.materialId, massKg: lot.massKg }]) {
        const item = MAT_ITEM[p.materialId] || 'regolith-other';
        byItem.set(item, (byItem.get(item) || 0) + p.massKg);
      }
    }
    for (const [item, kg] of byItem) sp.hooks.addCargo(item, kg, {});
    const txt = [...byItem].map(([i, kg]) => `${kg >= 1000 ? (kg / 1000).toFixed(2) + ' t' : Math.round(kg) + ' kg'} ${i.replace('phobos-', '').replace('-', ' ')}`).join(', ');
    sp.say(`Stowed in the hold: ${txt}.`);
    return { ok: true, msg: 'Stowed.' };
  }

  /** The ship set down. At the port with samples aboard: the Survey Office pays. */
  onLanded(dest, trip) {
    const sp = this.space;
    if (dest.kind === 'moon' && dest.moon === 'phobos' && !this.beaconHeard && !this.salvaged) {
      this.beaconHeard = true;
      sp.say('Comms: a weak distress beacon on the survey band, about 800 m south-west of the pad. A drifting cargo module.', true);
    }
    if (dest.kind === 'port' && this.samplesAboard > 0) {
      const n = Math.min(this.samplesAboard, SAMPLE_MAX), pay = n * SAMPLE_PAY_CREDITS;
      const kg = this.hold.filter((l) => l.isSample).reduce((a, l) => a + l.massKg, 0);
      this.hold = this.hold.filter((l) => !l.isSample);
      sp.hooks.removeCargo('phobos-core-sample', kg);
      sp.hooks.award(pay, `Survey Office: ${n} Phobos core sample${n > 1 ? 's' : ''}`);
      this.paidTotal += pay; this.samplesAboard = 0; this.taken.clear();
      sp.say(`Survey Office pays ${pay} credits for ${n} Phobos core sample${n > 1 ? 's' : ''}.`);
    }
  }

  /** For the panels: plain lines. */
  summary() {
    const sp = this.space, L = [];
    L.push(`<b>Survey Office · Phobos cores</b>: ${SAMPLE_PAY_CREDITS} credits each, up to ${SAMPLE_MAX}. Sampled ${this.taken.size}/${SAMPLE_MAX}${this.samplesAboard ? `, ${this.samplesAboard} aboard` : ''}.`);
    L.push(`<span class="dim">Fly to Phobos (Stickney East pad), walk to the cyan beacons, tap Take core sample, fly home and land at the port.</span>`);
    const cargo = [...sp.ledger.cargo].filter(([k, v]) => v > 0.5 && k !== 'phobos-core-sample');
    if (cargo.length) L.push(`Hold: ${cargo.map(([k, v]) => `${v >= 1000 ? (v / 1000).toFixed(2) + ' t' : Math.round(v) + ' kg'} ${k}`).join(', ')}`);
    L.push(`<span class="dim">Distress beacon: ${this.salvaged ? 'the cargo module on Phobos is claimed.' : 'a drifting cargo module on Phobos, south-west of the pad. Walk up to it and salvage it.'}</span>`);
    L.push(`<span class="dim">Raiders outside Mars airspace: 25 credits each.</span>`);
    L.push(`<span class="dim">Ship account (credits): ${sp.ledger.credits}</span>`);
    return L.join('<br>');
  }
}
