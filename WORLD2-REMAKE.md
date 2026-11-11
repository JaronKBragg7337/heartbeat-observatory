# World 2 remake: the real city

Jaron, 10/18: "make it THE REAL CITY" (Ashgrove is the green town). Picked as the next big build on 11/4.
The tester's notes from 10/28 are the bug list (research/site-tester/2026-10-28-jarons-twin.md in AI-Shared).
WORLD2-PLAN.md (June) still holds the laws this world runs on: multiplayer, claims, the BUILD/?v= stamp, and TDZ.

## Where it stands (Phase 1 live 2026-11-05 12:15 AM; Phase 2 live 11:22 AM)

**Not there yet (read first):** **nobody has tested it on a real iPhone**. (Phase 2 added people, buses, city sound
and LOD; see "Phase 2 as built". Phase 3, on branch `fable52/world2-phase3` and not merged yet, makes every shop enterable
and adds four jobs and a play-money ledger; see "Phase 3 as built".) Everything below was tested in Playwright on the MSI.

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
- Phase 3 adds `world2/shops.json` (the shop and job table: the one file to edit to add a shop), `world2/shops.js` (the
  shop-interior kit), `world2/jobs.js` (the jobs, the ledger and their HUD) and `world2/SHOPS.md` (how to add a shop, a kind or a job).
  **The stamp now lives in seven places, all bumped together:** `BUILD` and the four `?v=` imports in main.js (city, life,
  shops, jobs), the `city.js?v=` import in life.js, and `main.js?v=` in index.html. `shops.json` is fetched with `?v=BUILD`.
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

#### Phase 3 as built (Fable 5.2, 2026-11-11; branch `fable52/world2-phase3`, not merged: check on a phone first)
Stamp `2026-11-11-phase3`. New files: `world2/shops.json`, `world2/shops.js`, `world2/jobs.js`, `world2/SHOPS.md`.

- **The shop table.** `world2/shops.json` holds 64 shops, 40 kinds and 4 jobs. A new row gets a storefront, a sign and an
  interior with no code (`world2/SHOPS.md` is the how-to). The city used to pick a sign at random for each building; now
  every storefront is recorded as it is built and the names are dealt out afterwards: rows that ask for a street first
  (Calhoun Coffee is on the corner of Calhoun and Berry, Wells St Bikes on Superior by the bridge), then one storefront per
  row, then second locations as far from the first as the city allows. Result: **114 shops, 5 empty storefronts that read
  FOR LEASE**, no name more than twice. The building kit's random stream is untouched, so the city looks the same as before.
- **Doors.** Every shop door has a red OPEN sign and a green strip on the threshold (the same green as the door mats).
  Both are written into the existing city meshes: 0 extra draw calls. Walk up and the prompt names the shop; tap it, tap
  the door, or press E. Office lobbies and the towers are still not enterable.
- **One shared interior kit, dressed from data.** Three layouts (cafe, retail, service), each a shell (floor, two-tone
  walls, glass front with the door, back partition, back room with stock), a counter with a till and the shopkeeper, a back
  shelf, lamps, then what the kind asks for: 24 kinds of goods for shelves, and pieces such as an espresso machine, a pastry
  case, booths, record bins, clothes racks, bikes, flower buckets, barber chairs, washers, a workbench, teller windows and a
  vault door. The room is as wide as the building (5.6 to 10.5 m) and the door is where it is on the facade.
  A shop is built when you walk in (the screen dips to black for 0.2 s) and thrown away when you leave: one at a time.
- **The street through the window is the real street.** In the black moment before you step in, the street is drawn three
  times (left, ahead, right) into strips of the canvas and copied into one texture; inside, a hollow box the size of the
  street carries that picture. It uses the shaders the city is already drawn with, so nothing compiles. It is a still
  picture: day or night as it was when you walked in.
- **Jobs** (play money only; walk with the stick or keys, tap to use things):
  - **Barista at Calhoun Coffee** (90 s): customers come to the counter; walk the back bar and use the machines in the
    order on the ticket (cups, espresso, milk, hot water, chocolate, tea), then hand the cup over at the counter.
  - **Newsstand seller** (75 s): a green kiosk on the courthouse green facing Berry St. Step in behind the counter, tap the
    stack each customer asks for (The Observer, Sports, Comics, Puzzles), hand it over. The front of the stand opens /news.
  - **Bike courier** (3 runs): take the bike outside Wells St Bikes. Ride to a pickup door, then to the drop-off before the
    clock runs out. The place map shows the way; the bike is the same stick, faster (8.2 m/s, 11.5 at the rim).
  - **Usher at the Grand Palace** (90 s): guests wait at the doors with a seat on their ticket; walk up, they follow you,
    walk them to the seat and tap it. Every seat now has a number plate (A1 to D6).
- **The ledger.** A coin under the map shows your beats; tap it (or L) for the balance, where the work is (with "Show me
  the way"), and what you earned and spent. Every shop sells one thing at the till for a few beats. The ledger is kept on
  the device (`localStorage w2-ledger`), not on the account yet.
- **Policy.** No real money anywhere. Food is "pretend" and priced in beats. The line "Heartbeat Observatory never sells
  food, water or land, and nothing in World 2 costs real money" is in the ledger, and every shop has a PLAY MONEY ONLY
  notice by the till. The currency name and the policy line are data in `shops.json`.
- **Multiplayer.** Every shop interior shares one place in space, so each state message now says which shop you are in and
  you only see people in the same shop. Checked with two clients on the live channel. Jobs are your own: other players do
  not see your customers.

Budget (Playwright, MSI, Chromium on the Intel UHD GPU through ANGLE/D3D11; both builds measured in one session):

| | Limit | Before Phase 3 | Phase 3 |
|---|---|---|---|
| Inside a shop: draw calls | ≤ 30 | - | **14** in every one of the 114 shops (12 kit meshes, the street, the people) |
| Inside a shop: triangles | ≤ 60k | - | 9k to 36k (heaviest: yarn, florist, grocer). No shadow pass; the city is not drawn |
| City, phone, street day / night | ≤ 250 calls, ≤ 400k tris | 114 / 116 calls, 343k | 114 / 116 calls, 343-344k |
| City, phone, aerial day / night | ≤ 300 calls | 164 / 166 calls, 331k | 164 / 166 calls, 332-333k |
| City, desktop, street day / night | | 133 / 135 calls, 350-351k | 133 / 135 calls, 351-352k |
| City, desktop, aerial day / night | | 227 / 229 calls, 357-358k | 227 / 229 calls, 358-359k |
| City textures | ≤ 40 MB with everything | 18.2 MB | 21.7 MB (the sign sheet grew from 32 to 64 shop names, plus the papers) |
| Shop kit textures (kept once made) | | - | about 6 MB (floors, wood, goods sheet, the shop's own sign sheet) |
| Street picture (only while inside) | | - | 3 to 5 MB |
| Frame time median / p95 | | 16.6 / 18.1 ms | 16.7 / 18.1 ms (vsync-locked; says nothing about a phone) |

- What Phase 3 spent outdoors: 0 to +1 draw calls and about +1k triangles. Indoors it is a fraction of the street.
- **Texture memory is now the tight one:** about 22 + 4 (ground, foliage) + 6 + 5 = 37 MB of the 40 MB limit while you
  stand in a shop. More shop names cost about 0.35 MB per four. KTX2 (Phase 6) or a smaller sign cell would buy room.
- Two fixes to older code that pay for themselves: the Grand Palace's two house lights were lit all the time, so every
  pixel of the city shaded two extra point lights (now they only burn inside the theater); and inside the three halls
  the city was still being drawn whenever you faced west (measured: 82-97 calls and 265k triangles; now 6-13 calls and
  1-2k triangles).
- You used to walk into the theater, the arcade and the library **facing the exit door**. Fixed.

Checks, all PASS: Chromium at 390x844 (touch) and 1280x800 (mouse and keys), WebKit at 390x844; `test3.cjs`.
- every one of the 114 shops: the door prompt names it, in, the budget, every station and the back room can be walked to
  (a flood fill of the floor with your body width), out, back on the sidewalk facing the street;
- each of the four jobs worked for a whole shift at phone size with real touches: the stick to walk, taps on the machines,
  stacks and seats or on the prompt; a wrong machine and a wrong seat are refused; the pay lands in the ledger;
- buy at the till, the ledger card, a poster that opens a page of the site, the map (Calhoun Coffee, Wells St Bikes and
  the Newsstand are on it; the other shops are not, they would bury the real places);
- a shop visited 12 times leaves nothing behind (geometries, textures and scene objects unchanged);
- Phase 2's crowd audit is still clean with the kiosk and the bike on the sidewalk, all Phase 1 doors still prompt, the
  gate preview still loads, zero console errors by day and by night.

Test handles (`?dev=1`): `W2.city.shops`, `W2.enterShop(id)`, `W2.leaveShop()`, `W2.shops.stats()`, `W2.shopNow`,
`W2.jobs` (`.start(id)`, `.state`, `.ledger()`), `W2.interiorStations`. Scripts: `AI-Shared/scratch/world2-remake/phase3/scripts/`
(`serve.cjs`, `test3.cjs`, `gallery.cjs`, `measure3.cjs`, `mp3.cjs`); they serve three.js from a local copy so a CDN
hiccup cannot stall a run.

Left for later, and things the plan did not see:
- **Jaron's iPhone check.** Most likely to differ on a real iPhone: the street picture in the window (it copies the
  canvas into a texture; it works in Chromium and in WebKit on Windows), and how a shift feels with a thumb.
- **The ledger belongs on the account** (one account across the worlds). That needs a table and a server-side function so
  beats cannot be forged; left out on purpose, nothing here changes the database.
- **Shops only face the east-west streets.** The kit never builds on Calhoun, Harrison, Clinton and the other north-south
  streets (the leftover strip is half a metre too short for a lot), so those streets are side walls. Corner shops could
  get a second door, or the rows could be made shallower.
- 50 more rows in the table would give every storefront its own name. Office lobbies and towers need their own kit.
- The five FOR LEASE storefronts are the natural place for "a building can be claimed as a business" (WORLDS-MODEL).
- Shopkeepers and customers are the sidewalk figure with a face added; up close they are plain. MetaHumans (Phase 2b).
- The Grand Palace interior is still the old box room; the usher job will carry over to the real auditorium in Phase 4.

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
