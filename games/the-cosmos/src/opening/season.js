// ============================================================================
// opening/season.js - the season setting the opening's script reads (BIBLE-v3 section 5, DECISIONS 10/3 10:46 AM).
//
// Each season the transport to your world crashes for a different reason, so replays feel different but still end in a wreck. The season
// length is a setting (change SEASON.lengthDays); the cause rotates through CRASH_CAUSES, never the same two seasons running. Players who
// start in the same season crash in the same event. Pure data, no three.js: the authority, the client and the tests read this one file.
// ============================================================================

/** Season one began on 2026-10-01 (UTC). `lengthDays` is the planned length of a season: a setting, not a rule. */
export const SEASON = { epochMs: Date.UTC(2026, 9, 1), lengthDays: 60 };

/** The five crash causes, in the order the seasons rotate through them (the SPOILER table's order). */
export const CRASH_CAUSES = ['storm', 'meteor', 'pirates', 'failure', 'weather'];

/** What each cause is called to a player (the board's season line), and what it does to the season after the opening. */
export const CAUSE_INFO = {
  storm: { name: 'Solar storm', season: 'This season the Sun is angry: storms come more often and knock out comms.' },
  meteor: { name: 'Meteor strike', season: 'This season rocks fall: meteor showers hit the home worlds more often.' },
  pirates: { name: 'Pirate hit', season: 'This season the Corsairs are bolder.' },
  failure: { name: 'Failed part', season: 'A quiet season: the crash was the line\'s fault, and the line pays more in settlement.' },
  weather: { name: 'Bad weather', season: 'This season the weather is heavier on every world that has any.' },
};

/** The season number (from 1) at a wall-clock time. */
export function seasonNumber(nowMs = Date.now(), s = SEASON) {
  return Math.max(1, Math.floor((nowMs - s.epochMs) / (s.lengthDays * 86400000)) + 1);
}
/** The crash cause of a season number. Consecutive seasons never repeat (the list has no neighbours alike). */
export function crashCauseFor(n) { return CRASH_CAUSES[(Math.max(1, n | 0) - 1) % CRASH_CAUSES.length]; }
/** { number, cause } for a time. `override` (a cause id) is for review and tests only: it never changes the number. */
export function currentSeason(nowMs = Date.now(), override = null) {
  const number = seasonNumber(nowMs);
  return { number, cause: CRASH_CAUSES.includes(override) ? override : crashCauseFor(number) };
}
