// ============================================================================
// debugLayer.js — the layer that turns "something's wrong over there" into a
// number I can act on.
//
// OWNS: the named cell grid painted onto the real terrain, wireframe boxes and
//       identity labels over registered assets, the nearest-assets list, and
//       the readout for wherever the player is standing.
// DOES NOT OWN: any world state. It reads the registry and the field and shows
//       what is already true. Turning it on cannot change the game.
//
// BUILT TO MATCH RUSTFALL
// -----------------------
// Jaron sent screenshots of Rustfall's debug view, and it solves the reporting
// problem better than a plain graticule does. What was taken from it:
//
//   - EVERY CELL IS NAMED, not just the lines between them. Reading a decimal
//     coordinate off a screen and retyping it is work and easy to get wrong.
//     Naming the square you stand in is one glance and round-trips exactly.
//   - A LAYER INDEX in the name. This world has an inside, so depth belongs in
//     the address rather than being lost.
//   - AN ORIGIN CELL marked, so the grid has a visible fixed reference.
//   - WIREFRAME BOXES around assets, not only a floating tag — the box shows
//     the extent that is actually being claimed, which is what you need when
//     something is clipping.
//   - A NEAREST ASSETS list with cell and distance, so an off-screen culprit is
//     still reportable.
//
// THE GOAL IS STILL TO NOT NEED IT
// --------------------------------
// test/validate.mjs is the first line of defence and runs without a human
// looking. This is what is left over when a person still spots something a
// script did not.
// ============================================================================

import * as THREE from 'three';
import {
  cartesianToGeodetic, geodeticToCartesian, formatCoord, coordSlug,
  cellIndex, cellLabel, cellLabelShort, cellId, cellCentre, layerIndex,
  degreesPerCell, cellSpanM, isMinuteLine, isDegreeLine, ARCSEC,
} from '../world/geodesy.js';
import { surfaceRadiusAlong, surfaceRadiusFast, density } from '../world/field.js';

const GRID_COLOR = 0x39d0ff;
const ORIGIN_COLOR = 0xffd257;
const ASSET_COLOR = 0xffa93d;

export class DebugLayer {
  constructor(engine, body, registry, opts = {}) {
    this.engine = engine;
    this.body = body;
    this.registry = registry;
    this.enabled = false;

    this.cellDeg = opts.cellDeg || ARCSEC;      // one arcsecond per cell
    this.radiusCells = opts.radiusCells || 7;      // how far the grid extends
    this.labelRangeM = opts.labelRangeM || 95;     // how far cell names show
    this.maxCellLabels = opts.maxCellLabels || 70;

    this.group = new THREE.Group();
    this.group.name = 'debug-layer';
    this.group.visible = false;
    engine.scene.add(this.group);

    this.gridWorldPos = { x: 0, y: 0, z: 0 };
    engine.track({ worldPos: this.gridWorldPos, object3d: this.group });

    this._lines = null;
    this._boxes = null;
    this._cells = [];                 // { h, r, centreWorld }
    this._lastCell = null;

    this._buildDom();
  }

  _buildDom() {
    const root = document.createElement('div');
    root.id = 'debug-dom';
    root.innerHTML =
      `<div id="dbg-readout"></div>` +
      `<div id="dbg-nearest"><div id="dbg-near-head"><span>NEAREST ASSETS</span>` +
      `<span class="chev">▾</span></div><div id="dbg-near-body"></div></div>` +
      `<div id="dbg-cells"></div>` +
      `<div id="dbg-bubbles"></div>`;
    document.body.appendChild(root);
    this.dom = root;
    this.readout = root.querySelector('#dbg-readout');
    this.nearestPanel = root.querySelector('#dbg-nearest');
    this.nearestBody = root.querySelector('#dbg-near-body');
    // Collapsed by default. It is a reference you open when you need it, not a
    // permanent overlay — on a phone the open panel covered half the world.
    root.querySelector('#dbg-near-head').addEventListener('click', () => {
      this.nearestPanel.classList.toggle('open');
    });
    this.cellHost = root.querySelector('#dbg-cells');
    this.bubbleHost = root.querySelector('#dbg-bubbles');
    this._bubbles = new Map();
    this._cellLabels = [];
    root.style.display = 'none';
  }

  setEnabled(on) {
    this.enabled = !!on;
    this.group.visible = this.enabled;
    this.dom.style.display = this.enabled ? 'block' : 'none';
    if (this.enabled) this._lastCell = null;
    else {
      for (const el of this._bubbles.values()) el.remove();
      this._bubbles.clear();
    }
  }

  // -------------------------------------------------------------------------
  // The grid, painted onto the ground it describes.
  // -------------------------------------------------------------------------
  _buildGrid(centreLat, centreLon) {
    if (this._lines) {
      this.group.remove(this._lines);
      this._lines.traverse((o) => o.geometry && o.geometry.dispose());
    }

    const body = this.body;
    const d = degreesPerCell(body, this.cellDeg);
    const c = cellIndex(body, centreLat, centreLon, this.cellDeg);
    const N = this.radiusCells;

    // Local origin for this build: the ground under the centre cell.
    const o = geodeticToCartesian(body, centreLat, centreLon, 0);
    const ol = Math.hypot(o.x, o.y, o.z);
    const oR = surfaceRadiusFast(body, o.x / ol, o.y / ol, o.z / ol);
    const ox = (o.x / ol) * oR, oy = (o.y / ol) * oR, oz = (o.z / ol) * oR;
    this.gridWorldPos.x = ox; this.gridWorldPos.y = oy; this.gridWorldPos.z = oz;

    const normal = [];
    const minute = [];
    this._cells = [];

    // A point on the cell boundary, lifted a little so the line reads as
    // painted on the ground rather than fighting the surface for depth.
    const pt = (lat, lon, arr) => {
      const p = geodeticToCartesian(body, lat, lon, 0);
      const l = Math.hypot(p.x, p.y, p.z);
      const R = surfaceRadiusFast(body, p.x / l, p.y / l, p.z / l);
      const k = (R + 0.25) / l;
      arr.push(p.x * k - ox, p.y * k - oy, p.z * k - oz);
    };

    // Lines of constant latitude, subdivided so they follow the terrain.
    const SUB = 4;
    for (let i = -N; i <= N + 1; i++) {
      const lat = (c.h + i) * d;
      const out = isMinuteLine(c.h + i) ? minute : normal;
      for (let j = -N; j <= N; j++) {
        for (let s = 0; s < SUB; s++) {
          const lonA = (c.r + j + s / SUB) * d;
          const lonB = (c.r + j + (s + 1) / SUB) * d;
          pt(lat, lonA, out); pt(lat, lonB, out);
        }
      }
    }
    // Lines of constant longitude.
    for (let j = -N; j <= N + 1; j++) {
      const lon = (c.r + j) * d;
      const out = isMinuteLine(c.r + j) ? minute : normal;
      for (let i = -N; i <= N; i++) {
        for (let s = 0; s < SUB; s++) {
          const latA = (c.h + i + s / SUB) * d;
          const latB = (c.h + i + (s + 1) / SUB) * d;
          pt(latA, lon, out); pt(latB, lon, out);
        }
      }
    }

    // Cell centres, for the name labels.
    for (let i = -N; i <= N; i++) {
      for (let j = -N; j <= N; j++) {
        const h = c.h + i, r = c.r + j;
        const cc = cellCentre(body, h, r, this.cellDeg);
        const p = geodeticToCartesian(body, cc.lat, cc.lon, 0);
        const l = Math.hypot(p.x, p.y, p.z);
        const R = surfaceRadiusFast(body, p.x / l, p.y / l, p.z / l);
        const k = (R + 1.1) / l;
        this._cells.push({ h, r, world: { x: p.x * k, y: p.y * k, z: p.z * k } });
      }
    }

    this._lines = new THREE.Group();
    this._lines.name = 'cell-grid';
    for (const [arr, color, opacity, width] of [
      // Cyan at 0.42 over bright orange regolith washed out to nothing.
      // The grid has to be legible against the ground it is drawn on.
      [normal, GRID_COLOR, 0.8, 1],
      // Arcminute lines brighter, like the heavier rules on a real map.
      [minute, ORIGIN_COLOR, 1.0, 2],
    ]) {
      if (!arr.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      const seg = new THREE.LineSegments(g, new THREE.LineBasicMaterial({
        color, transparent: true, opacity, depthWrite: false, linewidth: width,
      }));
      seg.frustumCulled = false;
      this._lines.add(seg);
    }
    this.group.add(this._lines);
    this._lastCell = { h: c.h, r: c.r };
  }

  // -------------------------------------------------------------------------
  // Wireframe boxes on registered assets — the extent actually being claimed.
  // -------------------------------------------------------------------------
  _buildBoxes() {
    if (this._boxes) {
      this.group.remove(this._boxes);
      this._boxes.traverse((o) => o.geometry && o.geometry.dispose());
    }
    this._boxes = new THREE.Group();
    this._boxes.name = 'asset-boxes';

    const o = this.gridWorldPos;
    for (const rec of this.registry.all()) {
      if (!rec.position) continue;
      const size = rec.measured || rec.authored;
      if (!size) continue;
      const dx = rec.position.x - o.x, dy = rec.position.y - o.y, dz = rec.position.z - o.z;
      if (Math.hypot(dx, dy, dz) > 200) continue;

      const geo = new THREE.BoxGeometry(size.width, size.height, size.depth);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: ASSET_COLOR, transparent: true, opacity: 0.8, depthWrite: false })
      );
      geo.dispose();
      // Boxes sit on the ground and stand plumb, like the things they wrap.
      const up = new THREE.Vector3(rec.position.x, rec.position.y, rec.position.z).normalize();
      edges.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
      edges.position.set(
        dx + up.x * size.height / 2,
        dy + up.y * size.height / 2,
        dz + up.z * size.height / 2
      );
      edges.frustumCulled = false;
      this._boxes.add(edges);
    }
    this.group.add(this._boxes);
  }

  update(walker, camera) {
    if (!this.enabled) return;
    const g = walker.geodetic;
    const c = cellIndex(this.body, g.lat, g.lon, this.cellDeg);

    // Rebuild only when the player crosses into a new cell — not every frame.
    if (!this._lastCell || this._lastCell.h !== c.h || this._lastCell.r !== c.r) {
      this._buildGrid(g.lat, g.lon);
      this._buildBoxes();
    }

    this._updateReadout(walker, c);
    this._updateCellLabels(camera, c);
    this._updateNearest(walker);
    this._updateBubbles(camera);
  }

  _currentLayer(walker) {
    const p = walker.worldPos;
    const r = Math.hypot(p.x, p.y, p.z) || 1;
    const surf = surfaceRadiusFast(this.body, p.x / r, p.y / r, p.z / r);
    return layerIndex(surf - r);
  }

  _updateReadout(walker, c) {
    const g = walker.geodetic;
    const body = this.body;
    const layer = this._currentLayer(walker);
    const clearance = walker.altitudeAboveGround();

    this.readout.innerHTML = `
      <div class="dbg-title">DEBUG · ${body.name.toUpperCase()}</div>
      <div class="dbg-row"><span>SQUARE</span><b class="dbg-cellid">${cellId(body.id, layer, c.h, c.r)}</b></div>
      <div class="dbg-row"><span>POS</span><b>${formatCoord(g.lat, g.lon, g.alt)}</b></div>
      <div class="dbg-row"><span>SLUG</span><b class="dbg-slug">${coordSlug(body.id, g.lat, g.lon, g.alt)}</b></div>
      <div class="dbg-row"><span>GROUND</span><b>${clearance === Infinity ? '—' : clearance.toFixed(2) + ' m'} · ${walker.groundMaterialName()}</b></div>
      <div class="dbg-row"><span>CELL</span><b>1&Prime; &asymp; ${cellSpanM(body).toFixed(1)} m</b></div>
      <div class="dbg-row"><span>GRAV</span><b>${body.surfaceGravity.toFixed(3)} m/s²</b></div>
      <div class="dbg-row"><span>ASSETS</span><b>${this.registry.all().length} registered</b></div>
      <div class="dbg-row"><span>FPS</span><b>${this.engine.fps.toFixed(0)}</b></div>`;
  }

  /** A name in every cell, the way Rustfall does it. */
  _updateCellLabels(camera, current) {
    const cam = this.engine.cameraWorldPos;
    const v = new THREE.Vector3();
    let used = 0;

    // Nearest first, so the cap trims the far ones rather than arbitrary ones.
    const sorted = this._cells
      .map((cell) => ({
        cell,
        d: Math.hypot(cell.world.x - cam.x, cell.world.y - cam.y, cell.world.z - cam.z),
      }))
      .filter((x) => x.d < this.labelRangeM)
      .sort((a, b) => a.d - b.d)
      .slice(0, this.maxCellLabels);

    const taken = [];
    for (const { cell, d } of sorted) {
      v.set(cell.world.x - cam.x, cell.world.y - cam.y, cell.world.z - cam.z).project(camera);
      if (v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) continue;

      const sx = (v.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
      const isHereCell = cell.h === current.h && cell.r === current.r;
      const isOriginCell = isMinuteLine(cell.h) && isMinuteLine(cell.r);
      // The cell you occupy and each arcminute corner always win their space.
      if (!isHereCell && !isOriginCell &&
          taken.some((t) => Math.abs(t.x - sx) < 92 && Math.abs(t.y - sy) < 20)) continue;
      taken.push({ x: sx, y: sy });

      let el = this._cellLabels[used];
      if (!el) {
        el = document.createElement('div');
        el.className = 'dbg-cell';
        this.cellHost.appendChild(el);
        this._cellLabels[used] = el;
      }

      // Full coordinate where it matters; seconds-only on the rest, since the
      // degrees and minutes are already on screen in the readout.
      el.textContent = (isHereCell || isOriginCell)
        ? cellLabel(cell.h, cell.r)
        : cellLabelShort(cell.h, cell.r);
      el.className = 'dbg-cell' + (isHereCell ? ' here' : '') + (isOriginCell ? ' origin' : '');
      el.style.transform = `translate(-50%,-50%) translate(${sx}px, ${sy}px)`;
      el.style.opacity = String(Math.max(0.25, 1 - d / this.labelRangeM));
      el.style.display = 'block';
      used++;
    }
    for (let i = used; i < this._cellLabels.length; i++) this._cellLabels[i].style.display = 'none';
  }

  /** Nearby assets, listed with cell and distance, so an off-screen one is still reportable. */
  _updateNearest(walker) {
    const p = walker.worldPos;
    const rows = this.registry.all()
      .filter((r) => r.position)
      .map((r) => {
        const d = Math.hypot(r.position.x - p.x, r.position.y - p.y, r.position.z - p.z);
        const g = cartesianToGeodetic(this.body, r.position.x, r.position.y, r.position.z);
        const c = cellIndex(this.body, g.lat, g.lon, this.cellDeg);
        return { id: r.id, name: r.name, d, cell: cellLabel(c.h, c.r) };
      })
      .sort((a, b) => a.d - b.d)
      .slice(0, 7);

    // Only rebuild the list while it is open — a closed panel costs nothing.
    if (!this.nearestPanel.classList.contains('open')) {
      this.nearestPanel.querySelector('#dbg-near-head span').textContent =
        `NEAREST ASSETS (${rows.length})`;
      return;
    }
    this.nearestPanel.querySelector('#dbg-near-head span').textContent =
      `NEAREST ASSETS (${rows.length})`;
    this.nearestBody.innerHTML = rows.map((r) =>
      `<div class="dbg-near"><b>${r.id}</b>` +
      `<i>${r.name}<s>${r.d < 1000 ? r.d.toFixed(1) + ' m' : (r.d / 1000).toFixed(1) + ' km'}</s></i></div>`
    ).join('');
  }

  _updateBubbles(camera) {
    const seen = new Set();
    const cam = this.engine.cameraWorldPos;
    const v = new THREE.Vector3();
    const maxDist = 160;

    const candidates = [];
    for (const rec of this.registry.all()) {
      if (!rec.position) continue;
      const dx = rec.position.x - cam.x, dy = rec.position.y - cam.y, dz = rec.position.z - cam.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > maxDist) continue;
      const h = (rec.measured?.height || rec.authored?.height || 1);
      v.set(dx, dy + h + 0.6, dz).project(camera);
      if (v.z > 1) continue;
      candidates.push({
        rec, dist,
        anchorX: (v.x * 0.5 + 0.5) * window.innerWidth,
        anchorY: (-v.y * 0.5 + 0.5) * window.innerHeight,
      });
    }
    candidates.sort((a, b) => a.dist - b.dist);

    const placed = [];
    const H = 58, W = 190, PAD = 5;

    for (const cnd of candidates) {
      const rec = cnd.rec;
      let el = this._bubbles.get(rec.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'dbg-bubble';
        this.bubbleHost.appendChild(el);
        this._bubbles.set(rec.id, el);
      }

      const s = this.registry.summary(rec.id, this.body);
      const g = cartesianToGeodetic(this.body, rec.position.x, rec.position.y, rec.position.z);
      const c = cellIndex(this.body, g.lat, g.lon, this.cellDeg);
      el.innerHTML =
        `<b>${s.id}</b><i>${s.name} · ${cellLabel(c.h, c.r)}</i>` +
        `<span>${s.size} · ${s.mass}</span>`;

      let y = cnd.anchorY, guard = 0, moved = true;
      while (moved && guard++ < 40) {
        moved = false;
        for (const p of placed) {
          if (Math.abs(p.x - cnd.anchorX) < W && Math.abs(p.y - y) < H) { y = p.y - H - PAD; moved = true; }
        }
      }
      placed.push({ x: cnd.anchorX, y });

      el.style.transform = `translate(-50%,-100%) translate(${cnd.anchorX}px, ${y}px)`;
      el.style.opacity = String(Math.max(0.4, 1 - cnd.dist / maxDist));
      el.style.setProperty('--stalk', `${Math.max(9, cnd.anchorY - y + 9)}px`);
      seen.add(rec.id);
    }

    for (const [id, el] of this._bubbles) {
      if (!seen.has(id)) { el.remove(); this._bubbles.delete(id); }
    }
  }

  /** Copyable one-line bug report for wherever the player is. */
  reportAt(walker) {
    const g = walker.geodetic;
    const layer = this._currentLayer(walker);
    const c = cellIndex(this.body, g.lat, g.lon, this.cellDeg);
    return {
      cell: cellId(this.body.id, layer, c.h, c.r),
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
