// ============================================================================
// desktopPost.js - optional desktop post-processing pipeline.
// ============================================================================

import * as THREE from 'three';
import { EffectComposer } from '../../lib/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../../lib/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../lib/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../../lib/examples/jsm/postprocessing/OutputPass.js';

export function installDesktopPost(engine) {
  const composer = new EffectComposer(engine.renderer);
  composer.addPass(new RenderPass(engine.scene, engine.camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.42,
    0.34,
    0.82
  );
  bloom.name = 'desktop-bloom';
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.setSize(window.innerWidth, window.innerHeight);
  engine.onResize((w, h) => {
    composer.setSize(w, h);
    bloom.setSize(w, h);
  });
  engine.setRenderPipeline({
    render() {
      composer.render();
    },
  });
  return { composer, bloom };
}
