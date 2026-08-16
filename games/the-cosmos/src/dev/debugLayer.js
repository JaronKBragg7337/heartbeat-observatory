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
    root.innerHTML = `<div id="dbg-readout"></div><div id="dbg-labels"></div><div id="dbg-bubbles"></div>`;
    document.body.appendChild(root);
    this.dom = root;
    this.readout = root.querySelector('#dbg-readout');
    this.labelHost = root.querySelector('#dbg-labels');
    this.bubbleHost = root.querySelector('#dbg-bubbles');
    this._bubbles = new Map();          // assetId -> element
    this._labels = [];                  // pooled degree labels
    this._gridNodes = [];               // { lat, lon, world } for labelling
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

    // Label the major intersections: where a major latitude line crosses a
    // major longitude line is the natural place to print the coordinate.
    this._gridNodes = [];
    for (let i = -nSteps; i <= nSteps; i++) {
      const lat = lat0 + i * step;
      if (Math.abs(Math.round(lat / step)) % this.majorEvery !== 0) continue;
      if (lat > 89.9 || lat < -89.9) continue;
      for (let j = -nSteps; j <= nSteps; j++) {
        const lon = lon0 + j * step;
        if (Math.abs(Math.round(lon / step)) % this.majorEvery !== 0) continue;
        const p = geodeticToCartesian(body, lat, lon, 0);
        const l = Math.hypot(p.x, p.y, p.z);
        const R = surfaceRadiusAlong(body, p.x / l, p.y / l, p.z / l, { minStep: 2 });
        const k = (R + 1.4) / l;    // float the label just above the ground
        this._gridNodes.push({ lat, lon, world: { x: p.x * k, y: p.y * k, z: p.z * k } });
      }
    }

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
    this._updateGridLabels(camera);
    this._updateBubbles(camera);
  }

  /**
   * Degree labels on the graticule. A grid of unlabelled lines shows you that
   * there IS a coordinate system; it does not tell you where you are on it.
   * These print the actual latitude and longitude of each major line, so the
   * grid can be read rather than just seen.
   */
  _updateGridLabels(camera) {
    const cam = this.engine.cameraWorldPos;
    const v = new THREE.Vector3();
    let used = 0;

    for (const node of this._gridNodes) {
      const dx = node.world.x - cam.x, dy = node.world.y - cam.y, dz = node.world.z - cam.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > 900) continue;

      v.set(dx, dy, dz).project(camera);
      if (v.z > 1 || v.x < -1 || v.x > 1 || v.y < -1 || v.y > 1) continue;

      let el = this._labels[used];
      if (!el) {
        el = document.createElement('div');
        el.className = 'dbg-gridlabel';
        this.labelHost.appendChild(el);
        this._labels[used] = el;
      }
      const ns = node.lat >= 0 ? 'N' : 'S';
      const ew = node.lon >= 0 ? 'E' : 'W';
      el.textContent = `${Math.abs(node.lat).toFixed(2)}°${ns} ${Math.abs(node.lon).toFixed(2)}°${ew}`;
      el.style.transform =
        `translate(-50%,-50%) translate(${(v.x * 0.5 + 0.5) * window.innerWidth}px, ` +
        `${(-v.y * 0.5 + 0.5) * window.innerHeight}px)`;
      el.style.opacity = String(Math.max(0.2, 1 - dist / 900));
      el.style.display = 'block';
      used++;
    }
    for (let i = used; i < this._labels.length; i++) this._labels[i].style.display = 'none';
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

    // Collect first, lay out second. A bubble is only useful if you can read
    // it, and two bubbles on top of each other are worth less than one — so
    // nothing is positioned until every candidate is known.
    const candidates = [];
    for (const rec of this.registry.all()) {
      if (!rec.position) continue;
      const dx = rec.position.x - cam.x, dy = rec.position.y - cam.y, dz = rec.position.z - cam.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > maxDist) continue;

      v.set(dx, dy + (rec.authored?.height || 1) * 0.6 + 0.8, dz);
      v.project(camera);
      if (v.z > 1) continue;

      candidates.push({
        rec, dist,
        anchorX: (v.x * 0.5 + 0.5) * window.innerWidth,
        anchorY: (-v.y * 0.5 + 0.5) * window.innerHeight,
      });
    }

    // Nearest gets the best position; further ones move out of its way.
    candidates.sort((a, b) => a.dist - b.dist);

    const placed = [];
    const H = 64, W = 172, PAD = 6;

    for (const c of candidates) {
      const rec = c.rec;
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

      // Lift the label until it clears everything already placed, then draw a
      // leader line back down to the thing it names so the link stays obvious.
      let y = c.anchorY;
      let guard = 0;
      let moved = true;
      while (moved && guard++ < 40) {
        moved = false;
        for (const p of placed) {
          if (Math.abs(p.x - c.anchorX) < W && Math.abs(p.y - y) < H) {
            y = p.y - H - PAD;
            moved = true;
          }
        }
      }
      placed.push({ x: c.anchorX, y });

      const lift = c.anchorY - y;
      el.style.transform = `translate(-50%,-100%) translate(${c.anchorX}px, ${y}px)`;
      el.style.opacity = String(Math.max(0.35, 1 - c.dist / maxDist));
      // The stalk grows to span whatever distance the bubble was pushed.
      el.style.setProperty('--stalk', `${Math.max(9, lift + 9)}px`);
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
