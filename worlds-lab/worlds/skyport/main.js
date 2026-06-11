// WORLDS LAB · Skyport Mesa — a desert airfield with real flights.
// Helicopter tour (take off, circuit, land), balloon sightseeing hop, patrol blimp.
// Laws: BUILD below matches ?v= in this folder's index.html, same commit.
// Boot call sits at the very END of the file (TDZ law). Lib v1 is frozen.
import { createWorld } from "../../lib/v1/kit.js";
import { dunes, roadStrip } from "../../lib/v1/layouts.js";
import { place, cactus, rock, crateStack, barrel, signPost, bigSign, streetLamp } from "../../lib/v1/props.js";
import { helipad, helicopter, hotAirBalloon, blimp } from "../../lib/v1/aircraft.js";
import { controlTower, shop } from "../../lib/v1/buildings.js";
import { truck, golfCart, patrol } from "../../lib/v1/vehicles.js";

const BUILD = "2026-06-11-lab1"; // bumped with ?v= in index.html on every deploy

const terrain = dunes({ amp: 2.2, seed: 3303 });

const kit = createWorld({
  build: BUILD,
  bounds: 110,
  groundHeight: terrain.groundHeight,
  spawn: { x: 0, z: 14, yaw: Math.PI },
  fogDensity: 0.009,
  palette: {
    skyStops: [[0, "#120d20"], [0.22, "#f2a45e"], [0.34, "#a8cfe8"], [0.66, "#a8cfe8"], [0.79, "#f2845e"], [0.9, "#120d20"], [1, "#120d20"]],
    sunWarm: "#ffe9c4",
  },
});

function buildSkyport() {
  terrain.build(kit.scene);

  // the apron: a paved strip and two pads
  roadStrip(kit, 0, 8, 0, -34, 7, false);
  helipad(kit, -10, -12);
  helipad(kit, 12, -20);

  // flights
  helicopter(kit, { x: -10, z: -12, name: "the mesa tour", color: 0xc24b3e });
  hotAirBalloon(kit, { x: 12, z: -20, name: "the lookout balloon", height: 30 });
  blimp(kit, { banner: "HEARTBEAT OBSERVATORY — BUILT IN THE OPEN", path: [[-40, 30, -50], [45, 36, -25], [35, 30, 35], [-45, 34, 20]] });

  // ground crew
  controlTower(kit, { x: 14, z: 2 });
  shop(kit, { x: -14, z: 6, name: "TERMINAL ONE", awningColor: 0x3e7bc2, door: { label: "Terminal — Worlds Lab gallery", act: { type: "page", path: "/worlds-lab/" } } });
  place(kit, truck({}), 6, -2, 0.6);
  patrol(kit, golfCart({}), [[4, 0, 10], [16, 0, 8], [18, 0, -6], [6, 0, -8]], { speed: 3.2 });
  for (const [x, z] of [[-6, -4], [8, 10]]) place(kit, crateStack({ seed: x + z }), x, z);
  for (const [x, z] of [[-8, -6], [9, 12]]) place(kit, barrel(), x, z);

  // desert dressing
  for (const [x, z] of [[-26, -8], [-32, 14], [28, -32], [36, 8], [-20, -36], [24, 26], [-38, -24]]) place(kit, cactus({}), x, z);
  for (const [x, z] of [[-22, 20], [30, -12], [-34, -34], [40, 24]]) place(kit, rock({ seed: x * 3 + z, color: 0xa8825e }), x, z);
  for (const [x, z] of [[-4, 8], [4, 8], [-4, -28], [4, -28]]) place(kit, streetLamp(kit, {}), x, z);

  place(kit, bigSign(["SKYPORT MESA", "tours fly on the prompt — phone or computer"], { accent: "#7bd8ff", w: 7 }), 0, 20, Math.PI);
  place(kit, signPost(["FLIGHT LINE", "helicopter west — balloon east"], { accent: "#7bd8ff" }), 0, -4, Math.PI);
}

// ---- boot (end of file, TDZ-safe) ----
buildSkyport();
kit.start();
