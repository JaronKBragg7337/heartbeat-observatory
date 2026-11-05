# World 2 remake: the real city

Jaron, 10/18: "make it THE REAL CITY" (Ashgrove is the green town). Picked as the next big build on 11/4.
The tester's notes from 10/28 are the bug list (research/site-tester/2026-10-28-jarons-twin.md in AI-Shared).
WORLD2-PLAN.md (June) still holds the laws this world runs on: multiplayer, claims, the BUILD/?v= stamp, and TDZ.

## Where it stands (Phase 1 shipped 2026-11-05, not pushed yet)

**Not there yet (read first):** no people walk the streets yet, there is no city sound, shops can't be entered,
there is no level-of-detail system, and **nobody has tested it on a real iPhone**. Everything below was tested
in Playwright on the MSI.

What changed, by the tester's complaints:

| 10/28 complaint | Now |
|---|---|
| Blank for 40 s+ on first load | A loading screen with a real progress bar. Supabase and the people loaders load *after* the city is on screen. The city is built in steps that yield to the page, so the gate page no longer freezes. |
| Identical boxy towers on an empty lawn | A downtown street grid at the centre of the world. Buildings come from a kit: window reveals and sills, storefronts with recessed doors, awnings, sign boards, cornices, parapets, setback towers, water tanks and rooftop units. Five facade families (brick, limestone, mid-century ribbon, glass curtain wall, parking garage) plus hand-placed landmarks. |
| Trees and rocks repeat | The forest and rocks now sit only outside the city and across the river. Street trees vary in size, colour and turn. |
| Plot label tiny and cut off | The eight lots are real gravel lots, each with a big "LOT n · OPEN" board facing the street. Name plates now grow with their text. |
| Double-click to walk | One tap or click on the street walks you there. A tap on a building takes you to its face, or onto the door mat if a door is near. Drag looks around. Pointer lock is gone, because it swallowed the first click. |
| No minimap or signposts | Street-name blades on every corner, a minimap with your corner ("Calhoun St & Berry St"), and a full map listing every door and lot that walks you there along the streets. |
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
- `world2/main.js` holds the ground (flat downtown, the river channel, the hills outside), boot with progress, lazy loading, tap-to-walk, the map, night lighting and the `?dev=1` test handle.
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
1. `?dev=1` exposes `window.W2`: state, tris breakdown, tap(), walkTo(), doors, plots, and a camera override.
   `?tod=0.3` freezes daylight and `?tod=0.78` freezes night.
2. Playwright, Chromium (real GPU: `--use-angle=d3d11`) and WebKit, at 390x844 and 1280x800, checks:
   - cold load;
   - console errors by day and by night;
   - one-tap walking, doors in and out, the plot claim card and the map routes;
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

### Phase 2: street life + the performance floor
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
