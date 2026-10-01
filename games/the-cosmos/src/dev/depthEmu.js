// ============================================================================
// depthEmu.js - pretend the depth buffer is only 16 bits deep (?depth=16).
//
// WHY: some phones give WebGL a 16-bit depth buffer where a desktop gives 24 or
// 32. Two surfaces a centimetre apart that are perfectly clean on a laptop then
// fight each other on the phone, in stair-stepped blocks. This makes every
// standard material round the depth it writes to 16 bits, so the same thing can
// be reproduced and fixed on a desktop. It changes nothing unless the flag is set.
// ============================================================================

import * as THREE from 'three';

export const depthEmulation = (() => {
  try {
    const v = new URLSearchParams(location.search).get('depth');
    return v === '16' || v === '12' ? Number(v) : 0;
  } catch (e) { return 0; }
})();

if (depthEmulation) {
  const steps = (Math.pow(2, depthEmulation) - 1).toFixed(1);
  THREE.ShaderChunk.logdepthbuf_fragment += `
#if defined(USE_LOGDEPTHBUF) && defined(USE_LOGDEPTHBUF_EXT)
  gl_FragDepth = floor(gl_FragDepthEXT * ${steps} + 0.5) / ${steps};
#else
  gl_FragDepth = floor(gl_FragCoord.z * ${steps} + 0.5) / ${steps};
#endif`;
}
