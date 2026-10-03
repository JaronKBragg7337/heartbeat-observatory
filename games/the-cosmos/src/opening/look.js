// The opening's look: dusk sky and haze, the crash site, smoke and sparks, light through the torn hull, the lit
// path to the port, and a film vignette. Art only: it reads the opening's stage but never changes its rules,
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

function skyDome(low, sunDir) {
  const uniforms = { sunDir: { value: sunDir.clone() }, time: { value: 0 }, flash: { value: 0 }, storm: { value: .3 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform vec3 sunDir;uniform float time;uniform float flash;uniform float storm;varying vec3 vDir;
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

export class OpeningLook {
  constructor(o) {
    this.o = o; this.low = o.low; const low = this.low, scene = o.scene, root = o.root;
    this.scaleRef = { value: 600 }; this.t = 0; this.rnd = rng(31);
    // sky, haze
    this.sky = skyDome(low, SUN_DIR); root.add(this.sky.mesh);
    scene.fog = new THREE.FogExp2(0x84524a, .00021);
    scene.background = new THREE.Color(0x2a1a22);
    // the crash site on the ground
    this.site = buildSite({ ext: o.ship.matsExt, mats: o.ship.matsInt, h: (x, z) => o.model.height(x, z), low, scaleRef: this.scaleRef });
    root.add(this.site.group);
    // smoke and sparks. Cabin-local ones ride the tilted hull.
    const cabinRoot = o.cabin.root, wind = [1.1, 0, .35];
    this.smoke = new Plumes(cabinRoot, [
      { p: [-.5, 2.1, -13.8], count: 56, size: 3.2, rise: 2.4, life: 10, alpha: .26, spread: 2.2, color: [.13, .12, .12], lit: .14, windK: 1.5 },
      { p: [-1.8, 3.4, -6.6], count: 24, size: 1.9, rise: 1.9, life: 8, alpha: .3, spread: 2.2, color: [.15, .14, .14], lit: .08, windK: 1.4 },
      { p: [-.6, 1.6, -11.0], count: 12, size: 2.2, rise: .15, life: 9, alpha: .05, spread: 3.2, color: [.5, .4, .34], windK: 0 },
      { p: [.9, 3.45, -2.4], count: 10, size: 1.2, rise: 1.6, life: 6, alpha: .22, spread: .6, color: [.2, .19, .19], windK: 1.4 },
    ], { low, seed: 11, wind, scaleRef: this.scaleRef });
    this.sitePlumes = new Plumes(this.site.group, this.site.emitters, { low, seed: 5, wind: [1.5, 0, .5], scaleRef: this.scaleRef });
    this.sparkLight = low ? null : new THREE.PointLight(0xffa24a, 0, 9, 1.8); if (this.sparkLight) cabinRoot.add(this.sparkLight);
    this.sparks = new Sparks(cabinRoot, o.cabin.fx.sparks, { low, light: this.sparkLight, scaleRef: this.scaleRef });
    this.sparks0 = new Sparks(cabinRoot, [[-1.35, 3.02, -1.6], [1.4, 3.02, 5.2], [-.2, 3.02, 9]], { low, scaleRef: this.scaleRef });
    // light through the torn stern
    this.shaft = shafts(low, low ? [-7.4, -2.2, 3] : [-10, -7.4, -4.8, -2.2, .4, 3, 5.6]); cabinRoot.add(this.shaft.mesh);
    this.beam = null; if (!low) { this.beam = new THREE.SpotLight(0xff9d5a, 0, 26, .5, .85, 1.3); this.beam.position.set(-3.3, 1.9, 1.5); this.beam.target.position.set(2.6, .1, -.5); cabinRoot.add(this.beam, this.beam.target); }
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
    for (let i = 1; i <= N; i++) {
      const t = i / (N + .5) * (i < 6 ? .9 : 1), x = lerp(P0[0], P1[0], t * .985) + 0, z = lerp(P0[1], P1[1], t * .985), nz = -(P1[0] - P0[0]), nx = (P1[1] - P0[1]), l = Math.hypot(nx, nz), off = 7;
      const px = x + nx / l * off, pz = z + nz / l * off, y = h(px, pz), dist = Math.hypot(px - 0, pz - 0);
      pk.push(px, y, pz, 0); pk.cyl('steelDark', 0, .85, 0, .05, 1.7, 8); pk.cyl('steel', 0, .35, 0, .09, .05, 8); pk.box('emerg', 0, 1.74, 0, .16, .12, .16, { col: [1.6, .75, .2] }); pk.pop();
      pts.push({ p: [px, y + 1.76, pz], size: 1.4 + dist * .009, color: [1, .6, .22], rate: 2.4, phase: i * .55, alpha: .9 });
    }
    this.pylons = pk.toGroup({ ...ext, emerg: emit }, { name: 'opening-pylons' }); o.root.add(this.pylons);
    // the port's own rows of lights (replaces the old unfogged boxes)
    const port = [];
    for (let i = 0; i < 16; i++) port.push({ p: [-2600 + (i - 8) * 9, 3.3, -350], size: 12, color: [1, .62, .26], alpha: .85 });
    this.halos = new Halos(o.root, [...pts, ...port], { scaleRef: this.scaleRef });
  }
  // Called at the end of every opening frame (after the camera is placed).
  frame(dt, s, t) {
    const o = this.o, e = o.engine, stage = s.stage; this.t = t;
    const r = e.renderer, hpx = r.domElement.height || 720; this.scaleRef.value = hpx / (2 * Math.tan(e.camera.fov * Math.PI / 360));
    const wreckSide = stage >= 1;
    o.cabin.fx.show(stage);
    const impact = stage === 0 && t > 41.5;
    o.cabin.fx.update(t, dt, stage, impact);
    this.sky.uniforms.time.value = t;
    // sky: the storm builds through the descent, then keeps a low simmer
    this.sky.uniforms.storm.value = stage === 0 ? clamp(t / 30, .2, 1) : .85;
    let flash = 0; if (stage === 0 && t > 23) flash = Math.pow(Math.max(0, Math.sin(t * 6.1) * Math.sin(t * 2.3 + 1) - .55), 2) * 3 * clamp((t - 23) / 10, 0, 1); else if (stage >= 1) flash = Math.pow(Math.max(0, Math.sin(t * .83) * Math.sin(t * 1.9) - .8), 2) * 3;
    this.sky.uniforms.flash.value = flash;
    // lights
    const outside = stage >= 2;
    if (stage === 0) { o.sun.intensity = .08; o.hemi.intensity = .22 + flash * .5; }
    else if (stage === 1) { o.sun.color.set(0xffa464); o.sun.intensity = .45; o.hemi.intensity = .42; o.hemi.color.set(0x9aa6d4); o.hemi.groundColor.set(0x4a2a22); }
    else { o.sun.color.set(0xffa464); o.sun.intensity = 2.5; o.hemi.color.set(0xa49cc0); o.hemi.groundColor.set(0x8a4a34); o.hemi.intensity = .85; }
    if (!this.sunSet) { this.sunSet = true; o.sun.position.copy(SUN).applyQuaternion(o.q); }
    if (stage === 1) { o.lamp.color.set(0xff4a2c); o.lamp.intensity = (this.low ? 7 : 10) + Math.sin(t * 6) * 3; o.cabinFill.color.set(0xb6c4e8); o.cabinFill.intensity = this.low ? 6 : 8; }
    if (stage === 0) { if (t > 23) o.lamp.color.set(0xff3d28); else { o.lamp.color.set(0xffe2c0); o.lamp.intensity = this.low ? 8 : 12; } }
    // the ceiling starts shedding dust as the storm shakes the ship
    if (stage === 0 && t > 30) { o.dust.visible = true; o.dust.material.opacity = Math.min(.42, .15 + (t - 30) * .03); }
    // light through the windows, plus sparks and smoke, only in the wreck
    this.shaft.mesh.visible = wreckSide; this.shaft.uniforms.time.value = t; this.shaft.uniforms.power.value = stage >= 1 ? 1 : 0;
    if (this.beam) this.beam.intensity = wreckSide ? 30 + 5 * Math.sin(t * .7) : 0;
    this.smoke.points.visible = wreckSide; this.sitePlumes.points.visible = stage >= 2 || stage === 1;
    if (wreckSide) { this.smoke.update(dt, t); this.sitePlumes.update(dt, t); }
    this.sparks.points.visible = wreckSide; this.sparks.update(dt, t, wreckSide);
    this.sparks0.points.visible = stage === 0 && t > 31; this.sparks0.update(dt, t, stage === 0 && t > 31);
    if (this.sparkLight && stage === 0 && t > 31) { this.sparkLight.intensity = this.sparks0.flash * 8; }
    this.site.group.visible = wreckSide; this.site.update(t);
    // the port and its way
    this.halos.update(t); this.halos.points.visible = stage >= 2;
    this.pylons.visible = stage >= 2;
    this.emit.color.setScalar(.8 + .2 * Math.sin(t * 2.4));
    // supply crate beacon (a small LED that blinks, so the buried crate can be found at dusk)
    const led = o.crate?.userData.led; if (led) { const v = Math.sin(t * 3.2) > .45 ? 1.4 : .1; led.color.setRGB(.25 * v, v, .5 * v); }
  }
  dispose() {
    this.vignette?.remove(); this.sky.dispose(); this.shaft.dispose(); this.smoke.dispose(); this.sitePlumes.dispose(); this.sparks.dispose(); this.sparks0.dispose(); this.halos.dispose(); this.site.dispose?.();
    this.emit.dispose(); this.pylons.traverse(o => o.geometry?.dispose());
    this.site.group.traverse(o => { o.geometry?.dispose(); });
  }
}
