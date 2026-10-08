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
import { WORLD_CLIENTS } from '../worlds/_client-manifest.js';
import { makeFrame, setFrameState } from '../core/frameMath.js';
import { worldKin } from './frames.js';

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
  // steep ground shows lighter, fresher material (see LocalPatch._slopeTint): crater walls and groove banks read from orbit
  const nor = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const l = Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i)) || 1;
    const cs = Math.min(1, Math.max(0.05, (nor.getX(i) * pos.getX(i) + nor.getY(i) * pos.getY(i) + nor.getZ(i) * pos.getZ(i)) / l)), sl = Math.sqrt(1 - cs * cs) / cs;   // tan of the slope
    const t = Math.min(1, Math.max(0, (sl - 0.3) / 0.7)), m = 1 + 0.24 * t * t * (3 - 2 * t);
    colors[i * 3] *= m * (1 - 0.03 * t); colors[i * 3 + 1] *= m; colors[i * 3 + 2] *= m * (1 + 0.05 * t);
  }
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
    this.space = o.space || null;       // WORLD2: the space system (a world's client.js dress() needs the ship's materials and the people library)
    this.id = o.id;
    this.body = makeMoon(o.id);
    // the frame MOVES (origin and turn: SpaceSystem.updateFrames keeps it where the clock puts the world); its entries are drawn through it
    this.frame = makeFrame(this.id); this.frame.body = this.body;
    setFrameState(this.frame, worldKin(this.id, o.time ?? 0));
    this.built = false;
    this.active = false;          // tiers are being kept under the focus
    this.entries = [];
    this.client = null;           // what the world's client.js `dress()` returned: { update?(dt, focus), dispose?() }
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
    this.shell = body.withoutSun(() => buildMoonShell(body, low ? 256 : body.radiusMean > 1e6 ? 512 : 384));       // WORLD2: a planet-sized world needs more; F2: baked without the Sun's crater shadows (seen at every hour)
    engine.scene.add(this.shell);
    this._sunFill(this.shell.material);
    this.shellEntry = engine.track({ worldPos: { x: 0, y: 0, z: 0 }, object3d: this.shell, frame: this.frame });
    // a coarse copy for when it is a few pixels across (Phobos from the port, from Mars orbit): 4,600 triangles instead of 65,000
    this.shellFar = body.withoutSun(() => buildMoonShell(body, body.radiusMean > 1e6 ? 96 : 48));
    this.shellFar.material.fog = false; this._sunFill(this.shellFar.material);
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
    this.far = mk({ sizeM: 8000, res: low ? 65 : 97, skirtM: 60, horizon: true }, 'patch-far');      // horizon: real sun shadows from its own heights, like the tier below, so the two match where they meet
    this.far.mesh.material.dispose();
    this.far.mesh.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 });
    // the far tier is all you see from a few hundred metres up: give it mottling and a lumpy normal (regolith.js, far mode), matched in colour to the tier below it
    this.far.regPeriod = 3600;
    // how this world's ground is drawn comes from its def (`render`): Phobos is the dark grooved one, anything else the Deimos-like default
    const R = { farColor: 1.18, tierColor: 1.22, roughness: 0.97, farRegolith: { kind: 'moon', bump: 0.55 }, regolith: { moon: true, bump: 0.3, pebble: 0.14 }, flatNear: false, across: false, ...(body.spec.render || {}) };
    this.far.mesh.material.color.setScalar(R.farColor);
    this.far._regolith = installRegolith(this.far.mesh.material, THREE, { ...R.farRegolith, far: true, across: body.axesWorld && body.axesWorld.ey });
    this.far.mesh.receiveShadow = false;
    this.far.handover = installTierDiscard(this.far.mesh.material);
    // WORLD2: a body hundreds of kilometres across needs the planet's coarser tiers too (Mars has 64 km and 320 km ones): from a few
    // thousand metres up the horizon is 50 km away, and the whole-body shell's triangles are ten kilometres wide.
    this.distant = [];
    if (body.radiusMean > 100_000) {
      for (const [i, o] of (low ? [{ sizeM: 64000, res: 65, skirtM: 300 }, { sizeM: 320000, res: 49, skirtM: 1400 }] : [{ sizeM: 64000, res: 97, skirtM: 300 }, { sizeM: 320000, res: 65, skirtM: 1400 }]).entries()) {
        const p = mk({ ...o, horizon: false }, `patch-distant-${i}`);
        p.mesh.material.dispose();
        p.mesh.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 3 + i });
        p.mesh.receiveShadow = false;
        p.mesh.material.color.setScalar(R.farColor);
        if (R.farRegolith && R.farRegolith.earth) { p.regPeriod = 3600; p._regolith = installRegolith(p.mesh.material, THREE, { ...R.farRegolith, far: true }); }      // Earth only: ragged coasts and grass in the wide tiers too (def.render.farRegolith.earth)
        p.handover = installTierDiscard(p.mesh.material);
        this.distant.push(p);
      }
    }
    this.mid = mk({ sizeM: 880, res: 132, skirtM: 15, horizon: true }, 'patch-mid');
    this.near = mk({ sizeM: 48, res: 81, horizon: true }, 'patch-near');
    // dark soil shows every dark fleck: soften the pebbles and the bump on the patches you walk on
    // (the regolith grain darkens the albedo to about 0.8 on average: lift the walking-scale patches by the same amount so they match the shell and the far tier)
    const across = body.axesWorld && body.axesWorld.ey;
    for (const p of [this.mid, this.near]) {
      p.mesh.material.roughness = R.roughness;
      p.mesh.material.color.setScalar(R.tierColor);
      p._regolith = installRegolith(p.mesh.material, THREE, { ...R.regolith, ...(R.across ? { across } : {}), ...(R.flatNear ? { flat: p === this.near } : {}) });
    }
    this.terrain.material.color.setScalar(R.tierColor);
    installCoverDiscard(this.mid.mesh.material, this.terrain.cover, this.midCover, THREE);
    installCoverDiscard(this.near.mesh.material, this.terrain.cover, this.nearCover, THREE);
    this.shellHandover = installTierDiscard(this.shell.material);
    // a moon has no air: Mars's dusty-sky fog must not wash it out (a world WITH an atmosphere keeps the scene fog, tinted by its own sky: see SpaceSystem.late) when it is seen across a daylit sky (Phobos from the port)
    for (const m of [this.shell.material, this.far.mesh.material, this.mid.mesh.material, this.near.mesh.material, this.terrain.material, ...this.distant.map((q) => q.mesh.material)]) { m.fog = !!body.atmosphere; m.needsUpdate = true; }
    this.entries = [this.shellEntry, this.farEntry, this.far.entry, this.mid.entry, this.near.entry, ...this.distant.map((q) => q.entry)];
    this.buildMs = performance.now() - t0;
    this.built = true;
    this.setTiersVisible(false);
    // the world's own dressing (src/worlds/<name>/client.js: sites, buildings, props, weather): built once with the world, ticked with it
    const mod = WORLD_CLIENTS[this.id];
    if (mod && mod.dress) { try { this.client = mod.dress(this, { THREE, engine }) || null; } catch (e) { console.error(`world ${this.id}: dress() failed`, e); } }
    return this;
  }

  /**
   * F2: the Sun lights the world seen from afar even when it is night where the camera stands (the key light is off then: it follows the camera's
   * horizon). A moon high over the night side is sunlit unless Mars's shadow is on it: this adds the Sun's diffuse light to the shells alone,
   * from `uFillDir` (the Sun in the scene's axes) at strength `uFillK` (0 by day, and 0 on the moon's own ground). SpaceSystem.late sets both.
   */
  _sunFill(mat) {
    const u = this.sunFill || (this.sunFill = { dir: { value: new THREE.Vector3(0, 1, 0) }, k: { value: 0 } });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uFillDir = u.dir; sh.uniforms.uFillK = u.k;
      sh.fragmentShader = `uniform vec3 uFillDir; uniform float uFillK;
` + sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
 reflectedLight.directDiffuse += diffuseColor.rgb * uFillK * max(dot(normal, normalize((viewMatrix * vec4(uFillDir, 0.0)).xyz)), 0.0);`);
    };
    mat.customProgramCacheKey = () => 'moonSunFill';
    mat.needsUpdate = true;
  }
  setVisible(on) { if (!this.built) return; this.wantVisible = on; this._lod(this._lastDist ?? 1e9); if (!on) this.setTiersVisible(false); }
  /** The whole-moon shell in two detail levels, by how far the camera is from the moon's centre. */
  _lod(dist) { this._lastDist = dist; const near = dist < this.body.radiusMean * (this.body.radiusMean > 1e6 ? 8 : 30); this.shell.visible = !!this.wantVisible && near; this.shellFar.visible = !!this.wantVisible && !near; }
  setTiersVisible(on) {
    if (!this.built) return;
    this.far.mesh.visible = this.mid.mesh.visible = this.near.mesh.visible = on; for (const p of this.distant) p.mesh.visible = on; this.active = on;
    // WORLD2: with the tiers hidden the whole-world shell must not keep a square cut out of it (a world big enough to be seen whole shows the hole)
    if (!on) { this.shellHandover.uniforms.uTierHalf.value = 0; this.far.handover.uniforms.uTierHalf.value = 0; for (const p of this.distant) p.handover.uniforms.uTierHalf.value = 0; }
  }
  get _tiers() { return [this.near, this.mid, this.far, ...this.distant]; }

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
    for (const p of this.distant) { p._job = null; p.rebuild(f.x, f.y, f.z); p.entry.worldPos = p.worldPos; }
    this._joins();
  }

  _joins() {
    // outside-in, so each join samples the coarser tier's final surface (as main.js does for Mars)
    const D = this.distant;
    for (let i = D.length - 2; i >= 0; i--) D[i].blendEdgeTo(D[i + 1]);
    if (D.length) this.far.blendEdgeTo(D[0]);
    this.mid.blendEdgeTo(this.far, this.near);
    this.far.handover.update(this.far.worldPos, this.mid);
    let fine = this.far;
    for (const p of D) { p.handover.update(p.worldPos, fine); fine = p; }
    this.shellHandover.update({ x: 0, y: 0, z: 0 }, fine);

  }

  /**
   * Per frame. `focus` is the camera (or walker) in THIS moon's coordinates. Tiers are rebuilt a couple of milliseconds a
   * frame, only while the focus is within `rangeM` of the surface; further out only the shell is drawn.
   */
  update(dt, focus, budgetMs = this.tier === 'low' ? 2.5 : 4) {
    if (!this.built) return;
    const r = Math.hypot(focus.x, focus.y, focus.z), surf = this.body.surfaceRadius(focus.x / r, focus.y / r, focus.z / r);
    this._lod(r);
    if (this.client && this.client.update) this.client.update(dt, focus);       // WORLD2: ticked whenever the world is in range, not only while the tiers are drawn
    const alt = r - surf;
    const want = alt < (this.body.spec.tierAltM || 30000);
    if (want !== this.active) { if (want) this.force(focus); else this.setTiersVisible(false); }
    if (!this.active) return;
    // keep the tiers under the focus
    for (const p of this._tiers) {
      if (!p.rebuilding && p.needsRebuild(focus.x, focus.y, focus.z)) p.beginRebuild(focus.x, focus.y, focus.z);
    }
    let left = budgetMs;
    for (const p of this._tiers) {
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
