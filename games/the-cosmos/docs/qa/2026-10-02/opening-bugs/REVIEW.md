# Opening bug review — 2026-10-02

Changes are uncommitted. No deployment or external message was sent. Luna owns
publishing. The rover integration is a written handoff in
[OPENING-VEHICLE-INTERFACE.md](../../../OPENING-VEHICLE-INTERFACE.md).

## Findings and fixes

1. **Dropped action taps:** the opening disabled its action button during its
   one-second background save, and rejected interaction while `busy`. A tap now
   waits for that save and performs one action. Opening buttons activate on
   pointer release, support keyboard clicks, and suppress duplicate synthesized
   clicks. Touch movement captures its own pointer and resets on cancellation,
   capture loss, blur and backgrounding. Canvas touch suppression no longer
   cancels scrolling inside the game's panels. Talk labels stay intact; sheets
   defer replacing the pressed DOM until the release/click sequence finishes.
   The game's shell opts out of the site-wide phone overlay, whose launcher uses
   a much higher z-index than game buttons.
2. **Refresh:** production no longer silently changes from the shared save to a
   separate solo save when the authority is unavailable. It visibly reconnects.
   Opening commands are journaled before transmission and replayed with their
   original action ids after reload. This includes a carry action committed by
   the server with its receipt deliberately dropped. Solo play uses a synchronous
   opening checkpoint for stage, timers, position and cuts, including on page
   hide; it never imports that checkpoint into the shared authority.
3. **Ride:** its offer uses the acknowledged driver-arrival timer. The passenger
   enters a defined seat, the vehicle travels continuously to the port, and a
   mid-ride refresh retains progress. The adapter owns no purchase, free driving,
   ownership or general rover persistence. Geometry stays in the existing rover
   factory for Grok Build to replace.
4. **People and ships:** people have animated suit geometry immediately and keep
   it when a GLB fails or times out. Port workers can use those suits without
   downloading another roster. Talk targeting requires a loaded, visible person
   with visible ancestors and uses the person's current position. An adjacent
   valid person may become the next target; the departed person's prompt clears.
   Disconnected flying player ships and unfinished players' reserved ships are
   hidden. Owned landed ships remain, labelled `PARKED · owner offline`.
5. **Return/landing:** Return home from space uses the regular port course. Speed
   buttons remain available for the whole course, and a persistent touch row
   makes them reachable without reopening the pilot conversation. Local pilot
   return/landing orders accept the same compression intents. Existing bounded
   physics steps and ×1 for the final 400 m remain in force.

## Cache and version checks

No game service-worker registration was found in the repository; the isolated
browser had no controlling worker. The game previously loaded unversioned
`main.js` and relative modules, and had no dedicated Vercel cache rule or build
handshake. These are plausible contributors, **not proof that Jaron received
stale code**.

The deployment stamp fingerprints the shell, every client module and authority
module, normalizing paths/newlines across Windows and Linux. Its generated
import map gives the whole module graph one version. The uncached build manifest
is checked at boot, on foregrounding and periodically; the authority also sends
its build in welcome and `/health`. A mismatch forces a cache-busting reload,
bounded to one attempt per target version to prevent rollout loops. Vercel
revalidates browser game assets and disables CDN storage for this route. See
[Vercel cache headers](https://vercel.com/docs/caching/cache-control-headers) and
[WebKit's pointer-capture implementation](https://bugs.webkit.org/show_bug.cgi?id=193917).

Both live header requests (`/games/the-cosmos/` and `/src/main.js`) failed at the
network connection from this environment. Live headers, Jaron's existing cache,
and the deployed authority version therefore remain unverified.

## Verification

The final validator result is recorded in `validator-final.txt`; focused browser
details are in `browser-results.json` and `browser-log.txt`.

The first full run caught a panel reply that could not redraw while its press
guard remained set. Click capture now releases that guard before the reply
handler. The focused conversation check then passed for all 15 workers in solo
and shared play. `validator-first-attempt.txt` preserves that earlier failure;
use the final run for the completed result.

The new walkthrough runs Chromium at **390×844**, with touch enabled, an iPhone
Safari user agent, real two-finger events, and an isolated in-memory authority.
It walks the opening through its actual buttons and movement controls, checks
refreshes at the intro, exit, digging, driver offer, ride and completed port,
delays background saves, drops a committed carry receipt, checks NPC visibility
and ship presence, injects a stale manifest, and blocks every person GLB in a
separate context. Post-opening NPC and airborne states use explicit fixtures;
the return test uses the public pilot order and on-screen ×60 button, then runs
the real landing physics through touchdown.

| Evidence | Screenshot |
| --- | --- |
| Intro | [01](01-intro.png) |
| Exit action | [02](02-exit-action.png) |
| Cleared crate | [03](03-crate-cleared.png) |
| Driver offer | [04](04-ride-offer.png) |
| Seated passenger during ride | [05](05-passenger-ride.png) |
| Port arrival | [06](06-port-arrival.png) |
| Rendered candidate and matching prompt | [07a](07a-visible-candidate.png) |
| Candidate conversation | [07](07-visible-hire-candidate.png) |
| Port worker conversation | [08](08-port-worker.png) |
| Return descent with speed controls | [09](09-return-descent-speed.png) |
| Return touchdown | [09b](09b-return-landed.png) |
| All GLBs failed; visible suit and matching prompt | [10a](10a-failed-glb-person.png) |
| Failed-GLB conversation | [10](10-failed-glb-fallback.png) |

The return fixture advances 60 flight seconds in one real second at ×60, lands
with hull integrity 100, and stops about 3.03 m from the pad centre. Its final
approach takes another 43.5 real seconds with the ground compression limits.

This is **not an actual iPhone/Safari run**. Safari's native event delivery and
GPU memory behavior still need device confirmation after publishing. The
existing graphics recovery and safe-mode checks remain part of the validator.
The current rover's windshield is visually heavy in the passenger screenshot;
the seat and travel work, while its art remains with Grok Build.

## Publishing handoff

Run the stamp on the final combined tree before publishing or restarting the
authority: `node tools/stamp-cosmos-build.mjs`. Vercel's build and the Windows
authority startup script now run it automatically. Publish/restart both client
and authority together; a mixed rollout is limited to one reload per version
and needs the second component updated. Check that live `build.json`, the
browser build and authority `/health.buildVersion` agree, then verify the live
cache headers and repeat taps on Jaron's iPhone. Do not discard existing saves.
