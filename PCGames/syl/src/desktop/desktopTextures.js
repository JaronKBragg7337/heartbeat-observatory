// ============================================================================
// desktopTextures.js - procedural PBR texture generation for desktop terrain.
//
// OWNS: browser-side CanvasTexture creation for desktop.html only.
// DOES NOT OWN: terrain height/collision. Textures decorate the same mesh-true
//               terrain surface built from planet.js.
// ============================================================================

import * as THREE from 'three';
import { fbm } from '../core/math3d.js';

export function createTerrainTextureSet(body, size = 1024) {
  const albedo = document.createElement('canvas');
  const roughness = document.createElement('canvas');
  const bump = document.createElement('canvas');
  albedo.width = albedo.height = roughness.width = roughness.height = bump.width = bump.height = size;
  const ac = albedo.getContext('2d');
  const rc = roughness.getContext('2d');
  const bc = bump.getContext('2d');
  const albedoData = ac.createImageData(size, size);
  const roughData = rc.createImageData(size, size);
  const bumpData = bc.createImageData(size, size);
  const low = new THREE.Color(body.colors.low);
  const mid = new THREE.Color(body.colors.mid);
  const high = new THREE.Color(body.colors.high);
  const profile = body.terrain.profile || 'continental';
  const c = new THREE.Color();

  for (let y = 0; y < size; y++) {
    const v = y / (size - 1);
    const theta = v * Math.PI;
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const phi = u * Math.PI * 2;
      const st = Math.sin(theta);
      const dx = -Math.cos(phi) * st;
      const dy = Math.cos(theta);
      const dz = Math.sin(phi) * st;
      const macro = fbm(dx, dy, dz, body.terrain.seed + 211, 5, body.terrain.freq * 1.8);
      const micro = fbm(dx, dy, dz, body.terrain.seed + 499, 4, body.terrain.freq * 12.0);
      const h = Math.max(0, Math.min(1, 0.5 + macro * 0.5));
      if (h < 0.48) c.lerpColors(low, mid, h / 0.48);
      else c.lerpColors(mid, high, (h - 0.48) / 0.52);
      tintByProfile(c, profile, h, micro);
      const idx = (y * size + x) * 4;
      albedoData.data[idx] = Math.round(c.r * 255);
      albedoData.data[idx + 1] = Math.round(c.g * 255);
      albedoData.data[idx + 2] = Math.round(c.b * 255);
      albedoData.data[idx + 3] = 255;
      const rough = roughnessFor(profile, h, micro);
      roughData.data[idx] = roughData.data[idx + 1] = roughData.data[idx + 2] = Math.round(rough * 255);
      roughData.data[idx + 3] = 255;
      const bumpV = Math.max(0, Math.min(1, 0.5 + macro * 0.35 + micro * 0.15));
      bumpData.data[idx] = bumpData.data[idx + 1] = bumpData.data[idx + 2] = Math.round(bumpV * 255);
      bumpData.data[idx + 3] = 255;
    }
  }
  ac.putImageData(albedoData, 0, 0);
  rc.putImageData(roughData, 0, 0);
  bc.putImageData(bumpData, 0, 0);
  return {
    map: texture(albedo, THREE.SRGBColorSpace),
    roughnessMap: texture(roughness),
    bumpMap: texture(bump),
  };
}

function texture(canvas, colorSpace = THREE.NoColorSpace) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = colorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function tintByProfile(color, profile, h, micro) {
  if (profile === 'ice') {
    color.lerp(new THREE.Color(0xd9fbff), 0.35 + h * 0.25);
  } else if (profile === 'volcanic') {
    color.lerp(new THREE.Color(micro > 0.42 ? 0xff5a1f : 0x050505), micro > 0.42 ? 0.38 : 0.22);
  } else if (profile === 'dune') {
    color.lerp(new THREE.Color(0xd7a45b), 0.25);
  } else if (profile === 'oceanic') {
    color.lerp(new THREE.Color(0x0e355f), h < 0.42 ? 0.38 : 0.08);
  } else if (profile === 'gas') {
    color.lerp(new THREE.Color(h > 0.5 ? 0xf1c785 : 0x59457a), 0.35);
  }
}

function roughnessFor(profile, h, micro) {
  if (profile === 'ice') return 0.18 + h * 0.35;
  if (profile === 'volcanic') return 0.52 + Math.abs(micro) * 0.28;
  if (profile === 'oceanic') return h < 0.42 ? 0.28 : 0.72;
  if (profile === 'gas') return 0.9;
  return 0.62 + Math.abs(micro) * 0.22;
}
