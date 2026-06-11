// WORLDS LAB · lib v1 · buildings.js — houses, shops, towers, civic buildings.
// Every builder self-places: it adds meshes to the scene, registers a solid AABB
// collider, and (optionally) registers a door on the facade using the house
// door/prompt system — act can be a page, an external link, an interior, or a ride.
// Rotation is quarter-turn only (0 / 90 / 180 / 270) so AABB colliders stay honest.
// LIB FREEZE LAW: v1 files are frozen once worlds ship on them. Improvements go in lib/v2/.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";
import { brickTexture, plankTexture, shingleTexture, stoneTexture, facadeMaps, textTexture, metalTexture, curtainTexture, carpetTexture } from "./textures.js";

const M = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0.04 }, extra));
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const cyl = (rt, rb, h, mat, seg) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), mat);

function quarter(rot) { return ((Math.round((rot || 0) / (Math.PI / 2)) % 4) + 4) % 4; }
function rotOffset(q, dx, dz) {
  // rotate an offset (dx toward +z facade) by quarter turns
  if (q === 0) return [dx, dz];
  if (q === 1) return [dz, -dx];
  if (q === 2) return [-dx, -dz];
  return [-dz, dx];
}

function finishBuilding(kit, g, o, w, d, doorOffset) {
  const q = quarter(o.rot);
  const y = kit.groundHeight(o.x, o.z);
  g.position.set(o.x, y, o.z);
  g.rotation.y = (o.rot || 0);
  kit.scene.add(g);
  const fw = (q % 2 === 0) ? w : d, fd = (q % 2 === 0) ? d : w;
  kit.addCollider({ x: o.x, z: o.z, w: fw, d: fd });
  if (o.door) {
    const off = rotOffset(q, doorOffset[0], doorOffset[1]);
    kit.addDoor({
      label: o.door.label || "Enter",
      x: o.x + off[0], z: o.z + off[1],
      hw: o.door.hw || 2.0, hd: o.door.hd || 2.0,
      act: o.door.act || { type: "page", path: "/" },
    });
  }
  return g;
}

function doorSlab(w, h, color) {
  const m = box(w, h, 0.1, M(color || 0x3a2f26));
  return m;
}

function nameBoard(text, w, accent) {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(w, w * 0.22),
    new THREE.MeshStandardMaterial({ map: textTexture([text], { w: 512, h: 128, border: false, bg: "#171b21", accent: accent || "#ffd166" }) })
  );
}

// ---------- houses ----------
export function house(kit, o) {
  const style = o.style || "cottage";
  const g = new THREE.Group();
  let w = 6, d = 5, wallH = 2.8;

  if (style === "cottage") {
    const walls = box(w, wallH, d, new THREE.MeshStandardMaterial({ map: brickTexture({ brick: o.wall || "#a86a50", seed: o.seed || 7 }) }));
    walls.position.y = wallH / 2; g.add(walls);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.4, 2.2, 4), new THREE.MeshStandardMaterial({ map: shingleTexture({ color: o.roof || "#5a6470" }) }));
    roof.position.y = wallH + 1.1; roof.rotation.y = Math.PI / 4; g.add(roof);
  } else if (style === "cabin") {
    w = 5.4; d = 4.6;
    const walls = box(w, wallH, d, new THREE.MeshStandardMaterial({ map: plankTexture({ wood: o.wall || "#8a5f38", seed: o.seed || 4 }) }));
    walls.position.y = wallH / 2; g.add(walls);
    const roofL = box(w + 0.7, 0.16, d * 0.72, M(o.roof || 0x4d4339));
    roofL.position.set(0, wallH + 0.62, -d * 0.26); roofL.rotation.x = 0.5; g.add(roofL);
    const roofR = roofL.clone(); roofR.position.z = d * 0.26; roofR.rotation.x = -0.5; g.add(roofR);
    const chimney = box(0.5, 1.6, 0.5, new THREE.MeshStandardMaterial({ map: stoneTexture({}) })); chimney.position.set(w / 2 - 0.8, wallH + 1.0, 0); g.add(chimney);
  } else if (style === "brownstone") {
    w = 5.2; d = 5.2; wallH = 6.4;
    const walls = box(w, wallH, d, new THREE.MeshStandardMaterial({ map: brickTexture({ brick: o.wall || "#7a4438", mortar: "#9c8d80", seed: o.seed || 12, repeat: [2, 4] }) }));
    walls.position.y = wallH / 2; g.add(walls);
    const cornice = box(w + 0.4, 0.3, d + 0.4, M(0x4d4339)); cornice.position.y = wallH + 0.15; g.add(cornice);
    const stoop = box(1.8, 0.5, 1.4, new THREE.MeshStandardMaterial({ map: stoneTexture({}) })); stoop.position.set(0, 0.25, d / 2 + 0.6); g.add(stoop);
    const winMat = M(0xbfd8ea, { emissive: 0xffd9a0, emissiveIntensity: 0.08, roughness: 0.3 });
    kit.bindEmissive(winMat, 0.9, 0.05);
    for (let fy = 0; fy < 3; fy++) for (const sx of [-1.4, 1.4]) {
      const win = box(0.9, 1.1, 0.06, winMat);
      win.position.set(sx, 1.5 + fy * 1.85, d / 2 + 0.01); g.add(win);
    }
  } else if (style === "modern") {
    w = 7; d = 5.6; wallH = 3.2;
    const main = box(w, wallH, d, M(o.wall || 0xe8e2d6, { roughness: 0.6 })); main.position.y = wallH / 2; g.add(main);
    const upper = box(w * 0.6, 2.4, d * 0.8, M(0x3a3f46, { roughness: 0.5 })); upper.position.set(-w * 0.14, wallH + 1.2, 0); g.add(upper);
    const glassMat = M(0x9fd4e8, { transparent: true, opacity: 0.6, roughness: 0.15, metalness: 0.3, emissive: 0xffd9a0, emissiveIntensity: 0.05 });
    kit.bindEmissive(glassMat, 0.7, 0.04);
    const glass = box(w * 0.5, wallH * 0.7, 0.08, glassMat); glass.position.set(w * 0.18, wallH / 2, d / 2 + 0.02); g.add(glass);
  } else if (style === "dome") {
    w = 6; d = 6;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(o.wall || 0xd8cfc2, { roughness: 0.7 }));
    g.add(dome);
    const rim = cyl(3.05, 3.1, 0.3, M(0x8a8378), 18); rim.position.y = 0.15; g.add(rim);
    wallH = 2.2;
  } else if (style === "hut") {
    w = 4.4; d = 4.4; wallH = 2.3;
    const walls = cyl(2.1, 2.3, wallH, new THREE.MeshStandardMaterial({ map: plankTexture({ wood: "#9a7a54", vertical: true }) }), 10);
    walls.position.y = wallH / 2; g.add(walls);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.7, 10), M(0xb09a5e, { roughness: 1 }));
    roof.position.y = wallH + 0.85; g.add(roof);
  } else if (style === "aframe") {
    w = 5.4; d = 6; wallH = 3.6;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(0, wallH);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
    geo.translate(0, 0, -d / 2);
    const body = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: plankTexture({ wood: o.wall || "#6b4a30", seed: 8 }) }));
    g.add(body);
  }

  // door slab on the +z facade
  const slab = doorSlab(1.1, 1.9);
  slab.position.set(0, 0.95, d / 2 + 0.06);
  g.add(slab);
  if (o.name) { const nb = nameBoard(o.name, 2.6, o.accent); nb.position.set(0, wallH ? wallH - 0.3 : 2.2, d / 2 + 0.08); g.add(nb); }
  return finishBuilding(kit, g, o, w, d, [0, d / 2 + 1.2]);
}

// ---------- shop with awning ----------
export function shop(kit, o) {
  const w = o.w || 6.4, d = o.d || 5, wallH = 3.4;
  const g = new THREE.Group();
  const walls = box(w, wallH, d, new THREE.MeshStandardMaterial({ map: brickTexture({ brick: o.wall || "#9c7a5a", seed: o.seed || 15 }) }));
  walls.position.y = wallH / 2; g.add(walls);
  const front = box(w * 0.78, 1.6, 0.08, M(0xbfe2ea, { roughness: 0.25, emissive: 0xfff1cc, emissiveIntensity: 0.06 }));
  kit.bindEmissive(front.material, 0.8, 0.05);
  front.position.set(0, 1.25, d / 2 + 0.02); g.add(front);
  const awning = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.86, 1.3), new THREE.MeshStandardMaterial({ map: (o.awning || null) ? o.awning : undefined, color: o.awning ? 0xffffff : (o.awningColor || 0xc24b3e), side: THREE.DoubleSide }));
  awning.position.set(0, 2.6, d / 2 + 0.55); awning.rotation.x = -0.55; g.add(awning);
  const sign = nameBoard(o.name || "SHOP", 3.4, o.accent); sign.position.set(0, wallH - 0.25, d / 2 + 0.06); g.add(sign);
  return finishBuilding(kit, g, o, w, d, [0, d / 2 + 1.2]);
}

// ---------- lit-window tower (city block) ----------
export function tower(kit, o) {
  const w = o.w || 7, d = o.d || 7, h = o.h || 18;
  const g = new THREE.Group();
  const maps = facadeMaps({ base: o.base || "#5e6772", lit: o.lit || "#ffd9a0", litRatio: o.litRatio || 0.4, rows: Math.max(4, Math.round(h / 2.2)), cols: 5, seed: o.seed || 31 });
  const mat = new THREE.MeshStandardMaterial({ map: maps.map, emissive: 0xffffff, emissiveMap: maps.emissiveMap, emissiveIntensity: 0.05, roughness: 0.8 });
  kit.bindEmissive(mat, 1.0, 0.04);
  const body = box(w, h, d, mat);
  body.position.y = h / 2; g.add(body);
  const crown = box(w * 0.7, 0.8, d * 0.7, M(0x2c333b)); crown.position.y = h + 0.4; g.add(crown);
  const inset = box(2.2, 2.6, 0.4, M(0x14181d)); inset.position.set(0, 1.3, d / 2 - 0.1); g.add(inset);
  if (o.name) { const nb = nameBoard(o.name, 3.2, o.accent); nb.position.set(0, 3.4, d / 2 + 0.06); g.add(nb); }
  return finishBuilding(kit, g, o, w, d, [0, d / 2 + 1.3]);
}

// ---------- lighthouse with a turning lamp ----------
export function lighthouse(kit, o) {
  const g = new THREE.Group();
  const h = o.h || 12;
  const bodyMat = new THREE.MeshStandardMaterial({ map: (function () { const t = brickTexture({ brick: "#c8423a", mortar: "#f2ead8", repeat: [3, 5] }); return t; })() });
  const body = cyl(1.5, 2.2, h, bodyMat, 14); body.position.y = h / 2; g.add(body);
  const cap = cyl(1.7, 1.7, 1.4, M(0x2c333b), 14); cap.position.y = h + 0.7; g.add(cap);
  const lampMat = M(0xfff1cc, { emissive: 0xffe9a0, emissiveIntensity: 1.2 });
  const lamp = cyl(1.1, 1.1, 1.0, lampMat, 12); lamp.position.y = h + 0.7; g.add(lamp);
  kit.bindEmissive(lampMat, 2.6, 0.5);
  const beamMat = M(0xfff6d8, { transparent: true, opacity: 0.18, emissive: 0xfff6d8, emissiveIntensity: 0.8, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(2.4, 16, 12, 1, true), beamMat);
  beam.rotation.z = Math.PI / 2; beam.position.set(8, h + 0.7, 0);
  const beamPivot = new THREE.Group(); beamPivot.position.y = 0; beamPivot.add(beam); g.add(beamPivot);
  kit.addUpdate((dt) => { beamPivot.rotation.y += dt * 0.55; beamMat.opacity = 0.05 + kit.night() * 0.18; });
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.2, 14), M(0xc8423a)); roof.position.y = h + 1.9; g.add(roof);
  return finishBuilding(kit, g, o, 4.4, 4.4, [0, 3.2]);
}

// ---------- castle keep ----------
export function castleKeep(kit, o) {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ map: stoneTexture({ color: "#7d7d76", repeat: [3, 3] }) });
  const w = o.w || 9, d = o.d || 9, h = o.h || 7;
  const body = box(w, h, d, stone); body.position.y = h / 2; g.add(body);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const t = cyl(1.2, 1.4, h + 2.2, stone, 10);
    t.position.set(sx * (w / 2), (h + 2.2) / 2, sz * (d / 2)); g.add(t);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.4, 10), M(0x4a5568));
    cap.position.set(sx * (w / 2), h + 2.9, sz * (d / 2)); g.add(cap);
  }
  for (let i = 0; i < Math.floor(w / 1.2); i++) {
    const m = box(0.7, 0.7, 0.4, stone);
    m.position.set(-w / 2 + 0.8 + i * 1.2, h + 0.35, d / 2 - 0.1); g.add(m);
  }
  const gate = box(2.2, 3.2, 0.3, M(0x3a2f26)); gate.position.set(0, 1.6, d / 2 + 0.05); g.add(gate);
  return finishBuilding(kit, g, o, w + 2, d + 2, [0, d / 2 + 1.5]);
}

// ---------- observatory (rotating dome with a slit) ----------
export function observatoryDome(kit, o) {
  const g = new THREE.Group();
  const base = cyl(3.2, 3.5, 3.2, M(0xd8d2c4), 16); base.position.y = 1.6; g.add(base);
  const domeGroup = new THREE.Group(); domeGroup.position.y = 3.2;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3.1, 18, 12, 0.25, Math.PI * 2 - 0.5, 0, Math.PI / 2), M(0xaab4c0, { metalness: 0.3, roughness: 0.5 }));
  domeGroup.add(dome);
  const slit = box(0.5, 3.0, 0.2, M(0x14181d)); slit.position.set(0, 1.4, 2.85); slit.rotation.x = -0.5; domeGroup.add(slit);
  g.add(domeGroup);
  kit.addUpdate((dt) => { domeGroup.rotation.y += dt * 0.1; });
  if (o.name) { const nb = nameBoard(o.name, 3.2, o.accent); nb.position.set(0, 2.4, 3.6); g.add(nb); }
  return finishBuilding(kit, g, o, 7, 7, [0, 4.6]);
}

// ---------- airfield control tower ----------
export function controlTower(kit, o) {
  const g = new THREE.Group();
  const shaft = cyl(1.1, 1.5, 8, M(0xd8d2c4), 10); shaft.position.y = 4; g.add(shaft);
  const cabMat = M(0x9fd4e8, { transparent: true, opacity: 0.75, roughness: 0.2, emissive: 0xbfe9ff, emissiveIntensity: 0.1 });
  kit.bindEmissive(cabMat, 0.9, 0.08);
  const cab = cyl(2.4, 1.9, 1.8, cabMat, 10); cab.position.y = 8.9; g.add(cab);
  const roof = cyl(2.6, 2.6, 0.25, M(0x2c333b), 10); roof.position.y = 9.9; g.add(roof);
  const blinkMat = M(0xff5a4a, { emissive: 0xff5a4a, emissiveIntensity: 1 });
  const blink = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), blinkMat); blink.position.y = 10.2; g.add(blink);
  kit.addUpdate((dt, t) => { blinkMat.emissiveIntensity = (Math.sin(t * 4) > 0 ? 1.6 : 0.1); });
  return finishBuilding(kit, g, o, 3.4, 3.4, [0, 2.6]);
}

// ---------- barn ----------
export function barn(kit, o) {
  const g = new THREE.Group();
  const w = 7, d = 9, wallH = 3.4;
  const walls = box(w, wallH, d, new THREE.MeshStandardMaterial({ map: plankTexture({ wood: o.wall || "#a8403a", vertical: true, seed: 6 }) }));
  walls.position.y = wallH / 2; g.add(walls);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, d, 3, 1, false, Math.PI - Math.PI / 3, Math.PI * 2 / 3), M(0x6b5436));
  roof.rotation.x = Math.PI / 2; roof.rotation.y = Math.PI; roof.position.y = wallH + 1.0; g.add(roof);
  const doors = box(2.6, 2.6, 0.12, M(0xf2ead8)); doors.position.set(0, 1.3, d / 2 + 0.05); g.add(doors);
  const cross = box(2.4, 0.18, 0.14, M(0xa8403a)); cross.rotation.z = 0.7; cross.position.set(0, 1.3, d / 2 + 0.1); g.add(cross);
  const cross2 = cross.clone(); cross2.rotation.z = -0.7; g.add(cross2);
  return finishBuilding(kit, g, o, w, d, [0, d / 2 + 1.4]);
}

// ---------- generic walk-in room shell (used by world interiors) ----------
// Call inside kit.registerInterior's builder: builds floor/walls/ceiling and warm
// lighting around api.origin, sized to api.half. Visual only — movement is held
// by the interior bounds; furniture the caller adds can register interior colliders.
export function buildRoomShell(kit, api, opts) {
  const o = opts || {};
  const half = api.half;
  const ox = api.origin.x, oz = api.origin.z;
  const g = new THREE.Group();
  const floorMat = o.carpet ? new THREE.MeshStandardMaterial({ map: carpetTexture({ color: o.carpet }) }) : new THREE.MeshStandardMaterial({ map: plankTexture({ wood: o.floor || "#8a6844", repeat: [6, 6] }) });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, half * 2), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(ox, 0.01, oz); g.add(floor);
  const wallMat = o.curtains ? new THREE.MeshStandardMaterial({ map: curtainTexture({ color: o.curtains }) }) : M(o.wall || 0x4a4540);
  const wallH = o.wallH || 4.2;
  const mk = (w, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, wallH), wallMat); m.position.set(x, wallH / 2, z); m.rotation.y = ry; g.add(m); };
  mk(half * 2, ox, oz - half, 0);
  mk(half * 2, ox, oz + half, Math.PI);
  mk(half * 2, ox - half, oz, Math.PI / 2);
  mk(half * 2, ox + half, oz, -Math.PI / 2);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, half * 2), M(0x26221e));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(ox, wallH, oz); g.add(ceil);
  const glowMat = M(0xfff1cc, { emissive: 0xfff1cc, emissiveIntensity: 0.9 });
  for (let i = -1; i <= 1; i++) {
    const strip = box(half * 0.8, 0.06, 0.5, glowMat);
    strip.position.set(ox, wallH - 0.05, oz + i * half * 0.55); g.add(strip);
  }
  const lamp = new THREE.PointLight(0xffe9c4, 0.9, half * 4.5);
  lamp.position.set(ox, wallH - 0.8, oz); g.add(lamp);
  kit.scene.add(g);
  return g;
}
