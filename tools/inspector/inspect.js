#!/usr/bin/env node
/* ============================================================================
   tools/inspector/inspect.js — the building inspector, as a command
   ---------------------------------------------------------------------------
       node tools/inspector/inspect.js ashgrove            Ashgrove (world3/town), full checks
       node tools/inspector/inspect.js world2              World 2 city (browser, read-only)
       node tools/inspector/inspect.js townsquare          Town Square /engine/hub/ (browser, read-only)

     --json            print the whole report as JSON instead of the summary
     --check           exit 1 if any building has a problem (ashgrove only)
     --out <dir>       where reports go (default tools/inspector/reports/<world>/)
     --render-dir <d>  ashgrove only: inspect another copy of world3/town/render
                       (how the BEFORE numbers in reports/ashgrove/BEFORE.md were made)
     --no-write        measure and print, write nothing

   What it measures and how: see tools/inspector/README.md.
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");

const argv = process.argv.slice(2);
const VALUED = new Set(["--out", "--render-dir"]);
const positional = argv.filter((a, i) => !a.startsWith("--") && !VALUED.has(argv[i - 1]));
const world = (positional[0] || "ashgrove").toLowerCase();
const flag = (f) => argv.includes(f);
const opt = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const OUT = opt("--out") || path.join(__dirname, "reports", world);

function mdBuilding(b, rules) {
  const L = [];
  L.push(`# ${b.id} ${b.label}`, "");
  L.push(`Type \`${b.key}\`, ${b.levels} storey(s), ${b.roofType} roof, ${b.tris} triangles measured.`, "");
  L.push(b.score.ok ? "**PASS**: nothing measured out of tolerance." : "**PROBLEMS**", "");
  for (const p of b.score.problems) L.push(`- ${p}`);
  L.push("", "## Roof closure", "");
  L.push(`Wall tops at y=${b.roof.topY} m, highest point y=${b.roof.ridgeY} m.`);
  L.push(`Holes seen from the sky: ${b.roof.holes.length ? b.roof.holes.map((h) => `${h.areaM2} m² at (${h.x}, ${h.z})`).join("; ") : "none"}.`);
  L.push(`Gaps seen from the side (sightlines into the roof cavity): ${b.roof.gaps.length ? "" : "none."}`);
  for (const g of b.roof.gaps) L.push(`- ${g.side}: along ${g.along[0]}…${g.along[1]}, y ${g.y[0]}…${g.y[1]} m, ${g.areaM2} m²`);
  L.push("", "## Stairs", "");
  if (!b.stairs.length) L.push("No stairs.");
  for (const s of b.stairs) {
    L.push(`- ${s.id}: ${s.steps} risers × ${s.riseMm} mm, ${s.runMm} mm treads, run ${s.lengthM} m`);
    L.push(`  - landing before the first step: ${s.footLandingM} m${s.footBlockedBy ? ` (then ${s.footBlockedBy})` : ""} — needs ${rules.landingMin} m`);
    L.push(`  - landing past the last step: ${s.topLandingM} m${s.topBlockedBy ? ` (then ${s.topBlockedBy})` : ""} — needs ${rules.landingMin} m`);
    L.push(`  - least headroom over a tread: ${s.minHeadroomM} m — needs ${rules.headroomMin} m`);
  }
  L.push("", "## Doorways", "", "| door | clear floor each side (m) | first thing in the way | verdict |", "|---|---|---|---|");
  for (const d of b.doors) L.push(`| ${d.id}${d.ext ? " (ext)" : ""} | ${d.sides.map((s) => s.clearM).join(" / ")} | ${d.sides.map((s) => s.by || "–").join(" / ")} | ${d.blocked ? "**obstructed**" : "ok"} |`);
  L.push("", "## Rooms (flood-walked with the player's own collision)", "");
  if (b.rooms.error) L.push(`**${b.rooms.error}**`, "");
  L.push("| room | area m² | free floor | status |", "|---|---|---|---|");
  for (const r of b.rooms.rooms) L.push(`| ${r.id} ${r.name} | ${r.areaM2} | ${Math.round(r.freeFloor * 100)}% | ${r.status} |`);
  L.push("", "## Floating / clipping", "");
  if (!b.parts.floating.length && !b.parts.clips.length) L.push("Nothing floating, buried or clipping.");
  for (const f of b.parts.floating) L.push(`- ${f.id}: ${f.msg}`);
  for (const c of b.parts.clips) L.push(`- ${c.what}: ${c.a} ↔ ${c.b}`);
  L.push("");
  return L.join("\n");
}

function mdSummary(r) {
  const L = [`# ${r.world} — building inspector report`, "",
    `Generated ${r.generated} by \`node tools/inspector/inspect.js ${r.world}\`.`, ""];
  const t = (f) => r.buildings.reduce((n, b) => n + f(b), 0);
  L.push("| measure | count |", "|---|---|");
  L.push(`| buildings | ${r.buildings.length} |`);
  L.push(`| buildings with no problem | ${r.buildings.filter((b) => b.score.ok).length} |`);
  L.push(`| roof holes (from the sky) | ${t((b) => b.roof.holes.length)} (${t((b) => b.roof.holeAreaM2).toFixed(2)} m²) |`);
  L.push(`| roof gaps (from the side) | ${t((b) => b.roof.gaps.length)} (${t((b) => b.roof.gapAreaM2).toFixed(2)} m²) |`);
  L.push(`| stairs with no landing at the first step | ${t((b) => b.stairs.filter((s) => s.footLandingM < r.rules.landingMin).length)} of ${t((b) => b.stairs.length)} |`);
  L.push(`| stairs with no landing past the top | ${t((b) => b.stairs.filter((s) => s.topLandingM !== null && s.topLandingM < r.rules.landingMin).length)} |`);
  L.push(`| stairs short of headroom | ${t((b) => b.stairs.filter((s) => s.minHeadroomM !== null && s.minHeadroomM < r.rules.headroomMin).length)} |`);
  L.push(`| doorways obstructed | ${t((b) => b.doors.filter((d) => d.blocked).length)} of ${t((b) => b.doors.length)} |`);
  L.push(`| rooms with no way in | ${t((b) => b.rooms.rooms.filter((x) => x.status === "no way in").length + (b.rooms.error ? 1 : 0))} |`);
  L.push(`| rooms blocked only by furniture | ${t((b) => b.rooms.rooms.filter((x) => x.status === "blocked by furniture").length)} |`);
  L.push(`| rooms cramped (< ${r.rules.freeFloorMin * 100}% walkable floor) | ${t((b) => b.rooms.rooms.filter((x) => x.status === "cramped").length)} |`);
  L.push(`| parts floating / buried | ${t((b) => b.parts.floating.length)} |`);
  L.push(`| clipping pairs | ${t((b) => b.parts.clips.length)} |`);
  L.push("", "## Per building", "", "| building | problems |", "|---|---|");
  for (const b of r.buildings) L.push(`| [${b.id} ${b.label}](${b.id}.md) | ${b.score.ok ? "pass" : b.score.problems.join("; ")} |`);
  L.push("", "Inventory (built / planned / in files but never shown): [INVENTORY.md](INVENTORY.md)", "");
  return L.join("\n");
}

function mdInventory(r) {
  const inv = r.inventory, L = [`# ${r.world} — inventory`, ""];
  L.push("## Built (placed in the founding town)", "", "| type | kind | placed |", "|---|---|---|");
  for (const t of inv.types.filter((t) => t.placed)) L.push(`| ${t.label} (\`${t.key}\`) | ${t.kind} | ${t.placed} |`);
  L.push("", "## Defined in files but never placed (never shown)", "");
  const unplaced = inv.types.filter((t) => !t.placed);
  L.push(unplaced.length ? unplaced.map((t) => `- ${t.label} (\`${t.key}\`, ${t.kind})`).join("\n") : "None: every type in the library is in town.");
  L.push("", "## Files under world3/ that no page or script references", "");
  L.push(inv.neverLoaded.length ? inv.neverLoaded.map((f) => `- \`${f}\``).join("\n") : "None.");
  L.push("", "## Planned (from the docs, not yet built)", "");
  for (const p of inv.planned || []) L.push(`- ${p}`);
  L.push("");
  return L.join("\n");
}

async function main() {
  let r;
  if (world === "ashgrove" || world === "world3") {
    r = require("./ashgrove").inspect({ renderDir: opt("--render-dir") ? path.resolve(opt("--render-dir")) : undefined });
    r.inventory.planned = [
      "Growth buildings B50+ (world/growth.js): demand-driven houses appear as the town ages; only ~4 free lots in the founding plat (docs/STATUS.md)",
      "Multiplayer / one shared saved town (W-23; player is still a module-level singleton)",
      "Outdoor navmesh, persistent interiors, immutable chunk meshes (docs/DECISIONS.md P1–P3)",
      "Real-device checks: watching a building rise, z-fighting (W-21)",
    ];
  } else if (world === "world2" || world === "townsquare" || world === "hub") {
    r = await require("./threejs").inspect(world === "hub" ? "townsquare" : world);
  } else {
    console.error(`unknown world "${world}" — ashgrove | world2 | townsquare`); process.exit(2);
  }
  if (flag("--json")) console.log(JSON.stringify(r, null, 1));
  if (!flag("--no-write")) {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(r, null, 1));
    if (r.buildings && r.buildings[0] && r.buildings[0].roof && r.buildings[0].stairs) {
      fs.writeFileSync(path.join(OUT, "README.md"), mdSummary(r));
      fs.writeFileSync(path.join(OUT, "INVENTORY.md"), mdInventory(r));
      for (const b of r.buildings) fs.writeFileSync(path.join(OUT, `${b.id}.md`), mdBuilding(b, r.rules));
    } else if (r.markdown) {
      fs.writeFileSync(path.join(OUT, "README.md"), r.markdown);
    }
  }
  if (!flag("--json")) {
    if (r.buildings && r.buildings[0] && r.buildings[0].score) {
      const bad = r.buildings.filter((b) => !b.score.ok);
      console.log(`\n  ${r.world}: ${r.buildings.length} buildings, ${r.buildings.length - bad.length} pass\n`);
      for (const b of bad) console.log(`  ${b.id} ${b.label.padEnd(14)} ${b.score.problems.join("; ")}`);
    } else if (r.markdown) console.log(r.markdown);
    if (!flag("--no-write")) console.log(`\n  reports written to ${path.relative(process.cwd(), OUT) || "."}/`);
  }
  if (flag("--check") && r.buildings && r.buildings.some((b) => b.score && !b.score.ok)) process.exit(1);
}
main().catch((e) => { console.error(e.stack || e); process.exit(2); });
