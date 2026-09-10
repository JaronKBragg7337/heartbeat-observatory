// WORLDS LAB · The Reef — COMING SOON gate.
// Current-state note: a real plaza, a locked gate, a rotating preview — and a plaque
// that says plainly nothing is behind the gate yet. Plug-in ready.
// Laws: BUILD below matches ?v= in this folder's index.html, same commit.
// Boot call sits at the very END of the file (TDZ law). Lib v1 is frozen.
import { createWorld } from "../../lib/v1/kit.js";
import { flatland } from "../../lib/v1/layouts.js";
import { comingSoonWorld } from "../../lib/v1/comingsoon.js";
import { coralCluster } from "../../lib/v1/props.js";
import { sandTexture } from "../../lib/v1/textures.js";

const BUILD = "2026-06-11-lab1"; // bumped with ?v= in index.html on every deploy

const terrain = flatland({ map: sandTexture({ color: "#b8a87c", repeat: [30, 30] }) });

const kit = createWorld({
  build: BUILD,
  bounds: 40,
  groundHeight: terrain.groundHeight,
  spawn: { x: 0, z: 7, yaw: Math.PI },
  fogDensity: 0.02,
  palette: { skyStops: [[0, "#062a36"], [0.34, "#0a4452"], [0.66, "#0a4452"], [1, "#062a36"]], night: "#04212a", sunWarm: "#bfeee8" },
});

function build() {
  terrain.build(kit.scene);
  comingSoonWorld(kit, {
    name: "THE REEF",
    accent: "#4ad8c4",
    blurb: "A world below the waterline - kelp forests, swim lanes, a glass tunnel.",
    hero: () => coralCluster({ seed: 11 }),
    heroScale: 0.85,
  });
}

// ---- boot (end of file, TDZ-safe) ----
build();
kit.start();
