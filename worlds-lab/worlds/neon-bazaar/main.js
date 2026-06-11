// WORLDS LAB · Neon Bazaar — a permanent night market.
// Demonstrates a FIXED time-of-day palette (always night) while every other lab
// world rides the shared wall-clock cycle. Stalls, lit towers, arcade row, blimp.
// Laws: BUILD below matches ?v= in this folder's index.html, same commit.
// Boot call sits at the very END of the file (TDZ law). Lib v1 is frozen.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";
import { createWorld } from "../../lib/v1/kit.js";
import { flatland, ringPlaza } from "../../lib/v1/layouts.js";
import { place, marketStall, foodCart, streetLamp, signPost, bigSign, arcadeCabinet, planter, trashBin } from "../../lib/v1/props.js";
import { tower } from "../../lib/v1/buildings.js";
import { blimp } from "../../lib/v1/aircraft.js";
import { neonGridTexture, paverTexture } from "../../lib/v1/textures.js";

const BUILD = "2026-06-11-lab1"; // bumped with ?v= in index.html on every deploy

const terrain = flatland({ map: paverTexture({ color: "#3a3742", repeat: [44, 44] }) });

const kit = createWorld({
  build: BUILD,
  bounds: 90,
  groundHeight: terrain.groundHeight,
  spawn: { x: 0, z: 20, yaw: Math.PI },
  timeOfDay: 0.97, // always night — that's the point of this world
  fogDensity: 0.016,
  palette: { skyStops: [[0, "#120822"], [1, "#120822"]], night: "#120822" },
});

function buildBazaar() {
  terrain.build(kit.scene);
  ringPlaza(kit, 0, 0, 14);

  // neon walk strips
  for (const [x, z, w, l, ry] of [[0, 16, 3, 14, 0], [-14, 0, 3, 14, Math.PI / 2], [14, 0, 3, 14, Math.PI / 2], [0, -16, 3, 14, 0]]) {
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(w, l),
      new THREE.MeshStandardMaterial({ map: neonGridTexture({ line: "#ff6ad8", repeat: [2, 8] }), emissive: 0xff6ad8, emissiveIntensity: 0.35, transparent: true, opacity: 0.92 })
    );
    strip.rotation.x = -Math.PI / 2;
    strip.rotation.z = ry;
    strip.position.set(x, kit.groundHeight(x, z) + 0.06, z);
    kit.scene.add(strip);
  }

  // the market ring
  const stalls = [
    ["LANTERNS", "#ffd166", 0], ["DUMPLINGS", "#e2574c", Math.PI / 3], ["TRINKETS", "#4ad8c4", (2 * Math.PI) / 3],
    ["RECORDS", "#c06ad8", Math.PI], ["TEA", "#7bd88f", (4 * Math.PI) / 3], ["SPICES", "#e8855e", (5 * Math.PI) / 3],
  ];
  stalls.forEach(([name, color, a]) => {
    const x = Math.cos(a) * 10, z = Math.sin(a) * 10;
    place(kit, marketStall(name, { stripeA: color }), x, z, -a + Math.PI / 2);
  });
  place(kit, foodCart("NOODLES", { color: 0xc24b3e }), 20, 8, -Math.PI / 2);
  place(kit, foodCart("MOCHI", { color: 0xc06ad8, stripeA: "#c06ad8" }), -20, 8, Math.PI / 2);

  // arcade row — real link to the real games page (the honest pattern)
  for (let i = 0; i < 4; i++) {
    place(kit, arcadeCabinet(["ORBIT", "PIXEL", "TURBO", "GHOST"][i], { color: [0x3a3f6b, 0x6b3a5e, 0x2e5e46, 0x4a3a2c][i], glow: [0x36e6ff, 0xff6ad8, 0x7bd88f, 0xffd166][i] }), -6 + i * 4, -22, 0);
  }
  place(kit, signPost(["THE ARCADE", "real games live at /games"], { accent: "#ff6ad8" }), 8, -22, 0);
  kit.addDoor({ label: "Play the real arcade (/games)", x: 0, z: -22, hw: 8, hd: 2.4, act: { type: "page", path: "/games" } });

  // lit towers behind everything
  tower(kit, { x: -30, z: -34, h: 26, litRatio: 0.7, seed: 71, lit: "#ffb8e8" });
  tower(kit, { x: -6, z: -40, h: 32, litRatio: 0.66, seed: 72, lit: "#bfe2ff" });
  tower(kit, { x: 20, z: -36, h: 24, litRatio: 0.72, seed: 73, lit: "#ffe9a0" });
  tower(kit, { x: 38, z: -24, h: 20, litRatio: 0.6, seed: 74, lit: "#c4ffd8" });

  blimp(kit, { banner: "NEON BAZAAR — OPEN ALL NIGHT", color: 0x4a3a52, path: [[-35, 26, -30], [35, 30, -16], [25, 24, 28], [-30, 28, 20]], speed: 2.6 });

  for (const [x, z] of [[-8, 16], [8, 16], [-16, -8], [16, -8], [0, -12]]) place(kit, streetLamp(kit, { warm: 0xffb8e8 }), x, z);
  for (const [x, z] of [[5, 13], [-5, 13]]) place(kit, planter({ seed: x + 9 }), x, z);
  place(kit, trashBin(), 11, 12);

  place(kit, bigSign(["NEON BAZAAR", "always night here — on purpose"], { accent: "#ff6ad8", w: 7.5 }), 0, 26, Math.PI);
}

// ---- boot (end of file, TDZ-safe) ----
buildBazaar();
kit.start();
