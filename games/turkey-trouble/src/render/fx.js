// Turkey Trouble: small effects (feathers, splashes, dust). Two pooled instanced meshes, updated on the CPU. Cheap on a phone.
import * as THREE from 'three';

function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function featherTexture() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 32, 128);
  g.beginPath(); g.moveTo(16, 126); g.bezierCurveTo(-2, 96, 0, 30, 16, 2); g.bezierCurveTo(32, 30, 34, 96, 16, 126); g.closePath();
  const grad = g.createLinearGradient(0, 128, 0, 0);
  grad.addColorStop(0, '#2a1c14'); grad.addColorStop(0.55, '#5a3a22'); grad.addColorStop(0.8, '#1a1210'); grad.addColorStop(0.93, '#8a5a2c'); grad.addColorStop(1, '#b08850');
  g.fillStyle = grad; g.fill();
  g.strokeStyle = 'rgba(200,170,120,0.7)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(16, 126); g.lineTo(16, 6); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

class Pool {
  constructor(mesh, n) {
    this.mesh = mesh; this.n = n; this.next = 0;
    this.p = Array.from({ length: n }, () => ({ life: 0, max: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), size: 0.1, grow: 0, gravity: 0, drag: 0, color: new THREE.Color(1, 1, 1), bill: true, floor: -1 }));
    mesh.count = n; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) { mesh.setMatrixAt(i, zero); mesh.setColorAt(i, new THREE.Color(1, 1, 1)); }
    this.live = 0;
  }
  spawn() { const q = this.p[this.next]; this.next = (this.next + 1) % this.n; return q; }
}

export function createFx(scene, camera) {
  const dot = dotTexture();
  const puffs = new Pool(new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 96), 96);
  const feathers = new Pool(new THREE.InstancedMesh(new THREE.PlaneGeometry(0.06, 0.24), new THREE.MeshBasicMaterial({ map: featherTexture(), alphaTest: 0.4, side: THREE.DoubleSide }), 64), 64);
  puffs.mesh.renderOrder = 5; puffs.mesh.name = 'fx_puffs'; feathers.mesh.name = 'fx_feathers';
  scene.add(puffs.mesh, feathers.mesh);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), c = new THREE.Color(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const rnd = (a, b) => a + Math.random() * (b - a);

  function step(pool, dt) {
    let live = 0;
    for (let i = 0; i < pool.n; i++) {
      const a = pool.p[i];
      if (a.life <= 0) { if (a.shown) { pool.mesh.setMatrixAt(i, zero); a.shown = false; pool.dirty = true; } continue; }
      a.life -= dt; live += 1;
      a.vel.y -= a.gravity * dt;
      const k = Math.max(0, 1 - a.drag * dt);
      a.vel.multiplyScalar(k);
      a.pos.addScaledVector(a.vel, dt);
      if (a.pos.y < a.floor) { a.pos.y = a.floor; a.vel.set(0, 0, 0); a.spin.set(0, 0, 0); }
      a.size += a.grow * dt;
      const t = Math.max(0, a.life / a.max);
      if (a.bill) q.copy(camera.quaternion);
      else { a.rot.x += a.spin.x * dt; a.rot.y += a.spin.y * dt; a.rot.z += a.spin.z * dt; q.setFromEuler(a.rot); }
      const fade = Math.min(1, t * 3);
      s.setScalar(a.bill ? a.size : a.size * Math.min(1, t * 6 + 0.001));
      m.compose(a.pos, q, s);
      pool.mesh.setMatrixAt(i, m);
      if (a.bill) { c.copy(a.color).multiplyScalar(fade); pool.mesh.setColorAt(i, c); }
      a.shown = true; pool.dirty = true;
    }
    if (pool.dirty) { pool.mesh.instanceMatrix.needsUpdate = true; if (pool.mesh.instanceColor) pool.mesh.instanceColor.needsUpdate = true; pool.dirty = false; }
    pool.mesh.visible = live > 0 || pool.wasLive;
    pool.wasLive = live > 0;
  }

  return {
    update(dt) { step(puffs, dt); step(feathers, dt); },
    // water thrown up where something fell in
    splash(x, z, y = -0.3) {
      for (let i = 0; i < 22; i++) {
        const a = puffs.spawn(), ang = Math.random() * Math.PI * 2, sp = rnd(0.6, 2.4);
        a.pos.set(x + Math.cos(ang) * 0.15, y + 0.05, z + Math.sin(ang) * 0.15); a.vel.set(Math.cos(ang) * sp, rnd(2.2, 5.2), Math.sin(ang) * sp);
        a.gravity = 9.8; a.drag = 0.4; a.size = rnd(0.05, 0.11); a.grow = 0; a.life = a.max = rnd(0.5, 0.9); a.color.setRGB(0.42, 0.5, 0.58); a.bill = true; a.floor = y - 0.2;
      }
      for (let i = 0; i < 3; i++) {
        const a = puffs.spawn();
        a.pos.set(x, y + 0.2, z); a.vel.set(rnd(-0.2, 0.2), rnd(0.3, 0.8), rnd(-0.2, 0.2)); a.gravity = 0; a.drag = 1.5; a.size = 0.5; a.grow = 2.2; a.life = a.max = 0.7; a.color.setRGB(0.10, 0.12, 0.14); a.bill = true; a.floor = -10;
      }
    },
    // a burst of loose feathers that drift down
    feathers(x, y, z, n = 8) {
      for (let i = 0; i < n; i++) {
        const a = feathers.spawn(), ang = Math.random() * Math.PI * 2, sp = rnd(0.8, 2.6);
        a.pos.set(x + rnd(-0.15, 0.15), y + rnd(-0.1, 0.25), z + rnd(-0.15, 0.15)); a.vel.set(Math.cos(ang) * sp, rnd(1.2, 3.4), Math.sin(ang) * sp);
        a.gravity = 2.6; a.drag = 1.9; a.size = rnd(0.8, 1.3); a.grow = 0; a.life = a.max = rnd(2.2, 3.6); a.bill = false; a.floor = 0.02;
        a.rot.set(rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)); a.spin.set(rnd(-5, 5), rnd(-3, 3), rnd(-5, 5));
      }
    },
    // dirt kicked up by feet, wheels, a dive
    dust(x, z, strength = 1) {
      for (let i = 0; i < 4; i++) {
        const a = puffs.spawn();
        a.pos.set(x + rnd(-0.2, 0.2), 0.12, z + rnd(-0.2, 0.2)); a.vel.set(rnd(-0.5, 0.5), rnd(0.25, 0.7), rnd(-0.5, 0.5)); a.gravity = 0; a.drag = 1.2;
        a.size = rnd(0.25, 0.4); a.grow = 0.9; a.life = a.max = rnd(0.7, 1.2); a.color.setRGB(0.05 * strength, 0.042 * strength, 0.034 * strength); a.bill = true; a.floor = -10;
      }
    },
  };
}

// faint pale streaks drifting on the creek, so it reads as moving water even when it mirrors a dark sky
export function streakTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 70; i++) {
    const y = Math.random() * 128, x = Math.random() * 512, len = 40 + Math.random() * 160, w = 0.6 + Math.random() * 1.8, a = 0.08 + Math.random() * 0.4;
    for (const off of [0, -512, 512]) {
      const grad = g.createLinearGradient(x + off, 0, x + off + len, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(0.5, `rgba(255,255,255,${a})`); grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(x + off, y, len, w);
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
