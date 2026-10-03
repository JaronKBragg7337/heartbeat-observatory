// ============================================================================
// space/clock.js - the game's one clock. Pure: no three.js, no DOM, no registry (the server, the validator and the browser share it).
//
// OWNS: what "now" is in the sky. Game time is REAL UTC: `worldTimeS()` is seconds since the game's epoch (2026-10-03 00:00 UT, the same
//   instant as `START_JD` in worlds/_kit/ephemeris.js), and it runs at the rate of the real clock. THE CALENDAR IS NOT COMPRESSED
//   (rate 1). A Martian sol at the port is therefore 24 h 39.6 min of real time, Phobos goes round in 7 h 39 min, and all players agree
//   because they all read the server's clock (a browser measures its offset to the server once and keeps it: `setServerTime`).
//   Time compression stays where it always was, on the ship: the x5..x500 of a course or free flight runs the SHIP's own clock
//   (flight.epochS) faster while she is in space, so a ship that warps sees the sky and the moons run fast, and everything she
//   flew is consistent with where the moons were when she flew it. On the ground (or in a moon's frame) the ship rejoins the world's time.
// DOES NOT OWN: the orbits and the spin (worlds/_kit/ephemeris.js), the frames (space/frames.js), anything drawn.
// ============================================================================

/** The game's epoch as Unix milliseconds: 2026-10-03 00:00:00 UT (Julian date 2461316.5). */
export const EPOCH_MS = (2461316.5 - 2440587.5) * 86400000;

/** Mutable: the browser sets `offsetMs` from the server's clock; a QA link sets `shiftS` (?sky=...). The server never uses these (it passes its own `now`). */
export const clock = { offsetMs: 0, shiftS: 0, nowMs: () => Date.now() };

/** Game seconds (since the epoch) at a wall-clock time in Unix ms. The server calls this with its own `now()`; a browser with nothing (the shared offset and QA shift apply). */
export const worldTimeAt = (nowMs) => (nowMs - EPOCH_MS) / 1000;
export const worldTimeS = (nowMs) => ((nowMs === undefined ? clock.nowMs() : nowMs) + clock.offsetMs - EPOCH_MS) / 1000 + clock.shiftS;

/** A browser learns the server's clock: `serverMs` is the server's Date.now() in a message that arrived at local `localMs`. Half a typical round trip is not worth chasing (a sol is 24 hours). */
export function setServerTime(serverMs, localMs = Date.now()) { if (Number.isFinite(serverMs)) clock.offsetMs = serverMs - localMs; }
export function setSkyShift(seconds) { clock.shiftS = Number.isFinite(seconds) ? seconds : 0; }
