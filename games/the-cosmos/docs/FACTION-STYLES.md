# Faction style sheet (package F0)

Written 2026-10-03. One folder per look: `src/factions/<id>/style.js` (default export, pure data). Run `node tools/gen-registry.mjs` after adding one.
Twelve looks: the nine factions (homeguard, skyward, fortis, technos, ironclad, greenhaven, mystara, wanderhome, corsairs), `unbound`
(Callisto's second seat, Jaron's 12:06 PM decision; the name is Claude's proposal), `mars` (neutral: the port as it already looks) and `alien`
(the alien-looking ship: a look only, no people or signs).

## What a style holds
`palette` (primary, secondary, accent, trim, dark, light, extras), `lights`, `materials` (id, colour, roughness, metalness, where used),
`signs` (font stack, plate / warning / banner colours, emblem, numbering, place names, slogans, graffiti: the comedy lives here),
`uniforms` per role (cloth tint, trim, optional duty helmet), `hair`, `architecture` (massing, roofs, windows, lighting, ground, motifs, props, avoid),
`livery` (hull colours, stripe, shape language, registry prefix, naming, weathering). `_kit/style.js` validates all of it and the registry
refuses a bad style at load (sign lettering must clear contrast 3).

## What to call
```js
import { factionStyle, factionLook, shipLivery, applyLiveryTint, shipMark, signStyle, signText, pickLine, buildingRamp, factionMaterial } from './factions/registry.js';
factionLook('fortis', personNumber, 'guard')   // a look record personRig.applyPersonLook takes (cloth/hair/skin tint, optional helmet)
applyLiveryTint(THREE, ship.exterior.root, ship.matsExt, 'ironclad')   // clones hull, hullDark, hullAccent, hullStripe; shared mats untouched
shipMark('fortis', 7, 'Warden')                // { registry: 'FT-0007', name: 'WARDEN' }
drawSign(ctx, 'technos', 'Fab floor 2', x, y, w, h)   // factions/emblems.js: lettered in the faction's own style
```
Uniforms dye the Loft people's own clothes (a multiply), they do not replace them, so a dark shirt stays dark: pick cloth colours knowing that.
The duty helmet today is the raider's (shell colours fixed in personRig.dutyHelmet); a faction's `helmet.shell/trim` are carried on the look as
`shell` / `helmetTrim` for the builder who generalises it.

## Gallery
`?dev=1&styles=1` (or `styles=<id>`; also `window.cosmos.styles()`) opens the review page. `node test/styles-browser.mjs` photographs it on the iPhone profile.

## Not done (honest)
No meshes: this is the vocabulary, the builders make the things. The alien hull's iridescence (`livery.iridescence`) needs SH17's own material. Lettering
uses system font stacks (a stencil face is Windows/Mac only; iPhone falls back). Hair is a colour tint only: the Loft people keep their sculpted hair.
