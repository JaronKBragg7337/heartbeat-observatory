// Particles for the wreck: smoke and dust puffs (soft, sized per particle) and sparks. One draw call each,
// updated on the CPU (a hundred or two particles), so they are safe on a phone. Art only.
import * as THREE from 'three';
import { rng } from './wreckKit.js';

let puffTex = null;
function softTexture() {
  if (puffTex || typeof document === 'undefined') return puffTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.55)'); gr.addColorStop(.7, 'rgba(255,255,255,.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  // a little turbulence so a puff is not a perfect disc
  const id = g.getImageData(0, 0, 64, 64), r = rng(5);
  for (let i = 0; i < id.data.length; i += 4) id.data[i + 3] *= .75 + .5 * r();
  g.putImageData(id, 0, 0);
  puffTex = new THREE.CanvasTexture(c); return puffTex;
}

function puffMaterial(additive, scaleRef) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: softTexture() }, scale: scaleRef, tint: { value: new THREE.Color(1, 1, 1) } },
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false,
    vertexShader: `attribute float size;attribute float alpha;attribute vec3 tone;uniform float scale;varying float vA;varying vec3 vT;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vA=alpha;vT=tone;gl_Position=projectionMatrix*mv;gl_PointSize=min(512.,size*scale/max(.3,-mv.z));
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform sampler2D map;uniform vec3 tint;varying float vA;varying vec3 vT;
      #include <logdepthbuf_pars_fragment>
      void main(){
      #include <logdepthbuf_fragment>
      vec4 t=texture2D(map,gl_PointCoord);gl_FragColor=vec4(vT*tint,t.a*vA);if(gl_FragColor.a<.004)discard;}`,
  });
}

/** Rising, drifting puffs from a list of emitters ({p:[x,y,z], rate, size, rise, color, life}) in the parent's frame. */
export class Plumes {
  constructor(parent, emitters, { low = false, seed = 3, wind = [1.1, 0, .3], additive = false, scaleRef } = {}) {
    this.rnd = rng(seed); this.emitters = emitters; this.wind = wind; this.low = low;
    this.n = emitters.reduce((s, e) => s + Math.ceil((e.count || 24) * (low ? .55 : 1)), 0);
    const n = this.n;
    this.pos = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n); this.tone = new Float32Array(n * 3);
    this.jit = new Float32Array(n).map(() => .55 + .9 * this.rnd()); this.age = new Float32Array(n); this.life = new Float32Array(n); this.owner = new Uint16Array(n); this.vel = new Float32Array(n * 3);
    let i = 0;
    emitters.forEach((e, ei) => { const c = Math.ceil((e.count || 24) * (low ? .55 : 1)); for (let j = 0; j < c; j++, i++) { this.owner[i] = ei; this.life[i] = (e.life || 8) * (.7 + .6 * this.rnd()); this.age[i] = this.rnd() * this.life[i]; this.spawn(i, true); } });
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1)); g.setAttribute('tone', new THREE.BufferAttribute(this.tone, 3));
    this.mat = puffMaterial(additive, scaleRef || { value: 1000 });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 4; parent.add(this.points);
  }
  spawn(i, first) {
    const e = this.emitters[this.owner[i]], r = this.rnd, s = e.spread ?? .5;
    this.pos[i * 3] = e.p[0] + (r() - .5) * s; this.pos[i * 3 + 1] = e.p[1] + (r() - .5) * s * .3; this.pos[i * 3 + 2] = e.p[2] + (r() - .5) * s;
    this.vel[i * 3] = (r() - .5) * .3 + (e.vx || 0); this.vel[i * 3 + 1] = (e.rise ?? 1.2) * (.7 + .6 * r()); this.vel[i * 3 + 2] = (r() - .5) * .3 + (e.vz || 0);
    if (!first) this.age[i] = 0;
  }
  update(dt, t) {
    dt = Math.min(dt, .1); const w = this.wind;
    for (let i = 0; i < this.n; i++) {
      const e = this.emitters[this.owner[i]]; this.age[i] += dt;
      if (this.age[i] > this.life[i]) { this.spawn(i); this.life[i] = (e.life || 8) * (.7 + .6 * this.rnd()); }
      const k = this.age[i] / this.life[i], i3 = i * 3, gust = Math.sin(t * .4 + i) * .15;
      this.pos[i3] += (this.vel[i3] + w[0] * k * (e.windK ?? 1) + gust) * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * (1 - k * .55) * dt; this.pos[i3 + 2] += (this.vel[i3 + 2] + w[2] * k * (e.windK ?? 1)) * dt;
      this.size[i] = (e.size || 1) * (.5 + 2.4 * k); this.alpha[i] = (e.alpha ?? .35) * this.jit[i] * Math.sin(Math.PI * Math.min(1, k * 1.15)) * (1 - k * .3);
      const c = e.color || [.2, .19, .19], l = e.lit ?? 0; this.tone[i3] = c[0] + l * k; this.tone[i3 + 1] = c[1] + l * k * .9; this.tone[i3 + 2] = c[2] + l * k * .8;
    }
    const a = this.geo.attributes; a.position.needsUpdate = a.size.needsUpdate = a.alpha.needsUpdate = a.tone.needsUpdate = true;
  }
  dispose() { this.geo.dispose(); this.mat.dispose(); }
}

/** Short bursts of sparks from fixed points; a point light (optional) flashes with each burst. */
export class Sparks {
  constructor(parent, points, { low = false, light = null, scaleRef } = {}) {
    this.pts = points; this.rnd = rng(77); this.light = light; this.t = 0;
    const per = low ? 10 : 22; this.per = per; this.n = points.length * per;
    this.pos = new Float32Array(this.n * 3); this.vel = new Float32Array(this.n * 3); this.size = new Float32Array(this.n); this.alpha = new Float32Array(this.n); this.tone = new Float32Array(this.n * 3);
    this.age = new Float32Array(this.n).fill(9); this.next = points.map((_, i) => 1 + i * .9 + this.rnd() * 2); this.flash = 0;
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1)); g.setAttribute('tone', new THREE.BufferAttribute(this.tone, 3));
    this.mat = puffMaterial(true, scaleRef || { value: 1000 });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 5; parent.add(this.points);
  }
  update(dt, t, active = true) {
    dt = Math.min(dt, .1); this.t = t; const r = this.rnd; this.flash = Math.max(0, this.flash - dt * 6);
    this.pts.forEach((p, pi) => {
      if (active && t > this.next[pi]) { this.next[pi] = t + .6 + r() * 3.2; this.flash = 1; this.flashAt = p;
        for (let j = 0; j < this.per; j++) { const i = pi * this.per + j; this.age[i] = 0; this.pos.set(p, i * 3);
          const a = r() * 6.283, v = .8 + r() * 2.2; this.vel[i * 3] = Math.cos(a) * v * .6; this.vel[i * 3 + 1] = 1 + r() * 1.6; this.vel[i * 3 + 2] = Math.sin(a) * v * .6; } }
    });
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt; const a = this.age[i], i3 = i * 3;
      if (a > .9) { this.alpha[i] = 0; continue; }
      this.vel[i3 + 1] -= 6 * dt; this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      this.size[i] = .045; this.alpha[i] = 1 - a / .9; this.tone[i3] = 2.2; this.tone[i3 + 1] = 1.3 - a; this.tone[i3 + 2] = .35;
    }
    const at = this.geo.attributes; at.position.needsUpdate = at.size.needsUpdate = at.alpha.needsUpdate = at.tone.needsUpdate = true;
    if (this.light && this.flashAt) { this.light.position.set(this.flashAt[0], this.flashAt[1], this.flashAt[2]); this.light.intensity = this.flash * (active ? 14 : 0); }
  }
  dispose() { this.geo.dispose(); this.mat.dispose(); }
}

/** Glowing beacon halos (additive), optionally pulsing in a chase. points: [{p,size,color,phase,rate}]. Unfogged: they are lights. */
export class Halos {
  constructor(parent, points, { scaleRef } = {}) {
    this.pts = points; const n = points.length;
    this.pos = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n); this.tone = new Float32Array(n * 3);
    points.forEach((p, i) => { this.pos.set(p.p, i * 3); });
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1)); g.setAttribute('tone', new THREE.BufferAttribute(this.tone, 3));
    this.mat = puffMaterial(true, scaleRef || { value: 1000 });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 6; parent.add(this.points);
    this.update(0);
  }
  update(t) {
    this.pts.forEach((p, i) => { const rate = p.rate ?? 0, ph = p.phase ?? 0, k = rate ? Math.pow(.5 + .5 * Math.sin(t * rate - ph), 3) : 1;
      this.size[i] = p.size * (.7 + .3 * k); this.alpha[i] = (p.alpha ?? 1) * (rate ? .15 + .85 * k : 1); const c = p.color || [1, .6, .25]; this.tone.set(c, i * 3); });
    const at = this.geo.attributes; at.size.needsUpdate = at.alpha.needsUpdate = at.tone.needsUpdate = true;
  }
  dispose() { this.geo.dispose(); this.mat.dispose(); }
}
