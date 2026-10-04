// ============================================================================
// opening/crashFx.js - what the season's crash looks like from inside the Kestrel (SPOILER table, "per-season crash causes"): a solar storm
// (the Sun flares, comms and guidance die, the lights go), a meteor (a rock comes in from starboard and the hull is struck), a pirate hit
// (two raiders pull alongside, then fire), a failed part (smoke streams past the window, the lights strobe amber), a bad landing in weather
// (dust or ice fog rises until nothing can be seen). Pure picture: it moves things in the space scene and the ship's lights and returns the
// numbers the DOM overlays use. It owns no rule; the clock is the script's (script.js, dialogue.js).
// ============================================================================
import * as THREE from 'three';
import { shipDef } from '../ships/registry.js';
import { visualsFor } from '../ships/visuals.js';
import { KESTREL_PHASE } from './script.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), DEG = Math.PI / 180;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

let soft = null;
function softTex() {
  if (soft) return soft; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.4, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  soft = new THREE.CanvasTexture(c); return soft;
}
function boltMesh() {
  const g = new THREE.PlaneGeometry(1, 1); g.translate(0, .5, 0);
  const m = new THREE.MeshBasicMaterial({ color: 0xff7a4a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 4; mesh.visible = false; return mesh;
}

export class CrashFx {
  /** o: { space: SpaceScene, stage: ShipStage (the Kestrel), cause, worldId, tier, mats (ship exterior materials), scene (the main THREE.Scene) } */
  constructor(o) {
    Object.assign(this, { space: o.space, stage: o.stage, cause: o.cause, worldId: o.worldId, low: o.tier === 'low', mats: o.mats, scene: o.scene });
    this.root = new THREE.Group(); this.root.name = 'crash-fx'; this.space.root.add(this.root);
    this.t = 0; this.out = { flash: 0, flashColor: '255,255,255', noise: 0, red: 0, impact: false, shake: 0 };
    this._impactDone = false;
    if (this.cause === 'meteor') this._buildMeteor();
    if (this.cause === 'pirates') this._buildRaiders();
    if (this.cause === 'failure') this._buildSmoke();
    if (this.cause === 'weather') this._buildStreaks();
  }

  _buildMeteor() {
    const g = new THREE.IcosahedronGeometry(9, 2), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 1 + .35 * Math.sin(p.getX(i) * .7 + p.getY(i) * 1.3) * Math.cos(p.getZ(i) * .9); p.setXYZ(i, p.getX(i) * k * 1.2, p.getY(i) * k * .8, p.getZ(i) * k); }
    g.computeVertexNormals();
    this.rock = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x4a423c, roughness: 1, emissive: 0x2a0d04, emissiveIntensity: .8 }));
    this.tail = boltMesh(); this.tail.material.color.set(0xffb070); this.root.add(this.rock, this.tail); this.rock.visible = false;
  }
  _buildRaiders() {
    this.raiders = [];
    const def = shipDef('raider'), vis = visualsFor('raider'), layout = { ...def.layout, custom: vis.custom || null };
    for (const [i, side] of [-1, 1].entries()) {
      const dtex = vis.decalTexture ? vis.decalTexture(THREE, def, i ? 'GRIM TIDY' : 'FINDERS KEEPERS', 'CR-0' + (7 + i)) : null;
      const decal = dtex ? new THREE.MeshBasicMaterial({ map: dtex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }) : null;
      const ext = vis.buildExterior(layout, this.mats, { tier: this.low ? 'low' : 'high', decal, def });
      vis.applyNeutralPose(ext); ext.legs.forEach((leg) => { leg.foot.position.y = -.35; leg.piston.scale.y = .55; leg.piston.position.y = .2; });
      for (const e of ext.engines) { e.outer.visible = e.core.visible = true; }
      const holder = new THREE.Group(); holder.add(ext.root); holder.visible = false; this.root.add(holder);
      this.raiders.push({ holder, side, ext, decal });
    }
    this.bolts = Array.from({ length: 10 }, () => { const b = boltMesh(); this.root.add(b); return { mesh: b, t0: -1 }; });
  }
  _buildSmoke() {
    this.smokeSprites = Array.from({ length: this.low ? 14 : 26 }, (_, i) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex(), color: 0x1d1a1a, transparent: true, depthWrite: false, opacity: 0, fog: false }));
      sp.renderOrder = 3; this.root.add(sp); return { sp, phase: i / (this.low ? 14 : 26) };
    });
  }
  _buildStreaks() {
    const n = this.low ? 140 : 320, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - .5) * 60; pos[i * 3 + 1] = (Math.random() - .3) * 30; pos[i * 3 + 2] = (Math.random() - .5) * 120; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.streakPoints = new THREE.Points(g, new THREE.PointsMaterial({ color: this.worldId === 'ceres' ? 0xdfe8f2 : 0xc9a07c, size: .5, map: softTex(), transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true, fog: false }));
    this.streakPoints.frustumCulled = false; this.root.add(this.streakPoints); this.streakSeed = pos.slice();
  }

  /** Advance to clock time t (seconds on the Kestrel's clock). `eye` is the camera in the space frame. Returns the overlay numbers. */
  update(dt, t, eye) {
    this.t = t; const o = this.out, st = this.stage, cause = this.cause;
    o.flash = 0; o.noise = 0; o.red = 0; o.shake = 0; o.impact = false;
    const crash = KESTREL_PHASE.crash, k = smooth(36, crash, t);
    let lamps = 1, amb = 1, redAmb = 0;
    if (cause === 'storm') {
      const sun = this.space; const pulse = 1 + 1.5 * k * (.5 + .5 * Math.sin(t * 7.1) * Math.sin(t * 2.9));
      sun.sunCore.scale.setScalar(2 * 2.5e8 * Math.tan(.5 * DEG) * pulse); sun.sunGlow.scale.setScalar(2 * 2.5e8 * Math.tan(6 * DEG) * (1 + 2.2 * k * Math.abs(Math.sin(t * 3.3))));
      if (t > 28) o.flash = Math.max(0, Math.pow(Math.max(0, Math.sin(t * 6.3) * Math.sin(t * 2.1 + 1) - .5), 2) * 1.5) * smooth(28, 44, t);
      o.flashColor = '210,190,255';
      if (t > 44) { o.noise = smooth(44, 48, t); lamps = .1 + .9 * (Math.sin(t * 17) > .1 ? 1 : 0) * (1 - smooth(44, 54, t)); amb = .5; redAmb = smooth(46, 52, t); }
    } else if (cause === 'meteor') {
      const a = clamp((t - 34) / 17, 0, 1), vis = t > 34 && t < 51.2;
      this.rock.visible = vis; this.tail.visible = vis;
      if (vis) {
        const from = new THREE.Vector3(1400, 380, -1700), to = new THREE.Vector3(26, 5, -6), p = from.clone().lerp(to, a * a * (3 - 2 * a) * .5 + a * .5);
        this.rock.position.copy(p); this.rock.rotation.set(t * .6, t * .4, 0); this.rock.scale.setScalar(.6 + 2.2 * a);
        const dir = p.clone().sub(from).normalize(), len = 360 * (.3 + a); this.tail.scale.set(18 * (.4 + a), len, 1);
        this.tail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate()); this.tail.position.copy(p); this.tail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        this.tail.position.copy(p).addScaledVector(dir, -len);
      }
      if (t >= 51 && !this._impactDone) { this._impactDone = true; this._impactAt = t; }
      if (this._impactDone) { const s = t - this._impactAt; o.flash = Math.max(0, 1 - s / .9); o.flashColor = '255,235,205'; o.impact = s < .1; o.noise = Math.max(0, 1 - s / 6) * .5;
        lamps = s < .4 ? 0 : (Math.sin(t * 9) > 0 ? .6 : .05); amb = .4; redAmb = 1; o.shake = Math.max(0, 1.6 - s * .6); }
    } else if (cause === 'pirates') {
      const a = smooth(30, 40, t);
      for (const r of this.raiders) {
        r.holder.visible = t > 29 && t < crash + 2;
        const sx = r.side, p = new THREE.Vector3(sx * (700 - 640 * a), 90 - 82 * a + r.side * 4 * a, -1000 + 980 * a + (r.side > 0 ? 12 : -12));
        r.holder.position.copy(p); r.holder.rotation.set(0, Math.PI * .5 * 0 + (sx > 0 ? -.08 : .08), sx * -.12 * (1 - a));
      }
      if (t > 49) {
        o.red = .35; redAmb = smooth(49, 56, t); amb = .6;
        for (const [i, b] of this.bolts.entries()) {
          const cycle = (t * 2.2 + i * .37) % 1.2, r = this.raiders[i % 2], vis = cycle < .35;
          b.mesh.visible = vis && t > 50;
          if (b.mesh.visible) { const from = r.holder.position.clone().add(new THREE.Vector3(0, 0, -16)), to = new THREE.Vector3((i % 3 - 1) * 4, 2 + (i % 2) * 3, -4), d = to.clone().sub(from), L = d.length(), f = cycle / .35;
            b.mesh.scale.set(.9, 26, 1); b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); b.mesh.position.copy(from).addScaledVector(d, L * f); }
        }
        const hit = Math.pow(Math.max(0, Math.sin(t * 13) * Math.sin(t * 5.3)), 3);
        o.flash = Math.max(o.flash, hit * .7); o.flashColor = '255,170,110'; lamps = Math.sin(t * 11) > .2 ? .7 : .1; o.shake = 1.0 * smooth(49, 56, t);
      } else for (const b of this.bolts) b.mesh.visible = false;
    } else if (cause === 'failure') {
      const a = smooth(30, 46, t);
      for (const s of this.smokeSprites) {
        const u = (s.phase + t * .35) % 1, x = 15 + 3 * u, z = -16 + u * 70, y = 2 + 5 * Math.sin(u * 3 + s.phase * 6);
        s.sp.position.set(x, y, z); s.sp.scale.setScalar(2 + 14 * u); s.sp.material.opacity = a * (1 - u) * .55;
      }
      if (t > 42) { const strobe = Math.sin(t * 8) > 0; lamps = strobe ? .9 : .15; redAmb = .6 * (strobe ? 1 : .3); o.red = .12; o.shake = .5 + smooth(42, 58, t); }
      o.flash = t > 44 ? Math.max(0, Math.pow(Math.max(0, Math.sin(t * 5.1) * Math.sin(t * 1.7)), 6)) * .5 : 0; o.flashColor = '255,160,70';
    } else if (cause === 'weather') {
      // the dust (or ice fog) rises near the ground: there is none at the edge of space (the flight is one continuous sky; it must not turn grey at 70 km)
      const lowK = 1 - (this.worldId === 'mars' ? smooth(8e3, 30e3, this.space.alt || 0) : smooth(1.5e5, 4e5, this.space.alt || 0));
      const fog = this.scene.fog; if (fog && fog.density !== undefined) fog.density = (this.space.fogBase || 0) + .0075 * smooth(26, 50, t) * lowK;
      this.streakPoints.material.opacity = smooth(28, 46, t) * .8 * lowK;
      const pos = this.streakPoints.geometry.attributes.position, seed = this.streakSeed;
      for (let i = 0; i < pos.count; i++) pos.setXYZ(i, eye.x + seed[i * 3], eye.y + seed[i * 3 + 1], eye.z + ((seed[i * 3 + 2] + t * (28 + (i % 7))) % 120) - 60);
      pos.needsUpdate = true; o.shake = .6 * smooth(30, 56, t); amb = 1 - .35 * smooth(40, 56, t); lamps = 1 - .3 * smooth(46, 58, t); o.noise = .1 * smooth(46, 58, t);
    }
    // the last seconds, every cause: the whole ship shakes harder, then the end
    o.shake += smooth(52, crash, t) * 1.4;
    st.lampScale = lamps; st.ambScale = amb;
    st.hemi.color.lerpColors(this._cool || (this._cool = new THREE.Color(0xb4c4d6)), this._hot || (this._hot = new THREE.Color(0xff3a2a)), clamp(redAmb, 0, 1));
    if (this.worldId !== 'ceres' && t > 50) o.plasma = smooth(50, crash, t) * .45; else o.plasma = 0;
    return o;
  }

  dispose() {
    this.root.traverse((m) => { if (m.isMesh || m.isPoints) { m.geometry?.dispose(); const ms = Array.isArray(m.material) ? m.material : [m.material]; for (const x of ms) if (x && !Object.values(this.mats).includes(x)) x.dispose?.(); } if (m.isSprite) m.material.dispose(); });
    for (const r of this.raiders || []) { r.decal?.map?.dispose(); r.decal?.dispose(); }
    this.root.removeFromParent();
  }
}
