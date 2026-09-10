// WORLDS LAB · tools/generate-pages.mjs
// Stamps each world's index.html from lib/v1/page-template.html.
// Run from anywhere: node worlds-lab/tools/generate-pages.mjs
// DEPLOY LAW: BUILD here must match the BUILD const inside each world's main.js.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const template = readFileSync(join(here, "../lib/v1/page-template.html"), "utf8");

export const BUILD = "2026-06-11-lab1";

export const WORLDS = [
  {
    dir: "worlds", slug: "theme-park", name: "Starlight Park", accent: "#ff6ad8", bg: "#0a0810",
    tagline: "A real amusement park — ride the coaster, the wheel, the carousel, the swings.",
    note: "The Comet coaster, Sky Wheel, carousel and swings are genuinely rideable: walk close and use the prompt. The ride you board is the same one everyone watches.",
    desc: "Starlight Park — a rideable 3D theme park in the Heartbeat Observatory Worlds Lab.",
  },
  {
    dir: "worlds", slug: "railway-valley", name: "Whistle Stop Valley", accent: "#ffd166", bg: "#070a08",
    tagline: "Green hills, two stations, and a steam train you can actually ride.",
    note: "The train runs the valley loop forever — board it at either station, hop off anywhere.",
    desc: "Whistle Stop Valley — a rideable railway world in the Heartbeat Observatory Worlds Lab.",
  },
  {
    dir: "worlds", slug: "skyport", name: "Skyport Mesa", accent: "#7bd8ff", bg: "#0a0906",
    tagline: "A desert airfield — helicopter tours, a balloon hop, a blimp overhead.",
    note: "The helicopter flies a real scripted tour and the balloon makes a tall sightseeing climb. Rotors never stop turning.",
    desc: "Skyport Mesa — helicopters, balloons and blimps in the Heartbeat Observatory Worlds Lab.",
  },
  {
    dir: "worlds", slug: "cosmodrome", name: "Cosmodrome 7", accent: "#9ae8ff", bg: "#05070d",
    tagline: "Launch a rocket to the edge of the sky. UFOs are about.",
    note: "The rocket launch is a full ride — countdown, climb, a quiet float in the stars, descent. The Mission Theater screens true NASA footage (public domain, courtesy NASA).",
    desc: "Cosmodrome 7 — rockets, UFOs and a NASA mission theater in the Worlds Lab.",
  },
  {
    dir: "worlds", slug: "cinema-district", name: "Marquee Row", accent: "#ffd166", bg: "#0c0709",
    tagline: "Three walk-in theaters playing real, legally free films.",
    note: "Blender Hall screens the Blender open movies (CC BY — the credit is posted beside the screen, as the license asks). Midnight Classics runs true public-domain features. Star Dome plays NASA footage. Every reel streams from its original free source and carries its credit.",
    desc: "Marquee Row — walk-in movie theaters with legally free films, in the Worlds Lab.",
  },
  {
    dir: "worlds", slug: "island-resort", name: "Coral Cay", accent: "#4ad8c4", bg: "#051014",
    tagline: "A small island — palms, huts, boats, a lighthouse that turns at dusk.",
    note: "The sailboat patrols the bay on its own, and the lighthouse lamp rides the same wall-clock day/night cycle as the rest of the Observatory.",
    desc: "Coral Cay — an island resort world in the Heartbeat Observatory Worlds Lab.",
  },
  {
    dir: "worlds", slug: "winter-hollow", name: "Winter Hollow", accent: "#bfe2ff", bg: "#060a10",
    tagline: "Snowfields, warm cabins, and a frozen pond under the stars.",
    note: "A complete winter texture-and-prop set: snowy pines, cabins, torches, snowmen — the pattern kit for any future cold world.",
    desc: "Winter Hollow — a snow world in the Heartbeat Observatory Worlds Lab.",
  },
  {
    dir: "worlds", slug: "neon-bazaar", name: "Neon Bazaar", accent: "#ff6ad8", bg: "#0a0512",
    tagline: "A permanent night market under lit towers and a slow blimp.",
    note: "It is always night here on purpose — this world demonstrates a fixed time-of-day palette while every other world shares the live day cycle.",
    desc: "Neon Bazaar — a night market world in the Heartbeat Observatory Worlds Lab.",
  },
  {
    dir: "coming-soon", slug: "underwater-reef", name: "The Reef", accent: "#4ad8c4", bg: "#03141a",
    tagline: "A world below the waterline — kelp forests, swim lanes, a glass tunnel.",
    note: "This is a coming-soon gate: a real plaza, a locked gate, and a preview pedestal. Nothing is behind the gate yet, and the plaque says so plainly.",
    desc: "The Reef — a coming-soon world gate in the Heartbeat Observatory Worlds Lab.",
  },
  {
    dir: "coming-soon", slug: "sky-islands", name: "Sky Islands", accent: "#bfe2ff", bg: "#0a0d18",
    tagline: "Floating gardens linked by rope bridges and balloon ferries.",
    note: "This is a coming-soon gate: a real plaza, a locked gate, and a preview pedestal. Nothing is behind the gate yet, and the plaque says so plainly.",
    desc: "Sky Islands — a coming-soon world gate in the Heartbeat Observatory Worlds Lab.",
  },
  {
    dir: "coming-soon", slug: "mars-colony", name: "Dome Nine", accent: "#ff9a6a", bg: "#120705",
    tagline: "A red-dust settlement — habitat domes, rovers, a far-off observatory.",
    note: "This is a coming-soon gate: a real plaza, a locked gate, and a preview pedestal. Nothing is behind the gate yet, and the plaque says so plainly.",
    desc: "Dome Nine — a coming-soon Mars world gate in the Heartbeat Observatory Worlds Lab.",
  },
  {
    dir: "coming-soon", slug: "haunted-manor", name: "Hollow Manor", accent: "#c8b8e8", bg: "#0a0710",
    tagline: "A dusk estate with a house that watches back. Friendly, and still in development.",
    note: "This is a coming-soon gate: a real plaza, a locked gate, and a preview pedestal. Nothing is behind the gate yet, and the plaque says so plainly.",
    desc: "Hollow Manor — a coming-soon world gate in the Heartbeat Observatory Worlds Lab.",
  },
];

for (const w of WORLDS) {
  const html = template
    .replaceAll("{{NAME}}", w.name)
    .replaceAll("{{TAGLINE}}", w.tagline)
    .replaceAll("{{NOTE}}", w.note)
    .replaceAll("{{ACCENT}}", w.accent)
    .replaceAll("{{BG}}", w.bg)
    .replaceAll("{{DESC}}", w.desc)
    .replaceAll("{{SCRIPT}}", "/worlds-lab/" + w.dir + "/" + w.slug + "/main.js")
    .replaceAll("{{BUILD}}", BUILD);
  const out = join(here, "..", w.dir, w.slug);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "index.html"), html);
  console.log("wrote", w.dir + "/" + w.slug + "/index.html");
}
console.log("BUILD", BUILD, "— remember: each main.js BUILD const must match (deploy law).");
