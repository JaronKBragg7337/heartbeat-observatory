// ============================================================================
// desktopAssets.js - GLB loading and model instancing for desktop.html.
//
// OWNS: imported GLB runtime assets. The desktop build intentionally loads
//       models for ship/building/prop presentation instead of constructing the
//       major silhouettes from primitives at runtime.
// ============================================================================

import * as THREE from 'three';
import { GLTFLoader } from '../../lib/examples/jsm/loaders/GLTFLoader.js';

export const DESKTOP_ASSET_PATHS = {
  ship: './assets/desktop/fortis-gunship.glb',
  habitat: './assets/desktop/fortis-habitat.glb',
  prop: './assets/desktop/industrial-prop.glb',
};

export class DesktopAssetLibrary {
  constructor(paths = DESKTOP_ASSET_PATHS) {
    this.paths = paths;
    this.loader = new GLTFLoader();
    this.cache = new Map();
  }

  preload() {
    return Promise.all(Object.keys(this.paths).map((key) => this.load(key)));
  }

  async load(key) {
    if (this.cache.has(key)) return this.cache.get(key);
    const promise = this.loader.loadAsync(this.paths[key]).then((gltf) => {
      const root = gltf.scene;
      root.name = `asset:${key}`;
      prepareModel(root);
      return root;
    });
    this.cache.set(key, promise);
    return promise;
  }

  async instance(key, options = {}) {
    const source = await this.load(key);
    const root = source.clone(true);
    root.name = options.name || `${key}:instance`;
    root.scale.setScalar(options.scale || 1);
    if (options.castShadow !== false) prepareModel(root);
    return root;
  }
}

export function installDesktopShipVisual(ship, assets) {
  const rebuild = async () => {
    const keepGlow = ship._glow;
    ship.group.clear();
    try {
      const model = await assets.instance('ship', { name: 'Fortis_Gunship_GLB', scale: 1 });
      ship.group.add(model);
    } catch (e) {
      // If a GLB fails to load, keep gameplay running with an obvious minimal
      // debug mesh. This is a broken asset state, not the intended desktop look.
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(3, 1, 8),
        new THREE.MeshStandardMaterial({ color: 0x7b1e1e, roughness: 0.5, metalness: 0.2 })
      );
      marker.name = 'desktop-asset-load-fallback';
      marker.castShadow = marker.receiveShadow = true;
      ship.group.add(marker);
    }
    ship._glow = keepGlow || new THREE.PointLight(0xff6d3f, 0, 45);
    ship._glow.position.set(0, 0.15, -5.1);
    ship.group.add(ship._glow);
  };
  ship.rebuildVisual = () => { rebuild(); };
  ship.rebuildVisual();
}

export function prepareModel(root) {
  root.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      if (node.material) {
        node.material.envMapIntensity = 1.1;
        node.material.needsUpdate = true;
      }
    }
  });
}
