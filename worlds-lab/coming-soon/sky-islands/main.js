// WORLDS LAB · Sky Islands — COMING SOON gate.
// HONESTY LAW: a real plaza, a locked gate, a rotating preview — and a plaque
// that says plainly nothing is behind the gate yet. Plug-in ready.
// Laws: BUILD below matches ?v= in this folder's index.html, same commit.
// Boot call sits at the very END of the file (TDZ law). Lib v1 is frozen.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";
import { createWorld } from "../../lib/v1/kit.js";
import { rollingHills } from "../../lib/v1/layouts.js";
import { comingSoonWorld } from "../../lib/v1/comingsoon.js";

const BUILD = "2026-06-11-lab1"; // bumped with ?v= in index.html on every deploy

const terrain = rollingHills({ amp: 1.6, clearRadius: 22, seed: 7707, grass: "#6a9a68" });

const kit = createWorld({
  build: BUILD,
  bounds: 40,
  groundHeight: terrain.groundHeight,
  spawn: { x: 0, z: 7, yaw: Math.PI },
  fogDensity: 0.012,
  palette: { skyStops: [[0, "#101a30"], [0.22, "#e8b0a0"], [0.34, "#a8c8ee"], [0.66, "#a8c8ee"], [0.79, "#e89aa0"], [0.9, "#101a30"], [1, "#101a30"]] },
});

// hero: a tiny floating island with a tree — drawn from primitives right here
function floatingIslandHero() {
  const g = new THREE.Group();
  const M = (c, e) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85 }, e));
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 0.9, 0.5, 9), M(0x5f8f4e));
  top.position.y = 1.4; g.add(top);
  const under = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.6, 9), M(0x8a7560));
  under.rotation.x = Math.PI; under.position.y = 0.4; g.add(under);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.7, 6), M(0x6b4a30));
  trunk.position.y = 2.0; g.add(trunk);
  const puff = new THREE.Mesh(new THREE.SphereGeometry(0.55, 9, 9), M(0x4d7d3f));
  puff.position.y = 2.6; g.add(puff);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 4), M(0xc8b890));
  rope.position.set(1.4, 1.3, 0); rope.rotation.z = 0.5; g.add(rope);
  return g;
}

function build() {
  terrain.build(kit.scene);
  comingSoonWorld(kit, {
    name: "SKY ISLANDS",
    accent: "#bfe2ff",
    blurb: "Floating gardens linked by rope bridges and balloon ferries.",
    hero: floatingIslandHero,
    heroScale: 0.8,
  });
}

// ---- boot (end of file, TDZ-safe) ----
build();
kit.start();
