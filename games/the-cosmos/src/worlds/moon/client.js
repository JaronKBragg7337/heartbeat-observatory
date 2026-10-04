// worlds/moon/client.js - Tranquility Civil Hub's dressing (see clientCommon.js).
import { dressMoon } from './clientCommon.js';
import { buildHub } from './hub.js';

export default { dress: (world, o) => dressMoon(world, o, buildHub) };
