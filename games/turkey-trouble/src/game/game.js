// One door to the four modes. createGame(kind, layout, { seed, carry, run }) -> a game with step(input), events, hud.
// input = { mx, mz, run, action, fx, fz }: wanted move in WORLD space (length 0..1), run held, action pressed this step,
// and the camera's forward (fx, fz) so "facing it" also counts when the camera looks at it.
import { createFind } from './modes/find.js';
import { createHunted } from './modes/hunted.js';
import { createHunt } from './modes/hunt.js';
import { createEscape } from './modes/escape.js';
export { fingerprint } from './modes/common.js';
export { ENDING_LINES, DT } from './tuning.js';

export const MODES = ['find', 'hunted', 'hunt', 'escape'];
export const MODE_NAMES = { story: 'Story', find: 'Find the Turkey', hunted: 'It Hunts You', hunt: 'You Hunt It', escape: 'Escape the Farm' };
export const STORY = ['find', 'hunted', 'hunt', 'escape'];
// One short line between the story's chapters (shown after the mode named).
export const STORY_LINES = {
  find: 'Uh oh. It did not like being found.',
  hunted: 'It ran out of puff. Your turn to chase it!',
  hunt: 'Nice catch. Now you are the turkey. Get to the woods!',
};

export function createGame(kind, layout, opts = {}) {
  switch (kind) {
    case 'find': return createFind(layout, opts);
    case 'hunted': return createHunted(layout, opts);
    case 'hunt': return createHunt(layout, opts);
    case 'escape': return createEscape(layout, opts);
    default: throw new Error('unknown mode ' + kind);
  }
}

export function makeInput() { return { mx: 0, mz: 0, run: false, action: false, fx: 0, fz: 1 }; }
