# looks-r1 — how the ships read

iPhone WebKit, landscape 852×393, device scale 2. Before and after frames are in this folder. The before cameras stay as shot. Two after cameras were moved so the new geometry is in frame: the flight deck stands aft and to port, and the boarding-hall frame aims at the terminal row. Salon, boards, ramp, night pad, and the hull flank use the same cameras as the befores.

## Done

1. Skiff flight deck. The pilot and captain chairs are frames, cushions, bolsters, headrests, and a lap belt. The navigator chair is a post, a five-star base, and a backed shell. ATTITUDE, FLIGHT, STANDBY, and the side POSITION screen are lit readouts on the first frame. The standby screen is no longer a blank white card. With the crew model missing, the stand-in is a flight suit, helmet, cyan visor, and a chest lamp (`after-1-flight-deck.png`).

2. Skiff exterior. The center bell is out of the stern hatch. Two shoulder bells sit above the opening and the ramp drops clear (`after-2-skiff-ramp.png`). Two smaller bells sit low on the flanks, beside the hatch.

3. Seats. Salon rows are steel frames, cushions, back shells, headrests, armrests, lap belts, and a cyan seat number (`after-3-boarding-seats.png`). The boarding hall uses the same row, under the name `terminal`, so it is not added to the 300 nose-facing passenger seats (`after-3b-gate.png`).

4. Departure boards. One shared list, painted once. Promenade and boarding hall both show it: TIME, SHIP, REG, TO, STATUS. Rows are Hellas Dawn, the opening convoy, and the ship on pad 01. Times are a stable fold of the registry, not a timetable. Status on the apron or on the pad is green; company, bulker, and escort are amber (`after-4-depart-board.png`, `after-4b-gate-board.png`).

5. Night pad. The slab, the yellow marks, and the concrete skirt read under the night sky. The Skiff sits on that concrete (`after-5-pad-night.png`). No new port material. Numbered pads, the apron, and the walkway keep the same grounding.

6. Hellas Dawn flank. The pale blank panel is a framed window: dark surround, mullions, warm glass. The smaller salon windows use the same frame. The white boxes on the lifeboat pods are hatches with a small lamp (`after-6-hull-windows.png`).

## Not done here

- Ground past the pad skirt is still dark at night. The skirt is the concrete that already existed, a few metres wider, with a dim emissive. The planet surface was left alone.
- From the pad the glass reads as a warm pane inside the frame. It does not read as a deep recess or as a mirror.
- The hull being empty when you look through it from outside is the other workstream.
- Cafe and crew benches were left as they were. Luggage in the salon is still the soft bags.

## Checks

`node test/validate.mjs` (games/the-cosmos): 1802 passed, 1 failed. The failure is `Deimos is farther and takes longer (68 min) and the drive reaches it exactly too` in `test/space-checks.mjs`. The same run's height sweep still arrives within 1% of 68.0 min. `transit.js` and `space-checks.mjs` are untouched on this branch. Seat envelopes, port size, and grounding passed. Phone port: 21 draw calls, 57,300 triangles, 4.9 MB. High tier stayed inside 21 calls, 100k triangles, and 9 MB. Transport interior 248,598 triangles and 177 meshes (budget 340,000 and 220). Lifeboat interior 18,220 triangles and 51 meshes. Passenger seats stayed 300, all nose-facing.

`node test/phone-check.mjs`: exit 0. 33 rows, 0 failed (iPhone WebKit and Galaxy Chromium). Playwright's Windows WebKit has no Web Audio; the check says so and still decodes an mp3. These frames are Playwright WebKit at 852×393, device scale 2. A physical iPhone was not in this session.

The flight-deck after frame was taken before the thin seat rails and the head post were added so the chairs meet the seat envelope. Those pieces sit inside the chair silhouette. The night-pad after frame was taken before the concrete skirt moved onto the unmeasured port kit. It is the same concrete in the same place.
