// WORLDS LAB · Winter Hollow — the cold-world pattern kit, fully dressed.
// Snowfield terrain, snowy pines, cabins, torches, snowmen, a frozen pond.
// Laws: BUILD below matches ?v= in this folder's index.html, same commit.
// Boot call sits at the very END of the file (TDZ law). Lib v1 is frozen.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";
import { createWorld } from "../../lib/v1/kit.js";
import { snowfield, dirtPath } from "../../lib/v1/layouts.js";
import { place, tree, rock, snowman, torch, signPost, bigSign, bench, crateStack, fenceSegment } from "../../lib/v1/props.js";
import { house } from "../../lib/v1/buildings.js";

const BUILD = "2026-06-11-lab1"; // bumped with ?v= in index.html on every deploy

const terrain = snowfield({ amp: 2.6, seed: 6606 });

const kit = createWorld({
  build: BUILD,
  bounds: 100,
  groundHeight: terrain.groundHeight,
  spawn: { x: 0, z: 12, yaw: Math.PI },
  fogDensity: 0.013,
  palette: {
    skyStops: [[0, "#0a1020"], [0.22, "#d8a8b8"], [0.34, "#bcd4e8"], [0.66, "#bcd4e8"], [0.79, "#d890a0"], [0.9, "#0a1020"], [1, "#0a1020"]],
    sunWarm: "#ffe9d8",
  },
});

function buildHollow() {
  terrain.build(kit.scene);

  // the hamlet
  house(kit, { x: -12, z: -8, style: "cabin", name: "EMBER CABIN" });
  house(kit, { x: 2, z: -16, style: "cabin", name: "PINE CABIN" });
  house(kit, { x: 14, z: -4, style: "aframe", name: "DRIFT LODGE" });

  // the frozen pond — shiny, slightly blue, honest about being decorative
  const pondY = terrain.groundHeight(-18, 14);
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(7, 22),
    new THREE.MeshStandardMaterial({ color: 0xa8d4e8, roughness: 0.12, metalness: 0.35 })
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(-18, pondY + 0.12, 14);
  kit.scene.add(pond);
  place(kit, signPost(["THE POND", "frozen solid — skating arrives when it's real"], { accent: "#bfe2ff" }), -10, 18, -0.5);

  // winter woods
  for (const [x, z] of [[-26, -4], [-30, -18], [-22, -28], [22, -22], [30, -8], [26, 10], [-34, 8], [8, -28], [-6, -30], [34, -20], [18, 18], [-28, 24]]) {
    place(kit, tree("snowy", { seed: (x * 5 + z) | 0 }), x, z);
  }
  for (const [x, z] of [[-36, -28], [36, 4], [10, 26]]) place(kit, rock({ seed: x + z, color: 0x9aa4b0 }), x, z);

  // little lives
  place(kit, snowman(), 6, 6);
  place(kit, snowman(), -4, -2, 0.6);
  place(kit, crateStack({}), -14, -12);
  place(kit, bench({ wood: 0x6b4a30 }), 0, 2, Math.PI);
  for (let i = 0; i < 3; i++) place(kit, fenceSegment({ color: 0xc8d2dc }), -8 + i * 3, -20);

  // torch-lit path between the cabins
  dirtPath(kit, [[0, 10], [-6, 2], [-12, -4]]);
  dirtPath(kit, [[0, 10], [4, 0], [2, -12]]);
  dirtPath(kit, [[0, 10], [-12, 16], [-16, 14]]);
  for (const [x, z] of [[-3, 6], [3, 6], [-8, -2], [6, -6], [-14, 10]]) place(kit, torch(kit), x, z);

  place(kit, bigSign(["WINTER HOLLOW", "every prop here is a reusable winter pattern"], { accent: "#bfe2ff", w: 7.5 }), 0, 18, Math.PI);
}

// ---- boot (end of file, TDZ-safe) ----
buildHollow();
kit.start();
