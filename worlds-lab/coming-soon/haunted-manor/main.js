// WORLDS LAB · Hollow Manor — COMING SOON gate.
// Current-state note: a real plaza, a locked gate, a rotating preview — and a plaque
// that describes the current state. Friendly-spooky, still in development.
// Laws: BUILD below matches ?v= in this folder's index.html, same commit.
// Boot call sits at the very END of the file (TDZ law). Lib v1 is frozen.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";
import { createWorld } from "../../lib/v1/kit.js";
import { rollingHills } from "../../lib/v1/layouts.js";
import { comingSoonWorld } from "../../lib/v1/comingsoon.js";
import { place, tree, torch } from "../../lib/v1/props.js";

const BUILD = "2026-06-11-lab1"; // bumped with ?v= in index.html on every deploy

const terrain = rollingHills({ amp: 2.0, clearRadius: 22, seed: 9909, grass: "#46523e", rock: "#5a5a52" });

const kit = createWorld({
  build: BUILD,
  bounds: 40,
  groundHeight: terrain.groundHeight,
  spawn: { x: 0, z: 7, yaw: Math.PI },
  timeOfDay: 0.82, // permanent dusk — the manor hour
  fogDensity: 0.022,
  palette: { skyStops: [[0, "#1d1428"], [1, "#1d1428"]], night: "#140e1d", sunWarm: "#c8a8d8" },
});

// hero: a tiny manor with one warm window — the house that watches back
function manorHero() {
  const g = new THREE.Group();
  const M = (c, e) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.9 }, e));
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.4, 1.2), M(0x3a3440));
  body.position.y = 0.7; g.add(body);
  const towerMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.2, 0.7), M(0x342e3a));
  towerMesh.position.set(-0.8, 1.1, 0); g.add(towerMesh);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.8, 4), M(0x241f2c));
  roof.position.set(-0.8, 2.6, 0); roof.rotation.y = Math.PI / 4; g.add(roof);
  const roof2 = new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.9, 4), M(0x241f2c));
  roof2.position.set(0.3, 1.85, 0); roof2.rotation.y = Math.PI / 4; roof2.scale.x = 1.2; g.add(roof2);
  const winMat = M(0xffd9a0, { emissive: 0xffc878, emissiveIntensity: 1.3 });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.3), winMat);
  win.position.set(-0.8, 1.5, 0.36); g.add(win);
  return g;
}

function build() {
  terrain.build(kit.scene);
  comingSoonWorld(kit, {
    name: "HOLLOW MANOR",
    accent: "#c8b8e8",
    blurb: "A dusk estate with a house that watches back. Friendly, and still in development.",
    hero: manorHero,
    heroScale: 0.95,
  });
  // dead trees around the plaza edge set the mood
  for (const [x, z] of [[-12, 4], [12, 2], [-9, -8], [10, -9], [-14, -2]]) place(kit, tree("dead", { seed: (x * 3 + z) | 0 }), x, z);
  for (const [x, z] of [[-4, 4], [4, 4]]) place(kit, torch(kit), x, z);
}

// ---- boot (end of file, TDZ-safe) ----
build();
kit.start();
