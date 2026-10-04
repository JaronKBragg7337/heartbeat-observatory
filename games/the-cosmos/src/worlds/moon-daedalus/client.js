// worlds/moon-daedalus/client.js - Daedalus Station's dressing (see ../moon/clientCommon.js).
import { dressMoon } from '../moon/clientCommon.js';
import { buildDaedalus } from '../moon/daedalus.js';

export default { dress: (world, o) => dressMoon(world, o, buildDaedalus) };
