// ============================================================================
// moonWorld.js — a moon you can land on: its shell, its ground at four resolutions, its dug ground.
//
// OWNS: the scene objects of one moon (the whole-moon shell, a 8 km / 880 m / 48 m set of heightfield tiers under the
//       focus, the brick meshes of anything dug), the moon's EditStore, and the ground sampler the walker and ship use.
// DOES NOT OWN: the shape (moonField.js), the frame switch (spaceSystem.js), what the player does there.
//
// It reuses the planet's classes unchanged (LocalPatch, EditedTerrain, EditStore, the tier discard shaders): they take a
// `body` and ask the field. Everything here is in the MOON's frame (centre at the origin); the engine draws a moon's entries
// at frame.origin + position, whichever frame the camera is in.
// ============================================================================

import * as THREE from 'three';
import { installRegolith } from '../world/regolith.js';
import { LocalPatch, installTierDiscard, shadeVertex } from '../world/planetMesh.js';
import { EditStore } from '../world/edits.js';
import { EditedTerrain, installCoverDiscard } from '../world/excavation.js';
import { attachEdits, surfaceRadiusFast, materialAt } from '../world/field.js';
import { makeMoon } from './moonField.js';

/** The whole moon as one mesh: spacing about 180 m (phone 270 m). The tiers draw everything finer. */
export function buildMoonShell(body, segW = 256) {
  const segH = Math.round(segW / 2);
  const geo = new THREE.SphereGeometry(1, segW, segH);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const R = body.surfaceRadius(x, y, z);
    pos.setXYZ(i, x * R, y * R, z * R);
    shadeVertex(body, x * R, y * R, z * R, 0, c);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.computeVertexNormals();
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.97, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  }));
  mesh.name = `shell:${body.id}`;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  return mesh;
}

export class MoonWorld {
  /**
   * @param o { engine, id, tier }
   */
  constructor(o) {
    this.engine = o.engine; this.tier = o.tier || 'high';
    this.id = o.id;
    this.body = makeMoon(o.id);
    this.frame = { id: this.id, origin: this.body.centre, body: this.body };
    this.built = false;
    this.active = false;          // tiers are being kept under the focus
    this.entries = [];
  }

  /** The brick meshes' view of the engine: entries are drawn in this moon's frame; the camera is asked for in it. */
  _engineProxy() {
    const e = this.engine, frame = this.frame, tmp = {};
    return {
      scene: e.scene,
      track: (entry) => { entry.frame = frame; return e.track(entry); },
      untrack: (entry) => e.untrack(entry),
      get cameraWorldPos() { return e.cameraIn(frame, tmp); },
      get frameCount() { return e.frameCount; },
    };
  }

  build() {
    if (this.built) return this;
    const t0 = performance.now();
    const { engine, body } = this, low = this.tier === 'low';
    this.shell = buildMoonShell(body, low ? 256 : 384);
    engine.scene.add(this.shell);
    this.shellEntry = engine.track({ worldPos: { x: 0, y: 0, z: 0 }, object3d: this.shell, frame: this.frame });
    // a coarse copy for when it is a few pixels across (Phobos from the port, from Mars orbit): 4,600 triangles instead of 65,000
    this.shellFar = buildMoonShell(body, 48);
    this.shellFar.material.fog = false;
    engine.scene.add(this.shellFar);
    this.farEntry = engine.track({ worldPos: { x: 0, y: 0, z: 0 }, object3d: this.shellFar, frame: this.frame });

    this.edits = new EditStore(body);
    attachEdits(this.edits);
    this.terrain = new EditedTerrain(this._engineProxy(), body, this.edits, { rangeM: low ? 56 : 90, budgetMs: low ? 3 : 6 });
    this.midCover = { value: new THREE.Vector3() }; this.nearCover = { value: new THREE.Vector3() };

    const mk = (opts, name) => {
      const p = new LocalPatch(body, opts); p.mesh.name = `${name}:${body.id}`;
      engine.scene.add(p.mesh);
      p.entry = engine.track({ worldPos: p.worldPos, object3d: p.mesh, frame: this.frame });
      return p;
    };
    this.far = mk({ sizeM: 8000, res: low ? 65 : 97, skirtM: 60 }, 'patch-far');
    this.far.mesh.material.dispose();
    this.far.mesh.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 });
    this.far.mesh.receiveShadow = false;
    this.far.handover = installTierDiscard(this.far.mesh.material);
    this.mid = mk({ sizeM: 880, res: 132, skirtM: 15 }, 'patch-mid');
    this.near = mk({ sizeM: 48, res: 81 }, 'patch-near');
    // dark soil shows every dark fleck: soften the pebbles and the bump on the patches you walk on
    // (the regolith grain darkens the albedo to about 0.8 on average: lift the walking-scale patches by the same amount so they match the shell and the far tier)
    const phobos = body.id === 'phobos';
    const across = body.axesWorld && body.axesWorld.ey;
    for (const p of [this.mid, this.near]) {
      p.mesh.material.roughness = phobos ? 0.985 : 0.97;
      p.mesh.material.color.setScalar(1.22);
      p._regolith = installRegolith(p.mesh.material, THREE, phobos
        ? { kind: 'phobos', bump: 0.95, pebble: 0.22, across }
        : { bump: 0.55, pebble: 0.22 });
    }
    this.terrain.material.color.setScalar(1.22);
    installCoverDiscard(this.mid.mesh.material, this.terrain.cover, this.midCover, THREE);
    installCoverDiscard(this.near.mesh.material, this.terrain.cover, this.nearCover, THREE);
    this.shellHandover = installTierDiscard(this.shell.material);
    // a moon has no air: Mars's dusty-sky fog must not wash it out when it is seen across a daylit sky (Phobos from the port)
    for (const m of [this.shell.material, this.far.mesh.material, this.mid.mesh.material, this.near.mesh.material, this.terrain.material]) { m.fog = false; m.needsUpdate = true; }
    this.entries = [this.shellEntry, this.farEntry, this.far.entry, this.mid.entry, this.near.entry];
    this.buildMs = performance.now() - t0;
    this.built = true;
    this.setTiersVisible(false);
    return this;
  }

  setVisible(on) { if (!this.built) return; this.wantVisible = on; this._lod(this._lastDist ?? 1e9); if (!on) this.setTiersVisible(false); }
  /** The whole-moon shell in two detail levels, by how far the camera is from the moon's centre. */
  _lod(dist) { this._lastDist = dist; const near = dist < this.body.radiusMean * 30; this.shell.visible = !!this.wantVisible && near; this.shellFar.visible = !!this.wantVisible && !near; }
  setTiersVisible(on) { if (!this.built) return; this.far.mesh.visible = this.mid.mesh.visible = this.near.mesh.visible = on; this.active = on; }

  /** The ground the walker stands on: the drawn surface where it has not been changed, the field where it has. */
  groundSampler() {
    return (dx, dy, dz, r) => {
      if (!this.edits.isEmpty && this.terrain.touchedAt(dx * r, dy * r, dz * r)) return null;
      const n = this.near.surfaceRadiusAt(dx, dy, dz);
      if (n !== null) return n;
      return this.mid.surfaceRadiusAt(dx, dy, dz);
    };
  }
  collisionActive() { return (x, y, z) => !this.edits.isEmpty && this.edits.affects(x, y, z, 2.5); }
  /** The ship's ground: exact, from the field (the same under dug ground). */
  shipGround() { return (dx, dy, dz) => surfaceRadiusFast(this.body, dx, dy, dz); }

  /** Rebuild every tier at once under a point in this frame's coordinates (arrival, review shots). */
  force(focus) {
    if (!this.built) this.build();
    this.setTiersVisible(true);
    const f = focus;
    this.near._job = null; this.mid._job = null;
    this.near.rebuild(f.x, f.y, f.z);
    this.near.entry.worldPos = this.near.worldPos;
    const np = this.near.worldPos;
    this.mid.setExcluded([{ centre: { x: np.x, y: np.y, z: np.z }, radius: this.near.sizeM * 0.40 }]);
    this.mid.rebuild(f.x, f.y, f.z); this.mid.entry.worldPos = this.mid.worldPos;
    this.far.rebuild(f.x, f.y, f.z); this.far.entry.worldPos = this.far.worldPos;
    this._joins();
  }

  _joins() {
    this.mid.blendEdgeTo(this.far);
    this.far.handover.update(this.far.worldPos, this.mid);
    this.shellHandover.update({ x: 0, y: 0, z: 0 }, this.far);
  }

  /**
   * Per frame. `focus` is the camera (or walker) in THIS moon's coordinates. Tiers are rebuilt a couple of milliseconds a
   * frame, only while the focus is within `rangeM` of the surface; further out only the shell is drawn.
   */
  update(dt, focus, budgetMs = this.tier === 'low' ? 2.5 : 4) {
    if (!this.built) return;
    const r = Math.hypot(focus.x, focus.y, focus.z), surf = this.body.surfaceRadius(focus.x / r, focus.y / r, focus.z / r);
    this._lod(r);
    const alt = r - surf;
    const want = alt < 30000;
    if (want !== this.active) { if (want) this.force(focus); else this.setTiersVisible(false); }
    if (!this.active) return;
    // keep the tiers under the focus
    for (const p of [this.near, this.mid, this.far]) {
      if (!p.rebuilding && p.needsRebuild(focus.x, focus.y, focus.z)) p.beginRebuild(focus.x, focus.y, focus.z);
    }
    let left = budgetMs;
    for (const p of [this.near, this.mid, this.far]) {
      if (!p.rebuilding || left <= 0) continue;
      const t0 = performance.now();
      if (p.stepRebuild(left)) {
        p.entry.worldPos = p.worldPos;
        if (p === this.near) { const np = p.worldPos; this.mid.setExcluded([{ centre: { x: np.x, y: np.y, z: np.z }, radius: p.sizeM * 0.40 }]); }
      }
      left -= performance.now() - t0;
    }
    this._joins();
    if (!this.edits.isEmpty || this.terrain.meshes.size) {
      this.terrain.update(dt, focus);
      this.terrain.coverOffsetFor(this.mid.worldPos, this.midCover);
      this.terrain.coverOffsetFor(this.near.worldPos, this.nearCover);
    }
  }

  /** What a point on the moon is made of (HUD). */
  materialName(p) { return materialAt(this.body, p.x, p.y, p.z).name; }
}
