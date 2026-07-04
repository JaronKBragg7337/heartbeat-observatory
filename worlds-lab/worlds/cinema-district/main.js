// WORLDS LAB · Marquee Row — three walk-in theaters, all playing REAL film.
//   Blender Hall    — the Blender open movies (CC BY; credit posted by the screen)
//   Midnight Classics — true public-domain features (Internet Archive)
//   Star Dome       — NASA footage (public domain, courtesy NASA)
// Every reel streams from its original free source. Nothing re-hosted. If a reel
// fails, the screen says so honestly and tries the next — never a fake.
// Laws: BUILD below matches ?v= in this folder's index.html, same commit.
// Boot call sits at the very END of the file (TDZ law). Lib v1 is frozen.
import { createWorld } from "../../lib/v1/kit.js";
import { flatland, roadStrip, ringPlaza } from "../../lib/v1/layouts.js";
import { place, streetLamp, bench, foodCart, trashBin, signPost, bigSign, planter, balloonBunch } from "../../lib/v1/props.js";
import { cinema, FILMS } from "../../lib/v2/cinema.js";
import { tower } from "../../lib/v1/buildings.js";
import { taxi, patrol } from "../../lib/v1/vehicles.js";
import { paverTexture } from "../../lib/v1/textures.js";

const BUILD = "2026-07-04-films2"; // bumped with ?v= in index.html on every deploy

const terrain = flatland({ map: paverTexture({ color: "#5e5a64", repeat: [40, 40] }) });

const kit = createWorld({
  build: BUILD,
  bounds: 95,
  groundHeight: terrain.groundHeight,
  spawn: { x: 0, z: 22, yaw: Math.PI },
  timeOfDay: 0.84, // Marquee Row lives at dusk — the marquees glow on purpose
  fogDensity: 0.0125,
  palette: { skyStops: [[0, "#241430"], [1, "#241430"]], night: "#241430" },
});

function buildRow() {
  terrain.build(kit.scene);
  ringPlaza(kit, 0, 4, 12);
  roadStrip(kit, -36, -16, 36, -16, 5);

  // ---- the three houses of Marquee Row ----
  cinema(kit, { x: -24, z: -6, name: "BLENDER HALL", films: FILMS.blender, accent: "#ffd166", brick: "#6b4a52" });
  cinema(kit, { x: 0, z: -10, name: "MIDNIGHT CLASSICS", films: FILMS.classics, accent: "#c8b8e8", brick: "#4a3a52" });
  cinema(kit, { x: 24, z: -6, name: "STAR DOME", films: FILMS.nasa.concat(FILMS.blender.slice(2, 3)), accent: "#9ae8ff", brick: "#3a4150" });

  // backdrop skyline
  tower(kit, { x: -38, z: -34, h: 22, seed: 61 });
  tower(kit, { x: -14, z: -38, h: 28, seed: 62, litRatio: 0.55 });
  tower(kit, { x: 12, z: -40, h: 24, seed: 63 });
  tower(kit, { x: 36, z: -34, h: 18, seed: 64, litRatio: 0.5 });

  // street life
  place(kit, foodCart("POPCORN", { color: 0xc24b3e }), -8, 8, Math.PI);
  place(kit, foodCart("CHURROS", { color: 0xe8b53a, stripeA: "#e8b53a" }), 8, 8, Math.PI);
  place(kit, balloonBunch(kit, {}), 12, 6);
  for (const [x, z] of [[-4, 2], [4, 2], [-12, 0], [12, 0]]) place(kit, bench({}), x, z, Math.atan2(-x, -(z + 6)));
  for (const [x, z] of [[-16, 8], [16, 8], [-30, 2], [30, 2], [0, 16], [-8, -14], [8, -14]]) place(kit, streetLamp(kit, {}), x, z);
  for (const [x, z] of [[-6, 10], [6, 10]]) place(kit, trashBin(), x, z);
  place(kit, planter({}), 0, 10);
  patrol(kit, taxi({}), [[-34, 0, -16], [34, 0, -16], [34, 0, -22], [-34, 0, -22]], { speed: 6 });

  place(kit, bigSign(["MARQUEE ROW", "three theaters · every reel legally free · credits on the wall"], { accent: "#ffd166", w: 9 }), 0, 28, Math.PI);
  place(kit, signPost(["TOWN SQUARE", "back to World 1"], { accent: "#7bd88f" }), 18, 20, Math.PI / 4);
  kit.addDoor({ label: "Town Square (World 1)", x: 18, z: 20, hw: 2, hd: 2, act: { type: "page", path: "/engine" } });
  place(kit, signPost(["THE FLAT THEATER PAGE", "/video — for people who skip 3D"], { accent: "#c8b8e8" }), -18, 20, -Math.PI / 4);
  kit.addDoor({ label: "Theater page (/video)", x: -18, z: 20, hw: 2, hd: 2, act: { type: "page", path: "/video" } });
}

// ---- boot (end of file, TDZ-safe) ----
buildRow();
kit.start();
