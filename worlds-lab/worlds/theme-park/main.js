// WORLDS LAB · Starlight Park — a fully rideable amusement park.
// Coaster, ferris wheel, carousel, sky swings: all running, all boardable.
// Laws: BUILD below matches ?v= in this folder's index.html, same commit.
// Boot call sits at the very END of the file (TDZ law). Lib v1 is frozen.
import { createWorld } from "../../lib/v1/kit.js";
import { rollingHills, ringPlaza, dirtPath } from "../../lib/v1/layouts.js";
import { place, streetLamp, bench, tree, foodCart, balloonBunch, trashBin, signPost, bigSign, fountain, planter } from "../../lib/v1/props.js";
import { buildCoaster, classicLoop } from "../../lib/v1/coaster.js";
import { ferrisWheel, carousel, swingRide } from "../../lib/v1/rides.js";

const BUILD = "2026-06-11-lab1"; // bumped with ?v= in index.html on every deploy

const terrain = rollingHills({ amp: 3.2, clearRadius: 30, seed: 1101 });

const kit = createWorld({
  build: BUILD,
  bounds: 110,
  groundHeight: terrain.groundHeight,
  spawn: { x: 0, z: 16, yaw: Math.PI },
  fogDensity: 0.0105,
  palette: {
    skyStops: [[0, "#0d0a20"], [0.22, "#f2a45e"], [0.34, "#8fc4ee"], [0.66, "#8fc4ee"], [0.79, "#f2845e"], [0.9, "#0d0a20"], [1, "#0d0a20"]],
  },
});

function buildPark() {
  terrain.build(kit.scene);
  ringPlaza(kit, 0, 0, 17);

  // welcome arch sign
  place(kit, bigSign(["STARLIGHT PARK", "rides are real — walk up and board"], { accent: "#ff6ad8", w: 8 }), 0, 24, Math.PI);

  // the big four
  buildCoaster(kit, classicLoop(kit, 26, 28, 1.0), { name: "the Comet", railColor: 0xff4f9a, cartA: 0xffd166, cartB: 0xff6ad8, laps: 1 });
  ferrisWheel(kit, { x: -30, z: -16, r: 10, name: "the Sky Wheel" });
  carousel(kit, { x: 12, z: -6, r: 4.4, name: "the carousel" });
  swingRide(kit, { x: -12, z: 8, r: 3.6, name: "the sky swings" });

  // midway: carts, benches, lamps, balloons
  const midway = [
    [6, 12], [-6, 12], [10, 4], [-10, 4],
  ];
  place(kit, foodCart("POPCORN", { color: 0xc24b3e }), 6, 13, Math.PI);
  place(kit, foodCart("LEMONADE", { color: 0xe8b53a, stripeA: "#e8b53a" }), -6, 13, Math.PI);
  place(kit, foodCart("COTTON CANDY", { color: 0xc06ad8, stripeA: "#c06ad8" }), 14, 2, -Math.PI / 2);
  place(kit, balloonBunch(kit, {}), 3, 9);
  place(kit, balloonBunch(kit, {}), -8, 2);
  place(kit, fountain(kit, {}), 0, 0);
  for (const [x, z] of [[4, 6], [-4, 6], [7, -2], [-7, -2]]) place(kit, bench({}), x, z, Math.atan2(-x, -z));
  for (const [x, z] of [[10, 10], [-10, 10], [12, -10], [-12, -10], [0, 18], [18, 0], [-18, 0]]) place(kit, streetLamp(kit, {}), x, z);
  for (const [x, z] of [[3, 14], [-3, 14], [16, -4]]) place(kit, trashBin(), x, z);
  for (const [x, z] of [[20, 14], [-22, 10], [-20, -28], [8, -20], [22, -8], [-30, 2]]) place(kit, tree("oak", { seed: x * 3 + z }), x, z);
  place(kit, planter({}), 2, 19);
  place(kit, planter({ seed: 9 }), -2, 19);

  // paths out to the rides
  dirtPath(kit, [[0, 14], [0, 4], [8, -4], [12, -6]]);
  dirtPath(kit, [[0, 4], [-10, 0], [-12, 6]]);
  dirtPath(kit, [[-4, 0], [-22, -10], [-28, -14]]);
  dirtPath(kit, [[6, 2], [20, 14], [26, 22]]);

  // doors to the rest of the Observatory (same door pattern as the live worlds)
  place(kit, signPost(["TOWN SQUARE", "walk through to /engine"], { accent: "#7bd88f" }), 16, 18, Math.PI / 4);
  kit.addDoor({ label: "Town Square (World 1)", x: 16, z: 18, hw: 2, hd: 2, act: { type: "page", path: "/engine" } });
  place(kit, signPost(["WORLDS LAB", "all the new worlds"], { accent: "#ffd166" }), -16, 18, -Math.PI / 4);
  kit.addDoor({ label: "Worlds Lab gallery", x: -16, z: 18, hw: 2, hd: 2, act: { type: "page", path: "/worlds-lab/" } });
}

// ---- boot (end of file, TDZ-safe) ----
buildPark();
kit.start();
