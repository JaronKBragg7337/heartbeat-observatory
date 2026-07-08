// ============================================================================
// lighting.js — sun, sky light, shadows, fog, and sky color. The mood system.
//
// OWNS: the scene's lights, the shadow rig, scene.fog, scene.background, and
//       how all of those react to which body you are near and how high you are.
// DOES NOT OWN: the atmosphere SHELL mesh fade (traversal.js owns that),
//       body colors (bodies.js data), or the renderer flags (engine.js).
//
// TECHNIQUE (World of ClaudeCraft renderer.ts): ACES tone mapping + a warm
// DirectionalLight sun + a HemisphereLight (cool sky bounce over warm ground
// bounce) + PCFSoft shadows + per-biome fog is most of what makes a Three.js
// scene stop looking like plastic. SYL addition: all of it has to react to
// WHERE you are — fog and sky only exist inside an atmosphere, so everything
// lerps with altitude and hands over to black space above the atmo ceiling.
//
// SUN DIRECTION: SYL's playable system has no sun *body* yet (bodies.js Earth
// sits at the origin). Canon here: SUN_DIR is a fixed world-space direction.
// When a real star body lands in bodies.js, replace SUN_DIR with
// (starPos - cameraWorldPos).normalize() and nothing else changes.
//
// FLOATING ORIGIN NOTE: the camera renders at (0,0,0), so the sun light and
// shadow camera are pinned around the origin and automatically follow the
// player — a 90 m shadow box around the origin is always around the camera.
// ============================================================================

import * as THREE from 'three';
import { dominantBody, altitudeAt } from '../world/planet.js';
import { TUNE } from '../dev/tuner.js';

export const SUN_DIR = new THREE.Vector3(0.32, 0.9, 0.18).normalize(); // high sun over the Fortis outpost spawn — verified against the live staging route

const _skyCol = new THREE.Color();
const _fogCol = new THREE.Color();
const _groundCol = new THREE.Color();
const SPACE_BG = new THREE.Color(0x000005);
const SUN_WARM = 0xfff1dc;

export function initLighting(engine, settings) {
  const scene = engine.scene;
  const graphics = settings?.get ? settings.get('graphics') : 'high';

  // Renderer flags (mobile lane historically skipped these — that flat gray
  // look was largely linear-space output with no tone curve).
  engine.renderer.outputColorSpace = THREE.SRGBColorSpace;
  engine.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  engine.renderer.toneMappingExposure = 1.18 * (TUNE.exposure || 1);

  const sun = new THREE.DirectionalLight(SUN_WARM, 2.6);
  sun.position.copy(SUN_DIR).multiplyScalar(260);
  sun.target.position.set(0, 0, 0);
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x4a4438, 0.75);
  scene.add(hemi);

  // Shadows: phone-first. 'high' = 1024 PCF-soft map over a 95 m box around
  // the camera. 'low' = off. Toggling graphics applies on next boot (the
  // settings panel already says so for other options).
  const shadows = graphics !== 'low';
  engine.renderer.shadowMap.enabled = shadows;
  engine.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const c = sun.shadow.camera;
    c.left = -95; c.right = 95; c.top = 95; c.bottom = -95;
    c.near = 40; c.far = 520;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.6;
  }

  scene.fog = new THREE.FogExp2(0x9db8d8, 0.0);
  scene.background = SPACE_BG.clone();

  return { sun, hemi, scene, shadowsEnabled: shadows, _lastT: -1 };
}

// Per-frame: read where the camera is, blend sky/fog/light between "inside
// this body's atmosphere" and "hard space".
export function updateLighting(L, engine, bodies) {
  const body = dominantBody(bodies, engine.cameraWorldPos);
  let t = 0; // 0 = space, 1 = on the ground under a full atmosphere
  if (body && body.atmosphere) {
    const alt = altitudeAt(body, engine.cameraWorldPos);
    t = Math.max(0, Math.min(1, 1 - alt / body.atmosphere.height)) * (body.atmosphere.density ?? 1);
  }

  // Sky + fog colors: body atmosphere color, pushed brighter near the ground.
  if (t > 0.001 && body?.atmosphere) {
    _skyCol.setHex(body.atmosphere.color);
    _fogCol.copy(_skyCol).lerp(new THREE.Color(0xffffff), 0.22); // hazy horizon
    engine.scene.background.copy(SPACE_BG).lerp(_skyCol, t * 0.85);
    L.scene.fog.color.copy(_fogCol);
    // Visibility ~1.6 km at full atmosphere. FogExp2: f = e^-(d*z)^2.
    L.scene.fog.density = 0.00085 * t * (TUNE.fog ?? 1);
  } else {
    engine.scene.background.copy(SPACE_BG);
    L.scene.fog.density = 0;
  }

  // Hemisphere: sky color above, terrain-ish bounce below; dies off in space.
  if (body) {
    _groundCol.setHex(body.colors?.mid ?? 0x4a4438);
    L.hemi.color.copy(t > 0.001 && body.atmosphere ? _skyCol : new THREE.Color(0x8899bb));
    L.hemi.groundColor.copy(_groundCol).multiplyScalar(0.8);
  }
  L.hemi.intensity = (0.3 + 0.75 * t) * (TUNE.hemi || 1);

  // Sun: slightly softer inside atmosphere (scatter), harsher in vacuum.
  L.sun.intensity = (2.9 - 0.5 * t) * (TUNE.sun || 1);
  engine.renderer.toneMappingExposure = 1.18 * (TUNE.exposure || 1);
}
