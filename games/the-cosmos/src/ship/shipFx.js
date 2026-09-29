// ============================================================================
// shipFx.js — what the guns and engines leave in the world.
//
// OWNS: bolt meshes, muzzle flashes, impact bursts, scorch marks, the dust a
//       hovering ship blows across the ground, and the practice targets.
// DOES NOT OWN: where a bolt is or whether it hit (guns.js). This layer draws
//       the events that system emits.
//
// EVERYTHING HERE LIVES IN f64 WORLD METRES and is written to the GPU relative to
// the camera each frame (the floating origin), so a bolt 3 km from the camera
// and a spark at your boots are equally precise.
// ============================================================================

import * as THREE from 'three';
import { mulberry } from './shipTextures.js';

// ---------------------------------------------------------------------------
// A point-sprite particle pool with per-particle size, colour and alpha.
// ---------------------------------------------------------------------------
export class Particles {
  constructor(max = 600, opts = {}) {
    this.max = max;
    this.n = 0;
    this.wp = new Float64Array(max * 3);       // world position
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.size1 = new Float32Array(max);
    this.col0 = new Float32Array(max * 3);
    this.col1 = new Float32Array(max * 3);
    this.alpha0 = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);         // along local up (negative = falls), m/s^2
    this.up = new Float32Array(max * 3);
    this.head = 0;

    const geo = new THREE.BufferGeometry();
    this.aPos = new Float32Array(max * 3);
    this.aSize = new Float32Array(max);
    this.aCol = new Float32Array(max * 3);
    this.aAlpha = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(this.aPos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.aSize, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.aCol, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.aAlpha, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 600 } },
      vertexShader: `
        attribute float aSize; attribute vec3 aColor; attribute float aAlpha;
        varying vec3 vC; varying float vA; uniform float uScale;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(aSize * uScale / max(0.1, -mv.z), 0.0, 220.0);
          vC = aColor; vA = aAlpha;
        }`,
      fragmentShader: `
        varying vec3 vC; varying float vA;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c) * 2.0;
          float a = smoothstep(1.0, 0.0, d);
          a *= a;
          gl_FragColor = vec4(vC, a * vA);
          if (gl_FragColor.a < 0.004) discard;
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 8;
    this.geo = geo;
  }

  /** Emit one particle. p: {x,y,z,vx,vy,vz,life,size0,size1,c0:[r,g,b],c1,alpha,drag,grav,up} */
  emit(p) {
    const i = this.head; this.head = (this.head + 1) % this.max;
    this.n = Math.min(this.max, this.n + 1);
    this.wp[i * 3] = p.x; this.wp[i * 3 + 1] = p.y; this.wp[i * 3 + 2] = p.z;
    this.vel[i * 3] = p.vx || 0; this.vel[i * 3 + 1] = p.vy || 0; this.vel[i * 3 + 2] = p.vz || 0;
    this.life[i] = this.maxLife[i] = p.life;
    this.size0[i] = p.size0; this.size1[i] = p.size1 ?? p.size0;
    const c0 = p.c0 || [1, 1, 1], c1 = p.c1 || c0;
    this.col0.set(c0, i * 3); this.col1.set(c1, i * 3);
    this.alpha0[i] = p.alpha ?? 1;
    this.drag[i] = p.drag ?? 0;
    this.grav[i] = p.grav ?? 0;
    const up = p.up || { x: 0, y: 0, z: 0 };
    this.up[i * 3] = up.x; this.up[i * 3 + 1] = up.y; this.up[i * 3 + 2] = up.z;
  }

  update(dt, cam) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.aAlpha[i] = 0; this.aSize[i] = 0; continue; }
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.aAlpha[i] = 0; this.aSize[i] = 0; continue; }
      const k = 1 - this.life[i] / this.maxLife[i];
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] = this.vel[i * 3] * dr + this.up[i * 3] * this.grav[i] * dt;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr + this.up[i * 3 + 1] * this.grav[i] * dt;
      this.vel[i * 3 + 2] = this.vel[i * 3 + 2] * dr + this.up[i * 3 + 2] * this.grav[i] * dt;
      this.wp[i * 3] += this.vel[i * 3] * dt; this.wp[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.wp[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.aPos[i * 3] = this.wp[i * 3] - cam.x; this.aPos[i * 3 + 1] = this.wp[i * 3 + 1] - cam.y; this.aPos[i * 3 + 2] = this.wp[i * 3 + 2] - cam.z;
      this.aSize[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * k;
      for (let c = 0; c < 3; c++) this.aCol[i * 3 + c] = this.col0[i * 3 + c] + (this.col1[i * 3 + c] - this.col0[i * 3 + c]) * k;
      // fade in fast, out slowly
      const fade = Math.min(1, k * 12) * (1 - k);
      this.aAlpha[i] = this.alpha0[i] * fade;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }

  setScale(v) { this.points.material.uniforms.uScale.value = v; }
}

// ---------------------------------------------------------------------------
// The whole layer
// ---------------------------------------------------------------------------
export class ShipFx {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.low = opts.tier === 'low';
    this.rnd = mulberry(1234);

    // bolts: one instanced capsule stretched along its velocity
    this.MAXB = 160;
    const geo = new THREE.CapsuleGeometry(0.06, 1.6, 3, 6);
    geo.rotateX(Math.PI / 2);                    // long axis along Z
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, vertexColors: false });
    this.bolts = new THREE.InstancedMesh(geo, mat, this.MAXB);
    this.bolts.frustumCulled = false;
    this.bolts.count = 0;
    this.bolts.setColorAt(0, new THREE.Color(1, 1, 1));
    scene.add(this.bolts);
    // a soft glow around each bolt as sprites
    this.glow = new Particles(this.MAXB * 4, { additive: true });
    scene.add(this.glow.points);

    this.dust = new Particles(this.low ? 260 : 520, { additive: false });
    scene.add(this.dust.points);
    this.sparks = new Particles(this.low ? 260 : 480, { additive: true });
    scene.add(this.sparks.points);

    // scorch marks: pooled discs laid on the ground
    this.scorches = [];
    const sg = new THREE.CircleGeometry(1, 18);
    const smat = new THREE.MeshBasicMaterial({ color: 0x120a06, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (let i = 0; i < 28; i++) {
      const m = new THREE.Mesh(sg, smat.clone());
      m.visible = false; m.frustumCulled = false; m.renderOrder = 3;
      scene.add(m);
      this.scorches.push({ mesh: m, pos: { x: 0, y: 0, z: 0 }, q: new THREE.Quaternion(), age: 99, r: 1 });
    }
    this._sc = 0;
    // muzzle flashes
    this.flashes = [];
    for (let i = 0; i < 6; i++) {
      this.flashes.push({ t: 0, x: 0, y: 0, z: 0 });
    }
    this._cam = { x: 0, y: 0, z: 0 };
    this._m4 = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3(1, 1, 1);
    this._p = new THREE.Vector3();
    this._z = new THREE.Vector3(0, 0, 1);
    this._v = new THREE.Vector3();
    this._col = new THREE.Color();
    this.targets = [];
  }

  /** Muzzle flash, impact, target events from the gun system. */
  handle(events, sun) {
    const rnd = this.rnd;
    for (const e of events) {
      if (e.type === 'muzzle') {
        const hot = e.gun === 'main' ? [1.0, 0.7, 0.3] : [0.5, 0.9, 1.0];
        for (let i = 0; i < 6; i++) {
          this.sparks.emit({ x: e.x + e.dx * 0.6, y: e.y + e.dy * 0.6, z: e.z + e.dz * 0.6,
            vx: e.dx * (25 + rnd() * 20) + (rnd() - 0.5) * 12, vy: e.dy * (25 + rnd() * 20) + (rnd() - 0.5) * 12, vz: e.dz * (25 + rnd() * 20) + (rnd() - 0.5) * 12,
            life: 0.16 + rnd() * 0.12, size0: 0.5, size1: 0.1, c0: hot, c1: [1, 0.3, 0.1], alpha: 1, drag: 4 });
        }
        this.sparks.emit({ x: e.x + e.dx * 0.9, y: e.y + e.dy * 0.9, z: e.z + e.dz * 0.9, life: 0.09, size0: 3.2, size1: 5.0, c0: hot, c1: hot, alpha: 0.9 });
      } else if (e.type === 'impact') {
        this._impact(e);
      } else if (e.type === 'target_hit') {
        for (let i = 0; i < 10; i++) this.sparks.emit({ x: e.x, y: e.y, z: e.z, vx: (rnd() - 0.5) * 22, vy: (rnd() - 0.5) * 22, vz: (rnd() - 0.5) * 22, life: 0.35, size0: 0.4, size1: 0.05, c0: [1, 0.9, 0.5], c1: [1, 0.3, 0.1], alpha: 1, drag: 2 });
      } else if (e.type === 'target_down') {
        for (let i = 0; i < 40; i++) this.sparks.emit({ x: e.x, y: e.y, z: e.z, vx: (rnd() - 0.5) * 30, vy: (rnd() - 0.5) * 30 + 6, vz: (rnd() - 0.5) * 30, life: 0.9, size0: 0.9, size1: 0.1, c0: [1, 0.8, 0.4], c1: [0.6, 0.15, 0.05], alpha: 1, drag: 1.2 });
      }
    }
  }

  _impact(e) {
    const rnd = this.rnd;
    const up = { x: e.ux, y: e.uy, z: e.uz };
    const power = e.power || 1;
    // dust puff
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2, sp = 3 + rnd() * 9;
      // tangent basis
      const t1 = Math.abs(up.y) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const bx = up.y * t1[2] - up.z * t1[1], by = up.z * t1[0] - up.x * t1[2], bz = up.x * t1[1] - up.y * t1[0];
      const bl = Math.hypot(bx, by, bz) || 1;
      const cx = up.y * bz / bl - up.z * by / bl, cy = up.z * bx / bl - up.x * bz / bl, cz = up.x * by / bl - up.y * bx / bl;
      const dx = (bx / bl) * Math.cos(a) + cx * Math.sin(a), dy = (by / bl) * Math.cos(a) + cy * Math.sin(a), dz = (bz / bl) * Math.cos(a) + cz * Math.sin(a);
      this.dust.emit({ x: e.x + up.x * 0.2, y: e.y + up.y * 0.2, z: e.z + up.z * 0.2,
        vx: dx * sp + up.x * (4 + rnd() * 6), vy: dy * sp + up.y * (4 + rnd() * 6), vz: dz * sp + up.z * (4 + rnd() * 6),
        life: 1.6 + rnd() * 1.4, size0: 1.2, size1: 5 + rnd() * 4, c0: [0.72, 0.5, 0.36], c1: [0.62, 0.42, 0.3], alpha: 0.5, drag: 1.6, grav: -3.7, up });
    }
    // sparks and a hot flash
    for (let i = 0; i < 16; i++) {
      this.sparks.emit({ x: e.x, y: e.y, z: e.z, vx: (rnd() - 0.5) * 26 + up.x * 12, vy: (rnd() - 0.5) * 26 + up.y * 12, vz: (rnd() - 0.5) * 26 + up.z * 12,
        life: 0.4 + rnd() * 0.4, size0: 0.35, size1: 0.05, c0: [1, 0.85, 0.5], c1: [1, 0.25, 0.08], alpha: 1, drag: 1.5, grav: -3.7, up });
    }
    this.sparks.emit({ x: e.x + up.x * 0.4, y: e.y + up.y * 0.4, z: e.z + up.z * 0.4, life: 0.16, size0: 4.5 * Math.min(1.6, power), size1: 7, c0: [1, 0.85, 0.55], c1: [1, 0.5, 0.2], alpha: 1 });
    // scorch
    const s = this.scorches[this._sc++ % this.scorches.length];
    s.pos = { x: e.x + up.x * 0.06, y: e.y + up.y * 0.06, z: e.z + up.z * 0.06 };
    this._q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(up.x, up.y, up.z));
    s.q.copy(this._q); s.age = 0; s.r = 0.7 + this.rnd() * 0.5;
    s.mesh.visible = true;
  }

  /** Called once per frame after the camera is placed. */
  update(dt, cam, bolts) {
    this._cam = cam;
    // bolts
    let n = 0;
    for (const b of bolts) {
      if (n >= this.MAXB) break;
      const sp = Math.hypot(b.vx, b.vy, b.vz) || 1;
      this._v.set(b.vx / sp, b.vy / sp, b.vz / sp);
      this._q.setFromUnitVectors(this._z, this._v);
      const len = 5 + 3 * Math.min(1.5, b.power);
      this._s.set(1 + 0.4 * b.power, 1 + 0.4 * b.power, len / 1.6);
      this._p.set(b.x - cam.x, b.y - cam.y, b.z - cam.z);
      this._m4.compose(this._p, this._q, this._s);
      this.bolts.setMatrixAt(n, this._m4);
      const hot = b.gun === 'main' ? this._col.setRGB(3.0, 1.5, 0.5) : this._col.setRGB(0.6, 2.2, 3.0);
      this.bolts.setColorAt(n, hot);
      // glow sprite
      this.glow.emit({ x: b.x, y: b.y, z: b.z, life: 0.05, size0: 2.6, size1: 2.6, c0: b.gun === 'main' ? [1, 0.6, 0.2] : [0.3, 0.8, 1], alpha: 0.7 });
      n++;
    }
    this.bolts.count = n;
    this.bolts.instanceMatrix.needsUpdate = true;
    if (this.bolts.instanceColor) this.bolts.instanceColor.needsUpdate = true;
    this.glow.update(dt, cam); this.dust.update(dt, cam); this.sparks.update(dt, cam);
    // scorches
    for (const s of this.scorches) {
      if (!s.mesh.visible) continue;
      s.age += dt;
      if (s.age > 40) { s.mesh.visible = false; continue; }
      s.mesh.position.set(s.pos.x - cam.x, s.pos.y - cam.y, s.pos.z - cam.z);
      s.mesh.quaternion.copy(s.q);
      s.mesh.scale.setScalar(s.r * (1 + Math.min(1, s.age) * 0.4));
      s.mesh.material.opacity = 0.55 * (1 - Math.max(0, (s.age - 20) / 20));
    }
  }

  setViewScale(h, fovDeg) {
    const scale = h / (2 * Math.tan((fovDeg * Math.PI) / 360));
    for (const p of [this.glow, this.dust, this.sparks]) p.setScale(scale);
  }
}

// ---------------------------------------------------------------------------
// Practice targets: a post and a disc, on the actual ground.
// ---------------------------------------------------------------------------
export function buildTargetMesh() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.0, 8), new THREE.MeshStandardMaterial({ color: 0x555b60, roughness: 0.5, metalness: 0.8 }));
  post.position.y = 1.5;
  g.add(post);
  let map = null;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    for (let i = 0; i < 5; i++) { x.fillStyle = i % 2 ? '#f2f0ea' : '#c8371f'; x.beginPath(); x.arc(128, 128, 126 - i * 24, 0, 6.3); x.fill(); }
    x.fillStyle = '#c8371f'; x.beginPath(); x.arc(128, 128, 8, 0, 6.3); x.fill();
    map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  }
  const discMat = new THREE.MeshStandardMaterial({ map, color: map ? 0xffffff : 0xc8371f, roughness: 0.6, metalness: 0.2, emissive: 0x000000 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.12, 32), discMat);
  disc.rotation.x = Math.PI / 2;
  disc.position.y = 3.2;
  g.add(disc);
  g.userData.disc = disc;
  g.userData.discMat = discMat;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
