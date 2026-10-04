# Phone check

Run date: 2026-10-04

| Target | Check | Result | Detail |
|---|---|---:|---|
| local/iPhone-15-WebKit | load page | PASS |  |
| local/iPhone-15-WebKit | HTML / JS / manifest / server build id agree | PASS |  |
| local/iPhone-15-WebKit | opening: intro plays, refresh resumes the same step | PASS |  |
| local/iPhone-15-WebKit | opening: exit-freighter button works with a thumb held on the stick | PASS |  |
| local/iPhone-15-WebKit | opening: refresh in the dig stage resumes the dig stage | PASS |  |
| local/iPhone-15-WebKit | opening: dig and grab-the-crate buttons respond to every tap, thumb held | PASS |  |
| local/iPhone-15-WebKit | opening: refresh at the ride offer stays at the ride offer | PASS |  |
| local/iPhone-15-WebKit | opening: ride offer, riding the vehicle to the port | PASS |  |
| local/iPhone-15-WebKit | after the opening: settings opens and closes via real taps | PASS |  |
| local/iPhone-15-WebKit | voices: NOTE this browser build has no Web Audio (the Playwright Windows WebKit) | PASS | unlock and placed playback verified on the Chromium profile only; mp3 decode checked below through an audio element; real iOS Safari not tested |
| local/iPhone-15-WebKit | voices: settings rows work by touch, a tap unlocks audio, a port worker line decodes and plays from their body | PASS |  |
| local/iPhone-15-WebKit | after the opening: visible buttons respond to real taps while a thumb holds the stick | PASS |  |
| local/iPhone-15-WebKit | PLAYFIX: no two visible buttons overlap (aboard, seated, piloting, near people, all at once; portrait and landscape) | PASS |  |
| local/iPhone-15-WebKit | FREEFLIGHT: real taps on the free-flight bar, a held THRUST burns the drive, the stick turns the ship, no overlaps in four viewports | PASS |  |
