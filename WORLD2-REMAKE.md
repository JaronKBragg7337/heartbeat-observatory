# World 2 remake: the real city

Jaron, 10/18: "make it THE REAL CITY" (Ashgrove is the green town). Picked as the next big build on 11/4.
The tester's notes from 10/28 are the bug list (research/site-tester/2026-10-28-jarons-twin.md in AI-Shared).
WORLD2-PLAN.md (June) still holds the laws this world runs on: multiplayer, claims, the BUILD/?v= stamp, and TDZ.

## Where it stands (Phase 1 shipped 2026-11-05, not pushed yet)

**Not there yet (read first):** shops can't be entered, and **nobody has tested it on a real iPhone**. (Phase 2,
on branch `cloud/world2-phase2`, adds people, buses, city sound and LOD; see "Phase 2 as built".) Everything below was tested
in Playwright on the MSI.

What changed, by the tester's complaints:

| 10/28 complaint | Now |
|---|---|
| Blank for 40 s+ on first load | A loading screen with a real progress bar. Supabase and the people loaders load *after* the city is on screen. The city is built in steps that yield to the page, so the gate page no longer freezes. |
| Identical boxy towers on an empty lawn | A downtown street grid at the centre of the world. Buildings come from a kit: window reveals and sills, storefronts with recessed doors, awnings, sign boards, cornices, parapets, setback towers, water tanks and rooftop units. Five facade families (brick, limestone, mid-century ribbon, glass curtain wall, parking garage) plus hand-placed landmarks. |
| Trees and rocks repeat | The forest and rocks now sit only outside the city and across the river. Street trees vary in size, colour and turn. |
| Plot label tiny and cut off | The eight lots are real gravel lots, each with a big "LOT n · OPEN" board facing the street. Name plates now grow with their text. |
| Double-click to walk | **You walk; you never tap to walk (Jaron 11/5: "I don't want to tap to walk. I want to walk.").** Phone: an invisible floating thumbstick (`/hb-thumbstick.js`, shared with Real City): a thumb on the left half becomes the stick where it lands, follows it, is gone on release; analog speed, push to the rim to run. The right half drags the view; both thumbs work at once. No permanent buttons on screen. Desktop: WASD / arrows, mouse drag looks, Shift runs, Space jumps, E uses a door. A tap or click USES what it touches (a door, its green mat, an open lot); the ground does nothing. Pointer lock is gone, because it swallowed the first click. |
| No minimap or signposts | Street-name blades on every corner, a minimap with your corner ("Calhoun St & Berry St"), and a full map listing every door and lot. Picking one shows the way: a green route on the minimap along the streets, a light column over the place, and a chip with the distance (tap it to clear). It never walks you. |
| Promised doors not found | Every real door has the same glowing green mat, and all are on the map. There are 8 doors: Grand Palace, Arcade and Library (walk-in halls); Social Hall, Projects, WHB News (/news); and Union Station with trains to Town Square (/engine) and to Ashgrove (/world3/gate/). |
| Night too dark | After sunset the sun becomes blue moonlight that still casts shadows. Night also brings a blue sky light, light pools under the lamps, lit shop fronts, lit signs and headlights. The fog is thinner, so the skyline reads. |

Kept: the sky and the 5-minute day/night cycle, lit windows (now per window, with curtains and blinds), lamps,
fireflies (on the courthouse green, the riverfront, the lots and the north woods), MetaHuman avatars for other
players, multiplayer on `world2-town`, doors, plots (the same `claim_repo` RPC with `p_world: "world2"`), the
three interiors, and the gate-page live preview.

**Layout (interpreted, not a map):** Fort Wayne's real downtown street names.
- E-W streets: Superior, Main, Berry, Wayne, Jefferson, Lewis.
- N-S streets: Ewing, Webster, Harrison, Calhoun, Clinton, Barr, Lafayette.
- Blocks are 52 m centre-to-centre, roads 11 m, sidewalks 3.5 m.
- Landmarks: a domed courthouse on its green (Main/Berry x Calhoun/Clinton); the Grand Palace with its marquee and "PALACE" blade (Jefferson & Harrison, Embassy-style); Lincoln-style deco and glass towers; WHB News with a scrolling LED ticker and "ON AIR"; Union Station with a live clock; a promenade along the river and a truss bridge (the Wells St one) into the north woods.
- Jaron can rename anything. The names are one list in world2/city.js, `GRID`.

### Files
- `world2/city.js` is new. It holds the layout, the building kit, street furniture, signals, traffic, the river and the animated signs. Its import in main.js carries its own `?v=`, so **bump it together with BUILD and the main.js `?v=`**.
- `world2/main.js` holds the ground (flat downtown, the river channel, the hills outside), boot with progress, lazy loading, walking (keys + the floating stick), tap-to-use, the map route, night lighting and the `?dev=1` test handle.
- `world2/index.html` holds the loading screen, map, controls text and the phone HUD.
- `world2/gate/index.html` has only a text change.
- URLs and links are unchanged: /world2/, /world2/gate/, ?preview=1, and /space/?plot=N&world=world2.

### Measured (Playwright, MSI, Intel UHD integrated GPU through ANGLE/D3D11; real-iPhone numbers still missing)
| | desktop 1280x800 | phone 390x844 @3x (Chromium) |
|---|---|---|
| Cold first frame (local server, CDN three.js) | 1.6 s | 1.7 s |
| Gate page preview ready | 0.9 s | 1.0 s |
| Draw calls, street at spawn (incl. shadow pass) | 143-147 | 116-120 |
| Draw calls, night aerial | 223 | 155-159 |
| Triangles drawn per frame (incl. shadow pass) | 315k-361k | 341k-349k |
| Frame time median / p95 | 16.6 / 17.8 ms (vsync-locked 60 fps) | 16.6 / 18.1 ms |
| City texture memory (canvas-generated, 0 downloads) | ~17.9 MB | same |

- WebKit at phone size passes every functional check. Its frame time (55 ms) comes from headless WebKit on Windows rendering in software, so it says nothing about Safari on an iPhone.
- The previous World 2 drew 50-58 calls and 161k triangles, but most of its screen was empty lawn.
- Static scene total is about 340k triangles: the kit about 120k, the woods about 100k, cars about 30k, lamps about 40k.

Functional checks, all PASS in Chromium desktop, Chromium phone and WebKit phone:
- one click on "Walk the world" enters;
- one tap/click walks you;
- WASD and drag-look work;
- the minimap opens the full map (21 places) and walking there along the streets arrives on the door mat;
- all 8 doors show their prompt; Arcade walk-in and exit work;
- Lot 1 prompt and claim card;
- the gate preview renders;
- zero console errors by day and by night.

Two clients on the live channel saw each other, and movement arrived at the exact spot. The remaining console
output is D3D shader-compiler warnings from three.js, not errors.

Screenshots: `AI-Shared/scratch/world2-remake/before/` and `.../after/`.

## How every phase is tested
1. `?dev=1` exposes `window.W2`: state, tris breakdown, tap() (= use what is under that screen point), guideTo(), guide, stick, doors, plots, and a camera override.
   `?tod=0.3` freezes daylight and `?tod=0.78` freezes night.
2. Playwright, Chromium (real GPU: `--use-angle=d3d11`) and WebKit, at 390x844 and 1280x800, checks:
   - cold load;
   - console errors by day and by night;
   - walking with the stick (every direction, two thumbs at once) and keys, a tap on the ground NOT moving you, doors in and out by tap, the plot claim card and the map routes (`AI-Shared/scratch/walk-controls/test.cjs`);
   - draw calls, triangles, and median/p95 frame time at fixed street and aerial views;
   - the gate page.
   The scripts used tonight are `test.cjs`, `views.cjs` and `mp.cjs`. **They should move into `tools/playtester`**, which has only ever covered The Cosmos.
3. Two-client multiplayer on the real channel.
4. **Jaron on his iPhone** is the real test. Before calling a phase done: walk spawn → courthouse → theater at night, and check the doors.

## Phone budget (hard limits from here on)
| | Limit | Phase 1 measured |
|---|---|---|
| Draw calls per frame (incl. shadows) | ≤ 250 street, ≤ 300 aerial | 116-223 |
| Triangles per frame (incl. shadows) | ≤ 400k mobile-high, ≤ 200k mobile-lite (no shadows) | ~350k |
| Texture memory | ≤ 40 MB total (WORLD2-PLAN) | ~18 MB city + ~4 MB ground/foliage |
| Per-frame JS | no allocations in the loop; ≤ 2 ms | traffic + signals ≈ 0.1 ms |

Each later phase states what it spends. If a phase needs more, it pays first: LOD for far chunks, KTX2 textures, or
fewer cast shadows.

## The phases

### Phase 1: the real downtown (DONE tonight, see above)

### Phase 2: street life + the performance floor (cloud build 2026-11-05, PR `cloud/world2-phase2`; see "Phase 2 as built" below)
- **People on the sidewalks:**
  - Far away: an instanced crowd of simple animated figures (vertex-animated walk cycle, 1 draw call per outfit set).
  - Near the player: 6-10 MetaHumans from the Loft roster, swapped in within ~25 m.
  - They walk the sidewalks, wait at crosswalks on red, and sit on benches.
- **City sound:** traffic hum by distance to roads, crosswalk chirps, birds by day, crickets by night, river water. One WebAudio graph, started on the first tap.
- **Cars:**
  - full signal obedience everywhere, and no overlap where loops merge;
  - a bus line with stops;
  - more models (pickup, van, delivery truck).
- **Performance floor:**
  - far-chunk LOD (each chunk gets a pre-merged low version without reveals or sills beyond ~120 m);
  - KTX2/Basis textures;
  - only walls cast shadows.
- Budget: +60 calls at most, +80k triangles, +6 MB. Test: crowd density versus frame time on the phone; no NPC inside a wall or road after 10 minutes.

#### Phase 2 as built (cloud, 2026-11-05 night; PR `cloud/world2-phase2`, not merged: check on a phone first)
New file `world2/life.js` (the crowd + the city sound); `city.js` got the bus, the LOD index split, pedestrian yielding
and fewer shadow casters; `main.js` wires them in; `index.html` has the Sound button. Stamp: `2026-11-05-phase2` on
BUILD, the main.js `?v=`, and the `city.js?v=` / `life.js?v=` imports (life.js imports city.js with the **same** `?v=`,
or the browser loads city.js twice).

- **People.** One shared human figure (tapered thighs and shins, shoes, hips, a lathe-shaped torso, upper arms and
  forearms, hands, neck, head with a nose, hair; optional long hair, coat or skirt) whose walk runs in the vertex shader:
  hip swing, knee fold in the swing phase, counter-swinging arms, body bob and sway. The shadow pass walks too
  (custom depth material). Outfits are per-instance colours (8 skin tones, 9 hair, 14 tops, 9 bottoms, sleeves).
  - 2 draw calls (+1 shadow): a near mesh inside 38 m (1,106 triangles each, casts shadows) and a far mesh to 175 m
    (447 triangles, no shadows). People outside the view frustum are not drawn.
  - 150 people on desktop, 96 on phones, 60 on the lite tier. The crowd stays near you: anyone over 92 m from the
    camera steps back in at a corner 22-85 m away, out of view when possible, so the streets around you hold someone
    every ~13 m (desktop) and nobody pops in on screen. A teleport (map walk, door) refills the streets at once.
  - They walk a graph of block corners at 7.4 m (±0.12) from the street centre lines, which is between the lamp/tree line
    and the benches. They cross only on the painted crosswalks, wait on red at signalled corners (the walk light is the
    parallel traffic light), look both ways for 0.6-2.2 s at unsignalled ones, and walk 1.1-1.5 m/s.
  - **Cars and buses yield to anyone on a crosswalk** (`city.crossers`).
  - Not done: MetaHumans swapped in near the player, and sitting on benches (see "left for later").
- **Buses.** The Downtown Loop: two 12 m buses on a two-block loop (Harrison-Clinton x Jefferson-Lewis) whose Jefferson
  edge runs past Union Station. They pull up at the station's stop (a glass shelter with a bench and a BUS · LOOP 1 blade),
  wait 9 s, and go. They obey the signals, keep their 12 m length clear of cars, and parked cars are cleared from the stop.
- **Sound.** One WebAudio graph, created on the first tap/click/key after you enter (the "Walk the world" click counts),
  never in the gate preview. Quiet by default (master 0.32). There is a 🔊 Sound / 🔇 Sound off button under the minimap,
  and the choice is remembered (`localStorage w2-sound`). Layers: a traffic hum by distance to the nearest street plus
  nearby moving cars, the river near the promenade, your footsteps (one per ~0.7 m on the ground), birds by day, crickets
  after dark, and crosswalk signals (a locator tick near a signalled corner, a chirp burst when a light turns green).
  Night halves the city layers. All synthesized: 0 bytes downloaded.
- **Performance floor.**
  - Far-chunk LOD without extra draw calls: detail pieces (sills, lintels, mullions, storefront mullions and transom bars, door
    recess sides, cornice under-bands, rooftop units, tanks) go to the end of each chunk batch's index buffer. Beyond 95 m
    (camera to the chunk box) the mesh draws only its main range (`city.lodUpdate`, 4x a second).
  - Small `metal` and `dark` kit batches no longer cast shadows (lamp posts, trees, walls, glass and cars still do).
  - **KTX2 was not done, on purpose:** every city texture is drawn on a canvas at load (0 bytes downloaded). KTX2 would
    mean shipping ~4-5 MB of files plus a ~250 KB Basis transcoder to save GPU memory we are well under budget on (~18 MB
    of 40). Do it with Phase 6, when the baked textures arrive as files anyway.

Measured (cloud container: Playwright, Chromium with SwiftShader software GL and WebKit, no GPU). Frame times from
software GL say nothing about a phone, so only draw calls and triangles are comparable with the MSI numbers above:

Both builds were run in the same container, in the same session (`fast.cjs`), with the crowd and buses on in "after".
Calls and triangles include the shadow pass. Street view = the spawn on Berry St; aerial = over the south-west.

| | Phase 1 (before) | Phase 2 (after: +crowd, +2 buses, +shelter, LOD, fewer casters) |
|---|---|---|
| Phone 390x844, street, day / night | 111 / 113 calls, 341k tris | 112 / 114 calls, 339k tris |
| Phone 390x844, aerial, day / night | 152 / 154 calls, 352k tris | 156 / 158 calls, 352-354k tris |
| Desktop 1280x800, street, day / night | 130 / 132 calls, 342k tris | 132 / 134 calls, 351-353k tris |
| Desktop 1280x800, aerial, day / night | 215 / 217 calls, 361k tris | 219 / 221 calls, 353k / 386k tris |
| City texture memory | 17.9 MB | 17.9 MB (the crowd, bus and sound add 0 textures and 0 downloads) |
| Cold first frame (software GL, noisy) | 5.8-11.5 s | 9.2-12.8 s |

- What Phase 2 spent: +1 to +4 draw calls, and between -2k and +25k triangles. The budget allowed +60 calls and +80k triangles.
- The LOD and the dropped shadow casters paid for most of the new crowd and buses.
- The highest number is the desktop night aerial at 386k triangles. That is under the 400k mobile-high limit, but phones there get 60-96 people, not 150.
- Software-GL frame times (12-290 ms) jump around with container load and say nothing about a GPU, so they are left out. The MSI and iPhone numbers are still owed.

Checks, all PASS (Chromium 1280x800 by day, Chromium 390x844 at night). **WebKit could not run in the cloud container (its download is blocked), so run `func.cjs webkit 390 844 0.78` on the MSI.**
- one click enters, one tap walks;
- all 8 doors show their prompt; the Arcade walk-in works; Lot 1 shows its prompt;
- the minimap opens the full map (21 places);
- the Sound button toggles and remembers; sound runs only after a gesture;
- the gate preview (`?preview=1`) loads;
- zero console errors;
- **crowd audit:** 600 s fast-forwarded with the signals cycling, nobody in the street off a crosswalk, and nobody inside a
  building, lamp, tree, bench or the shelter (`W2.life.simulate(600)` returns `[]`);
- **bus audit:** 240 s fast-forwarded, both buses stop at Union Station 4-5 times each, within 1 cm of the stop, and all
  16 cars keep moving (no gridlock).

Test handles (`?dev=1`): `W2.life.stats()` (crowd near/far/waiting/crossing, LOD, buses, sound levels), `W2.life.simulate(s)`,
`W2.life.crowd`, `W2.life.sound`, `W2.life.bus()`. Scripts used: `func.cjs`, `measure.cjs`, `views.cjs`, `close.cjs` (in
`AI-Shared/scratch/world2-remake/phase2/scripts/`; they route three.js from a local copy because the cloud can't reach jsdelivr).

Left for later (Phase 2b): MetaHumans near the player (desktop only; +5-6 MB and ~6 calls each), people sitting on benches
and standing at shop windows, more car models (pickup, van, delivery truck), and **Jaron's iPhone check**.

### Phase 3: shops and jobs (things to DO)
- **Shops:**
  - one shared shop-interior kit (counter, shelves, register, back room), dressed per shop from data;
  - each storefront door becomes enterable;
  - shop data lives in a table (the WORLD2-PLAN phase 7 `world_props` idea), so AIs and Jaron add shops without code.
- **Jobs:** short timed tasks with a visible ledger, e.g. newsstand seller, bike courier between doors, barista at Calhoun Coffee, usher at the Grand Palace.
- **Policy check (flag):** the business policy says Heartbeat Observatory doesn't sell food, water or land. Any in-world shop that touches real money must respect that. Food shops stay atmosphere or play-money only.
- Budget: interiors load on entry (one at a time, ≤ 30 calls, ≤ 60k triangles). Test: enter and leave every shop; a job loop completes on the phone.

### Phase 4: the theater and the WHB News studio
- **Grand Palace:**
  - a real auditorium (balcony, proscenium, house lights);
  - synced screenings, so everyone in the room sees the same frame (server clock + `video.currentTime` correction);
  - the existing free-film list.
- **WHB News studio (Vex and Joe):**
  - the anchor desk, cameras, an ON AIR light that is truly on when the daily show is live, and today's episode on the studio monitors;
  - a guest seat;
  - the ticker on the facade reads real headlines from the news pipeline.
- **Better done pre-rendered:** Vex and Joe themselves. Use the Unreal/MetaHuman news renders as video textures on the set, not live 3D anchors. A live skinned MetaHuman pair would cost more than the whole city does now.
- Budget: the studio interior ≤ 40 calls; one video texture at a time. Test: video plays on iPhone Safari (muted autoplay, sound on tap).

### Phase 5: the riverfront and the trains
- North woods park: paths, boats on the river, a fishing pier, the fireflies' home. The river already exists; this phase dresses it.
- Union Station platforms with a train you board. The ride is a short pre-rendered or on-rails sequence that lands you in Town Square or Ashgrove: one universe, three places. A subway under Calhoun is optional (a single line, two stations, and the same trick).
- Budget: platform ≤ 25 calls; the train ride is one mesh plus a cutscene. Test: the round trip World 2 → Ashgrove → World 2 keeps your identity.

### Phase 6: the baked look (Blender), where live geometry can't win
- The browser can't do global illumination, soft ambient occlusion or real glass reflections at phone speed. Blender can bake them.
- Hero landmarks as GLB with baked lightmaps and AO: the courthouse (true Beaux-Arts detail), the Grand Palace facade and lobby, Union Station, and the bridge. Each ≤ 25k triangles, KTX2, about 1-2 MB.
- Facade materials: baked normal + AO tiles for brick, stone and trim.
- A pre-rendered skyline backdrop for the far horizon.
- Same draw calls; the hero GLBs add about 3-6 MB of download. **This is where "real" stops being "nice for a browser" and becomes real.** Do it after Phase 2's performance floor.

### Phase 7: the resident city
- Claimed lots grow with their project: floors added by commit history, the sign from the repo.
- WORLD2-PLAN phase 7 Build Mode: place props (benches, trees, signs) as data, with publish/version.
- More lots open as residents arrive. Agent minds roam the city (the gate page already promises "World 2 is on their map next").

## Honest limits
- Phone browsers handle about 300-400k triangles with one shadowed light at 60 fps on a recent iPhone. That is untested here; the MSI's integrated GPU is the stand-in.
- Live people are the most expensive thing in this world: about 2-3 MB GLB each, plus skinning. Crowds must be instanced at a distance.
- Everything procedural (canvas textures, kit geometry) is free to download and change, but it will always look clean. Grime, wear and real detail come from Phase 6 bakes, or from photo-sourced CC0 textures under `/world2/tex/` (credited).
