// WORLDS LAB · Whistle Stop Valley — a railway you can ride.
// A steam train loops the valley between two stations; board at either one.
// Laws: BUILD below matches ?v= in this folder's index.html, same commit.
// Boot call sits at the very END of the file (TDZ law). Lib v1 is frozen.
import { createWorld } from "../../lib/v1/kit.js";
import { rollingHills, dirtPath } from "../../lib/v1/layouts.js";
import { place, tree, rock, bench, streetLamp, signPost, fenceSegment, picnicTable } from "../../lib/v1/props.js";
import { makeCurve, buildTrack, station, train, crossingSign } from "../../lib/v1/rails.js";
import { house, barn } from "../../lib/v1/buildings.js";

const BUILD = "2026-06-11-lab1"; // bumped with ?v= in index.html on every deploy

const terrain = rollingHills({ amp: 4.2, clearRadius: 20, seed: 2202, grass: "#5a9148" });

const kit = createWorld({
  build: BUILD,
  bounds: 115,
  groundHeight: terrain.groundHeight,
  spawn: { x: 0, z: 10, yaw: Math.PI },
  fogDensity: 0.0098,
});

function railPoint(x, z, lift) {
  // track rides the terrain with a constant clearance — honest hills, no tunnels
  return [x, terrain.groundHeight(x, z) + (lift || 0.45), z];
}

function buildValley() {
  terrain.build(kit.scene);

  // ---- the line: a big loop around the valley ----
  const pts = [
    railPoint(8, -2), railPoint(30, -10), railPoint(46, -30), railPoint(40, -52),
    railPoint(14, -60), railPoint(-16, -56), railPoint(-38, -40), railPoint(-44, -16),
    railPoint(-34, 6), railPoint(-12, 12),
  ];
  const curve = makeCurve(pts, true);
  buildTrack(kit, curve, { closed: true });
  const line = train(kit, curve, { cars: 3, speed: 6, color: 0x2e5e46 });

  // ---- stations (both sell the same ride: one full loop in the cab) ----
  station(kit, { x: 8, z: 2.6, name: "VALLEY CENTRAL", rot: 0 });
  kit.addDoor({ label: "Board the valley train", x: 8, z: -0.4, hw: 3.4, hd: 2.6, act: { type: "ride", ride: line.makeRide({ x: 8, z: 2.0 }, "the valley train") } });

  station(kit, { x: -16, z: -51.4, name: "FAR MEADOW", rot: Math.PI });
  kit.addDoor({ label: "Board the valley train", x: -16, z: -54.4, hw: 3.4, hd: 2.6, act: { type: "ride", ride: line.makeRide({ x: -16, z: -50.8 }, "the valley train") } });

  crossingSign(kit, -10, 13.4);

  // ---- the valley itself ----
  house(kit, { x: -8, z: 24, style: "cottage", door: { label: "Cottage porch — back outside", act: { type: "page", path: "/worlds-lab/" } }, name: "STATION HOUSE" });
  barn(kit, { x: 24, z: 18, rot: Math.PI / 2 });
  for (const [x, z, k] of [[18, 6, "oak"], [-24, 2, "oak"], [-30, -8, "pine"], [34, -16, "pine"], [50, -42, "pine"], [26, -44, "oak"], [-2, -40, "oak"], [-28, -28, "pine"], [12, -24, "oak"], [-44, 0, "pine"], [16, 26, "oak"], [-20, 18, "pine"]]) {
    place(kit, tree(k, { seed: (x * 7 + z) | 0, autumn: (x + z) % 5 === 0 }), x, z);
  }
  for (const [x, z] of [[40, -8], [-40, -30], [4, -52], [52, -28]]) place(kit, rock({ seed: x + z }), x, z);
  place(kit, picnicTable({}), 14, 12);
  place(kit, bench({}), 4, 4, 0);
  place(kit, bench({}), 12, 4, 0);
  for (const [x, z] of [[6, 8], [10, 8], [-14, -48], [-18, -48]]) place(kit, streetLamp(kit, {}), x, z);
  for (let i = 0; i < 4; i++) place(kit, fenceSegment({}), -2 + i * 3, 20);
  place(kit, signPost(["WHISTLE STOP VALLEY", "the train loops forever — hop on"], { accent: "#ffd166" }), 4, 12, Math.PI);

  dirtPath(kit, [[0, 10], [6, 4], [8, 2]]);
  dirtPath(kit, [[0, 10], [-6, 18], [-8, 22]]);
}

// ---- boot (end of file, TDZ-safe) ----
buildValley();
kit.start();
