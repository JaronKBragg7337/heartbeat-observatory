// ============================================================================
// debugLayer.js — the layer that turns "something's wrong over there" into a
// number I can act on.
//
// OWNS: the lat/long graticule drawn onto the real terrain, the floating
//       identity bubble over every nearby registered asset, and the coordinate
//       readout for wherever the player is standing.
// DOES NOT OWN: any world state. It reads the registry and the field and
//       renders what is already true. Turning it on cannot change the game.
//
// WHY IT EXISTS
// -------------
// A bug report like "there's a rock stuck in a hill" costs a search. The same
// report as "COS-MARS-PRP-0042, mars:-14.0031,-59.1988,+1216.4" costs nothing:
// it is a coordinate, an identity, and a reproduction step in one line.
//
// The graticule is drawn ON the terrain, not as a flat overlay, so a grid line
// bending over a ridge tells you the shape of the ground as well as its
// address. Lines follow the field, so they curve with the world.
//
// THE GOAL IS TO NOT NEED IT
// --------------------------
// This layer is for the cases automation misses. The validator in
// test/validate.mjs is the first line of defence and runs without a human
// looking — placement, collision, and dimension drift are caught there. This
// is what is left over when a person still spots something a script did not.
// ============================================================================

import * as THREE from 'three';
import { cartesianToGeodetic, geodeticToCartesian, formatCoord, coordSlug } from '../world/geodesy.js';
import { surfaceRadiusAlong, materialAt, density } from '../world/field.js';

const GRID_COLOR = 0x39d0ff;
const GRID_COLOR_MAJOR = 0xffd257;

export class DebugLayer {
  constructor(engine, body, registry, opts = {}) {
    this.engine = engine;
    this.body = body;
    this.registry = registry;
    this.enabled = false;

    // Graticule spacing in degrees. At Mars' radius 0.01 deg is ~592 m, which
    // is the right order for a walking player; the major line every 0.05 deg
    // gives a coarser read without clutter.
    this.minorStepDeg = opts.minorStepDeg || 0.01;
    this.majorEvery = opts.majorEvery || 5;
    this.spanDeg = opts.spanDeg || 0.06;      // how far out the grid extends
    this.samplesPerLine = opts.samplesPerLine || 48;

    this.group = new THREE.Group();
    this.group.name = 'debug-layer';
    this.group.visible = false;
    engine.scene.add(this.group);

    this.gridWorldPos = { x: 0, y: 0, z: 0 };
    engine.track({ worldPos: this.gridWorldPos, object3d: this.group });

    this._lines = null;
    this._lastBuildCentre = null;

    this._buildDom();
  }

  // --- DOM: bubbles and the readout panel. ----------------------------------
  _buildDom() {
    const root = document.createElement('div');
    root.id = 'debug-dom';
    root.innerHTML = `<div id="dbg-readout"></div><div id="dbg-bubbles"></div>`;
    document.body.appendChild(root);
    this.dom = root;
    this.readout = root.querySelector('#dbg-readout');
    this.bubbleHost = root.querySelector('#dbg-bubbles');
    this._bubbles = new Map();          // assetId -> element
    root.style.display = 'none';
  }

  setEnabled(on) {
    this.enabled = !!on;
    this.group.visible = this.enabled;
    this.dom.style.display = this.enabled ? 'block' : 'none';
    if (this.enabled) this._lastBuildCentre = null;   // force a rebuild
    else for (const el of this._bubbles.values()) el.remove(), this._bubbles.clear();
  }

  // --- The graticule, sampled onto the real ground. --------------------------
  _buildGrid(centreLat, centreLon) {
    if (this._lines) {
      this.group.remove(this._lines);
      this._lines.traverse((o) => o.geometry && o.geometry.dispose());
    }

    const body = this.body;
    const step = this.minorStepDeg;
    const span = this.spanDeg;
    const lat0 = Math.round(centreLat / step) * step;
    const lon0 = Math.round(centreLon / step) * step;

    // Minor and major lines are separate meshes with their own colour, rather
    // than one mesh with a vertex-colour attribute. Two draw calls is cheaper
    // than keeping a per-vertex colour array in step with a per-segment
    // position array, which is a classic place for a silent mismatch.
    const minorPos = [];
    const majorPos = [];

    // Origin of the local render space for this grid: the ground under centre.
    const o = geodeticToCartesian(body, centreLat, centreLon, 0);
    const olen = Math.hypot(o.x, o.y, o.z);
    const oR = surfaceRadiusAlong(body, o.x / olen, o.y / olen, o.z / olen);
    const ox = (o.x / olen) * oR, oy = (o.y / olen) * oR, oz = (o.z / olen) * oR;
    this.gridWorldPos.x = ox; this.gridWorldPos.y = oy; this.gridWorldPos.z = oz;

    const pushPoint = (lat, lon, arr) => {
      const p = geodeticToCartesian(body, lat, lon, 0);
      const l = Math.hypot(p.x, p.y, p.z);
      const R = surfaceRadiusAlong(body, p.x / l, p.y / l, p.z / l, { minStep: 2 });
      // 0.35 m above the surface so the line reads as painted on the ground
      // rather than z-fighting with it.
      const k = (R + 0.35) / l;
      arr.push(p.x * k - ox, p.y * k - oy, p.z * k - oz);
    };

    const nSteps = Math.round(span / step);

    // Lines of constant latitude (running east-west).
    for (let i = -nSteps; i <= nSteps; i++) {
      const lat = lat0 + i * step;
      if (lat > 89.9 || lat < -89.9) continue;
      const isMajor = Math.abs(Math.round(lat / step)) % this.majorEvery === 0;
      const out = isMajor ? majorPos : minorPos;
      const seg = [];
      for (let s = 0; s <= this.samplesPerLine; s++) {
        const lon = lon0 - span + (2 * span * s) / this.samplesPerLine;
        pushPoint(lat, lon, seg);
      }
      for (let s = 0; s < this.samplesPerLine; s++) {
        out.push(seg[s * 3], seg[s * 3 + 1], seg[s * 3 + 2],
                 seg[s * 3 + 3], seg[s * 3 + 4], seg[s * 3 + 5]);
      }
    }

    // Lines of constant longitude (running north-south).
    for (let i = -nSteps; i <= nSteps; i++) {
      const lon = lon0 + i * step;
      const isMajor = Math.abs(Math.round(lon / step)) % this.majorEvery === 0;
      const out = isMajor ? majorPos : minorPos;
      const seg = [];
      for (let s = 0; s <= this.samplesPerLine; s++) {
        const lat = lat0 - span + (2 * span * s) / this.samplesPerLine;
        if (lat > 89.9 || lat < -89.9) continue;
        pushPoint(lat, lon, seg);
      }
      for (let s = 0; s < seg.length / 3 - 1; s++) {
        out.push(seg[s * 3], seg[s * 3 + 1], seg[s * 3 + 2],
                 seg[s * 3 + 3], seg[s * 3 + 4], seg[s * 3 + 5]);
      }
    }

    this._lines = new THREE.Group();
    this._lines.name = 'graticule';
    for (const [arr, color, opacity] of [
      [minorPos, GRID_COLOR, 0.34],
      [majorPos, GRID_COLOR_MAJOR, 0.75],
    ]) {
      if (!arr.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      const seg = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
        color, transparent: true, opacity, depthWrite: false,
      }));
      seg.frustumCulled = false;
      this._lines.add(seg);
    }
    this.group.add(this._lines);
    this._lastBuildCentre = { lat: centreLat, lon: centreLon };
  }

  /** Per-frame. Cheap when disabled. */
  update(walker, camera) {
    if (!this.enabled) return;

    const g = walker.geodetic;

    // Rebuild the grid when the player has walked a meaningful fraction of it.
    const c = this._lastBuildCentre;
    if (!c || Math.abs(g.lat - c.lat) > this.spanDeg * 0.3 ||
              Math.abs(g.lon - c.lon) > this.spanDeg * 0.3) {
      this._buildGrid(g.lat, g.lon);
    }

    this._updateReadout(walker);
    this._updateBubbles(camera);
  }

  _updateReadout(walker) {
    const g = walker.geodetic;
    const body = this.body;
    const clearance = walker.altitudeAboveGround();
    const mat = walker.groundMaterialName();
    const spacing = (this.minorStepDeg * Math.PI / 180) * body.radiusMean;

    this.readout.innerHTML = `
      <div class="dbg-title">DEBUG · ${body.name.toUpperCase()}</div>
      <div class="dbg-row"><span>POS</span><b>${formatCoord(g.lat, g.lon, g.alt)}</b></div>
      <div class="dbg-row"><span>SLUG</span><b class="dbg-slug">${coordSlug(body.id, g.lat, g.lon, g.alt)}</b></div>
      <div class="dbg-row"><span>GROUND</span><b>${clearance === Infinity ? '—' : clearance.toFixed(2) + ' m'} · ${mat}</b></div>
      <div class="dbg-row"><span>GRID</span><b>${this.minorStepDeg}° ≈ ${spacing.toFixed(0)} m</b></div>
      <div class="dbg-row"><span>GRAV</span><b>${body.surfaceGravity.toFixed(3)} m/s²</b></div>
      <div class="dbg-row"><span>ASSETS</span><b>${this.registry.all().length} registered</b></div>
      <div class="dbg-row"><span>FPS</span><b>${this.engine.fps.toFixed(0)}</b></div>`;
  }

  /**
   * Floating identity bubbles. Only nearby assets get one — a bubble for
   * something 40 km away is noise, not information.
   */
  _updateBubbles(camera) {
    const seen = new Set();
    const cam = this.engine.cameraWorldPos;
    const v = new THREE.Vector3();
    const maxDist = 260;

    for (const rec of this.registry.all()) {
      if (!rec.position) continue;
      const dx = rec.position.x - cam.x, dy = rec.position.y - cam.y, dz = rec.position.z - cam.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > maxDist) continue;

      // Project to screen. Behind the camera means no bubble.
      v.set(dx, dy + (rec.authored?.height || 1) * 0.6 + 0.8, dz);
      v.project(camera);
      if (v.z > 1) continue;

      const sx = (v.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-v.y * 0.5 + 0.5) * window.innerHeight;

      let el = this._bubbles.get(rec.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'dbg-bubble';
        this.bubbleHost.appendChild(el);
        this._bubbles.set(rec.id, el);
      }

      const s = this.registry.summary(rec.id, this.body);
      el.innerHTML =
        `<b>${s.id}</b>` +
        `<i>${s.name}</i>` +
        `<span>${s.coord}</span>` +
        `<span>${s.size} · ${s.mass}</span>` +
        `<span>col:${s.collision} · ${s.material}</span>`;
      el.style.transform = `translate(-50%,-100%) translate(${sx}px, ${sy}px)`;
      // Fade with distance so a cluster stays readable.
      el.style.opacity = String(Math.max(0.25, 1 - dist / maxDist));
      seen.add(rec.id);
    }

    for (const [id, el] of this._bubbles) {
      if (!seen.has(id)) { el.remove(); this._bubbles.delete(id); }
    }
  }

  /** Copyable one-line bug report for whatever the player is looking at. */
  reportAt(walker) {
    const g = walker.geodetic;
    return {
      slug: coordSlug(this.body.id, g.lat, g.lon, g.alt),
      coord: formatCoord(g.lat, g.lon, g.alt),
      groundMaterial: walker.groundMaterialName(),
      clearanceM: walker.altitudeAboveGround(),
      solidHere: density(this.body, walker.worldPos.x, walker.worldPos.y, walker.worldPos.z) < 0,
      nearby: this.registry.all()
        .filter((r) => r.position)
        .map((r) => ({ id: r.id, d: Math.hypot(
          r.position.x - walker.worldPos.x,
          r.position.y - walker.worldPos.y,
          r.position.z - walker.worldPos.z) }))
        .filter((r) => r.d < 120)
        .sort((a, b) => a.d - b.d)
        .slice(0, 6),
    };
  }
}
