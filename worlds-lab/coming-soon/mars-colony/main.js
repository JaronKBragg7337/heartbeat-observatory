// WORLDS LAB · Dome Nine (Mars) — COMING SOON gate.
// Current-state note: a real plaza, a locked gate, a rotating preview — and a plaque
// that says plainly nothing is behind the gate yet. Plug-in ready.
// Laws: BUILD below matches ?v= in this folder's index.html, same commit.
// Boot call sits at the very END of the file (TDZ law). Lib v1 is frozen.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";
import { createWorld } from "../../lib/v1/kit.js";
import { craterField } from "../../lib/v1/layouts.js";
import { comingSoonWorld } from "../../lib/v1/comingsoon.js";

const BUILD = "2026-06-11-lab1"; // bumped with ?v= in index.html on every deploy

const terrain = craterField({ color: "#b0563c", craters: 7, seed: 8808 });

const kit = createWorld({
  build: BUILD,
  bounds: 40,
  groundHeight: terrain.groundHeight,
  spawn: { x: 0, z: 7, yaw: Math.PI },
  fogDensity: 0.014,
  palette: { skyStops: [[0, "#1a0905"], [0.3, "#a85e3a"], [0.5, "#c8825a"], [0.7, "#a85e3a"], [1, "#1a0905"]], sunWarm: "#ffd8b8", night: "#140703" },
});

// hero: a little habitat dome cluster
function domeHero() {
  const g = new THREE.Group();
  const M = (c, e) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6 }, e));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(0xe8e2d6, { transparent: true, opacity: 0.85 }));
  g.add(dome);
  const dome2 = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0xe8e2d6, { transparent: true, opacity: 0.85 }));
  dome2.position.set(1.4, 0, 0.4); g.add(dome2);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.1, 8), M(0xc2c8d0));
  tube.rotation.z = Math.PI / 2; tube.position.set(0.8, 0.25, 0.2); g.add(tube);
  const lightMat = M(0xffd9a0, { emissive: 0xffd9a0, emissiveIntensity: 1 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), lightMat);
  beacon.position.set(0, 1.3, 0); g.add(beacon);
  return g;
}

function build() {
  terrain.build(kit.scene);
  comingSoonWorld(kit, {
    name: "DOME NINE",
    accent: "#ff9a6a",
    blurb: "A red-dust settlement - habitat domes, rovers, a far-off observatory.",
    hero: domeHero,
    heroScale: 0.9,
  });
}

// ---- boot (end of file, TDZ-safe) ----
build();
kit.start();
