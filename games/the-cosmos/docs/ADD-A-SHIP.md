# How to add a ship

Written 2026-10-03 for package F1. A ship is **data** in its own folder, `src/ships/<type>/`, listed in the generated manifests. You
touch no shared file. The four ships that exist (`meridian`, `raider`, `courier` = Wayfarer, `hauler` = Drayman) are the examples.

## Steps

1. `mkdir src/ships/<type>`. The folder name **is** the ship's `type` string (what a ship record carries, saved with the world).
2. `src/ships/<type>/def.js`: the definition, **default export** (also export it by name if you like). No renderer imports: the server
   loads it. **What a shipyard card prints** (required; the registry refuses a ship without them, naming what is missing):
   `name`, `class`, `role` (`flagship | courier | warship | hauler | miner | explorer | passenger | tender | other`), `blurb` (one line,
   20 to 140 characters), `description` (at least 80 characters, plain words: what it is and what it is for), `stats` (`crewMax`,
   `cargoKg`, `escorts`, optional `priceCredits`, other numbers like `roverBerths` ride along), and `thumbnail` (optional,
   `assets/ships/<type>.webp`; without one the shipyard draws the ship from its `visuals`, as the kiosk's counter models already do).
   The shop reads `shipCatalog()` (every ship) or `shopCards()` (the ones with a price) from `src/ships/registry.js` / `shipyard.js`:
   each card carries those fields plus `specs` worked out from the def (length, width, height, hull mass, gun mounts, seats, rooms), so a
   number is never typed twice. Other fields: `registryId` (`COS-MARS-VEH-00nn`), `order` (where it lists: Meridian 0, Shrike 10,
   Wayfarer 20, Drayman 30; later ships take 40+, default 1000), `layout`, `gear`, `guns`, `phys`, `ramps`, `seats`, `panels`, `avatar`,
   `crewPosts`, `hull`, `roles`, `dock`, `features`, `hudName`, `deckName`, `envelope`, and `stats: { crewMax, cargoKg, escorts,
   priceCredits }`. **A `priceCredits` in `stats` puts the ship on the shipyard kiosk** (`src/ships/shipyard.js` reads it); leave it out
   for a ship that is not for sale. Copy the nearest existing def and change numbers; the interior is built from `layout` by
   `src/ships/layoutKit.js` (see `courier/def.js` for the shortest one).
3. `src/ships/<type>/visuals.js`: **default export** `{ buildExterior(layout, mats, opts), applyNeutralPose(ext), decalTexture(THREE,
   def, name, registry) | () => null, custom, interiorPalette?, shield: { scale: [x,y,z], pos: [x,y,z] } }`. Client only (the server
   never imports it, which is why it is a separate file from `def.js`).
4. `node tools/gen-registry.mjs` (rewrites `src/ships/_manifest.js` and `_visuals-manifest.js`: one line each, union-merged by git).
5. Tests: `test/pkg-<type>.mjs` exporting `run({ check, section, THREE, mars, FIELD, ROOT })`; `validate.mjs` runs every `test/pkg-*.mjs`
   itself. The ship-wide checks (`ship-checks`, `moons-checks`, `fleet-checks`: every def's ramps open outward, every seat is in its
   room and has a place to stand) iterate `allShipDefs()`, so your ship is checked by them with no edit.

6. Publishing: validate, phone-check, restamp from the repo root (`node tools/stamp-cosmos-build.mjs`: the browser's import map lists every module), rebase, push.

## Rules the registry enforces

* `shipDef(type)` throws on an unknown type (a record naming a ship the build lacks is a bug, never a Meridian).
* Folder name = `type` (checked by `test/worlds-checks.mjs`), and every ship folder needs visuals.
* The Meridian is the default type for a ship record without one.

## Not generic yet

* Ship **pads at Marineris Port** are allocated by the server's pad grid (append-only); a ship with a very different footprint may need
  a pad size field (`PADS` in `src/port/portSpec.js`, a shared file: one line).
* Owner-visible names in dialogue and shop text are written per ship (src/economy/dialogue.js, src/port/workerLines.js).
* Vehicles (rovers, trucks) are a different registry: `src/vehicles/` and `server/vehicles.mjs`.
