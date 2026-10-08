// ============================================================================
// opening/spaceScene.js - space as the opening shows it: the star dome, Mars (the game's own global shell, Valles Marineris turned to face the
// ship) or another world's globe, a Sun and the light Mars throws back, and the convoy of real ships that flies beside the player's liner
// ("close enough to read their names", BIBLE-v3 10.1). Everything is placed in the SHIP'S frame (x starboard, y up, -z forward): the ship stands at
// the origin, the sky and the neighbours move round it. Pure picture: it owns no rule of the opening.
//
// HONEST: the distances are chosen to read well from a lounge window (Mars about fourteen degrees across at the start, forty near the end); the
// real approach is a long coast. The neighbours' names, positions and sway are src/ships/transport/convoy.js (SH15).
// ============================================================================
import * as THREE from 'three';
import { buildGlobalShell } from '../world/planetMesh.js';
import { getBody } from '../world/bodies.js';
import { geodeticToCartesian } from '../world/geodesy.js';
import { DOME_VS, DOME_FS } from '../space/spaceSky.js';
import { shipDef } from '../ships/registry.js';
import { visualsFor } from '../ships/visuals.js';
import { OPENING_CONVOY, convoyPose } from '../ships/transport/convoy.js';
import { worldFacts } from './worlds.js';

const DEG = Math.PI / 180, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const MARS_R = 3_389_500;
/** The Sun's direction (from the ship toward the Sun) and the direction Mars's own light comes back from. */
export const SUN_DIR = new THREE.Vector3(-0.55, 0.35, 0.4).normalize();

function hash3(x, y, z) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), u), l(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), u), v), l(l(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), u), l(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), u), v), w);
}
const fbm3 = (x, y, z) => 0.5 * vnoise(x, y, z) + 0.25 * vnoise(x * 2.1, y * 2.1, z * 2.1) + 0.125 * vnoise(x * 4.3, y * 4.3, z * 4.3) + 0.0625 * vnoise(x * 8.7, y * 8.7, z * 8.7);

/** Ceres from orbit: dark grey crust, craters (cells of darker and brighter rims), and the bright salt of Occator. Unit radius; the caller scales it. */
function ceresGlobe(low) {
  const g = new THREE.SphereGeometry(1, low ? 96 : 160, low ? 48 : 80), p = g.attributes.position, col = new Float32Array(p.count * 3), occ = new THREE.Vector3(0.9, 0.34, -0.28).normalize();
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n = fbm3(v.x * 4 + 3, v.y * 4, v.z * 4), n2 = fbm3(v.x * 15, v.y * 15 + 7, v.z * 15);
    // craters: darker floors, brighter rims, from a cellular hash
    const cx = v.x * 11, cy = v.y * 11, cz = v.z * 11; let best = 9, rimv = 0;
    for (let dx = 0; dx <= 1; dx++) for (let dy = 0; dy <= 1; dy++) for (let dz = 0; dz <= 1; dz++) {
      const ox = Math.floor(cx) + dx, oy = Math.floor(cy) + dy, oz = Math.floor(cz) + dz;
      if (hash3(ox, oy, oz) > 0.55) continue;
      const d = Math.hypot(cx - (ox + hash3(oz, ox, oy)), cy - (oy + hash3(ox + 4, oy, oz)), cz - (oz + hash3(oy, oz, ox + 9))); if (d < best) best = d;
    }
    rimv = best < 0.55 ? (best > 0.38 ? 0.12 : -0.07) : 0;
    let k = 0.20 + 0.24 * n + 0.05 * n2 + rimv;
    const sd = v.angleTo(occ); if (sd < 0.07) k += (1 - sd / 0.07) ** 1.5 * 0.9;
    col[i * 3] = k * 0.98; col[i * 3 + 1] = k * 0.95; col[i * 3 + 2] = k * 0.9;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 }));
}

/** Earth from space: NASA's Blue Marble (assets/earth/earth-2k.jpg, the picture the world itself uses) on a lit ball, Florida turned to the face the ship sees (the same spot ceresGlobe puts Occator). Unit radius. */
function earthGlobe(low) {
  const g = new THREE.SphereGeometry(1, low ? 96 : 160, low ? 48 : 80), mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 }), m = new THREE.Mesh(g, mat);
  new THREE.TextureLoader().load(new URL('../../assets/earth/earth-2k.jpg', import.meta.url).href, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; mat.map = t; mat.needsUpdate = true; }, undefined, () => {});
  // the sphere's own texture point for 28.6 N 80.6 W, turned to where the ship looks
  const lat = 28.6 * Math.PI / 180, ph = (-80.6 + 180) * Math.PI / 180, th = Math.PI / 2 - lat;
  const florida = new THREE.Vector3(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th));
  m.quaternion.setFromUnitVectors(florida, new THREE.Vector3(0.9, 0.34, -0.28).normalize());
  return m;
}

function atmosphere(color, power, k, low) {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, toneMapped: false,
    uniforms: { uCol: { value: new THREE.Color(color) }, uPow: { value: power }, uK: { value: k } },
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv;
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform vec3 uCol; uniform float uPow; uniform float uK; varying vec3 vN; varying vec3 vV;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      void main(){
      #include <logdepthbuf_fragment>
      float f=pow(1.-max(dot(normalize(vN),normalize(vV)),0.),uPow); gl_FragColor=vec4(uCol*f*uK,1.); }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, low ? 64 : 96, low ? 32 : 48), m); mesh.frustumCulled = false; mesh.renderOrder = 3; return mesh;
}

export class SpaceScene {
  /** o: { engine, mats: matsExt, tier, root (THREE.Group to fill) } */
  constructor(o) {
    this.engine = o.engine; this.tier = o.tier || 'low'; this.low = this.tier === 'low'; this.mats = o.mats;
    this.root = new THREE.Group(); this.root.name = 'opening-space';
    // star dome: the game's own star shader, an opaque background with no depth
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(5e8, 48, 24), new THREE.ShaderMaterial({
      vertexShader: DOME_VS, fragmentShader: DOME_FS, side: THREE.BackSide, depthTest: false, depthWrite: false, toneMapped: false,
      uniforms: { uBg: { value: new THREE.Color(0, 0, 0) }, uStars: { value: 1 }, uGal: { value: new THREE.Vector3(0.38, 0.86, 0.34) } }, extensions: { derivatives: true },
    }));
    this.dome.renderOrder = -1000; this.dome.frustumCulled = false; this.root.add(this.dome);
    // lights: the Sun (key), the light Mars throws back (fill from the planet's side), a faint hemisphere
    this.sun = new THREE.DirectionalLight(0xfff1de, 2.4); this.sun.position.copy(SUN_DIR).multiplyScalar(100); this.root.add(this.sun, this.sun.target);
    this.shine = new THREE.DirectionalLight(0xffc7a0, 0.55); this.root.add(this.shine, this.shine.target);
    this.hemi = new THREE.HemisphereLight(0x8aa0d0, 0x20161a, 0.12); this.root.add(this.hemi);
    // the Sun's disc and glow
    const tex = (stops) => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      for (const [p, col] of stops) gr.addColorStop(p, col); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
    const sm = (t, op) => new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, opacity: op });
    this.sunCore = new THREE.Sprite(sm(tex([[0, 'rgba(255,255,250,1)'], [0.5, 'rgba(255,246,225,1)'], [0.8, 'rgba(255,225,180,0.4)'], [1, 'rgba(255,220,170,0)']]), 1));
    this.sunGlow = new THREE.Sprite(sm(tex([[0, 'rgba(255,240,215,0.6)'], [0.2, 'rgba(255,225,185,0.25)'], [0.55, 'rgba(255,205,160,0.07)'], [1, 'rgba(255,200,150,0)']]), 1));
    for (const s of [this.sunCore, this.sunGlow]) { s.frustumCulled = false; s.position.copy(SUN_DIR).multiplyScalar(2.5e8); this.root.add(s); }
    this.sunCore.scale.setScalar(2 * 2.5e8 * Math.tan(0.5 * DEG)); this.sunGlow.scale.setScalar(2 * 2.5e8 * Math.tan(6 * DEG)); this.sunCore.renderOrder = 5; this.sunGlow.renderOrder = 4;
    // the globes: Mars (the game's shell, built once) and the destination's (built on demand)
    this.globe = new THREE.Group(); this.globe.name = 'opening-globe'; this.root.add(this.globe);
    this.mars = buildGlobalShell(getBody('mars'), { segments: this.low ? 128 : 192 });
    this.mars.material.polygonOffset = false; this.mars.castShadow = false; this.mars.receiveShadow = false;
    this.marsAtm = atmosphere(0xe8a070, 3.2, 1.25, this.low); this.marsAtm.scale.setScalar(1.028 * MARS_R);
    this.marsHaze = atmosphere(0x7fa6ff, 6.0, 0.55, this.low); this.marsHaze.scale.setScalar(1.05 * MARS_R);
    this.marsGroup = new THREE.Group(); this.marsGroup.add(this.mars, this.marsAtm, this.marsHaze); this.globe.add(this.marsGroup);
    this.worldGlobes = {};
    // the neighbours
    this.convoy = [];
    this.convoyGroup = new THREE.Group(); this.convoyGroup.position.y = 15; this.root.add(this.convoyGroup);   // lifted so the window sill (about a metre over the floor) does not hide the ships that fly below the liner
    this.t = 0; this.visible = true;
  }

  /** Build the convoy (the six real ships): done once, with the ship materials the game's own ship made. */
  buildConvoy(count = 6) {
    const order = ['sister-1', 'escort-1', 'sister-2', 'escort-2', 'bulker-1', 'bulker-2'];     // the ones the captain names first; a phone keeps the first five
    const list = order.slice(0, count).map((id) => OPENING_CONVOY.find((c) => c.id === id)).filter(Boolean);
    for (const entry of list) {
      const def = shipDef(entry.type), vis = visualsFor(entry.type), layout = { ...def.layout, custom: vis.custom || null };
      const dtex = vis.decalTexture ? vis.decalTexture(THREE, def, entry.name, entry.registry) : null;
      const decal = dtex ? new THREE.MeshBasicMaterial({ map: dtex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }) : null;
      const ext = vis.buildExterior(layout, this.mats, { tier: this.tier, decal, def });
      vis.applyNeutralPose(ext);
      ext.legs.forEach((leg) => { leg.foot.position.y = -0.35; leg.piston.scale.y = 0.55; leg.piston.position.y = 0.2; });   // gear up
      for (const e of ext.engines) { e.outer.visible = e.core.visible = true; e.outer.scale.set(1.0, 1.0, 1.2); e.core.scale.set(1, 1, 1); }
      const holder = new THREE.Group(); holder.add(ext.root); this.convoyGroup.add(holder);
      this.convoy.push({ entry, holder, ext, decal });
    }
    return this;
  }

  _worldGlobe(id) {
    if (id === 'mars') return null;
    if (!this.worldGlobes[id]) {
      const earth = id === 'earth', m = earth ? earthGlobe(this.low) : ceresGlobe(this.low), grp = new THREE.Group(); grp.add(m);
      const a = earth ? atmosphere(0x6fa6ff, 3.2, 0.5, this.low) : atmosphere(0xb9c4d6, 6.0, 0.12, this.low); grp.add(a); a.scale.setScalar(earth ? 1.012 : 1.006);
      this.globe.add(grp); grp.visible = false; this.worldGlobes[id] = { grp, mesh: m, radius: (worldFacts(id).radiusKm || 470) * 1000 };
    }
    return this.worldGlobes[id];
  }

  /**
   * Place the globe: `nadir` is the unit direction from the ship to the planet's centre, `altitude` the height above the surface (metres).
   * `worldId` 'mars' or another start world; `lat/lon` the point to turn toward the ship (Mars: Valles Marineris).
   */
  setGlobe(worldId, nadir, altitude, spin = 0) {
    const w = this._worldGlobe(worldId), isMars = worldId === 'mars';
    this.marsGroup.visible = isMars; for (const g of Object.values(this.worldGlobes)) g.grp.visible = false;
    const R = isMars ? MARS_R : w.radius;
    const centre = nadir.clone().multiplyScalar(R + altitude);
    this.globe.position.copy(centre);
    const target = isMars ? this.marsGroup : w.grp; if (w) w.grp.visible = true;
    if (isMars) { const d = geodeticToCartesian(getBody('mars'), -14, -59.2, 0), dv = new THREE.Vector3(d.x, d.y, d.z).normalize();
      target.quaternion.setFromUnitVectors(dv, nadir.clone().negate()); target.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(nadir, spin)); }
    else { target.scale.setScalar(R); target.quaternion.setFromUnitVectors(new THREE.Vector3(0.9, 0.34, -0.28).normalize(), nadir.clone().negate()); target.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(nadir, spin)); }
    this.shine.position.copy(nadir).multiplyScalar(100); this.shine.intensity = isMars ? 0.55 : 0.18;
  }

  /**
   * SEAMLESS FLIGHT: the planet leaves this scene's own little frame and is drawn at its true place in the port's frame by the opening (journey in
   * opening.js): Mars is taken once, another world's globe when it is wanted. Both come back as plain groups (their own units: metres, body axes).
   */
  takeMars() { this.globe.remove(this.marsGroup); this.marsGroup.visible = true; return { group: this.marsGroup, atm: this.marsAtm, haze: this.marsHaze }; }
  takeWorld(id) { const w = this._worldGlobe(id); if (!w) return null; this.globe.remove(w.grp); w.grp.visible = true; w.grp.scale.setScalar(w.radius); w.grp.userData.baseQuat = new THREE.Quaternion(); return w; }

  /** The convoy at time t: the neighbours' poses in the ship's frame. */
  updateConvoy(t, spread = 1) {       // `spread` > 1: the neighbours peel away from the ship (their offsets grow) as it meets the air
    for (const c of this.convoy) {
      const p = convoyPose(c.entry, t);
      c.holder.position.set(p.x * spread, p.y * spread + (spread - 1) * 30, p.z * spread);
      c.holder.rotation.set(p.pitchDeg * DEG, -p.yawDeg * DEG, p.rollDeg * DEG, 'YXZ');
    }
  }
  setConvoyVisible(v) { this.convoyGroup.visible = v; }

  setVisible(v) { this.visible = v; this.root.visible = v; }
  dispose() {
    this.root.traverse((o) => { if (o.isMesh || o.isPoints) { o.geometry?.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) if (m && !Object.values(this.mats).includes(m)) { m.map?.dispose?.(); m.dispose?.(); } } });
    for (const c of this.convoy) { c.decal?.map?.dispose(); c.decal?.dispose(); }
    this.root.removeFromParent();
  }
}
void clamp;
