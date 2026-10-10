// The opening's look at the wreck (OPENING2: stages 3 to 6): dusk sky and haze (or Ceres's black sky), the crash site, smoke and sparks, light through the torn hull, the lit
// path to the port, and a film vignette. The world and the season's crash cause change the sky, the fog and what happens overhead. Art only: it reads the opening's stage but never changes its rules,
// input, saves or vehicles. opening.js builds one of these and calls frame() once at the end of every frame.
import * as THREE from 'three';
import { Kit3, rng, noise, sstep, clamp, lerp } from './wreckKit.js';
import { Plumes, Sparks, Halos } from './wreckFx.js';
import { buildSite } from './wreckSite.js';

// Where the low sun sits (ground frame): out toward the port (-x), a little behind the player's side. The wreck's long
// shadow falls to the right of the hull, so the dig site, the door and the walk to the rover stay lit, the hull is
// rim-lit from its low side, and the ride to the port runs straight into the sunset.
export const SUN = new THREE.Vector3(-100, 19, 16);
const SUN_DIR = SUN.clone().normalize();

export function skyDome(low, sunDir, air = 1, earth = 0) {
  const uniforms = { sunDir: { value: sunDir.clone() }, time: { value: 0 }, flash: { value: 0 }, storm: { value: .3 }, air: { value: air }, earth: { value: earth } };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform vec3 sunDir;uniform float time;uniform float flash;uniform float storm;uniform float air;uniform float earth;varying vec3 vDir;
      #include <logdepthbuf_pars_fragment>
      float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
      void main(){
      #include <logdepthbuf_fragment>
      vec3 d=normalize(vDir);float h=d.y;float sd=max(dot(d,sunDir),0.);
      vec3 zen=vec3(.035,.05,.14),mid=vec3(.27,.17,.29),hor=vec3(.9,.46,.27),far=vec3(.42,.2,.2);
      float hz=smoothstep(-.02,.16,h);
      vec3 col=mix(mix(far,hor,pow(sd,.5)*.9+.1),mid,hz);
      col=mix(col,mix(mid,zen,smoothstep(.1,.85,h)),smoothstep(.12,.6,h));
      // dust bands lying on the horizon
      float band=vn(vec2(atan(d.x,d.z)*5.,h*40.+time*.01))*.5+vn(vec2(atan(d.x,d.z)*13.,h*90.))*.5;
      col+=vec3(.16,.07,.05)*band*(1.-smoothstep(0.,.22,h))*(.4+sd);
      // Mars at sunset: a cold blue halo around a small bright sun, warm glow outside it
      col+=vec3(.55,.68,1.)*pow(sd,320.)*1.1+vec3(.8,.62,.5)*pow(sd,26.)*.22+vec3(1.,.5,.22)*pow(sd,5.)*.4;
      col+=vec3(2.,2.2,2.6)*smoothstep(.99985,.99993,sd);
      // stars come out overhead, brighter when the storm is up
      vec2 g=vec2(atan(d.x,d.z)*520.,h*520.);vec2 sp=floor(g);float s=h21(sp);float sdot=smoothstep(.34,.0,length(fract(g)-.5));
      col+=vec3(.9,.95,1.)*step(.9975,s)*sdot*smoothstep(.18,.5,h)*(.5+storm*1.0)*(.55+.45*sin(time*2.+s*50.));
      col+=vec3(.55,.6,.9)*flash*(.6+.4*h);
      col=mix(col,vec3(.1,.06,.06),smoothstep(0.,-.12,h));
      // an airless world (Ceres): no dusk glow or dust, a black sky with many more stars, and a small hard Sun
      vec3 sp2=vec3(2.,2.2,2.6)*smoothstep(.99985,.99993,sd);
      vec2 g2=vec2(atan(d.x,d.z)*820.,h*820.);vec2 q2=floor(g2);float s2=h21(q2);float dot2=smoothstep(.36,.0,length(fract(g2)-.5));
      vec3 black=vec3(.004,.004,.006)+vec3(.9,.95,1.)*step(.992,s2)*dot2*smoothstep(-.05,.12,h)*(.6+.4*sin(time*1.3+s2*70.))+sp2;
      // Earth: a clear blue evening, warm along the horizon under a low Sun, thunderheads in the storm (not Mars's rust and dust)
      vec3 eh=mix(vec3(.55,.62,.78),vec3(1.,.66,.42),pow(sd,.6)),ez=vec3(.1,.22,.52),em=vec3(.36,.5,.76);
      vec3 ecol=mix(eh,mix(em,ez,smoothstep(.1,.85,h)),smoothstep(.02,.45,h));
      ecol+=vec3(1.,.55,.28)*pow(sd,6.)*.5+vec3(1.,.85,.6)*pow(sd,60.)*.5+vec3(2.,2.,2.)*smoothstep(.99985,.99993,sd);
      float cl=vn(vec2(atan(d.x,d.z)*3.,h*7.+time*.004))*.6+vn(vec2(atan(d.x,d.z)*9.,h*18.))*.4;
      ecol=mix(ecol,vec3(.62,.6,.66)*(.55+.5*sd),smoothstep(.5,.8,cl)*smoothstep(.04,.3,h)*(.35+storm*.35));
      ecol+=vec3(.55,.6,.9)*flash*(.6+.4*h);
      ecol=mix(ecol,vec3(.16,.2,.15),smoothstep(0.,-.12,h));
      col=mix(col,ecol,earth);
      col=mix(black,col,air);
      gl_FragColor=vec4(col,1.);}`,
  });
  const g = new THREE.SphereGeometry(20000, low ? 24 : 40, low ? 12 : 20);
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = -10; mesh.name = 'opening-sky';
  return { mesh, uniforms, dispose() { g.dispose(); mat.dispose(); } };
}

// Shafts of low sun coming in through the left-hand windows and across the cabin. Cabin-local; additive; a few crossed
// ribbons each so they have body. The sun is at -x, so the light travels +x, a little down and a little toward the stern.
function shafts(low, zs) {
  const d = new THREE.Vector3(.97, -.17, -.16).normalize(), up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3().crossVectors(d, up).normalize(), top = new THREE.Vector3().crossVectors(side, d).normalize();
  const pos = [], uv = [], idx = [];
  const quad = (o, a, w, L) => { const base = pos.length / 3;
    for (let i = 0; i <= 6; i++) { const k = i / 6, c = o.clone().addScaledVector(d, k * L), sp = 1 + k * .5;
      for (const e of [-1, 1]) { const p = c.clone().addScaledVector(a, e * w * sp); pos.push(p.x, p.y, p.z); uv.push(k, e * .5 + .5); } }
    for (let i = 0; i < 6; i++) { const n = base + i * 2; idx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); } };
  for (const z of zs) { const o = new THREE.Vector3(-3.05, 1.7, z); quad(o, top, .75, 6.4); quad(o, side, .55, 6.4); if (!low) quad(o.clone().add(new THREE.Vector3(0, .1, 0)), side.clone().addScaledVector(top, .8).normalize(), .6, 6.4); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const uniforms = { time: { value: 0 }, power: { value: 1 } };
  const m = new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `varying vec2 v;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform float time;uniform float power;varying vec2 v;
      #include <logdepthbuf_pars_fragment>
      void main(){
      #include <logdepthbuf_fragment>
      float edge=sin(clamp(v.y,0.,1.)*3.14159);float along=smoothstep(0.,.06,v.x)*(1.-smoothstep(.55,1.,v.x));
      float dust=.65+.35*sin(v.x*17.+time*.4+v.y*9.)*sin(v.x*5.-time*.23);
      gl_FragColor=vec4(vec3(1.,.55,.26)*edge*edge*along*dust*.1*power,1.);}`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.name = 'window-light-shafts';
  return { mesh, uniforms, dispose() { g.dispose(); m.dispose(); } };
}

// A long thin additive streak (a meteor, a bolt): a quad stretched along its direction, bright at the head.
function streak(low) {
  const g = new THREE.PlaneGeometry(1, 1, 1, 1); g.translate(0, .5, 0);
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false,
    uniforms: { k: { value: 1 } },
    vertexShader: `varying vec2 v;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform float k;varying vec2 v;
      #include <logdepthbuf_pars_fragment>
      void main(){
      #include <logdepthbuf_fragment>
      float across=1.-abs(v.x-.5)*2.;float along=pow(v.y,3.);gl_FragColor=vec4(vec3(1.,.8,.55)*across*across*along*k,1.);}` });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 4; return { mesh, mat: m, geo: g };
}

export class OpeningLook {
  /** o: the opening. o.worldId and o.cause pick the sky and what happens overhead. */
  constructor(o) {
    this.o = o; this.low = o.low; const low = this.low, scene = o.scene, root = o.root;
    this.world = o.worldId || 'mars'; this.cause = o.cause || 'storm'; this.air = (this.world === 'ceres' || this.world === 'callisto') ? 0 : 1; this.earthy = this.world === 'earth' ? 1 : 0;
    this.scaleRef = { value: 600 }; this.t = 0; this.rnd = rng(31);
    // sky, haze
    this.sky = skyDome(low, SUN_DIR, this.air, this.earthy); root.add(this.sky.mesh);
    scene.fog = this.air ? new THREE.FogExp2(this.earthy ? 0x8d97ad : 0x84524a, this.cause === 'weather' ? .0032 : .00021) : new THREE.FogExp2(0x1a1a1e, .00002);
    scene.background = new THREE.Color(this.earthy ? 0x1a2236 : this.air ? 0x2a1a22 : 0x050507);
    // the crash site on the ground
    this.site = buildSite({ ext: o.ship.matsExt, mats: o.ship.matsInt, h: (x, z) => o.model.height(x, z), low, scaleRef: this.scaleRef });
    root.add(this.site.group);
    // smoke and sparks. Cabin-local ones ride the tilted hull.
    const cabinRoot = o.cabin.root, wind = [1.1, 0, .35], calm = this.cause === 'failure' ? .5 : 1;
    this.smoke = new Plumes(cabinRoot, [
      { p: [-.5, 2.1, -13.8], count: 56, size: 3.2, rise: 2.4, life: 10, alpha: .26 * calm, spread: 2.2, color: [.13, .12, .12], lit: .14, windK: 1.5 },
      { p: [-1.8, 3.4, -6.6], count: 24, size: 1.9, rise: 1.9, life: 8, alpha: .3 * calm, spread: 2.2, color: [.15, .14, .14], lit: .08, windK: 1.4 },
      { p: [-.6, 1.6, -11.0], count: 12, size: 2.2, rise: .15, life: 9, alpha: .05, spread: 3.2, color: [.5, .4, .34], windK: 0 },
      { p: [.9, 3.45, -2.4], count: 10, size: 1.2, rise: 1.6, life: 6, alpha: .22 * calm, spread: .6, color: [.2, .19, .19], windK: 1.4 },
    ], { low, seed: 11, wind, scaleRef: this.scaleRef });
    this.sitePlumes = new Plumes(this.site.group, this.site.emitters, { low, seed: 5, wind: [1.5, 0, .5], scaleRef: this.scaleRef });
    this.sparkLight = low ? null : new THREE.PointLight(0xffa24a, 0, 9, 1.8); if (this.sparkLight) cabinRoot.add(this.sparkLight);
    this.sparks = new Sparks(cabinRoot, o.cabin.fx.sparks, { low, light: this.sparkLight, scaleRef: this.scaleRef });
    // light through the torn stern
    this.shaft = shafts(low, low ? [-7.4, -2.2, 3] : [-10, -7.4, -4.8, -2.2, .4, 3, 5.6]); cabinRoot.add(this.shaft.mesh);
    this.beam = null; if (!low) { this.beam = new THREE.SpotLight(0xff9d5a, 0, 26, .5, .85, 1.3); this.beam.position.set(-3.3, 1.9, 1.5); this.beam.target.position.set(2.6, .1, -.5); cabinRoot.add(this.beam, this.beam.target); }
    // overhead: meteors streak across the sky (a meteor season), the Corsairs' lights circle (a pirate season)
    this.streaks = []; this.circlers = [];
    if (this.cause === 'meteor') for (let i = 0; i < (low ? 3 : 5); i++) { const s = streak(low); s.mesh.visible = false; root.add(s.mesh); this.streaks.push({ ...s, t0: i * 3.1, period: 7 + i }); }
    if (this.cause === 'pirates') {
      const mk = (c) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false })); sp.scale.setScalar(40); sp.renderOrder = 4; root.add(sp); return sp; };
      for (let i = 0; i < 2; i++) this.circlers.push({ a: mk(0xff3a2a), b: mk(0x3aff7a), phase: i * 3.1, r: 1500 + i * 500 });
    }
    // the lit way to the port: pylons with a chasing pulse, and the port's own lights (unfogged, with halos)
    this.buildPath();
    this.vignette = document.createElement('div'); this.vignette.id = 'opening-vignette';
    this.vignette.style.cssText = 'position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 46%,rgba(0,0,0,0) 52%,rgba(8,4,6,.34) 82%,rgba(8,4,6,.62) 100%)';
    o.ui.prepend(this.vignette);
    this.sunSet = false; o.lamp.position.set(0, 2.7, 9);
  }
  buildPath() {
    const o = this.o, h = (x, z) => o.model.height(x, z), pk = new Kit3(this.low), pts = [], P0 = [-7, 23], P1 = [-2600, -350];
    const N = 17, ext = o.ship.matsExt, emit = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); this.emit = emit;
    const amber = !this.air ? [1, .5, .12] : [1, .6, .22];
    for (let i = 1; i <= N; i++) {
      const t = i / (N + .5) * (i < 6 ? .9 : 1), x = lerp(P0[0], P1[0], t * .985) + 0, z = lerp(P0[1], P1[1], t * .985), nz = -(P1[0] - P0[0]), nx = (P1[1] - P0[1]), l = Math.hypot(nx, nz), off = 7;
      const px = x + nx / l * off, pz = z + nz / l * off, y = h(px, pz), dist = Math.hypot(px - 0, pz - 0);
      pk.push(px, y, pz, 0); pk.cyl('steelDark', 0, .85, 0, .05, 1.7, 8); pk.cyl('steel', 0, .35, 0, .09, .05, 8); pk.box('emerg', 0, 1.74, 0, .16, .12, .16, { col: [1.6, .75, .2] }); pk.pop();
      pts.push({ p: [px, y + 1.76, pz], size: 1.4 + dist * .009, color: amber, rate: 2.4, phase: i * .55, alpha: .9 });
    }
    this.pylons = pk.toGroup({ ...ext, emerg: emit }, { name: 'opening-pylons' }); o.root.add(this.pylons);
    // the port's own rows of lights (replaces the old unfogged boxes)
    const port = [];
    for (let i = 0; i < 16; i++) port.push({ p: [-2600 + (i - 8) * 9, 3.3, -350], size: this.world === 'ceres' ? 16 : 12, color: amber, alpha: .85 });
    this.halos = new Halos(o.root, [...pts, ...port], { scaleRef: this.scaleRef });
  }
  // Called at the end of every opening frame (after the camera is placed). s = the opening's state (stage 3 wreck, 4 dig, 5 contact, 6 travel).
  frame(dt, s, t) {
    const o = this.o, e = o.engine, stage = s.stage - 2;       // the old scenes: 1 the wreck, 2 the dig, 3 the driver, 4 the way to the port
    this.t = t;
    const r = e.renderer, hpx = r.domElement.height || 720; this.scaleRef.value = hpx / (2 * Math.tan(e.camera.fov * Math.PI / 360));
    o.cabin.fx.show(1);
    o.cabin.fx.update(t, dt, 1, false);
    this.sky.uniforms.time.value = t;
    const stormy = this.cause === 'storm', calm = this.cause === 'failure';
    this.sky.uniforms.storm.value = (stormy ? 1 : calm ? .35 : .85) * (this.air ? 1 : .6);
    let flash = 0;
    if (this.air) flash = Math.pow(Math.max(0, Math.sin(t * .83) * Math.sin(t * 1.9) - (stormy ? .55 : .8)), 2) * (stormy ? 4.5 : 3);
    else if (stormy) flash = Math.pow(Math.max(0, Math.sin(t * .9) * Math.sin(t * 2.3) - .6), 2) * 1.6;      // a solar storm on an airless world: the whole sky pulses faintly
    this.sky.uniforms.flash.value = flash;
    // lights
    const outside = stage >= 2, ceres = !this.air;
    const earthy = !!this.earthy;
    if (stage === 1) { o.sun.color.set(ceres ? 0xfff2e0 : 0xffa464); o.sun.intensity = ceres ? 1.1 : .45; o.hemi.intensity = ceres ? .22 : .42; o.hemi.color.set(ceres ? 0x8aa0c0 : 0x9aa6d4); o.hemi.groundColor.set(ceres ? 0x606060 : 0x4a2a22); }
    else { o.sun.color.set(ceres ? 0xfff6e8 : 0xffa464); o.sun.intensity = ceres ? 3.4 : 2.5; o.hemi.color.set(ceres ? 0x93a4c6 : 0xa49cc0); o.hemi.groundColor.set(ceres ? 0x77736d : 0x8a4a34); o.hemi.intensity = ceres ? .5 : .85; }
    if (earthy) { o.sun.color.set(0xffc58a); if (stage > 1) o.sun.intensity = 3.4; o.hemi.color.set(0xb4c6f0); o.hemi.groundColor.set(stage === 1 ? 0x4a5638 : 0x7a8a58); if (stage > 1) o.hemi.intensity = 1.3; }      // Earth: a warm low Sun, a blue sky, green ground
    o.hemi.intensity += flash * .12;
    if (!this.sunSet) { this.sunSet = true; o.sun.position.copy(SUN).applyQuaternion(o.q); }
    if (stage === 1) { o.lamp.color.set(0xff4a2c); o.lamp.intensity = (this.low ? 7 : 10) + Math.sin(t * 6) * 3; o.cabinFill.color.set(0xb6c4e8); o.cabinFill.intensity = this.low ? 6 : 8; }
    // light through the windows, plus sparks and smoke, only in the wreck
    this.shaft.mesh.visible = true; this.shaft.uniforms.time.value = t; this.shaft.uniforms.power.value = ceres ? .5 : 1;
    if (this.beam) this.beam.intensity = 30 + 5 * Math.sin(t * .7);
    this.smoke.points.visible = true; this.sitePlumes.points.visible = true;
    this.smoke.update(dt, t); this.sitePlumes.update(dt, t);
    this.sparks.points.visible = true; this.sparks.update(dt, t, true);
    this.site.group.visible = true; this.site.update(t);
    // overhead
    for (const m of this.streaks) {
      const k = ((t - m.t0) % m.period) / 2.2;      // each streak crosses in 2.2 s, then waits
      m.mesh.visible = k >= 0 && k < 1;
      if (m.mesh.visible) { const ang = m.t0 * 1.7, sx = Math.cos(ang) * 4000, sz = Math.sin(ang) * 4000, ex = -sx * .6, ez = -sz * .6; const x = sx + (ex - sx) * k, z = sz + (ez - sz) * k, y = 2600 - 1500 * k;
        const dir = new THREE.Vector3(ex - sx, -1500, ez - sz).normalize();
        m.mesh.scale.set(14, 380, 1); m.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); m.mesh.position.set(x - dir.x * 380, y - dir.y * 380, z - dir.z * 380); m.mat.uniforms.k.value = Math.sin(k * Math.PI) * 1.8; }
    }
    for (const c of this.circlers) {
      const a = t * .045 + c.phase;
      c.a.position.set(Math.cos(a) * c.r, 700 + 100 * Math.sin(t * .3 + c.phase), Math.sin(a) * c.r);
      c.b.position.set(c.a.position.x + 14, c.a.position.y + 4, c.a.position.z);
      c.a.material.opacity = Math.sin(t * 3 + c.phase) > .2 ? 1 : .1; c.b.material.opacity = Math.sin(t * 3 + c.phase + 1.6) > .2 ? 1 : .1;
    }
    // the port and its way
    this.halos.update(t); this.halos.points.visible = stage >= 2;
    this.pylons.visible = stage >= 2;
    this.emit.color.setScalar(.8 + .2 * Math.sin(t * 2.4));
    // supply crate beacon (a small LED that blinks, so the buried crate can be found at dusk)
    const led = o.crate?.userData.led; if (led) { const v = Math.sin(t * 3.2) > .45 ? 1.4 : .1; led.color.setRGB(.25 * v, v, .5 * v); }
    void outside;
  }
  dispose() {
    this.vignette?.remove(); this.sky.dispose(); this.shaft.dispose(); this.smoke.dispose(); this.sitePlumes.dispose(); this.sparks.dispose(); this.halos.dispose(); this.site.dispose?.();
    this.emit.dispose(); this.pylons.traverse(o => o.geometry?.dispose());
    for (const m of this.streaks) { m.geo.dispose(); m.mat.dispose(); }
    for (const c of this.circlers) { c.a.material.dispose(); c.b.material.dispose(); }
    this.site.group.traverse(o => { o.geometry?.dispose(); });
  }
}
