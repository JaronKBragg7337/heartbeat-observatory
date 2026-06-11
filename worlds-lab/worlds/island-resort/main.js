// WORLDS LAB · Coral Cay — a small island resort.
// Palms, huts, a turning lighthouse, boats on the bay, a boardwalk to the sand.
// Laws: BUILD below matches ?v= in this folder's index.html, same commit.
// Boot call sits at the very END of the file (TDZ law). Lib v1 is frozen.
import { createWorld } from "../../lib/v1/kit.js";
import { island, boardwalk, dirtPath } from "../../lib/v1/layouts.js";
import { place, tree, rock, beachUmbrella, marketStall, signPost, bigSign, torch, bench, coralCluster } from "../../lib/v1/props.js";
import { house, lighthouse } from "../../lib/v1/buildings.js";
import { boat, patrol } from "../../lib/v1/vehicles.js";

const BUILD = "2026-06-11-lab1"; // bumped with ?v= in index.html on every deploy

const terrain = island({ r: 64, amp: 5, seed: 5505 });

const kit = createWorld({
  build: BUILD,
  bounds: 100,
  groundHeight: terrain.groundHeight,
  spawn: { x: 0, z: 8, yaw: Math.PI },
  fogDensity: 0.0095,
  palette: {
    skyStops: [[0, "#0a1830"], [0.22, "#f2b46a"], [0.34, "#8fd0ee"], [0.66, "#8fd0ee"], [0.79, "#f28a5e"], [0.9, "#0a1830"], [1, "#0a1830"]],
  },
});

function buildCay() {
  terrain.build(kit.scene);
  terrain.animateSea(kit);

  // the village
  house(kit, { x: -10, z: -8, style: "hut", name: "SHELL HUT" });
  house(kit, { x: -2, z: -16, style: "hut", name: "TIDE HUT" });
  house(kit, { x: 8, z: -10, style: "hut", name: "PALM HUT" });
  place(kit, marketStall("FRESH JUICE", { stripeA: "#4ad8c4" }), 2, -2, Math.PI);
  lighthouse(kit, { x: 26, z: -34, h: 13 });

  // beach line (south side faces the sea)
  boardwalk(kit, 0, 22, 22, 0);
  for (const [x, z] of [[-8, 30], [-2, 33], [6, 31], [12, 28]]) place(kit, beachUmbrella({ a: ["#e2574c", "#3e7bc2", "#eec643", "#4ad8c4"][(x + z) % 4 < 2 ? 0 : 2] }), x, z);
  for (const [x, z] of [[-14, 26], [16, 24]]) place(kit, rock({ seed: x * z, color: 0xb0a890 }), x, z);

  // palms + green heart
  for (const [x, z] of [[-18, -2], [-22, -14], [14, -20], [22, -6], [-6, -26], [10, 2], [-14, 12], [18, 10], [-26, -24], [30, -18]]) {
    place(kit, tree("palm", { seed: (x * 11 + z) | 0 }), x, z);
  }
  for (const [x, z] of [[-30, -30], [34, -2]]) place(kit, rock({ seed: x + z * 2 }), x, z);

  // night torches along the boardwalk
  for (const [x, z] of [[-3, 20], [3, 20], [-3, 28], [3, 28]]) place(kit, torch(kit), x, z);
  place(kit, bench({}), 0, 16, Math.PI);

  // the bay: a sailboat moored, a motorboat patrolling beyond the shallows
  const moored = boat({ sail: true });
  moored.position.set(12, -0.25, 42);
  moored.rotation.y = 0.6;
  kit.scene.add(moored);
  kit.addUpdate((dt, t) => { moored.position.y = -0.25 + Math.sin(t * 0.9) * 0.08; moored.rotation.z = Math.sin(t * 0.7) * 0.03; });
  patrol(kit, boat({}), [[-30, 0, 55], [30, 0, 48], [55, 0, 10], [40, 0, -45], [-40, 0, -50], [-55, 0, 5]], { speed: 4.2, fixedY: -0.25, bob: true });

  // tide pools (a wink at the coming Reef world)
  place(kit, coralCluster({}), -20, 26);
  place(kit, signPost(["THE REEF", "a whole underwater world — coming soon"], { accent: "#4ad8c4" }), -22, 22, -0.6);
  kit.addDoor({ label: "Visit The Reef gate (coming soon)", x: -22, z: 22, hw: 2.2, hd: 2.2, act: { type: "page", path: "/worlds-lab/coming-soon/underwater-reef/" } });

  place(kit, bigSign(["CORAL CAY", "the lighthouse turns at dusk — stay for it"], { accent: "#4ad8c4", w: 7 }), 0, 12, Math.PI);
  dirtPath(kit, [[0, 8], [0, -2], [-6, -8], [-10, -10]]);
  dirtPath(kit, [[0, -2], [6, -8], [8, -10]]);
}

// ---- boot (end of file, TDZ-safe) ----
buildCay();
kit.start();
