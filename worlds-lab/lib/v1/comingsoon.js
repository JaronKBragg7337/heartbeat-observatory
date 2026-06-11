// WORLDS LAB · lib v1 · comingsoon.js — honest "coming soon" worlds.
// HONESTY LAW (load-bearing): what is not real yet is left honestly empty rather
// than faked. A coming-soon world is a real, walkable gate plaza with a locked
// gate, a rotating preview of the world's hero object, and a plaque that says
// plainly: nothing is behind this gate yet. Plug-in ready for the day it's built.
// LIB FREEZE LAW: v1 files are frozen once worlds ship on them. Improvements go in lib/v2/.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";
import { textTexture, stoneTexture, hazardTexture } from "./textures.js";

const M = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0.05 }, extra));
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const cyl = (rt, rb, h, mat, seg) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), mat);

export function comingSoonWorld(kit, o) {
  const name = o.name || "A NEW WORLD";
  const accent = o.accent || "#7bd88f";

  // plaza
  const stone = new THREE.MeshStandardMaterial({ map: stoneTexture({ repeat: [6, 6] }) });
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(16, 26), stone);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.03;
  kit.scene.add(plaza);

  // the gate arch
  const archMat = M(o.arch || 0x4a4f57, { metalness: 0.2 });
  for (const s of [-4.4, 4.4]) {
    const col = cyl(0.5, 0.65, 7.2, archMat, 10);
    col.position.set(s, 3.6, -10);
    kit.scene.add(col);
    kit.addCollider({ x: s, z: -10, w: 1.3, d: 1.3 });
  }
  const lintel = box(10.6, 1.1, 1.2, archMat);
  lintel.position.set(0, 7.4, -10);
  kit.scene.add(lintel);
  const nameMat = new THREE.MeshStandardMaterial({ map: textTexture([name, "COMING SOON"], { w: 1024, h: 300, accent, font: "bold 86px system-ui, sans-serif", subFont: "44px system-ui, sans-serif" }) });
  const namePlate = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 2.7), nameMat);
  namePlate.position.set(0, 7.4, -9.35);
  kit.scene.add(namePlate);

  // locked gate — physically there, honestly shut
  const gate = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 4.6), new THREE.MeshStandardMaterial({ map: hazardTexture({ repeat: [4, 2] }), transparent: true, opacity: 0.92, side: THREE.DoubleSide }));
  gate.position.set(0, 2.3, -10);
  kit.scene.add(gate);
  kit.addCollider({ x: 0, z: -10, w: 9.2, d: 0.8 });

  // pedestal + slowly turning hero preview
  const ped = cyl(1.5, 1.8, 1.1, stone, 14);
  ped.position.set(0, 0.55, -2.5);
  kit.scene.add(ped);
  kit.addCollider({ x: 0, z: -2.5, w: 3.2, d: 3.2 });
  if (o.hero) {
    const hero = o.hero();
    hero.position.set(0, 1.15, -2.5);
    const baseScale = o.heroScale || 0.55;
    hero.scale.setScalar(baseScale);
    kit.scene.add(hero);
    kit.addUpdate((dt, t) => { hero.rotation.y += dt * 0.5; hero.position.y = 1.15 + Math.sin(t * 1.1) * 0.06; });
  }

  // the honest plaque
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 2.2),
    new THREE.MeshStandardMaterial({ map: textTexture([
      name,
      o.blurb || "This world is planned, not started.",
      "Nothing is behind the gate yet - that's the truth, not a teaser.",
      "Watch it get built in the open at the Observatory.",
    ], { w: 1024, h: 420, accent, font: "bold 52px system-ui, sans-serif", subFont: "30px system-ui, sans-serif" }) })
  );
  plaque.position.set(0, 1.9, -6.4);
  kit.scene.add(plaque);
  const plaqueLegs = box(5.8, 0.14, 0.4, M(0x2c333b));
  plaqueLegs.position.set(0, 0.7, -6.4);
  kit.scene.add(plaqueLegs);
  kit.addCollider({ x: 0, z: -6.4, w: 5.8, d: 0.8 });

  // a couple of waiting lamps so the plaza reads at night
  const lampMat = M(0xfff1cc, { emissive: 0xfff1cc, emissiveIntensity: 0.2 });
  for (const s of [-7, 7]) {
    const post = cyl(0.08, 0.1, 3.2, M(0x2c333b), 8);
    post.position.set(s, 1.6, -4);
    kit.scene.add(post);
    const bulbMat = lampMat.clone();
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), bulbMat);
    bulb.position.set(s, 3.3, -4);
    kit.scene.add(bulb);
    kit.bindEmissive(bulbMat, 2.0, 0.1);
    kit.addCollider({ x: s, z: -4, w: 0.4, d: 0.4 });
  }

  // doors: back to the Lab gallery, and the build plan (real repo, real openness)
  kit.addDoor({ label: "Back to the Worlds Lab", x: 0, z: 9, hw: 2.6, hd: 2.2, act: { type: "page", path: "/worlds-lab/" } });
  if (o.repo !== false) {
    kit.addDoor({ label: "See this world's plan on GitHub", x: 6.5, z: 2.5, hw: 2.2, hd: 2.2, act: { type: "ext", url: o.repo || "https://github.com/JaronKBragg7337/heartbeat-observatory" } });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.9), new THREE.MeshStandardMaterial({ map: textTexture(["BUILD PLAN", "on GitHub"], { w: 512, h: 200, accent }) }));
    sign.position.set(6.5, 1.6, 2.5);
    sign.rotation.y = -0.5;
    kit.scene.add(sign);
  }
}
