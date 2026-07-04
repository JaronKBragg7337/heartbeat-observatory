// WORLDS LAB · Cosmodrome 7 — rockets, UFOs, and a NASA mission theater.
// The rocket launch is a real ride: countdown, rumble, climb, a quiet float in
// the stars, descent. The Mission Theater screens public-domain NASA footage.
// Laws: BUILD below matches ?v= in this folder's index.html, same commit.
// Boot call sits at the very END of the file (TDZ law). Lib v1 is frozen.
import { createWorld } from "../../lib/v1/kit.js";
import { craterField, roadStrip } from "../../lib/v1/layouts.js";
import { place, rock, crateStack, signPost, bigSign, streetLamp, telescope } from "../../lib/v1/props.js";
import { launchPad, rocket, ufo, shuttleDisplay, satelliteDish, moonBuggy } from "../../lib/v1/space.js";
import { cinema, FILMS } from "../../lib/v2/cinema.js";

const BUILD = "2026-07-04-films2"; // bumped with ?v= in index.html on every deploy

const terrain = craterField({ color: "#8a8d96", craters: 11, seed: 4404 });

const kit = createWorld({
  build: BUILD,
  bounds: 115,
  groundHeight: terrain.groundHeight,
  spawn: { x: 0, z: 18, yaw: Math.PI },
  fogDensity: 0.0085,
  palette: {
    // thin-atmosphere palette: even noon stays deep
    skyStops: [[0, "#04060d"], [0.22, "#2a2440"], [0.34, "#1d3550"], [0.66, "#1d3550"], [0.79, "#3a2440"], [0.9, "#04060d"], [1, "#04060d"]],
    sunWarm: "#e8eef8",
    night: "#04060d",
  },
});

function buildCosmodrome() {
  terrain.build(kit.scene);

  roadStrip(kit, 0, 14, 0, -30, 6, false);

  // the launch complex
  launchPad(kit, 0, -36);
  rocket(kit, { x: 0, z: -36, name: "Heartbeat 1", apogee: 130 });

  // sky traffic
  ufo(kit, { path: [[-35, 24, -30], [35, 30, -16], [22, 22, 32], [-30, 28, 22]] });
  ufo(kit, { path: [[40, 36, -45], [-42, 30, -30], [-20, 34, 40], [38, 28, 30]], speed: 9 });

  // museum row
  shuttleDisplay(kit, { x: -18, z: -6, rot: 0.5, name: "ORBITER — museum piece" });
  satelliteDish(kit, 16, -10);
  moonBuggy(kit, -10, 6, 0.8);
  moonBuggy(kit, 14, 4, -2.2);
  place(kit, telescope(), 8, 14);

  // the Mission Theater — real NASA footage, public domain, credited
  cinema(kit, {
    x: 26, z: 16, rot: -0.5,
    name: "STAR DOME",
    films: FILMS.nasa.concat(FILMS.blender.slice(2, 3)), // NASA reel + Tears of Steel backup
    accent: "#9ae8ff",
    brick: "#3a4150",
  });

  for (const [x, z] of [[-30, -22], [32, -28], [-26, 24], [38, 2]]) place(kit, rock({ seed: x - z, color: 0x6f7480 }), x, z);
  place(kit, crateStack({}), 5, -8);
  for (const [x, z] of [[-4, 12], [4, 12], [-4, -22], [4, -22]]) place(kit, streetLamp(kit, { warm: 0xbfe2ff }), x, z);

  place(kit, bigSign(["COSMODROME 7", "launch on the prompt — the stars are close tonight"], { accent: "#9ae8ff", w: 8 }), 0, 24, Math.PI);
  place(kit, signPost(["MISSION THEATER", "real NASA footage — public domain"], { accent: "#9ae8ff" }), 18, 12, -0.5);
}

// ---- boot (end of file, TDZ-safe) ----
buildCosmodrome();
kit.start();
