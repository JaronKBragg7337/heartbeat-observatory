// worlds/moon-shackleton/client.js - Shackleton Base's dressing (see ../moon/clientCommon.js).
import { dressMoon } from '../moon/clientCommon.js';
import { buildShackleton } from '../moon/shackleton.js';

export default { dress: (world, o) => dressMoon(world, o, buildShackleton) };
